import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { assert, expect } from "chai";
import { BigNumber, ContractTransaction, constants } from "ethers";
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

  describe("Premature Withdrawals", () => {
    let depositAmount: BigNumber;
    let recipientDepositIds: BigNumber[];

    beforeEach(async () => {
      depositAmount = parseEther("5000");

      // Setup initial deposit
      await mockVaultContract.connect(depositor).deposit(recipient.address, depositAmount);

      // Assert that recipient has an active deposit
      recipientDepositIds = await mockVaultContract.getActiveDepositIds(recipient.address);
      assert.equal(recipientDepositIds.length, 1);
    });

    describe("When deposit has matured", () => {
      let withdrawTx: ContractTransaction;
      let initialAssetBalance: BigNumber;
      let targetRecipient: SignerWithAddress;

      beforeEach(async () => {
        targetRecipient = fixtures.signers.others[0];

        await time.increase(fixtures.mockVaultParams.lockPeriod);

        // Get initial asset balance
        initialAssetBalance = await fixtures.mockERC20Contract.balanceOf(mockVaultContract.address);

        // Recipient initiates premature withdrawal
        withdrawTx = await mockVaultContract
          .connect(recipient)
          .prematureWithdrawInternal(
            recipient.address,
            targetRecipient.address,
            recipientDepositIds[0],
          );
      });

      it("should burn besting token from recipient", async () => {
        const recipientBalance = await mockVaultContract.balanceOf(recipient.address);

        expect(recipientBalance).to.equal(0);
        await expect(withdrawTx)
          .to.emit(mockVaultContract, "Transfer")
          .withArgs(recipient.address, constants.AddressZero, depositAmount);
      });

      it("should withdraw asset to target recipient", async () => {
        const targetRecipientAssetBalance = await fixtures.mockERC20Contract.balanceOf(
          targetRecipient.address,
        );

        expect(targetRecipientAssetBalance).to.equal(depositAmount);
        await expect(withdrawTx)
          .to.emit(fixtures.mockERC20Contract, "Transfer")
          .withArgs(mockVaultContract.address, targetRecipient.address, depositAmount);
      });

      it("should reduce the total assets in vault", async () => {
        const assetBalance = await fixtures.mockERC20Contract.balanceOf(mockVaultContract.address);

        expect(assetBalance).to.equal(initialAssetBalance.sub(depositAmount));
      });

      it("should remove deposit ID from recipients active deposits", async () => {
        const recipientActiveDepositIds = await mockVaultContract.getActiveDepositIds(
          recipient.address,
        );

        expect(recipientActiveDepositIds).to.not.include(recipientDepositIds[0]);
      });

      it("should emit Withdrawal event with matured flag true", async () => {
        await expect(withdrawTx)
          .to.emit(mockVaultContract, "Withdrawal")
          .withArgs(
            recipientDepositIds[0],
            recipient.address,
            targetRecipient.address,
            depositAmount,
            true,
          );
      });
    });

    describe("When deposit has not matured", () => {
      let withdrawTx: ContractTransaction;
      let initialAssetBalance: BigNumber;
      let targetRecipient: SignerWithAddress;

      beforeEach(async () => {
        targetRecipient = fixtures.signers.others[0];

        // Get initial asset balance
        initialAssetBalance = await fixtures.mockERC20Contract.balanceOf(mockVaultContract.address);

        // Recipient initiates premature withdrawal
        withdrawTx = await mockVaultContract
          .connect(recipient)
          .prematureWithdrawInternal(
            recipient.address,
            targetRecipient.address,
            recipientDepositIds[0],
          );
      });

      it("should burn besting token from recipient", async () => {
        const recipientBalance = await mockVaultContract.balanceOf(recipient.address);

        expect(recipientBalance).to.equal(0);
        await expect(withdrawTx)
          .to.emit(mockVaultContract, "Transfer")
          .withArgs(recipient.address, constants.AddressZero, depositAmount);
      });

      it("should withdraw asset to target recipient", async () => {
        const targetRecipientAssetBalance = await fixtures.mockERC20Contract.balanceOf(
          targetRecipient.address,
        );

        expect(targetRecipientAssetBalance).to.equal(depositAmount);
        await expect(withdrawTx)
          .to.emit(fixtures.mockERC20Contract, "Transfer")
          .withArgs(mockVaultContract.address, targetRecipient.address, depositAmount);
      });

      it("should reduce the total assets in vault", async () => {
        const assetBalance = await fixtures.mockERC20Contract.balanceOf(mockVaultContract.address);

        expect(assetBalance).to.equal(initialAssetBalance.sub(depositAmount));
      });

      it("should remove deposit ID from recipients active deposits", async () => {
        const recipientActiveDepositIds = await mockVaultContract.getActiveDepositIds(
          recipient.address,
        );

        expect(recipientActiveDepositIds).to.not.include(recipientDepositIds[0]);
      });

      it("should emit Withdrawal event with matured flag false", async () => {
        await expect(withdrawTx)
          .to.emit(mockVaultContract, "Withdrawal")
          .withArgs(
            recipientDepositIds[0],
            recipient.address,
            targetRecipient.address,
            depositAmount,
            false,
          );
      });
    });
  });
});
