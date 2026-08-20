"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { TransactionWithRelations } from "../repository";
import { deleteTransactionAction } from "../actions";
import TransactionForm from "./TransactionForm";

type WalletOption = { id: string; name: string; walletType: "CASH" | "BANK_ACCOUNT" | "CREDIT_CARD" | "DEBIT_CARD" | "E_WALLET" | "FOREIGN_CASH" | "INVESTMENT" };
type CategoryOption = { id: string; name: string; type: "INCOME" | "EXPENSE"; icon: string | null; color: string | null };
type SubcategoryOption = { id: string; categoryId: string; name: string; isActive?: boolean; sortOrder?: number };
type PayeeOption = { id: string; name: string; note: string | null };
type Props = { transaction: TransactionWithRelations; wallets: WalletOption[]; categories: CategoryOption[]; subcategories: SubcategoryOption[]; payees: PayeeOption[]; reviewMode?: boolean; sameMerchantCount?: number };

export default function TransactionCardActions({ transaction, wallets, categories, subcategories, payees, reviewMode = false, sameMerchantCount = 0 }: Props) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, startDelete] = useTransition();
  function handleDelete() {
    const formData = new FormData();
    formData.set("id", transaction.id);
    startDelete(async () => {
      const result = await deleteTransactionAction({ success: false }, formData);
      if (result.success) { toast.success("Transaction deleted successfully."); setDeleteOpen(false); return; }
      toast.error(result.message ?? "Failed to delete transaction.");
    });
  }
  return (
    <div className="flex items-center gap-1">
      <TransactionForm mode="edit" transaction={transaction} wallets={wallets} categories={categories} subcategories={subcategories} payees={payees} reviewMode={reviewMode} sameMerchantCount={sameMerchantCount} trigger={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${transaction.id}`}><Pencil /></Button>} />
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Delete ${transaction.id}`}><Trash2 /></Button>} />
        <DialogContent>
          <DialogHeader><DialogTitle>Delete transaction?</DialogTitle><DialogDescription>This transaction will be permanently deleted.</DialogDescription></DialogHeader>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>Cancel</Button><Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting}>{isDeleting ? "Deleting..." : "Delete"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
