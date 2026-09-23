"use server";

import { revalidatePath } from "next/cache";
import { recordPayablePayment } from "./service";

export async function recordPayablePaymentAction(formData: FormData): Promise<
  { ok: true; remainingAmount: string; appliedAmount: string; excessAmount: string }
  | { ok: false; error: string }
> {
  try {
    const payableId = formData.get("payableId");
    const amountTransferred = formData.get("amountTransferred");
    const paymentDate = formData.get("paymentDate");
    const walletId = formData.get("walletId");
    const categoryId = formData.get("categoryId");
    const subcategoryId = formData.get("subcategoryId");
    const note = formData.get("note");

    if (typeof payableId !== "string" || !payableId) throw new Error("Payable not found.");
    if (typeof amountTransferred !== "string" || !amountTransferred) throw new Error("Transferred amount is required.");
    if (typeof paymentDate !== "string" || !paymentDate) throw new Error("Payment date is required.");
    if (typeof walletId !== "string" || !walletId) throw new Error("Payment wallet is required.");

    const result = await recordPayablePayment({
      payableId,
      amountTransferred: Number(amountTransferred),
      paymentDate: new Date(paymentDate),
      walletId,
      categoryId: typeof categoryId === "string" && categoryId ? categoryId : undefined,
      subcategoryId: typeof subcategoryId === "string" && subcategoryId ? subcategoryId : undefined,
      note: typeof note === "string" ? note : undefined,
    });

    revalidatePath("/split-bill");
    revalidatePath("/transactions");
    revalidatePath("/wallet");
    revalidatePath("/");
    return {
      ok: true,
      remainingAmount: result.remainingAmount.toString(),
      appliedAmount: result.appliedAmount.toString(),
      excessAmount: result.excessAmount.toString(),
    };
  } catch (error) {
    console.error("recordPayablePaymentAction failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to record repayment.",
    };
  }
}
