import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type WalletWithRelations =
  Prisma.WalletGetPayload<{
    include: {
      currency: true;
      creditCard: true;
    };
  }>;

export async function getWallets(): Promise<WalletWithRelations[]> {
  return prisma.wallet.findMany({
    include: {
      currency: true,
      creditCard: true,
    },
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
    include: {
      currency: true,
      creditCard: true,
    },
  });
}

export async function createWallet(data: Prisma.WalletCreateInput) {
  return prisma.wallet.create({
    data,
    include: {
      currency: true,
      creditCard: true,
    },
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
    include: {
      currency: true,
      creditCard: true,
    },
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