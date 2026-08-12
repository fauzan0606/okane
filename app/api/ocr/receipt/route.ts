import { NextResponse } from "next/server";

const MODEL = "gemini-3.1-flash-lite";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

type ChargeTreatment = "INCLUDED" | "EXCLUDED" | "UNKNOWN";

const responseSchema = {
  type: "object",
  properties: {
    merchantName: { type: "string" },
    items: { type: "array", items: { type: "object", properties: { name: { type: "string" }, quantity: { type: "number" }, unitPrice: { type: "number" }, amount: { type: "number" } }, required: ["name", "quantity", "unitPrice", "amount"] } },
    discounts: { type: "array", items: { type: "object", properties: { name: { type: "string" }, amount: { type: "number" }, percent: { type: "number" }, scope: { type: "string", enum: ["ORDER", "DELIVERY", "ITEM"] } }, required: ["name", "amount", "scope"] } },
    subtotal: { type: "number" }, taxPercent: { type: "number" }, taxAmount: { type: "number" }, taxMode: { type: "string", enum: ["INCLUDED", "EXCLUDED", "UNKNOWN"] }, servicePercent: { type: "number" }, serviceAmount: { type: "number" }, serviceMode: { type: "string", enum: ["INCLUDED", "EXCLUDED", "UNKNOWN"] }, deliveryFeeAmount: { type: "number" }, deliveryDiscountAmount: { type: "number" }, rounding: { type: "number" }, grandTotal: { type: "number" }, date: { type: "string" },
  },
  required: ["merchantName", "items", "discounts", "taxMode", "serviceMode"],
};

function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function treatment(value: unknown): ChargeTreatment { return value === "INCLUDED" || value === "EXCLUDED" ? value : "UNKNOWN"; }

function normalizeResult(raw: any) {
  const items = Array.isArray(raw.items) ? raw.items.map((item: any) => {
    const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
    const amount = Number(item.amount);
    const unitPrice = Number(item.unitPrice);
    const safeAmount = Number.isFinite(amount) ? round(amount) : round(quantity * (Number.isFinite(unitPrice) ? unitPrice : 0));
    const safeUnitPrice = Number.isFinite(unitPrice) ? unitPrice : round(safeAmount / quantity);
    return { ...item, quantity, unitPrice: safeUnitPrice, amount: safeAmount };
  }) : [];

  const deliveryFee = Math.max(0, Number(raw.deliveryFeeAmount) || 0);
  let discounts = Array.isArray(raw.discounts) ? raw.discounts.map((discount: any) => ({
    ...discount,
    amount: Math.abs(Number(discount.amount) || 0),
    scope: discount.scope === "DELIVERY" || discount.scope === "ITEM" ? discount.scope : "ORDER",
  })) : [];

  if (deliveryFee > 0) {
    discounts = discounts.map((discount: any) => {
      const name = String(discount.name || "").toLowerCase();
      const looksLikeDelivery = /(ongkir|delivery|shipping|shipment|freight|delivery fee)/i.test(name);
      return looksLikeDelivery ? { ...discount, scope: "DELIVERY" } : discount;
    });
  }

  const detectedDeliveryDiscount = discounts.filter((discount: any) => discount.scope === "DELIVERY").reduce((sum: number, discount: any) => sum + discount.amount, 0);
  const deliveryDiscount = deliveryFee > 0 ? Math.min(deliveryFee, round(Math.max(Number(raw.deliveryDiscountAmount) || 0, detectedDeliveryDiscount))) : 0;
  const itemSubtotal = round(items.reduce((sum: number, item: any) => sum + item.amount, 0));
  const taxAmount = Number(raw.taxAmount);
  const serviceAmount = Number(raw.serviceAmount);
  const taxMode = treatment(raw.taxMode);
  const serviceMode = treatment(raw.serviceMode);

  return {
    ...raw,
    items,
    discounts,
    subtotal: itemSubtotal,
    taxMode,
    serviceMode,
    serviceAmount: Number.isFinite(serviceAmount) && serviceAmount > 0 ? round(serviceAmount) : undefined,
    servicePercent: Number.isFinite(serviceAmount) && serviceAmount > 0 ? raw.servicePercent : undefined,
    deliveryFeeAmount: deliveryFee > 0 ? deliveryFee : undefined,
    deliveryDiscountAmount: deliveryDiscount > 0 ? deliveryDiscount : undefined,
    taxAmount: Number.isFinite(taxAmount) && taxAmount >= 0 ? round(taxAmount) : undefined,
    grandTotal: raw.grandTotal !== undefined && Number.isFinite(Number(raw.grandTotal)) ? round(Number(raw.grandTotal)) : undefined,
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
  const prompt = `Analyze this restaurant receipt image and transcribe the bill into the JSON schema exactly.
Rules:
- This is a TRANSCRIPTION task. Do not recalculate, normalize, rebalance, or redistribute prices.
- Extract every purchasable food/drink/menu line with quantity, unit price, and line amount exactly as printed.
- Never reduce or increase a line-item price to make the grand total balance.
- Never allocate an order voucher/discount proportionally into line-item prices.
- Keep discounts separate with positive absolute amount and scope ORDER, DELIVERY, or ITEM.
- A voucher mentioning Ongkir, Delivery, Shipping, or similar is DELIVERY, not ORDER.
- Detect delivery fee and delivery discount separately.
- Extract subtotal, tax/PBI/PPN/pajak, service charge, rounding, and grand total when visible.
- SERVICE CHARGE RULE: Set serviceAmount/servicePercent ONLY when a service charge or service fee is explicitly printed. If none is printed, omit both.
- TAX TREATMENT: Set taxMode to INCLUDED only when the receipt explicitly says tax is included/inclusive or the tax amount is clearly already embedded in the displayed item/subtotal prices. Set EXCLUDED when the receipt presents tax as an additional charge on top of the displayed subtotal/net sales. If the receipt does not provide enough evidence, set UNKNOWN. Never infer the mode merely to make the grand total balance.
- SERVICE TREATMENT: Set serviceMode using the same rule. Explicitly included service charge = INCLUDED; separately added service charge = EXCLUDED; insufficient evidence = UNKNOWN.
- If tax/service is INCLUDED, still extract its printed amount, but the application must not add it a second time to the bill total.
- Preserve exact monetary values printed on the receipt.
- Monetary values must be plain numbers without currency symbols or separators.
- Do not include grand total, delivery fee, tax, service charge, or discounts as food/drink items.
- The grand total is informational source-of-truth and must never be used to alter line-item prices.`;

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
