import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { MockERC20__factory, MockTimeLockVault__factory } from "../../types";

export async function deployMockTimeLockVaultFixture() {
  const [deployer, depositor, recipient, ...signers] = await ethers.getSigners();

  // Deploy mock ERC20
  const mockERC20Factory = (await ethers.getContractFactory("MockERC20")) as MockERC20__factory;
  const mockERC20Contract = await mockERC20Factory.connect(deployer).deploy();

  // Default vault parameters
  const mockVaultParams = {
    name: "Mock Time-Lock Vault",
    symbol: "VAULT",
    asset: mockERC20Contract.address,
    lockPeriod: 3600 * 24 * 7, // 1 Week
  };

  // Deploy Simple Time-Lock Vault
  const mockVaultFactory = (await ethers.getContractFactory(
    "MockTimeLockVault",
  )) as MockTimeLockVault__factory;
  const mockVaultContract = await mockVaultFactory
    .connect(deployer)
    .deploy(
      mockVaultParams.name,
      mockVaultParams.symbol,
      mockVaultParams.asset,
      mockVaultParams.lockPeriod,
    );

  // Mint mock ERC20 tokens to depositor
  const depositorMockERC20Amount = parseEther("5000");
  await mockERC20Contract.connect(deployer).mint(depositor.address, depositorMockERC20Amount);
  await mockERC20Contract
    .connect(depositor)
    .approve(mockVaultContract.address, constants.MaxUint256);

  return {
    mockVaultContract,
    mockVaultParams,

    mockERC20Contract,

    signers: {
      deployer,
      depositor,
      recipient,
      others: signers,
    },
  };
}
