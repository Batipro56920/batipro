import type { SavWithContext } from "../types";
import { SavPriorityChip } from "./SavStatusChip";

const columns = [
  { key: "nouveau", label: "Nouveau" },
  { key: "qualifie", label: "Qualifié" },
  { key: "planifie", label: "Planifié" },
  { key: "en_cours", label: "En intervention" },
  { key: "en_attente_client", label: "En attente client" },
  { key: "resolu", label: "Résolu" },
  { key: "clos", label: "Fermé" },
];

export function SavKanban({ rows, onSelect }: { rows: SavWithContext[]; onSelect: (row: SavWithContext) => void }) {
  return (
    <section className="overflow-x-auto rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="grid min-w-[1400px] gap-3 xl:grid-cols-7">
        {columns.map((column) => {
          const colRows = rows.filter((row) => row.statut === column.key || (column.key === "nouveau" && !columns.some((item) => item.key === row.statut)));
          return (
            <div key={column.key} className="min-h-[420px] rounded-3xl border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-slate-950">{column.label}</div>
                <div className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600">{colRows.length}</div>
              </div>
              <div className="mt-3 space-y-2">
                {colRows.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">Aucun ticket</div> : colRows.map((row) => (
                  <button key={row.id} type="button" onClick={() => onSelect(row)} className="block w-full rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-blue-200 hover:bg-blue-50/30">
                    <div className="font-medium text-slate-950">{row.titre}</div>
                    <div className="mt-1 text-xs text-slate-500">{row.clientLabel} · {row.chantierLabel}</div>
                    <div className="mt-3"><SavPriorityChip priority={row.urgence} /></div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
