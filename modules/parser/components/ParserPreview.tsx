"use client";

import { useTransition } from "react";

import Card from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import {
  saveParsedTransactionAction,
} from "../actions";

import type {
  ParsedTransaction,
} from "../types";

type Props = {
  result: ParsedTransaction;
};

export default function ParserPreview({
  result,
}: Props) {
  const [
    isPending,
    startTransition,
  ] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await saveParsedTransactionAction(
          result
        );

        alert(
          "Transaction saved successfully."
        );
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "Failed to save transaction."
        );
      }
    });
  }

  return (
    <Card>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl font-semibold">
            Transaction Preview
          </h2>

          <p className="text-sm text-zinc-500">
            Review before saving.
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

        <Button
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending
            ? "Saving..."
            : "Save Transaction"}
        </Button>
      </div>
    </Card>
  );
}