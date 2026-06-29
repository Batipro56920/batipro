import { useEffect, useRef, useState } from "react";
import type { CrmClientRow, CrmDataset } from "../../../services/crm.service";
import { ClientDetailDrawer } from "../clients/components/ClientDetailDrawer";
import { ClientsActivity } from "../clients/components/ClientsActivity";
import { ClientsCards } from "../clients/components/ClientsCards";
import { ClientsEmptyState } from "../clients/components/ClientsEmptyState";
import { ClientsHeader } from "../clients/components/ClientsHeader";
import { ClientsKpiGrid } from "../clients/components/ClientsKpiGrid";
import { ClientsTable } from "../clients/components/ClientsTable";
import { ClientsToolbar } from "../clients/components/ClientsToolbar";
import { useClientFilters } from "../clients/hooks/useClientFilters";
import type { ClientView, ClientWithMetrics } from "../clients/types";

export default function CrmClientsSection({
  rows,
  chantiers,
  sav,
  quotes,
  invoices,
  documents,
  query,
  focusedClientId,
  onFocusedClientClear,
  onCreate,
}: {
  rows: CrmClientRow[];
  chantiers: CrmDataset["chantiers"];
  sav: CrmDataset["sav"];
  quotes: CrmDataset["quotes"];
  invoices: CrmDataset["invoices"];
  documents: CrmDataset["documents"];
  query: string;
  setQuery: (value: string) => void;
  focusedClientId?: string;
  onFocusedClientClear?: () => void;
  onCreate: () => void;
}) {
  const [view, setView] = useState<ClientView>("list");
  const [selectedClient, setSelectedClient] = useState<ClientWithMetrics | null>(null);
  const openedClientFromUrlRef = useRef("");
  const metrics = { chantiers, sav, quotes, invoices, documents };
  const { filters, setFilters, filteredRows, rowsWithMetrics, types } = useClientFilters({
    rows,
    metrics,
    globalQuery: query,
  });
  const focusedClient = focusedClientId ? rowsWithMetrics.find((row) => row.id === focusedClientId) ?? null : null;
  const focusedClientMissing = Boolean(focusedClientId && !focusedClient);

  useEffect(() => {
    if (!focusedClientId) {
      openedClientFromUrlRef.current = "";
      return;
    }
    if (openedClientFromUrlRef.current === focusedClientId) return;
    if (!focusedClient) return;

    setSelectedClient(focusedClient);
    setView("list");
    setFilters((current) => ({
      ...current,
      query: "",
      type: "all",
      owner: "all",
      status: "all",
      chantier: "all",
      sav: "all",
      date: "all",
    }));
    openedClientFromUrlRef.current = focusedClientId;
  }, [focusedClient, focusedClientId, setFilters]);

  function clearFocusedClient() {
    openedClientFromUrlRef.current = "";
    onFocusedClientClear?.();
  }

  function selectClient(client: ClientWithMetrics) {
    if (focusedClientId && client.id !== focusedClientId) {
      clearFocusedClient();
    }
    setSelectedClient(client);
  }

  function closeClientDrawer() {
    if (focusedClientId && selectedClient?.id === focusedClientId) {
      clearFocusedClient();
    }
    setSelectedClient(null);
  }

  return (
    <div className="space-y-5">
      <ClientsHeader onCreate={onCreate} />
      <ClientsKpiGrid rows={rowsWithMetrics} />
      <ClientsToolbar filters={filters} setFilters={setFilters} types={types} view={view} setView={setView} />

      {focusedClientId ? (
        <div className={[
          "rounded-2xl border p-4 text-sm",
          focusedClientMissing ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900",
        ].join(" ")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">
                {focusedClientMissing ? "Client introuvable" : "Client ouvert depuis la recherche globale"}
              </div>
              <p className={focusedClientMissing ? "mt-1 text-amber-800" : "mt-1 text-blue-800"}>
                {focusedClientMissing
                  ? "Le lien pointe vers un client supprimé ou non accessible avec les droits actuels."
                  : `${focusedClient?.label ?? focusedClient?.societe ?? "Le client"} est sélectionné avec son activité commerciale, chantier et SAV.`}
              </p>
            </div>
            <button
              type="button"
              onClick={clearFocusedClient}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Retirer le ciblage
            </button>
          </div>
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <ClientsEmptyState onCreate={onCreate} />
      ) : view === "cards" ? (
        <ClientsCards rows={filteredRows} onSelect={selectClient} />
      ) : view === "activity" ? (
        <ClientsActivity rows={filteredRows} onSelect={selectClient} />
      ) : (
        <ClientsTable rows={filteredRows} onSelect={selectClient} />
      )}

      <ClientDetailDrawer client={selectedClient} metrics={metrics} onClose={closeClientDrawer} />
    </div>
  );
}
