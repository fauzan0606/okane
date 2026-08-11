"use server";

import { revalidatePath } from "next/cache";
import { createTransfer } from "./service";

function parseAmount(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value.trim())) return null;
  return Number(value.trim());
}

function parseDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createTransferAction(formData: FormData) {
  const transferDate = parseDate(formData.get("transferDate"));
  const fromWalletId = formData.get("fromWalletId");
  const toWalletId = formData.get("toWalletId");
  const amount = parseAmount(formData.get("amount"));
  const feeAmount = parseAmount(formData.get("feeAmount"));

  if (!transferDate || typeof fromWalletId !== "string" || !fromWalletId || typeof toWalletId !== "string" || !toWalletId || amount === null) {
    throw new Error("Please complete the transfer fields.");
  }

  await createTransfer({ transferDate, fromWalletId, toWalletId, amount, feeAmount: feeAmount ?? 0 });

  revalidatePath("/transfer");
  revalidatePath("/wallet");
  revalidatePath("/transactions");
  revalidatePath("/");
}
