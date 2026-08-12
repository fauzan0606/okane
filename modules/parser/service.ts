import { extractAmount } from "./amount";
import { extractTransactionDate } from "./date";
import { findCategory } from "./category";
import { findMerchant } from "./merchant";
import { tokenize } from "./tokenizer";
import { detectTransactionType } from "./transactionType";
import { findWallet } from "./wallet";

import type {
  ParsedTransaction,
  ParserContext,
} from "./types";

export function parseTransactionText(
  text: string,
  context: ParserContext
): ParsedTransaction {
  const category = findCategory(text, context);

  const confidence = category
    ? {
        level: "MEDIUM" as const,
        reason: "Based on merchant and transaction pattern analysis.",
      }
    : {
        level: "LOW" as const,
        reason: "No strong category pattern was found. Please review the suggestion.",
      };

  return {
    tokens: tokenize(text),

    transactionDate: extractTransactionDate(text),

    amount: extractAmount(text),

    wallet: findWallet(text, context),

    merchant: findMerchant(text),

    category,

    type: detectTransactionType(text),

    confidence,
  };
}
