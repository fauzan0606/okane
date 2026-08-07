import type { PayeeWithRelations } from "../repository";

import PayeeCard from "./PayeeCard";

type PayeeListProps = {
  payees: PayeeWithRelations[];
};

export default function PayeeList({
  payees,
}: PayeeListProps) {
  if (payees.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <h2 className="text-xl font-semibold">
          No payee yet
        </h2>

        <p className="mt-2 text-zinc-500">
          Start by creating your first payee.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {payees.map((payee) => (
        <PayeeCard
          key={payee.id}
          payee={payee}
        />
      ))}
    </div>
  );
}