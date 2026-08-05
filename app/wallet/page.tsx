import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

import WalletList from "@/modules/wallet/components/WalletList";

import { listWallets } from "@/modules/wallet/service";

export default async function WalletPage() {
  const wallets = await listWallets();

  return (
    <AppShell
      sidebar={<Sidebar />}
      header={<Header />}
    >
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Wallet
            </h1>

            <p className="mt-2 text-zinc-500">
              Manage your cash, bank accounts, credit cards,
              e-wallets and other financial accounts.
            </p>
          </div>

          <button
            className="rounded-xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700"
            disabled
          >
            + Add Wallet
          </button>
        </div>

        <WalletList wallets={wallets} />
      </div>
    </AppShell>
  );
}