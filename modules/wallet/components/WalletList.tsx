import type { Currency } from "@prisma/client";

import type { WalletWithRelations } from "../repository";

import WalletCard from "./WalletCard";

type WalletListProps = {
  wallets: WalletWithRelations[];
  currencies: Currency[];
};

export default function WalletList({
  wallets,
  currencies,
}: WalletListProps) {
  if (wallets.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-xl font-semibold">
          No wallet yet
        </h2>

        <p className="mt-2 text-zinc-500">
          Start by creating your first wallet.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {wallets.map((wallet) => (
        <WalletCard
          key={wallet.id}
          wallet={wallet}
          currencies={currencies}
        />
      ))}
    </div>
  );
}
