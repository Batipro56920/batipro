import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { ChantierStatus } from "../types/chantier";
import { supabase } from "../lib/supabaseClient";
import {
  bulkUpdateChantiersStatus,
  countChantiers,
  deleteChantier,
  listChantiers,
  updateChantierStatus,
  type ChantierRow,
} from "../services/chantiers.service";
import { ChantiersHeader } from "../features/chantiers/list/components/ChantiersHeader";
import { ChantiersKpiGrid, type ChantiersKpiKey } from "../features/chantiers/list/components/ChantiersKpiGrid";
import { ChantiersToolbar } from "../features/chantiers/list/components/ChantiersToolbar";
import { ChantiersBulkBar } from "../features/chantiers/list/components/ChantiersBulkBar";
import { ChantiersListView } from "../features/chantiers/list/components/ChantiersListView";
import { ChantiersCardsView } from "../features/chantiers/list/components/ChantiersCardsView";
import { ChantiersPlanningView } from "../features/chantiers/list/components/ChantiersPlanningView";
import { ChantiersKanbanView } from "../features/chantiers/list/components/ChantiersKanbanView";
import { ChantiersEmptyState } from "../features/chantiers/list/components/ChantiersEmptyState";
import { ChantiersSkeleton } from "../features/chantiers/list/components/ChantiersSkeleton";
import { ChantierQuickDrawer } from "../features/chantiers/list/components/ChantierQuickDrawer";
import type { ChantierDerived, ChantierListFilter, ChantierListFilters, ChantierListView } from "../features/chantiers/list/types";
import { computeChantierMetrics, deriveChantier, exportChantiersCsv, filterChantiers, uniqueClients } from "../features/chantiers/list/utils/chantiersListUtils";

const DEFAULT_FILTERS: ChantierListFilters = {
  query: "",
  status: "all",
  client: "",
  conducteur: "",
  commercial: "",
  period: "all",
  type: "",
};

const OPEN_TERRAIN_FEEDBACK_STATUSES = ["nouveau", "en_cours"] as const;
const PRIORITY_TERRAIN_FEEDBACK_URGENCIES = new Set(["critique", "urgente"]);

const HEADER_BY_VIEW: Record<ChantierListView, { eyebrow: string; title: string; description: string }> = {
  list: {
    eyebrow: "Production",
    title: "Production chantier",
    description: "Pilotez vos chantiers, avancement, alertes et équipes.",
  },
  cards: {
    eyebrow: "Production",
    title: "Vue cartes chantiers",
    description: "Balayez rapidement les chantiers actifs, clients, statuts et alertes.",
  },
  planning: {
    eyebrow: "Planning",
    title: "Planning chantiers",
    description: "Visualisez les échéances chantier et ouvrez le dossier à piloter.",
  },
  kanban: {
    eyebrow: "Pilotage",
    title: "Kanban chantiers",
    description: "Suivez les chantiers par statut sans mélanger planning et création de tâches.",
  },
};

type ChantierListFocus = "tasks" | "reserves" | "time" | "visits";

type ChantiersPageProps = {
  initialView?: ChantierListView;
  initialFocus?: ChantierListFocus;
};

type TerrainFeedbackSummaryByChantier = Record<string, { open: number; priority: number }>;

const HEADER_BY_FOCUS: Record<ChantierListFocus, { eyebrow: string; title: string; description: string }> = {
  tasks: {
    eyebrow: "Exécution",
    title: "Tâches chantier",
    description: "Choisissez un chantier actif puis ouvrez directement son espace exécution pour piloter tâches, avancement et quantités.",
  },
  reserves: {
    eyebrow: "Qualité",
    title: "Réserves chantier",
    description: "Priorisez les chantiers avec alertes, retours terrain ou retard puis ouvrez directement la qualité et les réserves.",
  },
  time: {
    eyebrow: "Temps",
    title: "Suivi des temps chantier",
    description: "Repérez les chantiers à surveiller puis ouvrez directement leur suivi des temps pour rapprocher heures passées, tâches et équipe.",
  },
  visits: {
    eyebrow: "Qualité",
    title: "Visites chantier",
    description: "Choisissez un chantier actif puis ouvrez directement son registre de visites, contrôles et comptes rendus.",
  },
};

const FOCUS_GUIDANCE: Record<ChantierListFocus, { title: string; description: string; cta: string }> = {
  tasks: {
    title: "Parcours tâches",
    description: "Ouvrez un chantier depuis la liste ou le tiroir rapide : l'action principale mène à Exécuter pour travailler sur les tâches, les affectations et les documents liés.",
    cta: "Ouvrir mène à Exécuter.",
  },
  reserves: {
    title: "Parcours réserves",
    description: "La vue est placée sur le kanban et le filtre Alertes à traiter afin de rapprocher retours terrain, retard, qualité et réserves chantier.",
    cta: "Ouvrir mène à Qualité.",
  },
  time: {
    title: "Parcours temps",
    description: "La vue met en avant les chantiers à risque puis ouvre le suivi des temps du chantier pour relier heures saisies, tâches, intervenants et planning.",
    cta: "Ouvrir mène aux Temps.",
  },
  visits: {
    title: "Parcours visites",
    description: "La vue reste centrée sur les chantiers actifs et l'ouverture mène au registre des visites du chantier, sans créer de suivi qualité séparé.",
    cta: "Ouvrir mène aux Visites.",
  },
};

