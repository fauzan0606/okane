"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Currency = { id: string; code: string };
type Provider = { id: string; name: string; websiteUrl?: string | null };
type Account = { id: string; name: string; accountType: string; provider: Provider; currency: Currency; accountNumberMasked?: string | null; note?: string | null; isActive?: boolean; cashAccount?: { id: string; balance: string | number } | null };
type Asset = { id: string; symbol?: string | null; name: string; assetType: string; unitName: string; currency: Currency };
type Holding = { id: string; quantity: string | number; costBasis: string | number; currentPrice?: string | number | null; priceAsOf?: string | null; marketValue: string | number; gain: string | number; returnPct: string | number; asset: Asset; account: Account };
type Cash = { id: string; balance: string | number; account: Account };
type Sale = { id: string; date: string; quantity: string | number; price: string | number; proceeds: string | number; realized: string | number };
type LotRow = { id: string; lotId: string; transactionDate: string; asset: Asset; quantity: string | number; soldQuantity: string | number; remainingQuantity: string | number; unitPrice: string | number; totalCost: string | number; minimumSellPrice: string | number; currentPrice: string | number | null; priceAsOf: string | null; currentValue: string | number; unrealizedGainLoss: string | number; sales: Sale[] };
type Ledger = { account: Account; rows: LotRow[]; summary: { openLots: number; openQuantity: string | number; realizedGainLoss: string | number } };
type Overview = { currencies: Currency[]; providers: Provider[]; accounts: Account[]; assets: Asset[]; holdings: Holding[]; cashAccounts: Cash[]; summary: { totalValue: string | number; totalCash: string | number; totalInvestmentValue: string | number; unrealized: string | number; returnPct: string | number } };
type RdnHistoryRow = { id: string; date: string; description: string; debit: string | number; credit: string | number; balance: string | number; movementType: string };
type AssetSummary = { asset: Asset; quantity: number; cost: number; avgCost: number; currentPrice: number | null; marketValue: number; sellFee: number; netValue: number; pnl: number; minSell: number; rows: LotRow[] };
type AccountForm = { providerName: string; websiteUrl: string; rdnBankName: string; rdnAccountNumber: string; buyFeePct: string; sellFeePct: string; currencyId: string };
type Trade = { type: "BUY" | "SELL"; assetId: string; assetQuery: string; quantity: string; unitPrice: string; tax: string; other: string; date: string; sourceLotId: string; fundingCashAccountId: string };
type ClosedEdit = { id: string; asset: Asset; quantity: number; date: string; price: number } | null;
type DividendRow = { id: string; transactionDate: string; netCashAmount: string | number; asset: Asset };
type DividendEdit = { id: string; assetId: string; date: string; amount: string } | null;

