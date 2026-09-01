import { NextResponse } from "next/server";
import { InvestmentAccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sellAllInvestmentAsset } from "@/modules/investment/service-v4";

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");

    if (action === "account.create") {
      const providerName = String(body.providerName || "").trim();
      const countryCode = String(body.countryCode || "ID").trim().toUpperCase();
      const currencyId = String(body.currencyId || "");
      const rdnBankName = String(body.rdnBankName || "").trim();
      const rdnAccountNumber = String(body.rdnAccountNumber || "").trim();
      const buyFeePct = Number(body.buyFeePct || 0);
      const sellFeePct = Number(body.sellFeePct || 0);
      if (!providerName || !currencyId) return NextResponse.json({ error: "Provider name and currency are required." }, { status: 400 });
      if (!Number.isFinite(buyFeePct) || buyFeePct < 0 || !Number.isFinite(sellFeePct) || sellFeePct < 0) return NextResponse.json({ error: "Trading fees cannot be negative." }, { status: 400 });

      const result = await prisma.$transaction(async (tx) => {
        const provider = await tx.investmentProvider.upsert({
          where: { name_countryCode: { name: providerName, countryCode } },
          update: { websiteUrl: body.websiteUrl ? String(body.websiteUrl).trim() : undefined, isActive: true },
          create: { name: providerName, countryCode, websiteUrl: body.websiteUrl ? String(body.websiteUrl).trim() : null },
        });
        const account = await tx.investmentAccount.create({
          data: {
            providerId: provider.id,
            name: `${provider.name}${rdnBankName ? ` · RDN ${rdnBankName}` : ""}`,
            accountType: InvestmentAccountType.PORTFOLIO,
            currencyId,
            accountNumberMasked: rdnAccountNumber || null,
            note: JSON.stringify({ rdnBankName, rdnAccountNumber, buyFeePct, sellFeePct }),
          },
        });
        const cashAccount = await tx.investmentCashAccount.create({ data: { accountId: account.id } });
        return { account, cashAccount };
      });
      return NextResponse.json(serialize(result));
    }

    if (action === "account.update") {
      const accountId = String(body.accountId || "");
      const current = await txFindAccount(accountId);
      if (!current) return NextResponse.json({ error: "Investment account not found." }, { status: 404 });
      const providerName = String(body.providerName || current.provider.name).trim();
      const currencyId = String(body.currencyId || current.currencyId);
      const rdnBankName = String(body.rdnBankName || "").trim();
      const rdnAccountNumber = String(body.rdnAccountNumber || "").trim();
      const buyFeePct = Number(body.buyFeePct || 0);
      const sellFeePct = Number(body.sellFeePct || 0);
      if (!Number.isFinite(buyFeePct) || buyFeePct < 0 || !Number.isFinite(sellFeePct) || sellFeePct < 0) return NextResponse.json({ error: "Trading fees cannot be negative." }, { status: 400 });
      if (currencyId !== current.currencyId && (current.transactions.length || current.holdings.length)) return NextResponse.json({ error: "Currency cannot be changed after transactions or holdings exist." }, { status: 400 });

      const updated = await prisma.$transaction(async (tx) => {
        let provider = current.provider;
        if (provider.name !== providerName) {
          provider = await tx.investmentProvider.findFirst({ where: { name: providerName, countryCode: provider.countryCode } }) ?? await tx.investmentProvider.create({ data: { name: providerName, countryCode: provider.countryCode, websiteUrl: body.websiteUrl ? String(body.websiteUrl).trim() : null } });
        } else {
          provider = await tx.investmentProvider.update({ where: { id: provider.id }, data: { websiteUrl: body.websiteUrl ? String(body.websiteUrl).trim() : provider.websiteUrl, isActive: true } });
        }
        return tx.investmentAccount.update({ where: { id: accountId }, data: { providerId: provider.id, name: `${provider.name}${rdnBankName ? ` · RDN ${rdnBankName}` : ""}`, currencyId, accountNumberMasked: rdnAccountNumber || null, note: JSON.stringify({ rdnBankName, rdnAccountNumber, buyFeePct, sellFeePct }) } });
      });
      return NextResponse.json(serialize(updated));
    }

    if (action === "account.close") {
      const accountId = String(body.accountId || "");
      const account = await txFindAccount(accountId);
      if (!account) return NextResponse.json({ error: "Investment account not found." }, { status: 404 });
      if (account.cashAccount?.balance.gt(0) || account.holdings.some((h) => h.quantity.gt(0))) return NextResponse.json({ error: "Cannot close an account with positive RDN balance or open holdings." }, { status: 400 });
      const updated = await prisma.investmentAccount.update({ where: { id: accountId }, data: { isActive: false } });
      return NextResponse.json(serialize(updated));
    }

    if (action === "account.delete") {
      const accountId = String(body.accountId || "");
      const account = await txFindAccount(accountId);
      if (!account) return NextResponse.json({ error: "Investment account not found." }, { status: 404 });
      if (account.transactions.length || account.holdings.some((h) => !h.quantity.isZero()) || !account.cashAccount?.balance.isZero()) return NextResponse.json({ error: "Account contains history, open holdings or non-zero RDN balance. Use Close Account instead." }, { status: 400 });
      await prisma.investmentAccount.delete({ where: { id: accountId } });
      return NextResponse.json({ ok: true });
    }

    if (action === "transaction.sellAll") {
      const accountId = String(body.accountId || "");
      const assetId = String(body.assetId || "");
      const fundingCashAccountId = String(body.fundingCashAccountId || "");
      const unitPrice = Number(body.unitPrice);
      const transactionDate = new Date(String(body.transactionDate || new Date().toISOString()));
      if (!accountId || !assetId || !fundingCashAccountId) return NextResponse.json({ error: "Account, asset and settlement RDN are required." }, { status: 400 });
      if (!Number.isFinite(unitPrice) || unitPrice < 0) return NextResponse.json({ error: "Sell price cannot be negative." }, { status: 400 });
      if (Number.isNaN(transactionDate.getTime())) return NextResponse.json({ error: "Transaction date is invalid." }, { status: 400 });
      return NextResponse.json(serialize(await sellAllInvestmentAsset({ accountId, assetId, transactionDate, unitPrice, fundingCashAccountId })));
    }

    return NextResponse.json({ error: "Unknown investment v4 action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Investment operation failed." }, { status: 400 });
  }
}

async function txFindAccount(accountId: string) {
  return prisma.investmentAccount.findUnique({
    where: { id: accountId },
    include: {
      provider: true,
      transactions: { select: { id: true }, take: 1 },
      holdings: { select: { quantity: true }, take: 1000 },
      cashAccount: true,
      currency: true,
    },
  });
}
