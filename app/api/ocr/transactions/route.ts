import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTransactionText } from "@/modules/parser/service";
import { applyTransactionLearning } from "@/modules/parser/learning";

const MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type RawTransaction = {
  date?: string;
  type?: "INCOME" | "EXPENSE";
  amount?: number;
  merchant?: string;
  note?: string;
  walletHint?: string;
};

const responseSchema = {
  type: "object",
  properties: {
    transactions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          date: { type: "string" },
          type: { type: "string", enum: ["INCOME", "EXPENSE"] },
          amount: { type: "number" },
          merchant: { type: "string" },
          note: { type: "string" },
          walletHint: { type: "string" },
        },
        required: ["date", "type", "amount", "merchant"],
      },
    },
  },
  required: ["transactions"],
};

function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parts = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (parts) return `${parts[3]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function normalizeTransaction(raw: RawTransaction, index: number) {
  const amount = Number(raw.amount);
  return {
    sourceIndex: index + 1,
    date: normalizeDate(raw.date),
    type: raw.type === "INCOME" ? "INCOME" : "EXPENSE",
    amount: Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0,
    merchant: String(raw.merchant ?? "").trim(),
    note: String(raw.note ?? "").trim(),
    walletHint: String(raw.walletHint ?? "").trim(),
  };
}

async function enrichTransactions(rawTransactions: RawTransaction[]) {
  const [wallets, categories, subcategories, payees] = await Promise.all([
    prisma.wallet.findMany({ where: { isActive: true }, select: { id: true, name: true, bank: true }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.subcategory.findMany({ where: { isActive: true }, select: { id: true, name: true, categoryId: true }, orderBy: [{ categoryId: "asc" }, { sortOrder: "asc" }, { name: "asc" }] }),
    prisma.payee.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
  ]);

  const payeeIds = payees.map((payee) => payee.id);
  const historyRows = payeeIds.length > 0
    ? await prisma.transaction.findMany({
        where: { payeeId: { in: payeeIds } },
        select: {
          amount: true,
          transactionDate: true,
          wallet: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          subcategory: { select: { id: true, name: true, categoryId: true } },
          payeeId: true,
        },
        orderBy: { transactionDate: "desc" },
        take: 500,
      })
    : [];

  const payeeByName = new Map(payees.map((payee) => [normalizeText(payee.name), payee]));
  const historyByPayee = new Map<string, typeof historyRows>();
  for (const row of historyRows) {
    if (!row.payeeId) continue;
    const current = historyByPayee.get(row.payeeId) ?? [];
    if (current.length < 50) current.push(row);
    historyByPayee.set(row.payeeId, current);
  }

  return rawTransactions.map((raw, index) => {
    const normalized = normalizeTransaction(raw, index);
    const context = { wallets, categories, subcategories };
    const parseText = [normalized.merchant, normalized.note, normalized.type, String(normalized.amount)].filter(Boolean).join(" ");
    const parsed = parseTransactionText(parseText, context);
    const exactPayee = normalized.merchant ? payeeByName.get(normalizeText(normalized.merchant)) : undefined;
    const learned = exactPayee ? applyTransactionLearning(parsed, historyByPayee.get(exactPayee.id) ?? []) : parsed;
    const walletHint = normalized.walletHint ? wallets.find((wallet) => normalizeText(wallet.name) === normalizeText(normalized.walletHint) || normalizeText(wallet.name).includes(normalizeText(normalized.walletHint))) : undefined;
    const suggestedWallet = walletHint ?? learned.wallet;

    return {
      ...normalized,
      suggestedWalletId: suggestedWallet?.id,
      suggestedWalletName: suggestedWallet?.name,
      suggestedCategoryId: learned.category?.id,
      suggestedCategoryName: learned.category?.name,
      suggestedSubcategoryId: learned.subcategory?.id,
      suggestedSubcategoryName: learned.subcategory?.name,
      suggestionLevel: learned.confidence.level,
      suggestionReason: learned.confidence.reason,
      wallets,
      categories,
      subcategories,
    };
  });
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return jsonError("GEMINI_API_KEY is not configured on the server.", 500);

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return jsonError("Transaction file is required.");
  if (file.size > 15 * 1024 * 1024) return jsonError("Transaction file must be 15 MB or smaller.");

  const supported = file.type.startsWith("image/") || file.type === "application/pdf" || file.type === "text/csv" || file.type === "text/plain" || file.name.toLowerCase().endsWith(".csv");
  if (!supported) return jsonError("Supported files are images, PDF, CSV, and TXT.");

  const isTextFile = file.type === "text/csv" || file.type === "text/plain" || file.name.toLowerCase().endsWith(".csv");
  const prompt = `Extract financial transactions from the supplied file into JSON.
Rules:
- This is a transcription task. Do not invent transactions.
- For bank statements, extract transaction rows only; ignore opening balance, closing balance, running balance, page totals, headers and summaries.
- For receipts, extract the final transaction only unless the file clearly contains multiple separate receipts.
- amount must be the absolute transaction amount as a plain number.
- type is INCOME for money received/credit and EXPENSE for money spent/debit.
- date must be the transaction date when visible.
- merchant should be the merchant/payee/description that best identifies the transaction.
- note may contain the original description or reference when useful.
- walletHint should be the account/card/wallet name only when it is explicitly identifiable from the file.
- Preserve dates and amounts exactly; never rebalance or alter them.
- Do not assign categories or subcategories. OKANE will recommend those after extraction.
- Return an empty transactions array if the file does not contain transaction records.`;

  const filePart = isTextFile
    ? { text: await file.text() }
    : { inlineData: { mimeType: file.type || "application/octet-stream", data: Buffer.from(new Uint8Array(await file.arrayBuffer())).toString("base64") } };

  const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, filePart] }],
      generationConfig: { responseMimeType: "application/json", responseJsonSchema: responseSchema },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Gemini transaction import failed", response.status, body);
    if (response.status === 429) return jsonError("Gemini OCR rate limit reached. Please try again shortly.", 429);
    if (response.status === 401 || response.status === 403) return jsonError("Gemini API key is invalid or does not have access to this model.", 502);
    return jsonError("Gemini could not process this transaction file.", 502);
  }

  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) return jsonError("Gemini returned an empty transaction result.", 502);

  try {
    const parsed = JSON.parse(text) as { transactions?: RawTransaction[] };
    const transactions = Array.isArray(parsed.transactions) ? parsed.transactions.slice(0, 100) : [];
    return NextResponse.json({ fileName: file.name, transactions: await enrichTransactions(transactions) });
  } catch {
    return jsonError("Gemini returned an invalid transaction result.", 502);
  }
}
