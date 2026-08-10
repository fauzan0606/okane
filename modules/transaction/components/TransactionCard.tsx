import type { TransactionWithRelations } from "../repository";
import type { Category, Payee } from "@prisma/client";
import { formatTransactionType } from "../constants";
import { getInstallmentNumber } from "../installment";
import TransactionCardActions from "./TransactionCardActions";

type WalletOption = { id: string; name: string; walletType: "CASH" | "BANK_ACCOUNT" | "CREDIT_CARD" | "DEBIT_CARD" | "E_WALLET" | "FOREIGN_CASH" | "INVESTMENT" };
type TransactionCardProps = { transaction: TransactionWithRelations; wallets: WalletOption[]; categories: Category[]; payees: Payee[] };

export default function TransactionCard({ transaction, wallets, categories, payees }: TransactionCardProps) {
  const amount = Number(transaction.amount);
  const amountColor = transaction.type === "EXPENSE" ? "text-red-400" : "text-emerald-400";
  const plan = transaction.installmentPlan;
  const currentInstallment = plan ? getInstallmentNumber(new Date(plan.startDate), new Date(), plan.tenorMonths) : 0;
  const remainingInstallments = plan ? Math.max(plan.tenorMonths - currentInstallment, 0) : 0;
  const transactionForClient: TransactionWithRelations = {
    ...transaction,
    transactionDate: String(transaction.transactionDate),
    amount: String(transaction.amount),
    installmentPlan: plan ? {
      ...plan,
      totalAmount: String(plan.totalAmount),
      feeAmount: String(plan.feeAmount),
      installmentAmount: String(plan.installmentAmount),
      startDate: String(plan.startDate),
    } : null,
  };
  const dateLabel = new Date(transaction.transactionDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="rounded-[16px] border border-white/10 bg-[#0E151E] px-4 py-3 shadow-[0_8px_24px_rgba(0,0,0,0.12)] transition hover:border-white/15 hover:bg-[#111923]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="min-w-0 flex-1 md:min-w-[180px]">
          <div className="flex items-center gap-2"><h3 className="truncate text-sm font-semibold text-white">{transaction.payee ? transaction.payee.name : "No merchant"}</h3><span className="shrink-0 rounded-full bg-white/[0.04] px-2 py-0.5 text-[9px] font-medium text-slate-500">{formatTransactionType(transaction.type)}</span></div>
          <p className="mt-1 truncate text-[11px] text-slate-500">{transaction.category?.name ?? "Uncategorized"}</p>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-5 gap-y-1 text-[11px] text-slate-500 sm:grid-cols-3">
          <span className="truncate">Wallet: <span className="text-slate-300">{transaction.wallet.name}</span></span>
          <span className="truncate">Date: <span className="text-slate-300">{dateLabel}</span></span>
          {plan ? <span className="truncate text-emerald-300">Installment {currentInstallment}/{plan.tenorMonths} · {remainingInstallments} left</span> : <span className="truncate text-slate-600">—</span>}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 md:justify-end">
          <div className="text-right"><p className={`text-base font-bold tracking-tight ${amountColor}`}>{transaction.wallet.currency.code} {amount.toLocaleString("id-ID")}</p>{plan && <p className="mt-0.5 text-[9px] text-slate-600">{transaction.wallet.currency.code} {Number(plan.installmentAmount).toLocaleString("id-ID")}/month</p>}</div>
          <TransactionCardActions transaction={transactionForClient} wallets={wallets} categories={categories} payees={payees} />
        </div>
      </div>
    </div>
  );
}
