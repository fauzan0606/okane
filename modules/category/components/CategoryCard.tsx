import type { CategoryWithRelations } from "../repository";
import { formatCategoryType } from "../constants";

import CategoryCardActions from "./CategoryCardActions";

type CategoryCardProps = {
  category: CategoryWithRelations;
};

export default function CategoryCard({ category }: CategoryCardProps) {
  const color = category.color || "#64748B";

  return (
    <div className="rounded-[20px] border border-white/10 bg-[#0E151E] p-6 text-white shadow-[0_12px_35px_rgba(0,0,0,0.16)] transition hover:border-white/15 hover:bg-[#111923]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border"
            style={{
              backgroundColor: `${color}18`,
              borderColor: `${color}55`,
              color,
            }}
            aria-hidden="true"
          >
            <span className="text-xl leading-none">{category.icon || "•"}</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white">{category.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{formatCategoryType(category.type)}</p>
          </div>
        </div>
        <CategoryCardActions category={category} />
      </div>
    </div>
  );
}
