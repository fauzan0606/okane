import type { PayeeWithRelations } from "../repository";

import PayeeCardActions from "./PayeeCardActions";

type PayeeCardProps = {
  payee: PayeeWithRelations;
};

export default function PayeeCard({
  payee,
}: PayeeCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {payee.name}
          </h3>

          {payee.note && (
            <p className="mt-2 text-sm text-zinc-500">
              {payee.note}
            </p>
          )}
        </div>

        <PayeeCardActions
          payee={payee}
        />
      </div>
    </div>
  );
}