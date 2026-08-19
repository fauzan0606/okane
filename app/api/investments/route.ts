import { NextResponse } from "next/server";
import { InvestmentAccountType, InvestmentAssetType, InvestmentTransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDefaultFeeRules, calculateBreakEvenPrice, calculateInvestmentCosts, createCashDeposit, createCashWithdrawal, createInvestmentAccount, createInvestmentAsset, createInvestmentProvider, createInvestmentTransaction, getInvestmentOverview, recordInvestmentIncome, updateHoldingPrice } from "@/modules/investment/service";

function serialize<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

export async function GET() {
  try { return NextResponse.json(serialize(await getInvestmentOverview())); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load investments." }, { status: 500 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || "");
    if (action === "provider.create") { const provider = await createInvestmentProvider(body); await addDefaultFeeRules(provider.id); return NextResponse.json(serialize(provider)); }
    if (action === "account.create") return NextResponse.json(serialize(await createInvestmentAccount({ ...body, accountType: body.accountType as InvestmentAccountType })));
    if (action === "asset.create") return NextResponse.json(serialize(await createInvestmentAsset({ ...body, assetType: body.assetType as InvestmentAssetType })));
    if (action === "cash.deposit") return NextResponse.json(serialize(await createCashDeposit({ cashAccountId: body.cashAccountId, amount: Number(body.amount), date: new Date(body.date), sourceWalletId: body.sourceWalletId || undefined, note: body.note })));
    if (action === "cash.withdraw") return NextResponse.json(serialize(await createCashWithdrawal({ cashAccountId: body.cashAccountId, amount: Number(body.amount), date: new Date(body.date), destinationWalletId: body.destinationWalletId || undefined, note: body.note })));
    if (action === "transaction.create") return NextResponse.json(serialize(await createInvestmentTransaction({ ...body, transactionType: body.transactionType as InvestmentTransactionType, transactionDate: new Date(body.transactionDate), quantity: Number(body.quantity), unitPrice: Number(body.unitPrice), feeAmount: Number(body.feeAmount || 0), taxAmount: Number(body.taxAmount || 0), otherCharges: Number(body.otherCharges || 0) })));
    if (action === "income.create") return NextResponse.json(serialize(await recordInvestmentIncome({ accountId: body.accountId, assetId: body.assetId, type: body.type as InvestmentTransactionType, amount: Number(body.amount), date: new Date(body.date), destinationCashAccountId: body.destinationCashAccountId || undefined, destinationWalletId: body.destinationWalletId || undefined, note: body.note })));
    if (action === "holding.price") return NextResponse.json(serialize(await updateHoldingPrice({ holdingId: body.holdingId, price: Number(body.price), date: new Date(body.date) })));
    if (action === "cost.calculate") return NextResponse.json(serialize(await calculateInvestmentCosts({ providerId: body.providerId, assetType: body.assetType as InvestmentAssetType, transactionType: body.transactionType as InvestmentTransactionType, grossAmount: Number(body.grossAmount), date: new Date(body.date), feeRateOverride: body.feeRateOverride == null ? undefined : Number(body.feeRateOverride), taxRateOverride: body.taxRateOverride == null ? undefined : Number(body.taxRateOverride), fixedFeeOverride: body.fixedFeeOverride == null ? undefined : Number(body.fixedFeeOverride) })));
    if (action === "break-even") return NextResponse.json({ price: calculateBreakEvenPrice(Number(body.quantity), Number(body.acquisitionCost), Number(body.sellFeeRatePct || 0), Number(body.sellTaxRatePct || 0), Number(body.sellFixedFee || 0), Number(body.otherSellCosts || 0)).toString() });
    return NextResponse.json({ error: "Unknown investment action." }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Investment operation failed." }, { status: 400 }); }
}
