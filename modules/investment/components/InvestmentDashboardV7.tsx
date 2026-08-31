"use client";

import { useEffect, useMemo, useState } from "react";
import InvestmentDashboardV6 from "./InvestmentDashboardV6";

const money = (v: number) => `Rp${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`;

export default function InvestmentDashboardV7() {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [realized, setRealized] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/investments", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok || cancelled) return;
        const ts = (d.holdings ?? []).map((h: any) => h.priceAsOf).filter(Boolean);
        if (ts.length) setLastUpdate(new Date(ts.reduce((a: string, b: string) => new Date(b).getTime() > new Date(a).getTime() ? b : a)));
        const ids = (d.accounts ?? []).filter((a: any) => a.isActive !== false).map((a: any) => a.id);
        const ledgers = await Promise.all(ids.map(async (id: string) => {
          const lr = await fetch(`/api/investments/v2?accountId=${encodeURIComponent(id)}`, { cache: "no-store" });
          const l = await lr.json();
          return Number(l.summary?.realizedGainLoss ?? 0);
        }));
        if (!cancelled) setRealized(ledgers);
      } catch {
        // Supplemental market/realized metadata must not block the dashboard.
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const refreshPrices = async () => {
    setRefreshing(true); setError("");
    try {
      const r = await fetch("/api/investments/v2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "market.refresh" }) });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || "Unable to refresh market prices.");
      const ts = (d.updated ?? []).map((x: any) => x.asOf).filter(Boolean);
      setLastUpdate(new Date(ts.length ? ts.sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0] : Date.now()));
      window.location.reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to refresh market prices."); }
    finally { setRefreshing(false); }
  };

  const totalRealized = useMemo(() => realized.reduce((s, v) => s + v, 0), [realized]);
  const vars = { "--realized-total": `"${money(totalRealized)}"`, "--realized-1": `"${money(realized[0] ?? 0)}"`, "--realized-2": `"${money(realized[1] ?? 0)}"`, "--realized-3": `"${money(realized[2] ?? 0)}"` } as any;
  const formatted = lastUpdate ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(lastUpdate) : "Belum tersedia";

  return <div className="okane-investment-shell mx-auto w-full max-w-[1450px]" style={vars}>
    <style jsx>{`
      .okane-investment-shell .market-data-panel{display:none}
      .okane-investment-shell:has(nav button:nth-of-type(2)[class*="bg-white"]) .market-data-panel{display:flex}
      .okane-investment-shell:has(nav button:nth-of-type(1)[class*="bg-white"]) div[class*="md:grid-cols-4"]{display:grid;grid-template-columns:repeat(5,minmax(0,1fr))}
      .okane-investment-shell:has(nav button:nth-of-type(1)[class*="bg-white"]) div[class*="md:grid-cols-4"]::after{content:"Realized P/L\\A" var(--realized-total);white-space:pre;display:flex;flex-direction:column;justify-content:center;border:1px solid rgba(255,255,255,.1);border-radius:1rem;background:#0d151e;padding:1.25rem;color:#34d399;font-size:1.25rem;font-weight:700}
      .okane-investment-shell:has(nav button:nth-of-type(1)[class*="bg-white"]) div[class*="xl:grid-cols-3"]>button:nth-child(1)::after{content:"Realized P/L · net  " var(--realized-1);display:block;margin-top:1rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.05);color:#34d399;font-size:.75rem;font-weight:600}
      .okane-investment-shell:has(nav button:nth-of-type(1)[class*="bg-white"]) div[class*="xl:grid-cols-3"]>button:nth-child(2)::after{content:"Realized P/L · net  " var(--realized-2);display:block;margin-top:1rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.05);color:#34d399;font-size:.75rem;font-weight:600}
      .okane-investment-shell:has(nav button:nth-of-type(1)[class*="bg-white"]) div[class*="xl:grid-cols-3"]>button:nth-child(3)::after{content:"Realized P/L · net  " var(--realized-3);display:block;margin-top:1rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.05);color:#34d399;font-size:.75rem;font-weight:600}
      @media(max-width:767px){.okane-investment-shell:has(nav button:nth-of-type(1)[class*="bg-white"]) div[class*="md:grid-cols-4"]{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `}</style>
    <div className="market-data-panel mb-4 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#0d151e] px-4 py-3 shadow-sm"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Market Data</p><p className="mt-1 text-xs text-slate-400">Last price update: <span className="font-semibold text-slate-300">{formatted} WIB</span></p><p className="mt-0.5 text-[10px] text-slate-600">Source: Yahoo Finance · Indonesian stocks</p>{error&&<p className="mt-1 text-[10px] text-red-300">{error}</p>}</div><button type="button" onClick={refreshPrices} disabled={refreshing} className="rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] px-4 py-2 text-xs font-bold text-emerald-300 disabled:opacity-50">{refreshing?"Refreshing…":"↻ Refresh Prices"}</button></div>
    <InvestmentDashboardV6 />
  </div>;
}
