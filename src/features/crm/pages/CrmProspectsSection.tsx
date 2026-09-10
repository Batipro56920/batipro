import { lazy, Suspense, useMemo, useState } from "react";
import { buildUserLabelMap } from "../components/crmFormat";
import type { CrmProspectRow, CrmUserRow } from "../../../services/crm.service";
import { ProspectsCards } from "../prospects/components/ProspectsCards";
import { ProspectsEmptyState } from "../prospects/components/ProspectsEmptyState";
import { ProspectsFilterBar } from "../prospects/components/ProspectsFilterBar";
import { ProspectsHeader } from "../prospects/components/ProspectsHeader";
import { ProspectsKanban } from "../prospects/components/ProspectsKanban";
import { ProspectsKpiGrid } from "../prospects/components/ProspectsKpiGrid";
import { ProspectsTable } from "../prospects/components/ProspectsTable";
import { ProspectQuickDrawer } from "../prospects/components/ProspectQuickDrawer";
import { useProspectActions } from "../prospects/hooks/useProspectActions";
import { useProspectsFilters } from "../prospects/hooks/useProspectsFilters";
import type { ProspectView } from "../prospects/types";

const ProspectForm = lazy(() => import("../forms/ProspectForm"));

export default function CrmProspectsSection({
  rows,
  users,
  query,
  setQuery,
  onCreate,
  onConvert,
  onStatus,
  onTask,
  onCreateAppointment,
  onCreateQuote,
  onUpdate,
}: {
  rows: CrmProspectRow[];
  users?: CrmUserRow[];
  query: string;
  setQuery: (value: string) => void;
  onCreate: () => void;
  onConvert: (row: CrmProspectRow) => void;
  onStatus: (row: CrmProspectRow, status: CrmProspectRow["statut"]) => void;
  onTask: (row: CrmProspectRow) => void;
  onCreateAppointment: (row?: CrmProspectRow) => void;
  onCreateQuote: (row?: CrmProspectRow) => void;
  onUpdate?: (row: CrmProspectRow, patch: Partial<CrmProspectRow>) => void;
}) {
  const [view, setView] = useState<ProspectView>("list");
  const [selectedProspect, setSelectedProspect] = useState<CrmProspectRow | null>(null);
  const [editingProspect, setEditingProspect] = useState<CrmProspectRow | null>(null);
  const { filteredRows, filters, setFilters, sources, statuses, owners } = useProspectsFilters(rows, query, users);
  const userLabelById = useMemo(() => buildUserLabelMap(users), [users]);
  const actions = useProspectActions({ onCreate, onConvert, onStatus, onTask, onCreateAppointment, onCreateQuote });

  return (
    <div className="space-y-5">
      <ProspectsHeader onCreate={onCreate} onCreateAppointment={() => onCreateAppointment()} />
      <ProspectsKpiGrid rows={rows} />
      <ProspectsFilterBar
        query={query}
        setQuery={setQuery}
        filters={filters}
        setFilters={setFilters}
        statuses={statuses}
        sources={sources}
        owners={owners}
        view={view}
        setView={setView}
      />

      {filteredRows.length === 0 ? (
        <ProspectsEmptyState onCreate={onCreate} />
      ) : view === "kanban" ? (
        <ProspectsKanban rows={filteredRows} onSelect={setSelectedProspect} />
      ) : view === "cards" ? (
        <ProspectsCards rows={filteredRows} actions={actions} onSelect={setSelectedProspect} />
      ) : (
        <ProspectsTable rows={filteredRows} actions={actions} onSelect={setSelectedProspect} userLabelById={userLabelById} />
      )}

      <ProspectQuickDrawer
        prospect={selectedProspect}
        onClose={() => setSelectedProspect(null)}
        actions={actions}
        onEdit={onUpdate ? (row) => setEditingProspect(row) : undefined}
      />

      {editingProspect ? (
        <Suspense fallback={null}>
          <ProspectForm
            saving={false}
            initial={editingProspect}
            onClose={() => setEditingProspect(null)}
            onSubmit={(payload) => {
              onUpdate?.(editingProspect, payload);
              setEditingProspect(null);
              setSelectedProspect(null);
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
