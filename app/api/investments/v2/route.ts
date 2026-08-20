import { NextResponse } from "next/server";
import { InvestmentAccountType, InvestmentAssetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDefaultFeeRules, createInvestmentProvider } from "@/modules/investment/service";
import { createInvestmentTransactionV3, getInvestmentAccountLedger, importInvestmentWorkbook, refreshInvestmentStockPrices, setInvestmentCashBalance } from "@/modules/investment/service-v3";

function serialize<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");
    if (!accountId) return NextResponse.json({ error: "accountId is required." }, { status: 400 });
    await refreshInvestmentStockPrices({ accountId, staleAfterMinutes: 15 });
    return NextResponse.json(serialize(await getInvestmentAccountLedger(accountId)));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load investment account." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const action = String(form.get("action") || "");
      if (action !== "import.excel") return NextResponse.json({ error: "Unknown investment upload action." }, { status: 400 });
      const accountId = String(form.get("accountId") || "");
      const file = form.get("file");
      if (!accountId || !(file instanceof File)) return NextResponse.json({ error: "Account and Excel file are required." }, { status: 400 });
      return NextResponse.json(serialize(await importInvestmentWorkbook({ accountId, buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name })));
    }

    const body = await request.json();
    const action = String(body.action || "");

    if (action === "account.create") {
      const provider = await createInvestmentProvider({ name: String(body.providerName || ""), countryCode: String(body.countryCode || "ID"), websiteUrl: body.websiteUrl ? String(body.websiteUrl) : undefined });
      await addDefaultFeeRules(provider.id);
      const rdnBankName = String(body.rdnBankName || "").trim();
      const rdnAccountNumber = String(body.rdnAccountNumber || "").trim();
      const accountName = `${provider.name}${rdnBankName ? ` · RDN ${rdnBankName}` : ""}`;
      const account = await prisma.investmentAccount.create({ data: { providerId: provider.id, name: accountName, accountType: InvestmentAccountType.PORTFOLIO, currencyId: String(body.currencyId), accountNumberMasked: rdnAccountNumber || null, note: JSON.stringify({ rdnBankName, rdnAccountNumber }) } });
      const cashAccount = await prisma.investmentCashAccount.create({ data: { accountId: account.id } });
      return NextResponse.json(serialize({ account, cashAccount }));
    }

    if (action === "asset.create") {
      const asset = await prisma.investmentAsset.create({ data: { symbol: body.symbol ? String(body.symbol).trim().toUpperCase() : null, name: String(body.name).trim(), assetType: String(body.assetType) as InvestmentAssetType, countryCode: body.countryCode ? String(body.countryCode).toUpperCase() : null, currencyId: String(body.currencyId), unitName: String(body.unitName || "share").trim() } });
      return NextResponse.json(serialize(asset));
    }

    if (action === "transaction.create") {
      return NextResponse.json(serialize(await createInvestmentTransactionV3({ ...body, transactionType: String(body.transactionType) as "BUY" | "SELL", transactionDate: new Date(body.transactionDate), quantity: Number(body.quantity), unitPrice: Number(body.unitPrice), feeAmount: Number(body.feeAmount || 0), taxAmount: Number(body.taxAmount || 0), otherCharges: Number(body.otherCharges || 0), sourceLotId: body.sourceLotId ? String(body.sourceLotId) : undefined })));
    }

    if (action === "cash.setBalance") return NextResponse.json(serialize(await setInvestmentCashBalance({ cashAccountId: String(body.cashAccountId), balance: Number(body.balance), date: new Date(body.date), note: body.note ? String(body.note) : undefined })));
    if (action === "market.refresh") return NextResponse.json(serialize(await refreshInvestmentStockPrices({ accountId: body.accountId ? String(body.accountId) : undefined, staleAfterMinutes: 0 })));
    return NextResponse.json({ error: "Unknown investment v2 action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Investment v2 operation failed." }, { status: 400 });
  }
}
