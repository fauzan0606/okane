"use server";

import { revalidatePath } from "next/cache";

import {
  createWalletService,
  updateWalletService,
  deleteWalletService,
} from "./service";

import { walletSchema } from "./schema";
import type { WalletActionState } from "./types";

function revalidateFinancialViews() {
  revalidatePath("/wallet");
  revalidatePath("/");
}

export async function createWalletAction(
  _prevState: WalletActionState,
  formData: FormData
): Promise<WalletActionState> {
  const parsed = walletSchema.safeParse({
    name: formData.get("name"),
    walletType: formData.get("walletType"),
    currencyCode: formData.get("currencyCode"),
    currentBalance: formData.get("currentBalance"),
    bank: formData.get("bank"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await createWalletService(parsed.data);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create wallet.",
    };
  }

  revalidateFinancialViews();

  return {
    success: true,
  };
}

export async function updateWalletAction(
  _prevState: WalletActionState,
  formData: FormData
): Promise<WalletActionState> {
  const id = formData.get("id");

  if (typeof id !== "string" || id.length === 0) {
    return {
      success: false,
      message: "Missing wallet id.",
    };
  }

  const parsed = walletSchema.partial().safeParse({
    name: formData.get("name"),
    walletType: formData.get("walletType"),
    currencyCode: formData.get("currencyCode"),
    currentBalance: formData.get("currentBalance"),
    bank: formData.get("bank"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return {
      success: false,
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateWalletService(id, parsed.data);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update wallet.",
    };
  }

  revalidateFinancialViews();

  return {
    success: true,
  };
}

export async function deleteWalletAction(
  _prevState: WalletActionState,
  formData: FormData
): Promise<WalletActionState> {
  const id = formData.get("id");

  if (typeof id !== "string" || id.length === 0) {
    return {
      success: false,
      message: "Missing wallet id.",
    };
  }

  try {
    await deleteWalletService(id);
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete wallet.",
    };
  }

  revalidateFinancialViews();

  return {
    success: true,
  };
}