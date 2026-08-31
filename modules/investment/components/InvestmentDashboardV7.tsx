"use client";

import { useEffect, useState } from "react";
import InvestmentDashboardV6 from "./InvestmentDashboardV6";

type PriceSnapshot = { priceAsOf?: string | null };
type OverviewResponse = { holdings?: PriceSnapshot[] };

export default function InvestmentDashboardV7() {
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [priceRefreshError, setPriceRefreshError] = useState("");
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadLatestPriceUpdate = async () => {
      try {
        const response = await fetch("/api/investments", { cache: "no-store" });
        const data = (await response.json()) as OverviewResponse;
        if (!response.ok || cancelled) return;
        const timestamps = (data.holdings ?? [])
          .map((holding) => holding.priceAsOf)
          .filter((value): value is string => Boolean(value));
        if (!timestamps.length) return;
        const latest = timestamps.reduce((max, value) =>
          new Date(value).getTime() > new Date(max).getTime() ? value : max,
        );
        setLastPriceUpdate(new Date(latest));
      } catch {
        // Keep dashboard usable when market metadata is unavailable.
      }
    };
    void loadLatestPriceUpdate();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPrices = async () => {
    setRefreshingPrices(true);
    setPriceRefreshError("");
    try {
      const response = await fetch("/api/investments/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "market.refresh" }),
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || "Unable to refresh market prices.");
      }
      const timestamps = (result.updated ?? [])
        .map((item: { asOf?: string }) => item.asOf)
        .filter((value: string | undefined): value is string => Boolean(value));
      if (timestamps.length) {
        const latest = timestamps.reduce((max: string, value: string) =>
          new Date(value).getTime() > new Date(max).getTime() ? value : max,
        );
        setLastPriceUpdate(new Date(latest));
      } else {
        setLastPriceUpdate(new Date());
      }
      window.location.reload();
    } catch (error) {
      setPriceRefreshError(
        error instanceof Error ? error.message : "Unable to refresh market prices.",
      );
    } finally {
      setRefreshingPrices(false);
    }
  };

  const lastPriceLabel = lastPriceUpdate
    ? new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(lastPriceUpdate)
    : "Belum tersedia";

  const marketData = (
    <div className="mb-0 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#0d151e] px-4 py-3 shadow-sm">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Market Data</p>
        <p className="mt-1 text-xs text-slate-400">
          Last price update: <span className="font-semibold text-slate-300">{lastPriceLabel} WIB</span>
        </p>
        <p className="mt-0.5 text-[10px] text-slate-600">Source: Yahoo Finance · Indonesian stocks</p>
        {priceRefreshError && <p className="mt-1 text-[10px] text-red-300">{priceRefreshError}</p>}
      </div>
      <button
        type="button"
        onClick={refreshPrices}
        disabled={refreshingPrices}
        className="rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] px-4 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-400/[.1] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {refreshingPrices ? "Refreshing…" : "↻ Refresh Prices"}
      </button>
    </div>
  );

  return <InvestmentDashboardV6 marketData={marketData} />;
}
