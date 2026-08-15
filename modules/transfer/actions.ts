"use server";

import { revalidatePath } from "next/cache";
import { createTransfer, deleteTransfer, updateTransfer } from "./service";

function parseAmount(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value.trim())) return null;
  return Number(value.trim());
}

function parseDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function requireWallet(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value) throw new Error("Wallet is required.");
  return value;
}

function refreshAll() {
  revalidatePath("/transfer");
  revalidatePath("/wallet");
  revalidatePath("/transactions");
  revalidatePath("/credit-card");
  revalidatePath("/");
}

export async function createTransferAction(formData: FormData) {
  const transferDate = parseDate(formData.get("transferDate"));
  const fromWalletId = requireWallet(formData.get("fromWalletId"));
  const toWalletId = requireWallet(formData.get("toWalletId"));
  const amount = parseAmount(formData.get("amount"));
  const feeAmount = parseAmount(formData.get("feeAmount"));

  if (!transferDate || amount === null) throw new Error("Please complete the transfer fields.");
  await createTransfer({ transferDate, fromWalletId, toWalletId, amount, feeAmount: feeAmount ?? 0 });
  refreshAll();
}

export async function updateTransferAction(formData: FormData) {
  const id = formData.get("id");
  const transferDate = parseDate(formData.get("transferDate"));
  const fromWalletId = requireWallet(formData.get("fromWalletId"));
  const toWalletId = requireWallet(formData.get("toWalletId"));
  const amount = parseAmount(formData.get("amount"));
  const feeAmount = parseAmount(formData.get("feeAmount"));

  if (typeof id !== "string" || !id || !transferDate || amount === null) throw new Error("Please complete the transfer fields.");
  await updateTransfer({ id, transferDate, fromWalletId, toWalletId, amount, feeAmount: feeAmount ?? 0 });
  refreshAll();
}

export async function deleteTransferAction(formData: FormData) {
  const id = formData.get("id");
  if (typeof id !== "string" || !id) throw new Error("Invalid transfer.");
  await deleteTransfer(id);
  refreshAll();
}
