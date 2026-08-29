import { NextResponse } from "next/server";
import { InvestmentCashMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export async function GET() {
  try {
    const [wallets, cashAccounts] = await Promise.all([
      prisma.wallet.findMany({
        where: { isActive: true },
        include: { currency: true },
        orderBy: { name: "asc" },
      }),
      prisma.investmentCashAccount.findMany({
        include: { account: { include: { provider: true, currency: true } } },
        orderBy: { account: { name: "asc" } },
      }),
    ]);

    return NextResponse.json(serialize({
      wallets: wallets.map((w) => ({ id: w.id, name: w.name, balance: w.currentBalance, currency: w.currency })),
      cashAccounts: cashAccounts.map((c) => ({
        id: c.id,
        balance: c.balance,
        account: {
          id: c.account.id,
          name: c.account.name,
          provider: c.account.provider,
          currency: c.account.currency,
        },
      })),
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load investment cash transfer data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const walletId = String(body.walletId || "");
    const cashAccountId = String(body.cashAccountId || "");
    const amount = Number(body.amount);
    const date = new Date(String(body.date || new Date().toISOString()));

    if (!walletId || !cashAccountId || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Wallet, RDN cash account and a positive amount are required." }, { status: 400 });
    }
    if (Number.isNaN(date.getTime())) {
      return NextResponse.json({ error: "Transfer date is invalid." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const [wallet, cash] = await Promise.all([
        tx.wallet.findUnique({ where: { id: walletId }, include: { currency: true } }),
        tx.investmentCashAccount.findUnique({ where: { id: cashAccountId }, include: { account: { include: { currency: true, provider: true } } } }),
      ]);

      if (!wallet || !wallet.isActive) throw new Error("Source wallet not found or inactive.");
      if (!cash) throw new Error("Investment RDN cash account not found.");
      if (wallet.currencyId !== cash.account.currencyId) throw new Error("Wallet and RDN currency must match.");
      if (wallet.currentBalance.lt(amount)) throw new Error(`Insufficient balance in ${wallet.name}.`);

      await tx.wallet.update({ where: { id: wallet.id }, data: { currentBalance: { decrement: amount } } });
      const updatedCash = await tx.investmentCashAccount.update({ where: { id: cash.id }, data: { balance: { increment: amount } } });
      const movement = await tx.investmentCashMovement.create({
        data: {
          cashAccountId: cash.id,
          movementType: InvestmentCashMovementType.DEPOSIT,
          amount,
          movementDate: date,
          sourceWalletId: wallet.id,
          note: String(body.note || `Transfer from wallet ${wallet.name}`),
        },
      });

      return { walletId: wallet.id, cashAccountId: cash.id, walletBalance: wallet.currentBalance.minus(amount), cashBalance: updatedCash.balance, movementId: movement.id };
    });

    return NextResponse.json(serialize(result));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Investment cash transfer failed." }, { status: 400 });
  }
}
