import type { ReactNode } from "react";

type CrudCardProps = {
  children: ReactNode;
};

export default function CrudCard({ children }: CrudCardProps) {
  return (
    <div className="rounded-[20px] border border-white/10 bg-[#0E151E] p-6 text-white shadow-[0_12px_35px_rgba(0,0,0,0.16)] transition hover:border-white/15 hover:bg-[#111923]">
      {children}
    </div>
  );
}
