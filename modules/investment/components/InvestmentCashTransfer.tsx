"use client";

import { useEffect, useState } from "react";

type Wallet = { id: string; name: string; balance: string | number; currency: { code: string } };
type CashAccount = { id: string; balance: string | number; account: { name: string; provider: { name: string }; currency: { code: string } } };

function money(value: string | number, code: string) {
  const symbols: Record<string, string> = { IDR: "Rp", USD: "US$", SGD: "S$", MYR: "RM", JPY: "¥", EUR: "€", GBP: "£" };
  return `${symbols[code] ?? code}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

export default function InvestmentCashTransfer() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
  const [walletId, setWalletId] = useState("");
  const [cashAccountId, setCashAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/investments/cash-transfer", { cache: "no-store" })
      .then(async (r) => { const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || "Unable to load cash transfer data."); return j; })
      .then((j) => { setWallets(j.wallets ?? []); setCashAccounts(j.cashAccounts ?? []); if (j.wallets?.[0]) setWalletId(j.wallets[0].id); if (j.cashAccounts?.[0]) setCashAccountId(j.cashAccounts[0].id); })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load cash transfer data."));
  }, []);

  const sourceWallet = wallets.find((w) => w.id === walletId);
  const target = cashAccounts.find((c) => c.id === cashAccountId);
  const compatibleCash = sourceWallet ? cashAccounts.filter((c) => c.account.currency.code === sourceWallet.currency.code) : cashAccounts;
  const value = Number(amount || 0);
  const valid = sourceWallet && target && value > 0 && Number.isFinite(value) && sourceWallet.currency.code === target.account.currency.code && value <= Number(sourceWallet.balance);

  async function submit() {
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/investments/cash-transfer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletId, cashAccountId, amount: value, date: new Date(date).toISOString() }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "Transfer failed.");
      setMessage(`Transfer berhasil: ${money(value, sourceWallet!.currency.code)} dari ${sourceWallet!.name} ke ${target!.account.provider.name}.`);
      setAmount("");
      const refreshed = await fetch("/api/investments/cash-transfer", { cache: "no-store" }).then((x) => x.json());
      setWallets(refreshed.wallets ?? []); setCashAccounts(refreshed.cashAccounts ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "Transfer failed."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-2xl border border-white/10 bg-[#0d151e] p-5">
    <div><h2 className="text-lg font-semibold text-white">Transfer from Wallet</h2><p className="mt-1 text-xs text-slate-500">Pindahkan dana dari Wallet OKANE ke RDN. Set actual balance tetap tersedia di bawah panel ini.</p></div>
    {error && <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/[.05] px-3 py-2 text-xs text-red-300">{error}</div>}
    {message && <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] px-3 py-2 text-xs text-emerald-300">{message}</div>}
    <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_.8fr_.7fr_auto]">
      <select className="w-full rounded-xl border border-white/10 bg-[#080f17] px-3 py-2.5 text-sm text-white" value={walletId} onChange={(e) => { setWalletId(e.target.value); const w = wallets.find((x) => x.id === e.target.value); const next = cashAccounts.find((c) => c.account.currency.code === w?.currency.code); if (next) setCashAccountId(next.id); }}><option value="">Source wallet</option>{wallets.map((w) => <option key={w.id} value={w.id}>{w.name} · {money(w.balance,w.currency.code)}</option>)}</select>
      <select className="w-full rounded-xl border border-white/10 bg-[#080f17] px-3 py-2.5 text-sm text-white" value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}><option value="">Target RDN</option>{compatibleCash.map((c) => <option key={c.id} value={c.id}>{c.account.provider.name} · {c.account.name} · {money(c.balance,c.account.currency.code)}</option>)}</select>
      <input type="number" min="0.01" step="0.01" className="w-full rounded-xl border border-white/10 bg-[#080f17] px-3 py-2.5 text-sm text-white" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <input type="date" className="w-full rounded-xl border border-white/10 bg-[#080f17] px-3 py-2.5 text-sm text-white" value={date} onChange={(e) => setDate(e.target.value)} />
      <button type="button" disabled={busy || !valid} onClick={submit} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-bold text-[#07110b] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Transferring…" : "Transfer"}</button>
    </div>
  </section>;
}
