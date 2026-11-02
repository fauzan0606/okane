"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { deleteReimbursementAction } from "../actions";

export default function DeleteReimbursementButton({ transactionId }: { transactionId: string }) {
  const [open, setOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();

  function handleDelete() {
    const formData = new FormData();
    formData.set("id", transactionId);
    startDelete(async () => {
      const result = await deleteReimbursementAction({ success: false }, formData);
      if (result.success) {
        toast.success("Reimbursement deleted.");
        setOpen(false);
        return;
      }
      toast.error(result.message ?? "Failed to delete reimbursement.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="ghost" size="sm" aria-label="Delete reimbursement" className="text-red-300 hover:bg-red-400/10 hover:text-red-200"><Trash2 size={14} />Delete</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete reimbursement?</DialogTitle>
          <DialogDescription>This removes the expense and any linked reimbursement receipt. The affected wallet balances will be reversed.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>Cancel</Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? "Deleting..." : "Delete"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
