import crypto from "node:crypto";
import { InvestmentCashMovementType, InvestmentTransactionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const D = Prisma.Decimal;
const LOT = "__OKANE_LOT__";
const IMPORT = "__OKANE_IMPORT__";
const money = (v: Prisma.Decimal) => v.toDecimalPlaces(2);

function positive(v: number, label: string) { if (!Number.isFinite(v) || v <= 0) throw new Error(`${label} must be greater than zero.`); return new D(v); }
function nonNegative(v: number | undefined, label: string) { const n = v ?? 0; if (!Number.isFinite(n) || n < 0) throw new Error(`${label} cannot be negative.`); return new D(n); }
function meta(prefix: string, value: unknown) { return `${prefix}${JSON.stringify(value)}`; }
function readMeta<T>(value: string | null | undefined, prefix: string): T | null {
  if (!value) return null;
  const start = value.indexOf(prefix);
  if (start < 0) return null;
  try {
    const raw = value.slice(start + prefix.length);
    const separator = raw.indexOf("}{");
    return JSON.parse(separator >= 0 ? raw.slice(0, separator + 1) : raw) as T;
  } catch { return null; }
}

type LotMeta = { lotId: string; allocations?: Array<{ lotId: string; quantity: string }>; source?: string; sourceRow?: number; sourceHash?: string; sourceFile?: string };

type Funding =
  | { kind: "CASH"; cash: NonNullable<Awaited<ReturnType<typeof getCash>>> }
  | { kind: "WALLET"; wallet: NonNullable<Awaited<ReturnType<typeof getWallet>>> };

async function getCash(tx: Prisma.TransactionClient, id: string) { return tx.investmentCashAccount.findUnique({ where: { id }, include: { account: true } }); }
async function getWallet(tx: Prisma.TransactionClient, id: string) { return tx.wallet.findUnique({ where: { id } }); }

async function funding(tx: Prisma.TransactionClient, accountId: string, cashAccountId?: string, walletId?: string): Promise<Funding> {
  const account = await tx.investmentAccount.findUnique({ where: { id: accountId }, select: { providerId: true, currencyId: true } });
  if (!account) throw new Error("Investment account not found.");
  if (cashAccountId) {
    const cash = await getCash(tx, cashAccountId);
    if (!cash || cash.account.providerId !== account.providerId || cash.account.currencyId !== account.currencyId) throw new Error("Funding cash account must belong to the same provider and currency.");
    return { kind: "CASH", cash };
  }
  if (walletId) {
    const wallet = await getWallet(tx, walletId);
    if (!wallet || wallet.currencyId !== account.currencyId) throw new Error("Funding wallet currency must match the investment account.");
    return { kind: "WALLET", wallet };
  }
  throw new Error("Select a funding cash account or wallet.");
}

async function debit(tx: Prisma.TransactionClient, f: Funding, amount: Prisma.Decimal) {
  if (f.kind === "CASH") {
    if (f.cash.balance.lt(amount)) throw new Error(`Insufficient balance in ${f.cash.account.name}.`);
    await tx.investmentCashAccount.update({ where: { id: f.cash.id }, data: { balance: { decrement: amount } } });
  } else {
    if (f.wallet.currentBalance.lt(amount)) throw new Error(`Insufficient balance in ${f.wallet.name}.`);
    await tx.wallet.update({ where: { id: f.wallet.id }, data: { currentBalance: { decrement: amount } } });
  }
}
async function credit(tx: Prisma.TransactionClient, f: Funding, amount: Prisma.Decimal) {
  if (f.kind === "CASH") await tx.investmentCashAccount.update({ where: { id: f.cash.id }, data: { balance: { increment: amount } } });
  else await tx.wallet.update({ where: { id: f.wallet.id }, data: { currentBalance: { increment: amount } } });
}

async function openLots(tx: Prisma.TransactionClient, accountId: string, assetId: string) {
  const buys = await tx.investmentTransaction.findMany({ where: { accountId, assetId, transactionType: InvestmentTransactionType.BUY }, orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }] });
  const sells = await tx.investmentTransaction.findMany({ where: { accountId, assetId, transactionType: InvestmentTransactionType.SELL }, orderBy: [{ transactionDate: "asc" }, { createdAt: "asc" }] });
  const lots = buys.map((b) => { const m = readMeta<LotMeta>(b.note, LOT); return { id: m?.lotId ?? b.id, transactionId: b.id, date: b.transactionDate, quantity: b.quantity, unitPrice: b.unitPrice, cost: b.costBasisAmount, remaining: b.quantity }; });
  for (const s of sells) {
    const m = readMeta<LotMeta>(s.note, LOT);
    for (const a of m?.allocations ?? []) { const lot = lots.find((x) => x.id === a.lotId); if (lot) lot.remaining = lot.remaining.minus(new D(a.quantity)); }
  }
  return lots.filter((x) => x.remaining.gt(0));
}

