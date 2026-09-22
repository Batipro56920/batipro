import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { extractTextFromPdf } from "../../../services/pdfText.service";
import {
  extractTasksFromDevisText,
  extractTasksFromDevisTextSimple,
  normalizeDevisText,
  type TaskLine,
} from "../../../services/devisTasksExtraction.service";

export type SubcontractedUnit = "u" | "ml" | "m2" | "m3" | "h";

/** Une tache lue dans le devis du sous-traitant, prete a entrer dans le pre-devis. */
export type SubcontractedTaskDraft = {
  title: string;
  quantity: number;
  unit: SubcontractedUnit;
  /** Ce que le sous-traitant facture, HT, par unite. */
  unitCostHt: number | null;
  technicalNotes: string;
};

type Row = SubcontractedTaskDraft & { id: string; include: boolean; sourceLine: string };

function toUnit(value: string | null | undefined): SubcontractedUnit {
  const unit = String(value ?? "").trim().toLowerCase();
  if (unit === "m2" || unit === "ml" || unit === "m3" || unit === "h") return unit;
  return "u";
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function euro(value: number) {
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

function rowFromLine(line: TaskLine, index: number): Row {
  const quantity = Number(line.quantity ?? 0) > 0 ? Number(line.quantity) : 1;
  // Le prix unitaire quand le devis le donne, sinon le total ramene a l'unite.
  const unitCost =
    line.unit_price_ht !== null && line.unit_price_ht > 0
      ? line.unit_price_ht
      : line.total_price_ht !== null && line.total_price_ht > 0
        ? round2(line.total_price_ht / quantity)
        : null;
  return {
    id: `st-${index}-${crypto.randomUUID()}`,
    include: true,
    title: line.title,
    quantity,
    unit: toUnit(line.unit),
    unitCostHt: unitCost,
    technicalNotes: [line.description_technique, ...(line.caracteristiques ?? [])].filter(Boolean).join("\n"),
    sourceLine: line.source_line,
  };
}

/**
 * Lit le devis d'un sous-traitant et en fait des taches du pre-devis. Chaque
 * ligne du devis devient une tache au prix du sous-traitant ; la marge de la
 * section fait ensuite le prix de vente. Rien n'est cree tant que l'utilisateur
 * n'a pas relu et valide la liste.
 */
export default function SubcontractorQuoteImportDialog({
  file,
  sectionTitle,
  marginRate,
  onCancel,
  onConfirm,
}: {
  file: File;
  sectionTitle: string;
  marginRate: number;
  onCancel: () => void;
  onConfirm: (tasks: SubcontractedTaskDraft[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [analyzing, setAnalyzing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function analyze() {
      setAnalyzing(true);
      setError(null);
      setWarning(null);
      try {
        const cleaned = normalizeDevisText(await extractTextFromPdf(file));
        let lines: TaskLine[] = [];
        try {
          lines = await extractTasksFromDevisText(cleaned);
        } catch (reason) {
          lines = extractTasksFromDevisTextSimple(cleaned);
          if (alive) setWarning(`Lecture IA indisponible (${reason instanceof Error ? reason.message : "erreur"}). Lecture simple du texte.`);
        }
        if (!lines.length) throw new Error("Aucune ligne de travaux lisible dans ce devis.");
        if (alive) setRows(lines.map(rowFromLine));
      } catch (reason) {
        if (alive) setError(reason instanceof Error ? reason.message : "Lecture du PDF impossible.");
      } finally {
        if (alive) setAnalyzing(false);
      }
    }
    void analyze();
    return () => {
      alive = false;
    };
  }, [file]);

  function patchRow(id: string, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  const selected = rows.filter((row) => row.include);
  const totalCost = selected.reduce((sum, row) => sum + Number(row.unitCostHt ?? 0) * row.quantity, 0);
  const totalSale = totalCost * (1 + Math.max(0, marginRate) / 100);
  const inputClass = "h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-500";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[95dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Devis sous-traitant</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{sectionTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {file.name} · marge appliquee {marginRate.toLocaleString("fr-FR")} %. Relis chaque ligne avant de creer les taches.
            </p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {analyzing ? (
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin" />Lecture du devis en cours...
            </div>
          ) : null}
          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
          {warning ? <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">{warning}</div> : null}

          {!analyzing && rows.length ? (
            <div className="space-y-2">
              <div className="hidden grid-cols-[auto_minmax(0,1fr)_80px_70px_110px_110px] gap-2 px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:grid">
                <span />
                <span>Tache</span>
                <span>Qte</span>
                <span>Unite</span>
                <span>Prix ST HT/u</span>
                <span>Vente HT/u</span>
              </div>
              {rows.map((row) => {
                const sale = row.unitCostHt !== null && row.unitCostHt > 0 ? round2(row.unitCostHt * (1 + Math.max(0, marginRate) / 100)) : null;
                return (
                  <div key={row.id} className={`grid grid-cols-1 gap-2 rounded-xl border p-2 sm:grid-cols-[auto_minmax(0,1fr)_80px_70px_110px_110px] sm:items-center ${row.include ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50 opacity-60"}`}>
                    <input type="checkbox" className="h-4 w-4" checked={row.include} onChange={(event) => patchRow(row.id, { include: event.target.checked })} aria-label="Garder cette ligne" />
                    <div className="min-w-0">
                      <input className={inputClass} value={row.title} onChange={(event) => patchRow(row.id, { title: event.target.value })} />
                      <div className="mt-1 truncate text-[11px] text-slate-400" title={row.sourceLine}>{row.sourceLine}</div>
                    </div>
                    <input
                      type="number"
                      step="0.01"
                      className={inputClass}
                      value={row.quantity}
                      onChange={(event) => patchRow(row.id, { quantity: Math.max(0, Number(event.target.value) || 0) })}
                      aria-label="Quantite"
                    />
                    <select className={inputClass} value={row.unit} onChange={(event) => patchRow(row.id, { unit: event.target.value as SubcontractedUnit })} aria-label="Unite">
                      <option value="u">U</option><option value="ml">ml</option><option value="m2">m2</option><option value="m3">m3</option><option value="h">h</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      className={`${inputClass} ${row.unitCostHt === null ? "border-amber-300" : ""}`}
                      value={row.unitCostHt ?? ""}
                      placeholder="A saisir"
                      onChange={(event) => patchRow(row.id, { unitCostHt: event.target.value === "" ? null : Math.max(0, Number(event.target.value) || 0) })}
                      aria-label="Prix du sous-traitant HT par unite"
                    />
                    <div className="text-sm font-semibold text-slate-900">{sale === null ? "—" : euro(sale)}</div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <div className="text-sm text-slate-600">
            {selected.length} tache(s) · sous-traitant <span className="font-semibold text-slate-900">{euro(round2(totalCost))}</span> · vente{" "}
            <span className="font-semibold text-slate-900">{euro(round2(totalSale))}</span>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Annuler
            </button>
            <button
              type="button"
              disabled={analyzing || !selected.length}
              onClick={() =>
                onConfirm(
                  selected.map(({ title, quantity, unit, unitCostHt, technicalNotes }) => ({
                    title: title.trim() || "Prestation sous-traitee",
                    quantity,
                    unit,
                    unitCostHt,
                    technicalNotes,
                  })),
                )
              }
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />Creer {selected.length} tache(s)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
