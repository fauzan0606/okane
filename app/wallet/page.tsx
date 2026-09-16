import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";

import WalletList from "@/modules/wallet/components/WalletList";
import WalletForm from "@/modules/wallet/components/WalletForm";

import { listWallets, listCurrencies, listWalletHistory } from "@/modules/wallet/service";
import type { WalletClientData } from "@/modules/wallet/repository";

const WALLET_HISTORY_PAGE_SIZE = 20;

function serializeWallets(wallets: Awaited<ReturnType<typeof listWallets>>): WalletClientData[] {
  return wallets.map((wallet) => ({
    ...wallet,
    currentBalance: wallet.currentBalance.toString(),
    creditCard: wallet.creditCard
      ? {
          ...wallet.creditCard,
          creditLimit: wallet.creditCard.creditLimit.toString(),
          rewardPoint: wallet.creditCard.rewardPoint.toString(),
          annualFee: wallet.creditCard.annualFee?.toString() ?? null,
        }
      : null,
  }));
}

export default async function WalletPage() {
  const [wallets, currencies] = await Promise.all([listWallets(), listCurrencies()]);
  const sortedWallets = [...wallets].sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));
  const initialWallet = sortedWallets[0] ?? null;
  const initialHistory = initialWallet ? await listWalletHistory(initialWallet.id) : [];

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <div className="w-full space-y-8 px-4 py-4 md:px-8 md:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Wallet</h1>
            <p className="mt-2 text-zinc-500">Manage your cash, bank accounts, credit cards, e-wallets and other financial accounts.</p>
          </div>

          <WalletForm mode="create" currencies={currencies} trigger={<Button size="lg">+ Add Wallet</Button>} />
        </div>

        <WalletList
          wallets={serializeWallets(sortedWallets)}
          currencies={currencies}
          initialHistory={initialHistory}
          initialWalletId={initialWallet?.id ?? ""}
          pageSize={WALLET_HISTORY_PAGE_SIZE}
        />
      </div>
    </AppShell>
  );
}
