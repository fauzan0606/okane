import { Prisma, TransferOrigin } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function affectsCurrentBalance(transactionDate: Date, createdAt: Date, balanceAsOf: Date | null) {
  if (!balanceAsOf) return true;
  const transactionDay = Date.UTC(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth(), transactionDate.getUTCDate());
  const snapshotDay = Date.UTC(balanceAsOf.getUTCFullYear(), balanceAsOf.getUTCMonth(), balanceAsOf.getUTCDate());
  if (transactionDay > snapshotDay) return true;
  if (transactionDay < snapshotDay) return false;
  return createdAt > balanceAsOf;
}

export async function getTransfers() {
  const transfers = await prisma.transfer.findMany({
    include: {
      fromWallet: { select: { id: true, name: true, walletType: true, currency: { select: { code: true, symbol: true } } } },
      toWallet: { select: { id: true, name: true, walletType: true, currency: { select: { code: true, symbol: true } } } },
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
  if (input.amount <= 0) throw new Error("Transfer amount must be greater than zero.");
  if ((input.feeAmount ?? 0) < 0) throw new Error("Transfer fee cannot be negative.");
  if (input.fromWalletId === input.toWalletId) throw new Error("Source and destination wallets must be different.");

  return prisma.$transaction(async (tx) => {
    const [fromWallet, toWallet] = await Promise.all([
      tx.wallet.findUnique({ where: { id: input.fromWalletId }, select: { id: true, name: true, currencyId: true, currentBalance: true, balanceAsOf: true } }),
      tx.wallet.findUnique({ where: { id: input.toWalletId }, select: { id: true, name: true, currencyId: true, currentBalance: true, balanceAsOf: true } }),
    ]);
    if (!fromWallet) throw new Error("Source wallet not found.");
    if (!toWallet) throw new Error("Destination wallet not found.");
    if (fromWallet.currencyId !== toWallet.currencyId) throw new Error("Transfer currently requires wallets with the same currency.");

    const amount = new Prisma.Decimal(input.amount);
    const fee = new Prisma.Decimal(input.feeAmount ?? 0);
    const totalOut = amount.plus(fee);
    if (fromWallet.currentBalance.lt(totalOut)) throw new Error(`Insufficient balance in ${fromWallet.name}.`);

    const transfer = await tx.transfer.create({
      data: {
        transferDate: input.transferDate,
        fromWalletId: input.fromWalletId,
        toWalletId: input.toWalletId,
        amount,
        feeAmount: fee,
        origin: TransferOrigin.MANUAL,
      },
    });

    const createdAt = transfer.createdAt;
    if (affectsCurrentBalance(input.transferDate, createdAt, fromWallet.balanceAsOf)) {
      await tx.wallet.update({ where: { id: fromWallet.id }, data: { currentBalance: { decrement: totalOut } } });
    }
    if (affectsCurrentBalance(input.transferDate, createdAt, toWallet.balanceAsOf)) {
      await tx.wallet.update({ where: { id: toWallet.id }, data: { currentBalance: { increment: amount } } });
    }

    return transfer;
  });
}
