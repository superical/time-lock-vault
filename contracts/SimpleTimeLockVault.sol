// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.13;

import "./TimeLockVault.sol";

/**
 * @notice This is a ready-to-use implementation of a simple time-lock vault.
 * @dev If you plan to custom the vault behaviours, consider inheriting from the `TimeLockVault` contract instead.
 */
contract SimpleTimeLockVault is TimeLockVault {
    uint64 public immutable lockPeriod;

    constructor(
        string memory _name,
        string memory _symbol,
        address _asset,
        uint64 _lockPeriod
    ) initializer {
        __TimeLockVault_init(_name, _symbol, _asset);
        lockPeriod = _lockPeriod;
    }

    function deposit(
        address recipient,
        uint256 amount
    ) public virtual returns (uint256, DepositInfo memory) {
        return _deposit(_msgSender(), recipient, amount, lockPeriod);
    }

    function withdraw(uint256 depositId) public virtual returns (DepositInfo memory) {
        return _withdraw(depositId);
    }

    function batchWithdraw(uint256[] calldata depositIds) public returns (uint256) {
        return _batchWithdraw(_msgSender(), _msgSender(), depositIds);
    }
}
