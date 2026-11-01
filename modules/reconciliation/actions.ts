"use server";

import { revalidatePath } from "next/cache";
import { ReconciliationResolution } from "@prisma/client";
import { addReconciliationTransaction, completeReconciliation, resolveReconciliationRow } from "./service";

function refreshAll() {
  revalidatePath("/reconciliation");
  revalidatePath("/transactions");
  revalidatePath("/wallet");
  revalidatePath("/credit-card");
  revalidatePath("/");
}

export async function resolveReconciliationRowAction(formData: FormData) {
  const rowId = formData.get("rowId");
  const resolution = formData.get("resolution");
  if (typeof rowId !== "string" || !rowId) throw new Error("Reconciliation row is required.");
  if (typeof resolution !== "string" || !Object.values(ReconciliationResolution).includes(resolution as ReconciliationResolution)) throw new Error("Invalid reconciliation resolution.");
  await resolveReconciliationRow({ rowId, resolution: resolution as ReconciliationResolution });
  refreshAll();
}

export async function completeReconciliationAction(formData: FormData) {
  const sessionId = formData.get("sessionId");
  if (typeof sessionId !== "string" || !sessionId) throw new Error("Reconciliation session is required.");
  await completeReconciliation(sessionId);
  refreshAll();
}

export async function addReconciliationTransactionAction(formData: FormData) {
  const rowId = formData.get("rowId");
  const transactionDate = formData.get("transactionDate");
  const amount = formData.get("amount");
  const walletId = formData.get("walletId");
  const type = formData.get("type");
  const merchant = formData.get("merchant");
  const categoryId = formData.get("categoryId");
  const subcategoryId = formData.get("subcategoryId");
  const note = formData.get("note");

  if (typeof rowId !== "string" || !rowId) throw new Error("Reconciliation row is required.");
  if (typeof transactionDate !== "string" || !transactionDate) throw new Error("Transaction date is required.");
  if (typeof amount !== "string" || !amount) throw new Error("Amount is required.");
  if (typeof walletId !== "string" || !walletId) throw new Error("Wallet is required.");
  if (type !== "EXPENSE" && type !== "INCOME") throw new Error("Transaction type is required.");
  if (typeof merchant !== "string" || !merchant.trim()) throw new Error("Merchant / Payee is required.");

  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) throw new Error("Amount must be greater than zero.");

  const parsedDate = new Date(transactionDate + "T00:00:00.000Z");
  if (Number.isNaN(parsedDate.getTime())) throw new Error("Transaction date is invalid.");

  await addReconciliationTransaction({
    rowId,
    transactionDate: parsedDate,
    amount: parsedAmount,
    walletId,
    type,
    merchant,
    categoryId: typeof categoryId === "string" && categoryId ? categoryId : undefined,
    subcategoryId: typeof subcategoryId === "string" && subcategoryId ? subcategoryId : undefined,
    note: typeof note === "string" ? note : undefined,
  });
  refreshAll();
}
