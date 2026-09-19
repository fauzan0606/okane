"use client";

import { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteSplitBillAction } from "../actions";

type Props = { splitBillId: string; finalized?: boolean };

export default function SplitBillDeleteButton({ splitBillId, finalized = false }: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleDelete() {
    if (isDeleting) return;
    setError("");
    setIsDeleting(true);
    try {
      const formData = new FormData();
      formData.set("splitBillId", splitBillId);
      await deleteSplitBillAction(formData);
      router.refresh();
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete Split Bill.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span role="alert" className="max-w-[240px] text-[10px] text-red-300">{error}</span>}
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border border-red-400/10 bg-red-400/[0.04] px-2.5 text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
        title={isDeleting ? "Deleting Split Bill…" : finalized ? "Delete Split Bill and rollback financial records" : "Delete Split Bill"}
        aria-label={isDeleting ? "Deleting Split Bill" : "Delete Split Bill"}
      >
        {isDeleting ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
        {isDeleting && <span className="text-[10px] font-semibold">Deleting…</span>}
      </button>
    </div>
  );
}
