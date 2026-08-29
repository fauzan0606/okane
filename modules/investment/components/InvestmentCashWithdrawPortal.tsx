"use client";

import { ChevronDown, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Wallet = { id: string; name: string; balance: string | number; currency: { code: string; symbol: string } };
type CashAccount = { id: string; balance: string | number; account: { id: string; name: string; provider: { name: string }; currency: { code: string } } };
type HistoryRow = { id: string; date: string; description: string; debit: string | number; credit: string | number; balance: string | number; movementType: string };

const control = "w-full rounded-xl border border-white/10 bg-[#080f17] px-3.5 py-3 text-sm text-white outline-none transition focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10";
const money = (value: string | number, code: string) => {
  const symbols: Record<string, string> = { IDR: "Rp", USD: "US$", SGD: "S$", MYR: "RM", JPY: "¥", EUR: "€", GBP: "£" };
  return `${symbols[code] ?? code}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
};
const typeLabel = (type: string) => ({ DEPOSIT: "Transfer masuk", WITHDRAWAL: "Transfer ke Wallet", BUY_SETTLEMENT: "Pembelian", SELL_SETTLEMENT: "Penjualan", ADJUSTMENT: "Penyesuaian" } as Record<string, string>)[type] ?? type;

export default function InvestmentCashWithdrawPortal() {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [cashAccountId, setCashAccountId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyAccountId, setHistoryAccountId] = useState("");
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const locate = () => {
      const target = Array.from(document.querySelectorAll<HTMLElement>("section")).find((section) => section.querySelector("h2")?.textContent?.trim() === "RDN Cash");
      if (!target) return;

      let grid: HTMLElement | null = target.parentElement;
      while (grid && grid !== document.body && !(typeof grid.className === "string" && /(^|\s)grid(\s|$)/.test(grid.className))) grid = grid.parentElement;
      if (!grid) return;

      // Keep RDN Cash + Balances as the original two-column row.
      grid.style.display = "grid";
      grid.style.gap = "1.25rem";
      const twoColumn = window.matchMedia("(min-width: 1024px)").matches;
      grid.style.gridTemplateColumns = twoColumn ? "minmax(0, 1.1fr) minmax(0, 0.9fr)" : "minmax(0, 1fr)";

      const parent = grid.parentElement;
      if (!parent) return;

      let mount = parent.querySelector<HTMLElement>("[data-rdn-withdraw-mount]");
      if (!mount) {
        mount = document.createElement("div");
        mount.dataset.rdnWithdrawMount = "1";
        parent.insertBefore(mount, grid.nextSibling);
      } else if (mount.parentElement !== parent) {
        parent.insertBefore(mount, grid.nextSibling);
      }
      setHost(mount);

      const cashTab = Array.from(document.querySelectorAll("button")).find((button) => button.textContent?.trim() === "Cash");
      if (cashTab) cashTab.textContent = "RDN";

      const balancesHeading = Array.from(grid.querySelectorAll("h2")).find((h) => h.textContent?.trim() === "Balances");
      const balancesSection = balancesHeading?.closest("section");
      if (balancesSection) {
        Array.from(balancesSection.querySelectorAll<HTMLButtonElement>("button")).forEach((button) => {
          const text = button.textContent?.trim().toLowerCase() ?? "";
          const account = cashAccounts.find((c) => text.includes(c.account.provider.name.toLowerCase()));
          if (account) button.dataset.rdnHistoryAccountId = account.id;
          button.classList.add("cursor-pointer", "transition", "hover:border-emerald-400/30", "hover:bg-white/[.03]");
        });
      }
    };

    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    const resize = () => locate();
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); };
  }, [cashAccounts]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-rdn-history-account-id]") : null;
      const id = button?.dataset.rdnHistoryAccountId;
      if (!id) return;
      setHistoryAccountId(id);
      setHistoryOpen(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!host) return;
    fetch("/api/investments/cash-transfer", { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Unable to load RDN data."); return j; })
      .then((j) => {
        setWallets(j.wallets ?? []);
        setCashAccounts(j.cashAccounts ?? []);
        if (j.cashAccounts?.[0]) {
          setCashAccountId((current) => current || j.cashAccounts[0].id);
          setHistoryAccountId((current) => current || j.cashAccounts[0].id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load RDN data."));
  }, [host]);

  useEffect(() => {
    if (!historyOpen || !historyAccountId) return;
    setHistoryLoading(true); setError("");
    fetch(`/api/investments/cash-transfer?cashAccountId=${encodeURIComponent(historyAccountId)}`, { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Unable to load RDN history."); return j; })
      .then((j) => setHistoryRows(j.rows ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load RDN history."))
      .finally(() => setHistoryLoading(false));
  }, [historyOpen, historyAccountId]);

  const source = cashAccounts.find((c) => c.id === cashAccountId);
  const compatibleWallets = useMemo(() => source ? wallets.filter((w) => w.currency.code === source.account.currency.code) : wallets, [source, wallets]);
  const target = compatibleWallets.find((w) => w.id === walletId);
  const value = Number(amount || 0);
  const valid = !!source && !!target && value > 0 && Number.isFinite(value) && value <= Number(source.balance) && source.account.currency.code === target.currency.code;
  const historyCash = cashAccounts.find((c) => c.id === historyAccountId);

  useEffect(() => {
    if (source && (!target || target.currency.code !== source.account.currency.code)) setWalletId(compatibleWallets[0]?.id || "");
  }, [source, target, compatibleWallets]);

  async function refresh() {
    const r = await fetch("/api/investments/cash-transfer", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || "Unable to refresh RDN data.");
    setWallets(j.wallets ?? []); setCashAccounts(j.cashAccounts ?? []);
  }

  async function refreshHistory(id: string) {
    const r = await fetch(`/api/investments/cash-transfer?cashAccountId=${encodeURIComponent(id)}`, { cache: "no-store" });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || "Unable to refresh RDN history.");
    setHistoryRows(j.rows ?? []);
  }

  async function submit() {
    if (!valid || !source || !target) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/investments/cash-transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction: "WITHDRAW", walletId: target.id, cashAccountId: source.id, amount: value, date: new Date(`${date}T12:00:00`).toISOString() }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "RDN withdrawal failed.");
      setMessage(`${money(value, source.account.currency.code)} dipindahkan ke ${target.name}.`);
      setAmount("");
      setHistoryAccountId(source.id); setHistoryOpen(true);
      await Promise.all([refresh(), refreshHistory(source.id)]);
    } catch (e) { setError(e instanceof Error ? e.message : "RDN withdrawal failed."); }
    finally { setBusy(false); }
  }

  if (!host) return null;
  return createPortal(
    <div className="mt-5 w-full space-y-5 border-t border-white/5 pt-5">
      <section className="w-full rounded-2xl border border-white/10 bg-[#080f17] p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-400">RDN → Wallet</p><h3 className="mt-1 text-base font-semibold text-white">Tarik dana dari RDN</h3><p className="mt-1 text-xs text-slate-500">Kembalikan dana dari RDN ke salah satu Wallet OKANE.</p></div>
          {source && <div className="rounded-xl border border-white/10 px-4 py-3 text-right"><p className="text-[10px] uppercase tracking-wider text-slate-500">Saldo tersedia</p><p className="mt-1 font-semibold text-emerald-300">{money(source.balance,source.account.currency.code)}</p></div>}
        </div>
        {message && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[.04] px-3 py-2 text-xs text-emerald-300">{message}</div>}
        {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[.04] px-3 py-2 text-xs text-red-300">{error}</div>}
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_.8fr_180px_auto]">
          <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">RDN source</label><select className={control} value={cashAccountId} onChange={(e)=>setCashAccountId(e.target.value)}><option value="">Select RDN</option>{cashAccounts.map(c=><option key={c.id} value={c.id}>{c.account.provider.name} · {c.account.name} · {money(c.balance,c.account.currency.code)}</option>)}</select></div>
          <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Wallet destination</label><div className="relative"><WalletCards size={15} className="pointer-events-none absolute left-3 top-3.5 text-slate-500"/><select className={`${control} pl-9`} value={walletId} onChange={(e)=>setWalletId(e.target.value)}><option value="">Select wallet</option>{compatibleWallets.map(w=><option key={w.id} value={w.id}>{w.name} · {w.currency.code} · {money(w.balance,w.currency.code)}</option>)}</select></div></div>
          <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Amount</label><input type="number" min="0.01" step="0.01" max={source ? String(source.balance) : undefined} className={control} placeholder="0" value={amount} onChange={(e)=>setAmount(e.target.value)}/></div>
          <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date</label><input type="date" className={control} value={date} onChange={(e)=>setDate(e.target.value)}/></div>
          <button type="button" disabled={busy || !valid} onClick={submit} className="self-end rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#07110b] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Processing…" : "Withdraw"}</button>
        </div>
      </section>

      <section className="w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0d151e]">
        <button type="button" onClick={()=>setHistoryOpen(v=>!v)} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/[.02]"><div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">RDN history</p><h3 className="mt-1 text-base font-semibold text-white">Riwayat Transaksi RDN</h3><p className="mt-1 text-xs text-slate-600">Klik box pada Balances untuk membuka riwayat RDN tersebut.</p></div><ChevronDown size={18} className={`text-slate-500 transition ${historyOpen ? "rotate-180" : ""}`}/></button>
        {historyOpen && <div className="border-t border-white/5">{historyCash && <div className="border-b border-white/5 px-5 py-4"><p className="text-sm font-semibold text-white">{historyCash.account.provider.name} · {historyCash.account.name}</p><p className="mt-1 text-xs text-slate-600">Saldo {money(historyCash.balance,historyCash.account.currency.code)}</p></div>}{historyLoading?<div className="p-8 text-center text-xs text-slate-600">Loading RDN history…</div>:historyRows.length===0?<div className="p-8 text-center text-xs text-slate-600">Belum ada transaksi pada RDN ini.</div>:<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-5 py-3">Date</th><th>Type</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="px-5 text-right">Balance</th></tr></thead><tbody className="divide-y divide-white/5">{historyRows.map(row=><tr key={row.id}><td className="px-5 py-3 text-slate-400">{new Date(row.date).toLocaleDateString("id-ID")}</td><td><span className="rounded-full border border-white/10 px-2 py-1 text-[9px] uppercase text-slate-400">{typeLabel(row.movementType)}</span></td><td className="text-slate-300">{row.description}</td><td className="text-right text-red-300">{Number(row.debit)?money(row.debit,historyCash?.account.currency.code??"IDR"):"—"}</td><td className="text-right text-emerald-300">{Number(row.credit)?money(row.credit,historyCash?.account.currency.code??"IDR"):"—"}</td><td className="px-5 text-right font-semibold text-white">{money(row.balance,historyCash?.account.currency.code??"IDR")}</td></tr>)}</tbody></table></div>}</div>}
      </section>
    </div>, host
  );
}
