"use client";

import { useEffect, useMemo, useState } from "react";
import type { Currency } from "@prisma/client";

import type { WalletClientData, WalletHistoryEntry } from "../repository";
import { formatWalletType } from "../constants";
import WalletCard from "./WalletCard";
import WalletCardActions from "./WalletCardActions";
import WalletHistory from "./WalletHistory";
import { CrudEmptyState } from "@/components/crud";

type WalletListProps = {
  wallets: WalletClientData[];
  currencies: Currency[];
  histories: Record<string, WalletHistoryEntry[]>;
};

export default function WalletList({ wallets, currencies, histories }: WalletListProps) {
  const [walletView, setWalletView] = useState<"cards" | "table">("cards");

  useEffect(() => {
    const saved = window.localStorage.getItem("okane.walletView");
    if (saved === "cards" || saved === "table") setWalletView(saved);
  }, []);

  const sortedWallets = useMemo(
    () => [...wallets].sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" })),
    [wallets],
  );

  const [selectedWalletId, setSelectedWalletId] = useState(sortedWallets[0]?.id ?? "");

  useEffect(() => {
    if (!sortedWallets.some((wallet) => wallet.id === selectedWalletId)) {
      setSelectedWalletId(sortedWallets[0]?.id ?? "");
    }
  }, [sortedWallets, selectedWalletId]);

  if (sortedWallets.length === 0) {
    return <CrudEmptyState title="No wallet yet" description="Start by creating your first wallet." />;
  }

  const selectedWallet = sortedWallets.find((wallet) => wallet.id === selectedWalletId) ?? sortedWallets[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Wallets</h2>
          <p className="text-xs text-slate-600">{sortedWallets.length} wallets · sorted A–Z</p>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-white/[.02] p-1">
          <button
            type="button"
            onClick={() => {
              setWalletView("cards");
              window.localStorage.setItem("okane.walletView", "cards");
            }}
            className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${walletView === "cards" ? "bg-white/[.08] text-white" : "text-slate-500"}`}
          >
            ▦ Cards
          </button>
          <button
            type="button"
            onClick={() => {
              setWalletView("table");
              window.localStorage.setItem("okane.walletView", "table");
            }}
            className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${walletView === "table" ? "bg-white/[.08] text-white" : "text-slate-500"}`}
          >
            ☷ Table
          </button>
        </div>
      </div>

      {walletView === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedWallets.map((wallet) => (
            <WalletCard
              key={wallet.id}
              wallet={wallet}
              currencies={currencies}
              selected={wallet.id === selectedWallet.id}
              onSelect={() => setSelectedWalletId(wallet.id)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600">
              <tr>
                <th className="px-4 py-3">Wallet</th>
                <th>Type</th>
                <th>Currency</th>
                <th>Balance</th>
                <th>Bank</th>
                <th className="text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedWallets.map((wallet) => {
                const isCreditCard = wallet.walletType === "CREDIT_CARD" && Boolean(wallet.creditCard);
                const balance = isCreditCard ? Math.max(-Number(wallet.currentBalance), 0) : Number(wallet.currentBalance);
                const formatter = new Intl.NumberFormat("id-ID", {
                  minimumFractionDigits: wallet.currency.decimalPlaces,
                  maximumFractionDigits: wallet.currency.decimalPlaces,
                });

                return (
                  <tr
                    key={wallet.id}
                    onClick={() => setSelectedWalletId(wallet.id)}
                    className={`cursor-pointer transition ${wallet.id === selectedWallet.id ? "bg-emerald-400/[.04]" : "hover:bg-white/[.02]"}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-white">{wallet.name}</p>
                      {wallet.bank && <p className="mt-0.5 text-[10px] text-slate-600">{wallet.bank}</p>}
                    </td>
                    <td className="text-slate-400">{formatWalletType(wallet.walletType)}</td>
                    <td className="text-slate-400">{wallet.currency.name} ({wallet.currency.code})</td>
                    <td className="font-semibold text-white">
                      {wallet.currency.symbol}{formatter.format(balance)}
                      {isCreditCard && <span className="ml-1 text-[10px] font-normal text-slate-600">Outstanding</span>}
                    </td>
                    <td className="text-slate-400">{wallet.bank || "—"}</td>
                    <td className="px-4 text-right" onClick={(event) => event.stopPropagation()}>
                      <WalletCardActions wallet={wallet} currencies={currencies} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <WalletHistory
        entries={histories[selectedWallet.id] ?? []}
        symbol={selectedWallet.currency.symbol}
        decimalPlaces={selectedWallet.currency.decimalPlaces}
        walletName={selectedWallet.name}
        walletType={selectedWallet.walletType}
      />
    </div>
  );
}
