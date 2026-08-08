import type { CategoryWithRelations } from "../repository";

import CategoryCard from "./CategoryCard";

type CategoryListProps = {
  categories: CategoryWithRelations[];
};

export default function CategoryList({ categories }: CategoryListProps) {
  if (categories.length === 0) {
    return (
      <div className="rounded-[20px] border border-dashed border-white/10 bg-[#0E151E] p-12 text-center text-white">
        <h2 className="text-xl font-semibold">No category yet</h2>
        <p className="mt-2 text-slate-500">Start by creating your first category.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}
