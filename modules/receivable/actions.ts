"use server";

import { revalidatePath } from "next/cache";
import { createReceivable, deleteReceivable, deleteReceivablePayment, recordReceivablePayment, refreshReceivableStatuses, updateReceivable, updateReceivablePayment } from "./service";

function parseAmount(value: FormDataEntryValue | null) { if (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value.trim())) return null; return Number(value.trim()); }
function parseDate(value: FormDataEntryValue | null) { if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null; const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? null : date; }
function requiredText(value: FormDataEntryValue | null) { return typeof value === "string" && value.trim() ? value.trim() : null; }
function refreshAll() { revalidatePath("/receivables"); revalidatePath("/transactions"); revalidatePath("/wallet"); revalidatePath("/"); }

export async function createReceivableAction(formData: FormData) {
  const personName = formData.get("personName");
  const description = formData.get("description");
  const amount = parseAmount(formData.get("amount"));
  const currencyId = formData.get("currencyId");
  const sourceWalletId = formData.get("sourceWalletId");
  const loanDate = parseDate(formData.get("loanDate"));
  const dueDate = parseDate(formData.get("dueDate"));
  if (typeof personName !== "string" || !personName.trim() || typeof description !== "string" || !description.trim() || amount === null || typeof currencyId !== "string" || !currencyId || typeof sourceWalletId !== "string" || !sourceWalletId || !loanDate) throw new Error("Please complete the receivable fields.");
  await createReceivable({ personName, description, amount, currencyId, sourceWalletId, loanDate, dueDate });
  refreshAll();
}

export async function updateReceivableAction(formData: FormData) {
  const receivableId = requiredText(formData.get("receivableId"));
  const personName = requiredText(formData.get("personName"));
  const description = requiredText(formData.get("description"));
  const amount = parseAmount(formData.get("amount"));
  const currencyId = requiredText(formData.get("currencyId"));
  const sourceWalletId = requiredText(formData.get("sourceWalletId"));
  const loanDate = parseDate(formData.get("loanDate"));
  const dueDate = parseDate(formData.get("dueDate"));
  if (!receivableId || !personName || !description || amount === null || !currencyId || !sourceWalletId || !loanDate) throw new Error("Please complete the receivable fields.");
  await updateReceivable({ receivableId, personName, description, amount, currencyId, sourceWalletId, loanDate, dueDate });
  refreshAll();
}

export async function deleteReceivableAction(formData: FormData) {
  const receivableId = requiredText(formData.get("receivableId"));
  if (!receivableId) throw new Error("Receivable not found.");
  await deleteReceivable(receivableId);
  refreshAll();
}

export async function recordReceivablePaymentAction(formData: FormData) {
  const receivableId = formData.get("receivableId");
  const amount = parseAmount(formData.get("amount"));
  const receivedAt = parseDate(formData.get("receivedAt"));
  const walletId = formData.get("walletId");
  const note = formData.get("note");
  if (typeof receivableId !== "string" || !receivableId || amount === null || !receivedAt || typeof walletId !== "string" || !walletId) throw new Error("Please complete the payment fields.");
  await recordReceivablePayment({ receivableId, amount, receivedAt, walletId, note: typeof note === "string" ? note : undefined });
  refreshAll();
}

export async function updateReceivablePaymentAction(formData: FormData) {
  const paymentId = requiredText(formData.get("paymentId"));
  const amount = parseAmount(formData.get("amount"));
  const receivedAt = parseDate(formData.get("receivedAt"));
  const walletId = requiredText(formData.get("walletId"));
  const note = formData.get("note");
  if (!paymentId || amount === null || !receivedAt || !walletId) throw new Error("Please complete the payment fields.");
  await updateReceivablePayment({ paymentId, amount, receivedAt, walletId, note: typeof note === "string" ? note : undefined });
  refreshAll();
}

export async function deleteReceivablePaymentAction(formData: FormData) {
  const paymentId = requiredText(formData.get("paymentId"));
  if (!paymentId) throw new Error("Payment not found.");
  await deleteReceivablePayment(paymentId);
  refreshAll();
}

export async function refreshReceivableStatusesAction() { await refreshReceivableStatuses(); revalidatePath("/receivables"); revalidatePath("/"); }
