import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  listTerrainFeedbacks,
  type TerrainFeedbackRow,
} from "../../../services/terrainFeedback.service";

const OPEN_STATUSES = new Set(["nouveau", "en_cours"]);
const PRIORITY_URGENCIES = new Set(["critique", "urgente"]);

const CATEGORY_LABELS: Record<string, string> = {
  observation_chantier: "Observation",
  anomalie: "Anomalie",
  blocage: "Blocage",
  suggestion: "Suggestion",
  qualite: "Qualité",
  securite: "Sécurité",
  client: "Client",
  organisation: "Organisation",
};

const URGENCY_STYLES: Record<string, string> = {
  critique: "border-red-300 bg-red-50 text-red-800",
  urgente: "border-red-200 bg-red-50 text-red-700",
  normale: "border-slate-200 bg-slate-50 text-slate-600",
  faible: "border-slate-200 bg-slate-50 text-slate-500",
};

export default function ChantierTerrainFeedbackFeed({ chantierId }: { chantierId: string }) {
  const [rows, setRows] = useState<TerrainFeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (!chantierId) return;
      setLoading(true);
      setError(null);
      try {
        const data = await listTerrainFeedbacks({ chantierId });
        if (!alive) return;
        setRows(data);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message ?? "Erreur chargement des retours terrain.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [chantierId]);

  const openRows = useMemo(
    () =>
      rows
        .filter((row) => OPEN_STATUSES.has(row.status))
        .sort((a, b) => {
          const aPriority = PRIORITY_URGENCIES.has(a.urgency) ? 0 : 1;
          const bPriority = PRIORITY_URGENCIES.has(b.urgency) ? 0 : 1;
          if (aPriority !== bPriority) return aPriority - bPriority;
          return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        }),
    [rows],
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
        Chargement des retours terrain...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Ce qui remonte du terrain</div>
          <div className="mt-0.5 text-sm text-slate-500">
            {openRows.length === 0 ? "Aucun retour ouvert." : `${openRows.length} retour${openRows.length > 1 ? "s" : ""} ouvert${openRows.length > 1 ? "s" : ""} sur ce chantier.`}
          </div>
        </div>
        <Link
          to={`/retours-terrain?chantierId=${encodeURIComponent(chantierId)}`}
          className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Tout voir
        </Link>
      </div>

      {openRows.length > 0 && (
        <div className="mt-3 space-y-2">
          {openRows.slice(0, 5).map((row) => (
            <Link
              key={row.id}
              to={`/chantiers/${encodeURIComponent(chantierId)}/retours-terrain/${encodeURIComponent(row.id)}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-900">{row.title}</div>
                <div className="text-xs text-slate-500">{CATEGORY_LABELS[row.category] ?? row.category}</div>
              </div>
              <span
                className={[
                  "shrink-0 rounded-full border px-2 py-1 text-[11px] font-medium",
                  URGENCY_STYLES[row.urgency] ?? URGENCY_STYLES.normale,
                ].join(" ")}
              >
                {row.urgency}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
