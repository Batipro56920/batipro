import { Activity, LayoutGrid, List } from "lucide-react";
import type { ClientView } from "../types";

const views: Array<{ key: ClientView; label: string; icon: typeof List }> = [
  { key: "list", label: "Liste", icon: List },
  { key: "cards", label: "Cartes", icon: LayoutGrid },
  { key: "activity", label: "Activité", icon: Activity },
];

export function ClientViewSwitcher({ value, onChange }: { value: ClientView; onChange: (value: ClientView) => void }) {
  return (
    <div className="flex rounded-xl border border-slate-200 bg-white p-1">
      {views.map((view) => {
        const Icon = view.icon;
        return (
          <button key={view.key} type="button" onClick={() => onChange(view.key)} className={["inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition", value === view.key ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-50"].join(" ")}>
            <Icon className="h-3.5 w-3.5" />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
