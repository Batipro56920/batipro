import { Columns3, LayoutGrid, List } from "lucide-react";
import type { ProspectView } from "../types";

const views: Array<{ key: ProspectView; label: string; icon: typeof List }> = [
  { key: "list", label: "Liste", icon: List },
  { key: "kanban", label: "Kanban", icon: Columns3 },
  { key: "cards", label: "Cartes", icon: LayoutGrid },
];

export function ProspectViewSwitcher({ value, onChange }: { value: ProspectView; onChange: (value: ProspectView) => void }) {
  return (
    <div className="flex rounded-field border border-subtle bg-surface p-1">
      {views.map((view) => {
        const Icon = view.icon;
        return (
          <button
            key={view.key}
            type="button"
            onClick={() => onChange(view.key)}
            className={["bt-control inline-flex items-center gap-1.5 rounded-field px-2.5 py-1.5 text-xs font-semibold transition", value === view.key ? "bg-primary text-primary-contrast" : "text-ink-secondary hover:bg-interactive"].join(" ")}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
