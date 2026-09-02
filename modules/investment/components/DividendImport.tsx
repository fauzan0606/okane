"use client";

import { ChangeEvent, useRef, useState } from "react";

export default function DividendImport({ accountId, onDone }: { accountId: string; onDone: () => Promise<void> | void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !accountId) return;
    setBusy(true); setMessage("");
    try {
      const form = new FormData(); form.set("action", "dividend.import.excel"); form.set("accountId", accountId); form.set("file", file);
      const r = await fetch("/api/investments/v2", { method: "POST", body: form });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Dividend import failed.");
      await onDone();
      setMessage(`Imported ${j.imported ?? 0}, skipped ${j.skipped ?? 0}${j.errors?.length ? `, errors ${j.errors.length}` : ""}.`);
    } catch (err) { setMessage(err instanceof Error ? err.message : "Dividend import failed."); }
    finally { setBusy(false); }
  }
  return <div className="flex items-center gap-2">
    <input ref={inputRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
    <button type="button" disabled={busy || !accountId} onClick={() => inputRef.current?.click()} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-slate-300 disabled:opacity-40">{busy ? "Importing…" : "Upload Excel"}</button>
    {message && <span className="text-[11px] text-slate-400">{message}</span>}
  </div>;
}
