"use client";

import { useEffect, useState } from "react";
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
        const data = (await response.json()) as OverviewResponse;
        if (!response.ok || cancelled) return;

        const accounts = data.accounts ?? [];
        const ledgers = await Promise.all(
          accounts.map(async (account) => {
            const ledgerResponse = await fetch(
              `/api/investments/v2?accountId=${encodeURIComponent(account.id)}`,
              { cache: "no-store" },
            );
            if (!ledgerResponse.ok) return 0;
            const ledger = (await ledgerResponse.json()) as LedgerResponse;
            return Number(ledger.summary?.realizedGainLoss ?? 0) || 0;
          }),
        );

        if (!cancelled) {
          setRealizedPL(ledgers.reduce((sum, value) => sum + value, 0));
        }
      } catch {
        if (!cancelled) setRealizedPL(0);
      }
    };

    void loadRealizedPL();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest("button");
    const label = button?.textContent?.trim().toLowerCase();
    if (label === "overview") setScreen("overview");
    if (label === "transactions") setScreen("transactions");
    if (label === "accounts") setScreen("accounts");
  };

  return (
    <div onClickCapture={handleClickCapture} className="relative">
      {screen === "overview" && (
        <div className="pointer-events-none absolute left-1/2 top-[150px] z-20 hidden w-[calc(25%-12px)] -translate-x-[-12px] md:block">
          <div className="h-[120px] rounded-2xl border border-emerald-400/15 bg-[#0d151e] p-5 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Realized P/L
            </p>
            <p
              className={`mt-2 text-xl font-bold ${
                realizedPL >= 0 ? "text-emerald-300" : "text-red-300"
              }`}
            >
              {formatIDR(realizedPL)}
            </p>
            <p className="mt-1 text-[10px] text-slate-600">
              Net realized profit after selling costs
            </p>
          </div>
        </div>
      )}
      <InvestmentDashboardV7 />
    </div>
  );
}
