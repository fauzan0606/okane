import { NextResponse } from "next/server";
import { InvestmentCashMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function serialize<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function movementLabel(type: InvestmentCashMovementType) {
  switch (type) {
    case InvestmentCashMovementType.DEPOSIT: return "Transfer masuk dari Wallet";
    case InvestmentCashMovementType.WITHDRAWAL: return "Transfer ke Wallet";
    case InvestmentCashMovementType.BUY_SETTLEMENT: return "Pembelian saham";
    case InvestmentCashMovementType.SELL_SETTLEMENT: return "Penjualan saham";
    case InvestmentCashMovementType.ADJUSTMENT: return "Penyesuaian saldo aktual";
    default: return type;
  }
}

async function getCashHistory(cashAccountId: string) {
  const cash = await prisma.investmentCashAccount.findUnique({
    where: { id: cashAccountId },
    include: { account: { include: { provider: true, currency: true } } },
  });
  if (!cash) throw new Error("Investment RDN cash account not found.");

  const movements = await prisma.investmentCashMovement.findMany({
    where: { cashAccountId },
    include: {
      sourceWallet: { select: { id: true, name: true } },
      investmentTransaction: { select: { id: true, transactionType: true, asset: { select: { symbol: true, name: true } }, quantity: true, unitPrice: true } },
    },
    orderBy: [{ movementDate: "desc" }, { createdAt: "desc" }],
  });

  let balance = cash.balance;
  const rows = movements.map((movement) => {
    const isIn = movement.movementType === InvestmentCashMovementType.DEPOSIT || movement.movementType === InvestmentCashMovementType.SELL_SETTLEMENT;
    const isOut = movement.movementType === InvestmentCashMovementType.WITHDRAWAL || movement.movementType === InvestmentCashMovementType.BUY_SETTLEMENT;
    const delta = isIn ? movement.amount : isOut ? movement.amount.negated() : movement.note?.includes("+") ? movement.amount : movement.amount.negated();
    const balanceAfter = balance;
    balance = balance.minus(delta);
    const transaction = movement.investmentTransaction;
    const assetLabel = transaction?.asset ? ` · ${transaction.asset.symbol || transaction.asset.name}` : "";
    const walletLabel = movement.sourceWallet ? ` · ${movement.sourceWallet.name}` : "";
    return {
      id: movement.id,
      date: movement.movementDate.toISOString(),
      description: `${movementLabel(movement.movementType)}${assetLabel}${walletLabel}`,
      debit: isOut || (!isIn && delta.isNegative()) ? movement.amount.toString() : "0",
      credit: isIn || (!isOut && delta.isPositive()) ? movement.amount.toString() : "0",
      balance: balanceAfter.toString(),
      movementType: movement.movementType,
      transactionId: movement.investmentTransactionId,
    };
  });

  return { cashAccount: cash, rows };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const cashAccountId = url.searchParams.get("cashAccountId");
    if (cashAccountId) return NextResponse.json(serialize(await getCashHistory(cashAccountId)));

    const [wallets, cashAccounts] = await Promise.all([
      prisma.wallet.findMany({ where: { isActive: true }, include: { currency: true }, orderBy: { name: "asc" } }),
      prisma.investmentCashAccount.findMany({ include: { account: { include: { provider: true, currency: true } } }, orderBy: { account: { name: "asc" } } }),
    ]);
    return NextResponse.json(serialize({
      wallets: wallets.map((w) => ({ id: w.id, name: w.name, balance: w.currentBalance, currency: w.currency })),
      cashAccounts: cashAccounts.map((c) => ({ id: c.id, balance: c.balance, account: { id: c.account.id, name: c.account.name, provider: c.account.provider, currency: c.account.currency } })),
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load investment cash data." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const direction = String(body.direction || "DEPOSIT").toUpperCase();
    const walletId = String(body.walletId || "");
    const cashAccountId = String(body.cashAccountId || "");
    const amount = Number(body.amount);
    const date = new Date(String(body.date || new Date().toISOString()));
    if (!walletId || !cashAccountId || !Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: "Wallet, RDN cash account and a positive amount are required." }, { status: 400 });
    if (Number.isNaN(date.getTime())) return NextResponse.json({ error: "Transfer date is invalid." }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const [wallet, cash] = await Promise.all([
        tx.wallet.findUnique({ where: { id: walletId }, include: { currency: true } }),
        tx.investmentCashAccount.findUnique({ where: { id: cashAccountId }, include: { account: { include: { currency: true, provider: true } } } }),
      ]);
      if (!wallet || !wallet.isActive) throw new Error("Wallet not found or inactive.");
      if (!cash) throw new Error("Investment RDN cash account not found.");
      if (wallet.currencyId !== cash.account.currencyId) throw new Error("Wallet and RDN currency must match.");

      if (direction === "WITHDRAW") {
        if (cash.balance.lt(amount)) throw new Error(`Insufficient RDN balance in ${cash.account.name}.`);
        await tx.investmentCashAccount.update({ where: { id: cash.id }, data: { balance: { decrement: amount } } });
        const updatedWallet = await tx.wallet.update({ where: { id: wallet.id }, data: { currentBalance: { increment: amount } } });
        const movement = await tx.investmentCashMovement.create({ data: { cashAccountId: cash.id, movementType: InvestmentCashMovementType.WITHDRAWAL, amount, movementDate: date, sourceWalletId: wallet.id, note: String(body.note || `Withdrawal to wallet ${wallet.name}`) } });
        return { direction: "WITHDRAW", walletId: wallet.id, cashAccountId: cash.id, walletBalance: updatedWallet.currentBalance, cashBalance: cash.balance.minus(amount), movementId: movement.id };
      }

      if (wallet.currentBalance.lt(amount)) throw new Error(`Insufficient balance in ${wallet.name}.`);
      await tx.wallet.update({ where: { id: wallet.id }, data: { currentBalance: { decrement: amount } } });
      const updatedCash = await tx.investmentCashAccount.update({ where: { id: cash.id }, data: { balance: { increment: amount } } });
      const movement = await tx.investmentCashMovement.create({ data: { cashAccountId: cash.id, movementType: InvestmentCashMovementType.DEPOSIT, amount, movementDate: date, sourceWalletId: wallet.id, note: String(body.note || `Transfer from wallet ${wallet.name}`) } });
      return { direction: "DEPOSIT", walletId: wallet.id, cashAccountId: cash.id, walletBalance: wallet.currentBalance.minus(amount), cashBalance: updatedCash.balance, movementId: movement.id };
    });

    return NextResponse.json(serialize(result));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Investment cash transfer failed." }, { status: 400 });
  }
}
