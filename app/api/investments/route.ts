import { NextResponse } from "next/server";
import { InvestmentAccountType, InvestmentAssetType, InvestmentTransactionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshIndoPremierFeeRules } from "@/modules/investment/fee-rules";
import { createInvestmentTransactionV2 } from "@/modules/investment/service-v2";
import { addDefaultFeeRules, calculateBreakEvenPrice, calculateInvestmentCosts, createCashDeposit, createCashWithdrawal, createInvestmentAccount, createInvestmentAsset, createInvestmentProvider, getInvestmentOverview, recordInvestmentIncome, updateHoldingPrice } from "@/modules/investment/service";

function serialize<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

export async function GET() {
  try {
    const overview = await getInvestmentOverview();
    const byCurrency = new Map<string, { value: Prisma.Decimal; cost: Prisma.Decimal; cash: Prisma.Decimal }>();
    for (const h of overview.holdings) { const code = h.asset.currency.code; const row = byCurrency.get(code) ?? { value: new Prisma.Decimal(0), cost: new Prisma.Decimal(0), cash: new Prisma.Decimal(0) }; row.value = row.value.plus(h.marketValue); row.cost = row.cost.plus(h.costBasis); byCurrency.set(code, row); }
    for (const c of overview.cashAccounts) { const code = c.account.currency.code; const row = byCurrency.get(code) ?? { value: new Prisma.Decimal(0), cost: new Prisma.Decimal(0), cash: new Prisma.Decimal(0) }; row.cash = row.cash.plus(c.balance); byCurrency.set(code, row); }
    const currencyRows = [...byCurrency.entries()].map(([code, row]) => ({ code, invested: row.value, costBasis: row.cost, cash: row.cash, total: row.value.plus(row.cash), unrealized: row.value.minus(row.cost) }));
    const primary = currencyRows.find(r => r.code === "IDR") ?? currencyRows[0] ?? { code: "IDR", invested: new Prisma.Decimal(0), costBasis: new Prisma.Decimal(0), cash: new Prisma.Decimal(0), total: new Prisma.Decimal(0), unrealized: new Prisma.Decimal(0) };
    const safeSummary = { totalValue: primary.invested, totalCost: primary.costBasis, totalCash: primary.cash, totalInvestmentValue: primary.total, unrealized: primary.unrealized, returnPct: primary.costBasis.isZero() ? new Prisma.Decimal(0) : primary.unrealized.div(primary.costBasis).mul(100), primaryCurrency: primary.code, byCurrency: currencyRows };
    return NextResponse.json(serialize({ ...overview, summary: safeSummary }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load investments." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || "");
    if (action === "provider.create") { const provider = await createInvestmentProvider(body); await addDefaultFeeRules(provider.id); return NextResponse.json(serialize(provider)); }
    if (action === "fee.refresh") return NextResponse.json(serialize(await refreshIndoPremierFeeRules(body.providerId, new Date(body.effectiveFrom || Date.now()))));
    if (action === "account.create") return NextResponse.json(serialize(await createInvestmentAccount({ ...body, accountType: body.accountType as InvestmentAccountType })));
    if (action === "asset.create") return NextResponse.json(serialize(await createInvestmentAsset({ ...body, assetType: body.assetType as InvestmentAssetType })));
    if (action === "cash.deposit") return NextResponse.json(serialize(await createCashDeposit({ cashAccountId: body.cashAccountId, amount: Number(body.amount), date: new Date(body.date), sourceWalletId: body.sourceWalletId || undefined, note: body.note })));
    if (action === "cash.withdraw") return NextResponse.json(serialize(await createCashWithdrawal({ cashAccountId: body.cashAccountId, amount: Number(body.amount), date: new Date(body.date), destinationWalletId: body.destinationWalletId || undefined, note: body.note })));
    if (action === "transaction.create") return NextResponse.json(serialize(await createInvestmentTransactionV2({ ...body, transactionType: body.transactionType as InvestmentTransactionType, transactionDate: new Date(body.transactionDate), quantity: Number(body.quantity), unitPrice: Number(body.unitPrice), feeAmount: Number(body.feeAmount || 0), taxAmount: Number(body.taxAmount || 0), otherCharges: Number(body.otherCharges || 0) })));
    if (action === "income.create") return NextResponse.json(serialize(await recordInvestmentIncome({ accountId: body.accountId, assetId: body.assetId, type: body.type as InvestmentTransactionType, amount: Number(body.amount), date: new Date(body.date), destinationCashAccountId: body.destinationCashAccountId || undefined, destinationWalletId: body.destinationWalletId || undefined, note: body.note })));
    if (action === "holding.price") return NextResponse.json(serialize(await updateHoldingPrice({ holdingId: body.holdingId, price: Number(body.price), date: new Date(body.date) })));
    if (action === "cost.calculate") return NextResponse.json(serialize(await calculateInvestmentCosts({ providerId: body.providerId, assetType: body.assetType as InvestmentAssetType, transactionType: body.transactionType as InvestmentTransactionType, grossAmount: Number(body.grossAmount), date: new Date(body.date), feeRateOverride: body.feeRateOverride == null ? undefined : Number(body.feeRateOverride), taxRateOverride: body.taxRateOverride == null ? undefined : Number(body.taxRateOverride), fixedFeeOverride: body.fixedFeeOverride == null ? undefined : Number(body.fixedFeeOverride) })));
    if (action === "break-even") return NextResponse.json({ price: calculateBreakEvenPrice(Number(body.quantity), Number(body.acquisitionCost), Number(body.sellFeeRatePct || 0), Number(body.sellTaxRatePct || 0), Number(body.sellFixedFee || 0), Number(body.otherSellCosts || 0)).toString() });
    return NextResponse.json({ error: "Unknown investment action." }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Investment operation failed." }, { status: 400 }); }
}
