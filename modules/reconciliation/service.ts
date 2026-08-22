import { Prisma, ReconciliationDirection, ReconciliationMatchStatus, ReconciliationResolution, ReconciliationSourceSide, ReconciliationSourceType } from "@prisma/client";
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
function parseValidDate(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
function getValidPeriod(inputPeriod: string | undefined, dates: Date[], mode: "start" | "end") {
  const explicit = parseValidDate(inputPeriod);
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

export async function createReconciliationSession(input: { walletId: string; sourceType: ReconciliationSourceType; fileName: string; rows: ExtractedRow[]; periodStart?: string; periodEnd?: string }) {
  const wallet = await prisma.wallet.findUnique({ where: { id: input.walletId }, select: { id: true, walletType: true } });
  if (!wallet) throw new Error("Wallet not found.");
  if (input.sourceType === ReconciliationSourceType.CREDIT_CARD_STATEMENT && wallet.walletType !== "CREDIT_CARD") throw new Error("Credit Card Statement reconciliation requires a credit card wallet.");
  if (!input.rows.length) throw new Error("No transaction rows were extracted from the statement.");

  const dates = input.rows.map((row) => parseValidDate(row.transactionDate)).filter((date): date is Date => Boolean(date));
  const periodStart = getValidPeriod(input.periodStart, dates, "start");
  const periodEnd = getValidPeriod(input.periodEnd, dates, "end");
  const windowStart = periodStart ? new Date(periodStart.getTime() - 3 * 86400000) : undefined;
  const windowEnd = periodEnd ? new Date(periodEnd.getTime() + 3 * 86400000) : undefined;

  const [transactions, transfers] = await Promise.all([
    prisma.transaction.findMany({ where: { walletId: input.walletId, ...(windowStart && windowEnd ? { transactionDate: { gte: windowStart, lte: windowEnd } } : {}) }, select: { id: true, transactionDate: true, amount: true, type: true, payee: { select: { name: true } }, category: { select: { name: true } }, note: true } }),
    prisma.transfer.findMany({ where: { OR: [{ fromWalletId: input.walletId }, { toWalletId: input.walletId }], ...(windowStart && windowEnd ? { transferDate: { gte: windowStart, lte: windowEnd } } : {}) }, select: { id: true, transferDate: true, amount: true, origin: true, fromWalletId: true, toWalletId: true } }),
  ]);

  const usedTransactionIds = new Set<string>();
  const usedTransferIds = new Set<string>();
  const rowsToCreate: Prisma.ReconciliationRowCreateWithoutSessionInput[] = [];

  for (const raw of input.rows) {
    const date = parseValidDate(raw.transactionDate);
    const amount = new Prisma.Decimal(Math.abs(Number(raw.amount) || 0));
    if (!date || amount.lte(0) || !raw.description.trim()) continue;

    const candidates = transactions
      .filter((tx) => !usedTransactionIds.has(tx.id) && tx.amount.eq(amount) && directionMatches(input.sourceType, raw.direction as ReconciliationDirection, tx.type))
      .map((tx) => ({ tx, distance: dayDistance(date, tx.transactionDate), similarity: tokenSimilarity(raw.description, tx.payee?.name || tx.category?.name || tx.note || "") }))
      .filter((candidate) => candidate.distance <= 3)
      .sort((a, b) => (b.similarity - a.similarity) || (a.distance - b.distance));

    const transferCandidates = transfers
      .filter((transfer) => !usedTransferIds.has(transfer.id) && transfer.amount.eq(amount))
      .map((transfer) => ({ transfer, distance: dayDistance(date, transfer.transferDate) }))
      .filter((candidate) => candidate.distance <= 2)
      .sort((a, b) => a.distance - b.distance);

    const exact = candidates.find((candidate) => candidate.distance === 0 && candidate.similarity >= 0.85);
    const strong = candidates.find((candidate) => candidate.distance === 0 && candidate.similarity >= 0.45);
    const possible = candidates.find((candidate) => candidate.distance <= 2 && candidate.similarity >= 0.3);
    const likelyPaymentTransfer = transferCandidates.find((candidate) => /(payment|bayar|credit card|cc payment)/i.test(raw.entryType || raw.description));
    const dateAmountConflict = transactions.some((tx) => !usedTransactionIds.has(tx.id) && dayDistance(date, tx.transactionDate) === 0 && !tx.amount.eq(amount) && tokenSimilarity(raw.description, tx.payee?.name || tx.category?.name || tx.note || "") >= 0.6);

    let matchStatus: ReconciliationMatchStatus = ReconciliationMatchStatus.STATEMENT_ONLY;
    let confidence = 0;
    let matchedTransactionId: string | null = null;
    let matchedTransferId: string | null = null;
    let reason = "No matching OKANE transaction was found.";
    const match = exact || strong || possible;
    if (match) {
      matchStatus = exact ? ReconciliationMatchStatus.MATCHED : ReconciliationMatchStatus.POSSIBLE_MATCH;
      confidence = exact ? 99 : strong ? 90 : 70;
      matchedTransactionId = match.tx.id;
      reason = `${Math.round(match.similarity * 100)}% merchant similarity, ${match.distance} day date difference, exact amount.`;
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

export async function getReconciliationSession(id: string) {
  return prisma.reconciliationSession.findUnique({ where: { id }, include: { wallet: { select: { name: true, walletType: true, currency: { select: { symbol: true } } } }, rows: { orderBy: [{ sourceSide: "asc" }, { transactionDate: "desc" }, { sourceRowNumber: "asc" }] } } });
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

export async function completeReconciliation(id: string) {
  const pending = await prisma.reconciliationRow.count({ where: { sessionId: id, resolution: ReconciliationResolution.PENDING } });
  if (pending > 0) throw new Error(`There are still ${pending} reconciliation rows waiting for a decision.`);
  await prisma.reconciliationSession.update({ where: { id }, data: { status: "COMPLETED" } });
}
