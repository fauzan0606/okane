import type { ReactNode } from "react";

type CrudCardProps = {
  children: ReactNode;
};

export default function CrudCard({
  children,
}: CrudCardProps) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </div>
  );
}