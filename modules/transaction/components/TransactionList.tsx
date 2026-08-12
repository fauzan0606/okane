import { CrudEmptyState } from "@/components/crud";
import type { Category, Payee, Subcategory } from "@prisma/client";
import type { TransactionWithRelations } from "../repository";
import TransactionCard from "./TransactionCard";

type WalletOption = { id: string; name: string; walletType: "CASH" | "BANK_ACCOUNT" | "CREDIT_CARD" | "DEBIT_CARD" | "E_WALLET" | "FOREIGN_CASH" | "INVESTMENT" };
type TransactionListProps = { transactions: TransactionWithRelations[]; wallets: WalletOption[]; categories: Category[]; subcategories: Subcategory[]; payees: Payee[] };

export default function TransactionList({ transactions, wallets, categories, subcategories, payees }: TransactionListProps) {
  if (transactions.length === 0) return <CrudEmptyState title="No transaction yet" description="Start by creating your first transaction." />;
  return <div className="space-y-4">{transactions.map((transaction) => <TransactionCard key={transaction.id} transaction={transaction} wallets={wallets} categories={categories} subcategories={subcategories} payees={payees} />)}</div>;
}
