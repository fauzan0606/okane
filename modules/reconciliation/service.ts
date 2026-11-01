import { Prisma, TransactionType, ReconciliationDirection, ReconciliationMatchStatus, ReconciliationResolution, ReconciliationSourceSide, ReconciliationSourceType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createTransactionService, deleteTransactionService } from "@/modules/transaction/service";

export type ExtractedRow = {
  sourceRowNumber?: number;
  pageNumber?: number;
  transactionDate: string;
  description: string;
  amount: number;
  direction: "DEBIT" | "CREDIT" | "UNKNOWN";
  entryType?: string;
};

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, januari: 0,
  feb: 1, february: 1, februari: 1,
  mar: 2, march: 2, maret: 2,
  apr: 3, april: 3,
  may: 4, mei: 4,
  jun: 5, june: 5, juni: 5,
  jul: 6, july: 6, juli: 6,
  aug: 7, august: 7, agustus: 7, agu: 7, agt: 7,
  sep: 8, september: 8,
  oct: 9, october: 9, oktober: 9, okt: 9,
  nov: 10, november: 10,
  dec: 11, december: 11, desember: 11, des: 11,
};

function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim(); }

function tokenSimilarity(a: string, b: string) {
  const aa = new Set(normalize(a).split(" ").filter(Boolean));
  const bb = new Set(normalize(b).split(" ").filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  const intersection = [...aa].filter((token) => bb.has(token)).length;
  return intersection / Math.max(aa.size, bb.size);
}

function dayDistance(a: Date, b: Date) {
  return Math.abs(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) - Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())) / 86400000;
}

function buildDate(day: number, month: number, year: number) {
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date;
}

function parseExplicitYear(value?: string | Date | null) {
  if (!value || value instanceof Date) return value instanceof Date ? value.getUTCFullYear() : undefined;
  const match = String(value).match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : undefined;
}

/**
 * Statement parsers/models sometimes emit dates such as "01-SEP" or "03-SEP"
 * without a year. Node's native Date parser interprets these strings as year 2001.
 * For reconciliation that is wrong: resolve year from statement period, file name,
 * or explicit row dates before falling back to the current year.
 */
