"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import Card from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { saveParsedTransactionAction } from "../actions";
import type { ParsedTransaction, ParserSubcategory } from "../types";

type Option = { id: string; name: string };
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
  const visibleSubcategories = subcategories.filter((item) => item.categoryId === parsed.category?.id);

  function updateWallet(walletId: string | null) {
    const wallet = wallets.find((item) => item.id === walletId);
    setParsed((current) => ({ ...current, wallet: wallet ? { ...wallet, score: current.wallet?.score ?? 0 } : undefined }));
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
        await saveParsedTransactionAction(parsed);
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
          <div className="space-y-1.5"><Label htmlFor="merchant" className="text-slate-200">Merchant</Label><Input id="merchant" className={fieldClassName} value={parsed.merchant ?? ""} onChange={(event) => setParsed((current) => ({ ...current, merchant: event.target.value.trim() || undefined }))} placeholder="Nama merchant" /></div>
          <div className="space-y-1.5"><Label htmlFor="amount" className="text-slate-200">Amount</Label><Input id="amount" className={fieldClassName} type="number" min="1" step="1" value={parsed.amount ?? ""} onChange={(event) => { const value = event.target.valueAsNumber; setParsed((current) => ({ ...current, amount: Number.isFinite(value) ? value : undefined })); }} placeholder="0" /></div>
          <div className="space-y-1.5"><Label htmlFor="type" className="text-slate-200">Type</Label><Select value={parsed.type} onValueChange={(value) => { if (value === "INCOME" || value === "EXPENSE") setParsed((current) => ({ ...current, type: value })); }}><SelectTrigger id="type" className={`w-full ${fieldClassName}`}><SelectValue /></SelectTrigger><SelectContent className="border-white/10 bg-[#182335] text-white"><SelectItem value="EXPENSE">Expense</SelectItem><SelectItem value="INCOME">Income</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="wallet" className="text-slate-200">Wallet</Label><Select value={parsed.wallet?.id ?? null} onValueChange={updateWallet}><SelectTrigger id="wallet" className={`w-full ${fieldClassName}`}><SelectValue placeholder="Pilih wallet">{(walletId: string | null) => wallets.find((wallet) => wallet.id === walletId)?.name ?? "Pilih wallet"}</SelectValue></SelectTrigger><SelectContent className="border-white/10 bg-[#182335] text-white">{wallets.map((wallet) => <SelectItem key={wallet.id} value={wallet.id}>{wallet.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="category" className="text-slate-200">Category</Label><Select value={parsed.category?.id ?? null} onValueChange={updateCategory}><SelectTrigger id="category" className={`w-full ${fieldClassName}`}><SelectValue placeholder="Pilih category">{(categoryId: string | null) => categories.find((category) => category.id === categoryId)?.name ?? "Pilih category"}</SelectValue></SelectTrigger><SelectContent className="border-white/10 bg-[#182335] text-white">{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1.5"><Label htmlFor="subcategory" className="text-slate-200">Subcategory</Label><Select value={parsed.subcategory?.id ?? null} onValueChange={updateSubcategory} disabled={!parsed.category}><SelectTrigger id="subcategory" className={`w-full ${fieldClassName}`}><SelectValue placeholder={parsed.category ? "Pilih subcategory" : "Pilih category dulu"}>{(subcategoryId: string | null) => visibleSubcategories.find((item) => item.id === subcategoryId)?.name ?? "Pilih subcategory"}</SelectValue></SelectTrigger><SelectContent className="border-white/10 bg-[#182335] text-white">{visibleSubcategories.map((subcategory) => <SelectItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</SelectItem>)}</SelectContent></Select></div>
        </div>

        <Button className="w-full bg-blue-600 text-white hover:bg-blue-500" onClick={handleSave} disabled={isPending}>{isPending ? "Saving..." : "Save Transaction"}</Button>
      </div>
    </Card>
  );
}
