"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

type Wallet = { id: string; name: string; balance: string | number; currency: { code: string; symbol: string } };
type CashAccount = { id: string; balance: string | number; account: { id: string; name: string; provider: { name: string }; currency: { code: string } } };

function money(value: string | number, code: string) {
  const symbols: Record<string, string> = { IDR: "Rp", USD: "US$", SGD: "S$", MYR: "RM", JPY: "¥", EUR: "€", GBP: "£" };
  return `${symbols[code] ?? code}${new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0)}`;
}

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

  useEffect(() => {
    const locate = () => {
      const target = Array.from(document.querySelectorAll<HTMLElement>("section")).find((section) =>
        section.querySelector("h2")?.textContent?.trim() === "RDN Cash"
      );
      if (!target) return;
      let mount = target.querySelector<HTMLElement>("[data-rdn-withdraw-mount]");
      if (!mount) {
        mount = document.createElement("div");
        mount.dataset.rdnWithdrawMount = "1";
        target.appendChild(mount);
      }
      setHost(mount);
    };
    locate();
    const observer = new MutationObserver(locate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!host) return;
    fetch("/api/investments/cash-transfer", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || "Unable to load RDN withdrawal data.");
        return j;
      })
      .then((j) => {
        setWallets(j.wallets ?? []);
        setCashAccounts(j.cashAccounts ?? []);
        if (j.cashAccounts?.[0]) setCashAccountId(j.cashAccounts[0].id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load RDN withdrawal data."));
  }, [host]);

  const source = cashAccounts.find((c) => c.id === cashAccountId);
  const compatibleWallets = useMemo(() => source ? wallets.filter((w) => w.currency.code === source.account.currency.code) : wallets, [source, wallets]);
  const target = wallets.find((w) => w.id === walletId);
  const value = Number(amount || 0);
  const valid = !!source && !!target && value > 0 && Number.isFinite(value) && source.account.currency.code === target.currency.code && value <= Number(source.balance);

  async function submit() {
    if (!valid || !source || !target) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const r = await fetch("/api/investments/cash-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: "WITHDRAW", walletId: target.id, cashAccountId: source.id, amount: value, date: new Date(date).toISOString() }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || "RDN withdrawal failed.");
      setMessage(`Withdrawal berhasil: ${money(value, source.account.currency.code)} ke ${target.name}.`);
      setAmount("");
      const refreshed = await fetch("/api/investments/cash-transfer", { cache: "no-store" }).then((x) => x.json());
      setWallets(refreshed.wallets ?? []);
      setCashAccounts(refreshed.cashAccounts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "RDN withdrawal failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!host) return null;
  return createPortal(
    <div className="mt-5 border-t border-white/5 pt-5" data-rdn-withdraw-panel>
      <div>
        <h3 className="text-sm font-semibold text-white">Withdraw to Wallet</h3>
        <p className="mt-1 text-xs text-slate-500">Tarik dana dari RDN kembali ke Wallet OKANE.</p>
      </div>
      {error && <div className="mt-3 rounded-xl border border-red-400/20 bg-red-400/[.05] px-3 py-2 text-xs text-red-300">{error}</div>}
      {message && <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] px-3 py-2 text-xs text-emerald-300">{message}</div>}
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_.8fr_.7fr_auto]">
        <select className="w-full rounded-xl border border-white/10 bg-[#080f17] px-3 py-2.5 text-sm text-white" value={cashAccountId} onChange={(e) => { setCashAccountId(e.target.value); setWalletId(""); }}>
          <option value="">Source RDN</option>
          {cashAccounts.map((c) => <option key={c.id} value={c.id}>{c.account.provider.name} · {c.account.name} · {money(c.balance,c.account.currency.code)}</option>)}
        </select>
        <select className="w-full rounded-xl border border-white/10 bg-[#080f17] px-3 py-2.5 text-sm text-white" value={walletId} onChange={(e) => setWalletId(e.target.value)}>
          <option value="">Destination wallet</option>
          {compatibleWallets.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.currency.code} · {money(w.balance,w.currency.code)}</option>)}
        </select>
        <input type="number" min="0.01" step="0.01" className="w-full rounded-xl border border-white/10 bg-[#080f17] px-3 py-2.5 text-sm text-white" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <input type="date" className="w-full rounded-xl border border-white/10 bg-[#080f17] px-3 py-2.5 text-sm text-white" value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" disabled={busy || !valid} onClick={submit} className="rounded-xl border border-red-400/20 px-4 py-2.5 text-sm font-bold text-red-300 hover:bg-red-400/[.05] disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Withdrawing…" : "Withdraw"}</button>
      </div>
      {source && <p className="mt-2 text-[11px] text-slate-500">Available RDN balance: <span className="font-semibold text-slate-300">{money(source.balance, source.account.currency.code)}</span>.</p>}
    </div>,
    host
  );
}
