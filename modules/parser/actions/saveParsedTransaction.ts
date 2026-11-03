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
  try {
    await saveParsedTransaction(parsed);
  } catch (error) {
    const isTransactionTimeout = typeof error === "object"
      && error !== null
      && "code" in error
      && error.code === "P2028";
    return {
      success: false as const,
      message: isTransactionTimeout
        ? "Penyimpanan memerlukan waktu lebih lama dari biasanya. Silakan coba lagi."
        : error instanceof Error ? error.message : "Failed to save transaction.",
    };
  }

  revalidatePath(
    "/transactions"
  );
  revalidatePath(
    "/transactions/smart"
  );
  revalidatePath(
    "/reimbursements"
  );
  revalidatePath(
    "/wallet"
  );
  revalidatePath(
    "/"
  );

  return { success: true as const };
}
