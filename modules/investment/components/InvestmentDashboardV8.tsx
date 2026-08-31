"use client";

import { useEffect, useState } from "react";
import InvestmentDashboardV6 from "./InvestmentDashboardV6";

export default function InvestmentDashboardV8() {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/investments", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || cancelled) return;
        const timestamps = (data.holdings ?? [])
          .map((h: { priceAsOf?: string | null }) => h.priceAsOf)
          .filter((v: string | null | undefined): v is string => Boolean(v));
        if (timestamps.length) {
          const latest = timestamps.reduce((max: string, value: string) =>
            new Date(value).getTime() > new Date(max).getTime() ? value : max,
          );
          setLastUpdate(latest);
        }
      } catch {
        // Keep the dashboard usable when supplemental market metadata is unavailable.
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshPrices = async () => {
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/investments/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "market.refresh" }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || "Unable to refresh market prices.");
      const timestamps = (data.updated ?? [])
        .map((item: { asOf?: string }) => item.asOf)
        .filter((v: string | undefined): v is string => Boolean(v));
      setLastUpdate(timestamps.length ? timestamps.sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0] : new Date().toISOString());
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
      }).format(new Date(lastUpdate))
    : "Belum tersedia";

  return (
    <div className="mx-auto w-full max-w-[1450px]">
      <div className="mb-4 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#0d151e] px-4 py-3 shadow-sm">
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
          className="rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] px-4 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-400/[.1] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "↻ Refresh Prices"}
        </button>
      </div>
      <InvestmentDashboardV6 />
    </div>
  );
}