async function allocate(tx: Prisma.TransactionClient, accountId: string, assetId: string, quantity: Prisma.Decimal, sourceLotId?: string) {
  const lots = await openLots(tx, accountId, assetId);
  if (sourceLotId) {
    const lot = lots.find((x) => x.id === sourceLotId);
    if (!lot || lot.remaining.lt(quantity)) throw new Error("Selected purchase lot does not have enough remaining quantity.");
    return [{ lotId: lot.id, quantity, cost: money(lot.cost.mul(quantity).div(lot.quantity)) }];
  }
  let remaining = quantity;
  const result: Array<{ lotId: string; quantity: Prisma.Decimal; cost: Prisma.Decimal }> = [];
  for (const lot of lots) {
    if (remaining.lte(0)) break;
    const take = remaining.lt(lot.remaining) ? remaining : lot.remaining;
    result.push({ lotId: lot.id, quantity: take, cost: money(lot.cost.mul(take).div(lot.quantity)) });
    remaining = remaining.minus(take);
  }
  if (remaining.gt(0)) throw new Error("Insufficient holding quantity.");
  return result;
}

export async function createInvestmentTransactionV3(input: {
  accountId: string; assetId: string; transactionType: "BUY" | "SELL"; transactionDate: Date; quantity: number; unitPrice: number;
  feeAmount?: number; taxAmount?: number; otherCharges?: number; fundingCashAccountId?: string; fundingWalletId?: string; sourceLotId?: string; note?: string;
}) {
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
    const f = await funding(tx, account.id, input.fundingCashAccountId, input.fundingWalletId);
    const holding = await tx.investmentHolding.findUnique({ where: { accountId_assetId: { accountId: account.id, assetId: asset.id } } });

    if (input.transactionType === "BUY") {
      const total = money(gross.plus(charges));
      await debit(tx, f, total);
      const h = holding ?? await tx.investmentHolding.create({ data: { accountId: account.id, assetId: asset.id } });
      const updated = await tx.investmentHolding.update({ where: { id: h.id }, data: { quantity: h.quantity.plus(quantity), costBasis: money(h.costBasis.plus(total)) } });
      const lotId = crypto.randomUUID();
      const t = await tx.investmentTransaction.create({ data: { accountId: account.id, assetId: asset.id, holdingId: updated.id, transactionType: InvestmentTransactionType.BUY, transactionDate: input.transactionDate, quantity, unitPrice, grossAmount: gross, feeAmount: fee, taxAmount: tax, otherCharges: other, totalCashAmount: total, netCashAmount: total.neg(), costBasisAmount: total, fundingCashAccountId: f.kind === "CASH" ? f.cash.id : null, fundingWalletId: f.kind === "WALLET" ? f.wallet.id : null, currencyId: account.currencyId, note: input.note || meta(LOT, { lotId, source: "MANUAL" }) } });
      if (f.kind === "CASH") await tx.investmentCashMovement.create({ data: { cashAccountId: f.cash.id, movementType: InvestmentCashMovementType.BUY_SETTLEMENT, amount: total, movementDate: input.transactionDate, investmentTransactionId: t.id } });
      return t;
    }

    if (!holding || holding.quantity.lt(quantity)) throw new Error("Insufficient holding quantity.");
    const allocations = await allocate(tx, account.id, asset.id, quantity, input.sourceLotId);
    const soldCost = money(allocations.reduce((sum, a) => sum.plus(a.cost), new D(0)));
    const net = money(gross.minus(charges));
    if (net.lt(0)) throw new Error("Charges cannot exceed gross sale proceeds.");
    await credit(tx, f, net);
    const updated = await tx.investmentHolding.update({ where: { id: holding.id }, data: { quantity: holding.quantity.minus(quantity), costBasis: money(holding.costBasis.minus(soldCost)) } });
    const realized = money(net.minus(soldCost));
    const t = await tx.investmentTransaction.create({ data: { accountId: account.id, assetId: asset.id, holdingId: updated.id, transactionType: InvestmentTransactionType.SELL, transactionDate: input.transactionDate, quantity, unitPrice, grossAmount: gross, feeAmount: fee, taxAmount: tax, otherCharges: other, totalCashAmount: gross, netCashAmount: net, costBasisAmount: soldCost, realizedGainLoss: realized, fundingCashAccountId: f.kind === "CASH" ? f.cash.id : null, fundingWalletId: f.kind === "WALLET" ? f.wallet.id : null, currencyId: account.currencyId, note: input.note || meta(LOT, { lotId: crypto.randomUUID(), source: "MANUAL", allocations: allocations.map((a) => ({ lotId: a.lotId, quantity: a.quantity.toString() })) }) } });
    if (f.kind === "CASH") await tx.investmentCashMovement.create({ data: { cashAccountId: f.cash.id, movementType: InvestmentCashMovementType.SELL_SETTLEMENT, amount: net, movementDate: input.transactionDate, investmentTransactionId: t.id } });
    return t;
  });
}

