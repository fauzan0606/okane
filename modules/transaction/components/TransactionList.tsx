import { CrudEmptyState } from "@/components/crud";
import type { TransactionWithRelations } from "../repository";
import TransactionCard from "./TransactionCard";

type TransactionListProps = { transactions: TransactionWithRelations[]; reviewMode?: boolean; merchantCounts?: Record<string, number> };

export default function TransactionList({ transactions, reviewMode = false, merchantCounts = {} }: TransactionListProps) {
  if (transactions.length === 0) return <CrudEmptyState title="No transaction yet" description="Start by creating your first transaction." />;
  return <div className="space-y-4">{transactions.map((transaction) => <TransactionCard key={transaction.id} transaction={transaction} reviewMode={reviewMode} sameMerchantCount={transaction.payeeId ? merchantCounts[String(transaction.payeeId)] ?? 1 : 0} />)}</div>;
}
