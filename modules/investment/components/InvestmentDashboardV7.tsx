"use client";

import { useEffect } from "react";
import InvestmentDashboardV6 from "./InvestmentDashboardV6";

export default function InvestmentDashboardV7() {
  useEffect(() => {
    let lastAccountKey = "";

    const openHistoryForSelectedAccount = () => {
      const marker = Array.from(document.querySelectorAll("p")).find(
        (el) => el.textContent?.trim() === "Account Detail",
      );
      if (!marker) return;

      const accountCard = marker.closest("section") ?? marker.parentElement?.parentElement?.parentElement;
      if (!accountCard) return;

      const heading = Array.from(accountCard.querySelectorAll("h2")).find((el) => el.textContent?.trim());
      const accountKey = heading?.textContent?.trim() ?? "";
      if (!accountKey || accountKey === lastAccountKey) return;

      const historyTitle = Array.from(accountCard.querySelectorAll("h3")).find(
        (el) => el.textContent?.trim() === "RDN Transaction History",
      );
      if (!historyTitle) return;

      const historyContainer = historyTitle.parentElement?.parentElement;
      const showButton = historyContainer
        ? Array.from(historyContainer.querySelectorAll("button")).find(
            (button) => button.textContent?.trim() === "Show",
          )
        : undefined;

      lastAccountKey = accountKey;
      showButton?.click();
    };

    openHistoryForSelectedAccount();
    const observer = new MutationObserver(openHistoryForSelectedAccount);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return <InvestmentDashboardV6 />;
}
