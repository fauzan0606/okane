"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import Card from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveParsedTransactionAction } from "../actions";
import type { ParsedTransaction, ParserSubcategory } from "../types";

type Option = { id: string; name: string; walletType?: "CASH" | "BANK_ACCOUNT" | "CREDIT_CARD" | "DEBIT_CARD" | "E_WALLET" | "FOREIGN_CASH" | "INVESTMENT" };
type EditablePreviewProps = {
  result: ParsedTransaction;
  wallets: Option[];
  categories: Option[];
  subcategories: ParserSubcategory[];
  onSaved: () => void;
};
const fieldClassName = "border-white/10 bg-[#0E151E] text-white placeholder:text-slate-500 focus-visible:border-white/20 focus-visible:ring-white/10";

export default function EditablePreview({ result, wallets, categories, subcategories, onSaved }: EditablePreviewProps) {
  const [parsed, setParsed] = useState(result);
  const [isPending, startTransition] = useTransition();
  const [installmentEnabled, setInstallmentEnabled] = useState(false);
  const [installmentTenor, setInstallmentTenor] = useState("6");
  const [installmentStartDate, setInstallmentStartDate] = useState(result.transactionDate);
  const [installmentFee, setInstallmentFee] = useState("0");
  const [tipsEnabled, setTipsEnabled] = useState(false);
  const [tipsAmount, setTipsAmount] = useState("");
  const selectedWallet = wallets.find((wallet) => wallet.id === parsed.wallet?.id);
  const canInstallment = selectedWallet?.walletType === "CREDIT_CARD" && parsed.type === "EXPENSE";
  const fee = Number(installmentFee || 0);
  const tenor = Number(installmentTenor || 0);
  const principal = Number(parsed.amount || 0);
  const monthlyAmount = tenor > 1 ? (principal + fee) / tenor : 0;
  const visibleSubcategories = subcategories.filter((item) => item.categoryId === parsed.category?.id);

  function updateWallet(walletId: string | null) {
    const wallet = wallets.find((item) => item.id === walletId);
    setParsed((current) => ({ ...current, wallet: wallet ? { ...wallet, score: current.wallet?.score ?? 0 } : undefined }));
    if (wallet?.walletType !== "CREDIT_CARD") setInstallmentEnabled(false);
  }

  function updateCategory(categoryId: string | null) {
    const category = categories.find((item) => item.id === categoryId);
    setParsed((current) => ({ ...current, category, subcategory: undefined }));
  }

  function updateSubcategory(subcategoryId: string | null) {
    const subcategory = visibleSubcategories.find((item) => item.id === subcategoryId);
    setParsed((current) => ({ ...current, subcategory }));
  }

  function handleSave() {
    startTransition(async () => {
      try {
        const result = await saveParsedTransactionAction({
          ...parsed,
          tipsEnabled: parsed.type === "EXPENSE" && tipsEnabled,
          tipsAmount: tipsEnabled ? Number(tipsAmount) : undefined,
          installment: canInstallment && installmentEnabled
            ? { enabled: true, tenorMonths: Number(installmentTenor), startDate: installmentStartDate, feeAmount: fee }
            : { enabled: false },
        });
        if (!result.success) throw new Error(result.message);
        alert("Transaction saved successfully.");
        onSaved();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to save transaction.");
      }
    });
  }

  return (
    <Card className="border-white/10 bg-[#182335] shadow-xl">
      <div className="space-y-6 text-white">
        <div>
          <p className="text-sm font-medium text-blue-300">REVIEW & EDIT</p>
          <h2 className="mt-1 text-2xl font-semibold">Transaction Preview</h2>
          <p className="mt-1 text-sm text-slate-400">Periksa dan sesuaikan detail sebelum menyimpan.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="transaction-date" className="text-slate-200">Date</Label><Input id="transaction-date" className={fieldClassName} type="date" value={parsed.transactionDate} onChange={(event) => setParsed((current) => ({ ...current, transactionDate: event.target.value }))} /></div>
          {parsed.type === "EXPENSE" && <div className="space-y-1.5"><Label htmlFor="merchant" className="text-slate-200">Merchant</Label><Input id="merchant" className={fieldClassName} value={parsed.merchant ?? ""} onChange={(event) => setParsed((current) => ({ ...current, merchant: event.target.value.trim() || undefined }))} placeholder="Nama merchant" /></div>}
          <div className="space-y-1.5"><Label htmlFor="amount" className="text-slate-200">Amount</Label><Input id="amount" className={fieldClassName} type="number" min="1" step="1" value={parsed.amount ?? ""} onChange={(event) => { const value = event.target.valueAsNumber; setParsed((current) => ({ ...current, amount: Number.isFinite(value) ? value : undefined })); }} placeholder="0" /></div>
          <div className="space-y-1.5"><Label htmlFor="type" className="text-slate-200">Type</Label><Select value={parsed.type} onValueChange={(value) => { if (value === "INCOME" || value === "EXPENSE") setParsed((current) => ({ ...current, type: value, merchant: value === "INCOME" ? undefined : current.merchant, reimbursementEnabled: value === "EXPENSE" ? current.reimbursementEnabled : false }));
                  if (value === "INCOME") { setInstallmentEnabled(false); setTipsEnabled(false); } }}><SelectTrigger id="type" className={`w-full ${fieldClassName}`}><SelectValue /></SelectTrigger><SelectContent className="border-white/10 bg-[#182335] text-white"><SelectItem value="EXPENSE">Expense</SelectItem><SelectItem value="INCOME">Income</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="wallet" className="text-slate-200">Wallet</Label><Select value={parsed.wallet?.id ?? null} onValueChange={updateWallet}><SelectTrigger id="wallet" className={`w-full ${fieldClassName}`}><SelectValue placeholder="Pilih wallet">{(walletId: string | null) => wallets.find((wallet) => wallet.id === walletId)?.name ?? "Pilih wallet"}</SelectValue></SelectTrigger><SelectContent className="border-white/10 bg-[#182335] text-white">{wallets.map((wallet) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="category" className="text-slate-200">Category</Label><Select value={parsed.category?.id ?? null} onValueChange={updateCategory}><SelectTrigger id="category" className={`w-full ${fieldClassName}`}><SelectValue placeholder="Pilih category">{(categoryId: string | null) => categories.find((category) => category.id === categoryId)?.name ?? "Pilih category"}</SelectValue></SelectTrigger><SelectContent className="border-white/10 bg-[#182335] text-white">{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="subcategory" className="text-slate-200">Subcategory</Label><Select value={parsed.subcategory?.id ?? null} onValueChange={updateSubcategory} disabled={!parsed.category}><SelectTrigger id="subcategory" className={`w-full ${fieldClassName}`}><SelectValue placeholder={parsed.category ? "Pilih subcategory" : "Pilih category dulu"}>{(subcategoryId: string | null) => visibleSubcategories.find((item) => item.id === subcategoryId)?.name ?? "Pilih subcategory"}</SelectValue></SelectTrigger><SelectContent className="border-white/10 bg-[#182335] text-white">{visibleSubcategories.map((subcategory) => <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</SelectItem>)}</SelectContent></Select></div>
        </div>

        {parsed.type === "EXPENSE" && (
          <div className="rounded-2xl border border-white/10 bg-[#0E151E] p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={tipsEnabled}
                onChange={(event) => setTipsEnabled(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-emerald-500"
              />
              <span>
                <span className="block text-sm font-semibold text-white">Tambahkan tips</span>
                <span className="mt-0.5 block text-xs text-slate-500">Tips akan dicatat sebagai transaksi pengeluaran terpisah.</span>
              </span>
            </label>
            {tipsEnabled && (
              <div className="mt-4 space-y-1.5">
                <Label htmlFor="tips-amount" className="text-slate-200">Jumlah tips</Label>
                <Input id="tips-amount" className={fieldClassName} type="number" min="0.01" step="0.01" value={tipsAmount} onChange={(event) => setTipsAmount(event.target.value)} placeholder="10000" required />
              </div>
            )}
          </div>
        )}

        {parsed.type === "EXPENSE" && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={Boolean(parsed.reimbursementEnabled)}
                onChange={(event) => setParsed((current) => ({ ...current, reimbursementEnabled: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-emerald-500"
              />
              <span>
                <span className="block text-sm font-semibold text-white">Akan direimburse</span>
                <span className="mt-0.5 block text-xs text-slate-500">Tandai jika pengeluaran ini dibayar dulu menggunakan uang pribadi dan akan diganti oleh kantor/orang lain.</span>
              </span>
            </label>
          </div>
        )}

        {canInstallment && (
          <div className="rounded-2xl border border-white/10 bg-[#0E151E] p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={installmentEnabled}
                onChange={(event) => setInstallmentEnabled(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent accent-emerald-500"
              />
              <span>
                <span className="block text-sm font-semibold text-white">Installment</span>
                <span className="mt-0.5 block text-xs text-slate-500">Create a recurring credit-card installment plan. Off by default.</span>
              </span>
            </label>
            {installmentEnabled && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="installment-tenor" className="text-slate-200">Tenor (months)</Label><Input id="installment-tenor" className={fieldClassName} type="number" min="2" max="120" value={installmentTenor} onChange={(event) => setInstallmentTenor(event.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="installment-start-date" className="text-slate-200">Start date</Label><Input id="installment-start-date" className={fieldClassName} type="date" value={installmentStartDate} onChange={(event) => setInstallmentStartDate(event.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="installment-fee" className="text-slate-200">Interest / Fee (optional)</Label><Input id="installment-fee" className={fieldClassName} type="number" min="0" step="0.01" value={installmentFee} onChange={(event) => setInstallmentFee(event.target.value)} /></div>
                <div className="rounded-xl border border-white/10 bg-black/10 px-3 py-2"><p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Estimated monthly</p><p className="mt-1 text-sm font-semibold text-emerald-300">Rp{monthlyAmount.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</p><p className="mt-0.5 text-[10px] text-slate-600">Total includes optional fee.</p></div>
              </div>
            )}
          </div>
        )}

        <Button className="w-full bg-blue-600 text-white hover:bg-blue-500" onClick={handleSave} disabled={isPending}>{isPending ? "Saving..." : "Save Transaction"}</Button>
      </div>
    </Card>
  );
}
