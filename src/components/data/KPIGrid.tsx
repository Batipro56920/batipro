import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function KPIGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}
