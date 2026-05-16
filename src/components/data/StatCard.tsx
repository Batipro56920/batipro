import type { ReactNode } from "react";

export function StatCard({ label, value, hint, action }: { label: string; value: ReactNode; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-bt-border bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="bt-meta font-semibold uppercase tracking-[0.16em]">{label}</div>
        {action}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-bt-text">{value}</div>
      {hint ? <div className="mt-1 text-xs text-bt-muted">{hint}</div> : null}
    </div>
  );
}
