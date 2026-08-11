import { NextResponse } from "next/server";

// Use a current stable multimodal model. Gemini 2.5 Flash-Lite is unavailable
// to some newly created API projects, while 3.1 Flash-Lite is the current
// stable low-cost model for image/data extraction.
const MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const responseSchema = {
  type: "object",
  properties: {
    merchantName: { type: "string" },
    items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, quantity: { type: "number" }, unitPrice: { type: "number" }, amount: { type: "number" } }, required: ["name", "quantity", "unitPrice", "amount"] } },
    subtotal: { type: "number" }, taxPercent: { type: "number" }, taxAmount: { type: "number" }, servicePercent: { type: "number" }, serviceAmount: { type: "number" }, rounding: { type: "number" }, grandTotal: { type: "number" }, date: { type: "string" },
  },
  required: ["merchantName", "items"],
};

function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return jsonError("GEMINI_API_KEY is not configured on the server.", 500);
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return jsonError("Receipt image is required.");
  if (!file.type.startsWith("image/")) return jsonError("Please upload an image receipt.");
  if (file.size > 12 * 1024 * 1024) return jsonError("Receipt image must be 12 MB or smaller.");

  const base64 = Buffer.from(new Uint8Array(await file.arrayBuffer())).toString("base64");
  const prompt = `Analyze this restaurant receipt image and extract the bill into the JSON schema exactly.
Rules:
- Read the receipt visually. Do not invent values.
- Return the merchant name as printed, cleaned of obvious OCR artifacts.
- Extract every purchasable food/drink/menu line with quantity, unit price, and line amount.
- Ignore metadata such as table number, cashier, halal certification, pax, and payment labels.
- Extract subtotal, tax/PBI/PPN/pajak, service charge, rounding, and grand total when visible.
- Preserve exact monetary amounts printed on the receipt. Do not recompute a printed amount when visible.
- If a charge is printed only as an amount, provide taxAmount/serviceAmount and omit the corresponding percentage.
- If a percentage is explicitly printed, provide the percentage and amount when both are available.
- Rounding may be negative.
- Date is informational only and must not be used to create a transaction date.
- If a value is not visible or cannot be determined reliably, omit that optional field rather than guessing.
- Monetary values must be plain numbers without currency symbols or separators.
- Do not include the grand total as an item.`;

  const response = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: file.type, data: base64 } }] }], generationConfig: { responseMimeType: "application/json", responseJsonSchema: responseSchema } }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("Gemini receipt OCR failed", response.status, body);
    if (response.status === 429) return jsonError("Gemini OCR rate limit reached. Please try again shortly.", 429);
    if (response.status === 401 || response.status === 403) return jsonError("Gemini API key is invalid or does not have access to this model.", 502);
    return jsonError("Gemini could not process this receipt.", 502);
  }

  const data = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) return jsonError("Gemini returned an empty OCR result.", 502);
  try { return NextResponse.json(JSON.parse(text)); } catch { return jsonError("Gemini returned an invalid OCR result.", 502); }
}
