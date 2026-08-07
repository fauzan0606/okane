import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

import { Button } from "@/components/ui/button";

import PayeeForm from "@/modules/payee/components/PayeeForm";
import PayeeList from "@/modules/payee/components/PayeeList";

import { listPayees } from "@/modules/payee/service";

export default async function PayeePage() {
  const payees = await listPayees();

  return (
    <AppShell
      sidebar={<Sidebar />}
      header={<Header />}
    >
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Payee
            </h1>

            <p className="mt-2 text-zinc-500">
              Manage merchants, people and organizations you transact with.
            </p>
          </div>

          <PayeeForm
            mode="create"
            trigger={
              <Button size="lg">
                + Add Payee
              </Button>
            }
          />
        </div>

        <PayeeList
          payees={payees}
        />
      </div>
    </AppShell>
  );
}