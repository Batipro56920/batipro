import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

type AppShellProps = {
  sidebar?: ReactNode;
  topbar?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AppShell({ sidebar, topbar, children, className }: AppShellProps) {
  return (
    <div className={cn("min-h-dvh bg-bt-background text-bt-text", className)}>
      <div className="grid min-h-dvh lg:grid-cols-[260px_minmax(0,1fr)]">
        {sidebar ? <aside className="hidden border-r border-bt-border bg-bt-surface lg:block">{sidebar}</aside> : null}
        <main className="min-w-0">
          {topbar ? <div className="sticky top-0 z-30 border-b border-bt-border bg-bt-surface/95 backdrop-blur">{topbar}</div> : null}
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
