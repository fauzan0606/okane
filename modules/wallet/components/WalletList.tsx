"use client";

import { useState } from "react";
import type { Currency } from "@prisma/client";

import type { WalletClientData, WalletHistoryEntry } from "../repository";
import WalletCard from "./WalletCard";
import WalletHistory from "./WalletHistory";
import { CrudEmptyState } from "@/components/crud";

type WalletListProps = {
  wallets: WalletClientData[];
  currencies: Currency[];
  histories: Record<string, WalletHistoryEntry[]>;
};

export default function WalletList({ wallets, currencies, histories }: WalletListProps) {
  const [selectedWalletId, setSelectedWalletId] = useState(wallets[0]?.id ?? "");

  if (wallets.length === 0) {
    return <CrudEmptyState title="No wallet yet" description="Start by creating your first wallet." />;
  }

  const selectedWallet = wallets.find((wallet) => wallet.id === selectedWalletId) ?? wallets[0];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {wallets.map((wallet) => (
          <WalletCard key={wallet.id} wallet={wallet} currencies={currencies} selected={wallet.id === selectedWallet.id} onSelect={() => setSelectedWalletId(wallet.id)} />
        ))}
      </div>

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
