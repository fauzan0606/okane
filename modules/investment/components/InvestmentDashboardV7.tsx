"use client";

import { useEffect } from "react";
import InvestmentDashboardV6 from "./InvestmentDashboardV6";

type AccountSummary = {
  id: string;
  providerName: string;
  currencyCode: string;
  realizedGainLoss: number;
};

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
  useEffect(() => {
    let realizedByAccount: AccountSummary[] = [];
    let totalRealized = 0;
    let primaryCurrency = "IDR";
    let loaded = false;
    let decorateTimer: ReturnType<typeof setTimeout> | null = null;

    const decorate = () => {
      if (!loaded) return;

      const overviewHeading = Array.from(document.querySelectorAll("h2")).find(
        (el) => el.textContent?.trim() === "Investment Accounts",
      );
      const overviewSection = overviewHeading?.closest("section");

      if (overviewSection) {
        const cards = Array.from(overviewSection.querySelectorAll<HTMLElement>("button")).filter(
          (button) => button.textContent?.includes("Open →"),
        );
        cards.forEach((button, index) => {
          const match = realizedByAccount[index];
          if (match) addRealizedMetric(button, match.realizedGainLoss, match.currencyCode);
        });
      }

      const totalCard = Array.from(document.querySelectorAll("p")).find(
        (el) => el.textContent?.trim() === "Unrealized P/L",
      )?.closest("div.rounded-2xl");
      const summaryGrid = totalCard?.parentElement;
      if (summaryGrid) {
        if (summaryGrid.className.includes("md:grid-cols-4")) {
          summaryGrid.className = summaryGrid.className.replace("md:grid-cols-4", "md:grid-cols-5");
        }
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

      const accountDetailMarker = Array.from(document.querySelectorAll("p")).find(
        (el) => el.textContent?.trim() === "Account Detail",
      );
      if (accountDetailMarker) {
        const accountSection = accountDetailMarker.closest("section");
        const historyTitle = accountSection
          ? Array.from(accountSection.querySelectorAll("h3")).find((el) => el.textContent?.trim() === "RDN Transaction History")
          : undefined;
        const historyControls = historyTitle?.parentElement?.parentElement;
        const showButton = historyControls
          ? Array.from(historyControls.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Show")
          : undefined;
        showButton?.click();
      }
    };

    const loadRealized = async () => {
      try {
        const overviewResponse = await fetch("/api/investments", { cache: "no-store" });
        const overview = await overviewResponse.json();
        if (!overviewResponse.ok || !Array.isArray(overview.accounts)) return;

        const results = await Promise.all(
          overview.accounts.map(async (account: { id: string; provider?: { name?: string }; currency?: { code?: string } }) => {
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
          }),
        );

        realizedByAccount = results.filter(Boolean) as AccountSummary[];
        primaryCurrency = String(overview.summary?.primaryCurrency ?? "IDR");
        totalRealized = realizedByAccount
          .filter((account) => account.currencyCode === primaryCurrency)
          .reduce((sum, account) => sum + account.realizedGainLoss, 0);
        loaded = true;
        decorate();
      } catch {
        // The underlying V6 dashboard remains usable if realized P/L cannot be loaded.
      }
    };

    const scheduleDecorate = () => {
      if (decorateTimer) clearTimeout(decorateTimer);
      decorateTimer = setTimeout(decorate, 50);
    };

    loadRealized();
    const observer = new MutationObserver(scheduleDecorate);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (decorateTimer) clearTimeout(decorateTimer);
    };
  }, []);

  return <InvestmentDashboardV6 />;
}
