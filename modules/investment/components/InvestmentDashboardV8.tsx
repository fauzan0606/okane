"use client";

import { useEffect, useState, type CSSProperties, type MouseEvent } from "react";
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

        const ledgers = await Promise.all(
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

  const handleClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest("button");
    const label = button?.textContent?.trim().toLowerCase();
    if (label === "overview") setScreen("overview");
    if (label === "transactions") setScreen("transactions");
    if (label === "accounts") setScreen("accounts");
  };

  const realizedStyle = {
    "--realized-pl": formatIDR(realizedPL),
    "--realized-color": realizedPL >= 0 ? "#6ee7b7" : "#fca5a5",
  } as CSSProperties;

  return (
    <div
      onClickCapture={handleClickCapture}
      className={`investment-shell ${screen}`}
      style={realizedStyle}
    >
      <style>{`
        @media (min-width: 768px) {
          .investment-shell.overview > div > section:first-of-type > div:first-child {
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .investment-shell.overview > div > section:first-of-type > div:first-child::after {
            content: "REALIZED P/L\\A" var(--realized-pl) "\\A Net realized profit after selling costs";
            white-space: pre-line;
            display: block;
            min-height: 120px;
            border: 1px solid rgba(52, 211, 153, 0.15);
            border-radius: 1rem;
            background: #0d151e;
            padding: 1.25rem;
            color: var(--realized-color);
            box-sizing: border-box;
            font-size: 0.875rem;
            font-weight: 700;
            line-height: 1.55;
            letter-spacing: 0.01em;
          }
        }
      `}</style>
      <InvestmentDashboardV7 />
    </div>
  );
}
