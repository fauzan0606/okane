import type { CategoryWithRelations } from "../repository";
import { formatCategoryType } from "../constants";

import CategoryCardActions from "./CategoryCardActions";

type CategoryCardProps = {
  category: CategoryWithRelations;
};

export default function CategoryCard({
  category,
}: CategoryCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {category.name}
          </h3>

          <p className="mt-1 text-sm text-zinc-500">
            {formatCategoryType(category.type)}
          </p>
        </div>

        <CategoryCardActions
  category={category}
/>
      </div>

      {(category.color || category.icon) && (
        <div className="mt-6 flex items-center gap-2">
          {category.color && (
            <div
              className="h-4 w-4 rounded-full border"
              style={{
                backgroundColor: category.color,
              }}
            />
          )}

          {category.icon && (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {category.icon}
            </span>
          )}
        </div>
      )}
    </div>
  );
}