"use client";

import { useActionState, useState, type ReactElement } from "react";
import { toast } from "sonner";
import type { Category, Payee, Wallet } from "@prisma/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createTransactionAction, updateTransactionAction } from "../actions";
import { TRANSACTION_TYPES, formatTransactionType } from "../constants";
import type { TransactionActionState } from "../types";
import type { TransactionWithRelations } from "../repository";

const initialState: TransactionActionState = { success: false };

type TransactionFormProps = {
  mode: "create" | "edit";
  transaction?: TransactionWithRelations;
  wallets: Wallet[];
  categories: Category[];
  payees: Payee[];
  trigger: ReactElement;
};

function dateInputValue(value?: Date | string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}

export default function TransactionForm({ mode, transaction, wallets, categories, payees, trigger }: TransactionFormProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [walletId, setWalletId] = useState(transaction?.walletId ?? "");
  const [installmentEnabled, setInstallmentEnabled] = useState(Boolean(transaction?.installmentPlan));
  const [installmentTenor, setInstallmentTenor] = useState(transaction?.installmentPlan?.tenorMonths?.toString() ?? "6");
  const [installmentStartDate, setInstallmentStartDate] = useState(dateInputValue(transaction?.installmentPlan?.startDate ?? transaction?.transactionDate));
  const [installmentFee, setInstallmentFee] = useState(transaction?.installmentPlan?.feeAmount?.toString() ?? "0");

  const selectedWallet = wallets.find((wallet) => wallet.id === walletId);
  const canInstallment = selectedWallet?.walletType === "CREDIT_CARD" && (transaction?.type ?? "EXPENSE") === "EXPENSE";
  const amount = Number(transaction?.amount ?? 0);
  const fee = Number(installmentFee || 0);
  const tenor = Number(installmentTenor || 0);
  const monthlyAmount = tenor > 1 ? (amount + fee) / tenor : 0;

  const baseAction = mode === "create" ? createTransactionAction : updateTransactionAction;
  const [state, formAction, isPending] = useActionState(async (prevState: TransactionActionState, formData: FormData) => {
    const result = await baseAction(prevState, formData);
    if (result.success) {
      toast.success(mode === "create" ? "Transaction created successfully." : "Transaction updated successfully.");
      if (mode === "create") setFormKey((k) => k + 1);
      setOpen(false);
    } else if (result.message) toast.error(result.message);
    return result;
  }, initialState);

  function resetCreateForm() {
    setFormKey((k) => k + 1);
    setWalletId("");
    setInstallmentEnabled(false);
    setInstallmentTenor("6");
    setInstallmentStartDate(dateInputValue());
    setInstallmentFee("0");
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && mode === "create") resetCreateForm(); setOpen(isOpen); }}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Add Transaction" : "Edit Transaction"}</DialogTitle>
          <DialogDescription>Record an income or expense.</DialogDescription>
        </DialogHeader>
        <form key={formKey} action={formAction} className="space-y-4">
          {mode === "edit" && transaction && <input type="hidden" name="id" value={transaction.id} />}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="transactionDate">Date</Label><Input id="transactionDate" name="transactionDate" type="date" defaultValue={dateInputValue(transaction?.transactionDate)} required />{state.fieldErrors?.transactionDate && <p className="text-xs text-destructive">{state.fieldErrors.transactionDate[0]}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="type">Type</Label><Select name="type" defaultValue={transaction?.type ?? TRANSACTION_TYPES[0]}><SelectTrigger id="type" className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>{TRANSACTION_TYPES.map((type) => <SelectItem key={type} value={type}>{formatTransactionType(type)}</SelectItem>)}</SelectContent></Select></div>
          </div>

          <div className="space-y-1.5"><Label htmlFor="amount">Amount</Label><Input id="amount" name="amount" type="number" step="0.01" defaultValue={transaction?.amount?.toString()} placeholder="100000" required />{state.fieldErrors?.amount && <p className="text-xs text-destructive">{state.fieldErrors.amount[0]}</p>}</div>

          <div className="space-y-1.5">
            <Label htmlFor="walletId">Wallet</Label>
            <Select name="walletId" defaultValue={transaction?.walletId} onValueChange={(value) => { setWalletId(value); if (wallets.find((wallet) => wallet.id === value)?.walletType !== "CREDIT_CARD") setInstallmentEnabled(false); }}>
              <SelectTrigger id="walletId" className="w-full"><SelectValue placeholder="Select wallet">{(id: string | null) => wallets.find((wallet) => wallet.id === id)?.name ?? "Select wallet"}</SelectValue></SelectTrigger>
              <SelectContent>{wallets.map((wallet) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name}</SelectItem>)}</SelectContent>
            </Select>
            {state.fieldErrors?.walletId && <p className="text-xs text-destructive">{state.fieldErrors.walletId[0]}</p>}
          </div>

          {canInstallment && <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" name="installmentEnabled" value="true" checked={installmentEnabled} onChange={(event) => setInstallmentEnabled(event.target.checked)} className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-emerald-500" />
              <span><span className="block text-sm font-semibold text-white">Installment</span><span className="mt-0.5 block text-xs text-slate-500">Create a recurring credit-card installment plan. Off by default.</span></span>
            </label>
            {installmentEnabled && <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="installmentTenor">Tenor (months)</Label><Input id="installmentTenor" name="installmentTenor" type="number" min="2" max="120" value={installmentTenor} onChange={(e) => setInstallmentTenor(e.target.value)} required /></div>
              <div className="space-y-1.5"><Label htmlFor="installmentStartDate">Start date</Label><Input id="installmentStartDate" name="installmentStartDate" type="date" value={installmentStartDate} onChange={(e) => setInstallmentStartDate(e.target.value)} required /></div>
              <div className="space-y-1.5"><Label htmlFor="installmentFee">Interest / Fee (optional)</Label><Input id="installmentFee" name="installmentFee" type="number" min="0" step="0.01" value={installmentFee} onChange={(e) => setInstallmentFee(e.target.value)} /></div>
              <div className="rounded-xl border border-white/5 bg-black/10 px-3 py-2"><p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Estimated monthly</p><p className="mt-1 text-sm font-semibold text-emerald-300">Rp{monthlyAmount.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</p><p className="mt-0.5 text-[10px] text-slate-600">Total includes optional fee.</p></div>
            </div>}
            {state.fieldErrors?.installmentTenor && <p className="mt-2 text-xs text-destructive">{state.fieldErrors.installmentTenor[0]}</p>}
          </div>}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="categoryId">Category</Label><Select name="categoryId" defaultValue={transaction?.categoryId ?? ""}><SelectTrigger id="categoryId" className="w-full"><SelectValue placeholder="Optional">{(categoryId: string | null) => categories.find((category) => category.id === categoryId)?.name ?? "Optional"}</SelectValue></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-1.5"><Label htmlFor="merchant">Merchant</Label><Input id="merchant" name="merchant" list="merchant-list" defaultValue={transaction?.payee?.name ?? ""} placeholder="Merchant" /><datalist id="merchant-list">{payees.map((payee) => <option key={payee.id} value={payee.name} />)}</datalist></div>
          </div>

          <div className="space-y-1.5"><Label htmlFor="note">Note</Label><Textarea id="note" name="note" defaultValue={transaction?.note ?? ""} placeholder="Optional note" /></div>
          {state.message && <p className="text-xs text-destructive">{state.message}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => { if (mode === "create") resetCreateForm(); else setOpen(false); }} disabled={isPending}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending ? "Saving..." : mode === "create" ? "Create Transaction" : "Save Changes"}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}