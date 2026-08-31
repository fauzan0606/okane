"use client";

import { useEffect, useState } from "react";
import InvestmentDashboardV6 from "./InvestmentDashboardV6";

type OverviewData = {
  holdings?: Array<{ priceAsOf?: string | null }>;
};

type Screen = "overview" | "transactions" | "accounts";

export default function InvestmentDashboardV7() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch("/api/investments", { cache: "no-store" });
        const d: OverviewData = await r.json();
        if (!r.ok || cancelled) return;

        const timestamps = (d.holdings ?? [])
          .map((h) => h.priceAsOf)
          .filter(Boolean) as string[];

        if (timestamps.length) {
          const latest = timestamps.reduce((a, b) =>
            new Date(b).getTime() > new Date(a).getTime() ? b : a
          );
          setLastUpdate(new Date(latest));
        }
      } catch {
        // Market metadata is supplemental and must not block Investments.
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // V6 owns the actual Investments tabs. This wrapper only mirrors the active
  // tab so the market-price control can be shown on Transactions only.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      const label = button?.textContent?.trim().toLowerCase();
      if (label === "overview") setScreen("overview");
      else if (label === "transactions") setScreen("transactions");
      else if (label === "accounts") setScreen("accounts");
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
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

      if (!r.ok || d.error) {
        throw new Error(d.error || "Unable to refresh market prices.");
      }

      const timestamps = (d.updated ?? [])
        .map((x: { asOf?: string | null }) => x.asOf)
        .filter(Boolean) as string[];

      setLastUpdate(
        new Date(
          timestamps.length
            ? timestamps.sort(
                (a: string, b: string) =>
                  new Date(b).getTime() - new Date(a).getTime()
              )[0]
            : Date.now()
        )
      );

      window.location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to refresh market prices.");
    } finally {
      setRefreshing(false);
    }
  };

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

  return (
    <div className="min-w-0">
      {screen === "transactions" && (
        <div className="mx-auto mb-4 flex w-full max-w-[1450px] items-center justify-between rounded-2xl border border-white/10 bg-[#0d151e] px-4 py-3 shadow-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Market Data</p>
            <p className="mt-1 text-xs text-slate-400">
              Last price update: <span className="font-semibold text-slate-300">{formatted} WIB</span>
            </p>
            <p className="mt-0.5 text-[10px] text-slate-600">Source: Yahoo Finance · Indonesian stocks</p>
            {error && <p className="mt-1 text-[10px] text-red-300">{error}</p>}
          </div>
          <button
            type="button"
            onClick={refreshPrices}
            disabled={refreshing}
            className="rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] px-4 py-2 text-xs font-bold text-emerald-300 disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "↻ Refresh Prices"}
          </button>
        </div>
      )}

      <InvestmentDashboardV6 />
    </div>
  );
}
