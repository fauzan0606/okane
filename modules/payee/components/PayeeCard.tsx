import type { PayeeWithRelations } from "../repository";

import PayeeCardActions from "./PayeeCardActions";

type PayeeCardProps = {
  payee: PayeeWithRelations;
};

export default function PayeeCard({
  payee,
}: PayeeCardProps) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-[#0E151E] p-6 text-white shadow-[0_12px_35px_rgba(0,0,0,0.16)] transition hover:border-white/15 hover:bg-[#111923]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white">
            {payee.name}
          </h3>

          {payee.note && (
            <p className="mt-2 text-sm text-slate-500">
              {payee.note}
            </p>
          )}
        </div>

        <PayeeCardActions payee={payee} />
      </div>
    </div>
  );
}