function getInitialFilters(initialFocus: ChantierListFocus | undefined): ChantierListFilters {
  if (initialFocus === "reserves" || initialFocus === "time") return { ...DEFAULT_FILTERS, period: "alerts" };
  return DEFAULT_FILTERS;
}

function getFocusedChantierPath(row: ChantierRow, initialFocus: ChantierListFocus | undefined, currentView: ChantierListView) {
  const basePath = `/chantiers/${encodeURIComponent(row.id)}`;
  if (initialFocus === "tasks") return `${basePath}/execution`;
  if (initialFocus === "time") return `${basePath}/temps`;
  if (initialFocus === "reserves") return `${basePath}/qualite`;
  if (initialFocus === "visits") return `${basePath}/visites`;
  if (currentView === "planning") return `${basePath}/planning`;
  return basePath;
}

async function loadTerrainFeedbackSummaries(chantierIds: string[]): Promise<TerrainFeedbackSummaryByChantier> {
  if (chantierIds.length === 0) return {};

  const { data, error } = await (supabase as any)
    .from("terrain_feedbacks")
    .select("chantier_id,status,urgency")
    .in("chantier_id", chantierIds)
    .in("status", [...OPEN_TERRAIN_FEEDBACK_STATUSES]);

  if (error) {
    console.warn("[chantiers] terrain feedback summaries skipped", error);
    return {};
  }

  const summaries: TerrainFeedbackSummaryByChantier = {};
  for (const row of (data ?? []) as Array<Record<string, unknown>>) {
    const chantierId = String(row.chantier_id ?? "");
    if (!chantierId) continue;
    const current = summaries[chantierId] ?? { open: 0, priority: 0 };
    current.open += 1;
    if (PRIORITY_TERRAIN_FEEDBACK_URGENCIES.has(String(row.urgency ?? ""))) current.priority += 1;
    summaries[chantierId] = current;
  }

  return summaries;
}

function ChantiersFocusPanel({ focus }: { focus: ChantierListFocus }) {
  const copy = FOCUS_GUIDANCE[focus];
  return (
    <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm shadow-blue-950/[0.03]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold text-blue-950">{copy.title}</h2>
          <p className="mt-1 leading-6">{copy.description}</p>
        </div>
        <div className="shrink-0 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800">
          {copy.cta}
        </div>
      </div>
    </section>
  );
}

