"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSearch,
  HelpCircle,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { addReconciliationTransactionAction, completeReconciliationAction, resolveReconciliationRowAction } from "../actions";

type Wallet = {
  id: string;
  name: string;
  walletType: string;
  currency: { code: string; symbol: string };
};

type Row = {
  id: string;
  sourceSide: "STATEMENT" | "OKANE";
  sourceRowNumber: number | null;
  pageNumber: number | null;
  transactionDate: string;
  description: string;
  amount: string;
  direction: "DEBIT" | "CREDIT" | "UNKNOWN";
  entryType: string | null;
  matchStatus: "MATCHED" | "POSSIBLE_MATCH" | "CONFLICT" | "STATEMENT_ONLY" | "OKANE_ONLY";
  matchConfidence: number;
  matchReason: string | null;
  matchedTransactionId: string | null;
  resolution: string;
};

type Session = {
  id: string;
  fileName: string;
  sourceType: "BANK_STATEMENT" | "CREDIT_CARD_STATEMENT";
  status: string;
  wallet: { name: string; walletType: string; currency: { symbol: string } };
  extractedCount: number;
  rows: Row[];
};

type Category = { id: string; name: string; type: "INCOME" | "EXPENSE" };
type Subcategory = { id: string; name: string; categoryId: string };
type Props = { wallets: Wallet[]; categories: Category[]; subcategories: Subcategory[]; session: Session | null };
type FilterStatus = "ALL" | "MATCHED" | "NEED_REVIEW" | "NOT_FOUND" | "IGNORED" | "ADDED";
type DrawerMode = "MATCH" | "ADD" | "OKANE";

function money(value: string | number, symbol: string) {
  return symbol + Number(value).toLocaleString("id-ID", { maximumFractionDigits: 0 });
}

function signedMoney(row: Row, symbol: string) {
  const value = money(row.amount, symbol);
  return row.direction === "CREDIT" ? value : "-" + value;
}

