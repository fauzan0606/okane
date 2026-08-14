"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, FileUp, LoaderCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Wallet = { id: string; name: string; walletType: string };
type Category = { id: string; name: string; type: "INCOME" | "EXPENSE"; icon?: string | null; color?: string | null };
type Subcategory = { id: string; categoryId: string; name: string };
type ImportedTransaction = { sourceIndex: number; sourceRowNumber?: number; date: string; type: "INCOME" | "EXPENSE"; amount: number; merchant: string; note: string; walletHint: string; sourceCategory?: string; suggestedWalletId?: string; suggestedWalletName?: string; suggestedCategoryId?: string; suggestedCategoryName?: string; suggestedSubcategoryId?: string; suggestedSubcategoryName?: string; suggestionLevel: "HIGH" | "MEDIUM" | "LOW"; suggestionReason: string };
type EditableTransaction = ImportedTransaction & { walletId: string; categoryId: string; subcategoryId: string; selected: boolean };
type ReviewFilter = "ALL" | "REQUIRED" | "CATEGORY";
type Props = { wallets: Wallet[]; categories: Category[]; subcategories: Subcategory[] };

function money(value: number) { return `Rp${value.toLocaleString("id-ID", { maximumFractionDigits: 0 })}`; }
function normalizeDescription(value: string) { return value.trim().toLowerCase().replace(/\s+/g, " "); }
function hasRequiredIssue(row: EditableTransaction) { return !row.date || !row.merchant || !(row.amount > 0); }
function hasCategoryIssue(row: EditableTransaction, rows: EditableTransaction[], subcategories: Subcategory[]) {
  if (!row.categoryId || !row.subcategoryId) return true;
  const validSubcategory = subcategories.some((s) => String(s.id) === String(row.subcategoryId) && String(s.categoryId) === String(row.categoryId));
  if (!validSubcategory) return true;

  const key = normalizeDescription(row.merchant);
  if (!key) return false;
  const sameDescription = rows.filter((candidate) => normalizeDescription(candidate.merchant) === key);
  if (sameDescription.length <= 1) return false;
  return sameDescription.some((candidate) => String(candidate.categoryId) !== String(row.categoryId) || String(candidate.subcategoryId) !== String(row.subcategoryId));
}

