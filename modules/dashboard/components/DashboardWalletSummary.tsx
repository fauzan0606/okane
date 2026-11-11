"use client";

import { useEffect, useState } from "react";
import { CreditCard, Landmark, MoreHorizontal } from "lucide-react";
import type { DashboardWallet } from "../types";

const HIDE_CREDIT_CARDS_KEY = "okane.dashboard.hide-credit-cards-in-wallets.v1";

function formatCurrency(value: number, currencyCode: string) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: currencyCode, maximumFractionDigits: currencyCode === "IDR" || currencyCode === "JPY" || currencyCode === "KRW" ? 0 : 2 }).format(value);
}

export default function DashboardWalletSummary({ wallets }: { wallets: DashboardWallet[] }) {
  const [hideCreditCards, setHideCreditCards] = useState(true);

  useEffect(() => {
    const preference = window.localStorage.getItem(HIDE_CREDIT_CARDS_KEY);
    if (preference !== null) setHideCreditCards(preference === "true");
  }, []);

  const hasCreditCards = wallets.some((wallet) => wallet.walletType === "CREDIT_CARD");
  const visibleWallets = wallets.filter((wallet) => !hideCreditCards || wallet.walletType !== "CREDIT_CARD").slice(0, 6);

  function toggleCreditCards() {
    const nextValue = !hideCreditCards;
    setHideCreditCards(nextValue);
    window.localStorage.setItem(HIDE_CREDIT_CARDS_KEY, String(nextValue));
  }

  return (
    <section className="rounded-[20px] border border-white/10 bg-[#0d151e] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Accounts</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">Your Wallets</h2>
        </div>
        <div className="flex items-center gap-3">
          <a href="/wallet" className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300">See all →</a>
          {hasCreditCards && (
            <details className="relative">
              <summary aria-label="Pengaturan tampilan wallet" className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/5 hover:text-white [&::-webkit-details-marker]:hidden">
                <MoreHorizontal size={18} />
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-white/10 bg-[#111923] p-2 shadow-2xl">
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-200 hover:bg-white/5">
                  <input type="checkbox" checked={hideCreditCards} onChange={toggleCreditCards} className="accent-emerald-500" />
                  Sembunyikan kartu kredit
                </label>
              </div>
            </details>
          )}
        </div>
      </div>
      <div className="mt-4 divide-y divide-white/5">
        {visibleWallets.length === 0 ? (
          <p className="py-4 text-xs text-slate-500">No other wallets to show.</p>
        ) : visibleWallets.map((wallet, index) => (
          <a key={wallet.id} href={`/transactions?wallet=${encodeURIComponent(wallet.id)}`} aria-label={`Lihat transaksi ${wallet.name}`} className="flex items-center justify-between gap-4 py-3.5 transition hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            <div className="flex min-w-0 items-center gap-3">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${index % 2 ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"}`}>
                {wallet.walletType === "BANK_ACCOUNT" ? <Landmark size={17} /> : <CreditCard size={17} />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-200">{wallet.name}</p>
                <p className="truncate text-xs capitalize text-slate-500">{wallet.walletType.replaceAll("_", " ").toLowerCase()}</p>
              </div>
            </div>
            <p className="shrink-0 text-sm font-semibold text-slate-200">{formatCurrency(wallet.balance, wallet.currencyCode)} <span className="ml-2 text-slate-600">›</span></p>
          </a>
        ))}
      </div>
    </section>
  );
}
