import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const walletInclude = {
  currency: true,
  creditCard: true,
} satisfies Prisma.WalletInclude;

export type WalletWithRelations = Prisma.WalletGetPayload<{
  include: typeof walletInclude;
}>;

export async function getWallets(): Promise<WalletWithRelations[]> {
  return prisma.wallet.findMany({
    include: walletInclude,
    where: {
      isActive: true,
    },
    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        createdAt: "asc",
      },
    ],
  });
}

export async function getWalletById(
  id: string
): Promise<WalletWithRelations | null> {
  return prisma.wallet.findUnique({
    where: {
      id,
    },
    include: walletInclude,
  });
}

export async function createWallet(data: Prisma.WalletCreateInput) {
  return prisma.wallet.create({
    data,
    include: walletInclude,
  });
}

export async function updateWallet(
  id: string,
  data: Prisma.WalletUpdateInput
) {
  return prisma.wallet.update({
    where: {
      id,
    },
    data,
    include: walletInclude,
  });
}

export async function deleteWallet(id: string) {
  return prisma.wallet.update({
    where: {
      id,
    },
    data: {
      isActive: false,
    },
  });
}

export async function getActiveCurrencies() {
  return prisma.currency.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      code: "asc",
    },
  });
}

export async function findCurrencyByCode(code: string) {
  return prisma.currency.findUnique({
    where: {
      code,
    },
  });
}