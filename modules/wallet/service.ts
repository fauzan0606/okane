import { WalletType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { createWallet, updateWallet, deleteWallet, getWalletById, getWallets, getWalletHistory, getActiveCurrencies, findCurrencyByCode } from "./repository";
import { CreateWalletInput } from "./types";

const DEFAULT_CURRENCIES = [
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", decimalPlaces: 0 },
  { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimalPlaces: 2 },
];

export async function listWallets() { return getWallets(); }
export async function listWalletHistory(walletId: string) { return getWalletHistory(walletId); }

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
  return { creditLimit: input.creditLimit, billingDate: input.billingDate, dueDate: input.dueDate, rewardPoint: input.rewardPoint ?? "0" };
}

export async function createWalletService(input: CreateWalletInput) {
  const currency = await getRequiredCurrency(input.currencyCode);
  const creditCard = cardProfile(input);
  return createWallet({ name: input.name, walletType: input.walletType as WalletType, currency: { connect: { id: currency.id } }, bank: input.bank ?? null, note: input.note ?? null, currentBalance: input.currentBalance, balanceAsOf: new Date(), sortOrder: 0, isActive: true, ...(creditCard ? { creditCard: { create: creditCard } } : {}) });
}

export async function updateWalletService(id: string, input: Partial<CreateWalletInput>) {
  const existing = await getWalletById(id);
  if (!existing) throw new Error("Wallet not found.");

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.walletType !== undefined) data.walletType = input.walletType as WalletType;
  if (input.currentBalance !== undefined) { data.currentBalance = input.currentBalance; data.balanceAsOf = new Date(); }
  if (input.bank !== undefined) data.bank = input.bank;
  if (input.note !== undefined) data.note = input.note;
  if (input.currencyCode !== undefined) {
    const currency = await getRequiredCurrency(input.currencyCode);
    data.currency = { connect: { id: currency.id } };
  }

  const nextWalletType = input.walletType ?? existing.walletType;
  const profile = nextWalletType === WalletType.CREDIT_CARD
    ? cardProfile({ ...input, walletType: WalletType.CREDIT_CARD })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({ where: { id }, data });

    if (nextWalletType === WalletType.CREDIT_CARD) {
      if (!profile) throw new Error("Credit card settings are incomplete.");
      await tx.creditCardProfile.upsert({
        where: { walletId: id },
        update: profile,
        create: { walletId: id, ...profile },
      });
    } else if (input.walletType !== undefined) {
      await tx.creditCardProfile.deleteMany({ where: { walletId: id } });
    }
  });

  return getWalletById(id);
}

export async function deleteWalletService(id: string) { return deleteWallet(id); }
