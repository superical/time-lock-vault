# Time-Lock Vault Contracts

[![Release][gha-badge]][gha-ci] [![solidity][solidity-badge]][solidity]
[![Hardhat][hardhat-badge]][hardhat] [![License: GNU AGPLv3][license-badge]][license]

[hardhat]: https://hardhat.org/
[hardhat-badge]: https://img.shields.io/badge/Built%20with-Hardhat-FFDB1C.svg
[license]: https://opensource.org/license/agpl-v3/
[license-badge]: https://img.shields.io/badge/License-AGPL_v3-blue.svg
[solidity]: https://github.com/superical/time-lock-vault
[solidity-badge]: https://img.shields.io/badge/solidity-v0.8.13-2ea44f?logo=solidity
[gha-ci]: https://github.com/superical/time-lock-vault/actions/workflows/release.yml
[gha-badge]: https://github.com/superical/time-lock-vault/actions/workflows/release.yml/badge.svg

<div align="center">
<img src="docs/images/header.png" alt="Time-Lock Vault Solidity Contracts" />
</div>

A simple and easy to use time-lock vault for ERC20 tokens, designed to support multiple deposits and
withdrawals by various users. Each deposit can have a predefined/fixed locking period or a different
locking period from the other deposits. Recipients will receive their share of vesting tokens that
represent the amount of their deposited asset.

## Simple Time-Lock Vault

The `SimpleTimeLockVault` contract is a ready-to-use vault contract, providing the standard
time-lock vault functionality such as `deposit`, `withdraw` and `batchWithdraw`.

## Custom Vaults

Alternatively, you can create your own Solidity vault contract by extending the `TimeLockVault`
abstract contract and implementing your desired logic.

### Installation

```bash
npm install @superical/time-lock-vault --save-dev
```

### Usage

Note that the `TimeLockVault` is an upgradeable contract. If you don't plan on upgrading your vault
contract, you should initialise it in your constructor.

```solidity
import "@superical/time-lock-vault/contracts/TimeLockVault.sol";

contract MyCustomVault is TimeLockVault {
  constructor(string memory _name, string memory _symbol, address _asset) initializer {
    // Initialize the TimeLockVault contract
    __TimeLockVault_init(_name, _symbol, _asset);
  }

  // Implement custom deposit logic
  function deposit(uint256 amount) external {
    // Custom deposit condition here...
    // Deposit from the sender to himself and to be locked for 1 day
    _deposit(_msgSender(), _msgSender(), amount, 86400);
  }

  // Implement custom withdraw logic
  function withdraw(uint256 depositId) external {
    // Custom withdrawal condition here...
    // Withdraw deposit ID to sender
    _withdraw(depositId);
  }
}
```

Your contract will inherit additional functionalities such as premature withdrawal (refer to the
`_prematureWithdraw` function) before the maturity date subject your specific condition, control
over the depositor/recipient addresses, and other aspects.
