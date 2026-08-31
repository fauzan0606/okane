"use client";

import { useEffect, useState, type MouseEvent } from "react";
import InvestmentDashboardV7 from "./InvestmentDashboardV7";

type Account = { id: string };
type OverviewResponse = { accounts?: Account[] };
type LedgerResponse = { summary?: { realizedGainLoss?: string | number | null } };
type Screen = "overview" | "transactions" | "accounts";

const formatIDR = (value: number) =>
  `Rp${new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;

export default function InvestmentDashboardV8() {
  const [screen, setScreen] = useState<Screen>("overview");
  const [realizedPL, setRealizedPL] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadRealizedPL = async () => {
      try {
        const response = await fetch("/api/investments", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as OverviewResponse;
        const values = await Promise.all(
          (data.accounts ?? []).map(async (account) => {
            try {
              const ledgerResponse = await fetch(
                `/api/investments/v2?accountId=${encodeURIComponent(account.id)}`,
                { cache: "no-store" },
              );
              if (!ledgerResponse.ok) return 0;
              const ledger = (await ledgerResponse.json()) as LedgerResponse;
              return Number(ledger.summary?.realizedGainLoss ?? 0) || 0;
            } catch {
              return 0;
            }
          }),
        );
        if (!cancelled) setRealizedPL(values.reduce((sum, value) => sum + value, 0));
      } catch {
        if (!cancelled) setRealizedPL(0);
      }
    };
    void loadRealizedPL();
    return () => { cancelled = true; };
  }, []);

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest("button");
    const label = button?.textContent?.trim().toLowerCase();
    if (label === "overview") setScreen("overview");
    if (label === "transactions") setScreen("transactions");
    if (label === "accounts") setScreen("accounts");
  };

  return (
    <div onClickCapture={handleClickCapture} className="relative w-full">
      {screen === "overview" && (
        <div
          aria-label="Realized P/L"
          className="pointer-events-none absolute right-8 top-[132px] z-10 hidden h-[120px] min-w-[210px] max-w-[280px] rounded-2xl border border-emerald-400/15 bg-[#0d151e] p-5 md:block"
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Realized P/L</p>
          <p className={`mt-2 text-xl font-bold ${realizedPL >= 0 ? "text-emerald-300" : "text-red-300"}`}>
            {formatIDR(realizedPL)}
          </p>
          <p className="mt-1 text-[10px] text-slate-600">Net realized profit after selling costs</p>
        </div>
      )}
      <InvestmentDashboardV7 />
    </div>
  );
}
