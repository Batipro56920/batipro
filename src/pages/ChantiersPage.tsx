import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { ChantierStatus } from "../types/chantier";
import {
  bulkUpdateChantiersStatus,
  countChantiers,
  deleteChantier,
  listChantiers,
  updateChantierStatus,
  type ChantierRow,
} from "../services/chantiers.service";
import { ChantiersHeader } from "../features/chantiers/list/components/ChantiersHeader";
import { ChantiersKpiGrid } from "../features/chantiers/list/components/ChantiersKpiGrid";
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

export default function ChantiersPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<ChantierRow[]>([]);
  const [scope, setScope] = useState<ChantierListFilter>("actifs");
  const [view, setView] = useState<ChantierListView>("list");
  const [filters, setFilters] = useState<ChantierListFilters>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewRow, setPreviewRow] = useState<ChantierDerived | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [debugCount, setDebugCount] = useState<number | null>(null);

  const derivedRows = useMemo(() => items.map((item) => deriveChantier(item)), [items]);
  const visibleRows = useMemo(() => filterChantiers(derivedRows, filters), [derivedRows, filters]);
  const metrics = useMemo(() => computeChantierMetrics(derivedRows), [derivedRows]);
  const clients = useMemo(() => uniqueClients(derivedRows), [derivedRows]);
  const selectedRows = useMemo(() => derivedRows.filter((item) => selectedIds.includes(item.id)), [derivedRows, selectedIds]);

  async function refresh(nextScope = scope) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listChantiers({ scope: nextScope });
      setItems(data);
      setSelectedIds((current) => current.filter((id) => data.some((item) => item.id === id)));
      setPreviewRow((current) => {
        if (!current) return null;
        const next = data.find((item) => item.id === current.id);
        return next ? deriveChantier(next) : null;
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
    onOpen: (row: ChantierRow) => navigate(`/chantiers/${row.id}`),
    onFinish: (row: ChantierRow) => void updateStatus(row, "TERMINE"),
    onArchive: (row: ChantierRow) => void updateStatus(row, "ARCHIVE"),
    onCancel: (row: ChantierRow) => void updateStatus(row, "ANNULE"),
    onRestore: (row: ChantierRow) => void updateStatus(row, "EN_COURS"),
    onDeleteDraft: (row: ChantierRow) => void deleteDraft(row),
    onExportRow: (row: ChantierRow) => exportChantiersCsv([row], `chantier-${row.nom}.csv`),
  };

  return (
    <div className="space-y-5">
      <ChantiersHeader onNew={() => navigate("/chantiers/nouveau")} onExport={() => exportChantiersCsv(visibleRows, "chantiers.csv")} />
      <ChantiersKpiGrid metrics={metrics} />
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
