"use client";

import { useEffect, useMemo, useState } from "react";
import InvestmentDashboardV6 from "./InvestmentDashboardV6";

type Account = { id: string; isActive?: boolean };
type OverviewData = {
  holdings?: Array<{ priceAsOf?: string | null }>;
  accounts?: Account[];
};

type Screen = "overview" | "transactions" | "accounts";

const money = (v: number) =>
  `Rp${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)}`;

export default function InvestmentDashboardV7() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [realizedByAccount, setRealizedByAccount] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const r = await fetch("/api/investments", { cache: "no-store" });
        const d = await r.json();
        if (!r.ok || cancelled) return;

        setOverview(d);

        const timestamps = (d.holdings ?? [])
          .map((h: { priceAsOf?: string | null }) => h.priceAsOf)
          .filter(Boolean) as string[];
        if (timestamps.length) {
          const latest = timestamps.reduce((a, b) =>
            new Date(b).getTime() > new Date(a).getTime() ? b : a
          );
          setLastUpdate(new Date(latest));
        }

        const ids = (d.accounts ?? [])
          .filter((a: Account) => a.isActive !== false)
          .map((a: Account) => a.id);

        const realized = await Promise.all(
          ids.map(async (id: string) => {
            try {
              const lr = await fetch(
                `/api/investments/v2?accountId=${encodeURIComponent(id)}`,
                { cache: "no-store" }
              );
              const l = await lr.json();
              return Number(l.summary?.realizedGainLoss ?? 0) || 0;
            } catch {
              return 0;
            }
          })
        );

        if (!cancelled) setRealizedByAccount(realized);
      } catch {
        // Supplemental data must never block the main Investments page.
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
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to refresh market prices."
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

  // V6 owns the visual layout. Realized P/L is added only after mount so the
  // server HTML remains identical to the client HTML and hydration is stable.
  useEffect(() => {
    if (screen !== "overview") return;

    const root = document.querySelector(".okane-investment-shell");
    if (!root) return;

    let observer: MutationObserver | null = null;
    let cancelled = false;

    const inject = () => {
      if (cancelled) return;

      const summary = root.querySelector('[class*="md:grid-cols-4"]') as HTMLElement | null;
      if (summary) {
        summary.setAttribute("data-okane-realized-summary-container", "true");

        let summaryCard = summary.querySelector("[data-okane-realized-summary]") as HTMLElement | null;
        if (!summaryCard) {
          summaryCard = document.createElement("div");
          summaryCard.setAttribute("data-okane-realized-summary", "true");
          summaryCard.className = "rounded-2xl border border-emerald-400/15 bg-[#0d151e] p-5";
          summaryCard.innerHTML = `
            <p class="text-[10px] uppercase tracking-widest text-slate-500">Realized P/L</p>
            <p data-okane-realized-summary-value class="mt-2 text-xl font-bold"></p>
            <p class="mt-1 text-[10px] text-slate-600">net after selling costs</p>
          `;
          summary.appendChild(summaryCard);
        }

        const summaryValue = summaryCard.querySelector("[data-okane-realized-summary-value]") as HTMLElement | null;
        if (summaryValue) {
          summaryValue.textContent = money(totalRealized);
          summaryValue.className = `mt-2 text-xl font-bold ${totalRealized >= 0 ? "text-emerald-300" : "text-red-300"}`;
        }
      }

      const accountGrid = root.querySelector('[class*="xl:grid-cols-3"]') as HTMLElement | null;
      if (accountGrid) {
        const accountCards = Array.from(accountGrid.querySelectorAll(":scope > button"));
        accountCards.forEach((button, index) => {
          let value = button.querySelector("[data-okane-realized-account-value]") as HTMLElement | null;
          if (!value) {
            const wrapper = document.createElement("div");
            wrapper.setAttribute("data-okane-realized-account", String(index));
            wrapper.className = "mt-4 border-t border-white/[.05] pt-3 text-left pointer-events-none";

            const label = document.createElement("p");
            label.className = "text-[10px] uppercase tracking-wider text-slate-500";
            label.textContent = "Realized P/L · net";

            value = document.createElement("p");
            value.setAttribute("data-okane-realized-account-value", "true");
            value.className = "mt-1 text-xs font-bold";

            wrapper.append(label, value);
            button.appendChild(wrapper);
          }

          const amount = realizedByAccount[index] ?? 0;
          value.textContent = money(amount);
          value.className = `mt-1 text-xs font-bold ${amount >= 0 ? "text-emerald-300" : "text-red-300"}`;
        });
      }
    };

    const timer = window.setTimeout(inject, 0);
    observer = new MutationObserver(inject);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [screen, realizedByAccount, totalRealized, overview]);

  useEffect(() => {
    const styleId = "okane-realized-summary-layout";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @media (min-width: 768px) {
          .okane-investment-shell [data-okane-realized-summary-container="true"] {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      document.getElementById(styleId)?.remove();
    };
  }, []);

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
