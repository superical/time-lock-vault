import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { constants } from "ethers";

import { MockTimeLockVault } from "../../types";
import { deployMockTimeLockVaultFixture } from "./time-lock-vault.fixture";

describe("Time-Lock Vault", () => {
  let fixtures: Awaited<ReturnType<typeof deployMockTimeLockVaultFixture>>;

  let mockVaultContract: MockTimeLockVault;

  beforeEach(async () => {
    fixtures = await loadFixture(deployMockTimeLockVaultFixture);
    mockVaultContract = fixtures.mockVaultContract;
  });

  describe("Setup", () => {
    describe("When asset is specified", () => {
      it("should return the correct asset contract address", async () => {
        const asset = await mockVaultContract.asset();

        expect(asset).to.equal(fixtures.mockERC20Contract.address);
      });

      it("should have the same decimals as asset contract", async () => {
        const decimals = await mockVaultContract.decimals();
        const assetDecimals = await fixtures.mockERC20Contract.decimals();

        expect(decimals).to.equal(assetDecimals);
      });
    });

    describe("When asset is zero address", () => {
      beforeEach(async () => {
        await mockVaultContract
          .connect(fixtures.signers.deployer)
          .setAssetInternal(constants.AddressZero);

        // Assert that asset is zero address
        const asset = await mockVaultContract.asset();
        expect(asset).to.equal(constants.AddressZero);
      });

      it("should revert when returning decimals", async () => {
        const tx = mockVaultContract.decimals();

        await expect(tx).to.be.revertedWithCustomError(mockVaultContract, "AssetUndefined");
      });
    });
  });
});
