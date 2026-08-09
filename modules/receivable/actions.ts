"use server";

import { revalidatePath } from "next/cache";
import { createReceivable, recordReceivablePayment, refreshReceivableStatuses } from "./service";

function parseAmount(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value.trim())) return null;
  return Number(value.trim());
}

function parseDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createReceivableAction(formData: FormData) {
  const personName = formData.get("personName");
  const description = formData.get("description");
  const amount = parseAmount(formData.get("amount"));
  const dueDate = parseDate(formData.get("dueDate"));
  if (typeof personName !== "string" || !personName.trim() || typeof description !== "string" || !description.trim() || amount === null) throw new Error("Please complete the receivable fields.");
  await createReceivable({ personName, description, amount, dueDate });
  revalidatePath("/receivables");
  revalidatePath("/");
}

export async function recordReceivablePaymentAction(formData: FormData) {
  const receivableId = formData.get("receivableId");
  const amount = parseAmount(formData.get("amount"));
  const receivedAt = parseDate(formData.get("receivedAt"));
  const walletId = formData.get("walletId");
  const note = formData.get("note");
  if (typeof receivableId !== "string" || !receivableId || amount === null || !receivedAt || typeof walletId !== "string" || !walletId) throw new Error("Please complete the payment fields.");
  await recordReceivablePayment({ receivableId, amount, receivedAt, walletId, note: typeof note === "string" ? note : undefined });
  revalidatePath("/receivables");
  revalidatePath("/transactions");
  revalidatePath("/wallet");
  revalidatePath("/");
}

export async function refreshReceivableStatusesAction() {
  await refreshReceivableStatuses();
  revalidatePath("/receivables");
  revalidatePath("/");
}
