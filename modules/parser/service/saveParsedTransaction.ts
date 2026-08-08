import { createTransactionService } from "@/modules/transaction/service";

import type { ParsedTransaction } from "../types";

export async function saveParsedTransaction(parsed: ParsedTransaction) {
  if (!parsed.wallet) {
    throw new Error("Wallet could not be detected.");
  }

  if (!parsed.amount) {
    throw new Error("Amount could not be detected.");
  }

  return createTransactionService({
    transactionDate: new Date(),
    type: parsed.type,
    amount: parsed.amount,
    walletId: parsed.wallet.id,
    categoryId: parsed.category?.id,
    merchant: parsed.merchant,
  });
}
