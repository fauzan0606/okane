"use server";

import { prisma } from "@/lib/prisma";

import type {
  ParsedTransaction,
} from "../types";

export async function saveParsedTransaction(
  parsed: ParsedTransaction
) {
  if (!parsed.wallet) {
    throw new Error(
      "Wallet could not be detected."
    );
  }

  if (!parsed.amount) {
    throw new Error(
      "Amount could not be detected."
    );
  }

  let payee = null;

  if (parsed.merchant?.trim()) {
    payee =
      await prisma.payee.findFirst({
        where: {
          name: parsed.merchant.trim(),
        },
      });

    if (!payee) {
      payee =
        await prisma.payee.create({
          data: {
            name: parsed.merchant.trim(),
            isActive: true,
            sortOrder: 0,
          },
        });
    }
  }

  return prisma.transaction.create({
    data: {
      transactionDate: new Date(),

      type: parsed.type,

      amount: parsed.amount,

      note: null,

      wallet: {
        connect: {
          id: parsed.wallet.id,
        },
      },

      ...(payee && {
        payee: {
          connect: {
            id: payee.id,
          },
        },
      }),
    },

    include: {
      wallet: true,
      payee: true,
      category: true,
    },
  });
}