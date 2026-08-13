"use server";

import { prisma } from "@/lib/prisma";
import { parseTransactionText } from "../service";
import { applyTransactionLearning } from "../learning";
import type { SmartTransactionResult } from "../types";

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function parseTransactionAction(text: string): Promise<SmartTransactionResult> {
  const wallets = await prisma.wallet.findMany({ where: { isActive: true }, select: { id: true, name: true, bank: true }, orderBy: { name: "asc" } });
  const categories = await prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  const subcategories = await prisma.subcategory.findMany({ where: { isActive: true }, select: { id: true, name: true, categoryId: true }, orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }, { name: "asc" }] });

  const parsed = parseTransactionText(text, { wallets, categories, subcategories });

  let history: {
    wallet: { id: string; name: string };
    category: { id: string; name: string } | null;
    subcategory: { id: string; name: string; categoryId: string } | null;
    amount: { toNumber: () => number };
  }[] = [];

  if (parsed.merchant) {
    const payees = await prisma.payee.findMany({ where: { isActive: true }, select: { id: true, name: true } });
    const normalizedMerchant = normalizeText(parsed.merchant);
    const matchingPayee = payees.find((payee) => normalizeText(payee.name) === normalizedMerchant);

    if (matchingPayee) {
      history = await prisma.transaction.findMany({
        where: { payeeId: matchingPayee.id },
        select: {
          amount: true,
          wallet: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true, categoryId: true } },
        },
        orderBy: { transactionDate: "desc" },
        take: 50,
      });
    }
  }

  const learned = applyTransactionLearning(parsed, history);
  return { parsed: learned, wallets, categories, subcategories };
}
