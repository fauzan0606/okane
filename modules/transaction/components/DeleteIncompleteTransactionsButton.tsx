"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteAllIncompleteTransactionsAction } from "../actions";

export default function DeleteIncompleteTransactionsButton({ count }: { count: number }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function removeAll() {
    const confirmed = window.confirm(`Delete all ${count} incomplete transactions from Review Incomplete? This cannot be undone.`);
    if (!confirmed) return;

    setPending(true);
    try {
      const result = await deleteAllIncompleteTransactionsAction();
      if (!result.success) throw new Error(result.message ?? "Failed to delete incomplete transactions.");
      toast.success(`Deleted ${result.count} incomplete transactions.`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete incomplete transactions.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={removeAll} disabled={pending || count === 0} className="border-red-400/20 text-red-200 hover:bg-red-400/10">
      {pending ? "Deleting…" : `Delete all (${count})`}
    </Button>
  );
}
