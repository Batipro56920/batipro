import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardList,
  RefreshCw,
  Save,
} from "lucide-react";
import { getChantiers, type ChantierRow } from "../services/chantiers.service";
import {
  appendChantierActivityLog,
  listTerrainFeedbackReserveLinks,
} from "../services/chantierActivityLog.service";
import { listIntervenants, type IntervenantRow } from "../services/intervenants.service";
import { createReserve, type ReservePriority } from "../services/reserves.service";
import {
  listTerrainFeedbackResponsibles,
  listTerrainFeedbacks,
  updateTerrainFeedback,
  type TerrainFeedbackCategory,
  type TerrainFeedbackResponsible,
  type TerrainFeedbackRow,
  type TerrainFeedbackStatus,
} from "../services/terrainFeedback.service";
import { useI18n } from "../i18n";

const CATEGORY_OPTIONS: TerrainFeedbackCategory[] = [
  "observation_chantier",
  "anomalie",
  "blocage",
  "suggestion",
  "qualite",
  "securite",
  "client",
  "organisation",
];

const STATUS_OPTIONS: TerrainFeedbackStatus[] = [
  "nouveau",
  "en_cours",
  "traite",
  "classe_sans_suite",
];

const OPEN_STATUS_SET = new Set<TerrainFeedbackStatus>(["nouveau", "en_cours"]);
const PRIORITY_URGENCIES = new Set(["critique", "urgente"]);

type WorkflowScope = "all" | "open" | "priority";

function getWorkflowScope(searchParams: URLSearchParams): WorkflowScope {
  const scope = searchParams.get("scope");
  return scope === "open" || scope === "priority" ? scope : "all";
}

function matchesWorkflowScope(row: TerrainFeedbackRow, scope: WorkflowScope) {
  if (scope === "priority") return isPriorityFeedback(row);
  if (scope === "open") return isOpenFeedback(row);
  return true;
}

type DraftState = {
  status: TerrainFeedbackStatus;
  assigned_to: string;
  assigned_to_name: string;
  treatment_comment: string;
};

type CreatedReserveTarget = {
  id: string;
  title: string;
  chantierId: string;
};

function badgeClass(tone: "blue" | "amber" | "green" | "red" | "slate") {
  if (tone === "green") return "border-success/20 bg-success-soft text-success-on";
  if (tone === "amber") return "border-warning/20 bg-warning-soft text-warning-on";
  if (tone === "red") return "border-danger/20 bg-danger-soft text-danger-on";
  if (tone === "blue") return "border-primary/20 bg-primary-soft text-primary-on";
  return "border-subtle bg-interactive text-ink-secondary";
}

function statusTone(status: TerrainFeedbackStatus) {
  if (status === "traite") return "green" as const;
  if (status === "classe_sans_suite") return "red" as const;
  if (status === "en_cours") return "amber" as const;
  return "blue" as const;
}

function urgencyTone(urgency: string) {
  if (urgency === "critique") return "red" as const;
  if (urgency === "urgente") return "amber" as const;
  if (urgency === "faible") return "green" as const;
  return "slate" as const;
}

function isOpenFeedback(row: TerrainFeedbackRow) {
  return OPEN_STATUS_SET.has(row.status);
}

function isPriorityFeedback(row: TerrainFeedbackRow) {
  return isOpenFeedback(row) && PRIORITY_URGENCIES.has(row.urgency);
}

function reservePriorityFromUrgency(urgency: TerrainFeedbackRow["urgency"]): ReservePriority {
  if (urgency === "critique" || urgency === "urgente") return "URGENTE";
  if (urgency === "faible") return "BASSE";
  return "NORMALE";
}

function buildReserveDescriptionFromFeedback(row: TerrainFeedbackRow) {
  const parts = [
    row.description.trim(),
    `Origine : retour terrain ${row.category}.`,
    row.author?.nom ? `Signalé par : ${row.author.nom}.` : null,
  ].filter(Boolean);

  return parts.join("\n\n");
}

function buildFeedbackActivityChanges(
  row: TerrainFeedbackRow,
  draft: DraftState,
  assignedToName: string | null,
) {
  return {
    title: row.title,
    category: row.category,
    urgency: row.urgency,
    status_from: row.status,
    status_to: draft.status,
    assigned_to_name_from: row.assigned_to_name,
    assigned_to_name_to: assignedToName,
    treatment_comment_updated: (draft.treatment_comment || null) !== row.treatment_comment,
  };
}

