"use client";

import { PropsWithChildren, useEffect } from "react";

function money(value: string | number, code: string) {
  const symbols: Record<string, string> = { IDR: "Rp", USD: "US$", SGD: "S$", MYR: "RM", JPY: "¥", EUR: "€", GBP: "£" };
  return `${symbols[code] ?? code}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

async function enhanceTable() {
  const table = Array.from(document.querySelectorAll<HTMLTableElement>("table")).find((t) => t.innerText.includes("Transaction Lots")) ?? document.querySelector<HTMLTableElement>("table.min-w-\\[1200px\\]");
  if (!table || table.dataset.minSellEnhanced === "1") return;

  const headerCells = Array.from(table.querySelectorAll("thead th"));
  if (!headerCells.length || headerCells.some((cell) => cell.textContent?.trim() === "Min. Sell")) return;

  const header = headerCells.find((cell) => cell.textContent?.trim() === "Current");
  if (!header) return;

  const heading = Array.from(document.querySelectorAll("h2")).find((h) => h.textContent?.trim() && table.closest("section")?.contains(h));
  const providerName = heading?.textContent?.trim();
  if (!providerName) return;

  try {
    const overviewResponse = await fetch("/api/investments", { cache: "no-store" });
    const overview = await overviewResponse.json();
    const candidates = (overview.accounts ?? []).filter((a: any) => a.provider?.name === providerName && a.isActive !== false);
    const account = candidates[0];
    if (!account?.id) return;

    const ledgerResponse = await fetch(`/api/investments/v2?accountId=${encodeURIComponent(account.id)}`, { cache: "no-store" });
    const ledger = await ledgerResponse.json();
    if (!ledgerResponse.ok || !Array.isArray(ledger.rows)) return;

    const th = document.createElement("th");
    th.className = "w-[12%]";
    th.textContent = "Min. Sell";
    header.insertAdjacentElement("afterend", th);

    const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
    rows.forEach((row, index) => {
      const data = ledger.rows[index];
      const td = document.createElement("td");
      td.className = "whitespace-nowrap font-medium text-amber-300";
      td.textContent = data?.remainingQuantity > 0 ? money(data.minimumSellPrice, data.asset?.currency?.code ?? account.currency?.code ?? "IDR") : "—";
      const currentCell = Array.from(row.children).find((cell) => {
        const cells = Array.from(row.children);
        const currentIndex = headerCells.indexOf(header);
        return cells[currentIndex] === cell;
      });
      if (currentCell) currentCell.insertAdjacentElement("afterend", td);
      else row.appendChild(td);
    });

    table.dataset.minSellEnhanced = "1";
  } catch {
    // Enhancement is non-critical; leave the original table intact on failure.
  }
}

export default function InvestmentMinimumSellColumn({ children }: PropsWithChildren) {
  useEffect(() => {
    let timer: number | undefined;
    const run = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void enhanceTable(); }, 50);
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return <>{children}</>;
}
