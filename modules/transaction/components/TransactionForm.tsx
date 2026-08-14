"use client";

import { useActionState, useState, type ReactElement } from "react";
import { toast } from "sonner";
import type { Category, Payee, Subcategory } from "@prisma/client";
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

type WalletOption = { id: string; name: string; walletType: "CASH" | "BANK_ACCOUNT" | "CREDIT_CARD" | "DEBIT_CARD" | "E_WALLET" | "FOREIGN_CASH" | "INVESTMENT" };
type TransactionFormProps = { mode: "create" | "edit"; transaction?: TransactionWithRelations; wallets: WalletOption[]; categories: Category[]; subcategories: Subcategory[]; payees: Payee[]; trigger: ReactElement };
const initialState: TransactionActionState = { success: false };
function dateInputValue(value?: Date | string | null) { return value ? new Date(value).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10); }

export default function TransactionForm({ mode, transaction, wallets, categories, subcategories, payees, trigger }: TransactionFormProps) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [walletId, setWalletId] = useState(transaction?.walletId ?? "");
  const [type, setType] = useState(transaction?.type ?? TRANSACTION_TYPES[0]);
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");
  const [subcategoryId, setSubcategoryId] = useState(transaction?.subcategoryId ?? "");
  const [amount, setAmount] = useState(transaction?.amount?.toString() ?? "");
  const [installmentEnabled, setInstallmentEnabled] = useState(Boolean(transaction?.installmentPlan));
  const [installmentTenor, setInstallmentTenor] = useState(transaction?.installmentPlan?.tenorMonths?.toString() ?? "6");
  const [installmentStartDate, setInstallmentStartDate] = useState(dateInputValue(transaction?.installmentPlan?.startDate ?? transaction?.transactionDate));
  const [installmentFee, setInstallmentFee] = useState(transaction?.installmentPlan?.feeAmount?.toString() ?? "0");
  const selectedWallet = wallets.find((wallet) => wallet.id === walletId);
  const visibleCategories = categories.filter((category) => category.type === type);
  const visibleSubcategories = subcategories.filter((subcategory) => subcategory.categoryId === categoryId);
  const selectedCategoryName = visibleCategories.find((category) => category.id === categoryId)?.name;
  const selectedSubcategoryName = visibleSubcategories.find((subcategory) => subcategory.id === subcategoryId)?.name;
  const canInstallment = selectedWallet?.walletType === "CREDIT_CARD" && type === "EXPENSE";
  const fee = Number(installmentFee || 0); const tenor = Number(installmentTenor || 0); const principal = Number(amount || 0); const monthlyAmount = tenor > 1 ? (principal + fee) / tenor : 0;
  const baseAction = mode === "create" ? createTransactionAction : updateTransactionAction;
  const [state, formAction, isPending] = useActionState(async (prevState: TransactionActionState, formData: FormData) => { const result = await baseAction(prevState, formData); if (result.success) { toast.success(mode === "create" ? "Transaction created successfully." : "Transaction updated successfully."); if (mode === "create") setFormKey((k) => k + 1); setOpen(false); } else if (result.message) toast.error(result.message); return result; }, initialState);
  function resetCreateForm() { setFormKey((k) => k + 1); setWalletId(""); setType(TRANSACTION_TYPES[0]); setCategoryId(""); setSubcategoryId(""); setAmount(""); setInstallmentEnabled(false); setInstallmentTenor("6"); setInstallmentStartDate(dateInputValue()); setInstallmentFee("0"); }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && mode === "create") resetCreateForm(); setOpen(isOpen); }}>
      <DialogTrigger render={trigger} />
      <DialogContent showCloseButton className="!w-[calc(100vw-1.5rem)] !max-w-[760px] max-h-[92vh] overflow-y-auto rounded-[26px] border border-[#30465D] bg-[#0E1925] p-0 text-white shadow-[0_24px_70px_rgba(0,0,0,0.45)] sm:!w-[calc(100vw-3rem)]">
        <div className="p-5 sm:p-7 md:p-8"><DialogHeader className="mb-5 flex-row items-start gap-4 pr-10 sm:mb-6"><div><DialogTitle className="text-xl font-semibold text-white sm:text-2xl">{mode === "create" ? "Add Transaction" : "Edit Transaction"}</DialogTitle><DialogDescription className="mt-1.5 text-xs leading-5 text-slate-500 sm:text-sm sm:leading-6">Record an income or expense.</DialogDescription></div></DialogHeader>
          <form key={formKey} action={formAction} className="overflow-hidden rounded-[22px] border border-[#30465D] bg-[#0A1119]">
            {mode === "edit" && transaction && <input type="hidden" name="id" value={transaction.id} />}
            <div className="space-y-4 p-4 sm:space-y-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="transactionDate">Date</Label><Input id="transactionDate" name="transactionDate" type="date" defaultValue={dateInputValue(transaction?.transactionDate)} required />{state.fieldErrors?.transactionDate && <p className="text-xs text-destructive">{state.fieldErrors.transactionDate[0]}</p>}</div><div className="space-y-1.5"><Label htmlFor="type">Type</Label><Select name="type" value={type} onValueChange={(value) => { const next = value ?? "EXPENSE"; setType(next as typeof type); setCategoryId(""); setSubcategoryId(""); }}><SelectTrigger id="type" className="w-full"><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>{TRANSACTION_TYPES.map((transactionType) => <SelectItem key={transactionType} value={transactionType}>{formatTransactionType(transactionType)}</SelectItem>)}</SelectContent></Select></div></div>
              <div className="space-y-1.5"><Label htmlFor="amount">Amount</Label><Input id="amount" name="amount" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="100000" required />{state.fieldErrors?.amount && <p className="text-xs text-destructive">{state.fieldErrors.amount[0]}</p>}</div>
              <div className="space-y-1.5"><Label htmlFor="walletId">Wallet</Label><Select name="walletId" value={walletId} onValueChange={(value) => { const nextValue = value ?? ""; setWalletId(nextValue); if (wallets.find((wallet) => wallet.id === nextValue)?.walletType !== "CREDIT_CARD") setInstallmentEnabled(false); }}><SelectTrigger id="walletId" className="w-full"><SelectValue placeholder="Select wallet">{selectedWallet?.name ?? "Select wallet"}</SelectValue></SelectTrigger><SelectContent>{wallets.map((wallet) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name}</SelectItem>)}</SelectContent></Select>{state.fieldErrors?.walletId && <p className="text-xs text-destructive">{state.fieldErrors.walletId[0]}</p>}</div>
              {canInstallment && <div className="rounded-2xl border border-[#30465D] bg-[#172A3D] p-4"><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" name="installmentEnabled" value="true" checked={installmentEnabled} onChange={(event) => setInstallmentEnabled(event.target.checked)} className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-emerald-500" /><span><span className="block text-sm font-semibold text-white">Installment</span><span className="mt-0.5 block text-xs text-slate-500">Create a recurring credit-card installment plan. Off by default.</span></span></label>{installmentEnabled && <div className="mt-4 grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="installmentTenor">Tenor (months)</Label><Input id="installmentTenor" name="installmentTenor" type="number" min="2" max="120" value={installmentTenor} onChange={(e) => setInstallmentTenor(e.target.value)} required /></div><div className="space-y-1.5"><Label htmlFor="installmentStartDate">Start date</Label><Input id="installmentStartDate" name="installmentStartDate" type="date" value={installmentStartDate} onChange={(e) => setInstallmentStartDate(e.target.value)} required /></div><div className="space-y-1.5"><Label htmlFor="installmentFee">Interest / Fee (optional)</Label><Input id="installmentFee" name="installmentFee" type="number" min="0" step="0.01" value={installmentFee} onChange={(e) => setInstallmentFee(e.target.value)} /></div><div className="rounded-xl border border-[#30465D] bg-black/10 px-3 py-2"><p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Estimated monthly</p><p className="mt-1 text-sm font-semibold text-emerald-300">Rp{monthlyAmount.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</p><p className="mt-0.5 text-[10px] text-slate-600">Total includes optional fee.</p></div></div>}</div>}
              <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="categoryId">Category</Label><Select name="categoryId" value={categoryId} onValueChange={(value) => { const next = value ?? ""; setCategoryId(next); setSubcategoryId(""); }}><SelectTrigger id="categoryId" className="w-full"><SelectValue placeholder="Select category">{selectedCategoryName ?? "Select category"}</SelectValue></SelectTrigger><SelectContent>{visibleCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1.5"><Label htmlFor="subcategoryId">Subcategory</Label><Select name="subcategoryId" value={subcategoryId} onValueChange={(value) => setSubcategoryId(value ?? "")} disabled={!categoryId}><SelectTrigger id="subcategoryId" className="w-full"><SelectValue placeholder={categoryId ? "Select subcategory" : "Select category first"}>{selectedSubcategoryName ?? (categoryId ? "Select subcategory" : "Select category first")}</SelectValue></SelectTrigger><SelectContent>{visibleSubcategories.length > 0 ? visibleSubcategories.map((subcategory) => <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</SelectItem>) : <div className="px-3 py-2.5 text-sm text-slate-500">No subcategories available</div>}</SelectContent></Select></div></div>
              <div className="space-y-1.5"><Label htmlFor="merchant">Merchant</Label><Input id="merchant" name="merchant" list="merchant-list" defaultValue={transaction?.payee?.name ?? ""} placeholder="Merchant" /><datalist id="merchant-list">{payees.map((payee) => <option key={payee.id} value={payee.name} />}</datalist></div><div className="space-y-1.5"><Label htmlFor="note">Note</Label><Textarea id="note" name="note" defaultValue={transaction?.note ?? ""} placeholder="Optional note" /></div>{state.fieldErrors?.subcategoryId && <p className="text-xs text-destructive">{state.fieldErrors.subcategoryId[0]}</p>}{state.message && <p className="text-xs text-destructive">{state.message}</p>}
            </div><DialogFooter className="border-t border-[#30465D] bg-[#0E1925] p-4 sm:p-5"><Button type="button" variant="outline" onClick={() => { resetCreateForm(); setOpen(false); }} disabled={isPending}>Cancel</Button><Button type="submit" disabled={isPending}>{isPending ? "Saving..." : mode === "create" ? "Create Transaction" : "Save Changes"}</Button></DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
