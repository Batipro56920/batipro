import { useEffect, useMemo, useState } from "react";

import {
  getChantierPreparationChecklist,
  upsertChantierPreparationChecklist,
  type ChantierPreparationChecklistRow,
} from "../../services/chantierPreparation.service";

const PREPARATION_FIELDS = [
  { key: "plans_disponibles", label: "Plans disponibles" },
  { key: "materiaux_commandes", label: "Materiaux commandes" },
  { key: "materiel_prevu", label: "Materiel prevu" },
  { key: "intervenants_affectes", label: "Intervenants affectes" },
  { key: "acces_chantier_valide", label: "Acces chantier valide" },
] as const;

function preparationProgress(checklist: ChantierPreparationChecklistRow) {
  const doneCount = PREPARATION_FIELDS.filter((field) => Boolean(checklist[field.key])).length;
  return Math.round((doneCount / PREPARATION_FIELDS.length) * 100);
}

type PreparationChecklistTabProps = {
  chantierId: string;
};

export default function PreparationChecklistTab({ chantierId }: PreparationChecklistTabProps) {
  const [checklist, setChecklist] = useState<ChantierPreparationChecklistRow | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const percentReady = useMemo(() => (checklist ? preparationProgress(checklist) : 0), [checklist]);

  useEffect(() => {
    let alive = true;

    async function refreshPreparation() {
      setLoading(true);
      setError(null);
      try {
        const result = await getChantierPreparationChecklist(chantierId);
        if (!alive) return;
        setChecklist(result.checklist);
        setSchemaReady(result.schemaReady);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Erreur chargement preparation.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void refreshPreparation();
    return () => {
      alive = false;
    };
  }, [chantierId]);

  async function toggleChecklistField(field: (typeof PREPARATION_FIELDS)[number]["key"], value: boolean) {
    if (!checklist) return;
    setSaving(true);
    setError(null);
    const previous = checklist;
    setChecklist((current) => (current ? { ...current, [field]: value } : current));
    try {
      const saved = await upsertChantierPreparationChecklist(chantierId, { [field]: value });
      setChecklist(saved);
    } catch (e: any) {
      setChecklist(previous);
      setError(e?.message ?? "Erreur mise a jour checklist.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Preparer</div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Checklist avant demarrage</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Valide les prerequis terrain avant de lancer l'execution du chantier.
          </p>
        </div>
        <div
          className={[
            "rounded-full border px-3 py-1 text-xs font-semibold",
            checklist?.statut === "chantier_pret"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700",
          ].join(" ")}
        >
          {checklist?.statut === "chantier_pret" ? "Chantier pret" : "Chantier incomplet"}
        </div>
      </div>

      {!schemaReady ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Migration preparation non appliquee : checklist visible mais non sauvegardable.
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 rounded-3xl bg-slate-50 p-4">
        <div className="flex items-center justify-between text-xs font-medium text-slate-500">
          <span>Progression de preparation</span>
          <span>{percentReady}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
          <div
            className={[
              "h-full rounded-full transition-all",
              percentReady >= 100 ? "bg-emerald-500" : "bg-blue-600",
            ].join(" ")}
            style={{ width: `${percentReady}%` }}
          />
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loading || !checklist ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
            Chargement de la checklist...
          </div>
        ) : (
          PREPARATION_FIELDS.map((field) => (
            <label
              key={field.key}
              className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm"
            >
              <input
                type="checkbox"
                checked={Boolean(checklist[field.key])}
                disabled={saving || !schemaReady}
                onChange={(event) => void toggleChecklistField(field.key, event.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="font-medium">{field.label}</span>
            </label>
          ))
        )}
      </div>
    </section>
  );
}

