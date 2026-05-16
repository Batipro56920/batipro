import type { ReactNode } from "react";

export function MultiSelect({ children }: { children: ReactNode }) {
  return <div className="rounded-input border border-bt-border bg-white p-2">{children}</div>;
}
