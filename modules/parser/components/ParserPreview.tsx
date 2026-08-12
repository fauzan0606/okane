"use client";

import Card from "@/components/ui/card";

import type {
  ParsedTransaction,
} from "../types";

type Props = {
  result: ParsedTransaction;
};

const CONFIDENCE_STYLES = {
  HIGH: {
    label: "High confidence",
    icon: "✓",
    className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
  },
  MEDIUM: {
    label: "Medium confidence",
    icon: "●",
    className: "border-amber-400/20 bg-amber-400/10 text-amber-200",
  },
  LOW: {
    label: "Review suggested category",
    icon: "•",
    className: "border-slate-400/20 bg-slate-400/10 text-slate-300",
  },
} as const;

export default function ParserPreview({
  result,
}: Props) {
  const confidence = CONFIDENCE_STYLES[result.confidence.level];

  return (
    <Card className="space-y-6 rounded-3xl p-6">
      <div>
        <h2 className="text-lg font-semibold">
          Transaction Preview
        </h2>

        <p className="text-sm text-zinc-500">
          Review parser result before saving.
        </p>
      </div>

      <div>
        <p className="text-sm text-zinc-500">Merchant</p>
        <p>{result.merchant ?? "-"}</p>
      </div>

      <div>
        <p className="text-sm text-zinc-500">Wallet</p>
        <p>{result.wallet?.name ?? "-"}</p>
      </div>

      <div>
        <p className="text-sm text-zinc-500">Amount</p>
        <p className="text-2xl font-bold">
          {result.amount
            ? new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
                maximumFractionDigits: 0,
              }).format(result.amount)
            : "-"}
        </p>
      </div>

      <div>
        <p className="text-sm text-zinc-500">Type</p>
        <p>{result.type}</p>
      </div>

      <div>
        <p className="text-sm text-zinc-500">Category</p>
        <p>{result.category?.name ?? "Needs review"}</p>
      </div>

      <div className={`rounded-2xl border p-4 ${confidence.className}`}>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden="true">{confidence.icon}</span>
          <span>{confidence.label}</span>
        </div>
        <p className="mt-1 text-xs opacity-90">
          {result.confidence.reason}
        </p>
      </div>
    </Card>
  );
}
