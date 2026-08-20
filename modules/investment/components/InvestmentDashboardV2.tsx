"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Currency = { id: string; code: string };
type Provider = { id: string; name: string; websiteUrl?: string | null };
type Account = { id: string; name: string; accountType: string; provider: Provider; currency: Currency; accountNumberMasked?: string | null; note?: string | null; cashAccount?: { id: string; balance: string | number } | null };
type Asset = { id: string; symbol?: string | null; name: string; assetType: string; unitName: string; currency: Currency };
type Holding = { id: string; quantity: string | number; costBasis: string | number; currentPrice?: string | number | null; marketValue: string | number; gain: string | number; returnPct: string | number; asset: Asset; account: Account };
type Cash = { id: string; balance: string | number; account: Account };
type Overview = { currencies: Currency[]; providers: Provider[]; accounts: Account[]; assets: Asset[]; holdings: Holding[]; cashAccounts: Cash[]; summary: { totalValue: string | number; totalCash: string | number; totalInvestmentValue: string | number; unrealized: string | number; returnPct: string | number } };
type Sale = { id: string; date: string; quantity: string | number; price: string | number; proceeds: string | number; realized: string | number };
type LotRow = { id: string; lotId: string; transactionDate: string; asset: Asset; quantity: string | number; soldQuantity: string | number; remainingQuantity: string | number; unitPrice: string | number; totalCost: string | number; minimumSellPrice: string | number; currentPrice: string | number | null; priceAsOf: string | null; currentValue: string | number; unrealizedGainLoss: string | number; sales: Sale[] };
type Ledger = { account: Account; rows: LotRow[]; summary: { openLots: number; openQuantity: string | number; realizedGainLoss: string | number } };

