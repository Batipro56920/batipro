import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Topbar({ left, center, right, className }: { left?: ReactNode; center?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-14 items-center gap-3 px-4", className)}>
      <div className="min-w-0 shrink-0">{left}</div>
      <div className="min-w-0 flex-1">{center}</div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </div>
  );
}
