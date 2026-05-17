import type { ChantierTabKey } from "../types";

export type ChantierSecondaryItem = {
  id?: string;
  key: ChantierTabKey;
  label: string;
  enabled: boolean;
};

export function ChantierSecondaryNav({
  items,
  activeTab,
  onChange,
}: {
  items: ChantierSecondaryItem[];
  activeTab: ChantierTabKey;
  onChange: (tab: ChantierTabKey) => void;
}) {
  const visibleItems = items.filter((item) => item.enabled);
  if (visibleItems.length <= 1) return null;

  return (
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-2" aria-label="Navigation chantier secondaire">
      {visibleItems.map((item) => (
        <button
          key={item.id ?? item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={[
            "rounded-xl px-3 py-2 text-sm font-medium transition",
            activeTab === item.key ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
          ].join(" ")}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}