export default function TerrainFeedbacksPage({
  chantierId: lockedChantierId = "",
  embedded = false,
}: {
  chantierId?: string;
  embedded?: boolean;
} = {}) {
  const { locale, t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlChantierId = lockedChantierId || searchParams.get("chantierId") || "";
  const urlFeedbackId = searchParams.get("feedbackId") ?? "";
  const workflowScope = getWorkflowScope(searchParams);
  const highlightedFeedbackRef = useRef<string | null>(null);
  const [rows, setRows] = useState<TerrainFeedbackRow[]>([]);
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [intervenants, setIntervenants] = useState<IntervenantRow[]>([]);
  const [responsibles, setResponsibles] = useState<TerrainFeedbackResponsible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reserveCreatingId, setReserveCreatingId] = useState<string | null>(null);
  const [createdReserveByFeedback, setCreatedReserveByFeedback] = useState<Record<string, CreatedReserveTarget>>({});
  const [filterChantierId, setFilterChantierId] = useState(lockedChantierId || urlChantierId);
  const [filterIntervenantId, setFilterIntervenantId] = useState("");
  const [filterStatus, setFilterStatus] = useState<TerrainFeedbackStatus | "">("");
  const [filterCategory, setFilterCategory] = useState<TerrainFeedbackCategory | "">("");
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});

  const responsibleNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of responsibles) map.set(item.id, item.display_name);
    return map;
  }, [responsibles]);

  const visibleRows = useMemo(
    () => rows.filter((row) => matchesWorkflowScope(row, workflowScope)),
    [rows, workflowScope],
  );

  const selectedChantier = useMemo(() => {
    if (!filterChantierId) return null;
    return (
      chantiers.find((chantier) => chantier.id === filterChantierId) ??
      rows.find((row) => row.chantier_id === filterChantierId)?.chantier ??
      null
    );
  }, [chantiers, filterChantierId, rows]);

  const highlightedFeedback = useMemo(
    () => (urlFeedbackId ? visibleRows.find((row) => row.id === urlFeedbackId) ?? null : null),
    [urlFeedbackId, visibleRows],
  );

  const workflowStats = useMemo(() => {
    const openRows = rows.filter(isOpenFeedback);
    const priorityRows = rows.filter(isPriorityFeedback);
    return {
      total: rows.length,
      open: openRows.length,
      priority: priorityRows.length,
      unassigned: openRows.filter((row) => !row.assigned_to).length,
      withPhotos: rows.filter((row) => row.attachments.length > 0).length,
      treated: rows.filter((row) => row.status === "traite").length,
      priorityRows: priorityRows.slice(0, 3),
    };
  }, [rows]);

  useEffect(() => {
    const nextChantierId = lockedChantierId || urlChantierId;
    setFilterChantierId((current) => (current === nextChantierId ? current : nextChantierId));
  }, [lockedChantierId, urlChantierId]);

  useEffect(() => {
    if (loading || !urlFeedbackId || highlightedFeedbackRef.current === urlFeedbackId) return;
    if (!visibleRows.some((row) => row.id === urlFeedbackId)) return;

    highlightedFeedbackRef.current = urlFeedbackId;
    window.requestAnimationFrame(() => {
      document.getElementById(`feedback-${urlFeedbackId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }, [loading, urlFeedbackId, visibleRows]);

  function applyChantierFilter(value: string) {
    if (lockedChantierId) return;
    setFilterChantierId(value);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("feedbackId");
    highlightedFeedbackRef.current = null;
    if (value) {
      nextParams.set("chantierId", value);
    } else {
      nextParams.delete("chantierId");
    }
    setSearchParams(nextParams, { replace: true });
  }

  function applyWorkflowScope(scope: WorkflowScope) {
    setFilterStatus("");
    highlightedFeedbackRef.current = null;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("feedbackId");
    if (scope === "all") nextParams.delete("scope");
    else nextParams.set("scope", scope);
    setSearchParams(nextParams, { replace: true });
  }

  function applyStatusFilter(status: TerrainFeedbackStatus | "") {
    setFilterStatus(status);
    highlightedFeedbackRef.current = null;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("feedbackId");
    nextParams.delete("scope");
    setSearchParams(nextParams, { replace: true });
  }

  function clearTargetFilters() {
    setFilterChantierId(lockedChantierId);
    setFilterIntervenantId("");
    setFilterStatus("");
    setFilterCategory("");
    highlightedFeedbackRef.current = null;

    const nextParams = new URLSearchParams(searchParams);
    if (!lockedChantierId) nextParams.delete("chantierId");
    nextParams.delete("scope");
    if (urlFeedbackId) nextParams.set("feedbackId", urlFeedbackId);
    setSearchParams(nextParams, { replace: true });
  }

  const syncDrafts = useCallback((nextRows: TerrainFeedbackRow[]) => {
    const nextDrafts: Record<string, DraftState> = {};
    nextRows.forEach((row) => {
      nextDrafts[row.id] = {
        status: row.status,
        assigned_to: row.assigned_to ?? "",
        assigned_to_name: row.assigned_to_name ?? "",
        treatment_comment: row.treatment_comment ?? "",
      };
    });
    setDrafts(nextDrafts);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [feedbackRows, chantierRows, intervenantRows, responsibleRows] = await Promise.all([
        listTerrainFeedbacks({
          chantierId: filterChantierId || undefined,
          intervenantId: filterIntervenantId || undefined,
          status: filterStatus || undefined,
          category: filterCategory || undefined,
        }),
        getChantiers(),
        listIntervenants(),
        listTerrainFeedbackResponsibles().catch(() => []),
      ]);
      const reserveLinks = await listTerrainFeedbackReserveLinks(
        feedbackRows.map((row) => ({ id: row.id, chantierId: row.chantier_id })),
      ).catch((err) => {
        console.warn("[terrain-feedback] reserve links skipped", err);
        return [];
      });
      const reserveTargets = Object.fromEntries(
        reserveLinks.map((link) => [
          link.feedbackId,
          {
            id: link.reserveId,
            title: link.reserveTitle,
            chantierId: link.chantierId,
          },
        ]),
      );

      setRows(feedbackRows);
      setChantiers(chantierRows);
      setIntervenants(intervenantRows);
      setResponsibles(responsibleRows);
      setCreatedReserveByFeedback(reserveTargets);
      syncDrafts(feedbackRows);
    } catch (err: any) {
      setError(err?.message ?? t("terrainFeedback.admin.loadError"));
      setRows([]);
      syncDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterChantierId, filterIntervenantId, filterStatus, syncDrafts, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function updateDraft(id: string, patch: Partial<DraftState>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  async function appendFeedbackActivity(row: TerrainFeedbackRow, draft: DraftState, assignedToName: string | null) {
    if (!row.chantier_id) return;

    try {
      await appendChantierActivityLog({
        chantierId: row.chantier_id,
        actionType: draft.status === "en_cours" && row.status === "nouveau" ? "started" : "updated",
        entityType: "terrain_feedback",
        entityId: row.id,
        reason: `Retour terrain mis à jour : ${row.title}`,
        changes: buildFeedbackActivityChanges(row, draft, assignedToName),
        actorName: "Pilotage retours terrain",
      });
    } catch (err) {
      console.warn("[terrain-feedback] activity log skipped", err);
    }
  }

  async function appendReserveActivity(row: TerrainFeedbackRow, reserveId: string) {
    if (!row.chantier_id) return;

    try {
      await appendChantierActivityLog({
        chantierId: row.chantier_id,
        actionType: "created",
        entityType: "reserve",
        entityId: reserveId,
        reason: `Réserve créée depuis un retour terrain : ${row.title}`,
        changes: {
          source: "terrain_feedback",
          terrain_feedback_id: row.id,
          title: row.title,
          category: row.category,
          urgency: row.urgency,
          priority: reservePriorityFromUrgency(row.urgency),
        },
        actorName: "Pilotage retours terrain",
      });
    } catch (err) {
      console.warn("[terrain-feedback] reserve activity skipped", err);
    }
  }

  async function saveRow(row: TerrainFeedbackRow) {
    const draft = drafts[row.id];
    if (!draft) return;
    const assignedToName = draft.assigned_to_name || responsibleNameById.get(draft.assigned_to) || null;
    setSavingId(row.id);
    setError(null);
    try {
      await updateTerrainFeedback(row.id, {
        status: draft.status,
        assigned_to: draft.assigned_to || null,
        assigned_to_name: assignedToName,
        treatment_comment: draft.treatment_comment || null,
      });
      await appendFeedbackActivity(row, draft, assignedToName);
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? t("terrainFeedback.admin.saveError"));
    } finally {
      setSavingId(null);
    }
  }

  async function startProcessing(row: TerrainFeedbackRow) {
    const draft = drafts[row.id];
    const assignedTo = draft?.assigned_to || row.assigned_to || null;
    const assignedToName =
      draft?.assigned_to_name ||
      row.assigned_to_name ||
      (assignedTo ? responsibleNameById.get(assignedTo) ?? null : null);
    const nextDraft: DraftState = {
      status: "en_cours",
      assigned_to: assignedTo ?? "",
      assigned_to_name: assignedToName ?? "",
      treatment_comment:
        draft?.treatment_comment ||
        row.treatment_comment ||
        "Pris en charge depuis le pilotage des retours terrain.",
    };
    setSavingId(row.id);
    setError(null);
    try {
      await updateTerrainFeedback(row.id, {
        status: "en_cours",
        assigned_to: assignedTo,
        assigned_to_name: assignedToName,
        treatment_comment: nextDraft.treatment_comment,
      });
      await appendFeedbackActivity(row, nextDraft, assignedToName);
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? t("terrainFeedback.admin.saveError"));
    } finally {
      setSavingId(null);
    }
  }

  async function createReserveFromFeedback(row: TerrainFeedbackRow) {
    const chantierId = row.chantier_id;
    if (!chantierId) {
      setError("Retour terrain sans chantier associé.");
      return;
    }

    setReserveCreatingId(row.id);
    setError(null);
    try {
      const reserve = await createReserve({
        chantier_id: chantierId,
        title: row.title,
        description: buildReserveDescriptionFromFeedback(row),
        status: "OUVERTE",
        priority: reservePriorityFromUrgency(row.urgency),
        intervenant_id: row.author_intervenant_id || null,
      });
      const nextComment = [
        row.treatment_comment,
        `Réserve créée depuis ce retour terrain (${reserve.title}).`,
      ]
        .filter(Boolean)
        .join("\n");
      const nextDraft: DraftState = {
        status: row.status === "nouveau" ? "en_cours" : row.status,
        assigned_to: row.assigned_to ?? "",
        assigned_to_name: row.assigned_to_name ?? "",
        treatment_comment: nextComment,
      };

      await updateTerrainFeedback(row.id, {
        status: nextDraft.status,
        assigned_to: row.assigned_to,
        assigned_to_name: row.assigned_to_name,
        treatment_comment: nextComment,
      });
      await appendReserveActivity(row, reserve.id);
      await appendFeedbackActivity(row, nextDraft, row.assigned_to_name);
      setCreatedReserveByFeedback((current) => ({
        ...current,
        [row.id]: {
          id: reserve.id,
          title: reserve.title,
          chantierId,
        },
      }));
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Erreur création réserve depuis le retour terrain.");
    } finally {
      setReserveCreatingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="rounded-surface border border-subtle bg-surface p-4 shadow-elevated">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="bt-caption flex items-center gap-2 text-muted">
              <ClipboardList className="h-4 w-4" strokeWidth={1.75} />
              {embedded ? "Dossier chantier" : "Pilotage production"}
            </div>
            <h1 className="bt-page-title mt-1 text-ink">
              {embedded ? "Retours terrain du chantier" : t("terrainFeedback.admin.title")}
            </h1>
            <div className="bt-secondary mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted">
              <span>{visibleRows.length} visible{visibleRows.length > 1 ? "s" : ""}</span>
              <span>{workflowStats.open} a traiter</span>
              <span>{workflowStats.priority} prioritaire{workflowStats.priority > 1 ? "s" : ""}</span>
              {selectedChantier ? <span>{selectedChantier.nom}</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {filterChantierId && !embedded ? (
              <Link
                to={`/chantiers/${filterChantierId}`}
                className="bt-control inline-flex items-center gap-2 rounded-field bg-primary px-3 py-2 text-sm font-semibold text-primary-contrast hover:bg-primary-hover"
              >
                <Building2 className="h-4 w-4" strokeWidth={1.75} />
                Fiche chantier
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="bt-control inline-flex items-center gap-2 rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive disabled:opacity-50"
            >
              <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
              {t("common.actions.refresh")}
            </button>
          </div>
        </div>
      </header>

      {urlFeedbackId ? (
        <section className="rounded-surface border border-primary/20 bg-primary-soft px-4 py-3 text-sm font-medium text-primary-on shadow-sm">
          {highlightedFeedback ? (
            <span>
              Retour ciblé depuis la recherche globale : <strong>{highlightedFeedback.title}</strong>.
            </span>
          ) : loading ? (
            "Ouverture du retour terrain ciblé..."
          ) : (
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <span>Le retour ciblé n'est pas visible avec les filtres actuels.</span>
              <button
                type="button"
                onClick={clearTargetFilters}
                className="bt-control rounded-field border border-primary/20 bg-surface px-3 py-2 text-xs font-semibold text-primary-on hover:bg-interactive"
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </section>
      ) : null}

      {filterChantierId ? (
        <section className="rounded-surface border border-primary/20 bg-primary-soft px-4 py-3 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="bt-caption text-primary-on">
                Vue chantier filtrée
              </div>
              <div className="bt-secondary mt-1 text-primary-on">
                Retours terrain liés à {selectedChantier?.nom ?? "ce chantier"}. Ouvre directement la zone utile pour traiter le sujet.
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-card border border-primary/20 bg-surface px-3 py-2">
                  <div className="bt-caption text-primary-on">À traiter</div>
                  <div className="bt-card-title mt-1 text-primary-on">{workflowStats.open}</div>
                </div>
                <div className="rounded-card border border-danger/20 bg-danger-soft px-3 py-2">
                  <div className="bt-caption text-danger-on">Urgents</div>
                  <div className="bt-card-title mt-1 text-danger-on">{workflowStats.priority}</div>
                </div>
                <div className="rounded-card border border-warning/20 bg-warning-soft px-3 py-2">
                  <div className="bt-caption text-warning-on">Sans responsable</div>
                  <div className="bt-card-title mt-1 text-warning-on">{workflowStats.unassigned}</div>
                </div>
                <div className="rounded-card border border-subtle bg-surface px-3 py-2">
                  <div className="bt-caption text-muted">Avec photos</div>
                  <div className="bt-card-title mt-1 text-ink">{workflowStats.withPhotos}</div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 lg:max-w-xs lg:justify-end">
              <Link
                to={`/chantiers/${filterChantierId}`}
                className="bt-control inline-flex items-center rounded-field bg-primary px-3 py-2 text-sm font-semibold text-primary-contrast hover:bg-primary-hover"
              >
                Fiche chantier
              </Link>
              <Link
                to={`/chantiers/${filterChantierId}/execution`}
                className="bt-control rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive"
              >
                Exécution
              </Link>
              <Link
                to={`/chantiers/${filterChantierId}/planning`}
                className="bt-control rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive"
              >
                Planning
              </Link>
              <Link
                to={`/chantiers/${filterChantierId}/documents`}
                className="bt-control rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive"
              >
                Documents
              </Link>
              <Link
                to={`/chantiers/${filterChantierId}/qualite`}
                className="bt-control rounded-field border border-info/20 bg-info-soft px-3 py-2 text-sm font-semibold text-info-on hover:bg-interactive"
              >
                Qualité / réserves
              </Link>
              <button
                type="button"
                onClick={() => applyChantierFilter("")}
                className="bt-control rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive"
              >
                Voir tous les retours
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="bt-caption text-muted">
              Pilotage terrain
            </div>
            <div className="bt-card-title mt-1 text-ink">
              Retours à traiter et priorités ouvertes
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => applyWorkflowScope("all")}
              className={["bt-control rounded-field border px-3 py-2 text-sm font-semibold", workflowScope === "all" && filterStatus === "" ? "border-primary bg-primary text-primary-contrast" : "border-subtle bg-surface text-ink-secondary hover:bg-interactive"].join(" ")}
            >
              Tous
            </button>
            <button
              type="button"
              onClick={() => applyWorkflowScope("open")}
              className={["bt-control rounded-field border px-3 py-2 text-sm font-semibold", workflowScope === "open" ? "border-primary bg-primary text-primary-contrast" : "border-primary/20 bg-primary-soft text-primary-on hover:bg-interactive"].join(" ")}
            >
              À traiter
            </button>
            <button
              type="button"
              onClick={() => applyWorkflowScope("priority")}
              className={["bt-control rounded-field border px-3 py-2 text-sm font-semibold", workflowScope === "priority" ? "border-danger bg-danger text-white" : "border-danger/20 bg-danger-soft text-danger-on hover:bg-interactive"].join(" ")}
            >
              Urgents
            </button>
            <button
              type="button"
              onClick={() => applyStatusFilter("nouveau")}
              className={["bt-control rounded-field border px-3 py-2 text-sm font-semibold", workflowScope === "all" && filterStatus === "nouveau" ? "border-primary bg-primary text-primary-contrast" : "border-subtle bg-surface text-ink-secondary hover:bg-interactive"].join(" ")}
            >
              Nouveaux
            </button>
            <button
              type="button"
              onClick={() => applyStatusFilter("en_cours")}
              className={["bt-control rounded-field border px-3 py-2 text-sm font-semibold", workflowScope === "all" && filterStatus === "en_cours" ? "border-warning bg-warning text-white" : "border-warning/20 bg-warning-soft text-warning-on hover:bg-interactive"].join(" ")}
            >
              En cours
            </button>
            <button
              type="button"
              onClick={() => applyStatusFilter("traite")}
              className={["bt-control rounded-field border px-3 py-2 text-sm font-semibold", workflowScope === "all" && filterStatus === "traite" ? "border-success bg-success text-success-contrast" : "border-success/20 bg-success-soft text-success-on hover:bg-interactive"].join(" ")}
            >
              Traités
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-card border border-subtle bg-interactive px-3 py-2">
            <div className="bt-caption text-muted">Chargés</div>
            <div className="bt-card-title mt-1 text-ink">{workflowStats.total}</div>
          </div>
          <div className="rounded-card border border-primary/20 bg-primary-soft px-3 py-2">
            <div className="bt-caption text-primary-on">À traiter</div>
            <div className="bt-card-title mt-1 text-primary-on">{workflowStats.open}</div>
          </div>
          <div className="rounded-card border border-danger/20 bg-danger-soft px-3 py-2">
            <div className="bt-caption text-danger-on">Urgents</div>
            <div className="bt-card-title mt-1 text-danger-on">{workflowStats.priority}</div>
          </div>
          <div className="rounded-card border border-warning/20 bg-warning-soft px-3 py-2">
            <div className="bt-caption text-warning-on">Sans responsable</div>
            <div className="bt-card-title mt-1 text-warning-on">{workflowStats.unassigned}</div>
          </div>
          <div className="rounded-card border border-success/20 bg-success-soft px-3 py-2">
            <div className="bt-caption text-success-on">Traités</div>
            <div className="bt-card-title mt-1 text-success-on">{workflowStats.treated}</div>
          </div>
        </div>

        {workflowStats.priorityRows.length > 0 ? (
          <div className="mt-4 rounded-card border border-danger/20 bg-danger-soft p-3">
            <div className="bt-caption flex items-center gap-2 text-danger-on">
              <AlertTriangle className="h-4 w-4" strokeWidth={1.75} />
              Priorités ouvertes
            </div>
            <div className="mt-3 space-y-2">
              {workflowStats.priorityRows.map((row) => (
                <div key={row.id} className="flex flex-col gap-3 rounded-card border border-danger/20 bg-surface px-3 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-ink">{row.title}</div>
                    <div className="mt-1 text-xs text-muted">
                      {row.chantier?.nom ?? "Chantier non renseigné"} • {t(`terrainFeedback.urgencies.${row.urgency}`)} • {t(`terrainFeedback.statuses.${row.status}`)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {row.chantier ? (
                      <>
                        <Link
                          to={`/chantiers/${row.chantier.id}/execution`}
                          className="bt-control rounded-field border border-subtle bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-interactive"
                        >
                          Exécution
                        </Link>
                        <Link
                          to={`/chantiers/${row.chantier.id}/planning`}
                          className="bt-control rounded-field border border-subtle bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-interactive"
                        >
                          Planning
                        </Link>
                        <Link
                          to={`/chantiers/${row.chantier.id}/documents`}
                          className="bt-control rounded-field border border-subtle bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-interactive"
                        >
                          Documents
                        </Link>
                        <Link
                          to={`/chantiers/${row.chantier.id}/qualite`}
                          className="bt-control rounded-field border border-subtle bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-interactive"
                        >
                          Réserves
                        </Link>
                      </>
                    ) : null}
                    {row.status === "nouveau" ? (
                      <button
                        type="button"
                        onClick={() => void startProcessing(row)}
                        disabled={savingId === row.id || reserveCreatingId === row.id}
                        className="bt-control rounded-field bg-danger px-2.5 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-60"
                      >
                        Passer en cours
                      </button>
                    ) : null}
                    {row.chantier ? (
                      createdReserveByFeedback[row.id] ? (
                        <Link
                          to={`/chantiers/${createdReserveByFeedback[row.id].chantierId}/qualite?reserveId=${createdReserveByFeedback[row.id].id}&feedbackId=${row.id}`}
                          className="bt-control rounded-field border border-success/20 bg-success-soft px-2.5 py-1.5 text-xs font-semibold text-success-on hover:bg-interactive"
                        >
                          Ouvrir la réserve
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void createReserveFromFeedback(row)}
                          disabled={savingId === row.id || reserveCreatingId === row.id}
                          className="bt-control rounded-field border border-danger/20 bg-danger-soft px-2.5 py-1.5 text-xs font-semibold text-danger-on hover:bg-interactive disabled:opacity-60"
                        >
                          {reserveCreatingId === row.id ? "Création..." : "Créer réserve"}
                        </button>
                      )
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
        <div className="bt-caption text-muted">
          {t("terrainFeedback.admin.filters")}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {!lockedChantierId ? (
            <label className="space-y-1 text-sm">
              <div className="text-xs font-medium text-muted">{t("terrainFeedback.admin.siteFilter")}</div>
              <select
                className="bt-control w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                value={filterChantierId}
                onChange={(e) => applyChantierFilter(e.target.value)}
              >
                <option value="">{t("terrainFeedback.admin.allSites")}</option>
                {chantiers.map((chantier) => (
                  <option key={chantier.id} value={chantier.id}>
                    {chantier.nom}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="space-y-1 text-sm">
            <div className="text-xs font-medium text-muted">{t("terrainFeedback.admin.authorFilter")}</div>
            <select
              className="bt-control w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              value={filterIntervenantId}
              onChange={(e) => setFilterIntervenantId(e.target.value)}
            >
              <option value="">{t("terrainFeedback.admin.allIntervenants")}</option>
              {intervenants.map((intervenant) => (
                <option key={intervenant.id} value={intervenant.id}>
                  {intervenant.nom}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <div className="text-xs font-medium text-muted">{t("common.labels.status")}</div>
            <select
              className="bt-control w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              value={filterStatus}
              onChange={(e) => applyStatusFilter(e.target.value as TerrainFeedbackStatus | "")}
            >
              <option value="">{t("terrainFeedback.admin.allStatuses")}</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {t(`terrainFeedback.statuses.${status}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <div className="text-xs font-medium text-muted">{t("common.labels.category")}</div>
            <select
              className="bt-control w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as TerrainFeedbackCategory | "")}
            >
              <option value="">{t("terrainFeedback.admin.allCategories")}</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {t(`terrainFeedback.categories.${category}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-surface border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-on">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-surface border border-subtle bg-surface p-4 text-sm text-muted shadow-sm">
          {t("common.states.loading")}
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="rounded-surface border border-dashed border-subtle bg-surface p-4 text-sm text-muted shadow-sm">
          {t("terrainFeedback.admin.empty")}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleRows.map((row) => {
            const draft = drafts[row.id];
            const isHighlighted = row.id === urlFeedbackId;
            return (
              <article
                key={row.id}
                id={`feedback-${row.id}`}
                className={[
                  "scroll-mt-24 rounded-surface border bg-surface p-4 shadow-sm transition",
                  isHighlighted ? "border-primary ring-2 ring-primary/20" : "border-subtle",
                ].join(" ")}
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isHighlighted ? (
                        <span className="inline-flex rounded-full border border-primary/20 bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary-on">
                          Résultat recherché
                        </span>
                      ) : null}
                      <h2 className="text-base font-semibold text-ink">{row.title}</h2>
                      <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass(statusTone(row.status))].join(" ")}>
                        {t(`terrainFeedback.statuses.${row.status}`)}
                      </span>
                      <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass(urgencyTone(row.urgency))].join(" ")}>
                        {t(`terrainFeedback.urgencies.${row.urgency}`)}
                      </span>
                      <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass("slate")].join(" ")}>
                        {t(`terrainFeedback.categories.${row.category}`)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-muted">
                      {row.chantier ? (
                        <Link to={`/chantiers/${row.chantier.id}`} className="font-medium text-primary-on hover:underline">
                          {row.chantier.nom}
                        </Link>
                      ) : (
                        t("common.states.unavailable")
                      )} • {(row.author?.nom ?? t("common.states.unavailable"))} •{" "}
                      {row.created_at ? new Date(row.created_at).toLocaleString(locale) : t("common.states.unavailable")}
                    </div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink-secondary">{row.description}</div>
                    {row.chantier ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          to={`/chantiers/${row.chantier.id}`}
                          className="bt-control rounded-field border border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-interactive"
                        >
                          Fiche chantier
                        </Link>
                        <Link
                          to={`/chantiers/${row.chantier.id}/execution`}
                          className="bt-control rounded-field border border-primary/20 bg-primary-soft px-3 py-2 text-xs font-semibold text-primary-on hover:bg-interactive"
                        >
                          Traiter en exécution
                        </Link>
                        <Link
                          to={`/chantiers/${row.chantier.id}/planning`}
                          className="bt-control rounded-field border border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-interactive"
                        >
                          Planning
                        </Link>
                        <Link
                          to={`/chantiers/${row.chantier.id}/documents`}
                          className="bt-control rounded-field border border-subtle bg-surface px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-interactive"
                        >
                          Documents
                        </Link>
                        <Link
                          to={`/chantiers/${row.chantier.id}/qualite`}
                          className="bt-control rounded-field border border-info/20 bg-info-soft px-3 py-2 text-xs font-semibold text-info-on hover:bg-interactive"
                        >
                          Qualité / réserves
                        </Link>
                        {row.status === "nouveau" ? (
                          <button
                            type="button"
                            onClick={() => void startProcessing(row)}
                            disabled={savingId === row.id || reserveCreatingId === row.id}
                            className="bt-control rounded-field bg-primary px-3 py-2 text-xs font-semibold text-primary-contrast hover:bg-primary-hover disabled:opacity-60"
                          >
                            Passer en cours
                          </button>
                        ) : null}
                        {createdReserveByFeedback[row.id] ? (
                          <Link
                            to={`/chantiers/${createdReserveByFeedback[row.id].chantierId}/qualite?reserveId=${createdReserveByFeedback[row.id].id}&feedbackId=${row.id}`}
                            className="bt-control rounded-field border border-success/20 bg-success-soft px-3 py-2 text-xs font-semibold text-success-on hover:bg-interactive"
                          >
                            Ouvrir la réserve créée
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void createReserveFromFeedback(row)}
                            disabled={savingId === row.id || reserveCreatingId === row.id}
                            className="bt-control rounded-field border border-danger/20 bg-danger-soft px-3 py-2 text-xs font-semibold text-danger-on hover:bg-interactive disabled:opacity-60"
                          >
                            {reserveCreatingId === row.id ? "Création réserve..." : "Créer une réserve"}
                          </button>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="space-y-4">
                    <div className="rounded-card border border-subtle bg-interactive p-3">
                      <div className="bt-caption flex items-center gap-2 text-muted">
                        <Building2 className="h-4 w-4" strokeWidth={1.75} />
                        {t("terrainFeedback.admin.context")}
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="text-xs text-muted">{t("terrainFeedback.admin.site")}</div>
                          {row.chantier ? (
                            <Link
                              to={`/chantiers/${row.chantier.id}`}
                              className="mt-1 inline-flex text-sm font-medium text-primary-on hover:underline"
                            >
                              {row.chantier.nom}
                            </Link>
                          ) : (
                            <div className="mt-1 text-sm font-medium text-ink">-</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-muted">{t("terrainFeedback.admin.author")}</div>
                          <div className="mt-1 text-sm font-medium text-ink">{row.author?.nom ?? "-"}</div>
                          <div className="mt-1 text-xs text-muted">
                            {[row.author?.email, row.author?.telephone].filter(Boolean).join(" • ") || "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted">{t("terrainFeedback.admin.createdAt")}</div>
                          <div className="mt-1 text-sm font-medium text-ink">
                            {row.created_at ? new Date(row.created_at).toLocaleString(locale) : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted">{t("terrainFeedback.admin.treatedAt")}</div>
                          <div className="mt-1 text-sm font-medium text-ink">
                            {row.treated_at ? new Date(row.treated_at).toLocaleString(locale) : t("terrainFeedback.admin.notProcessed")}
                          </div>
                        </div>
                      </div>
                    </div>

                    {row.attachments.length > 0 ? (
                      <div className="rounded-card border border-subtle bg-interactive p-3">
                        <div className="bt-caption flex items-center gap-2 text-muted">
                          <Camera className="h-4 w-4" strokeWidth={1.75} />
                          {t("terrainFeedback.admin.photos")}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
                          {row.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={attachment.public_url}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded-card border border-subtle bg-surface"
                            >
                              <img
                                src={attachment.public_url}
                                alt={attachment.file_name}
                                className="h-32 w-full object-cover"
                                loading="lazy"
                              />
                              <div className="px-3 py-2 text-xs text-muted">{attachment.file_name}</div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-card border border-subtle bg-interactive p-3">
                      <div className="bt-caption flex items-center gap-2 text-muted">
                        <CalendarClock className="h-4 w-4" strokeWidth={1.75} />
                        {t("terrainFeedback.admin.history")}
                      </div>
                      <div className="mt-3 space-y-3">
                        {row.history.length === 0 ? (
                          <div className="text-sm text-muted">{t("terrainFeedback.admin.noHistory")}</div>
                        ) : (
                          row.history.map((item) => (
                            <div key={item.id} className="rounded-card border border-subtle bg-surface px-3 py-2">
                              <div className="text-sm font-medium text-ink">
                                {item.changed_by_name || t("terrainFeedback.admin.system")}
                              </div>
                              <div className="mt-1 text-xs text-muted">
                                {item.created_at ? new Date(item.created_at).toLocaleString(locale) : "-"} • {item.action}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-card border border-subtle bg-surface p-3">
                    <div className="bt-caption flex items-center gap-2 text-muted">
                      <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
                      {t("terrainFeedback.admin.processing")}
                    </div>
                    {row.chantier ? (
                      <div className="mt-3 rounded-card border border-subtle bg-interactive p-3">
                        <div className="text-xs font-medium text-muted">Contexte chantier</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Link
                            to={`/chantiers/${row.chantier.id}/execution`}
                            className="bt-control rounded-field border border-subtle bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-interactive"
                          >
                            Exécution
                          </Link>
                          <Link
                            to={`/chantiers/${row.chantier.id}/planning`}
                            className="bt-control rounded-field border border-subtle bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-interactive"
                          >
                            Planning
                          </Link>
                          <Link
                            to={`/chantiers/${row.chantier.id}/documents`}
                            className="bt-control rounded-field border border-subtle bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-secondary hover:bg-interactive"
                          >
                            Documents
                          </Link>
                          <Link
                            to={`/chantiers/${row.chantier.id}/qualite`}
                            className="bt-control rounded-field border border-info/20 bg-info-soft px-2.5 py-1.5 text-xs font-semibold text-info-on hover:bg-interactive"
                          >
                            Réserves
                          </Link>
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 space-y-4">
                      <label className="space-y-1 text-sm">
                        <div className="text-xs font-medium text-muted">{t("common.labels.status")}</div>
                        <select
                          className="bt-control w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                          value={draft?.status ?? row.status}
                          onChange={(e) => updateDraft(row.id, { status: e.target.value as TerrainFeedbackStatus })}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {t(`terrainFeedback.statuses.${status}`)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1 text-sm">
                        <div className="text-xs font-medium text-muted">{t("terrainFeedback.admin.assignedTo")}</div>
                        <select
                          className="bt-control w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
                          value={draft?.assigned_to ?? row.assigned_to ?? ""}
                          onChange={(e) =>
                            updateDraft(row.id, {
                              assigned_to: e.target.value,
                              assigned_to_name: responsibleNameById.get(e.target.value) ?? "",
                            })
                          }
                        >
                          <option value="">{t("terrainFeedback.admin.unassigned")}</option>
                          {responsibles.map((responsible) => (
                            <option key={responsible.id} value={responsible.id}>
                              {responsible.display_name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1 text-sm">
                        <div className="text-xs font-medium text-muted">{t("terrainFeedback.admin.processingComment")}</div>
                        <textarea
                          className="min-h-28 w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-primary"
                          value={draft?.treatment_comment ?? row.treatment_comment ?? ""}
                          onChange={(e) => updateDraft(row.id, { treatment_comment: e.target.value })}
                          placeholder={t("terrainFeedback.admin.processingCommentPlaceholder")}
                        />
                      </label>

                      {row.chantier ? (
                        createdReserveByFeedback[row.id] ? (
                          <Link
                            to={`/chantiers/${createdReserveByFeedback[row.id].chantierId}/qualite?reserveId=${createdReserveByFeedback[row.id].id}&feedbackId=${row.id}`}
                            className="bt-control block w-full rounded-field border border-success/20 bg-success-soft px-4 py-2.5 text-center text-sm font-semibold text-success-on hover:bg-interactive"
                          >
                            Ouvrir la réserve créée
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void createReserveFromFeedback(row)}
                            disabled={savingId === row.id || reserveCreatingId === row.id}
                            className="bt-control w-full rounded-field border border-danger/20 bg-danger-soft px-4 py-2.5 text-sm font-semibold text-danger-on hover:bg-interactive disabled:opacity-60"
                          >
                            {reserveCreatingId === row.id ? "Création de la réserve..." : "Créer une réserve chantier"}
                          </button>
                        )
                      ) : null}

                      <button
                        type="button"
                        onClick={() => void saveRow(row)}
                        disabled={savingId === row.id || reserveCreatingId === row.id}
                        className="bt-control inline-flex w-full items-center justify-center gap-2 rounded-field bg-primary px-4 py-2.5 text-sm font-semibold text-primary-contrast hover:bg-primary-hover disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" strokeWidth={1.75} />
                        {savingId === row.id ? t("common.states.saving") : t("common.actions.save")}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
