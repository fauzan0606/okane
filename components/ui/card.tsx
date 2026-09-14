import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
};

export default function Card({
  children,
  className = "",
}: CardProps) {
  return (
    <div
      className={`
        rounded-3xl
        border
        p-6
        shadow-xl
        ${className}
      `}
      style={{
        background: "var(--ok-card)",
        borderColor: "var(--ok-border)",
      }}
    >
      {children}
    </div>
  );
}