import { WalletType } from "@prisma/client";

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

export async function listWallets() {
  return getWallets();
}

export async function listCurrencies() {
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

    currentBalance: 0,
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