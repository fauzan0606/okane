import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";

import WalletList from "@/modules/wallet/components/WalletList";
import WalletForm from "@/modules/wallet/components/WalletForm";

import { listWallets, listCurrencies } from "@/modules/wallet/service";

export default async function WalletPage() {
  const [wallets, currencies] = await Promise.all([
    listWallets(),
    listCurrencies(),
  ]);

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

          <WalletForm
            mode="create"
            currencies={currencies}
            trigger={
              <Button size="lg">
                + Add Wallet
              </Button>
            }
          />
        </div>

        <WalletList wallets={wallets} currencies={currencies} />
      </div>
    </AppShell>
  );
}
