"use client";

import { useEffect, useRef, useState } from "react";
import InvestmentDashboardV6 from "./InvestmentDashboardV6";

type AccountSummary = {
  id: string;
  providerName: string;
  currencyCode: string;
  realizedGainLoss: number;
};

type PriceSnapshot = { priceAsOf?: string | null };

const formatMoney = (value: number, currencyCode: string) => {
  if (!Number.isFinite(value)) return `${currencyCode}0,00`;
  const symbol = ({ IDR: "Rp", USD: "US$", SGD: "S$", MYR: "RM", JPY: "¥", EUR: "€", GBP: "£" } as Record<string, string>)[currencyCode] ?? currencyCode;
  return `${symbol}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
};

const pnlClass = (value: number) => (value >= 0 ? "text-emerald-300" : "text-red-300");

function addRealizedMetric(parent: HTMLElement, value: number, currencyCode: string) {
  let metric = parent.querySelector<HTMLElement>("[data-okane-realized-pnl]");
  if (!metric) {
    metric = document.createElement("div");
    metric.dataset.okaneRealizedPnl = "true";
    metric.className = "mt-3 border-t border-white/5 pt-3";
    parent.appendChild(metric);
  }
  const signature = `${value}|${currencyCode}`;
  if (metric.dataset.signature === signature) return;
  metric.dataset.signature = signature;
  metric.innerHTML = `<p class="text-[10px] text-slate-600">Realized P/L · net</p><p class="mt-1 text-sm font-bold ${pnlClass(value)}">${formatMoney(value, currencyCode)}</p><p class="mt-0.5 text-[9px] text-slate-700">After sell fee, tax & other charges</p>`;
}

export default function InvestmentDashboardV7() {
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [priceRefreshError, setPriceRefreshError] = useState("");
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);
  const marketRef = useRef<HTMLDivElement | null>(null);
  const homeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let realizedByAccount: AccountSummary[] = [];
    let totalRealized = 0;
    let primaryCurrency = "IDR";
    let loaded = false;
    let decorateTimer: ReturnType<typeof setTimeout> | null = null;

    const findAssetCard = () => {
      const heading = Array.from(document.querySelectorAll("h2")).find((el) => el.textContent?.trim() === "Asset Summary");
      return heading?.parentElement?.parentElement as HTMLElement | null;
    };

    const relocateMarketData = () => {
      const market = marketRef.current;
      const home = homeRef.current;
      if (!market || !home) return;

      const assetCard = findAssetCard();
      if (assetCard?.parentElement) {
        market.style.display = "flex";
        const parent = assetCard.parentElement;
        if (market.parentElement !== parent || market.nextSibling !== assetCard) {
          parent.insertBefore(market, assetCard);
        }
      } else {
        market.style.display = "none";
        if (market.parentElement !== home) home.appendChild(market);
      }
    };

    const decorate = () => {
      if (!loaded) return;

      const overviewHeading = Array.from(document.querySelectorAll("h2")).find((el) => el.textContent?.trim() === "Investment Accounts");
      const overviewSection = overviewHeading?.closest("section");
      if (overviewSection) {
        const cards = Array.from(overviewSection.querySelectorAll<HTMLElement>("button")).filter((button) => button.textContent?.includes("Open →"));
        cards.forEach((button, index) => {
          const match = realizedByAccount[index];
          if (match) addRealizedMetric(button, match.realizedGainLoss, match.currencyCode);
        });
      }

      const totalCard = Array.from(document.querySelectorAll("p")).find((el) => el.textContent?.trim() === "Unrealized P/L")?.closest("div.rounded-2xl");
      const summaryGrid = totalCard?.parentElement;
      if (summaryGrid) {
        if (summaryGrid.className.includes("md:grid-cols-4")) summaryGrid.className = summaryGrid.className.replace("md:grid-cols-4", "md:grid-cols-5");
        let realizedCard = summaryGrid.querySelector<HTMLElement>("[data-okane-overview-realized]");
        if (!realizedCard) {
          realizedCard = document.createElement("div");
          realizedCard.dataset.okaneOverviewRealized = "true";
          realizedCard.className = "rounded-2xl border border-white/10 bg-[#0d151e] p-5";
          summaryGrid.appendChild(realizedCard);
        }
        const signature = `${totalRealized}|${primaryCurrency}`;
        if (realizedCard.dataset.signature !== signature) {
          realizedCard.dataset.signature = signature;
          realizedCard.innerHTML = `<p class="text-[10px] uppercase tracking-widest text-slate-500">Realized P/L</p><p class="mt-2 text-xl font-bold ${pnlClass(totalRealized)}">${formatMoney(totalRealized, primaryCurrency)}</p><p class="mt-1 text-[10px] text-slate-600">Net realized profit after selling costs</p>`;
        }
      }

      const accountDetailMarker = Array.from(document.querySelectorAll("p")).find((el) => el.textContent?.trim() === "Account Detail");
      if (accountDetailMarker) {
        const accountSection = accountDetailMarker.closest("section");
        const historyTitle = accountSection ? Array.from(accountSection.querySelectorAll("h3")).find((el) => el.textContent?.trim() === "RDN Transaction History") : undefined;
        const historyControls = historyTitle?.parentElement?.parentElement;
        const showButton = historyControls ? Array.from(historyControls.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Show") : undefined;
        showButton?.click();
      }

      relocateMarketData();
    };

    const loadRealizedAndPriceState = async () => {
      try {
        const overviewResponse = await fetch("/api/investments", { cache: "no-store" });
        const overview = await overviewResponse.json();
        if (!overviewResponse.ok || !Array.isArray(overview.accounts)) return;

        const timestamps = (overview.holdings ?? []).map((holding: PriceSnapshot) => holding.priceAsOf).filter((value: string | null | undefined): value is string => Boolean(value));
        if (timestamps.length) {
          const latest = timestamps.reduce((max: string, value: string) => new Date(value).getTime() > new Date(max).getTime() ? value : max);
          setLastPriceUpdate(new Date(latest));
        }

        const results = await Promise.all(overview.accounts.map(async (account: { id: string; provider?: { name?: string }; currency?: { code?: string } }) => {
          try {
            const response = await fetch(`/api/investments/v2?accountId=${encodeURIComponent(account.id)}`, { cache: "no-store" });
            const ledger = await response.json();
            if (!response.ok) return null;
            return {
              id: account.id,
              providerName: String(account.provider?.name ?? account.id),
              currencyCode: String(account.currency?.code ?? "IDR"),
              realizedGainLoss: Number(ledger?.summary?.realizedGainLoss ?? 0) || 0,
            } as AccountSummary;
          } catch {
            return null;
          }
        }));

        realizedByAccount = results.filter(Boolean) as AccountSummary[];
        primaryCurrency = String(overview.summary?.primaryCurrency ?? "IDR");
        totalRealized = realizedByAccount.filter((account) => account.currencyCode === primaryCurrency).reduce((sum, account) => sum + account.realizedGainLoss, 0);
        loaded = true;
        decorate();
      } catch {
        // Underlying dashboard remains usable if supplemental realized/price state cannot load.
      }
    };

    const scheduleDecorate = () => {
      if (decorateTimer) clearTimeout(decorateTimer);
      decorateTimer = setTimeout(() => {
        decorate();
      }, 50);
    };

    loadRealizedAndPriceState();
    const observer = new MutationObserver(scheduleDecorate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (decorateTimer) clearTimeout(decorateTimer);
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
      if (!response.ok || result.error) throw new Error(result.error || "Unable to refresh market prices.");
      const latest = (result.updated ?? []).map((item: { asOf?: string }) => item.asOf).filter((value: string | undefined): value is string => Boolean(value));
      if (latest.length) {
        const newest = latest.reduce((max: string, value: string) => new Date(value).getTime() > new Date(max).getTime() ? value : max);
        setLastPriceUpdate(new Date(newest));
      } else {
        setLastPriceUpdate(new Date());
      }
      window.location.reload();
    } catch (error) {
      setPriceRefreshError(error instanceof Error ? error.message : "Unable to refresh market prices.");
    } finally {
      setRefreshingPrices(false);
    }
  };

  const lastPriceLabel = lastPriceUpdate
    ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(lastPriceUpdate)
    : "Belum tersedia";

  return (
    <div className="mx-auto w-full max-w-[1450px]">
      <div ref={homeRef} className="hidden" />
      <div
        ref={marketRef}
        className="hidden w-full items-center justify-between rounded-2xl border border-white/10 bg-[#0d151e] px-4 py-3 shadow-sm"
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">Market Data</p>
          <p className="mt-1 text-xs text-slate-400">
            Last price update: <span className="font-semibold text-slate-300">{lastPriceLabel} WIB</span>
          </p>
          <p className="mt-0.5 text-[10px] text-slate-600">Source: Yahoo Finance · Indonesian stocks</p>
          {priceRefreshError && <p className="mt-1 text-[10px] text-red-300">{priceRefreshError}</p>}
        </div>
        <button type="button" onClick={refreshPrices} disabled={refreshingPrices} className="rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] px-4 py-2 text-xs font-bold text-emerald-300 transition hover:bg-emerald-400/[.1] disabled:cursor-not-allowed disabled:opacity-50">
          {refreshingPrices ? "Refreshing…" : "↻ Refresh Prices"}
        </button>
      </div>
      <InvestmentDashboardV6 />
    </div>
  );
}
