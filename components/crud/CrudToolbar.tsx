import type { ReactNode } from "react";

type CrudToolbarProps = {
  left?: ReactNode;
  right?: ReactNode;
};

export default function CrudToolbar({
  left,
  right,
}: CrudToolbarProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>{left}</div>

      <div className="flex items-center gap-2">
        {right}
      </div>
    </div>
  );
}