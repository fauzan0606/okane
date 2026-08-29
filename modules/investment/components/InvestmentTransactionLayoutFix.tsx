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
  const panel = heading.closest<HTMLElement>("section");
  if (!panel) return;
  const grid = panel.parentElement as HTMLElement | null;
  if (!grid) return;
  const balances = Array.from(grid.children).find((child) => (child as HTMLElement).querySelector?.("h2")?.textContent?.trim() === "Balances") as HTMLElement | undefined;
  if (!balances) return;

  grid.style.gridTemplateColumns = "minmax(0, 1fr)";
  grid.style.width = "100%";
  panel.style.width = "100%";
  balances.style.width = "100%";
  panel.style.gridColumn = "1 / -1";
  balances.style.gridColumn = "1 / -1";
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
