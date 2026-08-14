"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FileSearch, LoaderCircle, Trash2, Upload, XCircle } from "lucide-react";
import { completeReconciliationAction, resolveReconciliationRowAction } from "../actions";

type Wallet = { id: string; name: string; walletType: string; currency: { code: string; symbol: string } };
type Row = {
  id: string;
  sourceSide: "STATEMENT" | "OKANE";
  sourceRowNumber: number | null;
  pageNumber: number | null;
  transactionDate: string;
  description: string;
  amount: string;
  direction: "DEBIT" | "CREDIT" | "UNKNOWN";
  entryType: string | null;
  matchStatus: "MATCHED" | "POSSIBLE_MATCH" | "CONFLICT" | "STATEMENT_ONLY" | "OKANE_ONLY";
  matchConfidence: number;
  matchReason: string | null;
  matchedTransactionId: string | null;
  resolution: string;
};
type Session = { id: string; fileName: string; sourceType: "BANK_STATEMENT" | "CREDIT_CARD_STATEMENT"; status: string; wallet: { name: string; walletType: string; currency: { symbol: string } }; extractedCount: number; rows: Row[] };
type Props = { wallets: Wallet[]; session: Session | null };

function money(value: string | number, symbol: string) { return `${symbol}${Number(value).toLocaleString("id-ID", { maximumFractionDigits: 0 })}`; }
function date(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)); }
function statusLabel(status: Row["matchStatus"]) { return status === "STATEMENT_ONLY" ? "Statement only" : status === "OKANE_ONLY" ? "OKANE only" : status === "POSSIBLE_MATCH" ? "Possible match" : status === "CONFLICT" ? "Conflict" : "Matched"; }
function statusClass(status: Row["matchStatus"]) { return status === "MATCHED" ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300" : status === "POSSIBLE_MATCH" ? "border-amber-400/20 bg-amber-400/10 text-amber-300" : "border-red-400/20 bg-red-400/10 text-red-300"; }

export default function ReconciliationClient({ wallets, session }: Props) {
  const router = useRouter();
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [sourceType, setSourceType] = useState<"BANK_STATEMENT" | "CREDIT_CARD_STATEMENT">(wallets[0]?.walletType === "CREDIT_CARD" ? "CREDIT_CARD_STATEMENT" : "BANK_STATEMENT");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const activeSession = session;
  const rows = activeSession?.rows ?? [];
  const summary = useMemo(() => ({
    matched: rows.filter((row) => row.matchStatus === "MATCHED").length,
    possible: rows.filter((row) => row.matchStatus === "POSSIBLE_MATCH").length,
    conflicts: rows.filter((row) => row.matchStatus === "CONFLICT").length,
    statementOnly: rows.filter((row) => row.matchStatus === "STATEMENT_ONLY").length,
    okaneOnly: rows.filter((row) => row.matchStatus === "OKANE_ONLY").length,
    pending: rows.filter((row) => row.resolution === "PENDING").length,
  }), [rows]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || !walletId) return;
    setBusy(true); setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("walletId", walletId);
      body.append("sourceType", sourceType);
      const response = await fetch("/api/reconciliation/analyze", { method: "POST", body });
      const data = await response.json() as { sessionId?: string; error?: string };
      if (!response.ok || !data.sessionId) throw new Error(data.error || "Statement analysis failed.");
      router.push(`/reconciliation?session=${data.sessionId}`);
      router.refresh();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Statement analysis failed.");
    } finally { setBusy(false); }
  }

  function resolve(rowId: string, resolution: string) {
    const form = new FormData(); form.set("rowId", rowId); form.set("resolution", resolution);
    startTransition(async () => {
      try { await resolveReconciliationRowAction(form); router.refresh(); } catch (resolveError) { setError(resolveError instanceof Error ? resolveError.message : "Resolution failed."); }
    });
  }

  function complete() {
    if (!activeSession) return;
    const form = new FormData(); form.set("sessionId", activeSession.id);
    startTransition(async () => {
      try { await completeReconciliationAction(form); router.refresh(); } catch (completeError) { setError(completeError instanceof Error ? completeError.message : "Could not complete reconciliation."); }
    });
  }

  const needsReview = rows.filter((row) => row.resolution === "PENDING");
  return <div className="space-y-5">
    <form onSubmit={upload} className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.18)]">
      <div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300"><FileSearch size={20} /></div><div><h2 className="text-base font-semibold text-white">1. Analyze a statement</h2><p className="mt-1 text-xs leading-5 text-slate-500">The PDF is analyzed in a separate reconciliation staging area. Nothing is added to OKANE until you resolve a difference.</p></div></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <label className="space-y-1.5"><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Wallet</span><select value={walletId} onChange={(event) => { const value = event.target.value; setWalletId(value); const wallet = wallets.find((entry) => entry.id === value); if (wallet) setSourceType(wallet.walletType === "CREDIT_CARD" ? "CREDIT_CARD_STATEMENT" : "BANK_STATEMENT"); }} className="w-full rounded-xl border border-[#30465D] bg-[#0A1119] px-3 py-2.5 text-sm text-white outline-none"><option value="">Choose wallet</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}</option>)}</select></label>
        <label className="space-y-1.5"><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">Statement type</span><select value={sourceType} onChange={(event) => setSourceType(event.target.value as typeof sourceType)} className="w-full rounded-xl border border-[#30465D] bg-[#0A1119] px-3 py-2.5 text-sm text-white outline-none"><option value="BANK_STATEMENT">Bank account statement</option><option value="CREDIT_CARD_STATEMENT">Credit card statement</option></select></label>
        <label className="space-y-1.5"><span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">PDF statement</span><input type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="w-full rounded-xl border border-dashed border-[#405A74] bg-[#0A1119] px-3 py-2.5 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:text-[#07110b]" /></label>
      </div>
      {file && <p className="mt-2 truncate text-[10px] text-slate-500">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-[10px] text-slate-600">PDF processing uses Gemini document understanding; PDFs can contain both native text and scanned visuals. citeturn245594search1turn245594search2</p><button disabled={busy || !file || !walletId} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b] disabled:cursor-not-allowed disabled:opacity-40">{busy ? <><LoaderCircle size={14} className="animate-spin" />Analyzing statement…</> : <><Upload size={14} />Analyze & compare</>}</button></div>
      {error && <p className="mt-3 rounded-xl border border-red-400/10 bg-red-400/[0.04] p-3 text-xs text-red-300">{error}</p>}
    </form>

    {activeSession && <section className="space-y-4">
      <div className="rounded-[22px] border border-[#30465D] bg-[#172A3D] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">2. Reconciliation result</p><h2 className="mt-1 text-lg font-semibold text-white">{activeSession.fileName}</h2><p className="mt-1 text-xs text-slate-500">{activeSession.wallet.name} · {activeSession.sourceType === "CREDIT_CARD_STATEMENT" ? "Credit card statement" : "Bank statement"}</p></div>{activeSession.status !== "COMPLETED" && <button onClick={complete} disabled={isPending || summary.pending > 0} className="rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b] disabled:opacity-40">{isPending ? "Saving…" : summary.pending ? `Resolve ${summary.pending} rows first` : "Complete reconciliation"}</button>}</div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[["Matched", summary.matched, "text-emerald-300"],["Possible", summary.possible, "text-amber-300"],["Conflict", summary.conflicts, "text-red-300"],["Statement only", summary.statementOnly, "text-red-300"],["OKANE only", summary.okaneOnly, "text-amber-300"]].map(([label, count, color]) => <div key={String(label)} className="rounded-xl border border-white/5 bg-[#0B141F] px-3 py-3"><p className="text-[9px] uppercase tracking-[0.1em] text-slate-600">{label}</p><p className={`mt-1 text-xl font-bold ${color}`}>{count}</p></div>)}
        </div>
      </div>

      {needsReview.length > 0 && <section className="space-y-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">3. Review differences</p><h3 className="mt-1 text-lg font-semibold text-white">Only the rows that need a decision</h3></div>{needsReview.map((row) => {
        const isOkaneOnly = row.matchStatus === "OKANE_ONLY";
        const canAdd = !isOkaneOnly && row.direction !== "UNKNOWN" && !(activeSession.sourceType === "CREDIT_CARD_STATEMENT" && row.direction === "CREDIT");
        return <article key={row.id} className="rounded-[20px] border border-[#30465D] bg-[#172A3D] p-4 shadow-[0_12px_28px_rgba(0,0,0,0.14)]"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2.5 py-1 text-[9px] font-semibold ${statusClass(row.matchStatus)}`}>{statusLabel(row.matchStatus)}</span>{row.sourceRowNumber && <span className="text-[9px] text-slate-600">Source row {row.sourceRowNumber}{row.pageNumber ? ` · page ${row.pageNumber}` : ""}</span>}</div><h4 className="mt-2 truncate text-sm font-semibold text-white">{row.description}</h4><p className="mt-1 text-xs text-slate-500">{date(row.transactionDate)} · {row.entryType || "Unknown"} · {row.direction}</p>{row.matchReason && <p className="mt-2 text-[10px] text-slate-600">{row.matchReason}</p>}</div><div className="flex shrink-0 flex-col items-start gap-2 sm:items-end"><p className="text-lg font-bold text-white">{money(row.amount, activeSession.wallet.currency.symbol)}</p><div className="flex flex-wrap gap-2">{isOkaneOnly ? <><button onClick={() => resolve(row.id, "KEEP")} disabled={isPending} className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold text-slate-200">Keep transaction</button><button onClick={() => resolve(row.id, "DELETE")} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/15 bg-red-400/[0.04] px-3 py-2 text-[10px] font-semibold text-red-300"><Trash2 size={12} /> Delete from OKANE</button></> : <><button onClick={() => resolve(row.id, "IGNORE")} disabled={isPending} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold text-slate-300"><XCircle size={12} /> Ignore</button><button onClick={() => resolve(row.id, "ADD_INCOMPLETE")} disabled={isPending || !canAdd} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-bold text-[#07110b] disabled:cursor-not-allowed disabled:opacity-40"><Check size={12} /> Add as incomplete</button></>}</div></div></div></article>;
      })}</section>}

      {summary.matched > 0 && <p className="rounded-xl border border-emerald-400/10 bg-emerald-400/[0.03] px-4 py-3 text-[10px] text-emerald-200">Matched rows are already reconciled and do not create or modify transactions. Possible matches and conflicts remain above until you explicitly resolve them.</p>}
    </section>}
  </div>;
}
