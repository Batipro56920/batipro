import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import ChantierPlanningSection from "../features/chantiers/pages/ChantierPlanningSection";
import { getChantierById, type ChantierRow } from "../services/chantiers.service";
import { listIntervenantsByChantierId, type IntervenantRow } from "../services/intervenants.service";
import { listTerrainFeedbacks } from "../services/terrainFeedback.service";

type TerrainFeedbackPlanningSummary = {
  open: number;
  priority: number;
};

const OPEN_TERRAIN_FEEDBACK_STATUSES = new Set(["nouveau", "en_cours"]);
const PRIORITY_TERRAIN_FEEDBACK_URGENCIES = new Set(["critique", "urgente"]);

export default function ChantierPlanningPage() {
  const { id } = useParams<{ id: string }>();
  const [chantier, setChantier] = useState<ChantierRow | null>(null);
  const [intervenants, setIntervenants] = useState<IntervenantRow[]>([]);
  const [terrainFeedbackSummary, setTerrainFeedbackSummary] = useState<TerrainFeedbackPlanningSummary>({ open: 0, priority: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeIntervenantsCount = useMemo(
    () => intervenants.filter((intervenant) => !intervenant.archived_at).length,
    [intervenants],
  );

  useEffect(() => {
    let alive = true;

    async function loadPlanningContext() {
      if (!id) {
        setError("Chantier manquant.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [chantierRow, intervenantRows, terrainFeedbackRows] = await Promise.all([
          getChantierById(id),
          listIntervenantsByChantierId(id),
          listTerrainFeedbacks({ chantierId: id }).catch(() => []),
        ]);
        if (!alive) return;
        const openTerrainFeedbackRows = terrainFeedbackRows.filter((row) => OPEN_TERRAIN_FEEDBACK_STATUSES.has(row.status));
        setChantier(chantierRow);
        setIntervenants(intervenantRows);
        setTerrainFeedbackSummary({
          open: openTerrainFeedbackRows.length,
          priority: openTerrainFeedbackRows.filter((row) => PRIORITY_TERRAIN_FEEDBACK_URGENCIES.has(row.urgency)).length,
        });
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message ?? "Impossible de charger l'agenda et le planning chantier.");
        setChantier(null);
        setIntervenants([]);
        setTerrainFeedbackSummary({ open: 0, priority: 0 });
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadPlanningContext();
    return () => {
      alive = false;
    };
  }, [id]);

  if (!id) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-sm text-slate-600">
        Chantier manquant.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
        Chargement de l'agenda et du planning chantier...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Agenda interventions / planning chantier
            </div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">
              {chantier?.nom ?? "Chantier"}
            </h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
              <span>{chantier?.client || "Client non renseigné"}</span>
              <span>Début : {chantier?.date_debut ?? chantier?.planning_start_date ?? "-"}</span>
              <span>Fin : {chantier?.date_fin_prevue ?? chantier?.planning_end_date ?? "-"}</span>
              <span>{activeIntervenantsCount} intervenant{activeIntervenantsCount > 1 ? "s" : ""} affecté{activeIntervenantsCount > 1 ? "s" : ""}</span>
              {terrainFeedbackSummary.open > 0 ? (
                <span className={terrainFeedbackSummary.priority > 0 ? "font-semibold text-red-700" : "font-semibold text-blue-700"}>
                  {terrainFeedbackSummary.priority > 0
                    ? `${terrainFeedbackSummary.priority} retour terrain urgent`
                    : `${terrainFeedbackSummary.open} retour terrain ouvert`}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/planning"
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Planning global
            </Link>
            <Link
              to={`/chantiers/${id}`}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Dossier chantier
            </Link>
            <Link
              to={`/chantiers/${id}/preparation`}
              className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-medium text-cyan-800 hover:bg-cyan-100"
            >
              Préparation
            </Link>
            <Link
              to={`/chantiers/${id}/equipe`}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
            >
              Équipe affectée
            </Link>
            <Link
              to={`/chantiers/${id}/execution`}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
            >
              Tâches / exécution
            </Link>
            <Link
              to={`/chantiers/${id}/documents`}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Documents
            </Link>
            <Link
              to={`/chantiers/${id}/qualite`}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
            >
              Qualité / réserves
            </Link>
            <Link
              to={`/chantiers/${encodeURIComponent(id)}/retours-terrain`}
              className={[
                "rounded-xl border px-3 py-2 text-sm font-medium hover:bg-amber-100",
                terrainFeedbackSummary.priority > 0
                  ? "border-red-200 bg-red-50 text-red-800"
                  : "border-amber-200 bg-amber-50 text-amber-800",
              ].join(" ")}
            >
              {terrainFeedbackSummary.open > 0
                ? `Retours terrain (${terrainFeedbackSummary.priority > 0 ? `${terrainFeedbackSummary.priority} urgent` : terrainFeedbackSummary.open})`
                : "Retours terrain"}
            </Link>
          </div>
        </div>
      </section>

      <ChantierPlanningSection
        chantierId={id}
        chantierName={chantier?.nom ?? null}
        intervenants={intervenants}
      />
    </div>
  );
}
