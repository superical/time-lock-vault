import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { assert, expect } from "chai";
import { BigNumber } from "ethers";
import { parseEther } from "ethers/lib/utils";

import { MockTimeLockVault } from "../../types";
import { deployMockTimeLockVaultFixture } from "./time-lock-vault.fixture";

describe("Time-Lock Vault", () => {
  let fixtures: Awaited<ReturnType<typeof deployMockTimeLockVaultFixture>>;

  let mockVaultContract: MockTimeLockVault;

  let depositor: SignerWithAddress;
  let recipient: SignerWithAddress;

  beforeEach(async () => {
    fixtures = await loadFixture(deployMockTimeLockVaultFixture);
    mockVaultContract = fixtures.mockVaultContract;

    depositor = fixtures.signers.depositor;
    recipient = fixtures.signers.recipient;
  });

  describe("Transfers", () => {
    let depositAmount: BigNumber;

    beforeEach(async () => {
      depositAmount = parseEther("5000");

      // Setup initial deposit
      await mockVaultContract.connect(depositor).deposit(recipient.address, depositAmount);

      // Assert recipient has vesting tokens
      const recipientVestingTokenBalance = await mockVaultContract.balanceOf(recipient.address);
      assert.equal(recipientVestingTokenBalance.toString(), depositAmount.toString());
    });

    it("should revert when recipient attempts to transfer vesting token", async () => {
      const anotherRecipient = fixtures.signers.others[0];
      const tx = mockVaultContract
        .connect(recipient)
        .transfer(anotherRecipient.address, depositAmount);

      await expect(tx)
        .to.be.revertedWithCustomError(mockVaultContract, "InvalidTransfer")
        .withArgs(recipient.address, anotherRecipient.address, depositAmount);
    });
  });
});
