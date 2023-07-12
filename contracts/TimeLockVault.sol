// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import { DepositInfo } from "./lib/TimeLockVaultStructs.sol";
import "./interfaces/ITimeLockVault.sol";
import "./interfaces/TimeLockVaultErrors.sol";

abstract contract TimeLockVault is ERC20Upgradeable, ITimeLockVault, TimeLockVaultErrors {
    using SafeERC20Upgradeable for IERC20MetadataUpgradeable;
    using MathUpgradeable for uint256;
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.UintSet;

    uint256 private _currentDepositId;

    mapping(address => EnumerableSetUpgradeable.UintSet) private _activeDepositIds;
    mapping(uint256 => DepositInfo) private _depositsData;
    mapping(address => uint256[]) private _recipientDepositsIds;

    IERC20MetadataUpgradeable private _asset;

    function __TimeLockVault_init(
        string memory _name,
        string memory _symbol,
        address asset_
    ) internal onlyInitializing {
        __ERC20_init(_name, _symbol);
        _setAsset(asset_);
    }

    function totalActiveDepositsOf(address recipient) external view returns (uint256) {
        return _activeDepositIds[recipient].length();
    }

    function totalDepositsOf(address recipient) external view returns (uint256) {
        return _recipientDepositsIds[recipient].length;
    }

    function totalDeposits() external view returns (uint256) {
        return _currentDepositId;
    }

    function getActiveDepositIds(address recipient) external view returns (uint256[] memory) {
        return _activeDepositIds[recipient].values();
    }

    function getAllDepositIds(address recipient) external view returns (uint256[] memory) {
        return _recipientDepositsIds[recipient];
    }

    /**
     * @notice Get an array of deposits history of a recipient starting from `startId` and up to `length`
     * @dev If `startId` is greater than the total number of deposits of the recipient, the function will revert.
     */
    function getDepositIds(
        address recipient,
        uint256 startId,
        uint256 length
    ) external view returns (uint256[] memory ret) {
        uint256 endId = _recipientDepositsIds[recipient].length.min(startId + length);
        if (startId >= endId) {
            revert InvalidDepositIdRange();
        }
        ret = new uint256[](endId - startId);
        for (uint256 i = 0; i < ret.length; i++) {
            ret[i] = _recipientDepositsIds[recipient][startId + i];
        }
    }

    function getDeposit(uint256 depositId) public view returns (DepositInfo memory) {
        if (depositId >= _currentDepositId) {
            revert InvalidDepositIdRange();
        }
        return _depositsData[depositId];
    }

    function getDeposits(
        uint256[] calldata depositIds
    ) external view returns (DepositInfo[] memory ret) {
        ret = new DepositInfo[](depositIds.length);
        for (uint256 i = 0; i < ret.length; i++) {
            ret[i] = _depositsData[depositIds[i]];
        }
    }

    function isDepositActive(address recipient, uint256 depositId) public view returns (bool) {
        return _activeDepositIds[recipient].contains(depositId);
    }

    function asset() public view virtual returns (address) {
        return address(_asset);
    }

    function totalAsset() public view virtual returns (uint256) {
        return _asset.balanceOf(address(this));
    }

    function _setAsset(address asset_) internal {
        _asset = IERC20MetadataUpgradeable(asset_);
    }

    function _withdraw(
        address from,
        address to,
        uint256 depositId,
        bool skipMaturity
    ) internal virtual returns (DepositInfo memory) {
        DepositInfo storage deposit_ = _depositsData[depositId];
        _validateWithdraw(from, depositId, skipMaturity, deposit_.redeemTimestamp);

        _activeDepositIds[from].remove(depositId);

        _burn(from, deposit_.amount);
        _asset.safeTransfer(to, deposit_.amount);

        emit Withdrawal(
            depositId,
            from,
            to,
            deposit_.amount,
            deposit_.redeemTimestamp <= block.timestamp
        );

        return deposit_;
    }

    /**
     * @notice Withdraw the asset from the vault to the recipient
     * @dev This is the most common use case when a recipient withdraws to himself.
     */
    function _withdraw(uint256 depositId) internal virtual returns (DepositInfo memory) {
        return _withdraw(_msgSender(), _msgSender(), depositId, false);
    }

    /**
     * @dev Allow a premature withdrawal from the vault. This is useful when vault has special conditions that allows
     * a recipient to withdraw before the locking period ends.
     */
    function _prematureWithdraw(
        address from,
        address to,
        uint256 depositId
    ) internal returns (DepositInfo memory) {
        return _withdraw(from, to, depositId, true);
    }

    function _batchWithdraw(
        address from,
        address to,
        uint256[] calldata depositIds
    ) internal returns (uint256) {
        if (depositIds.length == 0) {
            revert ParamDepositIdsIsEmpty();
        }
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < depositIds.length; i++) {
            totalAmount += _withdraw(from, to, depositIds[i], false).amount;
        }
        return totalAmount;
    }

    /**
     * @notice Preview the amount of asset that can be redeemed from the payment IDs
     * @dev Returns the total amount and an array of boolean indicating whether the specified deposit ID is included
     * in the calculation
     */
    function previewWithdraw(
        address recipient,
        uint256[] calldata depositIds
    ) external view virtual returns (uint256 totalAmount, bool[] memory depositIdsIncluded) {
        totalAmount = 0;
        depositIdsIncluded = new bool[](depositIds.length);
        for (uint256 i = 0; i < depositIds.length; i++) {
            DepositInfo memory deposit_ = getDeposit(depositIds[i]);
            if (
                isDepositActive(recipient, depositIds[i]) &&
                deposit_.redeemTimestamp <= block.timestamp
            ) {
                totalAmount += deposit_.amount;
                depositIdsIncluded[i] = true;
            }
        }
    }

    function _deposit(
        address depositor,
        address recipient,
        uint256 amount,
        uint64 lockPeriod
    ) internal virtual returns (uint256, DepositInfo memory) {
        _validateDeposit(depositor, recipient, amount, lockPeriod);
        uint64 redeemTimestamp = uint64(block.timestamp) + lockPeriod;

        uint256 depositId = _currentDepositId++;
        _depositsData[depositId] = DepositInfo({
            depositor: depositor,
            amount: amount,
            redeemTimestamp: redeemTimestamp
        });
        _activeDepositIds[recipient].add(depositId);
        _recipientDepositsIds[recipient].push(depositId);

        _asset.safeTransferFrom(_msgSender(), address(this), amount);
        _mint(recipient, amount);

        emit Deposit(depositId, depositor, recipient, amount, lockPeriod, redeemTimestamp);

        return (depositId, _depositsData[depositId]);
    }

    function _validateWithdraw(
        address from,
        uint256 depositId,
        bool skipMaturity,
        uint64 redeemTimestamp
    ) internal view {
        if (!isDepositActive(from, depositId)) {
            revert InvalidActiveDeposit();
        }
        if (!skipMaturity && redeemTimestamp > block.timestamp) {
            revert DepositNotMatured();
        }
    }

    function _validateDeposit(
        address depositor,
        address recipient,
        uint256 amount,
        uint64 lockPeriod
    ) internal pure {
        if (amount == 0) {
            revert ParamAmountIsZero();
        }
        if (depositor == address(0)) {
            revert ParamDepositorIsZero();
        }
        if (recipient == address(0)) {
            revert ParamRecipientIsZero();
        }
        if (lockPeriod == 0) {
            revert ParamLockPeriodIsZero();
        }
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (!_isValidTokenTransfer(from, to)) {
            revert InvalidTransfer(from, to, amount);
        }
        super._beforeTokenTransfer(from, to, amount);
    }

    function _isValidTokenTransfer(address from, address to) private pure returns (bool) {
        return from == address(0) || to == address(0);
    }
}
