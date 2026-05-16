import type { ReactNode } from "react";

export default function ListShell({ title, actionLabel, query, setQuery, onCreate, children, hideSearch = false }: { title: string; actionLabel: string; query: string; setQuery: (value: string) => void; onCreate: () => void; children: ReactNode; hideSearch?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex flex-wrap gap-2">
          {!hideSearch ? <input className="rounded-xl border px-3 py-2 text-sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher..." /> : null}
          <button onClick={onCreate} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">{actionLabel}</button>
        </div>
      </div>
      {children}
    </div>
  );
}