function parseValidDate(value?: string | Date | null, referenceYear?: number) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());

  const raw = String(value).trim();
  const normalized = raw.toLowerCase().replace(/[,]/g, " ").replace(/\s+/g, " ");

  const iso = normalized.match(/^(20\d{2})-(\d{1,2})-(\d{1,2})/);
  if (iso) return buildDate(Number(iso[3]), Number(iso[2]) - 1, Number(iso[1]));

  const textDate = normalized.match(/^(\d{1,2})[\s\-\/.]+([a-z]+)(?:[\s\-\/.]+(20\d{2}))?$/);
  if (textDate) {
    const month = MONTHS[textDate[2]];
    if (month !== undefined) {
      const year = textDate[3] ? Number(textDate[3]) : referenceYear ?? new Date().getFullYear();
      return buildDate(Number(textDate[1]), month, year);
    }
  }

  const numeric = normalized.match(/^(\d{1,2})[\/\.\-](\d{1,2})(?:[\/\.\-](20\d{2}))?$/);
  if (numeric) {
    const year = numeric[3] ? Number(numeric[3]) : referenceYear ?? new Date().getFullYear();
    return buildDate(Number(numeric[1]), Number(numeric[2]) - 1, year);
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function inferReferenceYear(input: { fileName: string; periodStart?: string; periodEnd?: string; rows: ExtractedRow[] }) {
  const explicitPeriodYear = parseExplicitYear(input.periodStart) ?? parseExplicitYear(input.periodEnd);
  if (explicitPeriodYear) return explicitPeriodYear;

  const explicitRowYear = input.rows
    .map((row) => parseExplicitYear(row.transactionDate))
    .find((year): year is number => Boolean(year));
  if (explicitRowYear) return explicitRowYear;

  const fileNameYear = input.fileName.match(/(?:^|[^0-9])(20\d{2})(?:[^0-9]|$)/)?.[1];
  if (fileNameYear) return Number(fileNameYear);

  return new Date().getFullYear();
}

function getValidPeriod(inputPeriod: string | undefined, dates: Date[], mode: "start" | "end", referenceYear: number) {
  const explicit = parseValidDate(inputPeriod, referenceYear);
  if (explicit) return explicit;
  if (!dates.length) return null;
  const times = dates.map((date) => date.getTime());
  return new Date(mode === "start" ? Math.min(...times) : Math.max(...times));
}

function directionMatches(sourceType: ReconciliationSourceType, direction: ReconciliationDirection, transactionType: string) {
  if (sourceType === ReconciliationSourceType.CREDIT_CARD_STATEMENT) return direction === ReconciliationDirection.DEBIT && transactionType === "EXPENSE";
  if (direction === ReconciliationDirection.DEBIT) return transactionType === "EXPENSE";
  if (direction === ReconciliationDirection.CREDIT) return transactionType === "INCOME";
  return true;
}

export async function getReconciliationWallets() {
  return prisma.wallet.findMany({ where: { isActive: true }, select: { id: true, name: true, walletType: true, currency: { select: { code: true, symbol: true } } }, orderBy: { name: "asc" } });
}

export async function getReconciliationFormData() {
  const [wallets, categories, subcategories] = await Promise.all([
    getReconciliationWallets(),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.subcategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true, categoryId: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);
  return { wallets, categories, subcategories };
}

export async function createReconciliationSession(input: { walletId: string; sourceType: ReconciliationSourceType; fileName: string; rows: ExtractedRow[]; periodStart?: string; periodEnd?: string }) {
  const wallet = await prisma.wallet.findUnique({ where: { id: input.walletId }, select: { id: true, walletType: true } });
  if (!wallet) throw new Error("Wallet not found.");
  if (input.sourceType === ReconciliationSourceType.CREDIT_CARD_STATEMENT && wallet.walletType !== "CREDIT_CARD") throw new Error("Credit Card Statement reconciliation requires a credit card wallet.");
  if (!input.rows.length) throw new Error("No transaction rows were extracted from the statement.");

  const referenceYear = inferReferenceYear(input);
  const dates = input.rows.map((row) => parseValidDate(row.transactionDate, referenceYear)).filter((date): date is Date => Boolean(date));
  const periodStart = getValidPeriod(input.periodStart, dates, "start", referenceYear);
  const periodEnd = getValidPeriod(input.periodEnd, dates, "end", referenceYear);
  const MATCH_WINDOW_DAYS = 4;
  const windowStart = periodStart ? new Date(periodStart.getTime() - MATCH_WINDOW_DAYS * 86400000) : undefined;
  const windowEnd = periodEnd ? new Date(periodEnd.getTime() + MATCH_WINDOW_DAYS * 86400000) : undefined;

  const [transactions, transfers] = await Promise.all([
    prisma.transaction.findMany({ where: { walletId: input.walletId, ...(windowStart && windowEnd ? { transactionDate: { gte: windowStart, lte: windowEnd } } : {}) }, select: { id: true, transactionDate: true, amount: true, type: true, payee: { select: { name: true } }, category: { select: { id: true, name: true } }, subcategory: { select: { id: true, name: true } }, note: true } }),
    prisma.transfer.findMany({ where: { OR: [{ fromWalletId: input.walletId }, { toWalletId: input.walletId }], ...(windowStart && windowEnd ? { transferDate: { gte: windowStart, lte: windowEnd } } : {}) }, select: { id: true, transferDate: true, amount: true, origin: true, fromWalletId: true, toWalletId: true } }),
  ]);

  const usedTransactionIds = new Set<string>();
  const usedTransferIds = new Set<string>();
  const rowsToCreate: Prisma.ReconciliationRowCreateWithoutSessionInput[] = [];

  for (const raw of input.rows) {
    const date = parseValidDate(raw.transactionDate, referenceYear);
    const amount = new Prisma.Decimal(Math.abs(Number(raw.amount) || 0));
    if (!date || amount.lte(0) || !raw.description.trim()) continue;

    const candidates = transactions
      .filter((tx) => !usedTransactionIds.has(tx.id) && tx.amount.eq(amount) && directionMatches(input.sourceType, raw.direction as ReconciliationDirection, tx.type))
      .map((tx) => ({ tx, distance: dayDistance(date, tx.transactionDate), similarity: tokenSimilarity(raw.description, tx.payee?.name || tx.category?.name || tx.note || "") }))
      .filter((candidate) => candidate.distance <= MATCH_WINDOW_DAYS)
      .sort((a, b) => (b.similarity - a.similarity) || (a.distance - b.distance));

    const transferCandidates = transfers
      .filter((transfer) => !usedTransferIds.has(transfer.id) && transfer.amount.eq(amount))
      .map((transfer) => ({ transfer, distance: dayDistance(date, transfer.transferDate) }))
      .filter((candidate) => candidate.distance <= MATCH_WINDOW_DAYS)
      .sort((a, b) => a.distance - b.distance);

    const exact = candidates.find((candidate) => candidate.distance === 0 && candidate.similarity >= 0.85);
    const strong = candidates.find((candidate) => candidate.distance <= 1 && candidate.similarity >= 0.45);
    const possible = candidates.find((candidate) => candidate.distance <= MATCH_WINDOW_DAYS && candidate.similarity >= 0.15);
    const amountDateCandidate = candidates.find((candidate) => candidate.distance <= MATCH_WINDOW_DAYS);
    const likelyPaymentTransfer = transferCandidates.find((candidate) => /(payment|bayar|credit card|cc payment)/i.test(raw.entryType || raw.description));
    const dateAmountConflict = transactions.some((tx) => !usedTransactionIds.has(tx.id) && dayDistance(date, tx.transactionDate) === 0 && !tx.amount.eq(amount) && tokenSimilarity(raw.description, tx.payee?.name || tx.category?.name || tx.note || "") >= 0.6);

    let matchStatus: ReconciliationMatchStatus = ReconciliationMatchStatus.STATEMENT_ONLY;
    let confidence = 0;
    let matchedTransactionId: string | null = null;
    let matchedTransferId: string | null = null;
    let reason = "No matching OKANE transaction was found.";
    const match = exact || strong || possible || amountDateCandidate;
    if (match) {
      matchStatus = exact ? ReconciliationMatchStatus.MATCHED : ReconciliationMatchStatus.POSSIBLE_MATCH;
      confidence = exact ? 99 : strong ? 90 : possible ? 70 : 55;
      matchedTransactionId = match.tx.id;
      reason = match.similarity > 0
        ? `${Math.round(match.similarity * 100)}% merchant similarity, ${match.distance} day date difference, exact amount.`
        : `Exact amount, ${match.distance} day date difference; merchant name could not be matched confidently.`;
      usedTransactionIds.add(match.tx.id);
    } else if (likelyPaymentTransfer) {
      matchStatus = likelyPaymentTransfer.distance === 0 ? ReconciliationMatchStatus.MATCHED : ReconciliationMatchStatus.POSSIBLE_MATCH;
      confidence = likelyPaymentTransfer.distance === 0 ? 95 : 80;
      matchedTransferId = likelyPaymentTransfer.transfer.id;
      reason = `Statement entry matches an OKANE transfer/payment by amount, ${likelyPaymentTransfer.distance} day date difference.`;
      usedTransferIds.add(likelyPaymentTransfer.transfer.id);
    } else if (dateAmountConflict) {
      matchStatus = ReconciliationMatchStatus.CONFLICT;
      confidence = 60;
      reason = "A same-date merchant match exists, but the amount differs.";
    }

    rowsToCreate.push({ sourceSide: ReconciliationSourceSide.STATEMENT, sourceRowNumber: raw.sourceRowNumber ?? null, pageNumber: raw.pageNumber ?? null, transactionDate: date, description: raw.description.trim(), amount, direction: raw.direction as ReconciliationDirection, entryType: raw.entryType?.trim() || null, matchStatus, matchConfidence: confidence, matchReason: reason, matchedTransactionId, matchedTransferId, resolution: matchStatus === ReconciliationMatchStatus.MATCHED ? ReconciliationResolution.ACCEPT_MATCH : ReconciliationResolution.PENDING, createdTransactionId: null });
  }

  const matchedTransactionIds = new Set(rowsToCreate.map((row) => row.matchedTransactionId).filter(Boolean) as string[]);
  for (const tx of transactions) {
    if (matchedTransactionIds.has(tx.id)) continue;
    rowsToCreate.push({ sourceSide: ReconciliationSourceSide.OKANE, sourceRowNumber: null, pageNumber: null, transactionDate: tx.transactionDate, description: tx.payee?.name || tx.category?.name || tx.note || (tx.type === "INCOME" ? "Income" : "Expense"), amount: tx.amount, direction: tx.type === "INCOME" ? ReconciliationDirection.CREDIT : ReconciliationDirection.DEBIT, entryType: "OKANE_TRANSACTION", matchStatus: ReconciliationMatchStatus.OKANE_ONLY, matchConfidence: 0, matchReason: "This OKANE transaction was not matched to a statement row.", matchedTransactionId: tx.id, matchedTransferId: null, resolution: ReconciliationResolution.PENDING, createdTransactionId: null });
  }

  return prisma.reconciliationSession.create({ data: { walletId: input.walletId, sourceType: input.sourceType, fileName: input.fileName, periodStart, periodEnd, extractedCount: rowsToCreate.filter((row) => row.sourceSide === ReconciliationSourceSide.STATEMENT).length, rows: { create: rowsToCreate } }, include: { wallet: { select: { name: true, walletType: true, currency: { select: { symbol: true } } } }, rows: true } });
}

export async function getLatestReconciliationSession() {
  return prisma.reconciliationSession.findFirst({
    where: { status: "REVIEWING" },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
}

export async function getReconciliationSession(id: string) {
  const session = await prisma.reconciliationSession.findUnique({
    where: { id },
    include: {
      wallet: {
        select: {
          name: true,
          walletType: true,
          currency: { select: { symbol: true } },
        },
      },
      rows: {
        orderBy: [
          { sourceSide: "asc" },
          { transactionDate: "desc" },
          { sourceRowNumber: "asc" },
        ],
      },
    },
  });

  if (!session) return null;

  const transactionIds = session.rows
    .map((row) => row.matchedTransactionId)
    .filter((value): value is string => Boolean(value));
  const transferIds = session.rows
    .map((row) => row.matchedTransferId)
    .filter((value): value is string => Boolean(value));

  const [matchedTransactions, matchedTransfers] = await Promise.all([
    transactionIds.length
      ? prisma.transaction.findMany({
          where: { id: { in: transactionIds } },
          select: {
            id: true,
            transactionDate: true,
            type: true,
            amount: true,
            note: true,
            wallet: {
              select: {
                name: true,
                walletType: true,
                currency: { select: { code: true, symbol: true } },
              },
            },
            payee: { select: { name: true } },
            category: { select: { id: true, name: true } },
            subcategory: { select: { id: true, name: true } },
          },
        })
      : [],
    transferIds.length
      ? prisma.transfer.findMany({
          where: { id: { in: transferIds } },
          select: {
            id: true,
            transferDate: true,
            amount: true,
            origin: true,
            fromWallet: { select: { name: true } },
            toWallet: { select: { name: true } },
          },
        })
      : [],
  ]);

  const transactionById = new Map(matchedTransactions.map((transaction) => [transaction.id, transaction]));
  const transferById = new Map(matchedTransfers.map((transfer) => [transfer.id, transfer]));

  const historicalTransactions = await prisma.transaction.findMany({
    where: { walletId: session.walletId },
    select: {
      type: true,
      payee: { select: { name: true } },
      category: { select: { id: true, name: true } },
      subcategory: { select: { id: true, name: true } },
      note: true,
    },
  });

  return {
    ...session,
    rows: session.rows.map((row) => {
      const matchedTransaction = row.matchedTransactionId ? transactionById.get(row.matchedTransactionId) ?? null : null;
      const matchedTransfer = row.matchedTransferId ? transferById.get(row.matchedTransferId) ?? null : null;
      const expectedType =
        session.sourceType === ReconciliationSourceType.CREDIT_CARD_STATEMENT
          ? TransactionType.EXPENSE
          : row.direction === ReconciliationDirection.CREDIT
            ? TransactionType.INCOME
            : TransactionType.EXPENSE;
      const referenceText = row.description;
      const historical = historicalTransactions
        .filter((tx) => tx.type === expectedType && tx.category)
        .map((tx) => ({
          tx,
          similarity: tokenSimilarity(
            referenceText,
            tx.payee?.name || tx.category?.name || tx.note || "",
          ),
        }))
        .filter((candidate) => candidate.similarity >= 0.35)
        .sort((a, b) => b.similarity - a.similarity)[0]?.tx;
      const suggestedSource = matchedTransaction?.category
        ? {
            categoryId: matchedTransaction.category.id,
            categoryName: matchedTransaction.category.name,
            subcategoryId: matchedTransaction.subcategory?.id ?? null,
            subcategoryName: matchedTransaction.subcategory?.name ?? null,
          }
        : historical?.category
          ? {
              categoryId: historical.category.id,
              categoryName: historical.category.name,
              subcategoryId: historical.subcategory?.id ?? null,
              subcategoryName: historical.subcategory?.name ?? null,
            }
          : null;

      return {
        ...row,
        matchedTransaction,
        matchedTransfer,
        suggestedCategoryId: suggestedSource?.categoryId ?? null,
        suggestedCategoryName: suggestedSource?.categoryName ?? null,
        suggestedSubcategoryId: suggestedSource?.subcategoryId ?? null,
        suggestedSubcategoryName: suggestedSource?.subcategoryName ?? null,
      };
    }),
  };
}

export async function resolveReconciliationRow(input: { rowId: string; resolution: ReconciliationResolution }) {
  const row = await prisma.reconciliationRow.findUnique({ where: { id: input.rowId }, include: { session: true } });
  if (!row) throw new Error("Reconciliation row not found.");

  if (input.resolution === ReconciliationResolution.ACCEPT_MATCH) {
    if (!row.matchedTransactionId && !row.matchedTransferId) throw new Error("This row has no match to accept.");
    await prisma.reconciliationRow.update({ where: { id: row.id }, data: { resolution: ReconciliationResolution.ACCEPT_MATCH } });
    return;
  }
  if (input.resolution === ReconciliationResolution.IGNORE || input.resolution === ReconciliationResolution.KEEP) {
    await prisma.reconciliationRow.update({ where: { id: row.id }, data: { resolution: input.resolution } });
    return;
  }
  if (input.resolution === ReconciliationResolution.DELETE) {
    if (row.sourceSide !== ReconciliationSourceSide.OKANE || !row.matchedTransactionId) throw new Error("Only an OKANE transaction can be deleted from reconciliation.");
    await deleteTransactionService(row.matchedTransactionId);
    await prisma.reconciliationRow.update({ where: { id: row.id }, data: { resolution: ReconciliationResolution.DELETE } });
    return;
  }
  if (input.resolution === ReconciliationResolution.ADD_INCOMPLETE) {
    if (row.sourceSide !== ReconciliationSourceSide.STATEMENT) throw new Error("Only statement rows can be added to OKANE.");
    if (row.session.sourceType === ReconciliationSourceType.CREDIT_CARD_STATEMENT && row.direction === ReconciliationDirection.CREDIT) throw new Error("Credit-card statement credits are not imported as transactions automatically.");
    const type = row.session.sourceType === ReconciliationSourceType.CREDIT_CARD_STATEMENT ? "EXPENSE" : row.direction === ReconciliationDirection.CREDIT ? "INCOME" : "EXPENSE";
    const created = await createTransactionService({ transactionDate: row.transactionDate, type, amount: Number(row.amount), merchant: row.description, walletId: row.session.walletId, note: `Reconciliation import: ${row.session.fileName}` });
    await prisma.reconciliationRow.update({ where: { id: row.id }, data: { resolution: ReconciliationResolution.ADD_INCOMPLETE, createdTransactionId: created.id } });
  }
}

export async function addReconciliationTransaction(input: {
  rowId: string;
  transactionDate: Date;
  amount: number;
  walletId: string;
  type: TransactionType;
  merchant: string;
  categoryId?: string;
  subcategoryId?: string;
  note?: string;
}) {
  const row = await prisma.reconciliationRow.findUnique({
    where: { id: input.rowId },
    include: { session: true },
  });
  if (!row) throw new Error("Reconciliation row not found.");
  if (row.sourceSide !== ReconciliationSourceSide.STATEMENT) throw new Error("Only statement rows can be added to OKANE.");
  if (row.resolution !== ReconciliationResolution.PENDING && row.resolution !== ReconciliationResolution.IGNORE) {
    throw new Error("This reconciliation row has already been resolved.");
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Amount must be greater than zero.");
  if (!input.merchant.trim()) throw new Error("Merchant / Payee is required.");

  if (row.session.sourceType === ReconciliationSourceType.CREDIT_CARD_STATEMENT && row.direction === ReconciliationDirection.CREDIT && input.type === TransactionType.INCOME) {
    throw new Error("Credit-card statement credits are not imported as income automatically. Review or ignore this entry instead.");
  }

  const created = await createTransactionService({
    transactionDate: input.transactionDate,
    type: input.type,
    amount: input.amount,
    merchant: input.merchant.trim(),
    walletId: input.walletId,
    categoryId: input.categoryId || undefined,
    subcategoryId: input.subcategoryId || undefined,
    note: input.note?.trim() || undefined,
  });

  await prisma.reconciliationRow.update({
    where: { id: row.id },
    data: {
      matchStatus: ReconciliationMatchStatus.MATCHED,
      matchConfidence: 100,
      matchReason: "Added to OKANE from statement and confirmed by user.",
      matchedTransactionId: created.id,
      resolution: ReconciliationResolution.ACCEPT_MATCH,
      createdTransactionId: created.id,
    },
  });

  return created;
}

export async function completeReconciliation(id: string) {
  const pending = await prisma.reconciliationRow.count({ where: { sessionId: id, resolution: ReconciliationResolution.PENDING } });
  if (pending > 0) throw new Error(`There are still ${pending} reconciliation rows waiting for a decision.`);
  await prisma.reconciliationSession.update({ where: { id }, data: { status: "COMPLETED" } });
}
