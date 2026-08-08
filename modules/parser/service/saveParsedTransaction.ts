import { createTransactionService } from "@/modules/transaction/service";

import type { ParsedTransaction } from "../types";

export async function saveParsedTransaction(parsed: ParsedTransaction) {
  if (!parsed.wallet) {
    throw new Error("Wallet could not be detected.");
  }

  if (!parsed.amount) {
    throw new Error("Amount could not be detected.");
  }

  const transactionDate = new Date(`${parsed.transactionDate}T00:00:00`);

  if (Number.isNaN(transactionDate.getTime())) {
    throw new Error("Transaction date is invalid.");
  }

  return createTransactionService({
    transactionDate,
    type: parsed.type,
    amount: parsed.amount,
    walletId: parsed.wallet.id,
    categoryId: parsed.category?.id,
    merchant: parsed.merchant,
  });
}
