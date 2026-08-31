"use client";

import { useEffect } from "react";
import InvestmentDashboardV7 from "./InvestmentDashboardV7";

export default function InvestmentDashboardV8() {
  useEffect(() => {
    const syncMarketVisibility = () => {
      const market = Array.from(document.querySelectorAll<HTMLElement>("div")).find((el) => {
        const text = el.textContent?.trim() || "";
        return text.startsWith("Market Data") && text.includes("Last price update:") && text.includes("Refresh Prices");
      });
      if (!market) return;

      const transactionTab = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
        (button) => button.textContent?.trim().toUpperCase() === "TRANSACTIONS",
      );
      const transactionsActive = Boolean(transactionTab && transactionTab.className.includes("bg-white"));

      market.style.display = transactionsActive ? "flex" : "none";
    };

    syncMarketVisibility();
    const observer = new MutationObserver(syncMarketVisibility);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return <InvestmentDashboardV7 />;
}
