import { NextResponse } from "next/server";
import { ReconciliationSourceType } from "@prisma/client";
import { createReconciliationSession, type ExtractedRow } from "@/modules/reconciliation/service";

export const runtime = "nodejs";

const MODEL = "gemini-3.1-flash-lite";
const GENERATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const UPLOAD_URL = "https://generativelanguage.googleapis.com/upload/v1beta/files";

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

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function safeProviderDetail(body: string) {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; status?: string } };
    return parsed.error?.message || parsed.error?.status || "Unknown Gemini error";
  } catch {
    return body.replace(/\s+/g, " ").slice(0, 400);
  }
}

function normalize(raw: any): { periodStart?: string; periodEnd?: string; rows: ExtractedRow[] } {
  const rows = Array.isArray(raw.rows)
    ? raw.rows
        .map((row: any) => ({
          sourceRowNumber: Number.isFinite(Number(row.sourceRowNumber)) ? Number(row.sourceRowNumber) : undefined,
          pageNumber: Number.isFinite(Number(row.pageNumber)) ? Number(row.pageNumber) : undefined,
          transactionDate: String(row.transactionDate || "").slice(0, 40),
          description: String(row.description || "").trim(),
          amount: Math.abs(Number(row.amount) || 0),
          direction: row.direction === "CREDIT" || row.direction === "DEBIT" ? row.direction : "UNKNOWN",
          entryType: String(row.entryType || "UNKNOWN").trim(),
        }))
        .filter((row: ExtractedRow) => row.transactionDate && row.description && row.amount > 0)
    : [];

  return {
    periodStart: raw.periodStart ? String(raw.periodStart).slice(0, 40) : undefined,
    periodEnd: raw.periodEnd ? String(raw.periodEnd).slice(0, 40) : undefined,
    rows,
  };
}

async function uploadToGeminiFiles(apiKey: string, file: File) {
  const bytes = Buffer.from(new Uint8Array(await file.arrayBuffer()));

  const startResponse = await fetch(`${UPLOAD_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.length),
      "X-Goog-Upload-Header-Content-Type": "application/pdf",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: file.name } }),
  });

  if (!startResponse.ok) {
    const body = await startResponse.text();
    console.error("Gemini Files API start failed", startResponse.status, body);
    throw new Error(`Gemini Files API could not start the PDF upload (${startResponse.status}): ${safeProviderDetail(body)}`);
  }

  const uploadUrl = startResponse.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini Files API did not return an upload URL.");

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.length),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
      "Content-Type": "application/pdf",
    },
    body: bytes,
  });

  if (!uploadResponse.ok) {
    const body = await uploadResponse.text();
    console.error("Gemini Files API upload failed", uploadResponse.status, body);
    throw new Error(`Gemini Files API could not upload the PDF (${uploadResponse.status}): ${safeProviderDetail(body)}`);
  }

  const uploaded = await uploadResponse.json() as {
    file?: { name?: string; uri?: string; mimeType?: string; state?: string };
  };

  const fileName = uploaded.file?.name;
  const fileUri = uploaded.file?.uri;
  if (!fileName || !fileUri) throw new Error("Gemini Files API returned an incomplete file resource.");

  let state = uploaded.file?.state || "ACTIVE";
  for (let attempt = 0; attempt < 10 && state === "PROCESSING"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const statusResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${encodeURIComponent(apiKey)}`);
    if (!statusResponse.ok) {
      const body = await statusResponse.text();
      throw new Error(`Gemini Files API could not check PDF status (${statusResponse.status}): ${safeProviderDetail(body)}`);
    }
    const status = await statusResponse.json() as { state?: string; error?: { message?: string } };
    state = status.state || "ACTIVE";
    if (state === "FAILED") throw new Error(`Gemini could not process the PDF: ${status.error?.message || "file processing failed"}`);
  }

  if (state !== "ACTIVE") throw new Error(`Gemini PDF processing did not complete (state: ${state}).`);

  return { fileName, fileUri, mimeType: uploaded.file?.mimeType || "application/pdf" };
}

