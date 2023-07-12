// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.13;

import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/IERC20MetadataUpgradeable.sol";
import { DepositInfo } from "../lib/TimeLockVaultStructs.sol";

interface ITimeLockVault is IERC20MetadataUpgradeable {
    event Deposit(
        uint256 indexed depositId,
        address indexed depositor,
        address indexed recipient,
        uint256 amount,
        uint64 lockPeriod,
        uint64 redeemTimestamp
    );

    event Withdrawal(
        uint256 indexed depositId,
        address indexed from,
        address indexed to,
        uint256 amount,
        bool matured
    );

    function previewWithdraw(
        address recipient,
        uint256[] calldata depositIds
    ) external view returns (uint256 totalAmount, bool[] memory depositIdsIncluded);

    function totalActiveDepositsOf(address recipient) external view returns (uint256);

    function totalDepositsOf(address recipient) external view returns (uint256);

    function totalDeposits() external view returns (uint256);

    function totalAsset() external view returns (uint256);

    function asset() external view returns (address);

    function getActiveDepositIds(address recipient) external view returns (uint256[] memory);

    function getAllDepositIds(address recipient) external view returns (uint256[] memory);

    function getDepositIds(
        address recipient,
        uint256 startId,
        uint256 length
    ) external view returns (uint256[] memory);

    function getDeposit(uint256 depositId) external view returns (DepositInfo memory);

    function getDeposits(
        uint256[] calldata depositIds
    ) external view returns (DepositInfo[] memory);

    function isDepositActive(address recipient, uint256 depositId) external view returns (bool);
}
