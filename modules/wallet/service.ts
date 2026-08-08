import { WalletType } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import {
  createWallet,
  updateWallet,
  deleteWallet,
  getWalletById,
  getWallets,
  getActiveCurrencies,
  findCurrencyByCode,
} from "./repository";

import { CreateWalletInput } from "./types";

const DEFAULT_CURRENCIES = [
  {
    code: "IDR",
    name: "Indonesian Rupiah",
    symbol: "Rp",
    decimalPlaces: 0,
  },
  {
    code: "USD",
    name: "US Dollar",
    symbol: "$",
    decimalPlaces: 2,
  },
  {
    code: "SGD",
    name: "Singapore Dollar",
    symbol: "S$",
    decimalPlaces: 2,
  },
];

export async function listWallets() {
  return getWallets();
}

export async function listCurrencies() {
  const currencies = await getActiveCurrencies();

  if (currencies.length > 0) {
    return currencies;
  }

  await prisma.$transaction(
    DEFAULT_CURRENCIES.map((currency) =>
      prisma.currency.upsert({
        where: {
          code: currency.code,
        },
        update: currency,
        create: currency,
      })
    )
  );

  return getActiveCurrencies();
}

export async function findWallet(id: string) {
  return getWalletById(id);
}

async function getRequiredCurrency(code: string) {
  const currency = await findCurrencyByCode(code);

  if (!currency) {
    throw new Error("Currency not found.");
  }

  return currency;
}

export async function createWalletService(
  input: CreateWalletInput
) {
  const currency = await getRequiredCurrency(input.currencyCode);

  return createWallet({
    name: input.name,
    walletType: input.walletType as WalletType,

    currency: {
      connect: {
        id: currency.id,
      },
    },

    bank: input.bank ?? null,
    note: input.note ?? null,

    currentBalance: input.currentBalance,
    sortOrder: 0,
    isActive: true,
  });
}

export async function updateWalletService(
  id: string,
  input: Partial<CreateWalletInput>
) {
  const data: Record<string, unknown> = {};

  if (input.name !== undefined) {
    data.name = input.name;
  }

  if (input.walletType !== undefined) {
    data.walletType = input.walletType;
  }

  if (input.currentBalance !== undefined) {
    data.currentBalance = input.currentBalance;
  }

  if (input.bank !== undefined) {
    data.bank = input.bank;
  }

  if (input.note !== undefined) {
    data.note = input.note;
  }

  if (input.currencyCode !== undefined) {
    const currency = await getRequiredCurrency(input.currencyCode);

    data.currency = {
      connect: {
        id: currency.id,
      },
    };
  }

  return updateWallet(id, data);
}

export async function deleteWalletService(id: string) {
  return deleteWallet(id);
}
