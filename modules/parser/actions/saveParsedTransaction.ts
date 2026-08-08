"use server";

import { revalidatePath } from "next/cache";

import {
  saveParsedTransaction,
} from "../service/saveParsedTransaction";

import type {
  ParsedTransaction,
} from "../types";

export async function saveParsedTransactionAction(
  parsed: ParsedTransaction
) {
  const transaction =
    await saveParsedTransaction(
      parsed
    );

  revalidatePath(
    "/transactions"
  );
  revalidatePath(
    "/wallet"
  );
  revalidatePath(
    "/"
  );

  return transaction;
}
