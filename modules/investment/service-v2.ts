import {
  InvestmentCashMovementType,
  InvestmentTransactionType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

const D = Prisma.Decimal;
const money = (v: Prisma.Decimal) => v.toDecimalPlaces(2);

function positive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return new D(value);
}

function nonNegative(value: number | undefined, label: string) {
  const n = value ?? 0;
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} cannot be negative.`);
  }
  return new D(n);
}

async function resolveFunding(
  tx: Prisma.TransactionClient,
  accountId: string,
  cashAccountId?: string,
  walletId?: string,
) {
  const account = await tx.investmentAccount.findUnique({
    where: { id: accountId },
    select: { providerId: true, currencyId: true },
  });
  if (!account) throw new Error("Investment account not found.");

  if (cashAccountId) {
    const cash = await tx.investmentCashAccount.findUnique({
      where: { id: cashAccountId },
      include: { account: true },
    });
    if (!cash || cash.account.providerId !== account.providerId || cash.account.currencyId !== account.currencyId) {
      throw new Error("Funding cash account must belong to the same investment provider and currency.");
    }
    return { kind: "CASH" as const, cash };
  }

  if (walletId) {
    const wallet = await tx.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.currencyId !== account.currencyId) {
      throw new Error("Funding wallet currency must match the investment account.");
    }
    return { kind: "WALLET" as const, wallet };
  }

  throw new Error("Select a funding wallet or investment cash account.");
}

async function debit(tx: Prisma.TransactionClient, funding: Awaited<ReturnType<typeof resolveFunding>>, amount: Prisma.Decimal) {
  if (funding.kind === "CASH") {
    if (funding.cash.balance.lt(amount)) throw new Error(`Insufficient balance in ${funding.cash.account.name}.`);
    await tx.investmentCashAccount.update({ where: { id: funding.cash.id }, data: { balance: { decrement: amount } } });
    return;
  }
  if (funding.wallet.currentBalance.lt(amount)) throw new Error(`Insufficient balance in ${funding.wallet.name}.`);
  await tx.wallet.update({ where: { id: funding.wallet.id }, data: { currentBalance: { decrement: amount } } });
}

async function credit(tx: Prisma.TransactionClient, funding: Awaited<ReturnType<typeof resolveFunding>>, amount: Prisma.Decimal) {
  if (funding.kind === "CASH") {
    await tx.investmentCashAccount.update({ where: { id: funding.cash.id }, data: { balance: { increment: amount } } });
    return;
  }
  await tx.wallet.update({ where: { id: funding.wallet.id }, data: { currentBalance: { increment: amount } } });
}

async function settlement(
  tx: Prisma.TransactionClient,
  funding: Awaited<ReturnType<typeof resolveFunding>>,
  type: "BUY" | "SELL",
  amount: Prisma.Decimal,
  transactionId: string,
  date: Date,
) {
  if (funding.kind !== "CASH") return;
  await tx.investmentCashMovement.create({
    data: {
      cashAccountId: funding.cash.id,
      movementType: type === "BUY" ? InvestmentCashMovementType.BUY_SETTLEMENT : InvestmentCashMovementType.SELL_SETTLEMENT,
      amount,
      movementDate: date,
      investmentTransactionId: transactionId,
    },
  });
}

export async function createInvestmentTransactionV2(input: {
  accountId: string;
  assetId: string;
  transactionType: InvestmentTransactionType;
  transactionDate: Date;
  quantity: number;
  unitPrice: number;
  feeAmount?: number;
  taxAmount?: number;
  otherCharges?: number;
  fundingCashAccountId?: string;
  fundingWalletId?: string;
  note?: string;
}) {
  if (input.transactionType !== InvestmentTransactionType.BUY && input.transactionType !== InvestmentTransactionType.SELL) {
    throw new Error("Investment v2 trade supports BUY and SELL only.");
  }

  const quantity = positive(input.quantity, "Quantity");
  const unitPrice = positive(input.unitPrice, "Unit price");
  const fee = nonNegative(input.feeAmount, "Fee");
  const tax = nonNegative(input.taxAmount, "Tax");
  const other = nonNegative(input.otherCharges, "Other charges");

  return prisma.$transaction(async (tx) => {
    const account = await tx.investmentAccount.findUnique({ where: { id: input.accountId } });
    const asset = await tx.investmentAsset.findUnique({ where: { id: input.assetId } });
    if (!account || !asset) throw new Error("Investment account or asset not found.");
    if (account.currencyId !== asset.currencyId) throw new Error("Investment account and asset currency must match.");

    const gross = money(quantity.mul(unitPrice));
    const charges = money(fee.plus(tax).plus(other));
    const funding = await resolveFunding(tx, account.id, input.fundingCashAccountId, input.fundingWalletId);
    const holding = await tx.investmentHolding.findUnique({ where: { accountId_assetId: { accountId: account.id, assetId: asset.id } } });

    if (input.transactionType === InvestmentTransactionType.BUY) {
      const total = money(gross.plus(charges));
      await debit(tx, funding, total);

      const current = holding ?? await tx.investmentHolding.create({ data: { accountId: account.id, assetId: asset.id } });
      const nextQuantity = current.quantity.plus(quantity);
      const nextCostBasis = money(current.costBasis.plus(total));
      const updated = await tx.investmentHolding.update({
        where: { id: current.id },
        data: { quantity: nextQuantity, costBasis: nextCostBasis, currentPrice: unitPrice, priceAsOf: input.transactionDate },
      });

      const transaction = await tx.investmentTransaction.create({
        data: {
          accountId: account.id,
          assetId: asset.id,
          holdingId: updated.id,
          transactionType: InvestmentTransactionType.BUY,
          transactionDate: input.transactionDate,
          quantity,
          unitPrice,
          grossAmount: gross,
          feeAmount: fee,
          taxAmount: tax,
          otherCharges: other,
          totalCashAmount: total,
          netCashAmount: total.neg(),
          costBasisAmount: total,
          fundingCashAccountId: funding.kind === "CASH" ? funding.cash.id : null,
          fundingWalletId: funding.kind === "WALLET" ? funding.wallet.id : null,
          currencyId: account.currencyId,
          note: input.note || null,
          feeRuleSnapshot: JSON.stringify({ fee: fee.toString(), tax: tax.toString(), other: other.toString(), costBasis: total.toString() }),
        },
      });
      await settlement(tx, funding, "BUY", total, transaction.id, input.transactionDate);
      return transaction;
    }

    if (!holding || holding.quantity.lt(quantity)) throw new Error("Insufficient holding quantity.");

    const soldCost = money(holding.costBasis.mul(quantity).div(holding.quantity));
    const netProceeds = money(gross.minus(charges));
    if (netProceeds.lt(0)) throw new Error("Fees, tax and other charges cannot exceed gross sale proceeds.");

    const remainingQuantity = holding.quantity.minus(quantity);
    const remainingCostBasis = money(holding.costBasis.minus(soldCost));
    if (remainingQuantity.lt(0) || remainingCostBasis.lt(0)) throw new Error("Invalid remaining holding balance.");

    await credit(tx, funding, netProceeds);
    const updated = await tx.investmentHolding.update({
      where: { id: holding.id },
      data: {
        quantity: remainingQuantity,
        costBasis: remainingCostBasis,
        currentPrice: unitPrice,
        priceAsOf: input.transactionDate,
      },
    });

    const realizedGainLoss = money(netProceeds.minus(soldCost));
    const transaction = await tx.investmentTransaction.create({
      data: {
        accountId: account.id,
        assetId: asset.id,
        holdingId: updated.id,
        transactionType: InvestmentTransactionType.SELL,
        transactionDate: input.transactionDate,
        quantity,
        unitPrice,
        grossAmount: gross,
        feeAmount: fee,
        taxAmount: tax,
        otherCharges: other,
        totalCashAmount: gross,
        netCashAmount: netProceeds,
        costBasisAmount: soldCost,
        realizedGainLoss,
        fundingCashAccountId: funding.kind === "CASH" ? funding.cash.id : null,
        fundingWalletId: funding.kind === "WALLET" ? funding.wallet.id : null,
        currencyId: account.currencyId,
        note: input.note || null,
        feeRuleSnapshot: JSON.stringify({ fee: fee.toString(), tax: tax.toString(), other: other.toString(), soldCost: soldCost.toString(), realizedGainLoss: realizedGainLoss.toString() }),
      },
    });
    await settlement(tx, funding, "SELL", netProceeds, transaction.id, input.transactionDate);
    return transaction;
  });
}
