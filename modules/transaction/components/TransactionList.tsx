import type {
  TransactionWithRelations,
} from "../repository";

import TransactionCard from "./TransactionCard";

type Props = {
  transactions: TransactionWithRelations[];
};

export default function TransactionList({
  transactions,
}: Props) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-xl font-semibold">
          No transaction yet
        </h2>

        <p className="mt-2 text-zinc-500">
          Start by creating your first
          transaction.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {transactions.map((transaction) => (
        <TransactionCard
          key={transaction.id}
          transaction={transaction}
        />
      ))}
    </div>
  );
}