"use client";

import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import type {
  TransactionWithRelations,
} from "../repository";

type Props = {
  transaction: TransactionWithRelations;
};

export default function TransactionCardActions({
  transaction,
}: Props) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${transaction.id}`}
      >
        <Pencil />
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Delete ${transaction.id}`}
      >
        <Trash2 />
      </Button>
    </div>
  );
}