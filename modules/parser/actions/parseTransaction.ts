"use server";

import { prisma } from "@/lib/prisma";

import { parseTransactionText } from "../service";
import { applyTransactionLearning } from "../learning";

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
          bank: true,
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

  const payee = parsed.merchant
    ? await prisma.payee.findFirst({
        where: {
          name: parsed.merchant,
          isActive: true,
        },
        select: {
          id: true,
        },
      })
    : null;

  const history = payee
    ? await prisma.transaction.findMany({
        where: {
          payeeId: payee.id,
        },
        select: {
          amount: true,
          wallet: {
            select: {
              id: true,
              name: true,
            },
          },
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          transactionDate: "desc",
        },
        take: 20,
      })
    : [];

  const learned = applyTransactionLearning(
    parsed,
    history
  );

  return {
    parsed: learned,
    wallets,
    categories,
  };
}
