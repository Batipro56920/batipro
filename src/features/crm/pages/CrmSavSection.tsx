import { useEffect, useRef, useState } from "react";
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
  focusedSavId,
  onFocusedSavClear,
  onCreate,
}: {
  rows: CrmDataset["sav"];
  clients: Map<string, CrmClientRow>;
  chantiers: CrmDataset["chantiers"];
  focusedSavId?: string;
  onFocusedSavClear?: () => void;
  onCreate: () => void;
}) {
  const [view, setView] = useState<SavView>("list");
  const [selectedTicket, setSelectedTicket] = useState<SavWithContext | null>(null);
  const openedSavFromUrlRef = useRef("");
  const sav = useSavFilters(rows, { clients, chantiers });
  const targetedTicket = focusedSavId ? sav.rowsWithContext.find((row) => row.id === focusedSavId) ?? null : null;
  const targetedTicketMissing = Boolean(focusedSavId && !targetedTicket);

  useEffect(() => {
    if (!focusedSavId) {
      openedSavFromUrlRef.current = "";
      return;
    }
    if (openedSavFromUrlRef.current === focusedSavId) return;
    if (!targetedTicket) return;

    setSelectedTicket(targetedTicket);
    setView("list");
    sav.setFilters((current) => ({ ...current, query: "", client: "all", chantier: "all", priority: "all", status: "all", assignee: "all", date: "all" }));
    openedSavFromUrlRef.current = focusedSavId;
  }, [focusedSavId, sav, targetedTicket]);

  function selectTicket(ticket: SavWithContext) {
    if (focusedSavId && ticket.id !== focusedSavId) {
      clearFocusedSav();
    }
    setSelectedTicket(ticket);
  }

  function closeTicketDrawer() {
    if (focusedSavId && selectedTicket?.id === focusedSavId) {
      onFocusedSavClear?.();
    }
    setSelectedTicket(null);
  }

  function clearFocusedSav() {
    openedSavFromUrlRef.current = "";
    onFocusedSavClear?.();
  }

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

      {focusedSavId ? (
        <div className={[
          "rounded-2xl border p-4 text-sm",
          targetedTicketMissing ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900",
        ].join(" ")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">
                {targetedTicketMissing ? "Ticket SAV introuvable" : "Ticket SAV ouvert depuis un lien direct"}
              </div>
              <p className={targetedTicketMissing ? "mt-1 text-amber-800" : "mt-1 text-blue-800"}>
                {targetedTicketMissing
                  ? "Le lien pointe vers un ticket supprimé ou non accessible avec les droits actuels."
                  : `${targetedTicket?.titre ?? "Le ticket SAV"} est sélectionné et prêt à être contrôlé ou suivi.`}
              </p>
            </div>
            <button
              type="button"
              onClick={clearFocusedSav}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Retirer le ciblage
            </button>
          </div>
        </div>
      ) : null}

      {sav.filteredRows.length === 0 ? (
        <SavEmptyState onCreate={onCreate} />
      ) : view === "kanban" ? (
        <SavKanban rows={sav.filteredRows} onSelect={selectTicket} />
      ) : view === "planning" ? (
        <SavPlanning rows={sav.filteredRows} onSelect={selectTicket} />
      ) : (
        <SavList rows={sav.filteredRows} onSelect={selectTicket} />
      )}

      <SavTicketDrawer ticket={selectedTicket} onClose={closeTicketDrawer} />
    </div>
  );
}
