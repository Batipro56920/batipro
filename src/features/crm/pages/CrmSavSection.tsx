import { useState } from "react";
import type { CrmClientRow, CrmDataset } from "../../../services/crm.service";
import { SavEmptyState } from "../sav/components/SavEmptyState";
import { SavHeader } from "../sav/components/SavHeader";
import { SavKanban } from "../sav/components/SavKanban";
import { SavKpiGrid } from "../sav/components/SavKpiGrid";
import { SavList } from "../sav/components/SavList";
import { SavPlanning } from "../sav/components/SavPlanning";
import { SavTicketDrawer } from "../sav/components/SavTicketDrawer";
import { SavToolbar } from "../sav/components/SavToolbar";
import { useSavFilters } from "../sav/hooks/useSavFilters";
import type { SavView, SavWithContext } from "../sav/types";

export default function CrmSavSection({
  rows,
  clients,
  chantiers,
  onCreate,
}: {
  rows: CrmDataset["sav"];
  clients: Map<string, CrmClientRow>;
  chantiers: CrmDataset["chantiers"];
  onCreate: () => void;
}) {
  const [view, setView] = useState<SavView>("list");
  const [selectedTicket, setSelectedTicket] = useState<SavWithContext | null>(null);
  const sav = useSavFilters(rows, { clients, chantiers });

  return (
    <div className="space-y-5">
      <SavHeader onCreate={onCreate} />
      <SavKpiGrid rows={sav.rowsWithContext} />
      <SavToolbar
        filters={sav.filters}
        setFilters={sav.setFilters}
        clients={sav.clients}
        chantiers={sav.chantiers}
        priorities={sav.priorities}
        statuses={sav.statuses}
        assignees={sav.assignees}
        view={view}
        setView={setView}
      />

      {sav.filteredRows.length === 0 ? (
        <SavEmptyState onCreate={onCreate} />
      ) : view === "kanban" ? (
        <SavKanban rows={sav.filteredRows} onSelect={setSelectedTicket} />
      ) : view === "planning" ? (
        <SavPlanning rows={sav.filteredRows} onSelect={setSelectedTicket} />
      ) : (
        <SavList rows={sav.filteredRows} onSelect={setSelectedTicket} />
      )}

      <SavTicketDrawer ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
    </div>
  );
}
