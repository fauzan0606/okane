import type { TransactionWithRelations } from "../repository";
import type { Category, Payee } from "@prisma/client";
import { formatTransactionType } from "../constants";
import { getInstallmentNumber } from "../installment";
import TransactionCardActions from "./TransactionCardActions";

type WalletOption = { id: string; name: string; walletType: "CASH" | "BANK_ACCOUNT" | "CREDIT_CARD" | "DEBIT_CARD" | "E_WALLET" | "FOREIGN_CASH" | "INVESTMENT" };
type TransactionCardProps = { transaction: TransactionWithRelations; wallets: WalletOption[]; categories: Category[]; payees: Payee[] };

export default function TransactionCard({ transaction, wallets, categories, payees }: TransactionCardProps) {
  const splitBill = transaction.splitBill;
  const amount = splitBill ? Number(splitBill.personalAmount) : Number(transaction.amount);
  const amountColor = transaction.type === "EXPENSE" ? "text-red-400" : "text-emerald-400";
  const plan = transaction.installmentPlan;
  const currentInstallment = plan ? getInstallmentNumber(new Date(plan.startDate), new Date(), plan.tenorMonths) : 0;
  const remainingInstallments = plan ? Math.max(plan.tenorMonths - currentInstallment, 0) : 0;
  const transactionForClient: TransactionWithRelations = { ...transaction, transactionDate: String(transaction.transactionDate), amount: String(transaction.amount), installmentPlan: plan ? { ...plan, totalAmount: String(plan.totalAmount), feeAmount: String(plan.feeAmount), installmentAmount: String(plan.installmentAmount), startDate: String(plan.startDate) } : null, splitBill: splitBill ? { ...splitBill, totalAmount: String(splitBill.totalAmount), personalAmount: String(splitBill.personalAmount) } : null };
  const dateLabel = new Date(transaction.transactionDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="rounded-[16px] border border-[#30465D] bg-[#172A3D] px-4 py-3 shadow-[0_10px_26px_rgba(0,0,0,0.22)] transition hover:border-[#405A74] hover:bg-[#1D3145]">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="min-w-0 flex-1 md:min-w-[180px]"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate text-sm font-semibold text-white">{transaction.payee ? transaction.payee.name : "No merchant"}</h3><span className="shrink-0 rounded-full bg-[#0B141F] px-2 py-0.5 text-[9px] font-medium text-slate-300">{formatTransactionType(transaction.type)}</span>{splitBill && <span className="shrink-0 rounded-full border border-emerald-400/15 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-medium text-emerald-300">Split Bill</span>}</div><p className="mt-1 truncate text-[11px] text-slate-300">{transaction.category?.name ?? "Uncategorized"}</p></div>
        <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-5 gap-y-1 text-[11px] text-slate-400 sm:grid-cols-3"><span className="truncate">Wallet: <span className="text-slate-200">{transaction.wallet.name}</span></span><span className="truncate">Date: <span className="text-slate-200">{dateLabel}</span></span>{splitBill ? <span className="truncate text-emerald-300">Your share {transaction.wallet.currency.code} {Number(splitBill.personalAmount).toLocaleString("id-ID")}</span> : plan ? <span className="truncate text-emerald-300">Installment {currentInstallment}/{plan.tenorMonths} · {remainingInstallments} left</span> : <span className="truncate text-slate-500">—</span>}</div>
        <div className="flex shrink-0 items-center justify-between gap-3 md:justify-end"><div className="text-right"><p className={`text-base font-bold tracking-tight ${amountColor}`}>{transaction.wallet.currency.code} {amount.toLocaleString("id-ID")}</p>{splitBill && <p className="mt-0.5 text-[9px] text-slate-400">personal expense</p>}{plan && <p className="mt-0.5 text-[9px] text-slate-400">{transaction.wallet.currency.code} {Number(plan.installmentAmount).toLocaleString("id-ID")}/month</p>}</div><TransactionCardActions transaction={transactionForClient} wallets={wallets} categories={categories} payees={payees} /></div>
      </div>
    </div>
  );
}
