import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardCheck,
  Clock3,
  FileText,
  Users,
} from "lucide-react";

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

  const terrainFeedbackLabel = useMemo(() => {
    if (terrainFeedbackSummary.priority > 0) {
      return `${terrainFeedbackSummary.priority} retour${terrainFeedbackSummary.priority > 1 ? "s" : ""} urgent${terrainFeedbackSummary.priority > 1 ? "s" : ""}`;
    }
    if (terrainFeedbackSummary.open > 0) {
      return `${terrainFeedbackSummary.open} retour${terrainFeedbackSummary.open > 1 ? "s" : ""} ouvert${terrainFeedbackSummary.open > 1 ? "s" : ""}`;
    }
    return "Aucun retour ouvert";
  }, [terrainFeedbackSummary.open, terrainFeedbackSummary.priority]);

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
      <div className="rounded-surface border border-subtle bg-surface p-4 text-sm text-muted">
        Chantier manquant.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-surface border border-subtle bg-surface p-4 text-sm text-muted">
        Chargement de l'agenda et du planning chantier...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-surface border border-danger/20 bg-danger-soft p-4 text-sm font-medium text-danger-on">
        {error}
      </div>
    );
  }

  const terrainFeedbackHref = `/retours-terrain?chantierId=${encodeURIComponent(id)}`;
  const qualityHref = `/chantiers/${encodeURIComponent(id)}/qualite`;

  return (
    <div className="space-y-4">
      <section className="rounded-surface border border-subtle bg-surface p-4 shadow-elevated">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <Link
                to={`/chantiers/${id}`}
                className="bt-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-field border border-subtle bg-surface text-ink-secondary hover:bg-interactive"
                aria-label="Retour au dossier chantier"
              >
                <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
              </Link>
              <div className="min-w-0">
                <div className="bt-caption text-muted">Agenda interventions / planning chantier</div>
                <h1 className="bt-page-title mt-1 truncate text-ink">{chantier?.nom ?? "Chantier"}</h1>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-card border border-subtle bg-interactive px-3 py-2">
                <div className="flex items-center gap-2 text-muted">
                  <BriefcaseBusiness className="h-4 w-4" strokeWidth={1.75} />
                  <span className="bt-caption">Client</span>
                </div>
                <div className="bt-card-title mt-1 truncate text-ink">{chantier?.client || "Client non renseigné"}</div>
              </div>
              <div className="rounded-card border border-subtle bg-interactive px-3 py-2">
                <div className="flex items-center gap-2 text-muted">
                  <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
                  <span className="bt-caption">Période</span>
                </div>
                <div className="bt-card-title mt-1 truncate text-ink">
                  {chantier?.date_debut ?? chantier?.planning_start_date ?? "-"} - {chantier?.date_fin_prevue ?? chantier?.planning_end_date ?? "-"}
                </div>
              </div>
              <div className="rounded-card border border-subtle bg-interactive px-3 py-2">
                <div className="flex items-center gap-2 text-muted">
                  <Users className="h-4 w-4" strokeWidth={1.75} />
                  <span className="bt-caption">Équipe</span>
                </div>
                <div className="bt-card-title mt-1 text-ink">{activeIntervenantsCount} intervenant{activeIntervenantsCount > 1 ? "s" : ""}</div>
              </div>
              <div
                className={[
                  "rounded-card border px-3 py-2",
                  terrainFeedbackSummary.priority > 0
                    ? "border-danger/20 bg-danger-soft text-danger-on"
                    : terrainFeedbackSummary.open > 0
                      ? "border-warning/20 bg-warning-soft text-warning-on"
                      : "border-subtle bg-interactive text-muted",
                ].join(" ")}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
                  <span className="bt-caption">Retours terrain</span>
                </div>
                <div className="bt-card-title mt-1 truncate">{terrainFeedbackLabel}</div>
              </div>
            </div>

            {terrainFeedbackSummary.open > 0 ? (
              <div
                className={[
                  "mt-3 flex flex-col gap-3 rounded-card border px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between",
                  terrainFeedbackSummary.priority > 0
                    ? "border-danger/20 bg-danger-soft text-danger-on"
                    : "border-warning/20 bg-warning-soft text-warning-on",
                ].join(" ")}
              >
                <span>
                  À arbitrer avant de figer le planning : les retours terrain ouverts peuvent impacter les affectations, délais, reprises ou réserves qualité.
                </span>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    to={terrainFeedbackHref}
                    className={[
                      "rounded-field border bg-surface px-3 py-2 text-xs font-semibold hover:bg-interactive",
                      terrainFeedbackSummary.priority > 0 ? "border-danger/20 text-danger-on" : "border-warning/20 text-warning-on",
                    ].join(" ")}
                  >
                    Ouvrir les retours à arbitrer
                  </Link>
                  <Link
                    to={qualityHref}
                    className={[
                      "rounded-field border bg-surface px-3 py-2 text-xs font-semibold hover:bg-interactive",
                      terrainFeedbackSummary.priority > 0 ? "border-danger/20 text-danger-on" : "border-warning/20 text-warning-on",
                    ].join(" ")}
                  >
                    Voir qualité / réserves
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex max-w-3xl flex-wrap gap-2 xl:justify-end">
            <Link to="/planning" className="bt-control inline-flex items-center gap-2 rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
              <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
              Planning global
            </Link>
            <Link to={`/chantiers/${id}`} className="bt-control inline-flex items-center gap-2 rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
              <ClipboardCheck className="h-4 w-4" strokeWidth={1.75} />
              Dossier chantier
            </Link>
            <Link to={`/chantiers/${id}/preparation`} className="bt-control inline-flex items-center rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
              Préparation
            </Link>
            <Link to={`/chantiers/${id}/equipe`} className="bt-control inline-flex items-center rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
              Équipe affectée
            </Link>
            <Link to={`/chantiers/${id}/execution`} className="bt-control inline-flex items-center rounded-field border border-primary/20 bg-primary-soft px-3 py-2 text-sm font-semibold text-primary-on hover:bg-selected">
              Tâches / exécution
            </Link>
            <Link to={`/chantiers/${id}/temps`} className="bt-control inline-flex items-center gap-2 rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
              <Clock3 className="h-4 w-4" strokeWidth={1.75} />
              Suivi des temps
            </Link>
            <Link to={`/chantiers/${id}/documents`} className="bt-control inline-flex items-center gap-2 rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
              <FileText className="h-4 w-4" strokeWidth={1.75} />
              Documents
            </Link>
            <Link to={qualityHref} className="bt-control inline-flex items-center rounded-field border border-info/20 bg-info-soft px-3 py-2 text-sm font-semibold text-info-on hover:bg-interactive">
              Qualité / réserves
            </Link>
            <Link
              to={terrainFeedbackHref}
              className={[
                "bt-control inline-flex items-center rounded-field border px-3 py-2 text-sm font-semibold",
                terrainFeedbackSummary.priority > 0
                  ? "border-danger/20 bg-danger-soft text-danger-on hover:bg-interactive"
                  : terrainFeedbackSummary.open > 0
                    ? "border-warning/20 bg-warning-soft text-warning-on hover:bg-interactive"
                    : "border-subtle bg-surface text-ink-secondary hover:bg-interactive",
              ].join(" ")}
            >
              {terrainFeedbackSummary.open > 0 ? `Retours terrain (${terrainFeedbackLabel})` : "Retours terrain"}
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
