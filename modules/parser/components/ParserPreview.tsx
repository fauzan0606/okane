"use client";

import Card from "@/components/ui/card";

import type {
  ParsedTransaction,
} from "../types";

type Props = {
  result: ParsedTransaction;
};

export default function ParserPreview({
  result,
}: Props) {
  return (
    <Card className="space-y-6 rounded-3xl p-6">
      <div>
        <h2 className="text-lg font-semibold">
          Transaction Preview
        </h2>

        <p className="text-sm text-zinc-500">
          Review parser result.
        </p>
      </div>

      <div>
        <p className="text-sm text-zinc-500">
          Merchant
        </p>

        <p>
          {result.merchant ?? "-"}
        </p>
      </div>

      <div>
        <p className="text-sm text-zinc-500">
          Wallet
        </p>

        <p>
          {result.wallet?.name ?? "-"}
        </p>
      </div>

      <div>
        <p className="text-sm text-zinc-500">
          Amount
        </p>

        <p className="text-2xl font-bold">
          {result.amount
            ? new Intl.NumberFormat(
                "id-ID",
                {
                  style: "currency",
                  currency: "IDR",
                  maximumFractionDigits: 0,
                }
              ).format(result.amount)
            : "-"}
        </p>
      </div>

      <div>
        <p className="text-sm text-zinc-500">
          Type
        </p>

        <p>{result.type}</p>
      </div>
    </Card>
  );
}