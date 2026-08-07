import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

import { Button } from "@/components/ui/button";

import CategoryForm from "@/modules/category/components/CategoryForm";
import CategoryList from "@/modules/category/components/CategoryList";

import { listCategories } from "@/modules/category/service";

export default async function CategoryPage() {
  const categories = await listCategories();

  return (
    <AppShell
      sidebar={<Sidebar />}
      header={<Header />}
    >
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">
              Category
            </h1>

            <p className="mt-2 text-zinc-500">
              Manage your income and expense categories.
            </p>
          </div>

          <CategoryForm
            mode="create"
            trigger={
              <Button size="lg">
                + Add Category
              </Button>
            }
          />
        </div>

        <CategoryList
          categories={categories}
        />
      </div>
    </AppShell>
  );
}