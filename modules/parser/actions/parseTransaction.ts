"use server";

import { prisma } from "@/lib/prisma";

import { parseTransactionText } from "../service";

import type {
  SmartTransactionResult,
} from "../types";

export async function parseTransactionAction(
  text: string
): Promise<SmartTransactionResult> {
  const wallets =
    await prisma.wallet.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

  const categories =
    await prisma.category.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    });

  const parsed =
    parseTransactionText(text, {
      wallets,
      categories,
    });

  return {
    parsed,
    wallets,
    categories,
  };
}