"use client";

import { ArrowDownLeft, Building2, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Wallet = { id: string; name: string; balance: string | number; currency: { code: string; symbol: string } };
type CashAccount = { id: string; balance: string | number; account: { id: string; name: string; provider: { name: string }; currency: { code: string } } };

const control = "w-full rounded-xl border border-white/10 bg-[#080f17] px-3.5 py-3 text-sm text-white outline-none transition focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-400/10";

function money(value: string | number, code: string) {
  const symbols: Record<string, string> = { IDR: "Rp", USD: "US$", SGD: "S$", MYR: "RM", JPY: "¥", EUR: "€", GBP: "£" };
  return `${symbols[code] ?? code}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
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

  const load = async () => {
    const r = await fetch("/api/investments/cash-transfer", { cache: "no-store" });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error || "Unable to load RDN withdrawal data.");
    setWallets(j.wallets ?? []);
    setCashAccounts(j.cashAccounts ?? []);
    setCashAccountId((current) => current || j.cashAccounts?.[0]?.id || "");
    setWalletId((current) => current || j.wallets?.[0]?.id || "");
  };

  useEffect(() => {
    const sync = () => setVisible(Array.from(document.querySelectorAll("h2")).some((h) => h.textContent?.trim() === "RDN Cash"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    load().catch((e) => setError(e instanceof Error ? e.message : "Unable to load RDN withdrawal data."));
  }, [visible]);

  const cash = cashAccounts.find((c) => c.id === cashAccountId);
  const compatibleWallets = useMemo(() => cash ? wallets.filter((w) => w.currency.code === cash.account.currency.code && w.id) : wallets, [cash, wallets]);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Withdrawal failed.");
    } finally { setBusy(false); }
  }

  return <section className="mb-5 rounded-2xl border border-white/10 bg-[#0d151e] p-5 lg:p-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="flex items-center gap-2 text-emerald-300"><ArrowDownLeft size={16} /><span className="text-[10px] font-semibold uppercase tracking-[.18em]">Withdraw</span></div>
        <h2 className="mt-1.5 text-lg font-semibold text-white">Tarik dana dari RDN</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">Kembalikan dana dari investment cash / RDN ke Wallet OKANE. Transfer masuk dan keluar tetap tercatat sebagai cash movement.</p>
      </div>
      {cash && <div className="rounded-xl border border-emerald-400/10 bg-emerald-400/[.04] px-4 py-3 text-right"><p className="text-[10px] uppercase tracking-wider text-slate-500">Saldo RDN terpilih</p><p className="mt-1 text-base font-semibold text-emerald-300">{money(cash.balance, cash.account.currency.code)}</p></div>}
    </div>

    {error && <div className="mt-4 rounded-xl border border-red-400/20 bg-red-400/[.04] px-3 py-2 text-xs text-red-300">{error}</div>}
    {message && <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[.04] px-3 py-2 text-xs text-emerald-300">{message}</div>}

    <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr_1fr_180px_auto]">
      <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">RDN source</label><select className={control} value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}><option value="">Select RDN</option>{cashAccounts.map((c) => <option key={c.id} value={c.id}>{c.account.provider.name} · {c.account.name} · {money(c.balance,c.account.currency.code)}</option>)}</select></div>
      <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Wallet destination</label><div className="relative"><WalletCards size={15} className="pointer-events-none absolute left-3 top-3.5 text-slate-500"/><select className={`${control} pl-9`} value={walletId} onChange={(e) => setWalletId(e.target.value)}><option value="">Select wallet</option>{compatibleWallets.map((w) => <option key={w.id} value={w.id}>{w.name} · {money(w.balance,w.currency.code)}</option>)}</select></div></div>
      <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Amount</label><input type="number" min="0.01" step="0.01" max={cash ? String(cash.balance) : undefined} className={control} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">Date</label><input type="date" className={control} value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <button type="button" disabled={busy || !valid} onClick={submit} className="self-end rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-[#07110b] transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Processing…" : "Withdraw"}</button>
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-600"><Building2 size={13} /><span>{cash ? `${cash.account.provider.name} · ${cash.account.name}` : "Pilih RDN terlebih dahulu"}</span>{wallet && <><span>→</span><span>{wallet.name}</span></>}</div>
  </section>;
}