function date(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function statusLabel(status: Row["matchStatus"]) {
  if (status === "STATEMENT_ONLY") return "Not found";
  if (status === "OKANE_ONLY") return "OKANE only";
  if (status === "POSSIBLE_MATCH") return "Need review";
  if (status === "CONFLICT") return "Conflict";
  return "Matched";
}

function statusClass(status: Row["matchStatus"]) {
  if (status === "MATCHED") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  if (status === "POSSIBLE_MATCH") return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  if (status === "CONFLICT" || status === "STATEMENT_ONLY") return "border-red-400/20 bg-red-400/10 text-red-300";
  return "border-slate-400/15 bg-slate-400/10 text-slate-300";
}

function buttonBase(extra = "") {
  return "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-semibold transition " + extra;
}

function resolveFilter(row: Row, filter: FilterStatus) {
  if (filter === "ALL") return true;
  if (filter === "MATCHED") return row.matchStatus === "MATCHED" || row.resolution === "ACCEPT_MATCH";
  if (filter === "NEED_REVIEW") return row.resolution === "PENDING" && (row.matchStatus === "POSSIBLE_MATCH" || row.matchStatus === "CONFLICT");
  if (filter === "NOT_FOUND") return row.matchStatus === "STATEMENT_ONLY" && row.resolution === "PENDING";
  if (filter === "IGNORED") return row.resolution === "IGNORE";
  return row.resolution === "ADD_INCOMPLETE";
}

export default function ReconciliationClient({ wallets, categories, subcategories, session }: Props) {
  const router = useRouter();
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [sourceType, setSourceType] = useState<"BANK_STATEMENT" | "CREDIT_CARD_STATEMENT">(
    wallets[0]?.walletType === "CREDIT_CARD" ? "CREDIT_CARD_STATEMENT" : "BANK_STATEMENT",
  );
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("ALL");
  const [filterSide, setFilterSide] = useState<"ALL" | "STATEMENT" | "OKANE">("STATEMENT");
  const [page, setPage] = useState(1);
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("MATCH");

  const rows = session?.rows ?? [];
  const selectedRow = rows.find((row) => row.id === selectedRowId) ?? null;

  const summary = useMemo(() => {
    const statementRows = rows.filter((row) => row.sourceSide === "STATEMENT");
    return {
      total: session?.extractedCount ?? statementRows.length,
      matched: statementRows.filter((row) => row.matchStatus === "MATCHED" || row.resolution === "ACCEPT_MATCH").length,
      needReview: statementRows.filter((row) => row.resolution === "PENDING" && (row.matchStatus === "POSSIBLE_MATCH" || row.matchStatus === "CONFLICT")).length,
      notFound: statementRows.filter((row) => row.matchStatus === "STATEMENT_ONLY" && row.resolution === "PENDING").length,
      ignored: statementRows.filter((row) => row.resolution === "IGNORE").length,
      added: statementRows.filter((row) => row.resolution === "ADD_INCOMPLETE").length,
      pending: rows.filter((row) => row.resolution === "PENDING").length,
    };
  }, [rows, session?.extractedCount]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => filterSide === "ALL" || row.sourceSide === filterSide)
      .filter((row) => resolveFilter(row, filterStatus))
      .filter((row) => {
        if (!query) return true;
        return [row.description, row.entryType ?? "", row.matchReason ?? "", row.amount].join(" ").toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const sideOrder = a.sourceSide === b.sourceSide ? 0 : a.sourceSide === "STATEMENT" ? -1 : 1;
        if (sideOrder !== 0) return sideOrder;
        return new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime();
      });
  }, [filterSide, filterStatus, rows, search]);

  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const period = useMemo(() => {
    const dates = rows.filter((row) => row.sourceSide === "STATEMENT").map((row) => new Date(row.transactionDate).getTime()).filter(Number.isFinite);
    if (!dates.length) return "Statement period";
    const start = new Date(Math.min(...dates));
    const end = new Date(Math.max(...dates));
    return start.getTime() === end.getTime() ? shortDate(start.toISOString()) : shortDate(start.toISOString()) + " – " + shortDate(end.toISOString());
  }, [rows]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file || !walletId) return;
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("walletId", walletId);
      body.append("sourceType", sourceType);
      const response = await fetch("/api/reconciliation/analyze", { method: "POST", body });
      const data = (await response.json()) as { sessionId?: string; error?: string };
      if (!response.ok || !data.sessionId) throw new Error(data.error || "Statement analysis failed.");
      router.push("/reconciliation?session=" + data.sessionId);
      router.refresh();
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Statement analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  function resolve(rowId: string, resolution: string, closeDrawer = true) {
    const form = new FormData();
    form.set("rowId", rowId);
    form.set("resolution", resolution);
    setError("");
    startTransition(async () => {
      try {
        await resolveReconciliationRowAction(form);
        if (closeDrawer) setSelectedRowId(null);
        router.refresh();
      } catch (resolveError) {
        setError(resolveError instanceof Error ? resolveError.message : "Resolution failed.");
      }
    });
  }

  function complete() {
    if (!session) return;
    const form = new FormData();
    form.set("sessionId", session.id);
    setError("");
    startTransition(async () => {
      try {
        await completeReconciliationAction(form);
        router.refresh();
      } catch (completeError) {
        setError(completeError instanceof Error ? completeError.message : "Could not complete reconciliation.");
      }
    });
  }

  function openReview(row: Row, mode?: DrawerMode) {
    setSelectedRowId(row.id);
    setDrawerMode(mode ?? (row.matchStatus === "STATEMENT_ONLY" ? "ADD" : row.sourceSide === "OKANE" ? "OKANE" : "MATCH"));
  }

  function exportCsv() {
    if (!session) return;
    const header = ["Source", "Date", "Description", "Amount", "Direction", "Match status", "Confidence", "Resolution", "Reason"];
    const lines = rows.map((row) =>
      [
        row.sourceSide,
        shortDate(row.transactionDate),
        row.description,
        row.amount,
        row.direction,
        row.matchStatus,
        String(row.matchConfidence),
        row.resolution,
        row.matchReason ?? "",
      ]
        .map((value) => '"' + String(value).replaceAll('"', '""') + '"')
        .join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "okane-reconciliation-" + session.fileName.replace(/\.pdf$/i, "") + ".csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const canAddSelected = Boolean(
    selectedRow &&
      selectedRow.sourceSide === "STATEMENT" &&
      selectedRow.direction !== "UNKNOWN" &&
      !(session?.sourceType === "CREDIT_CARD_STATEMENT" && selectedRow.direction === "CREDIT"),
  );

  if (!session) {
    return (
      <div className="space-y-5">
        <HeaderBlock />
        <Stepper active="UPLOAD" />

        <form onSubmit={upload} className="rounded-[22px] border border-white/10 bg-[#101B27] p-5 shadow-[0_18px_46px_rgba(0,0,0,0.18)]">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
              <FileSearch size={21} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">Reconciliation</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Upload a statement to start</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">OKANE will read the statement in a staging area. Existing transactions remain untouched until you explicitly confirm an action.</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr]">
            <label className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Wallet</span>
              <select
                value={walletId}
                onChange={(event) => {
                  const value = event.target.value;
                  setWalletId(value);
                  const wallet = wallets.find((entry) => entry.id === value);
                  if (wallet) setSourceType(wallet.walletType === "CREDIT_CARD" ? "CREDIT_CARD_STATEMENT" : "BANK_STATEMENT");
                }}
                className="w-full rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="">Choose wallet</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.id}>
                    {wallet.name} · {wallet.currency.code}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Statement type</span>
              <select
                value={sourceType}
                onChange={(event) => setSourceType(event.target.value as typeof sourceType)}
                className="w-full rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-sm text-white outline-none"
              >
                <option value="BANK_STATEMENT">Bank account statement</option>
                <option value="CREDIT_CARD_STATEMENT">Credit card statement</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">PDF statement</span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-dashed border-[#36506A] bg-[#08111A] px-3 py-2.5 text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-[10px] file:font-bold file:text-[#07110b]"
              />
            </label>
          </div>

          {file && <p className="mt-2 truncate text-[10px] text-slate-500">{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</p>}

          <div className="mt-5 flex flex-col gap-3 border-t border-white/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] leading-4 text-slate-600">Current analyzer supports PDF bank and credit-card statements.</p>
            <button
              disabled={busy || !file || !walletId}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? (
                <>
                  <LoaderCircle size={14} className="animate-spin" />Analyzing statement…
                </>
              ) : (
                <>
                  <Upload size={14} />Analyze & compare
                </>
              )}
            </button>
          </div>

          {error && <ErrorBox message={error} />}
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HeaderBlock session={session} />
      <Stepper active={session.status === "COMPLETED" ? "FINALIZE" : "REVIEW"} completed={session.status === "COMPLETED"} />

      <section className="rounded-[22px] border border-white/10 bg-[#101B27] p-4 shadow-[0_18px_46px_rgba(0,0,0,0.18)] sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-blue-400/15 bg-blue-400/10 px-2 py-1 text-[9px] font-semibold text-blue-300">
                {session.sourceType === "CREDIT_CARD_STATEMENT" ? "Credit Card" : "Bank Statement"}
              </span>
              <span className="rounded-lg border border-emerald-400/15 bg-emerald-400/10 px-2 py-1 text-[9px] font-semibold text-emerald-300">
                {session.status === "COMPLETED" ? "COMPLETED" : "DRAFT"}
              </span>
            </div>
            <h2 className="mt-2 truncate text-lg font-semibold text-white">{session.fileName}</h2>
            <p className="mt-1 text-xs text-slate-500">
              {session.wallet.name} · {period} · {summary.total} statement transactions
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className={buttonBase("border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.06]")}
            >
              <Download size={13} />Export
            </button>
            <button type="button" className={buttonBase("border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]")}>
              <HelpCircle size={13} />Help
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Total transactions" value={summary.total} />
          <SummaryCard label="Matched" value={summary.matched} valueClass="text-emerald-300" />
          <SummaryCard label="Need review" value={summary.needReview} valueClass="text-amber-300" />
          <SummaryCard label="Not found" value={summary.notFound} valueClass="text-red-300" />
          <SummaryCard label="Ignored" value={summary.ignored} valueClass="text-slate-300" />
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#101B27] shadow-[0_18px_46px_rgba(0,0,0,0.15)]">
        <div className="flex flex-col gap-3 border-b border-white/5 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 sm:w-[280px]">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search description, amount, or date…"
                className="w-full rounded-xl border border-white/10 bg-[#08111A] py-2.5 pl-9 pr-3 text-xs text-white placeholder:text-slate-600 outline-none"
              />
            </div>

            <select
              value={filterStatus}
              onChange={(event) => {
                setFilterStatus(event.target.value as FilterStatus);
                setPage(1);
              }}
              className="rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-white outline-none"
            >
              <option value="ALL">All status</option>
              <option value="MATCHED">Matched</option>
              <option value="NEED_REVIEW">Need review</option>
              <option value="NOT_FOUND">Not found</option>
              <option value="IGNORED">Ignored</option>
              <option value="ADDED">Added to OKANE</option>
            </select>

            <select
              value={filterSide}
              onChange={(event) => {
                setFilterSide(event.target.value as typeof filterSide);
                setPage(1);
              }}
              className="rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-white outline-none"
            >
              <option value="STATEMENT">Statement rows</option>
              <option value="OKANE">OKANE rows</option>
              <option value="ALL">All sources</option>
            </select>

            <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-slate-400">
              <CalendarDays size={13} className="text-slate-600" />{period}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setFilterStatus("NEED_REVIEW");
                setFilterSide("STATEMENT");
                setPage(1);
              }}
              className={buttonBase("border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15")}
            >
              <Check size={13} />Review pending
            </button>
            <button
              type="button"
              onClick={exportCsv}
              className="hidden rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-slate-300 hover:bg-white/[0.04] lg:inline-flex lg:items-center lg:gap-2"
            >
              <Download size={13} />Export
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-[#0A131D] text-left">
                <th className="w-10 px-4 py-3">
                  <span className="sr-only">Select</span>
                  <input type="checkbox" disabled className="h-3.5 w-3.5 rounded border-white/20 bg-transparent opacity-50" />
                </th>
                <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Date</th>
                <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Description (Statement)</th>
                <th className="px-3 py-3 text-right text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Amount</th>
                <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">OKANE match</th>
                <th className="px-3 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Status</th>
                <th className="w-[190px] px-4 py-3 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center text-xs text-slate-600">
                    No transactions match the current filters.
                  </td>
                </tr>
              )}

              {paginatedRows.map((row) => {
                const isMatched = row.matchStatus === "MATCHED" || row.resolution === "ACCEPT_MATCH";
                const isPendingReview = row.resolution === "PENDING" && (row.matchStatus === "POSSIBLE_MATCH" || row.matchStatus === "CONFLICT");
                const isNotFound = row.matchStatus === "STATEMENT_ONLY" && row.resolution === "PENDING";
                const isAdded = row.resolution === "ADD_INCOMPLETE";
                const isIgnored = row.resolution === "IGNORE";
                const isOkaneOnly = row.sourceSide === "OKANE";

                return (
                  <tr key={row.id} className="border-b border-white/[0.045] hover:bg-white/[0.018]">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="h-3.5 w-3.5 rounded border-white/20 bg-transparent" />
                    </td>
                    <td className="px-3 py-3 align-top text-xs text-slate-300">{date(row.transactionDate)}</td>
                    <td className="max-w-[250px] px-3 py-3 align-top">
                      <div className="truncate text-xs font-semibold text-white">{row.description}</div>
                      <div className="mt-1 text-[10px] text-slate-600">
                        {row.sourceSide === "STATEMENT" ? "Statement" : "OKANE"} · {row.entryType || row.direction}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right align-top text-xs font-bold text-white">{signedMoney(row, session.wallet.currency.symbol)}</td>
                    <td className="px-3 py-3 align-top">
                      {row.matchedTransactionId ? (
                        <div>
                          <div className="text-xs text-slate-200">
                            {isOkaneOnly ? "Existing OKANE transaction" : "Candidate transaction found"}
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500">
                            {row.matchConfidence > 0 ? row.matchConfidence + "% confidence" : "No statement match"}{row.matchReason ? " · " + row.matchReason.split(",")[0] : ""}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-xs text-slate-500">—</div>
                          <div className="mt-1 text-[10px] text-slate-600">No matching transaction</div>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top">
                      {isAdded ? (
                        <span className="rounded-full border border-blue-400/15 bg-blue-400/10 px-2.5 py-1 text-[9px] font-semibold text-blue-300">Added</span>
                      ) : isIgnored ? (
                        <span className="rounded-full border border-slate-400/15 bg-slate-400/10 px-2.5 py-1 text-[9px] font-semibold text-slate-300">Ignored</span>
                      ) : (
                        <span className={"rounded-full border px-2.5 py-1 text-[9px] font-semibold " + statusClass(row.matchStatus)}>{statusLabel(row.matchStatus)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {isMatched ? (
                        <button
                          type="button"
                          onClick={() => resolve(row.id, "ACCEPT_MATCH")}
                          disabled={isPending}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-[10px] font-bold text-[#06110B] hover:bg-emerald-400 disabled:opacity-40"
                        >
                          <Check size={13} />Transaction OK
                        </button>
                      ) : isPendingReview ? (
                        <button
                          type="button"
                          onClick={() => openReview(row, "MATCH")}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[10px] font-bold text-amber-300 hover:bg-amber-400/10"
                        >
                          Review
                        </button>
                      ) : isNotFound ? (
                        <button
                          type="button"
                          onClick={() => openReview(row, "ADD")}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-400/30 bg-blue-400/5 px-3 py-2 text-[10px] font-bold text-blue-300 hover:bg-blue-400/10"
                        >
                          <Plus size={13} />Add to OKANE
                        </button>
                      ) : isOkaneOnly ? (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => resolve(row.id, "KEEP")}
                            disabled={isPending}
                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[10px] font-semibold text-slate-200 hover:bg-white/[0.06] disabled:opacity-40"
                          >
                            Keep
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Delete this transaction from OKANE?")) resolve(row.id, "DELETE");
                            }}
                            disabled={isPending}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-400/15 bg-red-400/[0.04] text-red-300 hover:bg-red-400/10 disabled:opacity-40"
                            aria-label="Delete transaction"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openReview(row)}
                          className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[10px] font-semibold text-slate-300 hover:bg-white/[0.06]"
                        >
                          Review
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] text-slate-600">
            Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length} filtered rows
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-slate-500 disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(pageCount, 5) }, (_, index) => index + 1).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setPage(item)}
                className={"h-8 min-w-8 rounded-lg px-2 text-[10px] font-semibold " + (item === currentPage ? "bg-emerald-500 text-[#06110B]" : "border border-transparent text-slate-500 hover:bg-white/[0.04]")}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              disabled={currentPage === pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] text-slate-500 disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[#101B27] p-4 shadow-[0_18px_46px_rgba(0,0,0,0.15)] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">3. Finalize</p>
            <h3 className="mt-1 text-base font-semibold text-white">Finish reconciliation when every difference has a decision.</h3>
            <p className="mt-1 text-xs text-slate-600">
              {summary.pending === 0 ? "All rows are resolved. You can finalize the session." : summary.pending + " rows still need a decision."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-white/10 bg-[#08111A] px-3 py-2 text-[10px] text-slate-400">
              <span className="font-bold text-slate-200">{summary.matched + summary.added}</span> resolved
            </div>
            {session.status !== "COMPLETED" && (
              <button
                type="button"
                onClick={complete}
                disabled={isPending || summary.pending > 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#06110B] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {isPending ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {summary.pending > 0 ? "Resolve pending rows first" : "Finalize reconciliation"}
              </button>
            )}
          </div>
        </div>
        {error && <ErrorBox message={error} />}
      </section>

      {selectedRow && (
        <ReviewDrawer
          row={selectedRow}
          session={session}
          wallets={wallets}
          categories={categories}
          subcategories={subcategories}
          mode={drawerMode}
          pending={isPending}
          canAdd={canAddSelected}
          onClose={() => setSelectedRowId(null)}
          onResolve={resolve}
          onImported={() => {
            setSelectedRowId(null);
            router.refresh();
          }}
          onModeChange={setDrawerMode}
        />
      )}
    </div>
  );
}

function HeaderBlock({ session }: { session?: Session }) {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
          <span>Finance</span>
          <span>›</span>
          <span className="text-emerald-300">Reconciliation</span>
          {session && (
            <>
              <span>›</span>
              <span className="max-w-[260px] truncate text-slate-500">{session.fileName}</span>
            </>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Reconciliation</h1>
        <p className="mt-1.5 max-w-3xl text-sm text-slate-500">Review and match transactions from your statement with OKANE.</p>
      </div>
      <button type="button" className={buttonBase("border-white/10 bg-[#101B27] text-slate-300 hover:bg-white/[0.04]")}>
        <HelpCircle size={14} />Help
      </button>
    </header>
  );
}

function Stepper({ active, completed = false }: { active: "UPLOAD" | "REVIEW" | "FINALIZE"; completed?: boolean }) {
  const isUpload = active === "UPLOAD";
  const isReview = active === "REVIEW";
  const isFinalize = active === "FINALIZE";

  return (
    <section className="rounded-[18px] border border-white/10 bg-[#0E1824] px-4 py-3 sm:px-5">
      <div className="grid grid-cols-3 gap-2">
        <StepItem number="1" label="Upload" subtitle="Statement" active={isUpload} complete={!isUpload} />
        <StepItem number="2" label="Review & Match" subtitle="Check differences" active={isReview} complete={isFinalize || completed} />
        <StepItem number="3" label="Finalize" subtitle="Complete reconciliation" active={isFinalize} complete={completed} />
      </div>
    </section>
  );
}

function StepItem({ number, label, subtitle, active, complete }: { number: string; label: string; subtitle: string; active: boolean; complete: boolean }) {
  return (
    <div className="relative flex min-w-0 items-center gap-2.5 sm:gap-3">
      <div className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold " + (complete ? "bg-emerald-500 text-[#06110B]" : active ? "bg-emerald-500 text-[#06110B]" : "bg-[#274055] text-slate-400")}>
        {complete ? <Check size={14} /> : number}
      </div>
      <div className="min-w-0">
        <p className={"truncate text-[11px] font-bold " + (active || complete ? "text-white" : "text-slate-500")}>{label}</p>
        <p className="truncate text-[9px] text-slate-600">{subtitle}</p>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, valueClass = "text-white" }: { label: string; value: number; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#08111A] px-3.5 py-3.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">{label}</p>
      <p className={"mt-1.5 text-xl font-bold " + valueClass}>{value.toLocaleString("id-ID")}</p>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return <p className="mt-3 rounded-xl border border-red-400/10 bg-red-400/[0.04] px-3 py-2.5 text-xs text-red-300">{message}</p>;
}

function ReviewDrawer({
  row,
  session,
  wallets,
  categories,
  subcategories,
  mode,
  pending,
  canAdd,
  onClose,
  onResolve,
  onImported,
  onModeChange,
}: {
  row: Row;
  session: Session;
  wallets: Wallet[];
  categories: Category[];
  subcategories: Subcategory[];
  mode: DrawerMode;
  pending: boolean;
  canAdd: boolean;
  onClose: () => void;
  onResolve: (rowId: string, resolution: string, closeDrawer?: boolean) => void;
  onImported: () => void;
  onModeChange: (mode: DrawerMode) => void;
}) {
  const isOkaneOnly = row.sourceSide === "OKANE";
  const hasMatch = Boolean(row.matchedTransactionId || row.matchStatus === "MATCHED");
  const matchColor = row.matchConfidence >= 90 ? "text-emerald-300" : row.matchConfidence >= 70 ? "text-amber-300" : "text-slate-300";

  const [transactionDate, setTransactionDate] = useState(() => row.transactionDate.slice(0, 10));
  const [amount, setAmount] = useState(() => String(Number(row.amount)));
  const [walletId, setWalletId] = useState(() => {
    const defaultWallet = wallets.find((wallet) => wallet.name === session.wallet.name);
    return defaultWallet?.id ?? wallets[0]?.id ?? "";
  });
  const [type, setType] = useState<"EXPENSE" | "INCOME">(() => {
    if (session.sourceType === "CREDIT_CARD_STATEMENT") return "EXPENSE";
    return row.direction === "CREDIT" ? "INCOME" : "EXPENSE";
  });
  const [merchant, setMerchant] = useState(() => row.description);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [note, setNote] = useState(() => "Reconciliation import: " + session.fileName);
  const [localError, setLocalError] = useState("");
  const [saving, startSaveTransition] = useTransition();

  const selectedCategory = categories.find((category) => category.id === categoryId);
  const availableCategories = categories.filter((category) => category.type === type);
  const availableSubcategories = subcategories.filter((subcategory) => !categoryId || subcategory.categoryId === categoryId);

  useMemo(() => {
    if (categoryId && selectedCategory && selectedCategory.type !== type) {
      setCategoryId("");
      setSubcategoryId("");
    }
  }, [categoryId, selectedCategory, type]);

  function saveEditedTransaction() {
    if (!transactionDate || !amount || !walletId || !merchant.trim()) {
      setLocalError("Date, amount, wallet, and merchant/payee are required.");
      return;
    }

    const form = new FormData();
    form.set("rowId", row.id);
    form.set("transactionDate", transactionDate);
    form.set("amount", amount.replace(/[^0-9.-]/g, ""));
    form.set("walletId", walletId);
    form.set("type", type);
    form.set("merchant", merchant);
    form.set("categoryId", categoryId);
    form.set("subcategoryId", subcategoryId);
    form.set("note", note);

    setLocalError("");
    startSaveTransition(async () => {
      try {
        await addReconciliationTransactionAction(form);
        onImported();
      } catch (saveError) {
        setLocalError(saveError instanceof Error ? saveError.message : "Could not save transaction.");
      }
    });
  }

  const selectedWallet = wallets.find((wallet) => wallet.id === walletId);

  return (
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/50 backdrop-blur-[1px]">
      <button type="button" aria-label="Close review drawer" onClick={onClose} className="absolute inset-0 cursor-default" />
      <aside className="relative z-10 flex h-full w-full max-w-[520px] flex-col border-l border-white/10 bg-[#08111A] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-emerald-400">Reconciliation</p>
            <h2 className="mt-1 text-base font-semibold text-white">{isOkaneOnly ? "Review OKANE transaction" : "Review transaction"}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-white/[0.05] hover:text-slate-200">
            <XCircle size={18} />
          </button>
        </div>

        {!isOkaneOnly && (
          <div className="grid grid-cols-2 gap-1 border-b border-white/5 bg-[#0A131D] p-2">
            <button
              type="button"
              onClick={() => onModeChange("MATCH")}
              className={"rounded-lg px-3 py-2 text-[10px] font-semibold " + (mode === "MATCH" ? "bg-[#18384A] text-white ring-1 ring-emerald-400/20" : "text-slate-500")}
            >
              Review Match
            </button>
            <button
              type="button"
              onClick={() => onModeChange("ADD")}
              className={"rounded-lg px-3 py-2 text-[10px] font-semibold " + (mode === "ADD" ? "bg-[#18384A] text-white ring-1 ring-blue-400/20" : "text-slate-500")}
            >
              Add to OKANE
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="rounded-2xl border border-white/10 bg-[#0D1823] p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">From {isOkaneOnly ? "OKANE" : "Statement"}</p>
              <span className={"rounded-full border px-2 py-1 text-[9px] font-semibold " + statusClass(row.matchStatus)}>{row.resolution === "ADD_INCOMPLETE" ? "Added" : row.resolution === "IGNORE" ? "Ignored" : statusLabel(row.matchStatus)}</span>
            </div>
            <div className="grid grid-cols-[88px_1fr] gap-y-2 text-xs">
              <span className="text-slate-600">Date</span><span className="text-slate-200">{date(row.transactionDate)}</span>
              <span className="text-slate-600">Description</span><span className="break-words font-semibold text-white">{row.description}</span>
              <span className="text-slate-600">Amount</span><span className="font-bold text-white">{signedMoney(row, session.wallet.currency.symbol)}</span>
              <span className="text-slate-600">Reference</span><span className="text-slate-400">{row.sourceRowNumber ? "Source row " + row.sourceRowNumber : "—"}</span>
            </div>
          </div>

          {isOkaneOnly ? (
            <div className="mt-4 rounded-2xl border border-amber-400/10 bg-amber-400/[0.03] p-4">
              <p className="text-xs font-semibold text-white">No matching statement row was found.</p>
              <p className="mt-1.5 text-[10px] leading-4 text-slate-500">Keep the transaction in OKANE, or remove it only when you are sure it should not be part of this reconciliation.</p>
            </div>
          ) : mode === "MATCH" ? (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-[#0D1823] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Possible matches in OKANE</p>
                  {row.matchConfidence > 0 && <span className={"text-[10px] font-bold " + matchColor}>{row.matchConfidence}% confidence</span>}
                </div>

                <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.03] p-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-400/50">
                      {hasMatch && <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white">{hasMatch ? "Candidate transaction in OKANE" : "No matching transaction found"}</p>
                      <p className="mt-1 text-[10px] text-slate-500">{row.matchedTransactionId ? "Transaction ID " + row.matchedTransactionId.slice(0, 10) + "…" : "No candidate transaction was linked to this row."}</p>
                      {row.matchReason && <p className="mt-2 text-[10px] leading-4 text-slate-400">{row.matchReason}</p>}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onResolve(row.id, "IGNORE")}
                  disabled={pending}
                  className={buttonBase("mt-3 w-full border-white/10 bg-white/[0.02] text-slate-400 hover:bg-white/[0.04] disabled:opacity-40")}
                >
                  <XCircle size={13} />Ignore this statement transaction
                </button>
              </div>

              {row.matchStatus === "CONFLICT" && (
                <div className="rounded-xl border border-red-400/15 bg-red-400/[0.04] px-3 py-2.5 text-[10px] leading-4 text-red-200">
                  A same-date description candidate exists, but the amount differs. Confirm only when you have verified the statement and OKANE transaction refer to the same event.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-white/10 bg-[#0D1823] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600">Create transaction from statement</p>
                  {selectedWallet && <span className="text-[9px] text-slate-600">{selectedWallet.currency.code}</span>}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">Date</span>
                    <input type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-white outline-none" />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">Amount</span>
                    <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-white outline-none" />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">Wallet</span>
                    <select value={walletId} onChange={(event) => setWalletId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-white outline-none">
                      {wallets.map((wallet) => <option key={wallet.id} value={wallet.id}>{wallet.name} · {wallet.currency.code}</option>)}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">Type</span>
                    <select value={type} onChange={(event) => { setType(event.target.value as "EXPENSE" | "INCOME"); setCategoryId(""); setSubcategoryId(""); }} className="w-full rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-white outline-none">
                      <option value="EXPENSE">Expense</option>
                      <option value="INCOME">Income</option>
                    </select>
                  </label>

                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">Merchant / Payee</span>
                    <input value={merchant} onChange={(event) => setMerchant(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-white outline-none" />
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">Category</span>
                    <select value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setSubcategoryId(""); }} className="w-full rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-white outline-none">
                      <option value="">No category</option>
                      {availableCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                    </select>
                  </label>

                  <label className="space-y-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">Subcategory</span>
                    <select value={subcategoryId} onChange={(event) => setSubcategoryId(event.target.value)} disabled={!categoryId} className="w-full rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-white outline-none disabled:cursor-not-allowed disabled:opacity-45">
                      <option value="">{categoryId ? "No subcategory" : "Select category first"}</option>
                      {availableSubcategories.map((subcategory) => <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>)}
                    </select>
                  </label>

                  <label className="space-y-1.5 sm:col-span-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">Note</span>
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="w-full resize-none rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-white outline-none" />
                  </label>
                </div>

                {selectedWallet && selectedWallet.id !== wallets.find((wallet) => wallet.name === session.wallet.name)?.id && (
                  <p className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2.5 text-[10px] leading-4 text-amber-200">
                    You selected a different wallet from the reconciled statement wallet. Check the wallet and amount before saving.
                  </p>
                )}

                {!canAdd && (
                  <div className="mt-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-3 py-2.5 text-[10px] leading-4 text-amber-200">
                    This row cannot be imported automatically because its direction is unknown or it is a credit-card statement credit.
                  </div>
                )}

                {localError && <ErrorBox message={localError} />}
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-white/5 bg-[#0A131D] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onResolve(row.id, "IGNORE")}
              disabled={pending}
              className={buttonBase("border-red-400/15 bg-red-400/[0.04] text-red-300 hover:bg-red-400/[0.08] disabled:opacity-40")}
            >
              <XCircle size={13} />Ignore
            </button>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className={buttonBase("border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05]")}
              >
                Cancel
              </button>

              {isOkaneOnly ? (
                <>
                  <button
                    type="button"
                    onClick={() => onResolve(row.id, "KEEP")}
                    disabled={pending}
                    className={buttonBase("bg-emerald-500 border-emerald-500 text-[#06110B] hover:bg-emerald-400 disabled:opacity-40")}
                  >
                    <Check size={13} />Keep transaction
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Delete this transaction from OKANE?")) onResolve(row.id, "DELETE");
                    }}
                    disabled={pending}
                    className={buttonBase("border-red-400/20 bg-red-400/[0.05] text-red-300 hover:bg-red-400/[0.1] disabled:opacity-40")}
                  >
                    <Trash2 size={13} />Delete
                  </button>
                </>
              ) : mode === "MATCH" ? (
                <button
                  type="button"
                  onClick={() => onResolve(row.id, "ACCEPT_MATCH")}
                  disabled={pending || !row.matchedTransactionId}
                  className={buttonBase("border-emerald-500 bg-emerald-500 text-[#06110B] hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-35")}
                >
                  {pending ? <LoaderCircle size={13} className="animate-spin" /> : <Check size={13} />}Confirm match
                </button>
              ) : (
                <button
                  type="button"
                  onClick={saveEditedTransaction}
                  disabled={pending || !canAdd}
                  className={buttonBase("border-blue-500 bg-blue-500 text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-35")}
                >
                  {pending ? <LoaderCircle size={13} className="animate-spin" /> : <Plus size={13} />}Save to OKANE
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="space-y-1">
      <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600">{label}</span>
      <div className="rounded-xl border border-white/10 bg-[#08111A] px-3 py-2.5 text-xs text-slate-300">{value}</div>
    </label>
  );
}
