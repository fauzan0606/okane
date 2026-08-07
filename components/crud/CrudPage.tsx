import type { ReactNode } from "react";

type CrudPageProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
};

export default function CrudPage({
  title,
  description,
  action,
  children,
}: CrudPageProps) {
  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">
            {title}
          </h1>

          {description && (
            <p className="mt-2 text-zinc-500">
              {description}
            </p>
          )}
        </div>

        {action}
      </div>

      {children}
    </div>
  );
}