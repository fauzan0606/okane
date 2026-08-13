import { NextResponse } from "next/server";
import { TransactionType } from "@prisma/client";
import { createTransactionService } from "@/modules/transaction/service";

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { transactions?: unknown };
    if (!Array.isArray(body.transactions) || body.transactions.length === 0) return bad("No transactions were provided.");
    if (body.transactions.length > 100) return bad("You can import at most 100 transactions at once.");

    const results: { index: number; success: boolean; message?: string }[] = [];
    for (let index = 0; index < body.transactions.length; index += 1) {
      const raw = body.transactions[index] as Record<string, unknown>;
      const amount = Number(raw.amount);
      const transactionDate = typeof raw.date === "string" ? new Date(`${raw.date}T00:00:00`) : new Date("invalid");
      const type = raw.type === "INCOME" ? TransactionType.INCOME : raw.type === "EXPENSE" ? TransactionType.EXPENSE : null;
      const walletId = typeof raw.walletId === "string" ? raw.walletId : "";
      const categoryId = typeof raw.categoryId === "string" && raw.categoryId ? raw.categoryId : undefined;
      const subcategoryId = typeof raw.subcategoryId === "string" && raw.subcategoryId ? raw.subcategoryId : undefined;
      const merchant = typeof raw.merchant === "string" && raw.merchant.trim() ? raw.merchant.trim() : undefined;
      const note = typeof raw.note === "string" && raw.note.trim() ? raw.note.trim() : undefined;

      if (!Number.isFinite(amount) || amount <= 0) {
        results.push({ index, success: false, message: "Amount is missing or invalid." });
        continue;
      }
      if (!type) {
        results.push({ index, success: false, message: "Transaction type is missing or invalid." });
        continue;
      }
      if (!walletId) {
        results.push({ index, success: false, message: "Wallet is required." });
        continue;
      }
      if (Number.isNaN(transactionDate.getTime())) {
        results.push({ index, success: false, message: "Transaction date is missing or invalid." });
        continue;
      }

      try {
        await createTransactionService({ transactionDate, type, amount, walletId, categoryId, subcategoryId, merchant, note, installment: { enabled: false } });
        results.push({ index, success: true });
      } catch (error) {
        results.push({ index, success: false, message: error instanceof Error ? error.message : "Failed to save transaction." });
      }
    }

    const successCount = results.filter((result) => result.success).length;
    const failureCount = results.length - successCount;
    return NextResponse.json({ success: failureCount === 0, imported: successCount, failed: failureCount, results });
  } catch (error) {
    return bad(error instanceof Error ? error.message : "Failed to import transactions.", 500);
  }
}
