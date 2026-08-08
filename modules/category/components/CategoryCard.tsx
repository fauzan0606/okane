import type { CategoryWithRelations } from "../repository";
import { formatCategoryType } from "../constants";

import CategoryCardActions from "./CategoryCardActions";

type CategoryCardProps = {
  category: CategoryWithRelations;
};

export default function CategoryCard({ category }: CategoryCardProps) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-[#0E151E] p-6 text-white shadow-[0_12px_35px_rgba(0,0,0,0.16)] transition hover:border-white/15 hover:bg-[#111923]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-white">{category.name}</h3>
          <p className="mt-1 text-sm text-slate-500">{formatCategoryType(category.type)}</p>
        </div>
        <CategoryCardActions category={category} />
      </div>

      {(category.color || category.icon) && (
        <div className="mt-6 flex items-center gap-2">
          {category.color && (
            <div className="h-4 w-4 rounded-full border border-white/15" style={{ backgroundColor: category.color }} />
          )}
          {category.icon && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
              {category.icon}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
