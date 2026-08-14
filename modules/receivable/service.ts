import { Prisma, ReceivableStatus, TransactionKind, WalletType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function getStatus(amount: Prisma.Decimal, received: Prisma.Decimal, dueDate: Date | null) {
  if (received.gte(amount)) return ReceivableStatus.RECEIVED;
  if (received.gt(0)) return ReceivableStatus.PARTIALLY_RECEIVED;
  if (dueDate && dueDate < new Date()) return ReceivableStatus.OVERDUE;
  return ReceivableStatus.OUTSTANDING;
}

function affectsCurrentBalance(transactionDate: Date, createdAt: Date, balanceAsOf: Date | null) {
  if (!balanceAsOf) return true;
  const transactionDay = Date.UTC(transactionDate.getUTCFullYear(), transactionDate.getUTCMonth(), transactionDate.getUTCDate());
  const snapshotDay = Date.UTC(balanceAsOf.getUTCFullYear(), balanceAsOf.getUTCMonth(), balanceAsOf.getUTCDate());
  if (transactionDay > snapshotDay) return true;
  if (transactionDay < snapshotDay) return false;
  return createdAt > balanceAsOf;
}

async function updateReceivableStatus(tx: Prisma.TransactionClient, receivableId: string) {
  const receivable = await tx.receivable.findUnique({ where: { id: receivableId } });
  if (!receivable) return;
  const status = getStatus(new Prisma.Decimal(receivable.amount), new Prisma.Decimal(receivable.receivedAmount), receivable.dueDate);
  if (status !== receivable.status) await tx.receivable.update({ where: { id: receivable.id }, data: { status } });
}

export async function getReceivables() {
  const receivables = await prisma.receivable.findMany({
    include: {
      currency: { select: { code: true, symbol: true } },
      payments: {
        orderBy: { receivedAt: "desc" },
        include: { wallet: { select: { name: true, currency: { select: { symbol: true, code: true } } } } },
      },
      splitBillParticipant: { select: { id: true, splitBillId: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  const sourceWalletIds = receivables.map((item) => item.sourceWalletId).filter((id): id is string => Boolean(id));
  const sourceWallets = sourceWalletIds.length
    ? await prisma.wallet.findMany({
        where: { id: { in: sourceWalletIds } },
        select: { id: true, name: true, walletType: true },
      })
    : [];
  const sourceWalletMap = new Map(sourceWallets.map((wallet) => [wallet.id, wallet]));

  return receivables.map((item) => ({
    ...item,
    sourceWallet: item.sourceWalletId ? sourceWalletMap.get(item.sourceWalletId) ?? null : null,
    amount: Number(item.amount),
    receivedAmount: Number(item.receivedAmount),
    remaining: Math.max(Number(item.amount) - Number(item.receivedAmount), 0),
    payments: item.payments.map((payment) => ({ ...payment, amount: Number(payment.amount) })),
  }));
}

export async function getReceivableSummary(currencyCode = "IDR") {
  const items = await prisma.receivable.findMany({ where: { currency: { code: currencyCode } }, select: { amount: true, receivedAmount: true } });
  return items.reduce((sum, item) => sum + Math.max(Number(item.amount) - Number(item.receivedAmount), 0), 0);
}

export async function createReceivable(input: { personName: string; description: string; amount: number; currencyId: string; sourceWalletId: string; loanDate?: Date; dueDate?: Date | null; sourceTransactionId?: string | null; splitBillParticipantId?: string | null }) {
  if (input.amount <= 0) throw new Error("Receivable amount must be greater than zero.");
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { id: input.sourceWalletId }, select: { id: true, currencyId: true, walletType: true, currentBalance: true, balanceAsOf: true } });
    if (!wallet) throw new Error("Source wallet not found.");
    if (wallet.currencyId !== input.currencyId) throw new Error("Source wallet currency must match the receivable currency.");

    const receivable = await tx.receivable.create({
      data: {
        personName: input.personName.trim(),
        description: input.description.trim(),
        amount: input.amount,
        currency: { connect: { id: input.currencyId } },
        sourceWallet: { connect: { id: input.sourceWalletId } },
        loanDate: input.loanDate ?? new Date(),
        dueDate: input.dueDate ?? null,
        sourceTransactionId: input.sourceTransactionId ?? null,
        ...(input.splitBillParticipantId ? { splitBillParticipant: { connect: { id: input.splitBillParticipantId } } } : {}),
      },
    });

    const shouldReduceWallet = !input.sourceTransactionId && wallet.walletType !== WalletType.CREDIT_CARD;
    const createdAt = receivable.createdAt;
    const effectiveDate = input.loanDate ?? createdAt;
    if (shouldReduceWallet && affectsCurrentBalance(effectiveDate, createdAt, wallet.balanceAsOf)) {
      await tx.wallet.update({ where: { id: wallet.id }, data: { currentBalance: { decrement: input.amount } } });
    }

    return receivable;
  });
}

export async function updateReceivable(input: { receivableId: string; personName: string; description: string; amount: number; currencyId: string; sourceWalletId: string; loanDate: Date; dueDate?: Date | null }) {
  if (input.amount <= 0) throw new Error("Receivable amount must be greater than zero.");
  return prisma.$transaction(async (tx) => {
    const existing = await tx.receivable.findUnique({ where: { id: input.receivableId } });
    if (!existing) throw new Error("Receivable not found.");
    if (new Prisma.Decimal(input.amount).lt(existing.receivedAmount)) throw new Error("Receivable amount cannot be lower than the amount already received.");

    const oldWallet = existing.sourceWalletId ? await tx.wallet.findUnique({ where: { id: existing.sourceWalletId }, select: { id: true, currencyId: true, walletType: true, balanceAsOf: true } }) : null;
    const newWallet = await tx.wallet.findUnique({ where: { id: input.sourceWalletId }, select: { id: true, currencyId: true, walletType: true, balanceAsOf: true } });
    if (!newWallet) throw new Error("Source wallet not found.");
    if (newWallet.currencyId !== input.currencyId) throw new Error("Source wallet currency must match the receivable currency.");

    const oldEffective = existing.loanDate;
    const oldApplied = !existing.sourceTransactionId && oldWallet && oldWallet.walletType !== WalletType.CREDIT_CARD && affectsCurrentBalance(oldEffective, existing.createdAt, oldWallet.balanceAsOf);
    if (oldApplied && oldWallet) await tx.wallet.update({ where: { id: oldWallet.id }, data: { currentBalance: { increment: existing.amount } } });

    const newApplied = !existing.sourceTransactionId && newWallet.walletType !== WalletType.CREDIT_CARD && affectsCurrentBalance(input.loanDate, existing.createdAt, newWallet.balanceAsOf);
    if (newApplied) await tx.wallet.update({ where: { id: newWallet.id }, data: { currentBalance: { decrement: input.amount } } });

    const updated = await tx.receivable.update({
      where: { id: existing.id },
      data: {
        personName: input.personName.trim(),
        description: input.description.trim(),
        amount: input.amount,
        currency: { connect: { id: input.currencyId } },
        sourceWallet: { connect: { id: input.sourceWalletId } },
        loanDate: input.loanDate,
        dueDate: input.dueDate ?? null,
      },
    });
    await updateReceivableStatus(tx, existing.id);
    return updated;
  });
}

export async function deleteReceivable(receivableId: string) {
  return prisma.$transaction(async (tx) => {
    const receivable = await tx.receivable.findUnique({ where: { id: receivableId }, include: { payments: true } });
    if (!receivable) throw new Error("Receivable not found.");
    if (receivable.payments.length > 0) throw new Error("Delete the payment history first before deleting this receivable.");

    if (receivable.sourceWalletId && !receivable.sourceTransactionId) {
      const wallet = await tx.wallet.findUnique({ where: { id: receivable.sourceWalletId }, select: { id: true, walletType: true, balanceAsOf: true } });
      if (wallet && wallet.walletType !== WalletType.CREDIT_CARD && affectsCurrentBalance(receivable.loanDate, receivable.createdAt, wallet.balanceAsOf)) {
        await tx.wallet.update({ where: { id: wallet.id }, data: { currentBalance: { increment: receivable.amount } } });
      }
    }
    await tx.receivable.delete({ where: { id: receivable.id } });
  });
}

export async function recordReceivablePayment(input: { receivableId: string; amount: number; receivedAt: Date; walletId: string; note?: string }) {
  if (input.amount <= 0) throw new Error("Payment amount must be greater than zero.");
  return prisma.$transaction(async (tx) => {
    const receivable = await tx.receivable.findUnique({ where: { id: input.receivableId }, include: { currency: true } });
    if (!receivable) throw new Error("Receivable not found.");
    const amount = new Prisma.Decimal(input.amount);
    const wallet = await tx.wallet.findUnique({ where: { id: input.walletId }, select: { id: true, balanceAsOf: true, currencyId: true } });
    if (!wallet) throw new Error("Wallet not found.");
    if (wallet.currencyId !== receivable.currencyId) throw new Error("Payment wallet currency must match the receivable currency.");

    const transaction = await tx.transaction.create({
      data: {
        transactionDate: input.receivedAt,
        type: "INCOME",
        kind: TransactionKind.REIMBURSEMENT,
        amount,
        note: input.note?.trim() || `Reimbursement from ${receivable.personName}: ${receivable.description}`,
        wallet: { connect: { id: input.walletId } },
      },
    });

    const receivedAmount = new Prisma.Decimal(receivable.receivedAmount).plus(amount);
    const status = getStatus(new Prisma.Decimal(receivable.amount), receivedAmount, receivable.dueDate);
    const payment = await tx.receivablePayment.create({ data: { receivableId: receivable.id, amount, receivedAt: input.receivedAt, walletId: input.walletId, transactionId: transaction.id, note: input.note?.trim() || null } });
    await tx.receivable.update({ where: { id: receivable.id }, data: { receivedAmount, status } });
    if (affectsCurrentBalance(input.receivedAt, transaction.createdAt, wallet.balanceAsOf)) await tx.wallet.update({ where: { id: wallet.id }, data: { currentBalance: { increment: amount } } });
    return payment;
  });
}

export async function updateReceivablePayment(input: { paymentId: string; amount: number; receivedAt: Date; walletId: string; note?: string }) {
  if (input.amount <= 0) throw new Error("Payment amount must be greater than zero.");
  return prisma.$transaction(async (tx) => {
    const payment = await tx.receivablePayment.findUnique({ where: { id: input.paymentId }, include: { receivable: true, transaction: true } });
    if (!payment) throw new Error("Payment not found.");
    const receivable = payment.receivable;
    const otherReceived = new Prisma.Decimal(receivable.receivedAmount).minus(payment.amount);
    const newAmount = new Prisma.Decimal(input.amount);

    const oldWallet = await tx.wallet.findUnique({ where: { id: payment.walletId }, select: { id: true, balanceAsOf: true } });
    const newWallet = await tx.wallet.findUnique({ where: { id: input.walletId }, select: { id: true, balanceAsOf: true, currencyId: true } });
    if (!newWallet) throw new Error("Wallet not found.");
    if (newWallet.currencyId !== receivable.currencyId) throw new Error("Payment wallet currency must match the receivable currency.");

    if (oldWallet && affectsCurrentBalance(payment.receivedAt, payment.transaction.createdAt, oldWallet.balanceAsOf)) {
      await tx.wallet.update({ where: { id: oldWallet.id }, data: { currentBalance: { decrement: payment.amount } } });
    }

    const updatedTransaction = await tx.transaction.update({
      where: { id: payment.transactionId },
      data: {
        transactionDate: input.receivedAt,
        amount: newAmount,
        note: input.note?.trim() || `Reimbursement from ${receivable.personName}: ${receivable.description}`,
        wallet: { connect: { id: input.walletId } },
      },
    });
    await tx.receivablePayment.update({ where: { id: payment.id }, data: { amount: newAmount, receivedAt: input.receivedAt, walletId: input.walletId, note: input.note?.trim() || null } });

    if (affectsCurrentBalance(input.receivedAt, updatedTransaction.createdAt, newWallet.balanceAsOf)) {
      await tx.wallet.update({ where: { id: newWallet.id }, data: { currentBalance: { increment: newAmount } } });
    }

    const receivedAmount = otherReceived.plus(newAmount);
    await tx.receivable.update({ where: { id: receivable.id }, data: { receivedAmount, status: getStatus(new Prisma.Decimal(receivable.amount), receivedAmount, receivable.dueDate) } });
    return updatedTransaction;
  });
}

export async function deleteReceivablePayment(paymentId: string) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.receivablePayment.findUnique({ where: { id: paymentId }, include: { receivable: true, transaction: true } });
    if (!payment) throw new Error("Payment not found.");
    const wallet = await tx.wallet.findUnique({ where: { id: payment.walletId }, select: { id: true, balanceAsOf: true } });
    if (wallet && affectsCurrentBalance(payment.receivedAt, payment.transaction.createdAt, wallet.balanceAsOf)) {
      await tx.wallet.update({ where: { id: wallet.id }, data: { currentBalance: { decrement: payment.amount } } });
    }
    await tx.receivablePayment.delete({ where: { id: payment.id } });
    await tx.transaction.delete({ where: { id: payment.transactionId } });
    const remainingReceived = new Prisma.Decimal(payment.receivable.receivedAmount).minus(payment.amount);
    await tx.receivable.update({ where: { id: payment.receivableId }, data: { receivedAmount: remainingReceived, status: getStatus(new Prisma.Decimal(payment.receivable.amount), remainingReceived, payment.receivable.dueDate) } });
  });
}

export async function refreshReceivableStatuses() {
  const items = await prisma.receivable.findMany({ where: { status: { in: ["OUTSTANDING", "PARTIALLY_RECEIVED"] } } });
  await Promise.all(items.map((item) => { const status = getStatus(new Prisma.Decimal(item.amount), new Prisma.Decimal(item.receivedAmount), item.dueDate); return status !== item.status ? prisma.receivable.update({ where: { id: item.id }, data: { status } }) : null; }));
}
