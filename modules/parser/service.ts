import { extractAmount } from "./amount";
import { extractTransactionDate } from "./date";
import { findCategory, findSubcategory } from "./category";
import { findMerchant } from "./merchant";
import { tokenize } from "./tokenizer";
import { detectTransactionType } from "./transactionType";
import { findWallet } from "./wallet";
import type { ParsedTransaction, ParserContext } from "./types";

export function parseTransactionText(text: string, context: ParserContext): ParsedTransaction {
  const category = findCategory(text, context);
  const subcategory = findSubcategory(text, category, context);
  const confidence = category
    ? {
        level: subcategory ? ("HIGH" as const) : ("MEDIUM" as const),
        reason: subcategory
          ? "Category and subcategory matched from transaction pattern analysis."
          : "Category matched from merchant and transaction pattern analysis; subcategory needs review.",
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
    subcategory,
    type: detectTransactionType(text),
    confidence,
  };
}
