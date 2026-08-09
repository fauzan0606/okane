import type { TransactionWithRelations } from "../repository";
import type { Category, Payee, Wallet } from "@prisma/client";
import { formatTransactionType } from "../constants";
import { getInstallmentNumber } from "../installment";
import TransactionCardActions from "./TransactionCardActions";

type TransactionCardProps = {
  transaction: TransactionWithRelations;
  wallets: Wallet[];
  categories: Category[];
  payees: Payee[];
};

export default function TransactionCard({ transaction, wallets, categories, payees }: TransactionCardProps) {
  const amount = Number(transaction.amount);
  const amountColor = transaction.type === "EXPENSE" ? "text-red-400" : "text-emerald-400";
  const plan = transaction.installmentPlan;
  const currentInstallment = plan ? getInstallmentNumber(plan.startDate, new Date(), plan.tenorMonths) : 0;
  const remainingInstallments = plan ? Math.max(plan.tenorMonths - currentInstallment, 0) : 0;

  return (
    <div className="rounded-[20px] border border-white/10 bg-[#0E151E] p-5 shadow-[0_12px_35px_rgba(0,0,0,0.16)] transition hover:border-white/15 hover:bg-[#111923]">
      <div className="flex items-start justify-between">
        <div><h3 className="font-semibold text-white">{transaction.category?.name ?? "Uncategorized"}</h3><p className="mt-1 text-sm text-slate-500">{formatTransactionType(transaction.type)}</p></div>
        <TransactionCardActions transaction={transaction} wallets={wallets} categories={categories} payees={payees} />
      </div>

      <div className="mt-6">
        <p className={`text-2xl font-bold ${amountColor}`}>{transaction.wallet.currency.code} {amount.toLocaleString("id-ID")}</p>
        <div className="mt-2 space-y-1 text-sm text-slate-500">
          <p>Wallet: {transaction.wallet.name}</p>
          {transaction.payee && <p>Merchant: {transaction.payee.name}</p>}
          <p>{new Date(transaction.transactionDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</p>
        </div>

        {plan && <div className="mt-4 rounded-xl border border-emerald-400/10 bg-emerald-400/[0.04] px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-400">Installment</p><p className="mt-0.5 text-sm font-semibold text-white">{currentInstallment > 0 ? `${currentInstallment} / ${plan.tenorMonths}` : `Starts ${new Date(plan.startDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}`}</p></div>
            {currentInstallment > 0 && <p className="text-right text-xs text-slate-400">{remainingInstallments} remaining</p>}
          </div>
          <p className="mt-1 text-xs text-slate-500">{transaction.wallet.currency.code} {Number(plan.installmentAmount).toLocaleString("id-ID", { maximumFractionDigits: 2 })} / month</p>
        </div>}
      </div>
    </div>
  );
}