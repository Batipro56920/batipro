import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export function CrmEmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center text-sm text-slate-500">
      <Inbox className="mx-auto h-7 w-7 text-slate-300" />
      <div className="mt-3 font-semibold text-slate-900">{title}</div>
      {description ? <div className="mx-auto mt-1 max-w-md">{description}</div> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
