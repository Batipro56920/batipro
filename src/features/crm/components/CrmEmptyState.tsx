import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function CrmEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-subtle bg-interactive p-4 text-center text-sm text-muted">
      <Inbox className="mx-auto h-7 w-7 text-muted" strokeWidth={1.75} />
      <div className="mt-3 font-semibold text-ink">{title}</div>
      {description ? <div className="mx-auto mt-1 max-w-md">{description}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
