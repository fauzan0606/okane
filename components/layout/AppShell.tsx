import type { ReactNode } from "react";
import MobileNavigation from "./MobileNavigation";

type AppShellProps = {
  sidebar: ReactNode;
  header: ReactNode;
  children: ReactNode;
};

export default function AppShell({ sidebar, header, children }: AppShellProps) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-[#070C12]">
      <MobileNavigation />
      {sidebar}
      <div className="min-h-screen w-full md:pl-[248px]">
        <div className="min-w-0 w-full pt-16 pb-32 md:pt-0 md:pb-0">
          {header}
          <main className="min-h-screen w-full">{children}</main>
        </div>
      </div>
    </div>
  );
}
