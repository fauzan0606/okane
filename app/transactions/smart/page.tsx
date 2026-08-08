import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

import { prisma } from "@/lib/prisma";

import SmartTransactionPage from "@/modules/parser/components/SmartTransactionPage";

export default async function Page() {
  const [wallets, categories] =
    await Promise.all([
      prisma.wallet.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),

      prisma.category.findMany({
        where: {
          isActive: true,
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
    ]);

  return (
    <AppShell
      sidebar={<Sidebar />}
      header={<Header />}
    >
      <SmartTransactionPage
        wallets={wallets}
        categories={categories}
      />
    </AppShell>
  );
}