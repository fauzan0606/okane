import { WalletType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createWallet, updateWallet, deleteWallet, getWalletById, getWallets, getActiveCurrencies, findCurrencyByCode } from "./repository";
import { CreateWalletInput } from "./types";

const DEFAULT_CURRENCIES = [
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimalPlaces: 0 },
  { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimalPlaces: 2 },
];

export async function listWallets() { return getWallets(); }

export async function listCurrencies() {
  const currencies = await getActiveCurrencies();
  if (currencies.length > 0) return currencies;
  await prisma.$transaction(DEFAULT_CURRENCIES.map((currency) => prisma.currency.upsert({ where: { code: currency.code }, update: currency, create: currency })));
  return getActiveCurrencies();
}

export async function findWallet(id: string) { return getWalletById(id); }

async function getRequiredCurrency(code: string) {
  const currency = await findCurrencyByCode(code);
  if (!currency) throw new Error("Currency not found.");
  return currency;
}

function cardProfile(input: Partial<CreateWalletInput>) {
  if (input.walletType !== WalletType.CREDIT_CARD) return null;
  if (!input.creditLimit || input.billingDate === undefined || input.dueDate === undefined) throw new Error("Credit card settings are incomplete.");
  return {
    creditLimit: input.creditLimit,
    billingDate: input.billingDate,
    dueDate: input.dueDate,
    rewardPoint: input.rewardPoint ?? "0",
  };
}

export async function createWalletService(input: CreateWalletInput) {
  const currency = await getRequiredCurrency(input.currencyCode);
  const creditCard = cardProfile(input);
  return createWallet({
    name: input.name,
    walletType: input.walletType as WalletType,
    currency: { connect: { id: currency.id } },
    bank: input.bank ?? null,
    note: input.note ?? null,
    currentBalance: input.currentBalance,
    balanceAsOf: new Date(),
    sortOrder: 0,
    isActive: true,
    ...(creditCard ? { creditCard: { create: creditCard } } : {}),
  });
}

export async function updateWalletService(id: string, input: Partial<CreateWalletInput>) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.walletType !== undefined) data.walletType = input.walletType;
  if (input.currentBalance !== undefined) {
    data.currentBalance = input.currentBalance;
    data.balanceAsOf = new Date();
  }
  if (input.bank !== undefined) data.bank = input.bank;
  if (input.note !== undefined) data.note = input.note;
  if (input.currencyCode !== undefined) {
    const currency = await getRequiredCurrency(input.currencyCode);
    data.currency = { connect: { id: currency.id } };
  }

  const existing = await getWalletById(id);
  if (!existing) throw new Error("Wallet not found.");

  if (input.walletType === WalletType.CREDIT_CARD) {
    const profile = cardProfile(input);
    await prisma.creditCardProfile.upsert({
      where: { walletId: id },
      update: profile ?? {},
      create: { walletId: id, ...(profile ?? { creditLimit: 0, billingDate: 1, dueDate: 1, rewardPoint: 0 }) },
    });
  } else if (input.walletType !== undefined && String(input.walletType) !== "CREDIT_CARD") {
    await prisma.creditCardProfile.deleteMany({ where: { walletId: id } });
  } else if (existing.walletType === WalletType.CREDIT_CARD && (input.creditLimit !== undefined || input.billingDate !== undefined || input.dueDate !== undefined || input.rewardPoint !== undefined)) {
    const current = existing.creditCard;
    if (!current) throw new Error("Credit card profile not found.");
    await prisma.creditCardProfile.update({
      where: { walletId: id },
      data: {
        creditLimit: input.creditLimit ?? current.creditLimit,
        billingDate: input.billingDate ?? current.billingDate,
        dueDate: input.dueDate ?? current.dueDate,
        rewardPoint: input.rewardPoint ?? current.rewardPoint,
      },
    });
  }

  return updateWallet(id, data);
}

export async function deleteWalletService(id: string) { return deleteWallet(id); }
