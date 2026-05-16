import type { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "../../lib/cn";

export function EmptyState({ title, description, action, className }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-card border border-dashed border-bt-border bg-bt-surface p-8 text-center", className)}>
      <Inbox className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
      <div className="mt-3 bt-card-title">{title}</div>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-bt-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
