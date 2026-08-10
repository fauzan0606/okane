import type { Currency } from "@prisma/client";

import type { WalletClientData } from "../repository";
import { formatWalletType } from "../constants";
import WalletCardActions from "./WalletCardActions";

type WalletCardProps = {
  wallet: WalletClientData;
  currencies: Currency[];
};

export default function WalletCard({ wallet, currencies }: WalletCardProps) {
  const formatter = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: wallet.currency.decimalPlaces,
    maximumFractionDigits: wallet.currency.decimalPlaces,
  });
  const creditCard = wallet.creditCard;
  const isCreditCard = wallet.walletType === "CREDIT_CARD" && creditCard;

  return (
    <div className="rounded-[20px] border border-[#30465D] bg-[#172A3D] p-6 shadow-[0_12px_35px_rgba(0,0,0,0.22)] transition hover:border-[#405A74] hover:bg-[#1D3145]">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{wallet.name}</h3>
          <p className="mt-1 text-sm text-slate-400">{formatWalletType(wallet.walletType)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-[#0B141F] px-3 py-1 text-xs font-medium text-slate-300">
            {wallet.currency.name} ({wallet.currency.code})
          </span>
          <WalletCardActions wallet={wallet} currencies={currencies} />
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm text-slate-400">{isCreditCard ? "Outstanding" : "Current Balance"}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-white">
          {wallet.currency.symbol}{formatter.format(Number(wallet.currentBalance))}
        </p>
      </div>

      {isCreditCard && (
        <div className="mt-5 rounded-2xl border border-[#30465D] bg-[#0B141F] p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Credit Limit</span>
            <span className="font-medium text-slate-200">{wallet.currency.symbol}{formatter.format(Number(creditCard.creditLimit))}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm"><span className="text-slate-400">Billing Day</span><span className="text-slate-300">{creditCard.billingDate}</span></div>
          <div className="mt-1 flex items-center justify-between text-sm"><span className="text-slate-400">Due Day</span><span className="text-slate-300">{creditCard.dueDate}</span></div>
        </div>
      )}

      {wallet.bank && <div className="mt-4 text-sm text-slate-400">{wallet.bank}</div>}
    </div>
  );
}
