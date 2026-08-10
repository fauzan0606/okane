"use client";

import { useEffect, useState } from "react";
import { Camera, Check, LoaderCircle, ScanLine, Upload } from "lucide-react";

type OcrItem = { name: string; quantity: number; unitPrice: number };
export type OcrResult = { merchantName: string; items: OcrItem[]; taxPercent?: number; servicePercent?: number; rawText: string };

type Props = { onUseResult: (result: OcrResult) => void };
const inputClass = "w-full rounded-xl border border-[#30465D] bg-[#0A1119] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/50";

function amount(text: string) { const digits = text.replace(/[^0-9]/g, ""); return digits ? Number(digits) : 0; }
function parseReceipt(text: string): OcrResult {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const charge = (pattern: RegExp) => { const line = lines.find((value) => pattern.test(value)); if (!line) return undefined; const percent = line.match(/(\d+(?:[.,]\d+)?)\s*%/); return percent ? Number(percent[1].replace(",", ".")) : undefined; };
  const taxPercent = charge(/\b(ppn|tax|pajak)\b/i);
  const servicePercent = charge(/\b(service|svc)\b/i);
  const excluded = /^(subtotal|total|grand total|amount|change|cash|tax|ppn|pajak|service|svc|discount|diskon|thank|terima|telp|phone|www|http)/i;
  const items: OcrItem[] = [];
  for (const line of lines) {
    if (excluded.test(line)) continue;
    const match = line.match(/^(.+?)\s+(?:(\d+(?:[.,]\d+)?)\s*[x×*]\s*)?(?:rp\.?\s*)?([0-9][0-9.,]*)$/i);
    if (!match) continue;
    const name = match[1].replace(/\s+/g, " ").trim();
    if (!name || name.length < 2) continue;
    const price = amount(match[3]);
    const quantity = match[2] ? Number(match[2].replace(",", ".")) : 1;
    if (price > 0) items.push({ name, quantity, unitPrice: Math.round(price / quantity) });
  }
  const merchantName = lines.find((line) => !excluded.test(line) && !/\d/.test(line) && line.length >= 3)?.trim() ?? lines[0] ?? "";
  return { merchantName, items: items.slice(0, 40), taxPercent, servicePercent, rawText: text };
}

export default function SplitBillOcr({ onUseResult }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<OcrResult | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  async function scan(selectedFile: File) {
    setFile(selectedFile); setError(""); setResult(null); setStatus("Preparing OCR…"); setProgress(0);
    const nextPreview = URL.createObjectURL(selectedFile); setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return nextPreview; });
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, { logger: (message) => { if (typeof message.progress === "number") setProgress(Math.round(message.progress * 100)); if (message.status) setStatus(message.status); } });
      const { data } = await worker.recognize(selectedFile);
      await worker.terminate();
      setResult(parseReceipt(data.text)); setStatus("OCR complete. Review the detected values before using them.");
    } catch (scanError) {
      console.error(scanError); setError("OCR could not read this receipt. Try a clearer, well-lit photo or enter the bill manually."); setStatus("");
    }
  }

  return <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"><div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300"><ScanLine size={18} /></div><div><h2 className="text-base font-semibold text-white">Scan receipt</h2><p className="mt-1 text-xs text-slate-400">OCR is only a starting point. Nothing is added to your Split Bill until you review and use the result.</p></div></div><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#405A74] bg-[#0B141F] px-4 py-4 text-xs font-semibold text-slate-300 hover:border-emerald-400/40"><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void scan(selected); }} /><Camera size={15} /> Take photo / <Upload size={15} /> Upload receipt</label>{file && <p className="mt-2 truncate text-[10px] text-slate-500">{file.name}</p>}{previewUrl && <img src={previewUrl} alt="Receipt preview" className="mt-3 max-h-72 w-full rounded-xl border border-white/10 bg-white object-contain" />}{status && <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">{progress < 100 && <LoaderCircle size={13} className="animate-spin" />}{status}{progress > 0 && progress < 100 ? ` ${progress}%` : ""}</div>}{error && <p className="mt-3 rounded-xl border border-red-400/10 bg-red-400/[0.04] p-3 text-[10px] text-red-300">{error}</p>}{result && <div className="mt-4 rounded-2xl border border-emerald-400/10 bg-[#0B141F] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400">OCR Preview</p><p className="mt-1 text-xs text-slate-400">Detected values are editable after you use this result.</p></div><button type="button" onClick={() => onUseResult(result)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-bold text-[#07110b]"><Check size={13} /> Use OCR result</button></div><div className="mt-4 grid gap-3 md:grid-cols-3"><div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Merchant</p><p className="mt-1 truncate text-xs font-semibold text-white">{result.merchantName || "Not detected"}</p></div><div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Tax</p><p className="mt-1 text-xs text-slate-300">{result.taxPercent ? `${result.taxPercent}%` : "Not detected"}</p></div><div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Service</p><p className="mt-1 text-xs text-slate-300">{result.servicePercent ? `${result.servicePercent}%` : "Not detected"}</p></div></div><div className="mt-4 space-y-2">{result.items.length === 0 ? <p className="text-xs text-amber-300">No line items were confidently detected. You can still use the merchant and enter the items manually.</p> : result.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-[#101B28] px-3 py-2 text-xs"><span className="truncate text-slate-300">{item.name} <span className="text-slate-600">× {item.quantity}</span></span><span className="shrink-0 text-slate-400">{item.unitPrice.toLocaleString("id-ID")}</span></div>)}</div><details className="mt-4"><summary className="cursor-pointer text-[10px] text-slate-600">Show raw OCR text</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-[#081019] p-3 text-[10px] text-slate-500">{result.rawText}</pre></details></div>}</section>;
}
