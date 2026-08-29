import { NextResponse } from "next/server";
import { InvestmentAccountType, InvestmentAssetType, InvestmentTransactionType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addDefaultFeeRules, createInvestmentProvider } from "@/modules/investment/service";
import { createInvestmentTransactionV3, getInvestmentAccountLedger, importInvestmentWorkbook, refreshInvestmentStockPrices, setInvestmentCashBalance } from "@/modules/investment/service-v3";

const D = Prisma.Decimal;
function serialize<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function sellFeePctFromNote(note: string | null | undefined) {
  try {
    const parsed = note ? JSON.parse(note) as { sellFeePct?: number } : {};
    const pct = Number(parsed.sellFeePct ?? 0);
    return Number.isFinite(pct) && pct >= 0 ? pct : 0;
  } catch { return 0; }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const accountId = url.searchParams.get("accountId");
    if (!accountId) return NextResponse.json({ error: "accountId is required." }, { status: 400 });
    await refreshInvestmentStockPrices({ accountId, staleAfterMinutes: 15 });
    const ledger = await getInvestmentAccountLedger(accountId);
    const sellFeePct = sellFeePctFromNote(ledger.account.note);
    const sellFactor = new D(1).minus(new D(sellFeePct).div(100));
    const rows = ledger.rows.map((row) => {
      const remaining = new D(row.remainingQuantity);
      const currentPrice = row.currentPrice == null ? null : new D(row.currentPrice);
      const grossCurrentValue = currentPrice == null ? new D(0) : remaining.mul(currentPrice);
      const estimatedSellFee = grossCurrentValue.mul(sellFeePct).div(100);
      const netCurrentValue = grossCurrentValue.minus(estimatedSellFee);
      const remainingCost = Number(row.quantity) > 0 ? new D(row.totalCost).mul(remaining).div(new D(row.quantity)) : new D(0);
      const minimumSellPrice = Number(row.quantity) > 0 && sellFactor.gt(0)
        ? new D(row.totalCost).div(new D(row.quantity)).div(sellFactor)
        : new D(0);
      return {
        ...row,
        minimumSellPrice: minimumSellPrice.toDecimalPlaces(2).toString(),
        estimatedSellFee: estimatedSellFee.toDecimalPlaces(2).toString(),
        netCurrentValue: netCurrentValue.toDecimalPlaces(2).toString(),
        unrealizedGainLoss: netCurrentValue.minus(remainingCost).toDecimalPlaces(2).toString(),
      };
    });
    return NextResponse.json(serialize({ ...ledger, rows }));
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
      const buyFeePct = Number(body.buyFeePct || 0);
      const sellFeePct = Number(body.sellFeePct || 0);
      if (!Number.isFinite(buyFeePct) || buyFeePct < 0 || !Number.isFinite(sellFeePct) || sellFeePct < 0) return NextResponse.json({ error: "Trading fees cannot be negative." }, { status: 400 });
      const accountName = `${provider.name}${rdnBankName ? ` · RDN ${rdnBankName}` : ""}`;
      const account = await prisma.investmentAccount.create({ data: { providerId: provider.id, name: accountName, accountType: InvestmentAccountType.PORTFOLIO, currencyId: String(body.currencyId), accountNumberMasked: rdnAccountNumber || null, note: JSON.stringify({ rdnBankName, rdnAccountNumber, buyFeePct, sellFeePct }) } });
      const cashAccount = await prisma.investmentCashAccount.create({ data: { accountId: account.id } });
      return NextResponse.json(serialize({ account, cashAccount }));
    }

    if (action === "account.update") {
      const accountId = String(body.accountId || "");
      const account = await prisma.investmentAccount.findUnique({ where: { id: accountId }, include: { provider: true, transactions: { select: { id: true }, take: 1 }, holdings: { select: { quantity: true }, take: 1 } } });
      if (!account) return NextResponse.json({ error: "Investment account not found." }, { status: 404 });
      const currencyId = String(body.currencyId || account.currencyId);
      if (currencyId !== account.currencyId && (account.transactions.length || account.holdings.length)) return NextResponse.json({ error: "Currency cannot be changed after the account has transactions or holdings." }, { status: 400 });
      const providerName = String(body.providerName || account.provider.name).trim();
      if (!providerName) return NextResponse.json({ error: "Provider name is required." }, { status: 400 });
      const rdnBankName = String(body.rdnBankName || "").trim();
      const rdnAccountNumber = String(body.rdnAccountNumber || "").trim();
      const buyFeePct = Number(body.buyFeePct || 0);
      const sellFeePct = Number(body.sellFeePct || 0);
      if (!Number.isFinite(buyFeePct) || buyFeePct < 0 || !Number.isFinite(sellFeePct) || sellFeePct < 0) return NextResponse.json({ error: "Trading fees cannot be negative." }, { status: 400 });
      const updated = await prisma.$transaction(async tx => {
        const provider = await tx.investmentProvider.update({ where: { id: account.providerId }, data: { name: providerName, websiteUrl: body.websiteUrl ? String(body.websiteUrl).trim() : null } });
        return tx.investmentAccount.update({ where: { id: account.id }, data: { name: `${provider.name}${rdnBankName ? ` · RDN ${rdnBankName}` : ""}`, currencyId, accountNumberMasked: rdnAccountNumber || null, note: JSON.stringify({ rdnBankName, rdnAccountNumber, buyFeePct, sellFeePct }) } });
      });
      return NextResponse.json(serialize(updated));
    }

    if (action === "account.close") {
      const accountId = String(body.accountId || "");
      const account = await prisma.investmentAccount.findUnique({ where: { id: accountId } });
      if (!account) return NextResponse.json({ error: "Investment account not found." }, { status: 404 });
      const updated = await prisma.investmentAccount.update({ where: { id: accountId }, data: { isActive: false } });
      return NextResponse.json(serialize(updated));
    }

    if (action === "account.delete") {
      const accountId = String(body.accountId || "");
      const account = await prisma.investmentAccount.findUnique({ where: { id: accountId }, include: { cashAccount: true, transactions: { select: { id: true }, take: 1 }, holdings: { select: { quantity: true }, take: 1 } } });
      if (!account) return NextResponse.json({ error: "Investment account not found." }, { status: 404 });
      if (account.transactions.length || account.holdings.some(h => !h.quantity.isZero()) || !account.cashAccount?.balance.isZero()) return NextResponse.json({ error: "Account has historical data or a non-zero RDN balance. Use Close Account instead of Delete." }, { status: 400 });
      await prisma.investmentAccount.delete({ where: { id: accountId } });
      return NextResponse.json({ ok: true });
    }

    if (action === "asset.create") {
      const asset = await prisma.investmentAsset.create({ data: { symbol: body.symbol ? String(body.symbol).trim().toUpperCase() : null, name: String(body.name).trim(), assetType: String(body.assetType) as InvestmentAssetType, countryCode: body.countryCode ? String(body.countryCode).toUpperCase() : null, currencyId: String(body.currencyId), unitName: String(body.unitName || "share").trim() } });
      return NextResponse.json(serialize(asset));
    }

    if (action === "asset.resolve") {
      const accountId = String(body.accountId || "");
      const symbol = String(body.symbol || "").trim().toUpperCase();
      const assetType = String(body.assetType || "STOCK") as InvestmentAssetType;
      const currencyId = String(body.currencyId || "");
      if (!accountId || !symbol || !currencyId) return NextResponse.json({ error: "Account, asset symbol and currency are required." }, { status: 400 });
      const account = await prisma.investmentAccount.findUnique({ where: { id: accountId } });
      if (!account) return NextResponse.json({ error: "Investment account not found." }, { status: 404 });
      const existing = await prisma.investmentAsset.findFirst({ where: { symbol, currencyId } });
      if (existing) return NextResponse.json(serialize(existing));
      const asset = await prisma.investmentAsset.create({ data: { symbol, name: String(body.name || symbol).trim(), assetType, currencyId, unitName: String(body.unitName || (assetType === "STOCK" ? "share" : "unit")).trim() } });
      return NextResponse.json(serialize(asset));
    }

    if (action === "transaction.create") {
      const account = await prisma.investmentAccount.findUnique({ where: { id: String(body.accountId) }, include: { cashAccount: true } });
      if (!account || !account.isActive) return NextResponse.json({ error: "Investment account not found or already closed." }, { status: 400 });
      return NextResponse.json(serialize(await createInvestmentTransactionV3({ ...body, transactionType: String(body.transactionType) as "BUY" | "SELL", transactionDate: new Date(body.transactionDate), quantity: Number(body.quantity), unitPrice: Number(body.unitPrice), feeAmount: Number(body.feeAmount || 0), taxAmount: Number(body.taxAmount || 0), otherCharges: Number(body.otherCharges || 0), fundingCashAccountId: body.fundingCashAccountId || account.cashAccount?.id, sourceLotId: body.sourceLotId ? String(body.sourceLotId) : undefined })));
    }

    if (action === "transaction.delete") {
      const transactionId = String(body.transactionId || "");
      if (!transactionId) return NextResponse.json({ error: "transactionId is required." }, { status: 400 });
      const result = await prisma.$transaction(async tx => {
        const target = await tx.investmentTransaction.findUnique({ where: { id: transactionId }, include: { account: true, asset: true, holding: true, cashMovements: true } });
        if (!target) throw new Error("Investment transaction not found.");
        if (target.transactionType !== InvestmentTransactionType.BUY) throw new Error("Only BUY lot rows can be deleted from this ledger.");
        const marker = "__OKANE_LOT__";
        const note = target.note || "";
        const start = note.indexOf(marker);
        let lotId = target.id;
        if (start >= 0) {
          try {
            const raw = note.slice(start + marker.length);
            const end = raw.indexOf("}");
            const parsed = JSON.parse(end >= 0 ? raw.slice(0, end + 1) : raw) as { lotId?: string };
            if (parsed.lotId) lotId = parsed.lotId;
          } catch {}
        }
        const sells = await tx.investmentTransaction.findMany({ where: { accountId: target.accountId, assetId: target.assetId, transactionType: InvestmentTransactionType.SELL } });
        const linked = sells.some(s => (s.note || "").includes(`\"lotId\":\"${lotId}\"`));
        if (linked) throw new Error("This purchase lot has linked sales. Delete or reverse those sales first.");
        const holding = target.holdingId ? await tx.investmentHolding.findUnique({ where: { id: target.holdingId } }) : null;
        if (holding && holding.quantity.lt(target.quantity)) throw new Error("This purchase cannot be deleted because its quantity has already been consumed.");
        if (target.fundingCashAccountId) {
          const cash = await tx.investmentCashAccount.findUnique({ where: { id: target.fundingCashAccountId } });
          if (!cash) throw new Error("Investment cash account not found.");
          await tx.investmentCashAccount.update({ where: { id: cash.id }, data: { balance: { increment: target.totalCashAmount } } });
        } else if (target.fundingWalletId) {
          const wallet = await tx.wallet.findUnique({ where: { id: target.fundingWalletId } });
          if (!wallet) throw new Error("Funding wallet not found.");
          await tx.wallet.update({ where: { id: wallet.id }, data: { currentBalance: { increment: target.totalCashAmount } } });
        }
        if (holding) await tx.investmentHolding.update({ where: { id: holding.id }, data: { quantity: holding.quantity.minus(target.quantity), costBasis: holding.costBasis.minus(target.costBasisAmount) } });
        await tx.investmentCashMovement.deleteMany({ where: { investmentTransactionId: target.id } });
        await tx.investmentTransaction.delete({ where: { id: target.id } });
        return { id: target.id };
      });
      return NextResponse.json(serialize(result));
    }

    if (action === "cash.setBalance") return NextResponse.json(serialize(await setInvestmentCashBalance({ cashAccountId: String(body.cashAccountId), balance: Number(body.balance), date: new Date(body.date), note: body.note ? String(body.note) : undefined })));
    if (action === "market.refresh") return NextResponse.json(serialize(await refreshInvestmentStockPrices({ accountId: body.accountId ? String(body.accountId) : undefined, staleAfterMinutes: 0 })));
    return NextResponse.json({ error: "Unknown investment v2 action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Investment v2 operation failed." }, { status: 400 });
  }
}
