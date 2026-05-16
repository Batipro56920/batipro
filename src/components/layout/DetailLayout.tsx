import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function DetailLayout({ main, aside, className }: { main: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]", className)}>
      <main className="min-w-0">{main}</main>
      {aside ? <aside className="min-w-0">{aside}</aside> : null}
    </div>
  );
}
