import { extractAmount } from "./amount";
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
  return {
    tokens: tokenize(text),

    amount: extractAmount(text),

    wallet: findWallet(
      text,
      context
    ),

    merchant: findMerchant(text),

    category: findCategory(
      text,
      context
    ),

    type: detectTransactionType(text),
  };
}
