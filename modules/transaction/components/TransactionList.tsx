import {
  CrudEmptyState,
} from "@/components/crud";

import type {
  TransactionWithRelations,
} from "../repository";

import TransactionCard from "./TransactionCard";

type TransactionListProps = {
  transactions: TransactionWithRelations[];
};

export default function TransactionList({
  transactions,
}: TransactionListProps) {
  if (transactions.length === 0) {
    return (
      <CrudEmptyState
        title="No transaction yet"
        description="Start by creating your first transaction."
      />
    );
  }

  return (
    <div className="space-y-4">
      {transactions.map((transaction) => (
        <TransactionCard
          key={transaction.id}
          transaction={transaction}
        />
      ))}
    </div>
  );
}