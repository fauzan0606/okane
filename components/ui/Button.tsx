import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement>;

export default function Button({
  className = "",
  children,
  ...props
}: Props) {
  return (
    <button
      {...props}
      className={`
        rounded-2xl
        px-5
        py-3
        font-semibold
        transition-all
        hover:scale-[1.02]
        active:scale-95
        ${className}
      `}
      style={{
        background: "var(--ok-primary)",
        color: "white",
      }}
    >
      {children}
    </button>
  );
}