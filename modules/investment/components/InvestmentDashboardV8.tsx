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
          (data.accounts ?? []).filter(a => a.isActive !== false).map(async (account) => {
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

  const realized = formatIDR(realizedPL);
  const realizedColor = realizedPL >= 0 ? "#6ee7b7" : "#fca5a5";

  return (
    <div onClickCapture={handleClickCapture} className="investment-shell relative w-full" style={{ "--realized-pl": `"${realized}"`, "--realized-color": realizedColor } as React.CSSProperties}>
      <style>{`
        /* Overview summary: make the Realized P/L a real fifth grid item visually,
           without absolute positioning or overlap. */
        @media (min-width: 768px) {
          .investment-shell.overview .okane-investment-shell [class~="md:grid-cols-4"] {
            grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
          }

          .investment-shell.overview .okane-investment-shell [class~="md:grid-cols-4"]::after {
            content: "REALIZED P/L\\A" var(--realized-pl) "\\A Net realized profit after selling costs";
            white-space: pre-line;
            min-height: 120px;
            border: 1px solid rgba(255,255,255,.10);
            border-radius: 1rem;
            background: #0d151e;
            padding: 1.25rem;
            box-sizing: border-box;
            color: var(--realized-color);
            font-size: 0.875rem;
            font-weight: 700;
            line-height: 1.55;
          }

          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(1)::after,
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(2)::after,
          .investment-shell.overview .okane-investment-shell [class~="xl:grid-cols-3"] > button:nth-child(3)::after {
            content: "REALIZED P/L · NET\\A" var(--realized-pl);
            white-space: pre-line;
            display: block;
            margin-top: 1rem;
            padding-top: .75rem;
            border-top: 1px solid rgba(255,255,255,.05);
            color: var(--realized-color);
            font-size: .75rem;
            line-height: 1.5;
            font-weight: 700;
          }
        }
      `}</style>
      <InvestmentDashboardV7 />
    </div>
  );
}
