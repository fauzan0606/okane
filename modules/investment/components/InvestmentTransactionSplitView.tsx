"use client";

import { PropsWithChildren, useEffect } from "react";

type Sale = { id: string; date: string; quantity: string | number; price: string | number; proceeds: string | number; realized: string | number };
type Row = {
  transactionDate: string;
  asset: { symbol?: string | null; name: string; assetType: string; currency: { code: string } };
  quantity: string | number;
  soldQuantity: string | number;
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
function price(value: string | number, code: string) { return money(value, code); }

async function renderSplitLedger() {
  const tables = Array.from(document.querySelectorAll<HTMLTableElement>("table"));
  const table = tables.find((t) => Array.from(t.querySelectorAll("thead th")).some((th) => th.textContent?.trim() === "P/L"));
  if (!table || table.dataset.splitLedgerEnhanced === "1") return;

  const heading = Array.from(document.querySelectorAll("h2")).find((h) => {
    const text = h.textContent?.trim() ?? "";
    return text && Array.from(h.parentElement?.parentElement?.querySelectorAll("button") ?? []).some((b) => b.textContent?.includes("+ Transaction"));
  });
  if (!heading) return;

  const overviewResponse = await fetch("/api/investments", { cache: "no-store" });
  const overview = await overviewResponse.json();
  const candidates = (overview.accounts ?? []).filter((a: any) => a.provider?.name === heading.textContent?.trim() && a.isActive !== false);
  const account = candidates[0];
  if (!account?.id) return;

  const ledgerResponse = await fetch(`/api/investments/v2?accountId=${encodeURIComponent(account.id)}`, { cache: "no-store" });
  const ledger = await ledgerResponse.json();
  if (!ledgerResponse.ok || !Array.isArray(ledger.rows)) return;

  const header = table.querySelector("thead tr");
  const body = table.querySelector("tbody");
  if (!header || !body) return;

  header.innerHTML = "";
  [
    ["Date", "w-[10%]"], ["Asset", "w-[11%]"], ["Buy", "w-[10%]"], ["Sell", "w-[10%]"],
    ["Cost", "w-[14%]"], ["Remaining", "w-[10%]"], ["Current", "w-[11%]"], ["Min. Sell", "w-[11%]"], ["P/L", "w-[10%]"], ["Action", "w-[11%] text-right pr-2"],
  ].forEach(([label, className]) => {
    const th = document.createElement("th");
    th.className = String(className);
    th.textContent = String(label);
    if (label === "Date") th.classList.add("px-2", "py-3");
    header.appendChild(th);
  });

  body.innerHTML = "";
  for (const row of ledger.rows as Row[]) {
    const code = row.asset.currency.code;
    const stock = row.asset.assetType === "STOCK";
    const originalQty = Number(row.quantity) || 0;
    const sales = row.sales ?? [];
    const sold = sales.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
    const remaining = Math.max(0, Number(row.remainingQuantity) || 0);

    const makeRow = (cells: Array<string>, soldState: boolean) => {
      const tr = document.createElement("tr");
      cells.forEach((text, index) => {
        const td = document.createElement("td");
        td.className = index === 9 ? "text-right pr-2" : index === 0 ? "px-2 py-3 text-slate-400" : "";
        if (index === 1) td.innerHTML = `<b class="text-white">${row.asset.symbol || row.asset.name}</b><div class="text-[10px] text-slate-600">${row.asset.name}</div>`;
        else td.textContent = text;
        if (soldState) tr.className = "bg-white/[.012]";
        tr.appendChild(td);
      });
      body.appendChild(tr);
    };

    for (const sale of sales) {
      const soldCost = originalQty > 0 ? Number(row.totalCost) * (Number(sale.quantity) / originalQty) : 0;
      makeRow([
        new Date(sale.date).toLocaleDateString("id-ID"),
        "", price(row.unitPrice, code), price(sale.price, code), money(soldCost, code), `${qty(sale.quantity, row.asset.assetType)} sold`, "—", "—", money(sale.realized, code), "SOLD",
      ], true);
    }

    if (remaining > 0) {
      makeRow([
        new Date(row.transactionDate).toLocaleDateString("id-ID"),
        "", price(row.unitPrice, code), "—", money(Number(row.totalCost) * (remaining / Math.max(originalQty, 1)), code), qty(remaining, row.asset.assetType), row.currentPrice == null ? "—" : price(row.currentPrice, code), money(row.minimumSellPrice, code), money(row.unrealizedGainLoss, code), "",
      ], false);
      const tr = body.lastElementChild as HTMLTableRowElement | null;
      if (tr) {
        const action = tr.lastElementChild;
        if (action) {
          const source = Array.from(table.querySelectorAll("tbody tr"))[table.querySelectorAll("tbody tr").length - 1];
          void source;
          action.textContent = "OPEN";
          action.className = "text-right pr-2 font-semibold text-emerald-300";
        }
      }
    }
  }

  table.dataset.splitLedgerEnhanced = "1";
}

export default function InvestmentTransactionSplitView({ children }: PropsWithChildren) {
  useEffect(() => {
    let timer: number | undefined;
    const run = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void renderSplitLedger().catch(() => undefined); }, 80);
    };
    run();
    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, []);

  return <>{children}</>;
}
