"use client";

import { useEffect, useMemo, useState } from "react";
import InvestmentDashboardV6 from "./InvestmentDashboardV6";

 type Account = { id: string; isActive?: boolean };
type OverviewData = {
  holdings?: Array<{ priceAsOf?: string | null }>;
  accounts?: Account[];
};

type Screen = "overview" | "transactions" | "accounts";

const money = (value: number) =>
  `Rp${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

const escCssString = (value: string) => JSON.stringify(value);

export default function InvestmentDashboardV7() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [realizedByAccount, setRealizedByAccount] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/investments", { cache: "no-store" });
        const data: OverviewData = await response.json();
        if (!response.ok || cancelled) return;

        const timestamps = (data.holdings ?? [])
          .map((holding) => holding.priceAsOf)
          .filter(Boolean) as string[];

        if (timestamps.length) {
          const latest = timestamps.reduce((a, b) =>
            new Date(b).getTime() > new Date(a).getTime() ? b : a
          );
          setLastUpdate(new Date(latest));
        }

        const ids = (data.accounts ?? [])
          .filter((account) => account.isActive !== false)
          .map((account) => account.id);

        const realized = await Promise.all(
          ids.map(async (id) => {
            try {
              const ledgerResponse = await fetch(
                `/api/investments/v2?accountId=${encodeURIComponent(id)}`,
                { cache: "no-store" }
              );
              const ledger = await ledgerResponse.json();
              return Number(ledger.summary?.realizedGainLoss ?? 0) || 0;
            } catch {
              return 0;
            }
          })
        );

        if (!cancelled) setRealizedByAccount(realized);
      } catch {
        // Supplemental market/realized data must never block Investments.
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

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
      const response = await fetch("/api/investments/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "market.refresh" }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || "Unable to refresh market prices.");
      }

      const timestamps = (data.updated ?? [])
        .map((item: { asOf?: string | null }) => item.asOf)
        .filter(Boolean) as string[];

      if (timestamps.length) {
        setLastUpdate(
          new Date(
            timestamps.sort(
              (a: string, b: string) =>
                new Date(b).getTime() - new Date(a).getTime()
            )[0]
          )
        );
      }

      window.location.reload();
    } catch (errorValue) {
      setError(
        errorValue instanceof Error
          ? errorValue.message
          : "Unable to refresh market prices."
      );
    } finally {
      setRefreshing(false);
    }
  };

  const totalRealized = useMemo(
    () => realizedByAccount.reduce((sum, value) => sum + value, 0),
    [realizedByAccount]
  );

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

  const realizedValue = money(totalRealized);
  const realizedVars: Record<string, string> = {
    "--realized-pl": escCssString(realizedValue),
  };

  for (let index = 0; index < 10; index += 1) {
    realizedVars[`--realized-${index + 1}`] = escCssString(
      money(realizedByAccount[index] ?? 0)
    );
  }

  const marketData = screen === "transactions" ? (
    <div className="mb-4 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-[#0d151e] px-4 py-3 shadow-sm">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">
          Market Data
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Last price update:{" "}
          <span className="font-semibold text-slate-300">{formatted} WIB</span>
        </p>
        <p className="mt-0.5 text-[10px] text-slate-600">
          Source: Yahoo Finance · Indonesian stocks
        </p>
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
  ) : null;

  return (
    <div
      className={`investment-shell ${screen} min-w-0`}
      style={realizedVars as React.CSSProperties}
    >
      <style>{`
        @media (min-width: 768px) {
          .investment-shell.overview .okane-investment-shell [class~="md:grid-cols-4"] {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }

          .investment-shell.overview .okane-investment-shell [class~="md:grid-cols-4"]::after {
            content: "REALIZED P/L\\A" var(--realized-pl) "\\A net after selling costs";
            white-space: pre-line;
            display: block;
            min-height: 120px;
            box-sizing: border-box;
            border: 1px solid rgba(16, 185, 129, .16);
            border-radius: 1rem;
            background: #0d151e;
            padding: 1.25rem;
            color: #6ee7b7;
            font-size: .875rem;
            font-weight: 700;
            line-height: 1.55;
          }

          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(1)::after,
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(2)::after,
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(3)::after,
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(4)::after,
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(5)::after,
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(6)::after,
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(7)::after,
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(8)::after,
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(9)::after,
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(10)::after {
            display: block;
            margin-top: 1rem;
            border-top: 1px solid rgba(255,255,255,.05);
            padding-top: .75rem;
            text-align: left;
            white-space: pre-line;
            color: #6ee7b7;
            font-size: .75rem;
            line-height: 1.45;
            font-weight: 700;
          }

          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(1)::after { content: "REALIZED P/L · NET\\A" var(--realized-1); }
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(2)::after { content: "REALIZED P/L · NET\\A" var(--realized-2); }
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(3)::after { content: "REALIZED P/L · NET\\A" var(--realized-3); }
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(4)::after { content: "REALIZED P/L · NET\\A" var(--realized-4); }
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(5)::after { content: "REALIZED P/L · NET\\A" var(--realized-5); }
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(6)::after { content: "REALIZED P/L · NET\\A" var(--realized-6); }
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(7)::after { content: "REALIZED P/L · NET\\A" var(--realized-7); }
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(8)::after { content: "REALIZED P/L · NET\\A" var(--realized-8); }
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(9)::after { content: "REALIZED P/L · NET\\A" var(--realized-9); }
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(10)::after { content: "REALIZED P/L · NET\\A" var(--realized-10); }
        }
      `}</style>
      <InvestmentDashboardV6 marketData={marketData} />
    </div>
  );
}
