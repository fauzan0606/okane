"use client";

import NextImage from "next/image";
import { useEffect, useState } from "react";
import { Camera, Check, LoaderCircle, Upload } from "lucide-react";

type OcrItem = { name: string; quantity: number; unitPrice: number; amount?: number };
type OcrDiscount = { name: string; amount: number; percent?: number; scope: "ORDER" | "DELIVERY" | "ITEM" };
export type OcrResult = {
  merchantName: string;
  items: OcrItem[];
  discounts: OcrDiscount[];
  taxPercent?: number;
  servicePercent?: number;
  taxAmount?: number;
  serviceAmount?: number;
  deliveryFeeAmount?: number;
  deliveryDiscountAmount?: number;
  subtotal?: number;
  grandTotal?: number;
  rounding?: number;
  date?: string;
};

type Props = { onUseResult: (result: OcrResult) => void };

function money(value?: number) { return value === undefined ? "Not detected" : value.toLocaleString("id-ID", { maximumFractionDigits: 2 }); }

export default function SplitBillOcr({ onUseResult }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<OcrResult | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function scan(selectedFile: File) {
    setFile(selectedFile); setResult(null); setError(""); setLoading(true); setStatus("Sending receipt to Gemini OCR…");
    const nextPreview = URL.createObjectURL(selectedFile);
    setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return nextPreview; });
    try {
      const body = new FormData();
      body.append("file", selectedFile);
      const response = await fetch("/api/ocr/receipt", { method: "POST", body });
      const data = await response.json() as OcrResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Gemini OCR failed.");
      setResult(data);
      setStatus("OCR complete. Review the detected values before using them.");
    } catch (scanError) {
      console.error(scanError); setError(scanError instanceof Error ? scanError.message : "OCR could not read this receipt."); setStatus("");
    } finally { setLoading(false); }
  }

  return <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]">
    <div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300"><Camera size={18} /></div><div><h2 className="text-base font-semibold text-white">Scan receipt</h2><p className="mt-1 text-xs text-slate-400">Gemini transcribes the receipt visually. Nothing is added to your Split Bill until you review and use the result.</p></div></div>
    <label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#405A74] bg-[#0B141F] px-4 py-4 text-xs font-semibold text-slate-300 hover:border-emerald-400/40"><input type="file" accept="image/*" capture="environment" className="hidden" disabled={loading} onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void scan(selected); }} /><Camera size={15} /> Take photo / <Upload size={15} /> Upload receipt</label>
    {file && <p className="mt-2 truncate text-[10px] text-slate-500">{file.name}</p>}
    {previewUrl && <NextImage src={previewUrl} alt="Receipt preview" width={1200} height={1600} unoptimized className="mt-3 max-h-72 w-full rounded-xl border border-white/10 bg-white object-contain" />}
    {loading && <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400"><LoaderCircle size={13} className="animate-spin" />{status}</div>}
    {!loading && status && <p className="mt-3 text-[10px] text-slate-400">{status}</p>}
    {error && <p className="mt-3 rounded-xl border border-red-400/10 bg-red-400/[0.04] p-3 text-[10px] text-red-300">{error}</p>}
    {result && <div className="mt-4 rounded-2xl border border-emerald-400/10 bg-[#0B141F] p-4">
      <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400">Gemini OCR Preview</p><p className="mt-1 text-xs text-slate-400">Receipt values are transcribed as printed. Line-item prices are not recalculated; discounts and delivery adjustments stay separate.</p></div>
      <div className="mt-4 grid gap-3 md:grid-cols-4"><div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Merchant</p><p className="mt-1 truncate text-xs font-semibold text-white">{result.merchantName || "Not detected"}</p></div><div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Item Subtotal</p><p className="mt-1 text-xs text-slate-300">{money(result.subtotal)}</p></div><div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Tax / Service</p><p className="mt-1 text-xs text-slate-300">{result.taxAmount !== undefined || result.serviceAmount !== undefined ? `${money(result.taxAmount)} / ${money(result.serviceAmount)}` : "Not detected"}</p></div><div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Grand Total</p><p className="mt-1 text-xs font-semibold text-white">{money(result.grandTotal)}</p></div></div>
      {result.discounts.length > 0 && <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-300">Detected discounts</p><div className="mt-2 space-y-1.5">{result.discounts.map((discount, index) => <div key={`${discount.name}-${index}`} className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-slate-300">{discount.name}{discount.percent !== undefined ? ` (${discount.percent}%)` : ""}</span><span className="shrink-0 font-semibold text-amber-200">−{money(discount.amount)}</span></div>)}</div>{(result.deliveryFeeAmount !== undefined || result.deliveryDiscountAmount !== undefined) && <p className="mt-2 border-t border-white/5 pt-2 text-[10px] text-slate-500">Delivery fee {money(result.deliveryFeeAmount)} · Delivery discount {money(result.deliveryDiscountAmount)}</p>}</div>}
      <div className="mt-3 rounded-lg border border-amber-400/10 bg-amber-400/[0.03] px-3 py-2 text-[10px] text-amber-200">OCR does not change invoice line-item prices to force the total to balance. If the printed values do not reconcile, the discrepancy is shown for review instead of being hidden inside item prices.</div>
      {result.items.length === 0 ? <p className="mt-4 text-xs text-amber-300">No line items were confidently detected. You can still use the merchant and enter the items manually.</p> : <div className="mt-4 space-y-2">{result.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-[#101B28] px-3 py-2 text-xs"><span className="truncate text-slate-300">{item.name} <span className="text-slate-600">× {item.quantity}</span></span><span className="shrink-0 text-slate-400">{money(item.unitPrice)}</span></div>)}</div>}
      {result.rounding !== undefined && <p className="mt-3 text-[10px] text-slate-500">Rounding: {money(result.rounding)}</p>}
      <div className="mt-4 flex justify-end border-t border-white/5 pt-4"><button type="button" onClick={() => onUseResult(result)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-[10px] font-bold text-[#07110b]"><Check size={13} /> Use OCR result</button></div>
    </div>}
  </section>;
}
