"use client";

import NextImage from "next/image";
import { useEffect, useState } from "react";
import { Camera, Check, LoaderCircle, ScanLine, Upload } from "lucide-react";

type OcrItem = { name: string; quantity: number; unitPrice: number };
export type OcrResult = {
  merchantName: string;
  items: OcrItem[];
  taxPercent?: number;
  servicePercent?: number;
  taxAmount?: number;
  serviceAmount?: number;
  subtotal?: number;
  grandTotal?: number;
  rounding?: number;
  rawText: string;
};

type Props = { onUseResult: (result: OcrResult) => void };

function amount(text: string) {
  const digits = text.trim().replace(/[^0-9-]/g, "");
  return digits ? Number(digits) : 0;
}

function findAmount(lines: string[], pattern: RegExp) {
  const line = lines.find((value) => pattern.test(value));
  if (!line) return undefined;
  const match = line.match(/(-?[0-9][0-9.,]*)\s*$/);
  return match ? amount(match[1]) : undefined;
}

function parseReceipt(text: string): OcrResult {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const subtotal = findAmount(lines, /\bsubtotal\b/i);
  const serviceAmount = findAmount(lines, /\b(service\s*charge|service|svc)\b/i);
  const taxAmount = findAmount(lines, /\b(pbi|ppn|tax|pajak)\b/i);
  const grandTotal = findAmount(lines, /\bgrand\s*total\b/i) ?? findAmount(lines, /^total\b/i);
  const rounding = findAmount(lines, /\brounding\b/i);
  const percent = (value?: number) => subtotal && value !== undefined ? Number(((value / subtotal) * 100).toFixed(4)) : undefined;

  const excluded = /^(halal|id|date|time|table|purpose|pax|cashier|subtotal|total|grand total|amount|change|cash|tax|ppn|pbi|pajak|service|svc|discount|diskon|rounding|thank|terima|telp|phone|www|http)/i;
  const items: OcrItem[] = [];
  for (const line of lines) {
    if (excluded.test(line)) continue;
    const match = line.match(/^(.+?)\s+(?:(\d+(?:[.,]\d+)?)\s*[x×*]\s*)?(?:rp\.?\s*)?([0-9][0-9.,]*)$/i);
    if (!match) continue;
    const name = match[1].replace(/\s+/g, " ").trim();
    const price = amount(match[3]);
    const quantity = match[2] ? Number(match[2].replace(",", ".")) : 1;
    if (name.length >= 2 && price > 0) items.push({ name, quantity, unitPrice: Math.round(price / quantity) });
  }

  const merchantIndex = lines.findIndex((line) => /\b(o[o0]toya|lotte\s+mall)\b/i.test(line));
  const merchantName = merchantIndex >= 0
    ? lines.slice(merchantIndex, merchantIndex + 2).filter((line) => !/\b(lotte\s+mall\s*-?\s*3f|jakarta\s+selatan)\b/i.test(line)).join(" ").trim()
    : lines.find((line) => !excluded.test(line) && !/\d/.test(line) && line.length >= 3)?.trim() ?? "";

  return { merchantName, items: items.slice(0, 40), taxPercent: percent(taxAmount), servicePercent: percent(serviceAmount), taxAmount, serviceAmount, subtotal, grandTotal, rounding, rawText: text };
}

function detectBrightCrop(source: HTMLImageElement) {
  const probeMax = 900;
  const scale = Math.min(1, probeMax / Math.max(source.naturalWidth, source.naturalHeight));
  const width = Math.max(1, Math.round(source.naturalWidth * scale));
  const height = Math.max(1, Math.round(source.naturalHeight * scale));
  const probe = document.createElement("canvas");
  probe.width = width; probe.height = height;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width, minY = height, maxX = -1, maxY = -1, count = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      if (brightness > 170 && spread < 75) {
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); count++;
      }
    }
  }
  if (count < width * height * 0.03 || maxX < 0) return null;
  const padX = Math.round(width * 0.025), padY = Math.round(height * 0.025);
  const x = Math.max(0, minX - padX), y = Math.max(0, minY - padY);
  const right = Math.min(width, maxX + padX), bottom = Math.min(height, maxY + padY);
  const cropW = right - x, cropH = bottom - y;
  if (cropW < width * 0.2 || cropH < height * 0.2) return null;
  return { x: x / scale, y: y / scale, width: cropW / scale, height: cropH / scale };
}

