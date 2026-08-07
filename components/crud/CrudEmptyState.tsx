import type { ReactNode } from "react";

type CrudEmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export default function CrudEmptyState({
  title,
  description,
  action,
}: CrudEmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <h2 className="text-xl font-semibold">
        {title}
      </h2>

      <p className="mt-2 text-zinc-500">
        {description}
      </p>

      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  );
}