export default function ChantiersPage({ initialView = "list", initialFocus }: ChantiersPageProps) {
  const navigate = useNavigate();

  const [items, setItems] = useState<ChantierRow[]>([]);
  const [scope, setScope] = useState<ChantierListFilter>("actifs");
  const [view, setView] = useState<ChantierListView>(initialView);
  const [filters, setFilters] = useState<ChantierListFilters>(() => getInitialFilters(initialFocus));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewRow, setPreviewRow] = useState<ChantierDerived | null>(null);
  const [terrainFeedbackSummaries, setTerrainFeedbackSummaries] = useState<TerrainFeedbackSummaryByChantier>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [debugCount, setDebugCount] = useState<number | null>(null);

  const derivedRows = useMemo(
    () => items.map((item) => deriveChantier(item, undefined, terrainFeedbackSummaries[item.id])),
    [items, terrainFeedbackSummaries],
  );
  const visibleRows = useMemo(() => filterChantiers(derivedRows, filters), [derivedRows, filters]);
  const metrics = useMemo(() => computeChantierMetrics(derivedRows), [derivedRows]);
  const clients = useMemo(() => uniqueClients(derivedRows), [derivedRows]);
  const selectedRows = useMemo(() => derivedRows.filter((item) => selectedIds.includes(item.id)), [derivedRows, selectedIds]);
  const headerCopy = initialFocus ? HEADER_BY_FOCUS[initialFocus] : HEADER_BY_VIEW[view];

  async function refresh(nextScope = scope) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listChantiers({ scope: nextScope });
      const nextTerrainFeedbackSummaries = await loadTerrainFeedbackSummaries(data.map((item) => item.id));
      setItems(data);
      setTerrainFeedbackSummaries(nextTerrainFeedbackSummaries);
      setSelectedIds((current) => current.filter((id) => data.some((item) => item.id === id)));
      setPreviewRow((current) => {
        if (!current) return null;
        const next = data.find((item) => item.id === current.id);
        return next ? deriveChantier(next, undefined, nextTerrainFeedbackSummaries[next.id]) : null;
      });
      if (import.meta.env.DEV) {
        const count = await countChantiers({ scope: nextScope });
        setDebugCount(count);
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Impossible de charger les chantiers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(scope);
  }, [scope]);

  useEffect(() => {
    setView(initialView);
    setFilters(getInitialFilters(initialFocus));
    setScope("actifs");
    setSelectedIds([]);
    setPreviewRow(null);
  }, [initialFocus, initialView]);

  function applyKpiFilter(key: ChantiersKpiKey) {
    setSelectedIds([]);

    if (key === "active") {
      setScope("actifs");
      setFilters(DEFAULT_FILTERS);
      setView("list");
      return;
    }

    if (key === "preparation") {
      setScope("actifs");
      setFilters({ ...DEFAULT_FILTERS, status: "PREPARATION" });
      setView("list");
      return;
    }

    if (key === "late") {
      setScope("actifs");
      setFilters({ ...DEFAULT_FILTERS, period: "late" });
      setView("planning");
      return;
    }

    if (key === "terrainFeedback") {
      navigate("/retours-terrain");
      return;
    }

    setScope("actifs");
    setFilters({ ...DEFAULT_FILTERS, period: "alerts" });
    setView("kanban");
  }

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  async function runBulkStatus(status: ChantierStatus) {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await bulkUpdateChantiersStatus(selectedIds, status);
      setSelectedIds([]);
      await refresh();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Action impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedDrafts() {
    const draftIds = selectedRows.filter((row) => row.status === "BROUILLON").map((row) => row.id);
    if (draftIds.length === 0) return;
    if (!window.confirm(`Supprimer ${draftIds.length} brouillon(s) ? Cette action sera enregistrée en suppression logique.`)) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await Promise.all(draftIds.map((id) => deleteChantier(id)));
      setSelectedIds([]);
      await refresh();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Suppression impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(row: ChantierRow, status: ChantierStatus) {
    setSaving(true);
    setErrorMsg(null);
    try {
      await updateChantierStatus(row.id, status);
      await refresh();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Action impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft(row: ChantierRow) {
    if (row.status !== "BROUILLON") return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await deleteChantier(row.id);
      await refresh();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Suppression impossible.");
    } finally {
      setSaving(false);
    }
  }

  const actions = {
    onOpen: (row: ChantierRow) => navigate(getFocusedChantierPath(row, initialFocus, view)),
    onFinish: (row: ChantierRow) => void updateStatus(row, "TERMINE"),
    onArchive: (row: ChantierRow) => void updateStatus(row, "ARCHIVE"),
    onCancel: (row: ChantierRow) => void updateStatus(row, "ANNULE"),
    onRestore: (row: ChantierRow) => void updateStatus(row, "EN_COURS"),
    onDeleteDraft: (row: ChantierRow) => void deleteDraft(row),
    onExportRow: (row: ChantierRow) => exportChantiersCsv([row], `chantier-${row.nom}.csv`),
  };

  return (
    <div className="space-y-5">
      <ChantiersHeader
        eyebrow={headerCopy.eyebrow}
        title={headerCopy.title}
        description={headerCopy.description}
        onNew={() => navigate("/chantiers/nouveau")}
        onExport={() => exportChantiersCsv(visibleRows, "chantiers.csv")}
      />
      {initialFocus ? <ChantiersFocusPanel focus={initialFocus} /> : null}
      <ChantiersKpiGrid metrics={metrics} onSelect={applyKpiFilter} />
      <ChantiersToolbar
        scope={scope}
        onScope={setScope}
        filters={filters}
        onFilters={setFilters}
        clients={clients}
        view={view}
        onView={setView}
        onRefresh={() => void refresh()}
      />
      <ChantiersBulkBar selectedRows={selectedRows} saving={saving} onFinish={() => void runBulkStatus("TERMINE")} onArchive={() => void runBulkStatus("ARCHIVE")} onDeleteDrafts={() => void deleteSelectedDrafts()} />

      {errorMsg ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{errorMsg}</div> : null}

      {loading ? (
        <ChantiersSkeleton />
      ) : visibleRows.length === 0 ? (
        <ChantiersEmptyState onNew={() => navigate("/chantiers/nouveau")} />
      ) : view === "cards" ? (
        <ChantiersCardsView rows={visibleRows} onPreview={setPreviewRow} actions={actions} />
      ) : view === "planning" ? (
        <ChantiersPlanningView rows={visibleRows} onPreview={setPreviewRow} />
      ) : view === "kanban" ? (
        <ChantiersKanbanView rows={visibleRows} onPreview={setPreviewRow} actions={actions} />
      ) : (
        <ChantiersListView rows={visibleRows} selectedIds={selectedIds} onToggleSelection={toggleSelection} onPreview={setPreviewRow} actions={actions} />
      )}

      <ChantierQuickDrawer row={previewRow} actions={actions} onClose={() => setPreviewRow(null)} />

      {!loading && import.meta.env.DEV && debugCount !== null ? (
        <div className="text-xs text-slate-400">
          DEBUG: count={debugCount} list={items.length} visible={visibleRows.length}
        </div>
      ) : null}
    </div>
  );
}
