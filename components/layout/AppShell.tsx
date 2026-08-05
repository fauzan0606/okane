import type { ReactNode } from "react";

type AppShellProps = {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
};

export default function AppShell({
  sidebar,
  header,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen">

      {sidebar}

      <div className="flex flex-1 flex-col">

        {header}

        <main className="flex-1">
          {children}
        </main>

      </div>

    </div>
  );
}