const input = "w-full rounded-xl border border-white/10 bg-[#080f17] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600";
const select = `${input} text-slate-300`;
const card = "rounded-2xl border border-white/10 bg-[#0d151e] p-5";
const today = () => new Date().toISOString().slice(0, 10);
const nf = (value: string | number | null | undefined, digits = 2) => { const x = Number(value ?? 0); return Number.isFinite(x) ? new Intl.NumberFormat("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x) : "0"; };
const cp = (code: string) => ({ IDR: "Rp", USD: "US$", SGD: "S$", MYR: "RM", JPY: "¥", EUR: "€", GBP: "£" } as Record<string, string>)[code] ?? code;
const money = (value: string | number | null | undefined, code = "IDR") => `${cp(code)}${nf(value)}`;
const feeInfo = (a: Account) => { try { const p = a.note ? JSON.parse(a.note) as Record<string, unknown> : {}; return { buyFeePct: Number(p.buyFeePct ?? 0) || 0, sellFeePct: Number(p.sellFeePct ?? 0) || 0, rdnBankName: String(p.rdnBankName ?? ""), rdnAccountNumber: String(p.rdnAccountNumber ?? "") }; } catch { return { buyFeePct: 0, sellFeePct: 0, rdnBankName: "", rdnAccountNumber: "" }; } };
// Stocks are entered in lots in the UI; one lot represents 100 shares.
// When a new stock ticker is being typed, asset is temporarily undefined,
// so default to stock lot sizing rather than silently using 1 unit.
const unitsPerLot = (a?: Asset) => !a || a.assetType === "STOCK" ? 100 : 1;
const assetLabel = (a: Asset) => a.symbol ? `${a.symbol} · ${a.name}` : a.name;

function DividendImport({ accountId, onDone }: { accountId: string; onDone: () => void | Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function handle(file: File) {
    if (!accountId) { setMessage('Pilih investment account terlebih dahulu.'); return; }
    setBusy(true); setMessage('');
    try {
      const form = new FormData();
      form.set('action', 'dividend.import.excel');
      form.set('accountId', accountId);
      form.set('file', file);
      const response = await fetch('/api/investments/v2', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Dividend import failed.');
      await onDone();
      setMessage('Imported ' + (data.imported ?? 0) + ', skipped ' + (data.skipped ?? 0) + '.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Dividend import failed.');
    } finally {
      setBusy(false);
    }
  }
  return <div className='flex items-center gap-2'><label className='cursor-pointer rounded-lg border border-emerald-400/20 px-3 py-2 text-xs font-bold text-emerald-300'>{busy ? 'Importing…' : 'Upload Excel'}<input type='file' accept='.xlsx,.xls,.csv' className='hidden' disabled={busy} onChange={e => { const file = e.target.files?.[0]; if (file) void handle(file); e.currentTarget.value = ''; }} /></label>{message && <span className='text-[10px] text-slate-500'>{message}</span>}</div>;
}


async function getOverview(): Promise<Overview> { const r = await fetch("/api/investments", { cache: "no-store" }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Unable to load investments."); return j; }
async function postV2(body: Record<string, unknown>) { const r = await fetch("/api/investments/v2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Investment operation failed."); return j; }
async function postV4(body: Record<string, unknown>) { const r = await fetch("/api/investments/v4", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Investment operation failed."); return j; }

function AssetPicker({ assets, value, selectedId, onChange, onSelect }: { assets: Asset[]; value: string; selectedId: string; onChange: (v: string) => void; onSelect: (a: Asset) => void }) {
  const [open, setOpen] = useState(false);
  const q = value.trim().toLowerCase();
  const filtered = useMemo(() => assets.filter(a => !q || assetLabel(a).toLowerCase().includes(q) || String(a.symbol ?? "").toLowerCase() === q || a.name.toLowerCase().includes(q)).slice(0, 12), [assets, q]);
  return <div className="relative"><input className={`${input} ${selectedId ? "border-emerald-400/40" : ""}`} placeholder="Asset / Stock (type to search)" value={value} autoComplete="off" onFocus={() => setOpen(true)} onChange={e => { const next = e.target.value; onChange(next); setOpen(true); const exact = assets.find(a => String(a.symbol ?? "").toLowerCase() === next.trim().toLowerCase() || assetLabel(a).toLowerCase() === next.trim().toLowerCase()); if (exact) onSelect(exact); }} /><div className="mt-1">{open && filtered.length > 0 && <div className="absolute left-0 right-0 top-full z-[120] mt-1 max-h-52 overflow-y-auto rounded-xl border border-white/10 bg-[#0b121a] p-1 shadow-2xl">{filtered.map(a => <button key={a.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onSelect(a); setOpen(false); }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-white/[.05]"><span><span className="block text-sm font-semibold text-white">{a.symbol || a.name}</span><span className="block text-[10px] text-slate-500">{a.name}</span></span><span className="text-[9px] uppercase text-slate-600">{a.assetType}</span></button>)}</div>}{open && q && filtered.length === 0 && <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[.04] px-3 py-2 text-[11px] text-emerald-300">Kode “{value.trim().toUpperCase()}” akan dibuat otomatis saat BUY disimpan.</div>}</div></div>;
}

function AccountModal({ open, editing, form, currencies, onClose, onChange, onSubmit, busy }: { open: boolean; editing: Account | null; form: AccountForm; currencies: Currency[]; onClose: () => void; onChange: (f: AccountForm) => void; onSubmit: (e: FormEvent) => void; busy: boolean }) { if (!open) return null; return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={onSubmit} className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b121a] p-6 shadow-2xl"><div className="mb-6 flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-emerald-400">Investments</p><h2 className="mt-1 text-2xl font-bold text-white">{editing ? "Edit Investment Account" : "Add Investment Account"}</h2><p className="mt-1 text-xs text-slate-500">Buat account sekali, lalu gunakan kembali di Transactions.</p></div><button type="button" onClick={onClose} className="text-2xl text-slate-500 hover:text-white">×</button></div><div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-500">Broker<input required className={`${input} mt-2`} value={form.providerName} onChange={e => onChange({ ...form, providerName: e.target.value })} placeholder="IndoPremier" /></label><label className="text-xs text-slate-500">Website <span className="text-slate-700">(optional)</span><input className={`${input} mt-2`} value={form.websiteUrl} onChange={e => onChange({ ...form, websiteUrl: e.target.value })} placeholder="https://..." /></label><label className="text-xs text-slate-500">RDN Bank<input className={`${input} mt-2`} value={form.rdnBankName} onChange={e => onChange({ ...form, rdnBankName: e.target.value })} placeholder="BCA" /></label><label className="text-xs text-slate-500">RDN Account Number<input className={`${input} mt-2`} value={form.rdnAccountNumber} onChange={e => onChange({ ...form, rdnAccountNumber: e.target.value })} placeholder="Nomor RDN" /></label><label className="text-xs text-slate-500">Currency<select className={`${select} mt-2`} value={form.currencyId} onChange={e => onChange({ ...form, currencyId: e.target.value })}>{currencies.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select></label><div /><label className="text-xs text-slate-500">Buy fee %<input className={`${input} mt-2`} type="number" min="0" step="0.001" value={form.buyFeePct} onChange={e => onChange({ ...form, buyFeePct: e.target.value })} /></label><label className="text-xs text-slate-500">Sell fee %<input className={`${input} mt-2`} type="number" min="0" step="0.001" value={form.sellFeePct} onChange={e => onChange({ ...form, sellFeePct: e.target.value })} /></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300">Cancel</button><button type="submit" disabled={busy} className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-[#07110b] disabled:opacity-50">{busy ? "Saving…" : editing ? "Save changes" : "Create account"}</button></div></form></div>; }

function TradeModal({ open, trade, assets, account, ledger, onClose, onChange, onSubmit, busy }: { open: boolean; trade: Trade; assets: Asset[]; account: Account; ledger: Ledger | null; onClose: () => void; onChange: (t: Trade) => void; onSubmit: (e: FormEvent) => void; busy: boolean }) {
  if (!open) return null;
  const selectedAsset = assets.find(a => a.id === trade.assetId) ?? assets.find(a => assetLabel(a).toLowerCase() === trade.assetQuery.trim().toLowerCase());
  const isNewStockBuy = trade.type === "BUY" && !selectedAsset;
  const units = unitsPerLot(selectedAsset) || (isNewStockBuy ? 100 : 1);
  const lots = (ledger?.rows ?? []).filter(r => r.asset.id === trade.assetId && Number(r.remainingQuantity) > 0);
  const feePct = trade.type === "BUY" ? feeInfo(account).buyFeePct : feeInfo(account).sellFeePct;
  const qty = Number(trade.quantity || 0); const price = Number(trade.unitPrice || 0); const gross = qty * units * price; const fee = gross * feePct / 100; const tax = Number(trade.tax || 0); const other = Number(trade.other || 0); const cash = trade.type === "BUY" ? gross + fee + tax + other : gross - fee - tax - other;
  const sellLot = lots.find(r => r.lotId === trade.sourceLotId); const qtyUnits = qty * units; const quantityValid = trade.type !== "SELL" || (!!sellLot && qtyUnits <= Number(sellLot.remainingQuantity)); const canSubmit = !!trade.assetQuery.trim() && qty > 0 && (trade.type === "SELL" ? price >= 0 : price > 0) && !!trade.fundingCashAccountId && (trade.type === "BUY" || (!!sellLot && quantityValid)); const sellPnl = trade.type === "SELL" && sellLot && quantityValid ? cash - Number(sellLot.totalCost) * qtyUnits / Math.max(Number(sellLot.quantity), 1) : null;
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={onSubmit} className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-[#0b121a] p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-emerald-400">{account.provider.name}</p><h2 className="mt-1 text-2xl font-bold text-white">New {trade.type === "BUY" ? "Buy" : "Sell"} Transaction</h2></div><button type="button" onClick={onClose} className="text-2xl text-slate-500">×</button></div><div className="mb-5 grid grid-cols-2 rounded-2xl border border-white/10 bg-[#080f17] p-1"><button type="button" onClick={() => onChange({ ...trade, type: "BUY", sourceLotId: "" })} className={`rounded-xl py-3 text-lg font-bold ${trade.type === "BUY" ? "bg-emerald-400 text-[#07110b]" : "text-slate-500"}`}>BUY</button><button type="button" onClick={() => onChange({ ...trade, type: "SELL", sourceLotId: "" })} className={`rounded-xl py-3 text-lg font-bold ${trade.type === "SELL" ? "bg-emerald-400 text-[#07110b]" : "text-slate-500"}`}>SELL</button></div><div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-500">Asset / Stock<AssetPicker assets={assets} value={trade.assetQuery} selectedId={trade.assetId} onChange={v => onChange({ ...trade, assetQuery: v, assetId: assets.find(a => assetLabel(a).toLowerCase() === v.trim().toLowerCase() || String(a.symbol ?? "").toLowerCase() === v.trim().toLowerCase())?.id ?? "" })} onSelect={a => onChange({ ...trade, assetId: a.id, assetQuery: assetLabel(a), sourceLotId: "" })} /></label><label className="text-xs text-slate-500">Date<input className={`${input} mt-2`} type="date" value={trade.date} onChange={e => onChange({ ...trade, date: e.target.value })} /></label><label className="text-xs text-slate-500">Quantity {selectedAsset?.assetType === "STOCK" || isNewStockBuy ? "(lots)" : `(${selectedAsset?.unitName || "units"})`}<input className={`${input} mt-2`} type="number" min="0.0001" step="0.0001" value={trade.quantity} onChange={e => onChange({ ...trade, quantity: e.target.value })} placeholder="1" />{trade.type === "SELL" && sellLot && !quantityValid && <span className="mt-1 block text-[10px] text-red-300">Maksimum {nf(Number(sellLot.remainingQuantity) / unitsPerLot(sellLot.asset), 0)} lot untuk lot ini.</span>}</label><label className="text-xs text-slate-500">Price / unit<input className={`${input} mt-2`} type="number" min={trade.type === "SELL" ? "0" : "0.01"} step="0.01" value={trade.unitPrice} onChange={e => onChange({ ...trade, unitPrice: e.target.value })} placeholder="6400" /></label></div>{trade.type === "SELL" && selectedAsset && lots.length > 0 && <label className="mt-4 block text-xs text-slate-500">Purchase lot to sell<select className={`${select} mt-2`} value={trade.sourceLotId} onChange={e => onChange({ ...trade, sourceLotId: e.target.value })}><option value="">Select purchase lot</option>{lots.map(r => <option key={r.lotId} value={r.lotId}>{new Date(r.transactionDate).toLocaleDateString("id-ID")} · {r.asset.symbol || r.asset.name} · remaining {nf(Number(r.remainingQuantity) / unitsPerLot(r.asset), 0)} lot</option>)}</select></label>}
    <div className="mt-4 grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.04] p-4"><p className="text-[10px] uppercase tracking-widest text-slate-500">Auto fee · {nf(feePct, 3)}%</p><p className="mt-2 text-xl font-bold text-emerald-300">{money(fee, account.currency.code)}</p></div><div className="rounded-2xl border border-white/10 bg-white/[.02] p-4"><p className="text-[10px] uppercase tracking-widest text-slate-500">{trade.type === "BUY" ? "Cash required" : "Net proceeds"}</p><p className="mt-2 text-xl font-bold text-white">{money(cash, account.currency.code)}</p></div>{trade.type === "SELL" && <div className={`rounded-2xl border p-4 ${sellPnl != null && sellPnl >= 0 ? "border-emerald-400/20 bg-emerald-400/[.04]" : "border-red-400/20 bg-red-400/[.04]"}`}><p className="text-[10px] uppercase tracking-widest text-slate-500">Estimated P/L</p><p className={`mt-2 text-xl font-bold ${sellPnl != null && sellPnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>{sellPnl == null ? "—" : money(sellPnl, account.currency.code)}</p></div>}</div>
    <div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-500">Tax<input className={`${input} mt-2`} type="number" min="0" step="0.01" value={trade.tax} onChange={e => onChange({ ...trade, tax: e.target.value })} /></label><label className="text-xs text-slate-500">Other charges<input className={`${input} mt-2`} type="number" min="0" step="0.01" value={trade.other} onChange={e => onChange({ ...trade, other: e.target.value })} /></label></div>
    <label className="mt-4 block text-xs text-slate-500">Settlement RDN<select className={`${select} mt-2`} value={trade.fundingCashAccountId} onChange={e => onChange({ ...trade, fundingCashAccountId: e.target.value })}><option value="">Select RDN</option>{account.cashAccount && <option value={account.cashAccount.id}>{account.provider.name} · RDN {feeInfo(account).rdnBankName || ""} · {money(account.cashAccount.balance, account.currency.code)}</option>}</select></label>
    <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">Cancel</button><button type="submit" disabled={!canSubmit || busy} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#07110b] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Saving…" : "Save transaction"}</button></div></form></div>;
}

function ClosedSellEditModal({ open, edit, account, date, price, tax, other, setDate, setPrice, setTax, setOther, onClose, onSubmit, busy }: { open: boolean; edit: ClosedEdit; account: Account | null; date: string; price: string; tax: string; other: string; setDate: (v: string) => void; setPrice: (v: string) => void; setTax: (v: string) => void; setOther: (v: string) => void; onClose: () => void; onSubmit: () => void; busy: boolean }) {
  if (!open || !edit || !account) return null;
  const feePct = feeInfo(account).sellFeePct;
  const gross = edit.quantity * Number(price || 0);
  const fee = gross * feePct / 100;
  const net = gross - fee - Number(tax || 0) - Number(other || 0);
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#0b121a] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-amber-300">Edit Closed Transaction</p><h2 className="mt-1 text-2xl font-bold text-white">{edit.asset.symbol || edit.asset.name}</h2><p className="mt-1 text-xs text-slate-500">{nf(edit.quantity / unitsPerLot(edit.asset), 0)} lot · quantity tetap</p></div><button type="button" onClick={onClose} className="text-2xl text-slate-500">×</button></div><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-xs text-slate-500">Sell date<input className={`${input} mt-2`} type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label className="text-xs text-slate-500">Sell price / share<input className={`${input} mt-2`} type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></label><label className="text-xs text-slate-500">Tax<input className={`${input} mt-2`} type="number" min="0" step="0.01" value={tax} onChange={e => setTax(e.target.value)} /></label><label className="text-xs text-slate-500">Other charges<input className={`${input} mt-2`} type="number" min="0" step="0.01" value={other} onChange={e => setOther(e.target.value)} /></label></div><div className="mt-4 grid grid-cols-3 gap-3"><div className="rounded-xl border border-white/10 p-3"><p className="text-[10px] text-slate-600">Gross</p><p className="mt-1 text-sm font-semibold text-white">{money(gross, account.currency.code)}</p></div><div className="rounded-xl border border-white/10 p-3"><p className="text-[10px] text-slate-600">Sell fee · {nf(feePct,3)}%</p><p className="mt-1 text-sm font-semibold text-white">{money(fee, account.currency.code)}</p></div><div className="rounded-xl border border-white/10 bg-white/[.02] p-3"><p className="text-[10px] text-slate-600">Net proceeds</p><p className="mt-1 text-sm font-semibold text-white">{money(net, account.currency.code)}</p></div></div><p className="mt-3 text-[10px] text-slate-600">Quantity/lot allocation tidak diubah. Untuk koreksi jumlah, gunakan Delete lalu lakukan SELL/Split kembali.</p><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">Cancel</button><button type="button" onClick={onSubmit} disabled={busy || Number(price) < 0} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#07110b] disabled:opacity-40">{busy ? "Saving…" : "Save changes"}</button></div></div></div>;
}

function ClosedDividendModal({ open, account, assets, assetId, amount, date, destination, setAssetId, setAmount, setDate, setDestination, onClose, onSubmit, busy }: { open: boolean; account: Account | null; assets: Asset[]; assetId: string; amount: string; date: string; destination: string; setAssetId: (v: string) => void; setAmount: (v: string) => void; setDate: (v: string) => void; setDestination: (v: string) => void; onClose: () => void; onSubmit: () => void; busy: boolean }) { if (!open || !account) return null; return <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#0b121a] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-emerald-400">INVESTMENT INCOME</p><h2 className="mt-1 text-2xl font-bold text-white">Record Dividend</h2><p className="mt-1 text-xs text-slate-500">Dividend masuk ke RDN dan menjadi bagian dari Total Profit.</p></div><button type="button" onClick={onClose} className="text-2xl text-slate-500">×</button></div><div className="mt-5 space-y-4"><label className="block text-xs text-slate-500">Asset<select className={select} value={assetId} onChange={e=>setAssetId(e.target.value)}><option value="">Select asset</option>{assets.map(a=><option key={a.id} value={a.id}>{a.symbol||a.name}</option>)}</select></label><label className="block text-xs text-slate-500">Dividend amount<input className={input} type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} /></label><label className="block text-xs text-slate-500">Date<input className={input} type="date" value={date} onChange={e=>setDate(e.target.value)} /></label><label className="block text-xs text-slate-500">Receive to RDN<select className={select} value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Select RDN</option>{account.cashAccount&&<option value={account.cashAccount.id}>{account.name}</option>}</select></label></div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-slate-300">Cancel</button><button type="button" disabled={busy||!assetId||!amount||!destination} onClick={onSubmit} className="rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-[#07110b] disabled:opacity-40">{busy?"Saving…":"Record dividend"}</button></div></div></div>; }

function SellAllModal({ open, summary, account, price, setPrice, onClose, onSubmit, busy }: { open: boolean; summary: AssetSummary | null; account: Account | null; price: string; setPrice: (v: string) => void; onClose: () => void; onSubmit: () => void; busy: boolean }) { if (!open || !summary || !account) return null; const f = feeInfo(account); const current = summary.currentPrice ?? 0; const breakeven = summary.minSell; const p = Number(price || 0); const gross = summary.quantity * p; const fee = gross * f.sellFeePct / 100; const net = gross - fee; const pnl = net - summary.cost; return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#0b121a] p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-[.18em] text-emerald-400">SELL ALL</p><h2 className="mt-1 text-2xl font-bold text-white">{summary.asset.symbol || summary.asset.name}</h2><p className="mt-1 text-xs text-slate-500">{nf(summary.quantity / unitsPerLot(summary.asset), 0)} lot · {nf(summary.quantity, 0)} shares</p></div><button type="button" onClick={onClose} className="text-2xl text-slate-500">×</button></div><div className="mt-5 grid grid-cols-3 gap-2"><button type="button" onClick={() => setPrice(String(current))} className="rounded-xl border border-white/10 p-3 text-left"><span className="block text-[10px] text-slate-600">Current</span><span className="mt-1 block font-semibold text-white">{money(current, account.currency.code)}</span></button><button type="button" onClick={() => setPrice(String(breakeven))} className="rounded-xl border border-amber-400/20 bg-amber-400/[.04] p-3 text-left"><span className="block text-[10px] text-slate-600">Break-even</span><span className="mt-1 block font-semibold text-amber-300">{money(breakeven, account.currency.code)}</span></button><label className="rounded-xl border border-white/10 p-3 text-xs text-slate-600">Sell price<input className="mt-1 w-full bg-transparent text-sm font-semibold text-white outline-none" type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} /></label></div><div className="mt-4 grid grid-cols-3 gap-3"><div className="rounded-xl border border-white/10 p-4"><p className="text-[10px] text-slate-600">Gross</p><p className="mt-1 font-semibold text-white">{money(gross, account.currency.code)}</p></div><div className="rounded-xl border border-white/10 p-4"><p className="text-[10px] text-slate-600">Sell fee</p><p className="mt-1 font-semibold text-white">{money(fee, account.currency.code)}</p></div><div className={`rounded-xl border p-4 ${pnl >= 0 ? "border-emerald-400/20 bg-emerald-400/[.04]" : "border-red-400/20 bg-red-400/[.04]"}`}><p className="text-[10px] text-slate-600">Estimated P/L</p><p className={`mt-1 font-semibold ${pnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(pnl, account.currency.code)}</p></div></div><div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[.02] p-4">{summary.rows.map(r => { const q = Number(r.remainingQuantity); const lotCost = Number(r.totalCost) * q / Math.max(Number(r.quantity), 1); const lotPnl = q * p - q * p * f.sellFeePct / 100 - lotCost; return <div key={r.lotId} className="flex items-center justify-between text-xs"><span className="text-slate-400">{new Date(r.transactionDate).toLocaleDateString("id-ID")} · {nf(q / unitsPerLot(r.asset), 0)} lot @ {money(r.unitPrice, account.currency.code)}</span><span className={lotPnl >= 0 ? "text-emerald-300" : "text-red-300"}>P/L {money(lotPnl, account.currency.code)}</span></div>; })}</div><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300">Cancel</button><button type="button" disabled={busy || p < 0} onClick={onSubmit} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#07110b] disabled:opacity-40">{busy ? "Processing…" : "Confirm Sell All"}</button></div></div></div>; }

export default function InvestmentDashboardV6() {
  const [data, setData] = useState<Overview | null>(null); const [screen, setScreen] = useState<"overview" | "transactions" | "accounts">("overview"); const [accountId, setAccountId] = useState(""); const [ledger, setLedger] = useState<Ledger | null>(null); const [selectedAssetId, setSelectedAssetId] = useState(""); const [closedAssetId, setClosedAssetId] = useState(""); const [dividendRows, setDividendRows] = useState<DividendRow[]>([]); const [dividendFilterAssetId, setDividendFilterAssetId] = useState(""); const [dividendEdit, setDividendEdit] = useState<DividendEdit>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [showTrade, setShowTrade] = useState(false); const [showAccountModal, setShowAccountModal] = useState(false); const [editing, setEditing] = useState<Account | null>(null); const [accountForm, setAccountForm] = useState<AccountForm>({ providerName: "", websiteUrl: "", rdnBankName: "", rdnAccountNumber: "", buyFeePct: "", sellFeePct: "", currencyId: "" }); const [showSellAll, setShowSellAll] = useState(false); const [sellAllAssetId, setSellAllAssetId] = useState(""); const [sellAllPrice, setSellAllPrice] = useState(""); const [trade, setTrade] = useState<Trade>({ type: "BUY", assetId: "", assetQuery: "", quantity: "", unitPrice: "", tax: "0", other: "0", date: today(), sourceLotId: "", fundingCashAccountId: "" }); const [historyRows, setHistoryRows] = useState<RdnHistoryRow[]>([]); const [historyOpen, setHistoryOpen] = useState(false); const [openPositionsOpen, setOpenPositionsOpen] = useState(false); const [closedTransactionsOpen, setClosedTransactionsOpen] = useState(false); const [closedSummaryOpen, setClosedSummaryOpen] = useState(true); const [closedDetailOpen, setClosedDetailOpen] = useState(true); const [historyLoading, setHistoryLoading] = useState(false); const [cashBalance, setCashBalance] = useState(""); const [cashDate, setCashDate] = useState(today()); const [wallets, setWallets] = useState<Array<{ id: string; name: string; balance: number; currency: Currency }>>([]); const [importing, setImporting] = useState(false); const [assetSummaryView, setAssetSummaryView] = useState<"cards" | "table">("cards"); const [showDividend, setShowDividend] = useState(false); const [dividendAssetId, setDividendAssetId] = useState(""); const [dividendAmount, setDividendAmount] = useState(""); const [dividendDate, setDividendDate] = useState(today()); const [dividendDestination, setDividendDestination] = useState(""); const [dividendByAccount, setDividendByAccount] = useState<Record<string, number>>({}); const [closedEdit, setClosedEdit] = useState<ClosedEdit>(null); const [closedEditDate, setClosedEditDate] = useState(today()); const [closedEditPrice, setClosedEditPrice] = useState(""); const [closedEditTax, setClosedEditTax] = useState("0"); const [closedEditOther, setClosedEditOther] = useState("0");
  const [realizedByAccount, setRealizedByAccount] = useState<Record<string, number>>({});
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);
  const [marketError, setMarketError] = useState("");

  const accounts = data?.accounts ?? []; const currencies = data?.currencies ?? []; const assets = data?.assets ?? []; const holdings = data?.holdings ?? []; const cashAccounts = data?.cashAccounts ?? []; const selected = accounts.find(a => a.id === accountId) ?? null; const selectedCash = selected?.cashAccount ? cashAccounts.find(c => c.id === selected.cashAccount?.id) ?? null : null; const fee = selected ? feeInfo(selected) : { buyFeePct: 0, sellFeePct: 0, rdnBankName: "", rdnAccountNumber: "" };
  const reload = async () => setData(await getOverview()); const loadLedger = async (id: string) => { const r = await fetch(`/api/investments/v2?accountId=${encodeURIComponent(id)}`, { cache: "no-store" }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Unable to load transactions."); setLedger(j); }; const loadHistory = async (cashId: string) => { if (!cashId) return; setHistoryLoading(true); try { const r = await fetch(`/api/investments/cash-transfer?cashAccountId=${encodeURIComponent(cashId)}`, { cache: "no-store" }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Unable to load RDN history."); setHistoryRows(j.rows ?? []); } finally { setHistoryLoading(false); } };
  useEffect(() => {
    reload().catch(e => setMessage(e instanceof Error ? e.message : "Unable to load investments."));
    fetch("/api/investments/cash-transfer", { cache: "no-store" })
      .then(r => r.json())
      .then(j => setWallets(j.wallets ?? []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!data) return;

    const timestamps = (data.holdings ?? [])
      .map(h => h.priceAsOf)
      .filter(Boolean) as string[];

    if (timestamps.length) {
      const latest = timestamps.reduce((a, b) =>
        new Date(b).getTime() > new Date(a).getTime() ? b : a
      );
      setLastPriceUpdate(new Date(latest));
    }

    let cancelled = false;

    const loadRealized = async () => {
      const active = (data.accounts ?? []).filter(a => a.isActive !== false);

      const values = await Promise.all(
        active.map(async account => {
          try {
            const r = await fetch(
              `/api/investments/v2?accountId=${encodeURIComponent(account.id)}`,
              { cache: "no-store" }
            );
            const j = await r.json();
            return [
              account.id,
              Number(j.summary?.realizedGainLoss ?? 0) || 0,
            ] as const;
          } catch {
            return [account.id, 0] as const;
          }
        })
      );

      if (!cancelled) {
        setRealizedByAccount(Object.fromEntries(values));
      }
    };

    void loadRealized();

    return () => {
      cancelled = true;
    };
  }, [data]); useEffect(() => { if (accountId) loadLedger(accountId).catch(e => setMessage(e instanceof Error ? e.message : "Unable to load transactions.")); else setLedger(null); }, [accountId]); useEffect(() => { if (!data) return; let cancelled = false; const loadDividends = async () => { const active = (data.accounts ?? []).filter(a => a.isActive !== false); const pairs = await Promise.all(active.map(async a => { try { const r = await fetch(`/api/investments/v2?accountId=${encodeURIComponent(a.id)}`, { cache: "no-store" }); const j = await r.json(); const value = (j.transactions ?? []).filter((t: { transactionType?: string }) => t.transactionType === "DIVIDEND").reduce((sum: number, t: { netCashAmount?: string | number }) => sum + Math.max(0, Number(t.netCashAmount ?? 0) || 0), 0); return [a.id, value] as const; } catch { return [a.id, 0] as const; } })); if (!cancelled) setDividendByAccount(Object.fromEntries(pairs)); }; void loadDividends(); return () => { cancelled = true; }; }, [data]); useEffect(() => { if (screen === "accounts") { setSelectedAssetId(""); setHistoryOpen(Boolean(accountId)); } }, [screen]); useEffect(() => { if (screen === "accounts" && selectedCash && historyOpen) loadHistory(selectedCash.id).catch(e => setMessage(e instanceof Error ? e.message : "Unable to load RDN history.")); }, [screen, selectedCash, historyOpen]);
  const loadDividendRows = async (id: string) => { if (!id) return setDividendRows([]); const r = await fetch(`/api/investments/v2?accountId=${encodeURIComponent(id)}`, { cache: "no-store" }); const j = await r.json(); setDividendRows((j.transactions ?? []).filter((t: { transactionType?: string }) => t.transactionType === "DIVIDEND").sort((a: DividendRow,b: DividendRow) => new Date(b.transactionDate).getTime()-new Date(a.transactionDate).getTime())); }; useEffect(() => { loadDividendRows(accountId).catch(() => setDividendRows([])); }, [accountId]); const saveDividendEdit = async () => { if (!selected || !dividendEdit) return; const amount=Number(dividendEdit.amount); if(!dividendEdit.assetId||!amount||amount<=0)return setMessage("Asset dan Net Dividend harus diisi."); const result=await postV2({action:dividendEdit.id?"dividend.update":"dividend.create",...(dividendEdit.id?{transactionId:dividendEdit.id}:{}),accountId:selected.id,assetId:dividendEdit.assetId,transactionDate:dividendEdit.date,amount}); setDividendEdit(null); await loadDividendRows(selected.id); await reload(); return result; }; const removeDividend = async (id:string) => { if(!confirm("Delete this dividend?"))return; await postV2({action:"dividend.delete",transactionId:id}); if(selected){await loadDividendRows(selected.id);await reload();} }; 
  const transactionAssets = useMemo(() => { const seen = new Set<string>(); const result: Asset[] = []; for (const row of ledger?.rows ?? []) if (!seen.has(row.asset.id)) { seen.add(row.asset.id); result.push(row.asset); } return result; }, [ledger]); const pickerAssets = useMemo(() => { const seen = new Set<string>(); return [...transactionAssets, ...assets].filter(a => !seen.has(a.id) && seen.add(a.id)); }, [transactionAssets, assets]); const assetSummaries = useMemo<AssetSummary[]>(() => { if (!ledger || !selected) return []; const sellFeePct = feeInfo(selected).sellFeePct; const groups = new Map<string, LotRow[]>(); for (const row of ledger.rows) { if (Number(row.remainingQuantity) <= 0) continue; const list = groups.get(row.asset.id) ?? []; list.push(row); groups.set(row.asset.id, list); } return [...groups.values()].map(rows => { const asset = rows[0].asset; const quantity = rows.reduce((s, r) => s + Number(r.remainingQuantity), 0); const cost = rows.reduce((s, r) => s + Number(r.totalCost) * Number(r.remainingQuantity) / Math.max(Number(r.quantity), 1), 0); const avgCost = quantity ? cost / quantity : 0; const raw = rows.find(r => r.currentPrice != null)?.currentPrice; const currentPrice = raw == null ? null : Number(raw); const marketValue = currentPrice == null ? 0 : quantity * currentPrice; const sellFee = marketValue * sellFeePct / 100; const netValue = marketValue - sellFee; const pnl = netValue - cost; const minSell = quantity && sellFeePct < 100 ? (cost / quantity) / (1 - sellFeePct / 100) : 0; return { asset, quantity, cost, avgCost, currentPrice, marketValue, sellFee, netValue, pnl, minSell, rows }; }).sort((a, b) => (a.asset.symbol || a.asset.name).localeCompare(b.asset.symbol || b.asset.name, "id", { sensitivity: "base" })); }, [ledger, selected]);
  const openRows = useMemo(() => [...(ledger?.rows ?? [])].filter(r => Number(r.remainingQuantity) > 0).sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()), [ledger]); const closedSales = useMemo(() => (ledger?.rows ?? []).flatMap(lot => lot.sales.map(sale => ({ lot, sale }))).sort((a, b) => new Date(b.sale.date).getTime() - new Date(a.sale.date).getTime()), [ledger]); const closedAssets = useMemo(() => { const seen = new Set<string>(); return closedSales.map(x => x.lot.asset).filter(asset => !seen.has(asset.id) && seen.add(asset.id)); }, [closedSales]); const selectedOpenRows = selectedAssetId ? openRows.filter(r => r.asset.id === selectedAssetId) : openRows; const selectedClosed = closedAssetId ? closedSales.filter(x => x.lot.asset.id === closedAssetId) : closedSales; const closedSummary = useMemo(() => { const groups = new Map<string, { asset: Asset; soldQuantity: number; buyCost: number; sellValue: number; netPnl: number }>(); for (const { lot, sale } of selectedClosed) { const qty = Number(sale.quantity); const buyCost = Number(lot.totalCost) * qty / Math.max(Number(lot.quantity), 1); const sellValue = qty * Number(sale.price); const netPnl = Number(sale.realized); const key = lot.asset.id; const current = groups.get(key) ?? { asset: lot.asset, soldQuantity: 0, buyCost: 0, sellValue: 0, netPnl: 0 }; current.soldQuantity += qty; current.buyCost += buyCost; current.sellValue += sellValue; current.netPnl += netPnl; groups.set(key, current); } return [...groups.values()].map(x => ({ ...x, avgBuy: x.soldQuantity ? x.buyCost / x.soldQuantity : 0, avgSell: x.soldQuantity ? x.sellValue / x.soldQuantity : 0, pnlPct: x.buyCost ? (x.netPnl / x.buyCost) * 100 : 0 })).sort((a, b) => b.netPnl - a.netPnl); }, [selectedClosed]); const selectedSummary = assetSummaries.find(a => a.asset.id === sellAllAssetId) ?? null;
  const chooseAccount = (id: string, destination: "transactions" | "accounts") => { setAccountId(id); setSelectedAssetId(""); setHistoryOpen(destination === "accounts"); setScreen(destination); }; const openAccountEditor = (account?: Account) => { setEditing(account ?? null); setAccountForm(account ? { providerName: account.provider.name, websiteUrl: account.provider.websiteUrl ?? "", rdnBankName: feeInfo(account).rdnBankName, rdnAccountNumber: feeInfo(account).rdnAccountNumber, buyFeePct: String(feeInfo(account).buyFeePct), sellFeePct: String(feeInfo(account).sellFeePct), currencyId: account.currency.id } : { providerName: "", websiteUrl: "", rdnBankName: "", rdnAccountNumber: "", buyFeePct: "", sellFeePct: "", currencyId: currencies[0]?.id ?? "" }); setShowAccountModal(true); };
  async function run(body: Record<string, unknown>, success: string, route: "v1" | "v2" | "v4" = "v2") { setBusy(true); setMessage(""); try { if (route === "v4") await postV4(body); else if (route === "v1") { const r = await fetch("/api/investments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Investment operation failed."); } else await postV2(body); await reload(); if (accountId) await loadLedger(accountId); setMessage(success); return true; } catch (e) { setMessage(e instanceof Error ? e.message : "Operation failed."); return false; } finally { setBusy(false); } }
  const openTrade = (type: "BUY" | "SELL", row?: LotRow) => { const asset = row?.asset ?? (selectedAssetId ? assetSummaries.find(a => a.asset.id === selectedAssetId)?.asset : undefined); setTrade({ type, assetId: asset?.id ?? "", assetQuery: asset ? assetLabel(asset) : "", quantity: "", unitPrice: row?.currentPrice != null ? String(row.currentPrice) : asset && assetSummaries.find(a => a.asset.id === asset.id)?.currentPrice != null ? String(assetSummaries.find(a => a.asset.id === asset.id)?.currentPrice) : "", tax: "0", other: "0", date: today(), sourceLotId: row?.lotId ?? "", fundingCashAccountId: selected?.cashAccount?.id ?? "" }); setShowTrade(true); };
  async function submitTrade(e: FormEvent) { e.preventDefault(); if (!selected) return; let asset = pickerAssets.find(a => a.id === trade.assetId) ?? pickerAssets.find(a => assetLabel(a).toLowerCase() === trade.assetQuery.trim().toLowerCase()); if (!asset && trade.type === "BUY") { const symbol = trade.assetQuery.trim().toUpperCase(); if (!symbol) return setMessage("Enter an asset / stock first."); try { asset = await postV2({ action: "asset.resolve", accountId: selected.id, symbol, name: symbol, currencyId: selected.currency.id, assetType: "STOCK", unitName: "share" }); } catch (e) { return setMessage(e instanceof Error ? e.message : "Unable to create asset."); } } if (!asset || !trade.quantity || trade.unitPrice === "" || !trade.fundingCashAccountId) return setMessage("Lengkapi asset, quantity, harga dan RDN."); const units = unitsPerLot(asset); const qtyUnits = Number(trade.quantity) * units; const lot = trade.type === "SELL" ? ledger?.rows.find(r => r.lotId === trade.sourceLotId) : undefined; if (trade.type === "SELL" && (!lot || qtyUnits > Number(lot.remainingQuantity))) return setMessage("Jumlah jual melebihi remaining lot."); const gross = qtyUnits * Number(trade.unitPrice); const autoFee = gross * (trade.type === "BUY" ? fee.buyFeePct : fee.sellFeePct) / 100; const ok = await run({ action: "transaction.create", accountId: selected.id, assetId: asset.id, transactionType: trade.type, transactionDate: new Date(trade.date).toISOString(), quantity: qtyUnits, unitPrice: Number(trade.unitPrice), feeAmount: autoFee, taxAmount: Number(trade.tax || 0), otherCharges: Number(trade.other || 0), fundingCashAccountId: trade.fundingCashAccountId, sourceLotId: trade.sourceLotId || undefined }, "Transaction saved."); if (ok) setShowTrade(false); }
  async function refreshPrices() {
    setRefreshingPrices(true);
    setMarketError("");

    try {
      const r = await fetch("/api/investments/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "market.refresh" }),
      });

      const j = await r.json();

      if (!r.ok || j.error) {
        throw new Error(j.error || "Unable to refresh market prices.");
      }

      const timestamps = (j.updated ?? [])
        .map((x: { asOf?: string | null }) => x.asOf)
        .filter(Boolean) as string[];

      setLastPriceUpdate(
        timestamps.length
          ? new Date(
              timestamps.reduce((a: string, b: string) =>
                new Date(b).getTime() > new Date(a).getTime() ? b : a
              )
            )
          : new Date()
      );

      await reload();

      if (accountId) {
        await loadLedger(accountId);
      }
    } catch (e) {
      setMarketError(
        e instanceof Error
          ? e.message
          : "Unable to refresh market prices."
      );
    } finally {
      setRefreshingPrices(false);
    }
  }

  async function saveDividend() { if (!selected || !dividendAssetId || !dividendAmount || !dividendDestination) return; const amount = Number(dividendAmount); if (!Number.isFinite(amount) || amount <= 0) return setMessage("Dividend amount must be greater than zero."); const ok = await run({ action: "income.create", accountId: selected.id, assetId: dividendAssetId, type: "DIVIDEND", amount, date: new Date(dividendDate).toISOString(), destinationCashAccountId: dividendDestination }, "Dividend recorded.", "v1"); if (ok) { setShowDividend(false); setDividendAmount(""); } }
  async function saveAccount(e: FormEvent) { e.preventDefault(); const payload = { ...accountForm, buyFeePct: Number(accountForm.buyFeePct || 0), sellFeePct: Number(accountForm.sellFeePct || 0) }; const ok = await run(editing ? { action: "account.update", accountId: editing.id, ...payload } : { action: "account.create", ...payload }, editing ? "Account updated." : "Account created."); if (ok) setShowAccountModal(false); }
  async function accountAction(action: "account.close" | "account.delete", account: Account) { if (!window.confirm(`${action.endsWith("close") ? "Close" : "Delete"} ${account.provider.name}?`)) return; const ok = await run({ action, accountId: account.id }, action.endsWith("close") ? "Account closed." : "Account deleted."); if (ok) setAccountId(""); }
  async function resetInvestmentData() {
    const first = window.confirm("Reset ALL Investment data? This will remove all investment accounts, transactions, holdings, RDN accounts, assets and broker settings. Wallets and normal transactions will NOT be affected.");
    if (!first) return;
    const typed = window.prompt("Type RESET INVESTMENT to confirm.");
    if (typed !== "RESET INVESTMENT") return;
    setBusy(true); setMessage("");
    try {
      await postV2({ action: "investment.reset", confirmation: typed });
      setAccountId("");
      setLedger(null);
      setSelectedAssetId("");
      setClosedAssetId("");
      await reload();
      setMessage("Investment data reset successfully.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Investment reset failed.");
    } finally {
      setBusy(false);
    }
  }
  async function saveCash() { if (!selectedCash || !cashBalance) return; const ok = await run({ action: "cash.setBalance", cashAccountId: selectedCash.id, balance: Number(cashBalance), date: new Date(cashDate).toISOString() }, "RDN balance updated."); if (ok) { setCashBalance(""); setHistoryOpen(true); await loadHistory(selectedCash.id); } }
  const [withdrawWalletId, setWithdrawWalletId] = useState(""); const [withdrawAmount, setWithdrawAmount] = useState("");
  async function doWithdraw() { if (!selectedCash || !withdrawWalletId) return; const value = Number(withdrawAmount); if (!Number.isFinite(value) || value <= 0 || value > Number(selectedCash.balance)) return setMessage("Withdraw amount tidak valid."); setBusy(true); try { const r = await fetch("/api/investments/cash-transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction: "WITHDRAW", cashAccountId: selectedCash.id, walletId: withdrawWalletId, amount: value, date: new Date().toISOString() }) }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Withdrawal failed."); await reload(); setWithdrawAmount(""); setHistoryOpen(true); await loadHistory(selectedCash.id); setMessage("Dana berhasil dipindahkan ke Wallet."); } catch (e) { setMessage(e instanceof Error ? e.message : "Withdrawal failed."); } finally { setBusy(false); } }
  async function importExcel(file: File) { if (!selected) return; setImporting(true); setMessage(""); try { const form = new FormData(); form.append("action", "import.excel"); form.append("accountId", selected.id); form.append("file", file); const r = await fetch("/api/investments/v2", { method: "POST", body: form }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Import failed."); await reload(); await loadLedger(selected.id); setMessage(`Imported ${j.imported ?? 0} rows. Skipped ${j.skipped ?? 0}.`); } catch (e) { setMessage(e instanceof Error ? e.message : "Import failed."); } finally { setImporting(false); } }
  async function deleteTransaction(id: string) { if (!window.confirm("Hapus transaksi BUY ini?")) return; await run({ action: "transaction.delete", transactionId: id }, "Transaction deleted."); }
  async function deleteClosedTransaction(id: string) {
    if (!window.confirm("Hapus transaksi SELL ini? Quantity akan kembali ke posisi dan dana hasil penjualan akan dibalik.")) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/investments/v2/closed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", transactionId: id }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Closed transaction delete failed.");
      await reload();
      if (accountId) await loadLedger(accountId);
      setMessage("Closed transaction deleted.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Closed transaction delete failed."); }
    finally { setBusy(false); }
  }
  async function submitClosedEdit() {
    if (!closedEdit || !selected) return;
    setBusy(true); setMessage("");
    try {
      const r = await fetch("/api/investments/v2/closed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", transactionId: closedEdit.id, transactionDate: new Date(closedEditDate).toISOString(), unitPrice: Number(closedEditPrice), taxAmount: Number(closedEditTax || 0), otherCharges: Number(closedEditOther || 0) }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Closed transaction update failed.");
      await reload(); await loadLedger(selected.id); setClosedEdit(null); setMessage("Closed transaction updated.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Closed transaction update failed."); }
    finally { setBusy(false); }
  }
  async function sellAll() { if (!selected || !selectedSummary || !sellAllPrice || !selected.cashAccount?.id) return; const ok = await run({ action: "transaction.sellAll", accountId: selected.id, assetId: selectedSummary.asset.id, transactionDate: new Date(today()).toISOString(), unitPrice: Number(sellAllPrice), fundingCashAccountId: selected.cashAccount.id }, "Sell All completed.", "v4"); if (ok) { setShowSellAll(false); setSellAllPrice(""); } }

  if (!data) return <div className="mx-auto w-full max-w-[1450px] px-5 py-8 text-sm text-slate-400">Loading Investments…</div>;
  const activeAccounts = accounts.filter(a => a.isActive !== false);
  const totalRealized = Object.values(realizedByAccount).reduce((sum, value) => sum + value, 0);
  const totalDividend = Object.values(dividendByAccount).reduce((sum, value) => sum + value, 0);
  const totalUnrealized = Number(data.summary.unrealized ?? 0) || 0;
  const totalProfit = totalUnrealized + totalRealized + totalDividend;
  const formattedPriceUpdate = lastPriceUpdate
    ? new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      }).format(lastPriceUpdate)
    : "Belum tersedia";
  return <div className="mx-auto w-full min-w-0 max-w-[1450px] px-5 py-8 lg:px-8"><header className="mb-6 flex w-full flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-400">Portfolio</p><h1 className="mt-1 text-3xl font-bold text-white">Investments</h1><p className="mt-2 text-sm text-slate-500">Accounts, holdings, transactions, RDN cash and performance.</p></div><nav className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#0b121a] p-1"><button onClick={() => { setScreen("overview"); setAccountId(""); }} className={`rounded-lg px-4 py-2 text-xs font-bold uppercase ${screen === "overview" ? "bg-white/[.09] text-white" : "text-slate-500"}`}>Overview</button><button onClick={() => { setScreen("transactions"); setAccountId(accountId || activeAccounts[0]?.id || ""); setSelectedAssetId(""); }} className={`rounded-lg px-4 py-2 text-xs font-bold uppercase ${screen === "transactions" ? "bg-white/[.09] text-white" : "text-slate-500"}`}>Transactions</button><button onClick={() => { setScreen("accounts"); setAccountId(""); setSelectedAssetId(""); setHistoryOpen(false); }} className={`rounded-lg px-4 py-2 text-xs font-bold uppercase ${screen === "accounts" ? "bg-white/[.09] text-white" : "text-slate-500"}`}>Accounts</button></nav></header>{message && <div className={`mb-5 rounded-xl border px-4 py-3 text-xs ${/error|failed|cannot|melebihi|tidak|invalid|insufficient|negative/i.test(message) ? "border-red-400/20 bg-red-400/[.05] text-red-300" : "border-emerald-400/20 bg-emerald-400/[.05] text-emerald-300"}`}>{message}</div>}
    {screen === "overview" && <section className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Total Investment", data.summary.totalInvestmentValue, "portfolio + cash"],
            ["RDN Cash", data.summary.totalCash, "all settlement balances"],
            ["Portfolio", data.summary.totalValue, "current market value"],
            ["Unrealized P/L", data.summary.unrealized, `${Number(data.summary.returnPct).toFixed(2)}% return`],
          ].map(([l, v, sub]) => (
            <div className={card} key={String(l)}>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">{l}</p>
              <p className="mt-2 text-xl font-bold text-white">{money(v as number)}</p>
              <p className="mt-1 text-[10px] text-slate-600">{sub}</p>
            </div>
          ))}
          <div className={card}>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Realized P/L</p>
            <p className={`mt-2 text-xl font-bold ${totalRealized >= 0 ? "text-emerald-300" : "text-red-300"}`}>
              {money(totalRealized)}
            </p>
            <p className="mt-1 text-[10px] text-slate-600">net after selling costs</p>
          </div>
          <div className={card}>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Dividend Income</p>
            <p className="mt-2 text-xl font-bold text-emerald-300">{money(totalDividend)}</p>
            <p className="mt-1 text-[10px] text-slate-600">cash income received</p>
          </div>
          <div className={card}>
            <p className="text-[10px] uppercase tracking-widest text-slate-500">Total Profit</p>
            <p className={`mt-2 text-xl font-bold ${totalProfit >= 0 ? "text-emerald-300" : "text-red-300"}`}>{money(totalProfit)}</p>
            <p className="mt-1 text-[10px] text-slate-600">unrealized + realized + dividend</p>
          </div>
        </div><div className={card}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Investment Accounts</h2><p className="text-xs text-slate-600">Klik account untuk langsung masuk ke Transactions.</p></div><button type="button" onClick={() => openAccountEditor()} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ Add account</button></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{activeAccounts.map(a => { const f=feeInfo(a); const portfolio=holdings.filter(h=>h.account.id===a.id).reduce((s,h)=>s+Number(h.marketValue),0); return <button type="button" key={a.id} onClick={() => chooseAccount(a.id,"transactions")} className="rounded-2xl border border-white/10 bg-white/[.02] p-5 text-left hover:border-emerald-400/30"><div className="flex items-start justify-between"><div><p className="text-base font-semibold text-white">{a.provider.name}</p><p className="mt-1 text-xs text-slate-500">RDN {f.rdnBankName || "—"} · {a.currency.code}</p></div><span className="text-[10px] uppercase tracking-widest text-emerald-300">Open →</span></div><div className="mt-5 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-600">RDN Cash</p>
                <p className="mt-1 font-semibold text-white">{money(a.cashAccount?.balance ?? 0,a.currency.code)}</p>
              </div>
              <div>
                <p className="text-slate-600">Portfolio</p>
                <p className="mt-1 font-semibold text-white">{money(portfolio,a.currency.code)}</p>
              </div>
            </div>
            <div className="mt-4 border-t border-white/5 pt-3 text-left">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Realized P/L · net</p>
              <p className={`mt-1 text-xs font-bold ${(
                realizedByAccount[a.id] ?? 0
              ) >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                {money(realizedByAccount[a.id] ?? 0, a.currency.code)}
              </p>
            </div>
          </button>; })}</div></div></section>}
    {screen === "transactions" && selected && <section className="space-y-5">
      <div className="rounded-2xl border border-white/10 bg-[#0d151e] px-5 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">{selected.provider.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-semibold text-white">{selected.name}</h2>
              <span className="rounded-lg border border-emerald-400/20 bg-emerald-400/[.04] px-2.5 py-1 text-xs font-semibold text-emerald-300">
                RDN Balance · {money(selectedCash?.balance ?? selected.cashAccount?.balance ?? 0, selected.currency.code)}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">RDN {fee.rdnBankName || "—"} · {selected.currency.code}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="cursor-pointer rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-emerald-400/30">
              {importing ? "Uploading…" : "Upload Excel"}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" disabled={importing} onChange={e=>{const file=e.target.files?.[0]; if(file) void importExcel(file); e.currentTarget.value="";}} />
            </label>
            <select className={`w-full md:w-auto ${select}`} value={accountId} onChange={e=>{setAccountId(e.target.value);setSelectedAssetId("")}}>
              {activeAccounts.map(a=><option key={a.id} value={a.id}>{a.provider.name} · RDN {feeInfo(a).rdnBankName || "—"}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className={card}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-emerald-400">Market Data</p>
              <p className="mt-1 text-xs text-slate-400">
                Last price update:{" "}
                <span className="font-semibold text-slate-300">
                  {formattedPriceUpdate} WIB
                </span>
              </p>
              <p className="mt-1 text-[10px] text-slate-600">
                Source: Yahoo Finance · Indonesian stocks
              </p>
              {marketError && (
                <p className="mt-1 text-[10px] text-red-300">{marketError}</p>
              )}
            </div>
            <button
              type="button"
              onClick={refreshPrices}
              disabled={refreshingPrices}
              className="shrink-0 rounded-lg border border-emerald-400/20 bg-emerald-400/[.04] px-4 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-400/[.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshingPrices ? "Refreshing…" : "↻ Refresh Prices"}
            </button>
          </div>
        </div>
      <div className={card}><div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-semibold text-white">Asset Summary</h2><p className="text-xs text-slate-600">Satu baris = satu asset, gabungan seluruh lot yang masih dimiliki.</p></div><div className="flex items-center gap-2"><div className="flex rounded-lg border border-white/10 bg-white/[.02] p-1"><button type="button" onClick={()=>{setAssetSummaryView("cards");window.localStorage.setItem("okane.assetSummaryView","cards");}} className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${assetSummaryView === "cards" ? "bg-white/[.08] text-white" : "text-slate-500"}`}>▦ Cards</button><button type="button" onClick={()=>{setAssetSummaryView("table");window.localStorage.setItem("okane.assetSummaryView","table");}} className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${assetSummaryView === "table" ? "bg-white/[.08] text-white" : "text-slate-500"}`}>☷ Table</button></div><button type="button" onClick={()=>{setDividendAssetId(selectedAssetId || assetSummaries[0]?.asset.id || "");setDividendAmount("");setDividendDate(today());setDividendDestination(selected.cashAccount?.id || "");setShowDividend(true);}} className="rounded-lg border border-emerald-400/20 px-3 py-2 text-xs font-bold text-emerald-300">+ Dividend</button><button type="button" onClick={()=>openTrade("BUY")} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ New transaction</button></div></div>{assetSummaries.length ? <>{assetSummaryView === "cards" ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{assetSummaries.map(s=><div key={s.asset.id} className={`rounded-2xl border p-4 ${selectedAssetId===s.asset.id?"border-emerald-400/40 bg-emerald-400/[.04]":"border-white/10 bg-white/[.02]"}`} onClick={()=>setSelectedAssetId(selectedAssetId===s.asset.id?"":s.asset.id)}><div className="flex items-start justify-between"><div><p className="text-lg font-bold text-white">{s.asset.symbol||s.asset.name}</p><p className="text-[10px] text-slate-600">{s.asset.name}</p></div><span className="text-xs text-slate-500">{nf(s.quantity/unitsPerLot(s.asset),0)} lot</span></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-slate-600">Avg Cost</p><p className="mt-1 font-semibold text-white">{money(s.avgCost,selected.currency.code)}</p></div><div><p className="text-slate-600">Current</p><p className="mt-1 font-semibold text-white">{s.currentPrice==null?"—":money(s.currentPrice,selected.currency.code)}</p></div><div><p className="text-slate-600">Value</p><p className="mt-1 font-semibold text-white">{money(s.marketValue,selected.currency.code)}</p></div><div><p className="text-slate-600">Min. Sell</p><p className="mt-1 font-semibold text-amber-300">{money(s.minSell,selected.currency.code)}</p></div></div><div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3"><span className="text-[10px] uppercase tracking-widest text-slate-600">Unrealized P/L</span><span className={`text-sm font-bold ${s.pnl>=0?"text-emerald-300":"text-red-300"}`}>{money(s.pnl,selected.currency.code)}</span></div><button type="button" onClick={e=>{e.stopPropagation();setSellAllAssetId(s.asset.id);setSellAllPrice(String(s.currentPrice??s.minSell));setShowSellAll(true);}} className="mt-3 rounded-lg border border-emerald-400/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">Sell All</button></div>)}</div> : <div className="overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[980px] text-left text-xs"><thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Asset</th><th>Qty</th><th>Avg Cost</th><th>Current</th><th>Market Value</th><th>Min. Sell</th><th>Unrealized P/L</th><th className="text-right">Action</th></tr></thead><tbody className="divide-y divide-white/5">{assetSummaries.map(s=><tr key={s.asset.id} className={selectedAssetId===s.asset.id?"bg-emerald-400/[.03]":""} onClick={()=>setSelectedAssetId(selectedAssetId===s.asset.id?"":s.asset.id)}><td className="px-3 py-3"><p className="font-semibold text-white">{s.asset.symbol||s.asset.name}</p><p className="text-[10px] text-slate-600">{s.asset.name}</p></td><td>{nf(s.quantity/unitsPerLot(s.asset),0)} lot</td><td>{money(s.avgCost,selected.currency.code)}</td><td>{s.currentPrice==null?"—":money(s.currentPrice,selected.currency.code)}</td><td>{money(s.marketValue,selected.currency.code)}</td><td className="text-amber-300">{money(s.minSell,selected.currency.code)}</td><td className={s.pnl>=0?"text-emerald-300":"text-red-300"}>{money(s.pnl,selected.currency.code)}</td><td className="px-3 text-right"><button type="button" onClick={e=>{e.stopPropagation();setSellAllAssetId(s.asset.id);setSellAllPrice(String(s.currentPrice??s.minSell));setShowSellAll(true);}} className="rounded-lg border border-emerald-400/20 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300">Sell All</button></td></tr>)}</tbody></table></div>}</> : <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-600">Belum ada open position.</div>}</div>
      <div className={card}>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">Transaction Detail{selectedAssetId ? ` · ${assetSummaries.find(a => a.asset.id === selectedAssetId)?.asset.symbol || "Asset"}` : ""}</h2>
            <p className="text-xs text-slate-600">Open positions selalu berada di atas.</p>
          </div>
          {selectedAssetId && <button type="button" onClick={() => setSelectedAssetId("")} className="text-xs text-slate-400">Clear filter</button>}
        </div>

        <button type="button" onClick={() => setOpenPositionsOpen(v => !v)} className="flex w-full items-center justify-between rounded-xl border border-emerald-400/10 bg-emerald-400/[.02] p-3 text-left text-xs text-slate-400 hover:bg-emerald-400/[.04]">
          <span>OPEN POSITIONS · {selectedOpenRows.length}</span>
          <span className="text-slate-500">{openPositionsOpen ? "Collapse ↑" : "Expand ↓"}</span>
        </button>

        {openPositionsOpen && (
          selectedOpenRows.length ? (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-xs">
                <thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Date</th><th>Asset</th><th>Buy</th><th>Remaining</th><th>Current</th><th>Min. Sell</th><th>P/L</th><th className="text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {selectedOpenRows.map(r => (
                    <tr key={r.lotId}>
                      <td className="px-3 py-3 text-slate-400">{new Date(r.transactionDate).toLocaleDateString("id-ID")}</td>
                      <td className="font-semibold text-white">{r.asset.symbol || r.asset.name}</td>
                      <td>{money(r.unitPrice, selected.currency.code)}</td>
                      <td>{nf(Number(r.remainingQuantity) / unitsPerLot(r.asset), 0)} lot</td>
                      <td>{r.currentPrice == null ? "—" : money(r.currentPrice, selected.currency.code)}</td>
                      <td className="text-amber-300">{money(r.minimumSellPrice, selected.currency.code)}</td>
                      <td className={Number(r.unrealizedGainLoss) >= 0 ? "text-emerald-300" : "text-red-300"}>{money(r.unrealizedGainLoss, selected.currency.code)}</td>
                      <td className="text-right whitespace-nowrap"><button type="button" onClick={() => openTrade("SELL", r)} className="rounded-lg bg-emerald-400 px-3 py-1.5 text-[10px] font-bold text-[#07110b]">Sell / Split</button><button type="button" onClick={() => deleteTransaction(r.id)} className="ml-2 rounded-lg border border-red-400/20 px-3 py-1.5 text-[10px] font-bold text-red-300">Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="p-8 text-center text-xs text-slate-600">Tidak ada open position.</div>
        )}

        <div className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[.02] p-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="shrink-0 text-xs text-slate-500">CLOSED TRANSACTIONS · {selectedClosed.length}</span>
            <select aria-label="Filter closed transactions by asset" className="w-full max-w-[220px] rounded-lg border border-white/10 bg-[#101923] px-3 py-2 text-xs text-slate-300 outline-none" value={closedAssetId} onChange={e => setClosedAssetId(e.target.value)}>
              <option value="">All Assets</option>
              {closedAssets.slice().sort((a, b) => String(a.symbol || a.name).localeCompare(String(b.symbol || b.name), "id", { sensitivity: "base" })).map(asset => <option key={asset.id} value={asset.id}>{asset.symbol || asset.name}</option>)}
            </select>
          </div>
          <button type="button" onClick={() => setClosedTransactionsOpen(v => !v)} className="shrink-0 text-xs text-slate-500 hover:text-slate-300">{closedTransactionsOpen ? "Collapse ↑" : "Expand ↓"}</button>
        </div>

        {closedTransactionsOpen && (
          <>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[.015] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">CLOSED SUMMARY</span>
                <button type="button" onClick={() => setClosedSummaryOpen(v => !v)} className="text-xs text-slate-500 hover:text-slate-300">{closedSummaryOpen ? "Collapse ↑" : "Expand ↓"}</button>
              </div>
              {closedSummaryOpen && (
                <div className="overflow-x-auto">
                  {closedSummary.length > 0 ? (
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Asset</th><th>Sold Qty</th><th>Avg Buy</th><th>Avg Sell</th><th>Net P/L</th><th>P/L %</th></tr></thead>
                      <tbody className="divide-y divide-white/5">{closedSummary.map(s => <tr key={s.asset.id}><td className="px-3 py-3 font-semibold text-white">{s.asset.symbol || s.asset.name}</td><td>{nf(s.soldQuantity / unitsPerLot(s.asset), 0)} lot</td><td>{money(s.avgBuy, selected.currency.code)}</td><td>{money(s.avgSell, selected.currency.code)}</td><td className={s.netPnl >= 0 ? "text-emerald-300" : "text-red-300"}>{money(s.netPnl, selected.currency.code)}</td><td className={s.pnlPct >= 0 ? "text-emerald-300" : "text-red-300"}>{nf(s.pnlPct, 2)}%</td></tr>)}</tbody>
                    </table>
                  ) : <div className="p-6 text-center text-xs text-slate-600">Tidak ada closed transaction.</div>}
                </div>
              )}
            </div>

            {selectedClosed.length > 0 && (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[.015] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">CLOSED DETAIL</span>
                  <button type="button" onClick={() => setClosedDetailOpen(v => !v)} className="text-xs text-slate-500 hover:text-slate-300">{closedDetailOpen ? "Collapse ↑" : "Expand ↓"}</button>
                </div>
                {closedDetailOpen && (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] text-left text-xs">
                      <thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Sell Date</th><th>Asset</th><th>Sold Qty</th><th>Avg Buy</th><th>Sell Price</th><th>Holding Period</th><th>Net P/L</th><th>P/L %</th><th className="text-right">Action</th></tr></thead>
                      <tbody className="divide-y divide-white/5">
                        {selectedClosed.map(x => {
                          const buyCost = Number(x.lot.totalCost) * Number(x.sale.quantity) / Math.max(Number(x.lot.quantity), 1);
                          const realized = Number(x.sale.realized);
                          const pnlPct = buyCost !== 0 ? (realized / buyCost) * 100 : 0;
                          const holdingDays = Math.max(0, Math.floor((new Date(x.sale.date).getTime() - new Date(x.lot.transactionDate).getTime()) / 86400000));
                          return <tr key={x.sale.id}><td className="px-3 py-3 whitespace-nowrap text-slate-400">{new Date(x.sale.date).toLocaleDateString("id-ID")}</td><td className="font-semibold text-white">{x.lot.asset.symbol || x.lot.asset.name}</td><td>{nf(Number(x.sale.quantity) / unitsPerLot(x.lot.asset), 0)} lot</td><td>{money(x.lot.unitPrice, selected.currency.code)}</td><td>{money(x.sale.price, selected.currency.code)}</td><td className="whitespace-nowrap">{holdingDays} days</td><td className={realized >= 0 ? "text-emerald-300" : "text-red-300"}>{money(realized, selected.currency.code)}</td><td className={pnlPct >= 0 ? "text-emerald-300" : "text-red-300"}>{nf(pnlPct, 2)}%</td><td className="text-right whitespace-nowrap"><button type="button" onClick={() => { const d = new Date(x.sale.date).toISOString().slice(0, 10); setClosedEdit({ id: x.sale.id, asset: x.lot.asset, quantity: Number(x.sale.quantity), date: d, price: Number(x.sale.price) }); setClosedEditDate(d); setClosedEditPrice(String(x.sale.price)); setClosedEditTax("0"); setClosedEditOther("0"); }} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-bold text-slate-300">Edit</button><button type="button" onClick={() => deleteClosedTransaction(x.sale.id)} className="ml-2 rounded-lg border border-red-400/20 px-2.5 py-1.5 text-[10px] font-bold text-red-300">Delete</button></td></tr>;
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <div className={card}><div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold text-white">Dividend Detail</h2><p className="text-xs text-slate-600">Net dividend yang diterima.</p></div><div className="flex gap-2"><select className="rounded-lg border border-white/10 bg-[#101923] px-3 py-2 text-xs text-slate-300" value={dividendFilterAssetId} onChange={e=>setDividendFilterAssetId(e.target.value)}><option value="">All Assets</option>{Array.from(new Map(dividendRows.map(d=>[d.asset.id,d.asset])).values()).map(a=><option key={a.id} value={a.id}>{a.symbol||a.name}</option>)}</select><button type="button" onClick={()=>setDividendEdit({id:"",assetId:"",date:today(),amount:""})} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ Add Dividend</button><DividendImport accountId={accountId} onDone={reload} /></div></div>{(()=>{const rows=dividendFilterAssetId?dividendRows.filter(d=>d.asset.id===dividendFilterAssetId):dividendRows;return rows.length?<div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Date</th><th>Asset</th><th>Net Dividend</th><th className="text-right">Action</th></tr></thead><tbody className="divide-y divide-white/5">{rows.map(d=><tr key={d.id}><td className="px-3 py-3 text-slate-400">{new Date(d.transactionDate).toLocaleDateString("id-ID")}</td><td className="font-semibold text-white">{d.asset.symbol||d.asset.name}</td><td className="text-emerald-300">{money(d.netCashAmount,selected.currency.code)}</td><td className="text-right"><button type="button" onClick={()=>setDividendEdit({id:d.id,assetId:d.asset.id,date:new Date(d.transactionDate).toISOString().slice(0,10),amount:String(d.netCashAmount)})} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] font-bold text-slate-300">Edit</button><button type="button" onClick={()=>void removeDividend(d.id)} className="ml-2 rounded-lg border border-red-400/20 px-2.5 py-1.5 text-[10px] font-bold text-red-300">Delete</button></td></tr>)}</tbody></table></div>:<div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-xs text-slate-600">Belum ada dividend.</div>})()}</div></section>}
    {screen === "accounts" && <section className="space-y-5"><div className={card}><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold text-white">Investment Accounts</h2><p className="text-xs text-slate-600">Buat dan kelola account broker/RDN di sini.</p></div><div className="flex gap-2"><button type="button" onClick={()=>openAccountEditor()} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ Add account</button><button type="button" onClick={()=>void resetInvestmentData()} disabled={busy} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs font-bold text-red-300 disabled:opacity-40">Reset Investment</button></div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{activeAccounts.map(a=>{const f=feeInfo(a);return <button type="button" key={a.id} onClick={()=>setAccountId(accountId===a.id?"":a.id)} className={`rounded-2xl border p-4 text-left ${accountId===a.id?"border-emerald-400/40 bg-emerald-400/[.04]":"border-white/10 bg-white/[.02]"}`}><div className="flex items-start justify-between"><div><p className="font-semibold text-white">{a.provider.name}</p><p className="mt-1 text-[10px] text-slate-500">RDN {f.rdnBankName||"—"} · {a.currency.code}</p></div><span className="text-[10px] uppercase tracking-widest text-emerald-300">Active</span></div><div className="mt-4"><p className="text-[10px] text-slate-600">RDN balance</p><p className="mt-1 text-xl font-bold text-white">{money(a.cashAccount?.balance??0,a.currency.code)}</p></div></button>})}</div></div>{selected&&<div className={card}><div className="flex items-start justify-between"><div><p className="text-[10px] uppercase tracking-widest text-emerald-400">Account Detail</p><h2 className="mt-1 text-xl font-semibold text-white">{selected.provider.name}</h2><p className="mt-1 text-xs text-slate-500">RDN {fee.rdnBankName||"—"} · {fee.rdnAccountNumber||"No. RDN"} · {selected.currency.code}</p></div><div className="flex gap-2"><button type="button" onClick={()=>openAccountEditor(selected)} className="rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300">Edit</button><button type="button" onClick={()=>accountAction("account.close",selected)} className="rounded-lg border border-amber-400/20 px-3 py-2 text-xs text-amber-300">Close</button><button type="button" onClick={()=>accountAction("account.delete",selected)} className="rounded-lg border border-red-400/20 px-3 py-2 text-xs text-red-300">Delete</button></div></div><div className="mt-5 grid gap-3 md:grid-cols-3"><div className="rounded-xl border border-white/10 p-4"><p className="text-[10px] text-slate-600">RDN balance</p><p className="mt-1 text-lg font-bold text-white">{money(selectedCash?.balance??0,selected.currency.code)}</p></div><div className="rounded-xl border border-white/10 p-4"><p className="text-[10px] text-slate-600">Buy fee</p><p className="mt-1 text-lg font-bold text-white">{nf(fee.buyFeePct,3)}%</p></div><div className="rounded-xl border border-white/10 p-4"><p className="text-[10px] text-slate-600">Sell fee</p><p className="mt-1 text-lg font-bold text-white">{nf(fee.sellFeePct,3)}%</p></div></div><div className="mt-5 grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[.02] p-4"><h3 className="font-semibold text-white">Update RDN Balance</h3><p className="text-xs text-slate-600">Set sesuai saldo aktual broker.</p><div className="mt-4 space-y-3"><input className={input} type="number" min="0" step="0.01" placeholder="Actual balance" value={cashBalance} onChange={e=>setCashBalance(e.target.value)} /><input className={input} type="date" value={cashDate} onChange={e=>setCashDate(e.target.value)} /><button type="button" onClick={saveCash} disabled={!cashBalance||busy} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#07110b] disabled:opacity-40">Update balance</button></div></div><div className="rounded-2xl border border-white/10 bg-white/[.02] p-4"><h3 className="font-semibold text-white">Withdraw to Wallet</h3><p className="text-xs text-slate-600">Pindahkan dana dari RDN ke Wallet OKANE.</p><div className="mt-4 space-y-3"><select className={select} value={withdrawWalletId} onChange={e=>setWithdrawWalletId(e.target.value)}><option value="">Select wallet</option>{wallets.filter(w=>w.currency.code===selected.currency.code).map(w=><option key={w.id} value={w.id}>{w.name} · {money(w.balance,w.currency.code)}</option>)}</select><input className={input} type="number" min="0.01" step="0.01" max={String(selectedCash?.balance??0)} placeholder="Amount" value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)} /><button type="button" onClick={doWithdraw} disabled={busy||!selectedCash||!withdrawWalletId||Number(withdrawAmount)<=0||Number(withdrawAmount)>Number(selectedCash?.balance??0)} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#07110b] disabled:opacity-40">Withdraw to Wallet</button></div></div></div><div className="mt-5"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-white">RDN Transaction History</h3><p className="text-xs text-slate-600">History khusus untuk RDN account ini.</p></div><button type="button" onClick={()=>{const next=!historyOpen;setHistoryOpen(next);if(next&&selectedCash)loadHistory(selectedCash.id);}} className="text-xs text-slate-400">{historyOpen?"Hide":"Show"}</button></div>{historyOpen&&<div className="mt-3 overflow-x-auto rounded-xl border border-white/10"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-4 py-3">Date</th><th>Type</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="px-4 text-right">Balance</th></tr></thead><tbody className="divide-y divide-white/5">{historyLoading?<tr><td colSpan={6} className="px-4 py-6 text-center text-slate-600">Loading…</td></tr>:historyRows.map(x=><tr key={x.id}><td className="px-4 py-3 text-slate-400">{new Date(x.date).toLocaleDateString("id-ID")}</td><td>{x.movementType}</td><td>{x.description}</td><td className="text-right text-red-300">{Number(x.debit)?money(x.debit,selected.currency.code):"—"}</td><td className="text-right text-emerald-300">{Number(x.credit)?money(x.credit,selected.currency.code):"—"}</td><td className="px-4 text-right font-semibold text-white">{money(x.balance,selected.currency.code)}</td></tr>)}</tbody></table></div>}</div></div>}</section>}
    {dividendEdit&&<div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b121a] p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold text-white">{dividendEdit.id?"Edit Dividend":"Add Dividend"}</h3><button type="button" onClick={()=>setDividendEdit(null)} className="text-slate-500">✕</button></div><div className="space-y-3"><select className={select} value={dividendEdit.assetId} onChange={e=>setDividendEdit({...dividendEdit,assetId:e.target.value})}><option value="">Select Asset</option>{pickerAssets.map(a=><option key={a.id} value={a.id}>{a.symbol||a.name}</option>)}</select><input type="date" className={input} value={dividendEdit.date} onChange={e=>setDividendEdit({...dividendEdit,date:e.target.value})}/><input type="number" min="0" step="any" className={input} placeholder="Net Dividend" value={dividendEdit.amount} onChange={e=>setDividendEdit({...dividendEdit,amount:e.target.value})}/><button type="button" onClick={()=>void saveDividendEdit()} className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#07110b]">Save Dividend</button></div></div></div>}
    <AccountModal open={showAccountModal} editing={editing} form={accountForm} currencies={currencies} onClose={()=>setShowAccountModal(false)} onChange={setAccountForm} onSubmit={saveAccount} busy={busy} />
    {selected&&<TradeModal open={showTrade} trade={trade} assets={pickerAssets} account={selected} ledger={ledger} onClose={()=>setShowTrade(false)} onChange={setTrade} onSubmit={submitTrade} busy={busy} />}
    <ClosedDividendModal open={showDividend} account={selected} assets={assetSummaries.map(s=>s.asset)} assetId={dividendAssetId} amount={dividendAmount} date={dividendDate} destination={dividendDestination} setAssetId={setDividendAssetId} setAmount={setDividendAmount} setDate={setDividendDate} setDestination={setDividendDestination} onClose={()=>setShowDividend(false)} onSubmit={()=>void saveDividend()} busy={busy} /><SellAllModal open={showSellAll} summary={selectedSummary} account={selected} price={sellAllPrice} setPrice={setSellAllPrice} onClose={()=>setShowSellAll(false)} onSubmit={sellAll} busy={busy} />

    <ClosedSellEditModal open={Boolean(closedEdit)} edit={closedEdit} account={selected} date={closedEditDate} price={closedEditPrice} tax={closedEditTax} other={closedEditOther} setDate={setClosedEditDate} setPrice={setClosedEditPrice} setTax={setClosedEditTax} setOther={setClosedEditOther} onClose={()=>setClosedEdit(null)} onSubmit={submitClosedEdit} busy={busy} />
  </div>;
}
