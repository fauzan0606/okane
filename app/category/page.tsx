import AppShell from "@/components/layout/AppShell";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";

import CategoryForm from "@/modules/category/components/CategoryForm";
import CategoryList from "@/modules/category/components/CategoryList";
import { listCategories } from "@/modules/category/service";

export default async function CategoryPage() {
  const categories = await listCategories();

  return (
    <AppShell sidebar={<Sidebar />} header={<Header />}>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Category</h1>
            <p className="mt-2 text-slate-400">Manage your income and expense categories.</p>
          </div>
          <CategoryForm
            mode="create"
            trigger={
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-bold text-[#07110b] shadow-[0_10px_24px_rgba(16,185,129,0.12)] hover:bg-emerald-400"
              >
                + Add Category
              </button>
            }
          />
        </div>

        <CategoryList categories={categories} />
      </div>
    </AppShell>
  );
}
