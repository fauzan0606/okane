import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { getLatestReconciliationSession, getReconciliationFormData, getReconciliationSession } from "@/modules/reconciliation/service";
import ReconciliationClient from "@/modules/reconciliation/components/ReconciliationClient";

export const dynamic = "force-dynamic";

function serializeSession(session: Awaited<ReturnType<typeof getReconciliationSession>>) {
  if (!session) return null;
  return {
    id: session.id,
    fileName: session.fileName,
    sourceType: session.sourceType,
    status: session.status,
    extractedCount: session.extractedCount,
    wallet: {
      name: session.wallet.name,
      walletType: session.wallet.walletType,
      currency: { symbol: session.wallet.currency.symbol },
    },
    rows: session.rows.map((row) => ({
      id: row.id,
      sourceSide: row.sourceSide,
      sourceRowNumber: row.sourceRowNumber,
      pageNumber: row.pageNumber,
      transactionDate: row.transactionDate.toISOString(),
      description: row.description,
      amount: row.amount.toString(),
      direction: row.direction,
      entryType: row.entryType,
      matchStatus: row.matchStatus,
      matchConfidence: row.matchConfidence,
      matchReason: row.matchReason,
      suggestedCategoryId: row.suggestedCategoryId ?? null,
      suggestedCategoryName: row.suggestedCategoryName ?? null,
      suggestedSubcategoryId: row.suggestedSubcategoryId ?? null,
      suggestedSubcategoryName: row.suggestedSubcategoryName ?? null,
      matchedTransactionId: row.matchedTransactionId,
      matchedTransaction: row.matchedTransaction
        ? {
            id: row.matchedTransaction.id,
            transactionDate: row.matchedTransaction.transactionDate.toISOString(),
            type: row.matchedTransaction.type,
            amount: row.matchedTransaction.amount.toString(),
            note: row.matchedTransaction.note,
            wallet: {
              name: row.matchedTransaction.wallet.name,
              walletType: row.matchedTransaction.wallet.walletType,
              currency: {
                code: row.matchedTransaction.wallet.currency.code,
                symbol: row.matchedTransaction.wallet.currency.symbol,
              },
            },
            payee: row.matchedTransaction.payee ? { name: row.matchedTransaction.payee.name } : null,
            category: row.matchedTransaction.category ? { name: row.matchedTransaction.category.name } : null,
            subcategory: row.matchedTransaction.subcategory ? { name: row.matchedTransaction.subcategory.name } : null,
          }
        : null,
      matchedTransfer: row.matchedTransfer
        ? {
            id: row.matchedTransfer.id,
            transferDate: row.matchedTransfer.transferDate.toISOString(),
            amount: row.matchedTransfer.amount.toString(),
            origin: row.matchedTransfer.origin,
            fromWallet: row.matchedTransfer.fromWallet.name,
            toWallet: row.matchedTransfer.toWallet.name,
          }
        : null,
      resolution: row.resolution,
    })),
  };
}

export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<{ session?: string; new?: string }> }) {
  const params = await searchParams;
  const draft = !params.session && params.new !== "1" ? await getLatestReconciliationSession() : null;
  const sessionId = params.session ?? draft?.id;
  const [{ wallets, categories, subcategories }, session] = await Promise.all([
    getReconciliationFormData(),
    sessionId ? getReconciliationSession(sessionId) : Promise.resolve(null),
  ]);

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <ReconciliationClient wallets={wallets} categories={categories} subcategories={subcategories} session={serializeSession(session)} />
    </AppShell>
  );
}
