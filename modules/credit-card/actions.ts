"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CreditCardStatementStatus } from "@prisma/client";
import { createManualStatement, recordStatementPayment } from "./service";

function parseAmount(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value.trim())) return null;
  return Number(value.trim());
}

function parseDate(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function updateStatementAction(formData: FormData) {
  const id = formData.get("id");
  const actualAmount = parseAmount(formData.get("actualAmount"));
  const paidAmount = parseAmount(formData.get("paidAmount"));
  const paidAtValue = formData.get("paidAt");
  if (typeof id !== "string" || !id || actualAmount === null || paidAmount === null) throw new Error("Invalid statement data.");
  const statement = await prisma.creditCardStatement.findUnique({ where: { id } });
  if (!statement) throw new Error("Statement not found.");
  const status = paidAmount >= actualAmount ? CreditCardStatementStatus.PAID : paidAmount > 0 ? CreditCardStatementStatus.PARTIALLY_PAID : new Date() > statement.dueDate ? CreditCardStatementStatus.OVERDUE : CreditCardStatementStatus.UNPAID;
  await prisma.creditCardStatement.update({ where: { id }, data: { actualAmount, paidAmount, paidAt: paidAmount > 0 && typeof paidAtValue === "string" && paidAtValue ? parseDate(paidAtValue) : null, status } });
  revalidatePath("/wallet");
  revalidatePath("/credit-card");
}

export async function createManualStatementAction(formData: FormData) {
  const walletId = formData.get("walletId");
  const periodStart = parseDate(formData.get("periodStart"));
  const periodEnd = parseDate(formData.get("periodEnd"));
  const statementDate = parseDate(formData.get("statementDate"));
  const dueDate = parseDate(formData.get("dueDate"));
  const actualAmount = parseAmount(formData.get("actualAmount"));
  if (typeof walletId !== "string" || !walletId || !periodStart || !periodEnd || !statementDate || !dueDate || actualAmount === null) throw new Error("Please complete all statement fields.");
  if (periodEnd < periodStart) throw new Error("Statement period is invalid.");
  await createManualStatement(walletId, { periodStart, periodEnd, statementDate, dueDate, actualAmount });
  revalidatePath("/credit-card");
}

export async function recordStatementPaymentAction(formData: FormData) {
  const statementId = formData.get("statementId");
  const amount = parseAmount(formData.get("amount"));
  const paidAt = parseDate(formData.get("paidAt"));
  const note = formData.get("note");
  if (typeof statementId !== "string" || !statementId || amount === null || !paidAt) throw new Error("Please enter a valid payment.");
  await recordStatementPayment(statementId, amount, paidAt, typeof note === "string" ? note : undefined);
  revalidatePath("/wallet");
  revalidatePath("/credit-card");
}
