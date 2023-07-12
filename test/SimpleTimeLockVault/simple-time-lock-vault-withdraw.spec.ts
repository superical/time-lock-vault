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

  describe("Withdraw", () => {
    let depositAmount: BigNumber;

    beforeEach(async () => {
      depositAmount = parseUnits("5000", 18);
    });

    describe("When withdrawing a deposit", () => {
      let recipientDepositIds: BigNumber[];

      beforeEach(async () => {
        // Setup initial deposit
        await simpleVaultContract.connect(depositor).deposit(recipient.address, depositAmount);

        // Assert that recipient has an active deposit
        recipientDepositIds = await simpleVaultContract.getActiveDepositIds(recipient.address);
        assert.equal(recipientDepositIds.length, 1);
      });

      describe("When the deposit has not matured", () => {
        it("should revert if recipient attempts to withdraw", async () => {
          const tx = simpleVaultContract.connect(recipient).withdraw(recipientDepositIds[0]);

          await expect(tx).to.be.revertedWithCustomError(simpleVaultContract, "DepositNotMatured");
        });

        it("should revert if recipient attempts to batch withdraw", async () => {
          const tx = simpleVaultContract.connect(recipient).batchWithdraw(recipientDepositIds);

          await expect(tx).to.be.revertedWithCustomError(simpleVaultContract, "DepositNotMatured");
        });
      });

      describe("When the deposit has matured", () => {
        let withdrawTx: ContractTransaction;
        let initialAssetBalance: BigNumber;

        beforeEach(async () => {
          await time.increase(fixtures.simpleVaultParams.lockPeriod);

          // Get initial asset balance
          initialAssetBalance = await fixtures.mockERC20Contract.balanceOf(
            simpleVaultContract.address,
          );

          // Recipient initiates withdrawal
          withdrawTx = await simpleVaultContract
            .connect(recipient)
            .withdraw(recipientDepositIds[0]);
        });

        it("should call withdraw successfully", async () => {
          await expect(withdrawTx).to.not.be.reverted;
        });

        it("should burn vesting token from recipient", async () => {
          const recipientBalance = await simpleVaultContract.balanceOf(recipient.address);

          expect(recipientBalance).to.equal(0);
          await expect(withdrawTx)
            .to.emit(simpleVaultContract, "Transfer")
            .withArgs(recipient.address, constants.AddressZero, depositAmount);
        });

        it("should withdraw asset to recipient", async () => {
          const recipientAssetBalance = await fixtures.mockERC20Contract.balanceOf(
            recipient.address,
          );

          expect(recipientAssetBalance).to.equal(depositAmount);
          await expect(withdrawTx)
            .to.emit(fixtures.mockERC20Contract, "Transfer")
            .withArgs(simpleVaultContract.address, recipient.address, depositAmount);
        });

        it("should reduce the total assets in vault", async () => {
          const assetBalance = await fixtures.mockERC20Contract.balanceOf(
            simpleVaultContract.address,
          );

          expect(assetBalance).to.equal(initialAssetBalance.sub(depositAmount));
        });

        it("should remove deposit ID from recipient's active deposits", async () => {
          const recipientActiveDepositIds = await simpleVaultContract.getActiveDepositIds(
            recipient.address,
          );

          expect(recipientActiveDepositIds).to.not.include(recipientDepositIds[0]);
        });

        it("should not reduce the recipient's total deposits", async () => {
          const recipientTotalDeposits = await simpleVaultContract.totalDepositsOf(
            recipient.address,
          );

          expect(recipientTotalDeposits).to.equal(1);
        });

        it("should revert if withdraw an inactive deposit", async () => {
          // Perform withdraw again on the same deposit
          const tx = simpleVaultContract.connect(recipient).withdraw(recipientDepositIds[0]);

          await expect(tx).to.be.revertedWithCustomError(
            simpleVaultContract,
            "InvalidActiveDeposit",
          );
        });

        describe("When withdrawing someone else's deposit", () => {
          let depositorDepositIds: BigNumber[];

          beforeEach(async () => {
            await fixtures.mockERC20Contract.mint(depositor.address, depositAmount);
            await simpleVaultContract.connect(depositor).deposit(depositor.address, depositAmount);
            depositorDepositIds = await simpleVaultContract.getActiveDepositIds(depositor.address);
          });

          it("should revert if withdraw a deposit that does not belong to caller", async () => {
            const tx = simpleVaultContract.connect(recipient).withdraw(depositorDepositIds[0]);

            await expect(tx).to.be.revertedWithCustomError(
              simpleVaultContract,
              "InvalidActiveDeposit",
            );
          });

          it("should revert if batch withdraw a deposit that does not belong to caller", async () => {
            const tx = simpleVaultContract.connect(recipient).batchWithdraw(depositorDepositIds);

            await expect(tx).to.be.revertedWithCustomError(
              simpleVaultContract,
              "InvalidActiveDeposit",
            );
          });
        });

        it("should emit Withdrawal event", async () => {
          await expect(withdrawTx)
            .to.emit(simpleVaultContract, "Withdrawal")
            .withArgs(
              recipientDepositIds[0],
              recipient.address,
              recipient.address,
              depositAmount,
              true,
            );
        });
      });
    });

    describe("When withdrawing multiple deposits", () => {
      let recipient1: SignerWithAddress;
      let recipient2: SignerWithAddress;

      let recipient1Amount: BigNumber;
      let depositIds1Included: boolean[];
      let recipient2Amount: BigNumber;
      let depositIds2Included: boolean[];

      const oneDayInterval = 3600 * 24;

      beforeEach(async () => {
        recipient1 = fixtures.signers.others[0];
        recipient2 = fixtures.signers.others[1];

        // Make a total of 5 deposits
        // Deposit for recipient 1
        await simpleVaultContract.connect(depositor).deposit(recipient1.address, parseEther("100"));
        // Deposit for recipient 2
        await simpleVaultContract.connect(depositor).deposit(recipient2.address, parseEther("100"));

        // One day later...
        await time.increase(oneDayInterval);

        // Deposit for recipient 1 again
        await simpleVaultContract.connect(depositor).deposit(recipient1.address, parseEther("100"));
        // Deposit for recipient 2 again
        await simpleVaultContract.connect(depositor).deposit(recipient2.address, parseEther("100"));

        // Another day later...
        await time.increase(oneDayInterval);
        // Deposit for recipient 1 again
        await simpleVaultContract.connect(depositor).deposit(recipient1.address, parseEther("100"));
      });

      describe("Withdrawal Preview", () => {
        describe("When all deposit IDs are not matured yet", () => {
          it("should return zero as the amount", async () => {
            const [recipient1Amount] = await simpleVaultContract.previewWithdraw(
              recipient1.address,
              [0, 2, 4],
            );
            const [recipient2Amount] = await simpleVaultContract.previewWithdraw(
              recipient2.address,
              [1, 3],
            );

            expect(recipient1Amount).to.equal(parseEther("0"));
            expect(recipient2Amount).to.equal(parseEther("0"));
          });
        });

        describe("When some of the deposit IDs are matured", () => {
          beforeEach(async () => {
            // Deposit ID 4 for recipient 1 should not be matured yet
            await time.increase(oneDayInterval * 6);

            [recipient1Amount, depositIds1Included] = await simpleVaultContract.previewWithdraw(
              recipient1.address,
              [0, 2, 4],
            );
            [recipient2Amount, depositIds2Included] = await simpleVaultContract.previewWithdraw(
              recipient2.address,
              [1, 3],
            );
          });

          it("should return the total amount of the specified deposit IDs that are matured for withdrawal", async () => {
            expect(recipient1Amount).to.equal(parseEther("200"));
            expect(recipient2Amount).to.equal(parseEther("200"));
          });

          it("should return the included result for the specified deposit IDs that are matured for withdrawal", async () => {
            expect(depositIds1Included).to.deep.equal([true, true, false]);
            expect(depositIds2Included).to.deep.equal([true, true]);
          });
        });

        describe("When some of the deposit IDs are inactive deposits", () => {
          beforeEach(async () => {
            await time.increase(oneDayInterval * 6);
            await simpleVaultContract.connect(recipient2).withdraw(1);

            [recipient2Amount, depositIds2Included] = await simpleVaultContract.previewWithdraw(
              recipient2.address,
              [1, 3],
            );
          });

          it("should return only the total amount of the deposit IDs that are active", async () => {
            expect(recipient2Amount).to.equal(parseEther("100"));
          });

          it("should return the included result for the specified deposit IDs that are active", async () => {
            expect(depositIds2Included).to.deep.equal([false, true]);
          });
        });

        describe("When all the deposit IDs are matured", () => {
          beforeEach(async () => {
            // 7 days later... All payments matured.
            await time.increase(oneDayInterval * 7);

            [recipient1Amount, depositIds1Included] = await simpleVaultContract.previewWithdraw(
              recipient1.address,
              [0, 2, 4],
            );
            [recipient2Amount, depositIds2Included] = await simpleVaultContract.previewWithdraw(
              recipient2.address,
              [1, 3],
            );
          });

          it("should return the total amount of the specified deposit IDs", async () => {
            expect(recipient1Amount).to.equal(parseEther("300"));
            expect(recipient2Amount).to.equal(parseEther("200"));
          });

          it("should return the included result for the specified deposit IDs of all matured deposits", async () => {
            expect(depositIds1Included).to.deep.equal([true, true, true]);
            expect(depositIds2Included).to.deep.equal([true, true]);
          });
        });

        it("should revert if withdraws a premature deposit", async () => {
          const tx = simpleVaultContract.connect(recipient1).withdraw(0);

          await expect(tx).to.be.revertedWithCustomError(simpleVaultContract, "DepositNotMatured");
        });

        it("should revert if batch withdraw includes a premature deposit", async () => {
          // 6 days later, Deposit ID 4 for recipient1 should not be matured yet
          await time.increase(oneDayInterval * 6);

          const tx = simpleVaultContract.connect(recipient1).batchWithdraw([0, 2, 4]);

          await expect(tx).to.be.revertedWithCustomError(simpleVaultContract, "DepositNotMatured");
        });

        describe("When batch withdraw is successful", () => {
          let batchWithdrawTx: ContractTransaction;

          beforeEach(async () => {
            // 7 days later... All payments belonging to recipient1 are matured.
            await time.increase(oneDayInterval * 7);

            batchWithdrawTx = await simpleVaultContract
              .connect(recipient1)
              .batchWithdraw([0, 2, 4]);
          });

          it("should batch withdraw successfully", async () => {
            const recipient1Balance = await fixtures.mockERC20Contract.balanceOf(
              recipient1.address,
            );

            expect(await recipient1Balance).to.equal(parseEther("300"));
          });

          it("should emit Withdrawal event 3 times", async () => {
            await expect(batchWithdrawTx)
              .to.emit(simpleVaultContract, "Withdrawal")
              .withArgs(0, recipient1.address, recipient1.address, parseEther("100"), true);
            await expect(batchWithdrawTx)
              .to.emit(simpleVaultContract, "Withdrawal")
              .withArgs(2, recipient1.address, recipient1.address, parseEther("100"), true);
            await expect(batchWithdrawTx)
              .to.emit(simpleVaultContract, "Withdrawal")
              .withArgs(4, recipient1.address, recipient1.address, parseEther("100"), true);
          });
        });
      });
    });

    describe("When withdraw is called with incorrect parameters", () => {
      it("should revert if no deposit IDs were specified to batchWithdraw", async () => {
        const tx = simpleVaultContract.connect(depositor).batchWithdraw([]);

        await expect(tx).to.be.revertedWithCustomError(
          simpleVaultContract,
          "ParamDepositIdsIsEmpty",
        );
      });
    });
  });
});
