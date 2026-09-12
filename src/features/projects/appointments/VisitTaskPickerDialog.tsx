import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import type { TaskTemplateRow } from "../../../services/taskLibrary.service";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const UNGROUPED = "Sans lot";

/**
 * Choix de plusieurs taches de la bibliotheque pour une section du pre-devis.
 * Sur le terrain on remplit une section d'un coup — "electricite : ces six
 * taches" — plutot qu'en ajoutant une ligne vide puis en la reliant six fois.
 */
export default function VisitTaskPickerDialog({
  sectionTitle,
  templates,
  onCancel,
  onConfirm,
}: {
  sectionTitle: string;
  templates: TaskTemplateRow[];
  onCancel: () => void;
  onConfirm: (templateIds: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const groups = useMemo(() => {
    const terms = normalize(search).split(" ").filter(Boolean);
    const matching = templates.filter((row) => {
      if (!terms.length) return true;
      const haystack = normalize([row.titre, row.lot, row.unite].filter(Boolean).join(" "));
      return terms.every((term) => haystack.includes(term));
    });

    const byLot = new Map<string, TaskTemplateRow[]>();
    for (const row of matching) {
      const lot = row.lot?.trim() || UNGROUPED;
      const bucket = byLot.get(lot);
      if (bucket) bucket.push(row);
      else byLot.set(lot, [row]);
    }
    return Array.from(byLot, ([lot, rows]) => ({ lot, rows })).sort((a, b) => a.lot.localeCompare(b.lot, "fr"));
  }, [templates, search]);

  const matchingCount = groups.reduce((sum, group) => sum + group.rows.length, 0);

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Ajouter des tâches</div>
            <h3 className="mt-1 truncate text-lg font-semibold text-slate-950">{sectionTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <input
              autoFocus
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              placeholder="Rechercher une tâche ou un lot..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {matchingCount === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              {templates.length ? "Aucune tâche ne correspond à cette recherche." : "La bibliothèque de tâches est vide."}
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.lot} className="mb-2">
                <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{group.lot}</div>
                {group.rows.map((row) => {
                  const isSelected = selected.includes(row.id);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => toggle(row.id)}
                      className={[
                        "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left",
                        isSelected ? "bg-blue-50" : "hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                          isSelected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white",
                        ].join(" ")}
                      >
                        {isSelected ? <Check className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900">{row.titre}</span>
                        <span className="block text-xs text-slate-500">
                          {[row.unite ? `unité ${row.unite}` : null, row.temps_prevu_par_unite_h ? `${row.temps_prevu_par_unite_h} h / unité` : null]
                            .filter(Boolean)
                            .join(" · ") || "Sans temps de référence"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-4">
          <div className="text-sm text-slate-500">
            {selected.length ? `${selected.length} tâche(s) sélectionnée(s)` : "Cochez les tâches à ajouter"}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => onConfirm(selected)}
              disabled={selected.length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              <Plus className="h-4 w-4" />
              Ajouter {selected.length || ""}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
