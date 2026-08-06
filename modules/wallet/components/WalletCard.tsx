import type { Currency } from "@prisma/client";

import type { WalletWithRelations } from "../repository";
import { formatWalletType } from "../constants";

import WalletCardActions from "./WalletCardActions";

type WalletCardProps = {
  wallet: WalletWithRelations;
  currencies: Currency[];
};

export default function WalletCard({
  wallet,
  currencies,
}: WalletCardProps) {
  const formatter = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: wallet.currency.decimalPlaces,
    maximumFractionDigits: wallet.currency.decimalPlaces,
  });

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {wallet.name}
          </h3>

          <p className="mt-1 text-sm text-zinc-500">
            {formatWalletType(wallet.walletType)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {wallet.currency.code}
          </span>

          <WalletCardActions wallet={wallet} currencies={currencies} />
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm text-zinc-500">
          Current Balance
        </p>

        <p className="mt-1 text-2xl font-bold">
          {wallet.currency.symbol}
          {formatter.format(Number(wallet.currentBalance))}
        </p>
      </div>

      {wallet.bank && (
        <div className="mt-4 text-sm text-zinc-500">
          {wallet.bank}
        </div>
      )}
    </div>
  );
}
