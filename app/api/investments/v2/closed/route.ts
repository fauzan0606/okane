import { NextResponse } from "next/server";
import { InvestmentTransactionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const D = Prisma.Decimal;

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function sellFeePctFromNote(note: string | null | undefined) {
  try {
    const parsed = note ? (JSON.parse(note) as { sellFeePct?: number }) : {};
    const pct = Number(parsed.sellFeePct ?? 0);
    return Number.isFinite(pct) && pct >= 0 ? pct : 0;
  } catch {
    return 0;
  }
}

function positiveNumber(value: unknown, label: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`${label} must be greater than zero.`);
  return n;
}

function nonNegativeNumber(value: unknown, label: string) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${label} cannot be negative.`);
  return n;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || "");
    const transactionId = String(body.transactionId || "");

    if (!transactionId) {
      return NextResponse.json({ error: "transactionId is required." }, { status: 400 });
    }

    if (!["delete", "update"].includes(action)) {
      return NextResponse.json({ error: "Unknown closed transaction action." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const target = await tx.investmentTransaction.findUnique({
        where: { id: transactionId },
        include: { account: true, cashMovements: true, holding: true },
      });

      if (!target) throw new Error("Investment transaction not found.");
      if (target.transactionType !== InvestmentTransactionType.SELL) {
        throw new Error("Only SELL transactions can be edited or deleted from Closed Transactions.");
      }

      if (action === "delete") {
        if (target.fundingCashAccountId) {
          const cash = await tx.investmentCashAccount.findUnique({
            where: { id: target.fundingCashAccountId },
          });
          if (!cash) throw new Error("Investment cash account not found.");
          await tx.investmentCashAccount.update({
            where: { id: cash.id },
            data: { balance: { decrement: target.netCashAmount } },
          });
        } else if (target.fundingWalletId) {
          const wallet = await tx.wallet.findUnique({
            where: { id: target.fundingWalletId },
          });
          if (!wallet) throw new Error("Funding wallet not found.");
          if (wallet.currentBalance.lt(target.netCashAmount)) {
            throw new Error(`Insufficient balance in ${wallet.name} to reverse this sale.`);
          }
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { currentBalance: { decrement: target.netCashAmount } },
          });
        } else {
          throw new Error("This SELL transaction has no settlement account to reverse.");
        }

        if (target.holdingId) {
          const holding = await tx.investmentHolding.findUnique({
            where: { id: target.holdingId },
          });
          if (!holding) throw new Error("Investment holding not found.");
          await tx.investmentHolding.update({
            where: { id: holding.id },
            data: {
              quantity: holding.quantity.plus(target.quantity),
              costBasis: holding.costBasis.plus(target.costBasisAmount),
            },
          });
        }

        await tx.investmentCashMovement.deleteMany({
          where: { investmentTransactionId: target.id },
        });
        await tx.investmentTransaction.delete({ where: { id: target.id } });

        return { id: target.id, action: "deleted" as const };
      }

      const price = positiveNumber(body.unitPrice, "Sell price");
      const tax = nonNegativeNumber(body.taxAmount, "Tax");
      const other = nonNegativeNumber(body.otherCharges, "Other charges");
      const feePct = sellFeePctFromNote(target.account.note);
      const gross = new D(target.quantity).mul(price).toDecimalPlaces(2);
      const fee = gross.mul(feePct).div(100).toDecimalPlaces(2);
      const charges = fee.plus(tax).plus(other).toDecimalPlaces(2);
      const net = gross.minus(charges).toDecimalPlaces(2);
      if (net.lt(0)) throw new Error("Charges cannot exceed gross sale proceeds.");

      const delta = net.minus(target.netCashAmount).toDecimalPlaces(2);

      if (target.fundingCashAccountId) {
        const cash = await tx.investmentCashAccount.findUnique({
          where: { id: target.fundingCashAccountId },
        });
        if (!cash) throw new Error("Investment cash account not found.");
        if (delta.gt(0)) {
          await tx.investmentCashAccount.update({
            where: { id: cash.id },
            data: { balance: { increment: delta } },
          });
        } else if (delta.lt(0)) {
          const debit = delta.abs();
          if (cash.balance.lt(debit)) {
            throw new Error(`Insufficient balance in ${cash.account?.name ?? "RDN"} to reduce this sale proceeds.`);
          }
          await tx.investmentCashAccount.update({
            where: { id: cash.id },
            data: { balance: { decrement: debit } },
          });
        }
      } else if (target.fundingWalletId) {
        const wallet = await tx.wallet.findUnique({ where: { id: target.fundingWalletId } });
        if (!wallet) throw new Error("Funding wallet not found.");
        if (delta.gt(0)) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { currentBalance: { increment: delta } },
          });
        } else if (delta.lt(0)) {
          const debit = delta.abs();
          if (wallet.currentBalance.lt(debit)) {
            throw new Error(`Insufficient balance in ${wallet.name} to reduce this sale proceeds.`);
          }
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { currentBalance: { decrement: debit } },
          });
        }
      }

      const transactionDate = body.transactionDate ? new Date(String(body.transactionDate)) : target.transactionDate;
      if (Number.isNaN(transactionDate.getTime())) throw new Error("Invalid transaction date.");

      const updated = await tx.investmentTransaction.update({
        where: { id: target.id },
        data: {
          transactionDate,
          unitPrice: new D(price),
          grossAmount: gross,
          feeAmount: fee,
          taxAmount: new D(tax).toDecimalPlaces(2),
          otherCharges: new D(other).toDecimalPlaces(2),
          totalCashAmount: gross,
          netCashAmount: net,
          realizedGainLoss: net.minus(target.costBasisAmount).toDecimalPlaces(2),
        },
      });

      const movement = target.cashMovements[0];
      if (movement) {
        await tx.investmentCashMovement.update({
          where: { id: movement.id },
          data: { amount: net, movementDate: transactionDate },
        });
      }

      return { id: updated.id, action: "updated" as const };
    });

    return NextResponse.json(serialize(result));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Closed transaction operation failed." },
      { status: 400 },
    );
  }
}