const numberId = (v: string | number | null | undefined, digits = 2) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "0";
  const fixed = n.toFixed(digits);
  const [i, d] = fixed.split(".");
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return digits ? `${grouped},${d}` : grouped;
};
const symbol = (c: string) => ({ IDR: "Rp", USD: "US$", SGD: "S$", MYR: "RM", JPY: "¥", EUR: "€", GBP: "£" } as Record<string, string>)[c] ?? c;
const money = (v: string | number | null | undefined, c = "IDR") => `${symbol(c)}${numberId(v)}`;
const dateId = (v: string | null | undefined) => { if (!v) return "—"; const d = new Date(v); return Number.isNaN(d.getTime()) ? "—" : `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };
const today = () => new Date().toISOString().slice(0, 10);
const input = "w-full rounded-xl border border-white/10 bg-[#080f17] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-600";
const select = `${input} text-slate-300`;
const card = "rounded-2xl border border-white/10 bg-[#0d151e] p-5";

function rdn(account: Account) { try { return account.note ? JSON.parse(account.note) as { rdnBankName?: string; rdnAccountNumber?: string } : {}; } catch { return {}; } }
function assetLabel(asset: Asset) { return asset.symbol ? `${asset.symbol} · ${asset.name}` : asset.name; }

async function overviewData(): Promise<Overview> { const r = await fetch("/api/investments", { cache: "no-store" }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Unable to load investments."); return j; }
async function postV2(body: Record<string, unknown>) { const r = await fetch("/api/investments/v2", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Investment operation failed."); return j; }

export default function InvestmentDashboardV2() {
  const [data, setData] = useState<Overview | null>(null);
  const [screen, setScreen] = useState<"overview" | "transactions" | "cash" | "accounts">("overview");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [accountForm, setAccountForm] = useState({ providerName: "", websiteUrl: "", rdnBankName: "", rdnAccountNumber: "", currencyId: "" });
  const [cashForm, setCashForm] = useState({ cashAccountId: "", balance: "", date: today() });
  const [assetForm, setAssetForm] = useState({ symbol: "", name: "", assetType: "STOCK", currencyId: "", unitName: "share" });
  const [trade, setTrade] = useState({ type: "BUY" as "BUY" | "SELL", assetId: "", assetQuery: "", quantity: "", unitPrice: "", fee: "", tax: "", other: "", date: today(), sourceLotId: "" });
  const [splitLot, setSplitLot] = useState<LotRow | null>(null);
  const [importing, setImporting] = useState(false);

  const reload = async () => setData(await overviewData());
  const loadLedger = async (accountId: string) => { const r = await fetch(`/api/investments/v2?accountId=${encodeURIComponent(accountId)}`, { cache: "no-store" }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Unable to load account transactions."); setLedger(j); };

  useEffect(() => { reload().catch((e) => setMessage(e.message)); }, []);
  useEffect(() => { if (selectedAccountId) loadLedger(selectedAccountId).catch((e) => setMessage(e.message)); }, [selectedAccountId]);

  const accounts = data?.accounts ?? [];
  const assets = data?.assets ?? [];
  const holdings = data?.holdings ?? [];
  const cashAccounts = data?.cashAccounts ?? [];
  const currencies = data?.currencies ?? [];
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const selectedAsset = assets.find((a) => a.id === trade.assetId);
  const compatibleCash = cashAccounts.filter((c) => selectedAccount && c.account.provider.id === selectedAccount.provider.id && c.account.currency.id === selectedAccount.currency.id);
  const accountHoldings = useMemo(() => holdings.filter((h) => h.account.id === selectedAccountId), [holdings, selectedAccountId]);
  const transactionAssets = useMemo(() => {
    const seen = new Set<string>();
    const result: Asset[] = [];
    for (const row of ledger?.rows ?? []) {
      if (!seen.has(row.asset.id)) { seen.add(row.asset.id); result.push(row.asset); }
    }
    for (const holding of accountHoldings) {
      if (!seen.has(holding.asset.id)) { seen.add(holding.asset.id); result.push(holding.asset); }
    }
    return result;
  }, [ledger?.rows, accountHoldings]);
  const pickerAssets = useMemo(() => {
    const seen = new Set<string>();
    return [...transactionAssets, ...assets].filter((asset) => {
      if (seen.has(asset.id)) return false;
      seen.add(asset.id);
      return true;
    });
  }, [transactionAssets, assets]);

  const chooseAccount = async (id: string) => { setSelectedAccountId(id); setScreen("transactions"); setMessage(""); setTrade(x => ({ ...x, assetId: "", assetQuery: "", sourceLotId: "" })); };
  const run = async (body: Record<string, unknown>, success = "Saved successfully.") => { setBusy(true); setMessage(""); try { await postV2(body); await reload(); if (selectedAccountId) await loadLedger(selectedAccountId); setMessage(success); } catch (e) { setMessage(e instanceof Error ? e.message : "Operation failed."); } finally { setBusy(false); } };

  const selectAsset = (value: string) => {
    const normalized = value.trim().toLowerCase();
    const found = pickerAssets.find((asset) => assetLabel(asset).toLowerCase() === normalized || (asset.symbol ?? "").toLowerCase() === normalized);
    setTrade(x => ({ ...x, assetQuery: value, assetId: found?.id ?? "" }));
  };

  const submitTrade = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !selectedAsset) return;
    const isStock = selectedAsset.assetType === "STOCK";
    const quantity = Number(trade.quantity) * (isStock ? 100 : 1);
    await run({ action: "transaction.create", accountId: selectedAccount.id, assetId: selectedAsset.id, transactionType: trade.type, transactionDate: new Date(trade.date).toISOString(), quantity, unitPrice: Number(trade.unitPrice), feeAmount: Number(trade.fee || 0), taxAmount: Number(trade.tax || 0), otherCharges: Number(trade.other || 0), sourceLotId: trade.sourceLotId || undefined });
    setTrade((x) => ({ ...x, quantity: "", unitPrice: "", sourceLotId: "" })); setSplitLot(null);
  };

  const importExcel = async (file: File) => {
    if (!selectedAccount) return;
    setImporting(true); setMessage("");
    try {
      const form = new FormData(); form.append("action", "import.excel"); form.append("accountId", selectedAccount.id); form.append("file", file);
      const r = await fetch("/api/investments/v2", { method: "POST", body: form }); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Import failed.");
      await reload(); await loadLedger(selectedAccount.id); setMessage(`Imported ${j.imported} rows. Skipped ${j.skipped}.`);
      if (j.warnings?.length) setMessage(`Imported ${j.imported} rows with ${j.warnings.length} warnings.`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Import failed."); } finally { setImporting(false); }
  };

  return <div className="mx-auto max-w-[1450px] px-5 py-8 lg:px-8">
    <header className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-400">Portfolio</p><h1 className="mt-1 text-3xl font-bold text-white">Investments</h1><p className="mt-2 text-sm text-slate-500">Accounts, transactions, lots and live unrealized performance.</p></div>
      <nav className="flex flex-wrap gap-1 rounded-xl border border-white/10 bg-[#0b121a] p-1">{([["overview","Overview"],["transactions","Transactions"],["cash","Cash"],["accounts","Accounts"]] as const).map(([key,label]) => <button key={key} onClick={() => setScreen(key)} className={`rounded-lg px-4 py-2 text-xs font-bold uppercase tracking-wide ${screen === key ? "bg-white/[.09] text-white" : "text-slate-500 hover:text-slate-300"}`}>{label}</button>)}</nav>
    </header>

    {message && <div className={`mb-4 rounded-xl border px-4 py-3 text-xs ${message.toLowerCase().includes("error") || message.toLowerCase().includes("failed") || message.toLowerCase().includes("insufficient") ? "border-red-400/20 bg-red-400/[.05] text-red-300" : "border-emerald-400/20 bg-emerald-400/[.05] text-emerald-300"}`}>{message}</div>}

    {screen === "overview" && <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-4">{[["Total Investment", data?.summary.totalInvestmentValue, "portfolio + cash"],["Cash", data?.summary.totalCash, "RDN / settlement"],["Portfolio", data?.summary.totalValue, "current value"],["Unrealized P/L", data?.summary.unrealized, `${Number(data?.summary.returnPct || 0).toFixed(2)}% return`]].map(([label,value,sub]) => <div className={card} key={String(label)}><p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p><p className="mt-2 text-xl font-bold text-white">{money(value as number)}</p><p className="mt-1 text-[10px] text-slate-600">{sub}</p></div>)}</div>
      <section className={card}><div className="mb-4 flex items-end justify-between"><div><h2 className="font-semibold text-white">Investment Accounts</h2><p className="text-xs text-slate-600">Klik account untuk melihat seluruh transaksi dan lot.</p></div><button onClick={() => setScreen("accounts")} className="rounded-lg bg-emerald-400 px-3 py-2 text-xs font-bold text-[#07110b]">+ Account</button></div>
        {accounts.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{accounts.map((a) => { const r = rdn(a); const hs = holdings.filter((h) => h.account.id === a.id); const portfolio = hs.reduce((s,h) => s + Number(h.marketValue),0); const cost = hs.reduce((s,h)=>s+Number(h.costBasis),0); const cash = Number(a.cashAccount?.balance ?? 0); const pl = portfolio - cost; return <button key={a.id} onClick={() => chooseAccount(a.id)} className="rounded-2xl border border-white/10 bg-white/[.02] p-5 text-left transition hover:border-emerald-400/30 hover:bg-emerald-400/[.03]"><div className="flex items-start justify-between gap-3"><div><p className="text-base font-semibold text-white">{a.provider.name}</p><p className="mt-1 text-xs text-slate-500">{r.rdnBankName ? `RDN ${r.rdnBankName}` : "Investment account"} · {a.currency.code}</p></div><span className="text-[10px] font-bold uppercase tracking-widest text-emerald-300">Open →</span></div><div className="mt-5 grid grid-cols-2 gap-y-3 text-xs"><div><p className="text-slate-600">Cash</p><p className="mt-1 font-semibold text-white">{money(cash,a.currency.code)}</p></div><div><p className="text-slate-600">Portfolio</p><p className="mt-1 font-semibold text-white">{money(portfolio,a.currency.code)}</p></div><div><p className="text-slate-600">P/L</p><p className={`mt-1 font-semibold ${pl>=0?"text-emerald-300":"text-red-300"}`}>{pl>=0?"+":""}{money(pl,a.currency.code)}</p></div><div><p className="text-slate-600">Return</p><p className={`mt-1 font-semibold ${cost && pl/cost>=0?"text-emerald-300":"text-red-300"}`}>{cost ? `${(pl/cost*100).toFixed(2)}%` : "—"}</p></div></div></button>; })}</div> : <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-xs text-slate-600">Belum ada investment account.</div>}
      </section>
      <section className={card}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Holdings</h2><p className="text-xs text-slate-600">Current positions; harga saham diperbarui otomatis jika sudah stale.</p></div><button disabled={busy} onClick={() => run({action:"market.refresh"},"Market prices refreshed.")} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300">Refresh prices</button></div>{holdings.length ? <div className="divide-y divide-white/5">{holdings.map(h=><div key={h.id} className="flex items-center justify-between gap-4 py-3"><div><p className="text-sm font-semibold text-white">{h.asset.symbol || h.asset.name}</p><p className="text-[10px] text-slate-600">{h.account.provider.name} · {numberId(h.quantity, h.asset.assetType === "STOCK" ? 0 : 2)} {h.asset.assetType === "STOCK" ? "share" : h.asset.unitName}</p></div><div className="text-right"><p className="text-sm font-semibold text-white">{money(h.marketValue,h.asset.currency.code)}</p><p className={`text-[10px] ${Number(h.gain)>=0?"text-emerald-300":"text-red-300"}`}>{Number(h.gain)>=0?"+":""}{money(h.gain,h.asset.currency.code)} · {Number(h.returnPct).toFixed(2)}%</p></div></div>)}</div> : <p className="text-xs text-slate-600">No holdings yet.</p>}</section>
    </div>}

    {screen === "transactions" && <section className="space-y-5">{selectedAccount ? <>
      <div className={card}><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><button onClick={()=>setScreen("overview")} className="mb-2 text-xs font-semibold text-slate-500">← Investments</button><h2 className="text-2xl font-bold text-white">{selectedAccount.provider.name}</h2><p className="mt-1 text-xs text-slate-500">{rdn(selectedAccount).rdnBankName ? `RDN ${rdn(selectedAccount).rdnBankName}` : "Investment account"} · {selectedAccount.currency.code}</p></div><div className="flex flex-wrap gap-2"><label className="cursor-pointer rounded-xl border border-white/10 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/[.04]">{importing?"Importing…":"Import Excel"}<input type="file" accept=".xlsx,.xls" className="hidden" disabled={importing} onChange={(e)=>{const f=e.target.files?.[0]; if(f) importExcel(f); e.currentTarget.value="";}}/></label><button onClick={()=>{setTrade(x=>({...x,type:"BUY",sourceLotId:""}));}} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-xs font-bold text-[#07110b]">+ Transaction</button></div></div></div>
      <section className={card}><div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-white">Transaction Lots</h3><p className="text-xs text-slate-600">Satu baris = satu pembelian/lot, seperti ledger Excel Anda.</p></div><div className="text-right text-xs text-slate-500">Open lots <span className="font-bold text-white">{ledger?.summary.openLots ?? 0}</span></div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-xs"><thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-3 py-3">Date</th><th className="px-3 py-3">Asset</th><th className="px-3 py-3 text-right">Buy Lot</th><th className="px-3 py-3 text-right">Buy Price</th><th className="px-3 py-3 text-right">Total Cost</th><th className="px-3 py-3 text-right">Remaining</th><th className="px-3 py-3 text-right">Min Sell</th><th className="px-3 py-3 text-right">Current / Sell</th><th className="px-3 py-3 text-right">P/L</th><th className="px-3 py-3">Tools</th></tr></thead><tbody className="divide-y divide-white/5">{ledger?.rows.map((row)=><tr key={row.id} className="align-top"><td className="px-3 py-4 text-slate-400">{dateId(row.transactionDate)}</td><td className="px-3 py-4"><p className="font-semibold text-white">{row.asset.symbol || row.asset.name}</p><p className="text-[10px] text-slate-600">{row.asset.name}</p></td><td className="px-3 py-4 text-right font-semibold text-white">{numberId(Number(row.quantity)/(row.asset.assetType === "STOCK"?100:1),row.asset.assetType === "STOCK"?0:2)}</td><td className="px-3 py-4 text-right text-slate-300">{money(row.unitPrice,row.asset.currency.code)}</td><td className="px-3 py-4 text-right text-slate-300">{money(row.totalCost,row.asset.currency.code)}</td><td className="px-3 py-4 text-right font-semibold text-white">{numberId(Number(row.remainingQuantity)/(row.asset.assetType === "STOCK"?100:1),row.asset.assetType === "STOCK"?0:2)}</td><td className="px-3 py-4 text-right font-semibold text-amber-200">{money(row.minimumSellPrice,row.asset.currency.code)}</td><td className="px-3 py-4 text-right">{row.currentPrice!=null?<><p className="font-semibold text-white">{money(row.currentPrice,row.asset.currency.code)}</p><p className="text-[10px] text-slate-600">as of {dateId(row.priceAsOf)}</p></>:<span className="text-slate-600">—</span>}</td><td className={`px-3 py-4 text-right font-semibold ${Number(row.unrealizedGainLoss)>=0?"text-emerald-300":"text-red-300"}`}>{Number(row.remainingQuantity)>0 ? `${Number(row.unrealizedGainLoss)>=0?"+":""}${money(row.unrealizedGainLoss,row.asset.currency.code)}` : "—"}</td><td className="px-3 py-4"><div className="flex gap-2">{Number(row.remainingQuantity)>0 && <><button onClick={()=>{setTrade(x=>({...x,type:"SELL",assetId:row.asset.id,assetQuery:assetLabel(row.asset),sourceLotId:row.lotId,quantity:"",unitPrice:""}));setSplitLot(null);}} className="rounded-lg bg-emerald-400 px-3 py-1.5 text-[10px] font-bold text-[#07110b]">Sell</button><button onClick={()=>{setTrade(x=>({...x,type:"SELL",assetId:row.asset.id,assetQuery:assetLabel(row.asset),sourceLotId:row.lotId,quantity:"",unitPrice:""}));setSplitLot(row);}} className="rounded-lg border border-white/10 px-3 py-1.5 text-[10px] font-bold text-slate-300">Split</button></>}</div>{row.sales.length>0&&<div className="mt-3 space-y-1">{row.sales.map(s=><div key={s.id} className="rounded-lg bg-white/[.025] px-2 py-1.5 text-[10px]"><span className="text-slate-500">{dateId(s.date)}</span> · <span className="text-white">{numberId(Number(s.quantity)/(row.asset.assetType === "STOCK"?100:1),row.asset.assetType === "STOCK"?0:2)}</span> @ {money(s.price,row.asset.currency.code)} · <span className={Number(s.realized)>=0?"text-emerald-300":"text-red-300"}>{Number(s.realized)>=0?"+":""}{money(s.realized,row.asset.currency.code)}</span></div>)}</div>}</td></tr>)}</tbody></table>{!ledger?.rows.length&&<div className="p-10 text-center text-xs text-slate-600">Belum ada transaksi. Import Excel atau tambah transaksi.</div>}</div></section>
      <section className={card}><h3 className="font-semibold text-white">{trade.type === "BUY" ? "Add BUY" : splitLot ? `Split & SELL — ${splitLot.asset.symbol || splitLot.asset.name}` : "Add SELL"}</h3><form onSubmit={submitTrade} className="mt-4 grid gap-3 md:grid-cols-6"><select className={select} value={trade.type} onChange={e=>setTrade(x=>({...x,type:e.target.value as "BUY"|"SELL",sourceLotId:""}))}><option>BUY</option><option>SELL</option></select><div className="md:col-span-1"><input required list="investment-asset-options" className={input} placeholder="Asset / Stock (type to search)" value={trade.assetQuery} onChange={e=>selectAsset(e.target.value)} onBlur={()=>{if(trade.assetQuery && !trade.assetId) setMessage("Pilih saham dari daftar yang tersedia.");}}/><datalist id="investment-asset-options">{pickerAssets.map(a=><option key={a.id} value={assetLabel(a)}>{transactionAssets.some(x=>x.id===a.id)?"Previously used in this account":"Asset master"}</option>)}</datalist>{transactionAssets.length>0&&<p className="mt-1 text-[10px] text-slate-600">Saham yang pernah ditransaksikan di akun ini muncul paling atas saat diketik.</p>}</div><input required min="0.000001" step="any" type="number" className={input} placeholder={selectedAsset?.assetType === "STOCK" ? "Lot" : "Quantity"} value={trade.quantity} onChange={e=>setTrade(x=>({...x,quantity:e.target.value}))}/><input required min="0.000001" step="any" type="number" className={input} placeholder="Price" value={trade.unitPrice} onChange={e=>setTrade(x=>({...x,unitPrice:e.target.value}))}/><input required type="date" className={input} value={trade.date} onChange={e=>setTrade(x=>({...x,date:e.target.value}))}/><button disabled={busy || !selectedAsset} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-[#07110b] disabled:opacity-40">{busy?"Saving…":`Save ${trade.type}`}</button><div className="md:col-span-6 grid gap-3 md:grid-cols-3"><input type="number" min="0" step="any" className={input} placeholder="Fee (optional)" value={trade.fee} onChange={e=>setTrade(x=>({...x,fee:e.target.value}))}/><input type="number" min="0" step="any" className={input} placeholder="Tax (optional)" value={trade.tax} onChange={e=>setTrade(x=>({...x, tax:e.target.value}))}/><input type="number" min="0" step="any" className={input} placeholder="Other charges" value={trade.other} onChange={e=>setTrade(x=>({...x,other:e.target.value}))}/></div></form></section>
    </> : <div className={card}><p className="text-sm text-slate-500">Pilih account dari Overview untuk membuka transaction ledger.</p></div>}</section>}

    {screen === "cash" && <section className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]"><form className={card} onSubmit={(e)=>{e.preventDefault(); if(cashForm.cashAccountId) run({action:"cash.setBalance",cashAccountId:cashForm.cashAccountId,balance:Number(cashForm.balance),date:new Date(cashForm.date).toISOString()},"RDN balance updated.");}}><h2 className="text-lg font-semibold text-white">RDN Cash</h2><p className="mt-1 text-xs text-slate-500">Update saldo aktual RDN tanpa memasukkan ulang seluruh mutasi.</p><div className="mt-4 space-y-3"><select required className={select} value={cashForm.cashAccountId} onChange={e=>setCashForm(x=>({...x,cashAccountId:e.target.value}))}><option value="">Select RDN</option>{cashAccounts.map(c=><option key={c.id} value={c.id}>{c.account.provider.name} · {c.account.currency.code} · {money(c.balance,c.account.currency.code)}</option>)}</select><input required type="number" min="0" step="0.01" className={input} placeholder="Actual balance" value={cashForm.balance} onChange={e=>setCashForm(x=>({...x,balance:e.target.value}))}/><input required type="date" className={input} value={cashForm.date} onChange={e=>setCashForm(x=>({...x,date:e.target.value}))}/><button disabled={busy} className="rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#07110b]">Set actual balance</button></div></form><section className={card}><h2 className="font-semibold text-white">Balances</h2><div className="mt-4 space-y-2">{cashAccounts.map(c=><button key={c.id} onClick={()=>setCashForm(x=>({...x,cashAccountId:c.id,balance:String(c.balance)}))} className="flex w-full items-center justify-between rounded-xl border border-white/5 px-3 py-3 text-left"><span><p className="text-xs font-semibold text-white">{c.account.provider.name}</p><p className="text-[10px] text-slate-600">{rdn(c.account).rdnBankName ? `RDN ${rdn(c.account).rdnBankName}` : "Investment cash"}</p></span><strong className="text-sm text-emerald-300">{money(c.balance,c.account.currency.code)}</strong></button>)}</div></section></section>}

    {screen === "accounts" && <section className="grid gap-5 lg:grid-cols-[1fr_.9fr]"><form className={card} onSubmit={(e)=>{e.preventDefault(); if(accountForm.providerName&&accountForm.currencyId) run({action:"account.create",...accountForm},"Account created.");}}><h2 className="text-lg font-semibold text-white">Investment Account</h2><p className="mt-1 text-xs text-slate-500">Satu form sederhana untuk broker, website, RDN dan currency.</p><div className="mt-5 space-y-3"><input required className={input} placeholder="Provider e.g. IndoPremier" value={accountForm.providerName} onChange={e=>setAccountForm(x=>({...x,providerName:e.target.value}))}/><input type="url" className={input} placeholder="Website (optional)" value={accountForm.websiteUrl} onChange={e=>setAccountForm(x=>({...x,websiteUrl:e.target.value}))}/><div className="grid gap-3 md:grid-cols-2"><input className={input} placeholder="RDN bank" value={accountForm.rdnBankName} onChange={e=>setAccountForm(x=>({...x,rdnBankName:e.target.value}))}/><input className={input} placeholder="No. rekening / VA" value={accountForm.rdnAccountNumber} onChange={e=>setAccountForm(x=>({...x,rdnAccountNumber:e.target.value}))}/></div><select required className={select} value={accountForm.currencyId} onChange={e=>setAccountForm(x=>({...x,currencyId:e.target.value}))}><option value="">Currency</option>{currencies.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select><button disabled={busy} className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#07110b]">Save account</button></div></form><section className={card}><h2 className="font-semibold text-white">Current Accounts</h2><div className="mt-4 space-y-2">{accounts.map(a=><button key={a.id} onClick={()=>chooseAccount(a.id)} className="w-full rounded-xl border border-white/5 px-4 py-3 text-left hover:bg-white/[.03]"><p className="text-sm font-semibold text-white">{a.provider.name}</p><p className="mt-1 text-[10px] text-slate-600">{rdn(a).rdnBankName ? `RDN ${rdn(a).rdnBankName}` : "No RDN details"} · {a.currency.code}</p></button>)}</div></section></section>}

    {screen === "accounts" && <section className={`${card} mt-5`}><h2 className="font-semibold text-white">Asset master</h2><form className="mt-4 grid gap-3 md:grid-cols-5" onSubmit={(e)=>{e.preventDefault(); run({action:"asset.create",...assetForm},"Asset created."); setAssetForm(x=>({...x,symbol:"",name:""}));}}><input required className={input} placeholder="Symbol e.g. BBCA" value={assetForm.symbol} onChange={e=>setAssetForm(x=>({...x,symbol:e.target.value.toUpperCase()}))}/><input required className={`${input} md:col-span-2`} placeholder="Asset name" value={assetForm.name} onChange={e=>setAssetForm(x=>({...x,name:e.target.value}))}/><select className={select} value={assetForm.assetType} onChange={e=>setAssetForm(x=>({...x,assetType:e.target.value}))}><option>STOCK</option><option>MUTUAL_FUND</option><option>ETF</option><option>BOND</option><option>GOLD</option><option>OTHER</option></select><select required className={select} value={assetForm.currencyId} onChange={e=>setAssetForm(x=>({...x,currencyId:e.target.value}))}><option value="">Currency</option>{currencies.map(c=><option key={c.id} value={c.id}>{c.code}</option>)}</select><input className={input} placeholder="Unit e.g. share" value={assetForm.unitName} onChange={e=>setAssetForm(x=>({...x,unitName:e.target.value}))}/><button disabled={busy} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-[#07110b]">Add asset</button></form></section>}
  </div>;
}
