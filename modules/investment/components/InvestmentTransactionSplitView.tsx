"use client";

import { PropsWithChildren, useEffect } from "react";

type Sale = { id: string; date: string; quantity: string | number; price: string | number; proceeds: string | number; realized: string | number };
type Row = {
  transactionDate: string;
  asset: { symbol?: string | null; name: string; assetType: string; currency: { code: string } };
  quantity: string | number;
  remainingQuantity: string | number;
  unitPrice: string | number;
  totalCost: string | number;
  minimumSellPrice: string | number;
  currentPrice: string | number | null;
  unrealizedGainLoss: string | number;
  sales: Sale[];
};

function money(value: string | number, code: string) {
  const symbols: Record<string, string> = { IDR: "Rp", USD: "US$", SGD: "S$", MYR: "RM", JPY: "¥", EUR: "€", GBP: "£" };
  return `${symbols[code] ?? code}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}
function qty(value: string | number, assetType: string) {
  const divisor = assetType === "STOCK" ? 100 : 1;
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format((Number(value) || 0) / divisor);
}
function esc(value: unknown) {
  return String(value ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" } as Record<string, string>)[c]);
}

async function renderSplitLedger() {
  const table = Array.from(document.querySelectorAll<HTMLTableElement>("table")).find((t) => Array.from(t.querySelectorAll("thead th")).some((th) => th.textContent?.trim() === "P/L"));
  if (!table || table.dataset.splitLedgerEnhanced === "1") return;

  const heading = Array.from(document.querySelectorAll("h2")).find((h) => {
    const text = h.textContent?.trim() ?? "";
    return text && Array.from(h.parentElement?.parentElement?.querySelectorAll("button") ?? []).some((b) => b.textContent?.includes("+ Transaction"));
  });
  if (!heading) return;

  const overviewResponse = await fetch("/api/investments", { cache: "no-store" });
  const overview = await overviewResponse.json();
  const account = (overview.accounts ?? []).find((a: any) => a.provider?.name === heading.textContent?.trim() && a.isActive !== false);
  if (!account?.id) return;

  const ledgerResponse = await fetch(`/api/investments/v2?accountId=${encodeURIComponent(account.id)}`, { cache: "no-store" });
  const ledger = await ledgerResponse.json();
  if (!ledgerResponse.ok || !Array.isArray(ledger.rows)) return;

  const header = table.querySelector("thead tr");
  const body = table.querySelector("tbody");
  if (!header || !body) return;
  const originalRows = Array.from(body.querySelectorAll<HTMLTableRowElement>(":scope > tr"));
  if (originalRows.length !== ledger.rows.length) return;

  const headers = ["Date", "Asset", "Buy", "Sell", "Cost", "Remaining", "Current", "Min. Sell", "P/L", "Action"];
  header.innerHTML = "";
  headers.forEach((label, i) => { const th = document.createElement("th"); th.className = i === 1 ? "w-[11%]" : i === 9 ? "w-[11%] text-right pr-2" : ""; th.textContent = label; if (i === 0) th.classList.add("px-2", "py-3"); header.appendChild(th); });

  const addCell = (tr: HTMLTableRowElement, text: string, className = "") => { const td = document.createElement("td"); td.className = className; td.textContent = text; tr.appendChild(td); return td; };

  ledger.rows.forEach((row: Row, rowIndex: number) => {
    const original = originalRows[rowIndex];
    const code = row.asset.currency.code;
    const originalQty = Number(row.quantity) || 0;
    const remaining = Math.max(0, Number(row.remainingQuantity) || 0);
    const sales = row.sales ?? [];
    const originalAction = original.lastElementChild;
    const originalAssetHtml = original.children[1]?.innerHTML ?? `<b class="text-white">${esc(row.asset.symbol || row.asset.name)}</b><div class="text-[10px] text-slate-600">${esc(row.asset.name)}</div>`;

    for (const sale of sales) {
      const soldRow = document.createElement("tr");
      soldRow.className = "bg-white/[.012]";
      addCell(soldRow, new Date(sale.date).toLocaleDateString("id-ID"), "px-2 py-3 text-slate-400");
      const assetCell = document.createElement("td"); assetCell.innerHTML = originalAssetHtml; soldRow.appendChild(assetCell);
      addCell(soldRow, money(row.unitPrice, code));
      addCell(soldRow, money(sale.price, code));
      const soldCost = originalQty > 0 ? Number(row.totalCost) * (Number(sale.quantity) / originalQty) : 0;
      addCell(soldRow, money(soldCost, code));
      addCell(soldRow, `${qty(sale.quantity, row.asset.assetType)} sold`, "font-medium text-slate-300");
      addCell(soldRow, "—");
      addCell(soldRow, "—");
      addCell(soldRow, money(sale.realized, code), Number(sale.realized) >= 0 ? "text-emerald-300" : "text-red-300");
      addCell(soldRow, "SOLD", "text-right pr-2 font-semibold text-slate-500");
      original.before(soldRow);
    }

    // Add Sell column to the existing open row and retain the React-owned Action cell.
    if (original.children.length === 8) {
      const sellCell = document.createElement("td");
      sellCell.textContent = "—";
      original.children[2].insertAdjacentElement("afterend", sellCell);
    }
    if (remaining > 0) {
      const costCell = original.children[4];
      if (costCell) costCell.textContent = money(originalQty > 0 ? Number(row.totalCost) * (remaining / originalQty) : 0, code);
      const remainingCell = original.children[5];
      if (remainingCell) remainingCell.textContent = qty(remaining, row.asset.assetType);
      const currentCell = original.children[6];
      if (currentCell) currentCell.textContent = row.currentPrice == null ? "—" : money(row.currentPrice, code);
      const minSellCell = document.createElement("td");
      minSellCell.textContent = money(row.minimumSellPrice, code);
      minSellCell.className = "whitespace-nowrap font-medium text-amber-300";
      original.children[6].insertAdjacentElement("afterend", minSellCell);
      const pnlCell = original.children[8];
      if (pnlCell) { pnlCell.textContent = money(row.unrealizedGainLoss, code); pnlCell.className = Number(row.unrealizedGainLoss) >= 0 ? "text-emerald-300" : "text-red-300"; }
    } else {
      original.remove();
    }
    void originalAction;
  });

  table.classList.add("table-fixed");
  table.dataset.splitLedgerEnhanced = "1";
}

export default function InvestmentTransactionSplitView({ children }: PropsWithChildren) {
  useEffect(() => {
    let timer: number | undefined;
    const run = () => { window.clearTimeout(timer); timer = window.setTimeout(() => { void renderSplitLedger().catch(() => undefined); }, 80); };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, []);
  return <>{children}</>;
}
