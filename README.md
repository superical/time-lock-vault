# Time-Lock Vault Contracts [![Hardhat][hardhat-badge]][hardhat] [![License: GNU AGPLv3][license-badge]][license]

[gitpod]: https://gitpod.io/#https://github.com/paulrberg/hardhat-template
[gitpod-badge]: https://img.shields.io/badge/Gitpod-Open%20in%20Gitpod-FFB45B?logo=gitpod
[gha]: https://github.com/paulrberg/hardhat-template/actions
[gha-badge]: https://github.com/paulrberg/hardhat-template/actions/workflows/ci.yml/badge.svg
[hardhat]: https://hardhat.org/
[hardhat-badge]: https://img.shields.io/badge/Built%20with-Hardhat-FFDB1C.svg
[license]: https://opensource.org/license/agpl-v3/
[license-badge]: https://img.shields.io/badge/License-AGPL_v3-blue.svg

A simple and easy to use time-lock vault for ERC20 tokens, designed to support multiple deposits and
withdrawals by various users. Each deposit can have a predefined/fixed locking period or a different
locking period from the other deposits. Recipients will receive their share of vesting tokens that
represent the amount of their deposited asset.

## Simple Time-Lock Vault

The `SimpleTimeLockVault` contract is a ready-to-use vault contract, providing the standard
time-lock vault functionality such as `deposit`, `withdraw` and `batchWithdraw`.

## Custom Vaults

Alternatively, you can create your own Solidity vault contract by extending the `TimeLockVault`
abstract contract and implementing your desired logic. Your contract can inherit additional
functionalities such as premature withdrawal (refer to the `_prematureWithdraw` function) before the
maturity date subject your specific condition, control over the depositor/recipient addresses, and
other aspects.