function extractResponseText(data: any) {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part: any) => part?.text ?? "").join("").trim();
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return error("GEMINI_API_KEY is not configured on the server.", 500);

  const formData = await request.formData();
  const file = formData.get("file");
  const walletId = formData.get("walletId");
  const sourceType = formData.get("sourceType");

  if (!(file instanceof File)) return error("PDF statement is required.");
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) return error("Please upload a PDF statement.");
  if (file.size > 50 * 1024 * 1024) return error("PDF statements must be 50 MB or smaller.");
  if (typeof walletId !== "string" || !walletId) return error("Wallet is required.");
  if (sourceType !== "BANK_STATEMENT" && sourceType !== "CREDIT_CARD_STATEMENT") return error("Statement type is required.");

  const prompt = `You are extracting a bank or credit-card statement into normalized transaction rows for a personal finance reconciliation system.\n\nStatement type: ${sourceType}.\nRules:\n- Extract every actual transaction row from the statement, not headers, balances, totals, rewards summaries, statement metadata, or page footers.\n- Preserve the transaction date printed for the transaction. Do not substitute statement date or posting date.\n- Preserve the description as printed, including merchant/reference text.\n- Amount must be the absolute numeric transaction amount without currency symbols or separators.\n- direction DEBIT means money/spending charged from the selected wallet; CREDIT means money/refund/credit posted to it; UNKNOWN when the statement does not make the direction reliable.\n- entryType should be one concise classification such as PURCHASE, REFUND, PAYMENT, FEE, INTEREST, TRANSFER, CASH_ADVANCE, REWARD, or UNKNOWN.\n- For credit-card statements, payment lines are PAYMENT and must not be treated as purchases or expenses.\n- Return pageNumber when visible or inferable from the document page. sourceRowNumber should be the visible transaction sequence/row number if present; otherwise use a best-effort sequential row number across transaction rows.\n- Do not invent transactions.\n- Extract the statement period when visible.\n- Keep duplicate-looking rows when they are separate statement rows.\n- Return only JSON matching the supplied schema.`;

  let uploadedFile: { fileName: string; fileUri: string; mimeType: string };
  try {
    uploadedFile = await uploadToGeminiFiles(apiKey, file);
  } catch (err) {
    console.error(err);
    return error(err instanceof Error ? err.message : "Could not upload the statement to Gemini.", 502);
  }

  const response = await fetch(`${GENERATE_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          { file_data: { mime_type: uploadedFile.mimeType, file_uri: uploadedFile.fileUri } },
        ],
      }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: responseSchema,
        maxOutputTokens: 32768,
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Gemini statement extraction failed", response.status, body);
    if (response.status === 429) return error("Gemini extraction rate limit reached. Please try again shortly.", 429);
    if (response.status === 401 || response.status === 403) return error("Gemini API key is invalid or cannot access the model.", 502);
    return error(`Gemini could not process this statement (${response.status}): ${safeProviderDetail(body)}`, 502);
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    return error("Gemini returned an invalid response while analyzing the statement.", 502);
  }

  const text = extractResponseText(data);
  if (!text) {
    const finishReason = data?.candidates?.[0]?.finishReason;
    return error(`Gemini returned no extracted rows${finishReason ? ` (finish reason: ${finishReason})` : ""}.`, 502);
  }

  try {
    const normalized = normalize(JSON.parse(text));
    if (!normalized.rows.length) return error("No transaction rows were confidently extracted from this statement.");
    const session = await createReconciliationSession({
      walletId,
      sourceType: sourceType as ReconciliationSourceType,
      fileName: file.name,
      rows: normalized.rows,
      periodStart: normalized.periodStart,
      periodEnd: normalized.periodEnd,
    });
    return NextResponse.json({ sessionId: session.id, extractedCount: normalized.rows.length });
  } catch (err) {
    console.error(err);
    return error(err instanceof Error ? err.message : "Could not create reconciliation session.", 400);
  }
}
