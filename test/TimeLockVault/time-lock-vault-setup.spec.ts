import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";

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
    it("should return the correct asset contract address", async () => {
      const asset = await mockVaultContract.asset();

      expect(asset).to.equal(fixtures.mockERC20Contract.address);
    });
  });
});
