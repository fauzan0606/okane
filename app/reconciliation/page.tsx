import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { getReconciliationFormData, getReconciliationSession } from "@/modules/reconciliation/service";
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
      matchedTransactionId: row.matchedTransactionId,
      resolution: row.resolution,
    })),
  };
}

export default async function ReconciliationPage({ searchParams }: { searchParams: Promise<{ session?: string }> }) {
  const params = await searchParams;
  const [{ wallets, categories, subcategories }, session] = await Promise.all([
    getReconciliationFormData(),
    params.session ? getReconciliationSession(params.session) : Promise.resolve(null),
  ]);

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <ReconciliationClient wallets={wallets} categories={categories} subcategories={subcategories} session={serializeSession(session)} />
    </AppShell>
  );
}
