import { NextResponse } from "next/server";

const MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const responseSchema = {
  type: "object",
  properties: {
    merchantName: { type: "string" },
    items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, quantity: { type: "number" }, unitPrice: { type: "number" }, amount: { type: "number" } }, required: ["name", "quantity", "unitPrice", "amount"] } },
    discounts: { type: "array", items: { type: "object", properties: { name: { type: "string" }, amount: { type: "number" }, percent: { type: "number" }, scope: { type: "string", enum: ["ORDER", "DELIVERY", "ITEM"] } }, required: ["name", "amount", "scope"] } },
    subtotal: { type: "number" }, taxPercent: { type: "number" }, taxAmount: { type: "number" }, servicePercent: { type: "number" }, serviceAmount: { type: "number" }, deliveryFeeAmount: { type: "number" }, deliveryDiscountAmount: { type: "number" }, rounding: { type: "number" }, grandTotal: { type: "number" }, date: { type: "string" },
  },
  required: ["merchantName", "items", "discounts"],
};

function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }

function normalizeResult(raw: any) {
  const items = Array.isArray(raw.items) ? raw.items.map((item: any) => ({ ...item, quantity: Number(item.quantity) || 1, unitPrice: Number(item.unitPrice) || 0, amount: Number(item.amount) || (Number(item.quantity) || 1) * (Number(item.unitPrice) || 0) })) : [];
  const grossSubtotal = round(items.reduce((sum: number, item: any) => sum + item.amount, 0));
  const taxAmount = Number(raw.taxAmount) || 0;
  const serviceAmount = Number(raw.serviceAmount) || 0;
  const deliveryFee = Number(raw.deliveryFeeAmount) || 0;
  const deliveryDiscount = Number(raw.deliveryDiscountAmount) || 0;
  const netDelivery = round(deliveryFee - deliveryDiscount);
  const explicitOrderDiscount = Array.isArray(raw.discounts) ? raw.discounts.filter((discount: any) => discount.scope !== "DELIVERY").reduce((sum: number, discount: any) => sum + Math.abs(Number(discount.amount) || 0), 0) : 0;

  // The receipt total is the source of truth. Service fee is NEVER inferred merely
  // to make the arithmetic balance; it must be explicitly printed/detected.
  // For receipts with tax-exclusive net sales, item amounts represent the net
  // item base after order/item discounts, while delivery is kept separate.
  const targetItemSubtotal = raw.grandTotal !== undefined
    ? round(Number(raw.grandTotal) - taxAmount - serviceAmount - netDelivery)
    : round(grossSubtotal - explicitOrderDiscount);
  const safeTarget = Math.max(0, targetItemSubtotal);
  const normalizedItems = grossSubtotal > 0 && Math.abs(grossSubtotal - safeTarget) > 0.005
    ? items.map((item: any) => ({ ...item, unitPrice: round((item.amount / grossSubtotal) * safeTarget / item.quantity), amount: round((item.amount / grossSubtotal) * safeTarget) }))
    : items;
  const normalizedSubtotal = round(normalizedItems.reduce((sum: number, item: any) => sum + item.amount, 0));

  return {
    ...raw,
    items: normalizedItems,
    subtotal: normalizedSubtotal,
    serviceAmount: serviceAmount > 0 ? serviceAmount : undefined,
    servicePercent: serviceAmount > 0 ? raw.servicePercent : undefined,
    deliveryFeeAmount: deliveryFee > 0 ? deliveryFee : undefined,
    deliveryDiscountAmount: deliveryDiscount > 0 ? deliveryDiscount : undefined,
    discounts: Array.isArray(raw.discounts) ? raw.discounts : [],
  };
}

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
- Read the receipt visually. Do not invent values or charges.
- Return the merchant name as printed, cleaned of obvious OCR artifacts.
- Extract every purchasable food/drink/menu line with quantity, unit price, and line amount BEFORE transaction-level discounts.
- Extract every discount, voucher, promo, coupon, or negative adjustment. Put each in discounts with its printed name, positive absolute amount, and scope: ORDER for discounts applied to the food/order subtotal, DELIVERY for delivery-fee discounts, ITEM for an item-specific discount.
- Detect delivery fee separately when present. Detect delivery discount separately when present.
- Extract subtotal, tax/PBI/PPN/pajak, service charge, rounding, and grand total when visible.
- SERVICE CHARGE RULE: Set serviceAmount/servicePercent ONLY when a service charge or service fee is explicitly printed on the receipt. If there is no service-fee/service-charge line, OMIT serviceAmount and servicePercent. Never infer a service fee from arithmetic, tax, delivery fee, or the difference between subtotal and total.
- Do not reinterpret tax, PBI/PB1, PPN, net sales, delivery fee, or discounts as a service charge.
- Preserve exact monetary amounts printed on the receipt. Do not invent a discount when none is printed.
- If a charge is printed only as an amount, provide the amount and omit the percentage.
- If a percentage is explicitly printed, provide the percentage and amount when both are available.
- Rounding may be negative.
- Date is informational only and must not be used to create a transaction date.
- If a value is not visible or cannot be determined reliably, omit that optional field.
- Monetary values must be plain numbers without currency symbols or separators.
- Do not include the grand total, delivery fee, tax, service charge, or discounts as food/drink items.`;

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
  try { return NextResponse.json(normalizeResult(JSON.parse(text))); } catch { return jsonError("Gemini returned an invalid OCR result.", 502); }
}
