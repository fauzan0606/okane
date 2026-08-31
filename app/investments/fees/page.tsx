"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type FeeRule = { id: string; assetType: string; transactionType: string; feeRate: number | string; taxRate: number | string; effectiveFrom: string; sourceUrl?: string | null; sourceLabel?: string | null };
type Provider = { id: string; name: string; countryCode: string; feeRules: FeeRule[] };
type InvestmentApiData = { providers: Provider[] };

export default function InvestmentFeesPage() {
  const [data, setData] = useState<InvestmentApiData | null>(null);
  const [providerId, setProviderId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch("/api/investments", { cache: "no-store" });
    const j = (await r.json()) as InvestmentApiData & { error?: string };
    if (!r.ok) throw new Error(j.error ?? "Failed to load fee rules.");
    setData(j);
    setProviderId((current) => current || j.providers[0]?.id || "");
  }, []);

  useEffect(() => {
    queueMicrotask(() => { void load().catch((e: unknown) => setMessage(e instanceof Error ? e.message : "Failed to load fee rules.")); });
  }, [load]);

  const refresh = async () => {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/investments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "fee.refresh", providerId, effectiveFrom: new Date().toISOString() }) });
      const j = (await r.json()) as { error?: string; buyFee?: number; sellFee?: number; sellTax?: number };
      if (!r.ok) throw new Error(j.error ?? "Refresh failed.");
      setMessage(`Refreshed: buy ${j.buyFee ?? 0}%, sell ${j.sellFee ?? 0}%, sell tax ${j.sellTax ?? 0}%.`);
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Refresh failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="min-h-screen bg-[#070c12] p-8 text-slate-300">Loading fee rules…</div>;
  return <div className="min-h-screen bg-[#070c12] p-5 text-slate-100 lg:p-8"><div className="mx-auto max-w-1000"><Link href="/investments" className="text-xs text-emerald-400">← Investments</Link><h1 className="mt-4 text-3xl font-black">Fee & Tax Rules</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Rules are stored with effective dates and source URLs. Refresh is deliberately conservative: if the official pages cannot be safely parsed, no existing rule is changed.</p><div className="mt-6 rounded-2xl border border-white/10 bg-[#0b121b] p-5"><div className="flex flex-wrap items-center gap-3"><select className="rounded-xl border border-white/10 bg-[#0d141e] px-3 py-2.5 text-sm" value={providerId} onChange={e => setProviderId(e.target.value)}>{data.providers.map(p => <option key={p.id} value={p.id}>{p.name} · {p.countryCode}</option>)}</select><button disabled={busy || !providerId} onClick={refresh} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#06110c] disabled:opacity-50">{busy ? "Checking official sources…" : "Refresh official rules"}</button></div>{message && <p className="mt-4 rounded-xl bg-white/5 px-3 py-2 text-sm text-slate-300">{message}</p>}</div><div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-[#0b121b]"><table className="w-full text-left text-sm"><thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-5 py-4">Provider</th><th>Asset</th><th>Type</th><th>Fee</th><th>Tax</th><th>Effective</th><th>Source</th></tr></thead><tbody>{data.providers.flatMap(p => p.feeRules.map(r => <tr key={r.id} className="border-b border-white/5"><td className="px-5 py-4 font-semibold">{p.name}</td><td>{r.assetType}</td><td>{r.transactionType}</td><td>{Number(r.feeRate)}%</td><td>{Number(r.taxRate)}%</td><td>{new Date(r.effectiveFrom).toLocaleDateString("id-ID")}</td><td className="max-w-[260px] truncate text-slate-500">{r.sourceUrl || r.sourceLabel || "Manual"}</td></tr>))}</tbody></table></div></div></div>;
}
