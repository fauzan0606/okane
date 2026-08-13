"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, FileUp, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Wallet = { id: string; name: string; walletType: string };
type Category = { id: string; name: string; type: "INCOME" | "EXPENSE"; icon?: string | null; color?: string | null };
type Subcategory = { id: string; categoryId: string; name: string };

type ImportedTransaction = {
  sourceIndex: number;
  sourceRowNumber?: number;
  date: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
  merchant: string;
  note: string;
  walletHint: string;
  sourceCategory?: string;
  suggestedWalletId?: string;
  suggestedWalletName?: string;
  suggestedCategoryId?: string;
  suggestedCategoryName?: string;
  suggestedSubcategoryId?: string;
  suggestedSubcategoryName?: string;
  suggestionLevel: "HIGH" | "MEDIUM" | "LOW";
  suggestionReason: string;
};

type Props = {
  wallets: Wallet[];
  categories: Category[];
  subcategories: Subcategory[];
};

type EditableTransaction = ImportedTransaction & {
  walletId: string;
  categoryId: string;
  subcategoryId: string;
  selected: boolean;
};

function money(value: number) {
  return `Rp${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`;
}

function normalizeDescription(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export default function TransactionImport({ wallets, categories, subcategories }: Props) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<EditableTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [showIncompletePrompt, setShowIncompletePrompt] = useState(false);
  const [sourceFormat, setSourceFormat] = useState("");

  const selectedRows = useMemo(() => rows.filter((row) => row.selected), [rows]);
  const requiredIssues = rows.filter((row) => !row.date || !row.merchant || !row.walletId || !(row.amount > 0)).length;
  const categoryIssues = rows.filter((row) => !row.categoryId || (row.subcategoryId && !subcategories.some((subcategory) => subcategory.id === row.subcategoryId && subcategory.categoryId === row.categoryId))).length;
  const incompleteRows = useMemo(() => rows.filter((row) => !row.date || !row.merchant || !(row.amount > 0)), [rows]);
  const duplicateCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = normalizeDescription(row.merchant);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [rows]);

  function updateRow(sourceIndex: number, patch: Partial<EditableTransaction>) {
    setRows((current) => current.map((row) => row.sourceIndex === sourceIndex ? { ...row, ...patch } : row));
  }

  function updateCategory(sourceIndex: number, categoryId: string) {
    updateRow(sourceIndex, { categoryId, subcategoryId: "" });
  }

  function applyCategoryToSameDescription(sourceIndex: number) {
    const target = rows.find((row) => row.sourceIndex === sourceIndex);
    if (!target) return;
    const key = normalizeDescription(target.merchant);
    if (!key) return;
    setRows((current) => current.map((row) => normalizeDescription(row.merchant) === key
      ? { ...row, categoryId: target.categoryId, subcategoryId: target.subcategoryId }
      : row));
    toast.success(`Applied mapping to ${duplicateCounts.get(key) ?? 1} transactions with "${target.merchant}".`);
  }

  function resetImportState() {
    setRows([]);
    setFileName("");
    setError("");
    setSourceFormat("");
    setShowIncompletePrompt(false);
  }

  async function scan(file: File) {
    setLoading(true); setError(""); resetImportState(); setFileName(file.name);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/ocr/transactions", { method: "POST", body });
      const data = await response.json() as { error?: string; sourceFormat?: string; transactions?: ImportedTransaction[] };
      if (!response.ok) throw new Error(data.error || "Could not read the transaction file.");
      const imported = (data.transactions ?? []).map((row) => ({
        ...row,
        walletId: row.suggestedWalletId ?? "",
        categoryId: row.suggestedCategoryId ?? "",
        subcategoryId: row.suggestedSubcategoryId ?? "",
        selected: true,
      }));
      setSourceFormat(data.sourceFormat ?? "");
      setRows(imported);
      if (imported.length === 0) setError("No transaction rows were detected in this file.");
      else if (imported.some((row) => !row.date || !row.merchant || !(row.amount > 0))) setShowIncompletePrompt(true);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Could not read the transaction file.");
    } finally {
      setLoading(false);
    }
  }

  function deleteIncompleteRows() {
    setRows((current) => current.filter((row) => row.date && row.merchant && row.amount > 0));
    setShowIncompletePrompt(false);
    toast.success(`Removed ${incompleteRows.length} incomplete transaction${incompleteRows.length === 1 ? "" : "s"} from the import.`);
  }

  async function importRows() {
    if (selectedRows.length === 0) { toast.error("Select at least one transaction to import."); return; }
    if (requiredIssues > 0) { toast.error("Complete the required fields before importing."); return; }
    setImporting(true); setError("");
    try {
      const response = await fetch("/api/transactions/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transactions: selectedRows.map((row) => ({ date: row.date, type: row.type, amount: row.amount, merchant: row.merchant, note: row.note, walletId: row.walletId, categoryId: row.categoryId, subcategoryId: row.subcategoryId })) }) });
      const data = await response.json() as { error?: string; imported?: number; failed?: number };
      if (!response.ok) throw new Error(data.error || "Transaction import failed.");
      if ((data.failed ?? 0) > 0) toast.error(`${data.imported ?? 0} imported, ${data.failed} failed. Check the transaction list and retry failed rows.`);
      else toast.success(`${data.imported ?? 0} transactions imported successfully.`);
      resetImportState(); setOpen(false); window.location.reload();
    } catch (importError) {
      toast.error(importError instanceof Error ? importError.message : "Transaction import failed.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !loading && !importing) resetImportState(); setOpen(isOpen); }}>
      <DialogTrigger render={<Button variant="outline" size="lg"><Upload size={16} /> Import File</Button>} />
      <DialogContent showCloseButton className="!w-[calc(100vw-1.5rem)] !max-w-[1180px] max-h-[92vh] overflow-y-auto rounded-[26px] border border-[#30465D] bg-[#0E1925] p-0 text-white">
        <div className="p-5 sm:p-7">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-white sm:text-2xl">Import Transactions</DialogTitle>
            <DialogDescription className="mt-1.5 text-xs leading-5 text-slate-500 sm:text-sm">Upload an Excel workbook, image, PDF, CSV or TXT file. Excel files are read directly; OKANE reviews the rows and recommendations before anything is written to the database.</DialogDescription>
          </DialogHeader>

          <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#405A74] bg-[#0A1119] px-5 py-6 text-sm font-semibold text-slate-300 hover:border-emerald-400/40">
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*,.pdf,.csv,.txt,text/csv,application/pdf" className="hidden" disabled={loading || importing} onChange={(event) => { const file = event.target.files?.[0]; if (file) void scan(file); }} />
            {loading ? <LoaderCircle size={18} className="animate-spin" /> : <FileUp size={18} />}
            {loading ? "Reading file…" : "Choose transaction file"}
          </label>
          {fileName && <p className="mt-2 text-xs text-slate-500">{fileName}{sourceFormat ? ` · ${sourceFormat}` : ""}</p>}
          {error && <p className="mt-3 rounded-xl border border-red-400/10 bg-red-400/[0.04] p-3 text-xs text-red-300">{error}</p>}

          {rows.length > 0 && <>
            <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-amber-100">Review before saving</p><p className="mt-1 text-xs text-amber-200/70">Detected {rows.length} transaction{rows.length === 1 ? "" : "s"}. Nothing is saved yet.</p></div><div className="flex flex-wrap gap-2 text-[10px] font-semibold"><span className="rounded-full border border-white/10 bg-[#0A1119] px-2.5 py-1 text-slate-300">Selected {selectedRows.length}</span>{requiredIssues > 0 && <span className="rounded-full border border-red-400/15 bg-red-400/10 px-2.5 py-1 text-red-300">Required review {requiredIssues}</span>}{categoryIssues > 0 && <span className="rounded-full border border-amber-400/15 bg-amber-400/10 px-2.5 py-1 text-amber-200">Category review {categoryIssues}</span>}</div></div>
            </div>

            {showIncompletePrompt && incompleteRows.length > 0 && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-4">
              <p className="text-sm font-semibold text-red-100">Incomplete transactions detected</p>
              <p className="mt-1 text-xs leading-5 text-red-200/70">{incompleteRows.length} transaction{incompleteRows.length === 1 ? " is" : "s are"} missing a date, description, or amount. Do you want OKANE to remove these rows from the import?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setShowIncompletePrompt(false)}>Keep and review</Button>
                <Button type="button" onClick={deleteIncompleteRows}>Delete {incompleteRows.length} incomplete row{incompleteRows.length === 1 ? "" : "s"}</Button>
              </div>
            </div>}

            <div className="mt-4 space-y-3">
              {rows.map((row) => {
                const visibleCategories = categories.filter((category) => category.type === row.type);
                const visibleSubcategories = subcategories.filter((subcategory) => subcategory.categoryId === row.categoryId);
                const categoryChanged = Boolean(row.suggestedCategoryId && row.categoryId && row.categoryId !== row.suggestedCategoryId);
                const subcategoryChanged = Boolean(row.suggestedSubcategoryId && row.subcategoryId && row.subcategoryId !== row.suggestedSubcategoryId);
                const requiredMissing = !row.date || !row.merchant || !row.walletId || !(row.amount > 0);
                const sameDescriptionCount = duplicateCounts.get(normalizeDescription(row.merchant)) ?? 0;

                return <div key={row.sourceIndex} className={`rounded-2xl border bg-[#101B28] p-4 ${requiredMissing ? "border-red-400/20" : categoryChanged || subcategoryChanged ? "border-amber-400/15" : "border-white/5"}`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <label className="flex items-start gap-3"><input type="checkbox" checked={row.selected} onChange={(event) => updateRow(row.sourceIndex, { selected: event.target.checked })} className="mt-1 h-4 w-4 accent-emerald-500" /><div><p className="text-sm font-semibold text-white">#{row.sourceIndex} · {row.merchant || "Unnamed transaction"}</p><p className="mt-1 text-[10px] text-slate-500">{row.type} · {money(row.amount || 0)}{row.sourceRowNumber ? ` · Excel row ${row.sourceRowNumber}` : ""}{row.suggestionLevel ? ` · ${row.suggestionLevel} suggestion` : ""}</p>{row.sourceCategory && <p className="mt-1 text-[10px] text-slate-500">Source category: {row.sourceCategory}</p>}</div></label>
                    <div className="text-left lg:text-right"><p className="text-[10px] uppercase tracking-[0.1em] text-slate-600">OKANE recommendation</p><p className="mt-1 text-xs text-emerald-300">{row.suggestedCategoryName ?? "No category"}{row.suggestedSubcategoryName ? ` · ${row.suggestedSubcategoryName}` : ""}</p><p className="mt-1 text-[10px] text-slate-500">{row.suggestionReason}</p></div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Date</span><input type="date" value={row.date} onChange={(event) => updateRow(row.sourceIndex, { date: event.target.value })} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none" /></label>
                    <label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Merchant</span><input value={row.merchant} onChange={(event) => updateRow(row.sourceIndex, { merchant: event.target.value })} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none" /></label>
                    <label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Amount</span><input type="number" min="0" step="0.01" value={row.amount || ""} onChange={(event) => updateRow(row.sourceIndex, { amount: Number(event.target.value) })} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none" /></label>
                    <label className={`block ${!row.walletId ? "rounded-xl border border-red-400/20 p-2" : ""}`}><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Wallet</span><select value={row.walletId} onChange={(event) => updateRow(row.sourceIndex, { walletId: event.target.value })} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none"><option value="">Select wallet</option>{wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name}</option>)}</select></label>
                    <label className={`block ${!row.categoryId || categoryChanged ? "rounded-xl border border-amber-400/20 p-2" : ""}`}><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Category</span><select value={row.categoryId} onChange={(event) => updateCategory(row.sourceIndex, event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none"><option value="">Select category</option>{visibleCategories.map((category) => <option key={category.id} value={category.id}>{category.icon ? `${category.icon} ` : ""}{category.name}</option>)}</select></label>
                  </div>

                  <div className="mt-3 grid gap-3 md:grid-cols-2"><label className={`block ${subcategoryChanged ? "rounded-xl border border-amber-400/20 p-2" : ""}`}><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Subcategory</span><select value={row.subcategoryId} onChange={(event) => updateRow(row.sourceIndex, { subcategoryId: event.target.value })} disabled={!row.categoryId} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none"><option value="">{row.categoryId ? "Select subcategory" : "Select category first"}</option>{visibleSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Note</span><input value={row.note} onChange={(event) => updateRow(row.sourceIndex, { note: event.target.value })} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none" /></label></div>

                  {sameDescriptionCount > 1 && row.categoryId && <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]"><button type="button" onClick={() => applyCategoryToSameDescription(row.sourceIndex)} className="rounded-lg border border-cyan-400/15 bg-cyan-400/[0.04] px-3 py-1.5 font-semibold text-cyan-200 hover:bg-cyan-400/[0.08]">Apply category + subcategory to all {sameDescriptionCount} "{row.merchant}"</button><span className="text-slate-600">Same description is mapped together.</span></div>}

                  {(categoryChanged || subcategoryChanged || !row.categoryId) && <p className="mt-3 rounded-lg border border-amber-400/10 bg-amber-400/[0.03] px-3 py-2 text-[10px] text-amber-200">Review category mapping before importing. OKANE's recommendation is a suggestion based on merchant/category patterns and can be changed.</p>}
                </div>;
              })}
            </div>
          </>}

          <DialogFooter className="mt-5 border-t border-white/5 pt-5">
            <Button type="button" variant="outline" onClick={() => { resetImportState(); setOpen(false); }} disabled={loading || importing}>Cancel</Button>
            <Button type="button" onClick={importRows} disabled={loading || importing || rows.length === 0 || requiredIssues > 0}><Check size={15} />{importing ? "Importing…" : `Review complete · Import ${selectedRows.length}`}</Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
