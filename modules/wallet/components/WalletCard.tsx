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
    <div className="rounded-[20px] border border-white/10 bg-[#0E151E] p-6 shadow-[0_12px_35px_rgba(0,0,0,0.16)] transition hover:border-white/15 hover:bg-[#111923]">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {wallet.name}
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            {formatWalletType(wallet.walletType)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
            {wallet.currency.name} ({wallet.currency.code})
          </span>

          <WalletCardActions
            wallet={wallet}
            currencies={currencies}
          />
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm text-slate-500">
          Current Balance
        </p>

        <p className="mt-1 text-2xl font-bold tracking-tight text-white">
          {wallet.currency.symbol}
          {formatter.format(Number(wallet.currentBalance))}
        </p>
      </div>

      {wallet.bank && (
        <div className="mt-4 text-sm text-slate-500">
          {wallet.bank}
        </div>
      )}
    </div>
  );
}
