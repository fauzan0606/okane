import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { sellAllInvestmentAsset } from "@/modules/investment/service-v4";

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      action?: string;
      accountId?: string;
      assetId?: string;
      transactionDate?: string;
      unitPrice?: number;
      fundingCashAccountId?: string;
    };

    if (body.action !== "transaction.sellAll") {
      return NextResponse.json({ error: "Unknown investment v4 action." }, { status: 400 });
    }

    const accountId = String(body.accountId || "");
    const assetId = String(body.assetId || "");
    const fundingCashAccountId = String(body.fundingCashAccountId || "");
    const unitPrice = Number(body.unitPrice);
    const transactionDate = new Date(body.transactionDate || new Date().toISOString());

    if (!accountId || !assetId || !fundingCashAccountId) {
      return NextResponse.json({ error: "Account, asset and settlement RDN are required." }, { status: 400 });
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return NextResponse.json({ error: "Sell price must be greater than zero." }, { status: 400 });
    }
    if (Number.isNaN(transactionDate.getTime())) {
      return NextResponse.json({ error: "Transaction date is invalid." }, { status: 400 });
    }

    const result = await sellAllInvestmentAsset({ accountId, assetId, transactionDate, unitPrice, fundingCashAccountId });
    return NextResponse.json(serialize(result));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Prisma.PrismaClientKnownRequestError ? error.message : error instanceof Error ? error.message : "Sell All failed." }, { status: 400 });
  }
}
