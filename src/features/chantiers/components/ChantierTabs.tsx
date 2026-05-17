import type { ChantierTabKey } from "../types";

export type ChantierTabEntry = { key: ChantierTabKey; label: string };
export type ChantierTabSection = { title: string; tabs: ChantierTabEntry[] };

export function ChantierTabs({
  overviewTab,
  sections,
  activeTab,
  onChange,
}: {
  overviewTab: ChantierTabEntry;
  sections: ChantierTabSection[];
  activeTab: ChantierTabKey;
  onChange: (tab: ChantierTabKey) => void;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => onChange(overviewTab.key)}
        className={[
          "rounded-xl px-3 py-2 text-left text-sm font-semibold transition",
          activeTab === overviewTab.key
            ? "bg-slate-950 text-white shadow-sm"
            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
        ].join(" ")}
      >
        {overviewTab.label}
      </button>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {sections.map((section) => (
          <section key={section.title} className="min-w-fit rounded-2xl border border-slate-200 bg-slate-50/70 p-2">
            <div className="flex items-center gap-2">
              <div className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{section.title}</div>
              <nav className="flex gap-1">
                {section.tabs.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => onChange(entry.key)}
                    className={[
                      "rounded-xl px-3 py-2 text-sm font-medium transition",
                      activeTab === entry.key
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {entry.label}
                  </button>
                ))}
              </nav>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