export async function getInvestmentAccountLedger(accountId: string) {
  const account = await prisma.investmentAccount.findUnique({ where: { id: accountId }, include: { provider: true, currency: true, cashAccount: true } });
  if (!account) throw new Error("Investment account not found.");
  const transactions = await prisma.investmentTransaction.findMany({ where: { accountId }, include: { asset: { include: { currency: true } }, holding: true, currency: true }, orderBy: [{ transactionDate: "desc" }, { createdAt: "desc" }] });
  const buys = transactions.filter((t) => t.transactionType === InvestmentTransactionType.BUY);
  const sells = transactions.filter((t) => t.transactionType === InvestmentTransactionType.SELL);
  const saleMap = new Map<string, Array<{ id: string; date: Date; quantity: Prisma.Decimal; price: Prisma.Decimal; proceeds: Prisma.Decimal; realized: Prisma.Decimal }>>();
  for (const s of sells) { const m = readMeta<LotMeta>(s.note, LOT); for (const a of m?.allocations ?? []) { const q = new D(a.quantity); const ratio = s.quantity.isZero() ? new D(0) : q.div(s.quantity); const list = saleMap.get(a.lotId) ?? []; list.push({ id: s.id, date: s.transactionDate, quantity: q, price: s.unitPrice, proceeds: money(s.netCashAmount.mul(ratio)), realized: money((s.realizedGainLoss ?? new D(0)).mul(ratio)) }); saleMap.set(a.lotId, list); } }
  const holdings = await prisma.investmentHolding.findMany({ where: { accountId } });
  const priceMap = new Map(holdings.map((h) => [h.assetId, { price: h.currentPrice, asOf: h.priceAsOf }]));
  const rows = buys.map((b) => {
    const m = readMeta<LotMeta>(b.note, LOT); const lotId = m?.lotId ?? b.id; const sales = saleMap.get(lotId) ?? [];
    const sold = sales.reduce((s, x) => s.plus(x.quantity), new D(0)); const remaining = b.quantity.minus(sold); const p = priceMap.get(b.assetId); const currentValue = p?.price ? remaining.mul(p.price) : new D(0); const remainingCost = b.quantity.isZero() ? new D(0) : b.costBasisAmount.mul(remaining).div(b.quantity);
    const minSell = b.quantity.isZero() ? new D(0) : b.costBasisAmount.div(b.quantity).div(new D(99.71).div(100));
    return { id: b.id, lotId, transactionDate: b.transactionDate, asset: b.asset, quantity: b.quantity, soldQuantity: sold, remainingQuantity: remaining, unitPrice: b.unitPrice, totalCost: b.costBasisAmount, minimumSellPrice: money(minSell), currentPrice: p?.price ?? null, priceAsOf: p?.asOf ?? null, currentValue: money(currentValue), unrealizedGainLoss: money(currentValue.minus(remainingCost)), sales };
  });
  return { account, rows, transactions, summary: { openLots: rows.filter((r) => r.remainingQuantity.gt(0)).length, openQuantity: rows.reduce((s, r) => s.plus(r.remainingQuantity), new D(0)), realizedGainLoss: sells.reduce((s, t) => s.plus(t.realizedGainLoss ?? 0), new D(0)) } };
}

