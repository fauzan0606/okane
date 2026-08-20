import { CrudEmptyState } from "@/components/crud";
import type { TransactionWithRelations } from "../repository";
import TransactionCard from "./TransactionCard";

type WalletOption = { id: string; name: string; walletType: "CASH" | "BANK_ACCOUNT" | "CREDIT_CARD" | "DEBIT_CARD" | "E_WALLET" | "FOREIGN_CASH" | "INVESTMENT" };
type CategoryOption = { id: string; name: string; type: "INCOME" | "EXPENSE"; icon: string | null; color: string | null };
type SubcategoryOption = { id: string; categoryId: string; name: string; isActive?: boolean; sortOrder?: number };
type PayeeOption = { id: string; name: string; note: string | null };
type TransactionListProps = { transactions: TransactionWithRelations[]; wallets: WalletOption[]; categories: CategoryOption[]; subcategories: SubcategoryOption[]; payees: PayeeOption[]; reviewMode?: boolean; merchantCounts?: Record<string, number> };

export default function TransactionList({ transactions, wallets, categories, subcategories, payees, reviewMode = false, merchantCounts = {} }: TransactionListProps) {
  if (transactions.length === 0) return <CrudEmptyState title="No transaction yet" description="Start by creating your first transaction." />;
  return <div className="space-y-4">{transactions.map((transaction) => <TransactionCard key={transaction.id} transaction={transaction} wallets={wallets} categories={categories} subcategories={subcategories} payees={payees} reviewMode={reviewMode} sameMerchantCount={transaction.payeeId ? merchantCounts[String(transaction.payeeId)] ?? 1 : 0} />)}</div>;
}
