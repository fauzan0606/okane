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
  const items = Array.isArray(raw.items) ? raw.items.map((item: any) => {
    const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
    const amount = Number(item.amount) || quantity * (Number(item.unitPrice) || 0);
    return { ...item, quantity, unitPrice: Number(item.unitPrice) || amount / quantity, amount: round(amount) };
  }) : [];
  const grossSubtotal = round(items.reduce((sum: number, item: any) => sum + item.amount, 0));
  const taxAmount = Math.max(0, Number(raw.taxAmount) || 0);
  const serviceAmount = Math.max(0, Number(raw.serviceAmount) || 0);
  const deliveryFee = Math.max(0, Number(raw.deliveryFeeAmount) || 0);
  const deliveryDiscount = Math.min(Math.max(0, Number(raw.deliveryDiscountAmount) || 0), deliveryFee);
  const netDelivery = round(deliveryFee - deliveryDiscount);
  const orderDiscount = Array.isArray(raw.discounts)
    ? raw.discounts.filter((discount: any) => discount.scope === "ORDER" || discount.scope === "ITEM").reduce((sum: number, discount: any) => sum + Math.abs(Number(discount.amount) || 0), 0)
    : 0;

  // Order/item discounts are absorbed into the item base exactly once.
  // Delivery discounts affect delivery only and are never deducted from item prices.
  const targetItemSubtotal = raw.grandTotal !== undefined
    ? round(Number(raw.grandTotal) - taxAmount - serviceAmount - netDelivery)
    : round(grossSubtotal - orderDiscount);
  const safeTarget = Math.max(0, targetItemSubtotal);

  let normalizedItems = items;
  if (grossSubtotal > 0 && Math.abs(grossSubtotal - safeTarget) > 0.005) {
    let allocated = 0;
    normalizedItems = items.map((item: any, index: number) => {
      const amount = index === items.length - 1 ? round(safeTarget - allocated) : round(item.amount / grossSubtotal * safeTarget);
      allocated = round(allocated + amount);
      return { ...item, amount, unitPrice: round(amount / item.quantity) };
    });
  }

  const normalizedSubtotal = round(normalizedItems.reduce((sum: number, item: any) => sum + item.amount, 0));
  const normalizedGrandTotal = round(normalizedSubtotal + taxAmount + serviceAmount + netDelivery);

  return {
    ...raw,
    items: normalizedItems,
    subtotal: normalizedSubtotal,
    grandTotal: raw.grandTotal !== undefined ? Number(raw.grandTotal) : normalizedGrandTotal,
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
- Extract every discount, voucher, promo, coupon, or negative adjustment. Use scope ORDER for discounts applied to the food/order subtotal, DELIVERY for delivery-fee discounts, ITEM for item-specific discounts.
- Detect delivery fee and delivery discount separately.
- Extract subtotal, tax/PBI/PPN/pajak, service charge, rounding, and grand total when visible.
- SERVICE CHARGE RULE: Set serviceAmount/servicePercent ONLY when a service charge or service fee is explicitly printed. If none is printed, OMIT both. Never infer service fee from arithmetic, tax, delivery fee, discounts, or the difference between subtotal and total.
- Do not reinterpret tax, PBI/PB1, PPN, net sales, delivery fee, or discounts as service charge.
- Preserve exact monetary values printed on the receipt.
- Monetary values must be plain numbers without currency symbols or separators.
- Do not include grand total, delivery fee, tax, service charge, or discounts as food/drink items.
- The receipt grand total is the source of truth when visible.`;

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
