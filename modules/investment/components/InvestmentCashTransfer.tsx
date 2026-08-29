"use client";

import { ArrowDownLeft, ArrowRightLeft, Building2, ChevronDown, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Wallet = { id: string; name: string; balance: string | number; currency: { code: string; symbol: string } };
type CashAccount = { id: string; balance: string | number; account: { id: string; name: string; provider: { name: string }; currency: { code: string } } };
type RdnRow = { id: string; date: string; description: string; debit: string | number; credit: string | number; balance: string | number; movementType: string; transactionId: string | null };

const control = "w-full rounded-xl border border-white/10 bg-[#080f17] px-3.5 py-3 text-sm text-white outline-none transition focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10";

function money(value: string | number, code: string) {
  const symbols: Record<string, string> = { IDR: "Rp", USD: "US$", SGD: "S$", MYR: "RM", JPY: "¥", EUR: "€", GBP: "£" };
  return `${symbols[code] ?? code}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

function movementLabel(type: string) {
  return ({ DEPOSIT: "Transfer masuk", WITHDRAWAL: "Transfer ke Wallet", BUY_SETTLEMENT: "Pembelian", SELL_SETTLEMENT: "Penjualan", ADJUSTMENT: "Penyesuaian saldo" } as Record<string, string>)[type] ?? type;
}

export default function InvestmentCashTransfer() {
  const [visible, setVisible] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [cashAccountId, setCashAccountId] = useState("");
  const [walletId, setWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<RdnRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState("");

  const load = async () => {
    const r = await fetch("/api/investments/cash-transfer", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || "Unable to load RDN data.");
    setWallets(j.wallets ?? []);
    setCashAccounts(j.cashAccounts ?? []);
    setCashAccountId((current) => current || j.cashAccounts?.[0]?.id || "");
    setWalletId((current) => current || j.wallets?.[0]?.id || "");
  };

  const loadHistory = async (id: string) => {
    if (!id) return;
    setHistoryLoading(true);
    try {
      const r = await fetch(`/api/investments/cash-transfer?cashAccountId=${encodeURIComponent(id)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Unable to load RDN history.");
      setHistory(j.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load RDN history.");
    } finally { setHistoryLoading(false); }
  };

  useEffect(() => {
    const sync = () => {
      const active = Array.from(document.querySelectorAll("h2")).some((h) => h.textContent?.trim() === "RDN Cash");
      setVisible(active);
      const navButtons = Array.from(document.querySelectorAll("button"));
      const cashTab = navButtons.find((button) => button.textContent?.trim() === "Cash");
      if (cashTab) cashTab.textContent = "RDN";

      const balanceHeading = Array.from(document.querySelectorAll("h2")).find((h) => h.textContent?.trim() === "Balances");
      const balanceSection = balanceHeading?.closest("section");
      if (!balanceSection) return;
      const buttons = Array.from(balanceSection.querySelectorAll<HTMLButtonElement>("button"));
      buttons.forEach((button, index) => {
        button.dataset.rdnBalanceIndex = String(index);
        button.classList.add("cursor-pointer", "transition", "hover:border-emerald-400/30", "hover:bg-white/[.03]");
      });
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button[data-rdn-balance-index]") : null;
      if (!target) return;
      const index = Number(target.dataset.rdnBalanceIndex ?? "-1");
      if (index >= 0) {
        const id = cashAccounts[index]?.id;
        if (id) { setSelectedHistoryId(id); setHistoryOpen(true); }
      }
    };

    sync();
    document.addEventListener("click", onClick, true);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); document.removeEventListener("click", onClick, true); };
  }, [cashAccounts]);

  useEffect(() => {
    if (!visible) return;
    load().catch((e) => setError(e instanceof Error ? e.message : "Unable to load RDN data."));
  }, [visible]);

  useEffect(() => {
    if (!cashAccountId) return;
    setSelectedHistoryId((current) => current || cashAccountId);
  }, [cashAccountId]);

  useEffect(() => {
    if (historyOpen && selectedHistoryId) void loadHistory(selectedHistoryId);
  }, [historyOpen, selectedHistoryId]);

  const cash = cashAccounts.find((c) => c.id === cashAccountId);
  const selectedHistoryCash = cashAccounts.find((c) => c.id === selectedHistoryId);
  const compatibleWallets = useMemo(() => selectedHistoryCash ? wallets.filter((w) => w.currency.code === selectedHistoryCash.account.currency.code) : wallets, [selectedHistoryCash, wallets]);
  const wallet = compatibleWallets.find((w) => w.id === walletId);
  const value = Number(amount || 0);
  const valid = Boolean(cash && wallet && value > 0 && Number.isFinite(value) && value <= Number(cash.balance) && cash.account.currency.code === wallet.currency.code);

  useEffect(() => {
    if (cash && (!wallet || wallet.currency.code !== cash.account.currency.code)) setWalletId(compatibleWallets[0]?.id || "");
  }, [cashAccountId, cash?.account.currency.code, compatibleWallets, wallet]);

  if (!visible) return null;

  async function submit() {
    if (!valid || !cash || !wallet) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/investments/cash-transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ direction: "WITHDRAW", walletId: wallet.id, cashAccountId: cash.id, amount: value, date: new Date(`${date}T12:00:00`).toISOString() }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Withdrawal failed.");
      setAmount("");
      setMessage(`${money(value, cash.account.currency.code)} dipindahkan ke ${wallet.name}.`);
      await load();
      setSelectedHistoryId(cash.id);
      setHistoryOpen(true);
      await loadHistory(cash.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdrawal failed.");
    } finally { setBusy(false); }
  }

  return <div className="mb-5 space-y-5">
    <section className="rounded-2xl border border-white/10 bg-[#0d151e] p-5 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-300"><ArrowDownLeft size={16} /><span className="text-[10px] font-semibold uppercase tracking-[.18em]">Withdraw</span></div>
          <h2 className="mt-1.5 text-lg font-semibold text-white">Tarik dana dari RDN</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Kembalikan dana dari investment RDN ke Wallet OKANE.</p>
        </div>
        {cash && <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[.04] px-4 py-3 text-right"><p className="text-[10px] uppercase tracking-wider text-slate-500">Saldo tersedia</p><p className="mt-1 text-base font-semibold text-emerald-300">{money(cash.balance, cash.account.currency.code)}</p></div>}
      </div>
      {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[.04] px-3 py-2 text-xs text-red-300">{error}</div>}
      {message && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[.04] px-3 py-2 text-xs text-emerald-300">{message}</div>}
      <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_1fr_180px_auto]">
        <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">RDN source</label><select className={control} value={cashAccountId} onChange={(e) => { setCashAccountId(e.target.value); setHistoryOpen(false); }}><option value="">Select RDN</option>{cashAccounts.map((c) => <option key={c.id} value={c.id}>{c.account.provider.name} · {c.account.name} · {money(c.balance,c.account.currency.code)}</option>)}</select></div>
        <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Wallet destination</label><div className="relative"><WalletCards size={15} className="pointer-events-none absolute left-3 top-3.5 text-slate-500"/><select className={`${control} pl-9`} value={walletId} onChange={(e) => setWalletId(e.target.value)}><option value="">Select wallet</option>{compatibleWallets.map((w) => <option key={w.id} value={w.id}>{w.name} · {money(w.balance,w.currency.code)}</option>)}</select></div></div>
        <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Amount</label><input type="number" min="0.01" step="0.01" max={cash ? String(cash.balance) : undefined} className={control} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date</label><input type="date" className={control} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <button type="button" disabled={busy || !valid} onClick={submit} className="self-end rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#07110b] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Processing…" : "Withdraw"}</button>
      </div>
      <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-600"><Building2 size={13} /><span>{cash ? cash.account.provider.name : "Pilih RDN"}</span>{wallet && <><ArrowRightLeft size={13} /><span>{wallet.name}</span></>}</div>
    </section>

    <section className="rounded-2xl border border-white/10 bg-[#0d151e] overflow-hidden">
      <button type="button" onClick={() => { const next = !historyOpen; setHistoryOpen(next); if (next) setSelectedHistoryId(selectedHistoryId || cashAccountId); }} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/[.02]">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.16em] text-slate-500">RDN history</p><h2 className="mt-1 text-base font-semibold text-white">Riwayat Transaksi RDN</h2><p className="mt-1 text-xs text-slate-600">Klik saldo RDN di atas untuk membuka riwayat akun tersebut.</p></div>
        <ChevronDown size={18} className={`text-slate-500 transition ${historyOpen ? "rotate-180" : ""}`} />
      </button>
      {historyOpen && <div className="border-t border-white/5">
        <div className="flex flex-col gap-3 border-b border-white/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><select className="max-w-md rounded-xl border border-white/10 bg-[#080f17] px-3 py-2.5 text-xs text-white" value={selectedHistoryId} onChange={(e) => setSelectedHistoryId(e.target.value)}>{cashAccounts.map((c) => <option key={c.id} value={c.id}>{c.account.provider.name} · {c.account.name}</option>)}</select>{selectedHistoryCash && <span className="text-xs font-semibold text-emerald-300">Saldo {money(selectedHistoryCash.balance,selectedHistoryCash.account.currency.code)}</span>}</div>
        {historyLoading ? <div className="p-8 text-center text-xs text-slate-600">Loading RDN history…</div> : history.length === 0 ? <div className="p-8 text-center text-xs text-slate-600">Belum ada transaksi pada RDN ini.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600"><tr><th className="px-5 py-3">Date</th><th>Type</th><th>Description</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="px-5 text-right">Balance</th></tr></thead><tbody className="divide-y divide-white/5">{history.map((row) => <tr key={row.id}><td className="px-5 py-3 text-slate-400">{new Date(row.date).toLocaleDateString("id-ID")}</td><td><span className="rounded-full border border-white/10 px-2 py-1 text-[9px] uppercase text-slate-400">{movementLabel(row.movementType)}</span></td><td className="text-slate-300">{row.description}</td><td className="text-right text-red-300">{Number(row.debit) ? money(row.debit, selectedHistoryCash?.account.currency.code ?? "IDR") : "—"}</td><td className="text-right text-emerald-300">{Number(row.credit) ? money(row.credit, selectedHistoryCash?.account.currency.code ?? "IDR") : "—"}</td><td className="px-5 text-right font-semibold text-white">{money(row.balance, selectedHistoryCash?.account.currency.code ?? "IDR")}</td></tr>)}</tbody></table></div>}
      </div>}
    </section>
  </div>;
}
