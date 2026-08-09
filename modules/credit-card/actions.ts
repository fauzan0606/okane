"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { CreditCardStatementStatus } from "@prisma/client";

function parseAmount(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value.trim())) return null;
  return value.trim();
}

export async function updateStatementAction(formData: FormData) {
  const id = formData.get("id");
  const actualAmount = parseAmount(formData.get("actualAmount"));
  const paidAmount = parseAmount(formData.get("paidAmount"));
  const paidAtValue = formData.get("paidAt");

  if (typeof id !== "string" || !id || actualAmount === null || paidAmount === null) {
    throw new Error("Invalid statement data.");
  }

  const statement = await prisma.creditCardStatement.findUnique({
    where: { id },
    include: { creditCard: true },
  });
  if (!statement) throw new Error("Statement not found.");

  const actual = Number(actualAmount);
  const paid = Number(paidAmount);
  const hasPaidDate = typeof paidAtValue === "string" && paidAtValue.trim().length > 0;

  if (paid > 0 && !hasPaidDate) {
    throw new Error("Payment date is required when a payment amount is recorded.");
  }

  const status = paid >= actual
    ? CreditCardStatementStatus.PAID
    : paid > 0
      ? CreditCardStatementStatus.PARTIALLY_PAID
      : new Date() > statement.dueDate
        ? CreditCardStatementStatus.OVERDUE
        : CreditCardStatementStatus.UNPAID;

  await prisma.creditCardStatement.update({
    where: { id },
    data: {
      actualAmount,
      paidAmount,
      paidAt: paid > 0 && hasPaidDate
        ? new Date(`${String(paidAtValue)}T12:00:00`)
        : null,
      status,
    },
  });

  revalidatePath("/wallet");
  revalidatePath("/credit-card");
}
