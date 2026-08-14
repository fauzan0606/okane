import { NextResponse } from "next/server";
import { ReconciliationSourceType } from "@prisma/client";
import { createReconciliationSession, type ExtractedRow } from "@/modules/reconciliation/service";

export const runtime = "nodejs";

const MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const responseSchema = {
  type: "object",
  properties: {
    periodStart: { type: "string" },
    periodEnd: { type: "string" },
    rows: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sourceRowNumber: { type: "number" },
          pageNumber: { type: "number" },
          transactionDate: { type: "string" },
          description: { type: "string" },
          amount: { type: "number" },
          direction: { type: "string", enum: ["DEBIT", "CREDIT", "UNKNOWN"] },
          entryType: { type: "string" },
        },
        required: ["transactionDate", "description", "amount", "direction", "entryType"],
      },
    },
  },
  required: ["rows"],
};

function error(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

function normalize(raw: any): { periodStart?: string; periodEnd?: string; rows: ExtractedRow[] } {
  const rows = Array.isArray(raw.rows) ? raw.rows.map((row: any) => ({
    sourceRowNumber: Number.isFinite(Number(row.sourceRowNumber)) ? Number(row.sourceRowNumber) : undefined,
    pageNumber: Number.isFinite(Number(row.pageNumber)) ? Number(row.pageNumber) : undefined,
    transactionDate: String(row.transactionDate || "").slice(0, 40),
    description: String(row.description || "").trim(),
    amount: Math.abs(Number(row.amount) || 0),
    direction: row.direction === "CREDIT" || row.direction === "DEBIT" ? row.direction : "UNKNOWN",
    entryType: String(row.entryType || "UNKNOWN").trim(),
  })).filter((row: ExtractedRow) => row.transactionDate && row.description && row.amount > 0) : [];
  return { periodStart: raw.periodStart ? String(raw.periodStart).slice(0, 40) : undefined, periodEnd: raw.periodEnd ? String(raw.periodEnd).slice(0, 40) : undefined, rows };
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return error("GEMINI_API_KEY is not configured on the server.", 500);
  const formData = await request.formData();
  const file = formData.get("file");
  const walletId = formData.get("walletId");
  const sourceType = formData.get("sourceType");
  if (!(file instanceof File)) return error("PDF statement is required.");
  if (file.type !== "application/pdf") return error("Please upload a PDF statement.");
  if (file.size > 50 * 1024 * 1024) return error("PDF statements must be 50 MB or smaller.");
  if (typeof walletId !== "string" || !walletId) return error("Wallet is required.");
  if (sourceType !== "BANK_STATEMENT" && sourceType !== "CREDIT_CARD_STATEMENT") return error("Statement type is required.");

  const base64 = Buffer.from(new Uint8Array(await file.arrayBuffer())).toString("base64");
  const prompt = `You are extracting a bank or credit-card statement into normalized transaction rows for a personal finance reconciliation system.\n\nStatement type: ${sourceType}.\nRules:\n- Extract every actual transaction row from the statement, not headers, balances, totals, rewards summaries, statement metadata, or page footers.\n- Preserve the transaction date printed for the transaction. Do not substitute statement date.\n- Preserve the description as printed, including merchant/reference text.\n- Amount must be the absolute numeric transaction amount without currency symbols or separators.\n- direction DEBIT means money/spending charged from the selected wallet; CREDIT means money/refund/credit posted to it; UNKNOWN when the statement does not make the direction reliable.\n- entryType should be one concise classification such as PURCHASE, REFUND, PAYMENT, FEE, INTEREST, TRANSFER, CASH_ADVANCE, REWARD, or UNKNOWN.\n- For credit-card statements, payment lines are not purchases. Mark them PAYMENT so the app can avoid turning them into expenses.\n- Return pageNumber when visible or inferable from the document page. sourceRowNumber should be the visible transaction sequence/row number if present; otherwise a best-effort sequential row number within the statement.\n- Do not invent transactions.\n- Extract the statement period when visible.\n- The output must be valid JSON matching the supplied schema.`;

  const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: "application/pdf", data: base64 } }] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: responseSchema },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Gemini statement extraction failed", response.status, body);
    if (response.status === 429) return error("Gemini extraction rate limit reached. Please try again shortly.", 429);
    if (response.status === 401 || response.status === 403) return error("Gemini API key is invalid or cannot access the model.", 502);
    return error("Gemini could not process this statement.", 502);
  }

  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) return error("Gemini returned an empty statement extraction.", 502);
  try {
    const normalized = normalize(JSON.parse(text));
    if (!normalized.rows.length) return error("No transaction rows were confidently extracted from this statement.");
    const session = await createReconciliationSession({ walletId, sourceType: sourceType as ReconciliationSourceType, fileName: file.name, rows: normalized.rows, periodStart: normalized.periodStart, periodEnd: normalized.periodEnd });
    return NextResponse.json({ sessionId: session.id, extractedCount: normalized.rows.length });
  } catch (err) {
    console.error(err);
    return error(err instanceof Error ? err.message : "Could not create reconciliation session.", 400);
  }
}
