"use client";

import { FileDown } from "lucide-react";

type Participant = { id: string; name: string; isMe: boolean };
type Allocation = { participantId: string; amount: number };
type Item = { name: string; quantity: number; unitPrice: number; allocations: Allocation[] };

type Props = {
  merchantName: string;
  transactionDate: string | null;
  currencySymbol: string;
  totalAmount: number;
  participants: Participant[];
  items: Item[];
};

function money(value: number, symbol: string) {
  return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", "\"": "&quot;" }[character] ?? character));
}

export default function SplitBillPdfButton(props: Props) {
  function openPdf() {
    const date = props.transactionDate
      ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(props.transactionDate))
      : "Draft";

    const peopleHtml = props.participants.map((person) => {
      const rows = props.items.flatMap((item) => {
        const allocation = item.allocations.find((entry) => entry.participantId === person.id);
        if (!allocation || allocation.amount <= 0) return [];
        return [`<tr><td>${escapeHtml(item.name)}</td><td class="qty">${item.quantity}</td><td class="amount">${money(allocation.amount, props.currencySymbol)}</td></tr>`];
      }).join("");
      const subtotal = props.items.reduce((sum, item) => sum + (item.allocations.find((entry) => entry.participantId === person.id)?.amount ?? 0), 0);
      const tax = props.items.filter((item) => item.name === "Tax / PPN").reduce((sum, item) => sum + (item.allocations.find((entry) => entry.participantId === person.id)?.amount ?? 0), 0);
      const service = props.items.filter((item) => item.name === "Service Fee").reduce((sum, item) => sum + (item.allocations.find((entry) => entry.participantId === person.id)?.amount ?? 0), 0);
      const itemSubtotal = subtotal - tax - service;
      const total = subtotal;

      return `<section class="person"><div class="person-head"><div><h2>${escapeHtml(person.name)}${person.isMe ? " <span>(You)</span>" : ""}</h2><p>Personal share</p></div><strong>${money(total, props.currencySymbol)}</strong></div><table><thead><tr><th>Item</th><th class="qty">Qty</th><th class="amount">Amount</th></tr></thead><tbody>${rows}</tbody></table><div class="totals"><div><span>Subtotal</span><strong>${money(itemSubtotal, props.currencySymbol)}</strong></div>${tax > 0 ? `<div><span>Tax / PPN</span><strong>${money(tax, props.currencySymbol)}</strong></div>` : ""}${service > 0 ? `<div><span>Service Fee</span><strong>${money(service, props.currencySymbol)}</strong></div>` : ""}<div class="grand"><span>Total</span><strong>${money(total, props.currencySymbol)}</strong></div></div></section>`;
    }).join("");

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>OKANE - ${escapeHtml(props.merchantName)}</title><style>
      *{box-sizing:border-box}body{margin:0;background:#fff;color:#172A3D;font-family:Arial,Helvetica,sans-serif;font-size:12px}main{width:720px;margin:0 auto;padding:42px 46px}.brand{font-size:24px;font-weight:800;letter-spacing:.12em;color:#0f766e}.label{margin-top:4px;font-size:9px;font-weight:700;letter-spacing:.18em;color:#64748b}.header{padding-bottom:20px;border-bottom:2px solid #172A3D}.header h1{margin:18px 0 4px;font-size:22px}.header p{margin:0;color:#64748b}.person{margin-top:22px;border:1px solid #d8dee6;border-radius:12px;padding:16px;break-inside:avoid}.person-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.person-head h2{margin:0;font-size:15px}.person-head h2 span{font-size:10px;color:#0f766e}.person-head p{margin:4px 0 0;color:#64748b;font-size:10px}.person-head strong{font-size:16px;color:#0f766e}table{width:100%;border-collapse:collapse;margin-top:14px}th{padding:7px 0;text-align:left;border-bottom:1px solid #d8dee6;color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:.08em}td{padding:7px 0;border-bottom:1px solid #eef1f4}th.qty,td.qty{width:50px;text-align:center}th.amount,td.amount{text-align:right}.totals{margin-top:10px;margin-left:auto;width:260px}.totals div{display:flex;justify-content:space-between;padding:4px 0}.totals span{color:#64748b}.totals strong{font-weight:600}.totals .grand{margin-top:5px;padding-top:9px;border-top:2px solid #172A3D;font-size:14px}.totals .grand span,.totals .grand strong{color:#172A3D}.footer{margin-top:28px;padding-top:14px;border-top:1px solid #d8dee6;text-align:center;color:#94a3b8;font-size:9px;letter-spacing:.06em}@media print{main{width:auto;margin:0;padding:28px 34px}.person{break-inside:avoid}}@page{size:A4;margin:0}
    </style></head><body><main><header class="header"><div class="brand">OKANE</div><div class="label">SPLIT BILL</div><h1>${escapeHtml(props.merchantName)}</h1><p>${date} · Total Bill ${money(props.totalAmount, props.currencySymbol)}</p></header>${peopleHtml}<div class="footer">Generated from OKANE · Split Bill</div></main><script>window.onload=function(){window.focus();window.print();}</script></body></html>`;

    const popup = window.open("", "_blank", "width=820,height=900");
    if (!popup) return;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }

  return <button type="button" onClick={openPdf} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px] font-semibold text-slate-300 transition hover:border-emerald-400/20 hover:bg-emerald-400/5 hover:text-emerald-300" title="Print / Save Split Bill as PDF"><FileDown size={13} /> PDF</button>;
}
