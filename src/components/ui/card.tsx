import type { HTMLAttributes, ReactNode } from "react";

export function Card({ className = "", children, ...props }: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={`rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 ${className}`} {...props}>
      {children}
    </div>
  );
}