export default function TransactionImport({ wallets, categories, subcategories }: Props) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<EditableTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [error, setError] = useState("");
  const [showIncompletePrompt, setShowIncompletePrompt] = useState(false);
  const [sourceFormat, setSourceFormat] = useState("");
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("ALL");

  const selectedRows = useMemo(() => rows.filter((r) => r.selected), [rows]);
  const requiredIssues = useMemo(() => rows.filter(hasRequiredIssue).length, [rows]);
  const categoryIssues = useMemo(() => rows.filter((r) => hasCategoryIssue(r, rows, subcategories)).length, [rows, subcategories]);
  const incompleteRows = useMemo(() => rows.filter(hasRequiredIssue), [rows]);
  const duplicateCounts = useMemo(() => { const m = new Map<string, number>(); for (const r of rows) { const k = normalizeDescription(r.merchant); if (k) m.set(k, (m.get(k) ?? 0) + 1); } return m; }, [rows]);
  const visibleRows = useMemo(() => reviewFilter === "REQUIRED" ? rows.filter(hasRequiredIssue) : reviewFilter === "CATEGORY" ? rows.filter((r) => hasCategoryIssue(r, rows, subcategories)) : rows, [reviewFilter, rows, subcategories]);
  const filterLabel = reviewFilter === "REQUIRED" ? "Required review" : reviewFilter === "CATEGORY" ? "Category review" : "All transactions";

  function changeReviewFilter(filter: ReviewFilter) {
    setReviewFilter(filter);
    window.requestAnimationFrame(() => document.getElementById("transaction-import-review-list")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function updateRow(sourceIndex: number, patch: Partial<EditableTransaction>) {
    setRows((current) => current.map((row) => row.sourceIndex === sourceIndex ? { ...row, ...patch } : row));
  }
  function updateWallet(sourceIndex: number, walletId: string) {
    const nextWalletId = String(walletId ?? "");
    setRows((current) => current.map((row) => row.sourceIndex === sourceIndex ? { ...row, walletId: nextWalletId } : row));
  }
  function updateCategory(sourceIndex: number, categoryId: string) {
    const nextCategoryId = String(categoryId ?? "");
    setRows((current) => current.map((row) => row.sourceIndex === sourceIndex ? { ...row, categoryId: nextCategoryId, subcategoryId: "" } : row));
  }
  function applyCategoryToSameDescription(sourceIndex: number) {
    const target = rows.find((r) => r.sourceIndex === sourceIndex); if (!target) return;
    const key = normalizeDescription(target.merchant); if (!key || !target.categoryId || !target.subcategoryId) return;
    setRows((current) => current.map((r) => normalizeDescription(r.merchant) === key ? { ...r, categoryId: target.categoryId, subcategoryId: target.subcategoryId } : r));
    toast.success(`Applied mapping to ${duplicateCounts.get(key) ?? 1} transactions with "${target.merchant}".`);
  }
  function resetImportState() { setRows([]); setFileName(""); setError(""); setSourceFormat(""); setShowIncompletePrompt(false); setReviewFilter("ALL"); setImportProgress(0); }

  async function scan(file: File) {
    setLoading(true); setError(""); resetImportState(); setFileName(file.name);
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch("/api/ocr/transactions", { method: "POST", body });
      const data = await response.json() as { error?: string; sourceFormat?: string; transactions?: ImportedTransaction[] };
      if (!response.ok) throw new Error(data.error || "Could not read the transaction file.");
      const imported = (data.transactions ?? []).map((r) => ({ ...r, walletId: r.suggestedWalletId ? String(r.suggestedWalletId) : "", categoryId: r.suggestedCategoryId ? String(r.suggestedCategoryId) : "", subcategoryId: r.suggestedSubcategoryId ? String(r.suggestedSubcategoryId) : "", selected: true }));
      setSourceFormat(data.sourceFormat ?? ""); setRows(imported);
      if (imported.length === 0) setError("No transaction rows were detected in this file.");
      else if (imported.some(hasRequiredIssue)) setShowIncompletePrompt(true);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read the transaction file."); }
    finally { setLoading(false); }
  }
  function deleteIncompleteRows() {
    setRows((current) => current.filter((r) => !hasRequiredIssue(r)));
    setShowIncompletePrompt(false);
    if (reviewFilter === "REQUIRED") setReviewFilter("ALL");
    toast.success(`Removed ${incompleteRows.length} incomplete transaction${incompleteRows.length === 1 ? "" : "s"} from the import.`);
  }
  async function importRows() {
    if (selectedRows.length === 0) { toast.error("Select at least one transaction to import."); return; }
    if (requiredIssues > 0) { toast.error("Complete the required date, description, and amount fields before importing."); return; }
    setImporting(true); setError(""); setImportProgress(0);
    const batchSize = 100;
    let importedCount = 0;
    let failedCount = 0;
    const successfulIndexes = new Set<number>();

    try {
      for (let start = 0; start < selectedRows.length; start += batchSize) {
        const batch = selectedRows.slice(start, start + batchSize);
        const response = await fetch("/api/transactions/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: batch.map((r) => ({ date: r.date, type: r.type, amount: r.amount, merchant: r.merchant, note: r.note, walletId: r.walletId, categoryId: r.categoryId, subcategoryId: r.subcategoryId })) }),
        });
        const data = await response.json() as { error?: string; imported?: number; failed?: number; results?: { index: number; success: boolean }[] };
        if (!response.ok) throw new Error(data.error || "Transaction import failed.");

        importedCount += data.imported ?? 0;
        failedCount += data.failed ?? 0;
        for (const result of data.results ?? []) if (result.success) successfulIndexes.add(start + result.index);
        setImportProgress(Math.min(100, Math.round(((start + batch.length) / selectedRows.length) * 100)));
      }

      setRows((current) => current.map((row) => {
        const position = selectedRows.findIndex((selected) => selected.sourceIndex === row.sourceIndex);
        return position >= 0 && successfulIndexes.has(position) ? { ...row, selected: false } : row;
      }));

      if (failedCount > 0) {
        toast.error(`${importedCount} imported, ${failedCount} failed. Failed rows remain selected for correction and retry.`);
        return;
      }

      toast.success(`${importedCount} transactions imported successfully.`);
      resetImportState(); setOpen(false); window.location.reload();
    } catch (e) {
      setRows((current) => current.map((row) => {
        const position = selectedRows.findIndex((selected) => selected.sourceIndex === row.sourceIndex);
        return position >= 0 && successfulIndexes.has(position) ? { ...row, selected: false } : row;
      }));
      toast.error(e instanceof Error ? e.message : "Transaction import failed.");
    } finally { setImporting(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen && !loading && !importing) resetImportState(); setOpen(isOpen); }}>
      <DialogTrigger render={<Button variant="outline" size="lg"><Upload size={16} /> Import File</Button>} />
      <DialogContent showCloseButton className="!w-[calc(100vw-1.5rem)] !max-w-[1180px] max-h-[92vh] overflow-y-auto rounded-[26px] border border-[#30465D] bg-[#0E1925] p-0 text-white">
        <div className="p-5 sm:p-7">
          <DialogHeader><DialogTitle className="text-xl font-semibold text-white sm:text-2xl">Import Transactions</DialogTitle><DialogDescription className="mt-1.5 text-xs leading-5 text-slate-500 sm:text-sm">Upload an Excel workbook, image, PDF, CSV or TXT file. Excel files are read directly; OKANE reviews the rows and recommendations before anything is written to the database.</DialogDescription></DialogHeader>
          <label className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-dashed border-[#405A74] bg-[#0A1119] px-5 py-6 text-sm font-semibold text-slate-300 hover:border-emerald-400/40"><input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/*,.pdf,.csv,.txt,text/csv,application/pdf" className="hidden" disabled={loading || importing} onChange={(e) => { const file = e.target.files?.[0]; if (file) void scan(file); }} />{loading ? <LoaderCircle size={18} className="animate-spin" /> : <FileUp size={18} />}{loading ? "Reading file…" : "Choose transaction file"}</label>
          {fileName && <p className="mt-2 text-xs text-slate-500">{fileName}{sourceFormat ? ` · ${sourceFormat}` : ""}</p>}
          {error && <p className="mt-3 rounded-xl border border-red-400/10 bg-red-400/[0.04] p-3 text-xs text-red-300">{error}</p>}
          {rows.length > 0 && <>
            <div className="mt-5 rounded-2xl border border-amber-400/15 bg-amber-400/[0.04] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-amber-100">Review before saving</p><p className="mt-1 text-xs text-amber-200/70">Detected {rows.length} transactions. Nothing is saved yet.</p></div><div className="flex flex-wrap gap-2 text-[10px] font-semibold"><button type="button" onClick={() => changeReviewFilter("ALL")} className={`rounded-full border px-2.5 py-1 ${reviewFilter === "ALL" ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-white/10 bg-[#0A1119] text-slate-300 hover:bg-white/[0.05]"}`}>All {rows.length}</button><button type="button" onClick={() => changeReviewFilter("REQUIRED")} disabled={requiredIssues === 0} className={`rounded-full border px-2.5 py-1 ${reviewFilter === "REQUIRED" ? "border-red-400/30 bg-red-400/15 text-red-200" : requiredIssues > 0 ? "border-red-400/15 bg-red-400/10 text-red-300 hover:bg-red-400/15" : "cursor-not-allowed border-white/10 bg-[#0A1119] text-slate-600"}`}>Required review {requiredIssues}</button><button type="button" onClick={() => changeReviewFilter("CATEGORY")} disabled={categoryIssues === 0} className={`rounded-full border px-2.5 py-1 ${reviewFilter === "CATEGORY" ? "border-amber-400/30 bg-amber-400/15 text-amber-100" : categoryIssues > 0 ? "border-amber-400/15 bg-amber-400/10 text-amber-200 hover:bg-amber-400/15" : "cursor-not-allowed border-white/10 bg-[#0A1119] text-slate-600"}`}>Category review {categoryIssues}</button></div></div></div>
            {reviewFilter !== "ALL" && <div className={`mt-3 rounded-xl border px-3 py-2 text-xs ${reviewFilter === "REQUIRED" ? "border-red-400/20 bg-red-400/[0.04] text-red-200" : "border-amber-400/20 bg-amber-400/[0.04] text-amber-200"}`}>Showing <strong>{visibleRows.length}</strong> of <strong>{rows.length}</strong> transactions requiring <strong>{filterLabel.toLowerCase()}</strong>. Use <button type="button" onClick={() => changeReviewFilter("ALL")} className="font-semibold underline underline-offset-2">Show all</button> to return to the full list.</div>}
            {showIncompletePrompt && incompleteRows.length > 0 && <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-4"><p className="text-sm font-semibold text-red-100">Incomplete transactions detected</p><p className="mt-1 text-xs leading-5 text-red-200/70">{incompleteRows.length} transaction{incompleteRows.length === 1 ? " is" : "s are"} missing a date, description, or amount. Do you want OKANE to remove these rows from the import?</p><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setShowIncompletePrompt(false)}>Keep and review</Button><Button type="button" onClick={deleteIncompleteRows}>Delete {incompleteRows.length} incomplete row{incompleteRows.length === 1 ? "" : "s"}</Button></div></div>}
            <div id="transaction-import-review-list" className="mt-4 flex items-center justify-between gap-3 text-[10px] text-slate-500"><span>{reviewFilter === "ALL" ? `Showing all ${rows.length} transactions` : `Showing ${visibleRows.length} ${filterLabel.toLowerCase()} transaction${visibleRows.length === 1 ? "" : "s"}`}</span>{reviewFilter !== "ALL" && <button type="button" onClick={() => changeReviewFilter("ALL")} className="rounded-lg border border-white/10 px-2.5 py-1.5 font-semibold text-slate-300 hover:bg-white/[0.05]">Show all transactions</button>}</div>
            <div key={reviewFilter} className="mt-3 space-y-3">{visibleRows.map((row) => {
              const visibleCategories = categories.filter((c) => c.type === row.type);
              const visibleSubcategories = subcategories.filter((s) => String(s.categoryId) === String(row.categoryId));
              const categoryOptions = visibleCategories;
              const selectedWallet = wallets.find((w) => String(w.id) === String(row.walletId));
              const walletOptions = selectedWallet && !wallets.some((w) => String(w.id) === String(row.walletId)) ? [selectedWallet, ...wallets] : wallets;
              const selectedCategory = categories.find((c) => String(c.id) === String(row.categoryId));
              const robustCategoryOptions = selectedCategory && !categoryOptions.some((c) => String(c.id) === String(row.categoryId)) ? [selectedCategory, ...categoryOptions] : categoryOptions;
              const categoryChanged = Boolean(row.suggestedCategoryId && row.categoryId && String(row.categoryId) !== String(row.suggestedCategoryId));
              const subcategoryChanged = Boolean(row.suggestedSubcategoryId && row.subcategoryId && String(row.subcategoryId) !== String(row.suggestedSubcategoryId));
              const requiredMissing = hasRequiredIssue(row);
              const categoryReviewMissing = hasCategoryIssue(row, rows, subcategories);
              const sameDescriptionCount = duplicateCounts.get(normalizeDescription(row.merchant)) ?? 0;
              return <div key={row.sourceIndex} className={`rounded-2xl border bg-[#101B28] p-4 ${requiredMissing ? "border-red-400/20" : categoryReviewMissing ? "border-amber-400/20" : categoryChanged || subcategoryChanged ? "border-amber-400/15" : "border-white/5"}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><label className="flex items-start gap-3"><input type="checkbox" checked={row.selected} onChange={(e) => updateRow(row.sourceIndex, { selected: e.target.checked })} className="mt-1 h-4 w-4 accent-emerald-500" /><div><p className="text-sm font-semibold text-white">#{row.sourceIndex} · {row.merchant || "Unnamed transaction"}</p><p className="mt-1 text-[10px] text-slate-500">{row.type} · {money(row.amount || 0)}{row.sourceRowNumber ? ` · Excel row ${row.sourceRowNumber}` : ""}{row.suggestionLevel ? ` · ${row.suggestionLevel} suggestion` : ""}</p>{row.sourceCategory && <p className="mt-1 text-[10px] text-slate-500">Source category: {row.sourceCategory}</p>}</div></label><div className="text-left lg:text-right"><p className="text-[10px] uppercase tracking-[0.1em] text-slate-600">OKANE recommendation</p><p className="mt-1 text-xs text-emerald-300">{row.suggestedCategoryName ?? "No category"}{row.suggestedSubcategoryName ? ` · ${row.suggestedSubcategoryName}` : ""}</p><p className="mt-1 text-[10px] text-slate-500">{row.suggestionReason}</p></div></div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5"><label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Date</span><input type="date" value={row.date} onChange={(e) => updateRow(row.sourceIndex, { date: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none" /></label><label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Merchant</span><input value={row.merchant} onChange={(e) => updateRow(row.sourceIndex, { merchant: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none" /></label><label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Amount</span><input type="number" min="0" step="0.01" value={row.amount || ""} onChange={(e) => updateRow(row.sourceIndex, { amount: Number(e.target.value) })} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none" /></label><label className={`block ${!row.walletId ? "rounded-xl border border-red-400/20 p-2" : ""}`}><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Wallet</span><select value={String(row.walletId ?? "")} onChange={(e) => updateWallet(row.sourceIndex, e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none"><option value="">Select wallet</option>{walletOptions.map((wallet) => <option key={wallet.id} value={String(wallet.id)}>{wallet.name}</option>)}</select>{!row.walletId && <p className="mt-1 text-[9px] text-red-300">No method detected. This row will be imported to the review queue.</p>}</label><label className={`block ${!row.categoryId || categoryChanged ? "rounded-xl border border-amber-400/20 p-2" : ""}`}><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Category</span><select value={String(row.categoryId ?? "")} onChange={(e) => updateCategory(row.sourceIndex, e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none"><option value="">Select category</option>{robustCategoryOptions.map((category) => <option key={category.id} value={String(category.id)}>{category.icon ? `${category.icon} ` : ""}{category.name}</option>)}</select></label></div>
                <div className="mt-3 grid gap-3 md:grid-cols-2"><label className={`block ${!row.subcategoryId || subcategoryChanged ? "rounded-xl border border-amber-400/20 p-2" : ""}`}><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Subcategory</span><select value={String(row.subcategoryId ?? "")} onChange={(e) => updateRow(row.sourceIndex, { subcategoryId: String(e.target.value) })} disabled={!row.categoryId} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none"><option value="">{row.categoryId ? "Select subcategory" : "Select category first"}</option>{visibleSubcategories.map((subcategory) => <option key={subcategory.id} value={String(subcategory.id)}>{subcategory.name}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-[9px] uppercase tracking-[0.1em] text-slate-500">Note</span><input value={row.note} onChange={(e) => updateRow(row.sourceIndex, { note: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#07101A] px-3 py-2.5 text-xs text-white outline-none" /></label></div>
                {sameDescriptionCount > 1 && row.categoryId && row.subcategoryId && <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]"><button type="button" onClick={() => applyCategoryToSameDescription(row.sourceIndex)} className="rounded-lg border border-cyan-400/15 bg-cyan-400/[0.04] px-3 py-1.5 font-semibold text-cyan-200 hover:bg-cyan-400/[0.08]">Apply category + subcategory to all {sameDescriptionCount} "{row.merchant}"</button><span className="text-slate-600">Same description is mapped together.</span></div>}
                {(categoryReviewMissing || categoryChanged || subcategoryChanged) && <p className="mt-3 rounded-lg border border-amber-400/10 bg-amber-400/[0.03] px-3 py-2 text-[10px] text-amber-200">Category/subcategory review is optional during import. Incomplete rows can be fixed later from the Transactions page.</p>}
              </div>;
            })}</div>
          </>}
          {importing && <div className="mt-5 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.04] p-3"><div className="flex items-center justify-between text-xs"><span className="font-semibold text-emerald-200">Importing transactions…</span><span className="text-emerald-300">{importProgress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-emerald-400 transition-[width] duration-200" style={{ width: `${importProgress}%` }} /></div><p className="mt-2 text-[10px] text-slate-500">OKANE processes imports in background batches of up to 100 rows.</p></div>}
          <DialogFooter className="mt-5 border-t border-white/5 pt-5"><Button type="button" variant="outline" onClick={() => { resetImportState(); setOpen(false); }} disabled={loading || importing}>Cancel</Button><Button type="button" onClick={importRows} disabled={loading || importing || rows.length === 0 || requiredIssues > 0}><Check size={15} />{importing ? `Importing ${importProgress}%…` : `Import ${selectedRows.length}${categoryIssues > 0 ? " · Review later" : ""}`}</Button></DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
