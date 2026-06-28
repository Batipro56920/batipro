import { useEffect, useState } from "react";
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
  const metrics = { chantiers, sav, quotes, invoices, documents };
  const { filters, setFilters, filteredRows, rowsWithMetrics, types } = useClientFilters({
    rows,
    metrics,
    globalQuery: query,
  });

  useEffect(() => {
    if (!focusedClientId) return;
    const focusedClient = rowsWithMetrics.find((row) => row.id === focusedClientId);
    if (focusedClient && selectedClient?.id !== focusedClient.id) {
      setSelectedClient(focusedClient);
    }
  }, [focusedClientId, rowsWithMetrics, selectedClient?.id]);

  function closeClientDrawer() {
    if (focusedClientId && selectedClient?.id === focusedClientId) {
      onFocusedClientClear?.();
    }
    setSelectedClient(null);
  }

  return (
    <div className="space-y-5">
      <ClientsHeader onCreate={onCreate} />
      <ClientsKpiGrid rows={rowsWithMetrics} />
      <ClientsToolbar filters={filters} setFilters={setFilters} types={types} view={view} setView={setView} />

      {filteredRows.length === 0 ? (
        <ClientsEmptyState onCreate={onCreate} />
      ) : view === "cards" ? (
        <ClientsCards rows={filteredRows} onSelect={setSelectedClient} />
      ) : view === "activity" ? (
        <ClientsActivity rows={filteredRows} onSelect={setSelectedClient} />
      ) : (
        <ClientsTable rows={filteredRows} onSelect={setSelectedClient} />
      )}

      <ClientDetailDrawer client={selectedClient} metrics={metrics} onClose={closeClientDrawer} />
    </div>
  );
}
