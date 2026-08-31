"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import InvestmentDashboardV6 from "./InvestmentDashboardV6";

type OverviewData = {
  summary?: {
    totalInvestmentValue?: string | number | null;
    totalCash?: string | number | null;
    totalValue?: string | number | null;
    unrealized?: string | number | null;
    returnPct?: string | number | null;
  };
  holdings?: Array<{ priceAsOf?: string | null }>;
  accounts?: Array<{ id: string; isActive?: boolean }>;
};

type Screen = "overview" | "transactions" | "accounts";

const money = (v: number) => `Rp${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`;
const numeric = (v: string | number | null | undefined) => Number(v ?? 0) || 0;

export default function InvestmentDashboardV7() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [realized, setRealized] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/investments", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok || cancelled) return;
        setOverview(d);
        const ts = (d.holdings ?? []).map((h: { priceAsOf?: string | null }) => h.priceAsOf).filter(Boolean);
        if (ts.length) {
          setLastUpdate(new Date(ts.reduce((a: string, b: string) => new Date(b).getTime() > new Date(a).getTime() ? b : a)));
        }
        const ids = (d.accounts ?? []).filter((a: { isActive?: boolean }) => a.isActive !== false).map((a: { id: string }) => a.id);
        const ledgers = await Promise.all(ids.map(async (id: string) => {
          try {
            const lr = await fetch(`/api/investments/v2?accountId=${encodeURIComponent(id)}`, { cache: "no-store" });
            const l = await lr.json();
            return Number(l.summary?.realizedGainLoss ?? 0) || 0;
          } catch {
            return 0;
          }
        }));
        if (!cancelled) setRealized(ledgers);
      } catch {
        // Supplemental metadata must not block the dashboard.
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const refreshPrices = async () => {
    setRefreshing(true);
    setError("");
    try {
      const r = await fetch("/api/investments/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "market.refresh" }),
      });
      const d = await r.json();
      if (!r.ok || d.error) throw new Error(d.error || "Unable to refresh market prices.");
      const ts = (d.updated ?? []).map((x: { asOf?: string | null }) => x.asOf).filter(Boolean);
      setLastUpdate(new Date(ts.length ? ts.sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0] : Date.now()));
      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to refresh market prices.");
    } finally {
      setRefreshing(false);
    }
  };

  const totalRealized = useMemo(() => realized.reduce((s, v) => s + v, 0), [realized]);
  const formatted = lastUpdate
    ? new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(lastUpdate)
    : "Belum tersedia";

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest("button");
    const label = button?.textContent?.trim().toLowerCase();
    if (label === "overview") setScreen("overview");
    else if (label === "transactions") setScreen("transactions");
    else if (label === "accounts") setScreen("accounts");
  };

  const summary = overview?.summary;

  return (
    <div className={`okane-investment-shell ${screen}`} onClickCapture={handleClickCapture}>
      <style jsx>{`
        .okane-investment-shell .market-data-panel { display: none; }
        .okane-investment-shell.transactions .market-data-panel { display: flex; }
        .okane-investment-shell.overview section > div[class*="md:grid-cols-4"] { display: none !important; }
        @media (max-width: 767px) {
          .investment-overview-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>

      {screen === "overview" && summary && (
        <div className="investment-overview-summary mx-auto mb-5 grid w-full max-w-[1450px] grid-cols-1 gap-3 px-5 pt-1 md:grid-cols-5 lg:px-8">
          <div className="rounded-2xl border border-white/10 bg-[#0d151e] p-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Total Investment</p>
            <p className="mt-2 text-xl font-bold text-white">{money(numeric(summary.totalInvestmentValue))}</p>
            <p className="mt-1 text-[10px] text-slate-600">portfolio + cash</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d151e] p-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">RDN Cash</p>
            <p className="mt-2 text-xl font-bold text-white">{money(numeric(summary.totalCash))}</p>
            <p className="mt-1 text-[10px] text-slate-600">all settlement balances</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d151e] p-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Portfolio</p>
            <p className="mt-2 text-xl font-bold text-white">{money(numeric(summary.totalValue))}</p>
            <p className="mt-1 text-[10px] text-slate-600">current market value</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-[#0d151e] p-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Unrealized P/L</p>
            <p className={`mt-2 text-xl font-bold ${numeric(summary.unrealized) >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(numeric(summary.unrealized))}</p>
            <p className="mt-1 text-[10px] text-slate-600">{numeric(summary.returnPct).toFixed(2)}% return</p>
          </div>
          <div className="rounded-2xl border border-emerald-400/15 bg-[#0d151e] p-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Realized P/L</p>
            <p className={`mt-2 text-xl font-bold ${totalRealized >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(totalRealized)}</p>
            <p className="mt-1 text-[10px] text-slate-600">net after selling costs</p>
          </div>
        </div>
      )}

      <div className="market-data-panel mx-auto mb-4 w-full max-w-[1450px] items-center justify-between rounded-2xl border border-white/10 bg-[#0d151e] px-4 py-3 shadow-sm">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Market Data</p>
          <p className="mt-1 text-xs text-slate-400">Last price update: <span className="font-semibold text-slate-300">{formatted} WIB</span></p>
          <p className="mt-0.5 text-[10px] text-slate-600">Source: Yahoo Finance · Indonesian stocks</p>
          {error && <p className="mt-1 text-[10px] text-red-300">{error}</p>}
        </div>
        <button type="button" onClick={refreshPrices} disabled={refreshing} className="rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] px-4 py-2 text-xs font-bold text-emerald-300 disabled:opacity-50">{refreshing ? "Refreshing…" : "↻ Refresh Prices"}</button>
      </div>

      <InvestmentDashboardV6 />
    </div>
  );
}
