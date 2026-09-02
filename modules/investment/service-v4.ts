import crypto from "node:crypto";
import { InvestmentCashMovementType, InvestmentTransactionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const D = Prisma.Decimal;
const LOT = "__OKANE_LOT__";

function money(value: Prisma.Decimal) {
  return value.toDecimalPlaces(2);
}

function nonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} cannot be negative.`);
  return new D(value);
}

function parseLotMeta(note: string | null | undefined) {
  if (!note) return null as { lotId?: string; allocations?: Array<{ lotId: string; quantity: string }> } | null;
  const start = note.indexOf(LOT);
  if (start < 0) return null;
  try {
    const raw = note.slice(start + LOT.length);
    const separator = raw.indexOf("}{");
    const json = separator >= 0 ? raw.slice(0, separator + 1) : raw;
    return JSON.parse(json) as { lotId?: string; allocations?: Array<{ lotId: string; quantity: string }> };
  } catch {
    return null;
  }
}

async function getOpenLots(tx: Prisma.TransactionClient, accountId: string, assetId: string) {
  const buys = await tx.investmentTransaction.findMany({
    where: { accountId, assetId, transactionType: InvestmentTransactionType.BUY },
    orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
  });
  const sells = await tx.investmentTransaction.findMany({
    where: { accountId, assetId, transactionType: InvestmentTransactionType.SELL },
    orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }],
  });

  const lots = buys.map((buy) => {
    const meta = parseLotMeta(buy.note);
    return { lotId: meta?.lotId ?? buy.id, transactionId: buy.id, quantity: buy.quantity, cost: buy.costBasisAmount, remaining: buy.quantity };
  });

  for (const sell of sells) {
    const allocations = parseLotMeta(sell.note)?.allocations ?? [];
    for (const allocation of allocations) {
      const lot = lots.find((item) => item.lotId === allocation.lotId);
      if (lot) lot.remaining = lot.remaining.minus(new D(allocation.quantity));
    }
  }
  return lots.filter((lot) => lot.remaining.gt(0));
}

export async function sellAllInvestmentAsset(input: {
  accountId: string;
  assetId: string;
  transactionDate: Date;
  unitPrice: number;
  fundingCashAccountId: string;
}) {
  const unitPrice = nonNegative(input.unitPrice, "Sell price");

  return prisma.$transaction(async (tx) => {
    const account = await tx.investmentAccount.findUnique({ where: { id: input.accountId }, include: { provider: true, currency: true, cashAccount: true } });
    if (!account || !account.isActive) throw new Error("Investment account not found or already closed.");
    const asset = await tx.investmentAsset.findUnique({ where: { id: input.assetId }, include: { currency: true } });
    if (!asset) throw new Error("Investment asset not found.");
    if (asset.currencyId !== account.currencyId) throw new Error("Investment account and asset currency must match.");

    const cash = await tx.investmentCashAccount.findUnique({ where: { id: input.fundingCashAccountId }, include: { account: true } });
    if (!cash || cash.account.providerId !== account.providerId || cash.account.currencyId !== account.currencyId) throw new Error("Settlement cash account must belong to the same investment account currency/provider.");

    const lots = await getOpenLots(tx, account.id, asset.id);
    if (!lots.length) throw new Error("No open quantity remains for this asset.");
    const holding = await tx.investmentHolding.findUnique({ where: { accountId_assetId: { accountId: account.id, assetId: asset.id } } });
    if (!holding || holding.quantity.lte(0)) throw new Error("No open holding remains for this asset.");

    let sellFeePct = 0;
    try {
      const parsed = account.note ? JSON.parse(account.note) as { sellFeePct?: number } : {};
      const candidate = Number(parsed.sellFeePct ?? 0);
      sellFeePct = Number.isFinite(candidate) && candidate >= 0 ? candidate : 0;
    } catch {
      sellFeePct = 0;
    }

    const totalOpen = lots.reduce((sum, lot) => sum.plus(lot.remaining), new D(0));
    if (totalOpen.gt(holding.quantity)) throw new Error("Open lot quantity exceeds holding quantity. Repair the lot ledger before using Sell All.");
    if (totalOpen.lt(holding.quantity)) throw new Error("Holding quantity has unallocated shares. Sell All requires a fully lot-tracked holding.");

    const created: Array<{ id: string; lotId: string; quantity: string; unitPrice: string; gross: string; fee: string; net: string; cost: string; realized: string }> = [];
    let totalNet = new D(0);
    let totalCost = new D(0);

    for (const lot of lots) {
      const quantity = lot.remaining;
      const gross = money(quantity.mul(unitPrice));
      const fee = money(gross.mul(sellFeePct).div(100));
      const net = money(gross.minus(fee));
      const cost = money(lot.cost.mul(quantity).div(lot.quantity));
      const realized = money(net.minus(cost));
      const transactionLotId = crypto.randomUUID();
      const transaction = await tx.investmentTransaction.create({
        data: {
          accountId: account.id,
          assetId: asset.id,
          holdingId: holding.id,
          transactionType: InvestmentTransactionType.SELL,
          transactionDate: input.transactionDate,
          quantity,
          unitPrice,
          grossAmount: gross,
          feeAmount: fee,
          taxAmount: new D(0),
          otherCharges: new D(0),
          totalCashAmount: gross,
          netCashAmount: net,
          costBasisAmount: cost,
          realizedGainLoss: realized,
          fundingCashAccountId: cash.id,
          currencyId: account.currencyId,
          note: `${LOT}${JSON.stringify({ lotId: transactionLotId, source: "SELL_ALL", allocations: [{ lotId: lot.lotId, quantity: quantity.toString() }] })}`,
        },
      });
      await tx.investmentCashMovement.create({ data: { cashAccountId: cash.id, movementType: InvestmentCashMovementType.SELL_SETTLEMENT, amount: net, movementDate: input.transactionDate, investmentTransactionId: transaction.id } });
      totalNet = totalNet.plus(net);
      totalCost = totalCost.plus(cost);
      created.push({ id: transaction.id, lotId: lot.lotId, quantity: quantity.toString(), unitPrice: unitPrice.toString(), gross: gross.toString(), fee: fee.toString(), net: net.toString(), cost: cost.toString(), realized: realized.toString() });
    }

    const updatedHolding = await tx.investmentHolding.update({ where: { id: holding.id }, data: { quantity: new D(0), costBasis: new D(0) } });
    await tx.investmentCashAccount.update({ where: { id: cash.id }, data: { balance: { increment: totalNet } } });

    return {
      accountId: account.id,
      assetId: asset.id,
      quantity: totalOpen.toString(),
      unitPrice: unitPrice.toString(),
      totalNetProceeds: money(totalNet).toString(),
      totalCostBasis: money(totalCost).toString(),
      realizedGainLoss: money(totalNet.minus(totalCost)).toString(),
      sellFeePct,
      transactions: created,
      holding: updatedHolding,
    };
  });
}
