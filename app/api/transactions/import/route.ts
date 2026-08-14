import { NextResponse } from "next/server";
import { TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createTransactionService } from "@/modules/transaction/service";
import { IMPORT_REVIEW_WALLET_NOTE } from "@/modules/transaction/importReview";

const INTERNAL_BATCH_SIZE = 100;

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { transactions?: unknown };
    if (!Array.isArray(body.transactions) || body.transactions.length === 0) return bad("No transactions were provided.");

    const needsReviewWallet = body.transactions.some((item) => {
      const raw = item as Record<string, unknown>;
      return typeof raw.walletId !== "string" || !raw.walletId;
    });
    const reviewWallet = needsReviewWallet
      ? await prisma.wallet.findFirst({ where: { note: IMPORT_REVIEW_WALLET_NOTE }, select: { id: true } })
      : null;
    if (needsReviewWallet && !reviewWallet) return bad("Import review wallet is not configured. Run the latest database migration.", 500);

    const results: { index: number; success: boolean; message?: string }[] = [];
    for (let start = 0; start < body.transactions.length; start += INTERNAL_BATCH_SIZE) {
      const batch = body.transactions.slice(start, start + INTERNAL_BATCH_SIZE);
      for (let offset = 0; offset < batch.length; offset += 1) {
        const index = start + offset;
        const raw = batch[offset] as Record<string, unknown>;
        const amount = Number(raw.amount);
        const transactionDate = typeof raw.date === "string" ? new Date(`${raw.date}T00:00:00`) : new Date("invalid");
        const type = raw.type === "INCOME" ? TransactionType.INCOME : raw.type === "EXPENSE" ? TransactionType.EXPENSE : null;
        const walletId = typeof raw.walletId === "string" && raw.walletId ? raw.walletId : reviewWallet?.id ?? "";
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
    }

    const successCount = results.filter((result) => result.success).length;
    const failureCount = results.length - successCount;
    return NextResponse.json({ success: failureCount === 0, imported: successCount, failed: failureCount, results });
  } catch (error) {
    return bad(error instanceof Error ? error.message : "Failed to import transactions.", 500);
  }
}
