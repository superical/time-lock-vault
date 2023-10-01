// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.13;

interface TimeLockVaultErrors {
    error InvalidDepositIdRange();

    error InvalidActiveDeposit();

    error AssetUndefined();

    error DepositNotMatured();

    error DepositAlreadyMatured();

    error ParamDepositIdsIsEmpty();

    error ParamAmountIsZero();

    error ParamDepositorIsZero();

    error ParamRecipientIsZero();

    error ParamLockPeriodIsZero();

    error InvalidTransfer(address from, address to, uint256 amount);
}