export async function setInvestmentCashBalance(input: { cashAccountId: string; balance: number; date: Date; note?: string }) {
  if (!Number.isFinite(input.balance) || input.balance < 0) throw new Error("Cash balance cannot be negative.");
  const target = new D(input.balance);
  return prisma.$transaction(async (tx) => {
    const cash = await tx.investmentCashAccount.findUnique({ where: { id: input.cashAccountId } });
    if (!cash) throw new Error("Investment cash account not found.");
    const delta = target.minus(cash.balance);
    if (!delta.isZero()) await tx.investmentCashMovement.create({ data: { cashAccountId: cash.id, movementType: InvestmentCashMovementType.ADJUSTMENT, amount: delta.abs(), movementDate: input.date, note: input.note || `Balance adjustment ${delta.gte(0) ? "+" : "-"}${delta.abs().toString()}` } });
    return tx.investmentCashAccount.update({ where: { id: cash.id }, data: { balance: target } });
  });
}

async function quote(symbol: string) {
  const ticker = `${symbol.toUpperCase().replace(/[^A-Z0-9.-]/g, "")}.JK`;
  const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d&includePrePost=false`, { headers: { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) throw new Error(`${symbol}: market data ${response.status}`);
  const body = await response.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; regularMarketTime?: number } }> } };
  const q = body.chart?.result?.[0]?.meta;
  if (!q?.regularMarketPrice || !Number.isFinite(q.regularMarketPrice)) throw new Error(`${symbol}: no price returned`);
  return { price: new D(q.regularMarketPrice), asOf: q.regularMarketTime ? new Date(q.regularMarketTime * 1000) : new Date() };
}

export async function refreshInvestmentStockPrices(input?: { accountId?: string; staleAfterMinutes?: number }) {
  const stale = input?.staleAfterMinutes ?? 15; const cutoff = new Date(Date.now() - stale * 60_000);
  const holdings = await prisma.investmentHolding.findMany({ where: { quantity: { gt: 0 }, ...(input?.accountId ? { accountId: input.accountId } : {}), asset: { assetType: "STOCK", symbol: { not: null } } }, include: { asset: true } });
  const symbols = [...new Set(holdings.filter((h) => !h.priceAsOf || h.priceAsOf < cutoff).map((h) => h.asset.symbol).filter((s): s is string => Boolean(s)))];
  const updated: Array<{ symbol: string; price: string; asOf: Date }> = []; const errors: Array<{ symbol: string; error: string }> = [];
  for (const stock of symbols) { try { const q = await quote(stock); const targets = holdings.filter((h) => h.asset.symbol === stock); await prisma.$transaction(targets.map((h) => prisma.investmentHolding.update({ where: { id: h.id }, data: { currentPrice: q.price, priceAsOf: q.asOf } }))); updated.push({ symbol: stock, price: q.price.toString(), asOf: q.asOf }); } catch (e) { errors.push({ symbol: stock, error: e instanceof Error ? e.message : "Unable to refresh price" }); } }
  return { updated, errors, source: "Yahoo Finance chart endpoint", staleAfterMinutes: stale };
}

export async function importInvestmentWorkbook(input: { accountId: string; buffer: Buffer; fileName: string }) {
  const xlsx = await (Function("return import('xlsx')")() as Promise<any>);
  const workbook = xlsx.read(input.buffer, { type: "buffer", cellDates: true });
  const sheet = workbook.Sheets["stocks dtl"];
  if (!sheet) throw new Error('Sheet "stocks dtl" was not found.');
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
  const hash = crypto.createHash("sha256").update(input.buffer).digest("hex");
  const existing = await prisma.investmentTransaction.findMany({ where: { accountId: input.accountId, status: "IMPORTED" }, select: { note: true } });
  const keys = new Set(existing.map((r) => { const m = readMeta<{ sourceHash?: string; sourceRow?: number }>(r.note, LOT); return m ? `${m.sourceHash}:${m.sourceRow}` : ""; }));
  const account = await prisma.investmentAccount.findUnique({ where: { id: input.accountId }, select: { currencyId: true } });
  if (!account) throw new Error("Investment account not found.");
  let imported = 0; let skipped = 0; const warnings: string[] = [];
  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]; const rowNo = i + 2; const date = row["TGL BELI"]; const symbol = String(row["STOCKS"] ?? "").trim().toUpperCase(); const lots = Number(row["LOT"] ?? 0); const buyPrice = Number(row["BUY"] ?? 0); const gross = Number(row["BUY PRICE"] ?? 0); const fee = Number(row["FEE"] ?? 0); const total = Number(row["TOTAL BUY"] ?? 0); const sell = Number(row["SELL"] ?? 0); const sellDate = row["TGL JUAL"]; const sellFee = Number(row["FEE_1"] ?? 0);
      if (!(date instanceof Date) || !symbol || !Number.isFinite(lots) || lots <= 0 || !Number.isFinite(buyPrice) || buyPrice <= 0) { if (symbol || date || lots) warnings.push(`Row ${rowNo} skipped: invalid date/symbol/lot/buy price.`); skipped += 1; continue; }
      const key = `${hash}:${rowNo}`; if (keys.has(key)) { skipped += 1; continue; }
      let asset = await tx.investmentAsset.findFirst({ where: { symbol, currencyId: account.currencyId, isActive: true } });
      if (!asset) asset = await tx.investmentAsset.create({ data: { symbol, name: symbol, assetType: "STOCK", countryCode: "ID", currencyId: account.currencyId, unitName: "share" } });
      const quantity = new D(lots).mul(100); const grossAmount = Number.isFinite(gross) && gross > 0 ? new D(gross) : quantity.mul(buyPrice); const buyFee = Number.isFinite(fee) && fee >= 0 ? new D(fee) : new D(0); const cost = Number.isFinite(total) && total > 0 ? new D(total) : money(grossAmount.plus(buyFee));
      const lotId = crypto.randomUUID(); const importInfo = { source: "IMPORT", sourceHash: hash, sourceRow: rowNo, sourceFile: input.fileName }; const lotNote = { lotId, ...importInfo };
      const current = await tx.investmentHolding.findUnique({ where: { accountId_assetId: { accountId: input.accountId, assetId: asset.id } } }); const nextQty = (current?.quantity ?? new D(0)).plus(quantity); const nextCost = money((current?.costBasis ?? new D(0)).plus(cost));
      const holding = current ? await tx.investmentHolding.update({ where: { id: current.id }, data: { quantity: nextQty, costBasis: nextCost } }) : await tx.investmentHolding.create({ data: { accountId: input.accountId, assetId: asset.id, quantity, costBasis: cost } });
      await tx.investmentTransaction.create({ data: { accountId: input.accountId, assetId: asset.id, holdingId: holding.id, transactionType: InvestmentTransactionType.BUY, transactionDate: date, quantity, unitPrice: buyPrice, grossAmount, feeAmount: buyFee, taxAmount: 0, otherCharges: money(cost.minus(grossAmount).minus(buyFee)), totalCashAmount: cost, netCashAmount: cost.neg(), costBasisAmount: cost, currencyId: account.currencyId, note: meta(LOT, lotNote), status: "IMPORTED" } });
      if (sellDate instanceof Date && Number.isFinite(sell) && sell > 0) {
        const grossSell = quantity.mul(sell); const actualSellFee = Number.isFinite(sellFee) && sellFee > 0 ? new D(sellFee) : money(grossSell.mul(0.0029)); const netSell = money(grossSell.minus(actualSellFee)); const realized = money(netSell.minus(cost));
        await tx.investmentTransaction.create({ data: { accountId: input.accountId, assetId: asset.id, holdingId: holding.id, transactionType: InvestmentTransactionType.SELL, transactionDate: sellDate, quantity, unitPrice: sell, grossAmount: grossSell, feeAmount: actualSellFee, taxAmount: 0, otherCharges: 0, totalCashAmount: grossSell, netCashAmount: netSell, costBasisAmount: cost, realizedGainLoss: realized, currencyId: account.currencyId, note: meta(LOT, { lotId: crypto.randomUUID(), ...importInfo, allocations: [{ lotId, quantity: quantity.toString() }] }), status: "IMPORTED" } });
        await tx.investmentHolding.update({ where: { id: holding.id }, data: { quantity: nextQty.minus(quantity), costBasis: money(nextCost.minus(cost)) } });
      }
      imported += 1;
    }
  });
  return { imported, skipped, warnings, fileName: input.fileName, fileHash: hash };
}
