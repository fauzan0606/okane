import type { Currency } from "@prisma/client";

import type { WalletClientData, WalletHistoryEntry } from "../repository";
import WalletCard from "./WalletCard";
import { CrudEmptyState } from "@/components/crud";

type WalletListProps = {
  wallets: WalletClientData[];
  currencies: Currency[];
  histories: Record<string, WalletHistoryEntry[]>;
};

export default function WalletList({ wallets, currencies, histories }: WalletListProps) {
  if (wallets.length === 0) {
    return <CrudEmptyState title="No wallet yet" description="Start by creating your first wallet." />;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {wallets.map((wallet) => <WalletCard key={wallet.id} wallet={wallet} currencies={currencies} history={histories[wallet.id] ?? []} />)}
    </div>
  );
}
