"use client";

import { useEffect } from "react";

const widths = ["9%", "8%", "9%", "14%", "9%", "10%", "12%", "10%", "19%"];

function applyTransactionLayout() {
  const table = Array.from(document.querySelectorAll<HTMLTableElement>("table")).find((t) =>
    Array.from(t.querySelectorAll("thead th")).some((th) => th.textContent?.trim() === "Current") &&
    Array.from(t.querySelectorAll("thead th")).some((th) => th.textContent?.trim() === "Min. Sell")
  );
  if (!table) return;
  table.style.tableLayout = "fixed";
  table.style.width = "100%";

  const headers = Array.from(table.querySelectorAll<HTMLTableCellElement>("thead th"));
  headers.forEach((th, i) => {
    if (widths[i]) th.style.width = widths[i];
  });

  const rows = Array.from(table.querySelectorAll<HTMLTableRowElement>("tbody tr"));
  rows.forEach((row) => {
    const action = row.lastElementChild as HTMLTableCellElement | null;
    if (!action) return;
    action.style.width = widths[8];
    action.style.paddingRight = "8px";
    const wrapper = action.firstElementChild as HTMLElement | null;
    if (wrapper) {
      wrapper.style.display = "flex";
      wrapper.style.flexWrap = "wrap";
      wrapper.style.alignItems = "center";
      wrapper.style.justifyContent = "flex-end";
      wrapper.style.gap = "6px";
    }
  });
}

function applyRdnLayout() {
  const heading = Array.from(document.querySelectorAll<HTMLElement>("h2")).find((h) => h.textContent?.trim() === "RDN Cash");
  if (!heading) return;

  // The RDN Cash and Balances cards are children of the same grid section.
  const grid = heading.closest<HTMLElement>("section");
  if (!grid) return;
  const hasBalances = Array.from(grid.querySelectorAll("h2")).some((h) => h.textContent?.trim() === "Balances");
  if (!hasBalances) return;

  grid.style.gridTemplateColumns = "minmax(0, 1fr)";
  grid.style.width = "100%";
  grid.style.display = "grid";
  Array.from(grid.children).forEach((child) => {
    const element = child as HTMLElement;
    element.style.width = "100%";
    element.style.gridColumn = "1 / -1";
  });

  // RDN history is driven by clicking a balance card; do not duplicate that
  // interaction with a second account selector.
  const historyHeading = Array.from(grid.querySelectorAll<HTMLElement>("h3")).find((h) => h.textContent?.trim() === "Riwayat Transaksi RDN");
  const historySection = historyHeading?.closest<HTMLElement>("section");
  if (historySection) {
    const selectors = Array.from(historySection.querySelectorAll<HTMLSelectElement>("select"));
    const historySelector = selectors[0];
    if (historySelector) historySelector.style.display = "none";
  }
}

function applyLayout() {
  applyTransactionLayout();
  applyRdnLayout();
}

export default function InvestmentTransactionLayoutFix() {
  useEffect(() => {
    let timer: number | undefined;
    const run = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(applyLayout, 30);
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, []);

  return null;
}
