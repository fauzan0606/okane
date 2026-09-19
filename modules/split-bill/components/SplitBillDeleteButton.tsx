"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { deleteSplitBillAction } from "../actions";

type Props = { splitBillId: string; finalized?: boolean };

export default function SplitBillDeleteButton({ splitBillId, finalized = false }: Props) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!confirmOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDeleting) setConfirmOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen, isDeleting]);

  function openConfirmation() {
    if (isDeleting) return;
    setError("");
    setConfirmOpen(true);
  }

  function cancelDelete() {
    if (isDeleting) return;
    setConfirmOpen(false);
  }

  async function handleDelete() {
    if (isDeleting) return;
    setError("");
    setIsDeleting(true);

    try {
      const formData = new FormData();
      formData.set("splitBillId", splitBillId);
      await deleteSplitBillAction(formData);
      setConfirmOpen(false);
      router.refresh();
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete Split Bill.");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {error && <span role="alert" className="max-w-[240px] text-[10px] text-red-300">{error}</span>}
        <button
          type="button"
          onClick={openConfirmation}
          disabled={isDeleting}
          className="inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border border-red-400/10 bg-red-400/[0.04] px-2.5 text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
          title={isDeleting ? "Deleting Split Bill…" : finalized ? "Delete Split Bill and rollback financial records" : "Delete Split Bill"}
          aria-label={isDeleting ? "Deleting Split Bill" : "Delete Split Bill"}
        >
          {isDeleting ? <LoaderCircle size={14} className="animate-spin" /> : <Trash2 size={14} />}
          {isDeleting && <span className="text-[10px] font-semibold">Deleting…</span>}
        </button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <button
            type="button"
            aria-label="Cancel delete"
            className="absolute inset-0"
            onClick={cancelDelete}
            disabled={isDeleting}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-split-bill-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-[#30465D] bg-[#172A3D] p-5 text-white shadow-[0_24px_70px_rgba(0,0,0,0.5)]"
          >
            <button
              type="button"
              onClick={cancelDelete}
              disabled={isDeleting}
              aria-label="Close confirmation"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#0B141F] text-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X size={16} />
            </button>

            <div className="flex items-start gap-3 pr-8">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-400/20 bg-red-400/10 text-red-300">
                <AlertTriangle size={19} />
              </div>
              <div>
                <h2 id="delete-split-bill-title" className="text-base font-semibold text-white">Hapus Split Bill?</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Apakah Anda yakin menghapus Split Bill ini?
                </p>
                {finalized && (
                  <p className="mt-2 rounded-lg border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2 text-[10px] leading-4 text-amber-200">
                    Split Bill ini sudah masuk ke financial records. Penghapusan juga akan melakukan rollback terhadap data keuangan terkait.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={isDeleting}
                className="rounded-xl border border-white/10 bg-[#0B141F] px-4 py-2.5 text-xs font-semibold text-slate-300 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting && <LoaderCircle size={14} className="animate-spin" />}
                {isDeleting ? "Deleting…" : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
