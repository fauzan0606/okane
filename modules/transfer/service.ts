import { Prisma, TransactionType, TransferOrigin, WalletType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function affectsCurrentBalance(transactionDate: Date, createdAt: Date, balanceAsOf: Date | null) {
  if (!balanceAsOf) return true;
  const transactionDay = Date.UTC(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth(), transactionDate.getUTCDate());
  const snapshotDay = Date.UTC(balanceAsOf.getUTCFullYear(), balanceAsOf.getUTCMonth(), balanceAsOf.getUTCDate());
  if (transactionDay > snapshotDay) return true;
  if (transactionDay < snapshotDay) return false;
  return createdAt > balanceAsOf;
}

async function getWalletPair(tx: Prisma.TransactionClient, fromWalletId: string, toWalletId: string) {
  const [fromWallet, toWallet] = await Promise.all([
    tx.wallet.findUnique({ where: { id: fromWalletId }, select: { id: true, name: true, walletType: true, currencyId: true, currentBalance: true, balanceAsOf: true } }),
    tx.wallet.findUnique({ where: { id: toWalletId }, select: { id: true, name: true, walletType: true, currencyId: true, currentBalance: true, balanceAsOf: true } }),
  ]);
  if (!fromWallet) throw new Error("Source wallet not found.");
  if (!toWallet) throw new Error("Destination wallet not found.");
  if (fromWallet.walletType === WalletType.CREDIT_CARD || toWallet.walletType === WalletType.CREDIT_CARD) {
    throw new Error("Credit card wallets can only be used through Credit Cards > Payment History.");
  }
  if (fromWallet.id === toWallet.id) throw new Error("Source and destination wallets must be different.");
  if (fromWallet.currencyId !== toWallet.currencyId) throw new Error("Transfer currently requires wallets with the same currency.");
  return { fromWallet, toWallet };
}

function validateAmounts(amount: number, feeAmount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Transfer amount must be greater than zero.");
  if (!Number.isFinite(feeAmount) || feeAmount < 0) throw new Error("Transfer fee cannot be negative.");
}

async function applyTransferBalance(
  tx: Prisma.TransactionClient,
  transfer: { transferDate: Date; createdAt: Date; amount: Prisma.Decimal; fromWalletId: string; toWalletId: string },
  source: { balanceAsOf: Date | null },
  destination: { balanceAsOf: Date | null },
) {
  if (affectsCurrentBalance(transfer.transferDate, transfer.createdAt, source.balanceAsOf)) {
    await tx.wallet.update({ where: { id: transfer.fromWalletId }, data: { currentBalance: { decrement: transfer.amount } } });
  }
  if (affectsCurrentBalance(transfer.transferDate, transfer.createdAt, destination.balanceAsOf)) {
    await tx.wallet.update({ where: { id: transfer.toWalletId }, data: { currentBalance: { increment: transfer.amount } } });
  }
}

async function reverseTransferBalance(
  tx: Prisma.TransactionClient,
  transfer: { transferDate: Date; createdAt: Date; amount: Prisma.Decimal; fromWalletId: string; toWalletId: string },
  source: { balanceAsOf: Date | null },
  destination: { balanceAsOf: Date | null },
) {
  if (affectsCurrentBalance(transfer.transferDate, transfer.createdAt, source.balanceAsOf)) {
    await tx.wallet.update({ where: { id: transfer.fromWalletId }, data: { currentBalance: { increment: transfer.amount } } });
  }
  if (affectsCurrentBalance(transfer.transferDate, transfer.createdAt, destination.balanceAsOf)) {
    await tx.wallet.update({ where: { id: transfer.toWalletId }, data: { currentBalance: { decrement: transfer.amount } } });
  }
}

export async function getTransfers() {
  const transfers = await prisma.transfer.findMany({
    include: {
      fromWallet: { select: { id: true, name: true, walletType: true, currency: { select: { code: true, symbol: true } } } },
      toWallet: { select: { id: true, name: true, walletType: true, currency: { select: { code: true, symbol: true } } } },
      feeTransaction: { select: { id: true } },
    },
    orderBy: [{ transferDate: "desc" }, { createdAt: "desc" }],
  });
  return transfers.map((transfer) => ({
    ...transfer,
    transferDate: transfer.transferDate.toISOString(),
    amount: transfer.amount.toString(),
    feeAmount: transfer.feeAmount.toString(),
    createdAt: transfer.createdAt.toISOString(),
    updatedAt: transfer.updatedAt.toISOString(),
  }));
}

export async function createTransfer(input: { transferDate: Date; fromWalletId: string; toWalletId: string; amount: number; feeAmount?: number }) {
  const feeAmount = input.feeAmount ?? 0;
  validateAmounts(input.amount, feeAmount);

  return prisma.$transaction(async (tx) => {
    const { fromWallet, toWallet } = await getWalletPair(tx, input.fromWalletId, input.toWalletId);
    const amount = new Prisma.Decimal(input.amount);
    const fee = new Prisma.Decimal(feeAmount);
    if (fromWallet.currentBalance.lt(amount.plus(fee))) throw new Error(`Insufficient balance in ${fromWallet.name}.`);

    let feeTransactionId: string | undefined;
    if (!fee.isZero()) {
      const feeTransaction = await tx.transaction.create({
        data: {
          transactionDate: input.transferDate,
          type: TransactionType.EXPENSE,
          amount: fee,
          note: "Transfer Fee",
          wallet: { connect: { id: fromWallet.id } },
        },
      });
      feeTransactionId = feeTransaction.id;
      if (affectsCurrentBalance(input.transferDate, feeTransaction.createdAt, fromWallet.balanceAsOf)) {
        await tx.wallet.update({ where: { id: fromWallet.id }, data: { currentBalance: { decrement: fee } } });
      }
    }

    const transfer = await tx.transfer.create({
      data: {
        transferDate: input.transferDate,
        fromWalletId: input.fromWalletId,
        toWalletId: input.toWalletId,
        amount,
        feeAmount: fee,
        origin: TransferOrigin.MANUAL,
        ...(feeTransactionId ? { feeTransactionId } : {}),
      },
    });

    await applyTransferBalance(tx, transfer, fromWallet, toWallet);
    return transfer;
  });
}

export async function updateTransfer(input: { id: string; transferDate: Date; fromWalletId: string; toWalletId: string; amount: number; feeAmount?: number }) {
  const feeAmount = input.feeAmount ?? 0;
  validateAmounts(input.amount, feeAmount);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.transfer.findUnique({ where: { id: input.id }, include: { feeTransaction: true } });
    if (!existing) throw new Error("Transfer not found.");
    if (existing.origin !== TransferOrigin.MANUAL) throw new Error("Credit card payments must be managed from Credit Cards > Payment History.");

    const oldSource = await tx.wallet.findUnique({ where: { id: existing.fromWalletId }, select: { id: true, name: true, currencyId: true, currentBalance: true, balanceAsOf: true } });
    const oldDestination = await tx.wallet.findUnique({ where: { id: existing.toWalletId }, select: { id: true, name: true, currencyId: true, currentBalance: true, balanceAsOf: true } });
    if (!oldSource || !oldDestination) throw new Error("Transfer wallets not found.");

    await reverseTransferBalance(tx, existing, oldSource, oldDestination);

    if (existing.feeTransaction && affectsCurrentBalance(existing.feeTransaction.transactionDate, existing.feeTransaction.createdAt, oldSource.balanceAsOf)) {
      await tx.wallet.update({ where: { id: existing.feeTransaction.walletId }, data: { currentBalance: { increment: existing.feeTransaction.amount } } });
    }

    const { fromWallet, toWallet } = await getWalletPair(tx, input.fromWalletId, input.toWalletId);
    const amount = new Prisma.Decimal(input.amount);
    const fee = new Prisma.Decimal(feeAmount);
    if (fromWallet.currentBalance.lt(amount.plus(fee))) throw new Error(`Insufficient balance in ${fromWallet.name}.`);

    let feeTransactionId: string | null = existing.feeTransactionId;
    if (existing.feeTransaction) {
      if (fee.isZero()) {
        await tx.transaction.delete({ where: { id: existing.feeTransaction.id } });
        feeTransactionId = null;
      } else {
        const updatedFee = await tx.transaction.update({
          where: { id: existing.feeTransaction.id },
          data: { transactionDate: input.transferDate, amount: fee, walletId: fromWallet.id },
        });
        feeTransactionId = updatedFee.id;
        if (affectsCurrentBalance(input.transferDate, updatedFee.createdAt, fromWallet.balanceAsOf)) {
          await tx.wallet.update({ where: { id: fromWallet.id }, data: { currentBalance: { decrement: fee } } });
        }
      }
    } else if (!fee.isZero()) {
      const createdFee = await tx.transaction.create({
        data: {
          transactionDate: input.transferDate,
          type: TransactionType.EXPENSE,
          amount: fee,
          note: "Transfer Fee",
          wallet: { connect: { id: fromWallet.id } },
        },
      });
      feeTransactionId = createdFee.id;
      if (affectsCurrentBalance(input.transferDate, createdFee.createdAt, fromWallet.balanceAsOf)) {
        await tx.wallet.update({ where: { id: fromWallet.id }, data: { currentBalance: { decrement: fee } } });
      }
    }

    const transfer = await tx.transfer.update({
      where: { id: input.id },
      data: {
        transferDate: input.transferDate,
        fromWalletId: fromWallet.id,
        toWalletId: toWallet.id,
        amount,
        feeAmount: fee,
        feeTransactionId,
      },
    });
    await applyTransferBalance(tx, transfer, fromWallet, toWallet);
    return transfer;
  });
}

export async function deleteTransfer(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.transfer.findUnique({ where: { id }, include: { feeTransaction: true } });
    if (!existing) throw new Error("Transfer not found.");
    if (existing.origin !== TransferOrigin.MANUAL) throw new Error("Credit card payments must be managed from Credit Cards > Payment History.");

    const source = await tx.wallet.findUnique({ where: { id: existing.fromWalletId }, select: { id: true, balanceAsOf: true } });
    const destination = await tx.wallet.findUnique({ where: { id: existing.toWalletId }, select: { id: true, balanceAsOf: true } });
    if (!source || !destination) throw new Error("Transfer wallets not found.");

    await reverseTransferBalance(tx, existing, source, destination);
    if (existing.feeTransaction && affectsCurrentBalance(existing.feeTransaction.transactionDate, existing.feeTransaction.createdAt, source.balanceAsOf)) {
      await tx.wallet.update({ where: { id: existing.feeTransaction.walletId }, data: { currentBalance: { increment: existing.feeTransaction.amount } } });
    }
    if (existing.feeTransactionId) await tx.transaction.delete({ where: { id: existing.feeTransactionId } });
    await tx.transfer.delete({ where: { id } });
  });
}
