"use server";

import { revalidatePath } from "next/cache";

import {
  createWalletService,
  updateWalletService,
  deleteWalletService,
} from "./service";

import { walletSchema } from "./schema";

export async function createWalletAction(formData: FormData) {
  const parsed = walletSchema.safeParse({
    name: formData.get("name"),
    walletType: formData.get("walletType"),
    currencyCode: formData.get("currencyCode"),
    bank: formData.get("bank"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten(),
    };
  }

  await createWalletService(parsed.data);

  revalidatePath("/wallet");

  return {
    success: true,
  };
}

export async function updateWalletAction(
  id: string,
  formData: FormData
) {
  const parsed = walletSchema.partial().safeParse({
    name: formData.get("name"),
    walletType: formData.get("walletType"),
    currencyCode: formData.get("currencyCode"),
    bank: formData.get("bank"),
    note: formData.get("note"),
  });

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten(),
    };
  }

  await updateWalletService(id, parsed.data);

  revalidatePath("/wallet");

  return {
    success: true,
  };
}

export async function deleteWalletAction(id: string) {
  await deleteWalletService(id);

  revalidatePath("/wallet");

  return {
    success: true,
  };
}