// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.13;

import "../SimpleTimeLockVault.sol";

contract MockTimeLockVault is SimpleTimeLockVault {
    constructor(
        string memory _name,
        string memory _symbol,
        address _asset,
        uint64 _lockPeriod
    ) SimpleTimeLockVault(_name, _symbol, _asset, _lockPeriod) {}

    function prematureWithdrawInternal(
        address from,
        address to,
        uint256 depositId
    ) public returns (DepositInfo memory) {
        return _prematureWithdraw(from, to, depositId);
    }
}
