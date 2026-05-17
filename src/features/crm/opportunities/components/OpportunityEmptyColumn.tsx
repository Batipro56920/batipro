import { Inbox } from "lucide-react";

export function OpportunityEmptyColumn() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 p-5 text-center">
      <Inbox className="mx-auto h-6 w-6 text-slate-300" />
      <div className="mt-2 text-sm font-medium text-slate-700">Aucune opportunité</div>
    </div>
  );
}
