"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import InvestmentDashboardV6 from "./InvestmentDashboardV6";

const money = (v: number) => `Rp${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}`;
type Screen = "overview" | "transactions" | "accounts";

export default function InvestmentDashboardV7() {
  const [screen, setScreen] = useState<Screen>("overview");
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
        if (ts.length) {
          setLastUpdate(new Date(ts.reduce((a: string, b: string) => new Date(b).getTime() > new Date(a).getTime() ? b : a)));
        }
        const ids = (d.accounts ?? []).filter((a: any) => a.isActive !== false).map((a: any) => a.id);
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
      const ts = (d.updated ?? []).map((x: any) => x.asOf).filter(Boolean);
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

  return (
    <div
      className={`okane-investment-shell ${screen}`}
      onClickCapture={handleClickCapture}
    >
      <style jsx>{`
        .okane-investment-shell .market-data-panel {
          display: none;
        }

        .okane-investment-shell.transactions .market-data-panel {
          display: flex;
        }

        /* The V6 dashboard owns the normal four-card overview summary.
           We expand that same grid and use one static grid pseudo-item as the
           fifth card. No absolute positioning and no DOM mutation are used. */
        @media (min-width: 768px) {
          .okane-investment-shell.overview [class~="md:grid-cols-4"] {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }

          .okane-investment-shell.overview [class~="md:grid-cols-4"]::after {
            content: "REALIZED P/L\\A" var(--realized-total, "Rp0,00") "\\A Net realized profit after selling costs";
            display: flex;
            flex-direction: column;
            justify-content: center;
            min-width: 0;
            min-height: 120px;
            box-sizing: border-box;
            padding: 1.25rem;
            border: 1px solid rgba(52,211,153,.18);
            border-radius: 1rem;
            background: #0d151e;
            white-space: pre-line;
            color: #6ee7b7;
            font-size: .875rem;
            font-weight: 700;
            line-height: 1.55;
          }
        }

        @media (max-width: 767px) {
          .okane-investment-shell.overview [class~="md:grid-cols-4"]::after {
            content: "REALIZED P/L\\A" var(--realized-total, "Rp0,00") "\\A Net realized profit after selling costs";
            display: block;
            min-height: 120px;
            box-sizing: border-box;
            padding: 1.25rem;
            border: 1px solid rgba(52,211,153,.18);
            border-radius: 1rem;
            background: #0d151e;
            white-space: pre-line;
            color: #6ee7b7;
            font-size: .875rem;
            font-weight: 700;
            line-height: 1.55;
          }
        }
      `}</style>

      <div
        className="sr-only"
        style={{ "--realized-total": `"${money(totalRealized)}"` } as React.CSSProperties}
      />

      <div
        className="pointer-events-none hidden"
        style={{ "--realized-total": `"${money(totalRealized)}"` } as React.CSSProperties}
      />

      <div className="realized-css-vars" style={{ "--realized-total": `"${money(totalRealized)}"` } as React.CSSProperties} />

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
