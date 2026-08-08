import type { ReactNode } from "react";

type AppShellProps = {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
};

export default function AppShell({ sidebar, header, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-[#070C12]">
      <div className="flex min-h-screen items-start">
        {sidebar}

        <div className="min-w-0 flex-1">
          {header}
          <main className="min-h-screen">{children}</main>
        </div>
      </div>
    </div>
  );
}
