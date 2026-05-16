import { useEffect, useState } from "react";
import { loadCrmDataset, type CrmDataset } from "../../../services/crm.service";

export const EMPTY_CRM_DATASET: CrmDataset = {
  prospects: [],
  clients: [],
  opportunities: [],
  quotes: [],
  tasks: [],
  appointments: [],
  sav: [],
  stages: [],
  documents: [],
  communications: [],
  invoices: [],
  purchases: [],
  chantiers: [],
  taskTemplates: [],
};

export function useCrmData() {
  const [data, setData] = useState<CrmDataset>(EMPTY_CRM_DATASET);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setData(await loadCrmDataset());
    } catch (err: any) {
      setError(err?.message ?? "Erreur chargement CRM.");
      setData(EMPTY_CRM_DATASET);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return { data, setData, loading, error, setError, refresh };
}

