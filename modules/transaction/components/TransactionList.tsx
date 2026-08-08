import {
  CrudEmptyState,
} from "@/components/crud";
import type {
  Category,
  Payee,
  Wallet,
} from "@prisma/client";

import type {
  TransactionWithRelations,
} from "../repository";

import TransactionCard from "./TransactionCard";

type TransactionListProps = {
  transactions: TransactionWithRelations[];
  wallets: Wallet[];
  categories: Category[];
  payees: Payee[];
};

export default function TransactionList({
  transactions,
  wallets,
  categories,
  payees,
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
          wallets={wallets}
          categories={categories}
          payees={payees}
        />
      ))}
    </div>
  );
}
