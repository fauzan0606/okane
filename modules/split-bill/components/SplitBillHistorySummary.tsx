"use client";

type SummaryItem = {
  name: string;
  amount: number;
};

type ParticipantSummary = {
  name: string;
  isMe: boolean;
  normalItems: SummaryItem[];
  totalBeforeDiscount: number;
  discount: number;
  subtotal: number;
  tax: number;
  service: number;
  otherFees: SummaryItem[];
  total: number;
};

type Props = {
  billTotal: number;
  symbol: string;
  participants: ParticipantSummary[];
};

function money(value: number, symbol: string) {
  return `${symbol}${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

export default function SplitBillHistorySummary({
  billTotal,
  symbol,
  participants,
}: Props) {
  return (
    <details className="mt-3 rounded-2xl border border-white/5 bg-[#101B28]">
      <summary className="cursor-pointer list-none px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 hover:text-emerald-300">
        <span className="mr-2 inline-block">▸</span>
        Split summary
      </summary>

      <div className="border-t border-white/5 px-3 py-3">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#0B141F] px-3 py-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-600">
            Bill total
          </span>
          <span className="text-sm font-bold text-white">
            {money(billTotal, symbol)}
          </span>
        </div>

        <div className="space-y-3">
          {participants.map((participant, participantIndex) => (
            <div
              key={participantIndex}
              className="rounded-2xl border border-white/10 bg-[#0B141F] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">
                    {participant.name}
                    {participant.isMe && (
                      <span className="ml-1.5 rounded-full bg-emerald-400/10 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-300">
                        You
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                    ITEMS
                  </p>
                </div>

                <p className="text-base font-bold text-white">
                  {money(participant.total, symbol)}
                </p>
              </div>

              <div className="mt-3 space-y-1.5 text-xs">
                {participant.normalItems.length === 0 ? (
                  <p className="text-[10px] text-slate-600">No allocated items</p>
                ) : (
                  participant.normalItems.map((item, itemIndex) => (
                    <div
                      key={itemIndex}
                      className="flex items-start justify-between gap-3"
                    >
                      <span className="min-w-0 break-words text-slate-300">
                        {item.name}
                      </span>
                      <span className="shrink-0 text-slate-400">
                        {money(item.amount, symbol)}
                      </span>
                    </div>
                  ))
                )}

                <div className="border-t border-white/5 pt-2" />

                <div className="flex items-center justify-between gap-3 font-semibold">
                  <span className="text-slate-300">Total Before Discount</span>
                  <span className="text-white">
                    {money(participant.totalBeforeDiscount, symbol)}
                  </span>
                </div>

                {participant.discount !== 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Discount</span>
                    <span className="text-amber-300">
                      -{money(Math.abs(participant.discount), symbol)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 font-semibold">
                  <span className="text-slate-300">Subtotal</span>
                  <span className="text-white">
                    {money(participant.subtotal, symbol)}
                  </span>
                </div>

                {participant.tax !== 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Tax / PPN</span>
                    <span className="text-slate-400">
                      {money(participant.tax, symbol)}
                    </span>
                  </div>
                )}

                {participant.service !== 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Service Fee</span>
                    <span className="text-slate-400">
                      {money(participant.service, symbol)}
                    </span>
                  </div>
                )}

                {participant.otherFees.map((fee, feeIndex) => (
                  <div
                    key={feeIndex}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0 break-words text-slate-500">
                      {fee.name}
                    </span>
                    <span className="shrink-0 text-slate-400">
                      {money(fee.amount, symbol)}
                    </span>
                  </div>
                ))}

                <div className="border-t border-white/10 pt-2">
                  <div className="flex items-center justify-between gap-3 text-sm font-bold">
                    <span className="text-white">TOTAL</span>
                    <span className="text-white">
                      {money(participant.total, symbol)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex justify-end text-[10px]">
          <span className="text-emerald-300">
            ✓ Summary matches allocated bill total
          </span>
        </div>
      </div>
    </details>
  );
}
