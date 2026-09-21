import { Prisma, PayableStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findOrCreatePayeeByName } from "@/modules/payee/service";

type RecordPayablePaymentInput = {
  payableId: string;
  amountTransferred: number;
  paymentDate: Date;
  walletId: string;
  categoryId?: string;
  subcategoryId?: string;
  note?: string;
};

function decimal(value: number) { return new Prisma.Decimal(value); }

function transactionAffectedBalance(transaction: { transactionDate: Date; createdAt: Date }, balanceAsOf: Date | null) {
  return !balanceAsOf || transaction.transactionDate > balanceAsOf || (
    transaction.transactionDate.toDateString() === balanceAsOf.toDateString() &&
    transaction.createdAt > balanceAsOf
  );
}

async function applyExpenseBalanceDelta(tx: Prisma.TransactionClient, walletId: string, amount: Prisma.Decimal) {
  if (amount.isZero()) return;
  await tx.wallet.update({
    where: { id: walletId },
    data: { currentBalance: { decrement: amount } },
  });
}

export async function createPayableForSplitBillParticipant(
  tx: Prisma.TransactionClient,
  participant: { id: string; name: string; shareAmount: Prisma.Decimal; payable?: { id: string } | null },
  merchantName: string,
  currencyId: string,
  paymentDate: Date,
) {
  if (participant.isMe || participant.shareAmount.lte(0) || participant.payable) return participant.payable ?? null;

  return tx.payable.create({
    data: {
      personName: participant.name,
      description: "Split Bill: " + merchantName,
      amount: participant.shareAmount,
      currencyId,
      loanDate: paymentDate,
      status: PayableStatus.OUTSTANDING,
      splitBillParticipantId: participant.id,
    },
  });
}

export async function recordPayablePayment(input: RecordPayablePaymentInput) {
  if (!Number.isFinite(input.amountTransferred) || input.amountTransferred <= 0) {
    throw new Error("Transferred amount must be greater than zero.");
  }
  if (!(input.paymentDate instanceof Date) || Number.isNaN(input.paymentDate.getTime())) {
    throw new Error("Payment date is required.");
  }

  const amountTransferred = decimal(input.amountTransferred);
  const payableOwner = await prisma.payable.findUnique({ where: { id: input.payableId }, select: { personName: true } });
  if (!payableOwner) throw new Error("Payable not found.");
  const payee = await findOrCreatePayeeByName(payableOwner.personName);
  return prisma.$transaction(async (tx) => {
    const payable = await tx.payable.findUnique({
      where: { id: input.payableId },
      include: {
        splitBillParticipant: { include: { splitBill: { select: { id: true, merchantName: true } } } },
      },
    });
    if (!payable) throw new Error("Payable not found.");

    const remaining = payable.amount.minus(payable.paidAmount);
    if (remaining.lte(0)) throw new Error("This payable is already fully paid.");

    const appliedAmount = amountTransferred.lte(remaining) ? amountTransferred : remaining;
    const excessAmount = amountTransferred.minus(appliedAmount);

    const wallet = await tx.wallet.findUnique({
      where: { id: input.walletId },
      select: { id: true, currencyId: true, balanceAsOf: true },
    });
    if (!wallet) throw new Error("Wallet not found.");
    if (wallet.currencyId !== payable.currencyId) throw new Error("Payment wallet currency does not match the payable currency.");

    if (input.categoryId) {
      const category = await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true, type: true } });
      if (!category) throw new Error("Category not found.");
      if (category.type !== "EXPENSE") throw new Error("Repayment category must be an expense category.");
    }
    if (input.subcategoryId) {
      const subcategory = await tx.subcategory.findUnique({ where: { id: input.subcategoryId }, select: { id: true, categoryId: true } });
      if (!subcategory) throw new Error("Subcategory not found.");
      if (input.categoryId && subcategory.categoryId !== input.categoryId) throw new Error("Subcategory does not belong to the selected category.");
    }

    const transaction = await tx.transaction.create({
      data: {
        transactionDate: input.paymentDate,
        type: "EXPENSE",
        kind: "STANDARD",
        amount: amountTransferred,
        note: input.note?.trim() || "Repayment to " + payable.personName + (payable.splitBillParticipant?.splitBill?.merchantName ? " · " + payable.splitBillParticipant.splitBill.merchantName : ""),
        wallet: { connect: { id: wallet.id } },
        category: input.categoryId ? { connect: { id: input.categoryId } } : undefined,
        subcategory: input.subcategoryId ? { connect: { id: input.subcategoryId } } : undefined,
        payee: payee ? { connect: { id: payee.id } } : undefined,
      },
    });

    if (transactionAffectedBalance(transaction, wallet.balanceAsOf)) {
      await applyExpenseBalanceDelta(tx, wallet.id, amountTransferred);
    }

    const payment = await tx.payablePayment.create({
      data: {
        payableId: payable.id,
        amount: amountTransferred,
        appliedAmount,
        excessAmount,
        paidAt: input.paymentDate,
        walletId: wallet.id,
        transactionId: transaction.id,
        note: input.note?.trim() || null,
      },
    });

    const paidAmount = payable.paidAmount.plus(appliedAmount);
    const status = paidAmount.gte(payable.amount)
      ? PayableStatus.PAID
      : paidAmount.gt(0)
        ? PayableStatus.PARTIALLY_PAID
        : PayableStatus.OUTSTANDING;

    await tx.payable.update({
      where: { id: payable.id },
      data: { paidAmount, status },
    });

    if (payable.splitBillParticipant?.splitBill?.id) {
      await tx.splitBill.update({
        where: { id: payable.splitBillParticipant.splitBill.id },
        data: { status: status === PayableStatus.PAID ? "SETTLED" : "OPEN" },
      });
    }

    return { payment, transaction, appliedAmount, excessAmount, remainingAmount: payable.amount.minus(paidAmount), status };
  });
}