async function prepareImage(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read image data."));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not decode image."));
    element.src = dataUrl;
  });

  const crop = detectBrightCrop(image);
  const sourceWidth = crop?.width ?? image.naturalWidth;
  const sourceHeight = crop?.height ?? image.naturalHeight;
  const maxDimension = 3200;
  const scale = Math.min(1.6, maxDimension / Math.max(sourceWidth, sourceHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not prepare the image for OCR.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, crop?.x ?? 0, crop?.y ?? 0, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < imageData.data.length; i += 4) {
    const gray = Math.round(0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2]);
    const contrast = Math.max(0, Math.min(255, Math.round((gray - 128) * 1.55 + 128)));
    const value = contrast < 185 ? contrast : 255;
    imageData.data[i] = value; imageData.data[i + 1] = value; imageData.data[i + 2] = value;
  }
  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL("image/png");
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
    setFile(selectedFile); setError(""); setResult(null); setStatus("Preparing receipt image…"); setProgress(0);
    const nextPreview = URL.createObjectURL(selectedFile);
    setPreviewUrl((current) => { if (current) URL.revokeObjectURL(current); return nextPreview; });
    try {
      if (!selectedFile.type.startsWith("image/")) throw new Error("Please select an image file.");
      const preparedImage = await prepareImage(selectedFile);
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", 1, { logger: (message) => { if (typeof message.progress === "number") setProgress(Math.round(message.progress * 100)); if (message.status) setStatus(message.status); } });
      try {
        await worker.setParameters({ preserve_interword_spaces: "1" });
        const { data } = await worker.recognize(preparedImage);
        setResult(parseReceipt(data.text)); setStatus("OCR complete. Review the detected values before using them."); setProgress(100);
      } finally {
        await worker.terminate();
      }
    } catch (scanError) {
      console.error(scanError); setError("OCR could not read this receipt image. Try a clearer, well-lit photo or enter the bill manually."); setStatus(""); setProgress(0);
    }
  }

  return <section className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.22)]"><div className="flex items-start gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-400/10 text-violet-300"><ScanLine size={18} /></div><div><h2 className="text-base font-semibold text-white">Scan receipt</h2><p className="mt-1 text-xs text-slate-400">OCR is only a starting point. Nothing is added to your Split Bill until you review and use the result.</p></div></div><label className="mt-4 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#405A74] bg-[#0B141F] px-4 py-4 text-xs font-semibold text-slate-300 hover:border-emerald-400/40"><input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => { const selected = event.target.files?.[0]; if (selected) void scan(selected); }} /><Camera size={15} /> Take photo / <Upload size={15} /> Upload receipt</label>{file && <p className="mt-2 truncate text-[10px] text-slate-500">{file.name}</p>}{previewUrl && <NextImage src={previewUrl} alt="Receipt preview" width={1200} height={1600} unoptimized className="mt-3 max-h-72 w-full rounded-xl border border-white/10 bg-white object-contain" />}{status && <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">{progress < 100 && <LoaderCircle size={13} className="animate-spin" />}{status}{progress > 0 && progress < 100 ? ` ${progress}%` : ""}</div>}{error && <p className="mt-3 rounded-xl border border-red-400/10 bg-red-400/[0.04] p-3 text-[10px] text-red-300">{error}</p>}{result && <div className="mt-4 rounded-2xl border border-emerald-400/10 bg-[#0B141F] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400">OCR Preview</p><p className="mt-1 text-xs text-slate-400">Detected values are editable after you use this result.</p></div><button type="button" onClick={() => onUseResult(result)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-bold text-[#07110b]"><Check size={13} /> Use OCR result</button></div><div className="mt-4 grid gap-3 md:grid-cols-4"><div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Merchant</p><p className="mt-1 truncate text-xs font-semibold text-white">{result.merchantName || "Not detected"}</p></div><div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Subtotal</p><p className="mt-1 text-xs text-slate-300">{result.subtotal ? result.subtotal.toLocaleString("id-ID") : "Not detected"}</p></div><div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Tax / Service</p><p className="mt-1 text-xs text-slate-300">{result.taxAmount || result.serviceAmount ? `${result.taxAmount?.toLocaleString("id-ID") ?? "—"} / ${result.serviceAmount?.toLocaleString("id-ID") ?? "—"}` : "Not detected"}</p></div><div><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">Grand Total</p><p className="mt-1 text-xs font-semibold text-white">{result.grandTotal ? result.grandTotal.toLocaleString("id-ID") : "Not detected"}</p></div></div><div className="mt-3 rounded-lg border border-amber-400/10 bg-amber-400/[0.03] px-3 py-2 text-[10px] text-amber-200">OCR values are suggestions only. Check the item list and total before using the result.</div><div className="mt-4 space-y-2">{result.items.length === 0 ? <p className="text-xs text-amber-300">No line items were confidently detected. You can still use the merchant and enter the items manually.</p> : result.items.map((item, index) => <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-[#101B28] px-3 py-2 text-xs"><span className="truncate text-slate-300">{item.name} <span className="text-slate-600">× {item.quantity}</span></span><span className="shrink-0 text-slate-400">{item.unitPrice.toLocaleString("id-ID")}</span></div>)}</div><details className="mt-4"><summary className="cursor-pointer text-[10px] text-slate-600">Show raw OCR text</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-[#081019] p-3 text-[10px] text-slate-500">{result.rawText}</pre></details></div>}</section>;
}
