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
    <>
      <button
        type="button"
        onClick={() => onChange(overviewTab.key)}
        className={[
          "w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition",
          activeTab === overviewTab.key
            ? "border-blue-600 bg-blue-600 text-white shadow-sm"
            : "border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100",
        ].join(" ")}
      >
        {overviewTab.label}
      </button>

      <div className="grid gap-3 xl:grid-cols-4">
        {sections.map((section) => (
          <section key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
            <div className="space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{section.title}</div>
              <nav className="flex flex-wrap gap-2">
                {section.tabs.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => onChange(entry.key)}
                    className={[
                      "rounded-full px-4 py-2 text-sm font-medium transition",
                      activeTab === entry.key
                        ? "bg-blue-600 text-white shadow-sm"
                        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
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
    </>
  );
}
