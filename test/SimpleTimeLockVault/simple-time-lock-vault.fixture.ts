import { constants } from "ethers";
import { parseEther } from "ethers/lib/utils";
import { ethers } from "hardhat";

import { MockERC20__factory, SimpleTimeLockVault__factory } from "../../types";

export async function deploySimpleTimeLockVaultFixture() {
  const [deployer, depositor, recipient, ...signers] = await ethers.getSigners();

  // Deploy mock ERC20
  const mockERC20Factory = (await ethers.getContractFactory("MockERC20")) as MockERC20__factory;
  const mockERC20Contract = await mockERC20Factory.connect(deployer).deploy();

  // Default vault parameters
  const simpleVaultParams = {
    name: "Simple Time-Lock Vault",
    symbol: "SIMPLE",
    asset: mockERC20Contract.address,
    lockPeriod: 3600 * 24 * 7, // 1 Week
  };

  // Deploy Simple Time-Lock Vault
  const simpleVaultFactory = (await ethers.getContractFactory(
    "SimpleTimeLockVault",
  )) as SimpleTimeLockVault__factory;
  const simpleVaultContract = await simpleVaultFactory
    .connect(deployer)
    .deploy(
      simpleVaultParams.name,
      simpleVaultParams.symbol,
      simpleVaultParams.asset,
      simpleVaultParams.lockPeriod,
    );

  // Mint mock ERC20 tokens to depositor
  const depositorMockERC20Amount = parseEther("5000");
  await mockERC20Contract.connect(deployer).mint(depositor.address, depositorMockERC20Amount);
  await mockERC20Contract
    .connect(depositor)
    .approve(simpleVaultContract.address, constants.MaxUint256);

  return {
    simpleVaultContract,
    simpleVaultParams,

    mockERC20Contract,

    signers: {
      deployer,
      depositor,
      recipient,
      others: signers,
    },
  };
}
