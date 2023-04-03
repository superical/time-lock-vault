import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { assert, expect } from "chai";
import { BigNumber, ContractTransaction, constants } from "ethers";
import { parseEther, parseUnits } from "ethers/lib/utils";

import { SimpleTimeLockVault } from "../../types";
import { deploySimpleTimeLockVaultFixture } from "./simple-time-lock-vault.fixture";

describe("Simple Time-Lock Vault", () => {
  let fixtures: Awaited<ReturnType<typeof deploySimpleTimeLockVaultFixture>>;

  let simpleVaultContract: SimpleTimeLockVault;

  let depositor: SignerWithAddress;
  let recipient: SignerWithAddress;

  let initialBlockTime: number;

  beforeEach(async () => {
    fixtures = await loadFixture(deploySimpleTimeLockVaultFixture);
    simpleVaultContract = fixtures.simpleVaultContract;

    depositor = fixtures.signers.depositor;
    recipient = fixtures.signers.recipient;

    // Set initial next block time
    initialBlockTime = (await time.latest()) + 1;
    await time.setNextBlockTimestamp(initialBlockTime);
  });

  describe("Deposits", () => {
    let depositAmount: BigNumber;

    beforeEach(async () => {
      depositAmount = parseUnits("5000", 18);
    });

    describe("When making a deposit", () => {
      describe("When deposit with correct parameters", () => {
        let depositTx: ContractTransaction;

        beforeEach(async () => {
          // Assert recipient's initial balance is zero
          const initialRecipientBalance = await simpleVaultContract.balanceOf(recipient.address);
          assert.equal(initialRecipientBalance.toString(), constants.Zero.toString());

          // Assert depositors initial asset balance is 5000
          const initialDepositorAssetBalance = await fixtures.mockERC20Contract.balanceOf(
            depositor.address,
          );
          assert.equal(initialDepositorAssetBalance.toString(), depositAmount.toString());

          // Make deposit
          depositTx = await simpleVaultContract
            .connect(depositor)
            .deposit(recipient.address, depositAmount);
        });

        it("should return the correct total asset balance", async () => {
          const assetBalance = await fixtures.mockERC20Contract.balanceOf(
            simpleVaultContract.address,
          );
          const totalAsset = await simpleVaultContract.totalAsset();

          expect(assetBalance).to.equal(totalAsset);
        });

        it("should transfer asset from depositor to vault", async () => {
          const depositorAssetBalance = await fixtures.mockERC20Contract.balanceOf(
            depositor.address,
          );

          expect(depositorAssetBalance).to.equal(0);
          await expect(depositTx)
            .to.emit(fixtures.mockERC20Contract, "Transfer")
            .withArgs(depositor.address, simpleVaultContract.address, depositAmount);
        });

        it("should mint vesting token to recipient", async () => {
          const recipientBalance = await simpleVaultContract.balanceOf(recipient.address);

          expect(recipientBalance).to.equal(depositAmount);
          await expect(depositTx)
            .to.emit(simpleVaultContract, "Transfer")
            .withArgs(constants.AddressZero, recipient.address, depositAmount);
        });

        it("should add deposits as active deposits", async () => {
          const activeDeposits = await simpleVaultContract.getActiveDepositIds(recipient.address);

          expect(activeDeposits.length).to.equal(1);
        });

        it("should emit Deposit event with the correct parameters", async () => {
          const { lockPeriod } = fixtures.simpleVaultParams;
          const redeemTimestamp = initialBlockTime + lockPeriod;

          await expect(depositTx)
            .to.emit(simpleVaultContract, "Deposit")
            .withArgs(
              0,
              depositor.address,
              recipient.address,
              depositAmount,
              lockPeriod,
              redeemTimestamp,
            );
        });
      });

      describe("When depositing with incorrect parameters", () => {
        it("should revert if amount is zero", async () => {
          const tx = simpleVaultContract.connect(depositor).deposit(recipient.address, 0);

          await expect(tx).to.be.revertedWithCustomError(simpleVaultContract, "ParamAmountIsZero");
        });

        it("should revert if recipient address is zero", async () => {
          const tx = simpleVaultContract
            .connect(depositor)
            .deposit(constants.AddressZero, depositAmount);

          await expect(tx).to.be.revertedWithCustomError(
            simpleVaultContract,
            "ParamRecipientIsZero",
          );
        });
      });
    });

    describe("When making multiple deposits", () => {
      let recipient1: SignerWithAddress;
      let recipient2: SignerWithAddress;
      let depositTimestamp: number;

      beforeEach(async () => {
        recipient1 = fixtures.signers.others[0];
        recipient2 = fixtures.signers.others[1];

        // Assert all initial recipient deposits states
        const initialRecipient1Deposits = await simpleVaultContract.getAllDepositIds(
          recipient1.address,
        );
        const initialRecipient2Deposits = await simpleVaultContract.getAllDepositIds(
          recipient2.address,
        );
        assert.equal(initialRecipient1Deposits.length, 0);
        assert.equal(initialRecipient2Deposits.length, 0);

        // Deposit timestamp
        depositTimestamp = (await time.latest()) + 1;

        // Make a total of 5 deposits
        // Deposit for recipient1
        await simpleVaultContract.connect(depositor).deposit(recipient1.address, parseEther("100"));
        // Deposit for recipient2
        await simpleVaultContract.connect(depositor).deposit(recipient2.address, parseEther("200"));
        // Deposit for recipient1 again
        await simpleVaultContract.connect(depositor).deposit(recipient1.address, parseEther("300"));
        // Deposit for depositor himself
        await simpleVaultContract.connect(depositor).deposit(depositor.address, parseEther("400"));
        // Deposit for recipient1 again
        await simpleVaultContract.connect(depositor).deposit(recipient1.address, parseEther("500"));
      });

      it("should return the number of recipient's total active deposits", async () => {
        const recipient1TotalActiveDeposits = await simpleVaultContract.totalActiveDepositsOf(
          recipient1.address,
        );
        const recipient2TotalActiveDeposits = await simpleVaultContract.totalActiveDepositsOf(
          recipient2.address,
        );
        const depositorTotalActiveDeposits = await simpleVaultContract.totalActiveDepositsOf(
          depositor.address,
        );

        expect(recipient1TotalActiveDeposits).to.equal(3);
        expect(recipient2TotalActiveDeposits).to.equal(1);
        expect(depositorTotalActiveDeposits).to.equal(1);
      });

      it("should return the number of recipient's total deposits", async () => {
        const recipient1TotalActiveDeposits = await simpleVaultContract.totalDepositsOf(
          recipient1.address,
        );
        const recipient2TotalActiveDeposits = await simpleVaultContract.totalDepositsOf(
          recipient2.address,
        );
        const depositorTotalActiveDeposits = await simpleVaultContract.totalDepositsOf(
          depositor.address,
        );

        expect(recipient1TotalActiveDeposits).to.equal(3);
        expect(recipient2TotalActiveDeposits).to.equal(1);
        expect(depositorTotalActiveDeposits).to.equal(1);
      });

      it("should return total number of all deposits made", async () => {
        const totalDeposits = await simpleVaultContract.totalDeposits();

        expect(totalDeposits).to.equal(5);
      });

      it("should return the correct active deposit IDs of recipients", async () => {
        const recipient1ActiveDepositIds = await simpleVaultContract.getActiveDepositIds(
          recipient1.address,
        );
        const recipient2ActiveDepositIds = await simpleVaultContract.getActiveDepositIds(
          recipient2.address,
        );
        const depositorActiveDepositIds = await simpleVaultContract.getActiveDepositIds(
          depositor.address,
        );

        expect(recipient1ActiveDepositIds).to.deep.equal([0, 2, 4]);
        expect(recipient2ActiveDepositIds).to.deep.equal([1]);
        expect(depositorActiveDepositIds).to.deep.equal([3]);
      });

      it("should return all the recipient's deposit ID", async () => {
        const recipient1DepositIds = await simpleVaultContract.getAllDepositIds(recipient1.address);
        const recipient2DepositIds = await simpleVaultContract.getAllDepositIds(recipient2.address);
        const depositorDepositIds = await simpleVaultContract.getAllDepositIds(depositor.address);

        expect(recipient1DepositIds).to.deep.equal([0, 2, 4]);
        expect(recipient2DepositIds).to.deep.equal([1]);
        expect(depositorDepositIds).to.deep.equal([3]);
      });

      describe("When paginating the deposits", () => {
        it("should take the minimum of deposits total and specified length", async () => {
          const recipient1Deposits = await simpleVaultContract.getDepositIds(
            recipient1.address,
            0,
            5,
          );

          expect(recipient1Deposits).to.deep.equal([0, 2, 4]);
        });

        it("should offset the startId and length correctly", async () => {
          const recipient1Deposits = await simpleVaultContract.getDepositIds(
            recipient1.address,
            1,
            1,
          );

          expect(recipient1Deposits).to.deep.equal([2]);
        });

        it("should offset the startId and take the minimum of deposits total and specified length correctly", async () => {
          const recipient1Deposits = await simpleVaultContract.getDepositIds(
            recipient1.address,
            1,
            5,
          );

          expect(recipient1Deposits).to.deep.equal([2, 4]);
        });

        it("should revert with InvalidDepositIdRange if startId is greater than total deposits", async () => {
          const recipient1Deposits = simpleVaultContract.getDepositIds(recipient1.address, 5, 5);

          await expect(recipient1Deposits).to.be.revertedWithCustomError(
            simpleVaultContract,
            "InvalidDepositIdRange",
          );
        });

        it("should revert if length is zero", async () => {
          const recipient1Deposits = simpleVaultContract.getDepositIds(recipient1.address, 1, 0);

          await expect(recipient1Deposits).to.be.revertedWithCustomError(
            simpleVaultContract,
            "InvalidDepositIdRange",
          );
        });
      });

      describe("When getting the deposit details", () => {
        it("should return the specified deposit", async () => {
          const deposit = await simpleVaultContract.getDeposit(0);

          expect(deposit.depositor).to.equal(depositor.address);
          expect(deposit.amount).to.equal(parseEther("100"));
          expect(deposit.redeemTimestamp).to.equal(
            depositTimestamp + fixtures.simpleVaultParams.lockPeriod,
          );
        });

        it("should return all the specified deposits", async () => {
          const recipient1Deposits = await simpleVaultContract.getAllDepositIds(recipient1.address);
          const deposits = await simpleVaultContract.getDeposits(recipient1Deposits);

          expect(deposits.length).to.equal(3);
          expect(deposits[0].amount).to.equal(parseEther("100"));
          expect(deposits[1].amount).to.equal(parseEther("300"));
          expect(deposits[2].amount).to.equal(parseEther("500"));
        });
      });
    });
  });
});
