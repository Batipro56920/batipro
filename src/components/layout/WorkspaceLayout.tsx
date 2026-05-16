import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function WorkspaceLayout({ left, center, right, className }: { left?: ReactNode; center: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("grid min-h-0 gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]", className)}>
      {left ? <aside className="min-w-0">{left}</aside> : null}
      <main className="min-w-0">{center}</main>
      {right ? <aside className="min-w-0">{right}</aside> : null}
    </div>
  );
}
