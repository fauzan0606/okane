"use server";

import { revalidatePath } from "next/cache";

import {
  createTransactionService,
  deleteTransactionService,
  updateTransactionService,
} from "./service";

import { transactionSchema } from "./schema";

import type { TransactionActionState } from "./types";

export async function createTransactionAction(
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const parsed = transactionSchema.safeParse({
    transactionDate: formData.get("transactionDate"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    walletId: formData.get("walletId"),
    categoryId: formData.get("categoryId"),
    payeeId: formData.get("payeeId"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await createTransactionService(parsed.data);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to create transaction.",
    };
  }

  revalidatePath("/transactions");

  return {
    success: true,
  };
}

export async function updateTransactionAction(
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const id = formData.get("id");

  if (typeof id !== "string" || id.length === 0) {
    return {
      success: false,
      message: "Missing transaction id.",
    };
  }

  const parsed = transactionSchema.partial().safeParse({
    transactionDate: formData.get("transactionDate"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    walletId: formData.get("walletId"),
    categoryId: formData.get("categoryId"),
    payeeId: formData.get("payeeId"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateTransactionService(id, parsed.data);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update transaction.",
    };
  }

  revalidatePath("/transactions");

  return {
    success: true,
  };
}

export async function deleteTransactionAction(
  _prevState: TransactionActionState,
  formData: FormData
): Promise<TransactionActionState> {
  const id = formData.get("id");

  if (typeof id !== "string" || id.length === 0) {
    return {
      success: false,
      message: "Missing transaction id.",
    };
  }

  try {
    await deleteTransactionService(id);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to delete transaction.",
    };
  }

  revalidatePath("/transactions");

  return {
    success: true,
  };
}