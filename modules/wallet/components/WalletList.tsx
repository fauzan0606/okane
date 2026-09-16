"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  initialHistory: WalletHistoryEntry[];
  initialWalletId: string;
  pageSize?: number;
};

type WalletHistoryResponse = {
  entries: WalletHistoryEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export default function WalletList({ wallets, currencies, initialHistory, initialWalletId, pageSize = 20 }: WalletListProps) {
  const [walletView, setWalletView] = useState<"cards" | "table">("cards");

  useEffect(() => {
    const saved = window.localStorage.getItem("okane.walletView");
    if (saved === "cards" || saved === "table") setWalletView(saved);
  }, []);

  const sortedWallets = useMemo(
    () => [...wallets].sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" })),
    [wallets],
  );

  const [selectedWalletId, setSelectedWalletId] = useState(initialWalletId);
  const [history, setHistory] = useState<WalletHistoryEntry[]>(initialWalletId ? initialHistory.slice(0, pageSize) : []);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(initialWalletId ? initialHistory.length : 0);
  const [historyTotalPages, setHistoryTotalPages] = useState(initialWalletId ? Math.max(Math.ceil(initialHistory.length / pageSize), 1) : 1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const historyRef = useRef<HTMLElement | null>(null);
  const requestIdRef = useRef(0);

  async function loadHistory(walletId: string, page = 1, shouldScroll = true) {
    const requestId = ++requestIdRef.current;
    setHistoryLoading(true);

    try {
      const response = await fetch(`/api/wallet/${encodeURIComponent(walletId)}/history?page=${page}&pageSize=${pageSize}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load wallet history.");
      const payload = (await response.json()) as WalletHistoryResponse;
      if (requestId !== requestIdRef.current) return;
      setHistory(payload.entries);
      setHistoryPage(payload.page);
      setHistoryTotal(payload.total);
      setHistoryTotalPages(payload.totalPages);
      if (shouldScroll) requestAnimationFrame(() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch {
      if (requestId !== requestIdRef.current) return;
      setHistory([]);
      setHistoryPage(1);
      setHistoryTotal(0);
      setHistoryTotalPages(1);
    } finally {
      if (requestId === requestIdRef.current) setHistoryLoading(false);
    }
  }

  function selectWallet(walletId: string) {
    if (walletId === selectedWalletId) {
      requestAnimationFrame(() => historyRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
      return;
    }

    setSelectedWalletId(walletId);
    setHistory([]);
    setHistoryPage(1);
    setHistoryTotal(0);
    setHistoryTotalPages(1);
    void loadHistory(walletId, 1, true);
  }

  async function changeHistoryPage(nextPage: number) {
    if (nextPage < 1 || nextPage > historyTotalPages || historyLoading || !selectedWalletId) return;
    await loadHistory(selectedWalletId, nextPage, true);
  }

  if (sortedWallets.length === 0) {
    return <CrudEmptyState title="No wallet yet" description="Start by creating your first wallet." />;
  }

  const selectedWallet = selectedWalletId ? sortedWallets.find((wallet) => wallet.id === selectedWalletId) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Wallets</h2>
          <p className="text-xs text-slate-600">{sortedWallets.length} wallets · sorted A–Z</p>
        </div>
        <div className="flex rounded-lg border border-white/10 bg-white/[.02] p-1">
          <button type="button" onClick={() => { setWalletView("cards"); window.localStorage.setItem("okane.walletView", "cards"); }} className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${walletView === "cards" ? "bg-white/[.08] text-white" : "text-slate-500"}`}>
            ▦ Cards
          </button>
          <button type="button" onClick={() => { setWalletView("table"); window.localStorage.setItem("okane.walletView", "table"); }} className={`rounded-md px-3 py-1.5 text-[10px] font-bold ${walletView === "table" ? "bg-white/[.08] text-white" : "text-slate-500"}`}>
            ☷ Table
          </button>
        </div>
      </div>

      {walletView === "cards" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedWallets.map((wallet) => (
            <WalletCard key={wallet.id} wallet={wallet} currencies={currencies} selected={wallet.id === selectedWalletId} onSelect={() => selectWallet(wallet.id)} />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-white/5 text-[10px] uppercase tracking-wider text-slate-600">
              <tr><th className="px-4 py-3">Wallet</th><th>Type</th><th>Currency</th><th>Balance</th><th>Bank</th><th className="text-right">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sortedWallets.map((wallet) => {
                const isCreditCard = wallet.walletType === "CREDIT_CARD" && Boolean(wallet.creditCard);
                const balance = isCreditCard ? Math.max(-Number(wallet.currentBalance), 0) : Number(wallet.currentBalance);
                const formatter = new Intl.NumberFormat("id-ID", { minimumFractionDigits: wallet.currency.decimalPlaces, maximumFractionDigits: wallet.currency.decimalPlaces });
                return (
                  <tr key={wallet.id} onClick={() => selectWallet(wallet.id)} className={`cursor-pointer transition ${wallet.id === selectedWalletId ? "bg-emerald-400/[.04]" : "hover:bg-white/[.02]"}`}>
                    <td className="px-4 py-3"><p className="font-semibold text-white">{wallet.name}</p>{wallet.bank && <p className="mt-0.5 text-[10px] text-slate-600">{wallet.bank}</p>}</td>
                    <td className="text-slate-400">{formatWalletType(wallet.walletType)}</td>
                    <td className="text-slate-400">{wallet.currency.name} ({wallet.currency.code})</td>
                    <td className="font-semibold text-white">{wallet.currency.symbol}{formatter.format(balance)}{isCreditCard && <span className="ml-1 text-[10px] font-normal text-slate-600">Outstanding</span>}</td>
                    <td className="text-slate-400">{wallet.bank || "—"}</td>
                    <td className="px-4 text-right" onClick={(event) => event.stopPropagation()}><WalletCardActions wallet={wallet} currencies={currencies} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedWallet ? (
        <WalletHistory
          historyRef={historyRef}
          entries={history}
          symbol={selectedWallet.currency.symbol}
          decimalPlaces={selectedWallet.currency.decimalPlaces}
          walletName={selectedWallet.name}
          walletType={selectedWallet.walletType}
          page={historyPage}
          pageSize={pageSize}
          total={historyTotal}
          totalPages={historyTotalPages}
          loading={historyLoading}
          onPageChange={changeHistoryPage}
        />
      ) : (
        <section ref={historyRef} className="scroll-mt-24 rounded-[20px] border border-dashed border-white/10 bg-[#0E1925] px-5 py-10 text-center">
          <p className="text-sm font-semibold text-white">Select a wallet to view history</p>
          <p className="mt-1 text-xs text-slate-500">Choose a wallet above and OKANE will load its transactions, transfers and investment movements here.</p>
        </section>
      )}
    </div>
  );
}
