import { useCallback, useEffect, useMemo, useState } from "react";
import type { Chantier } from "../types/chantier";
import { supabase } from "./supabaseClient";
import { listChantiers, type ChantierRow } from "../services/chantiers.service";

function mapRow(r: ChantierRow): Chantier {
  return {
    id: r.id,
    nom: r.nom,
    client: r.client ?? null,
    adresse: r.adresse ?? null,
    status: (r.status ?? "PREPARATION") as any,
    avancement: r.avancement ?? 0,
    dateDebut: r.date_debut ?? null,
    dateFinPrevue: r.date_fin_prevue ?? null,
    heuresPrevues: Number(r.heures_prevues ?? 0),
    heuresPassees: Number(r.heures_passees ?? 0),
    // V1: listes gérées via tables dédiées
    tasks: [],
    reserves: [],
    documents: [],
  };
}

export function useChantiers() {
  const [items, setItems] = useState<Chantier[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listChantiers({ scope: "all" });
      const mapped = (data ?? []).map(mapRow);
      setItems(mapped);
    } catch (e: any) {
      setError(e?.message ?? "Erreur Supabase");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const api = useMemo(() => {
    return {
      items,
      loading,
      error,
      refresh,

      async create(data: Omit<Chantier, "id">) {
        // IMPORTANT: aucun "description" ici non plus
        const payload = {
          nom: data.nom,
          client: data.client ?? null,
          adresse: data.adresse ?? null,
          status: data.status ?? "PREPARATION",
          avancement: data.avancement ?? 0,
          date_debut: data.dateDebut ?? null,
          date_fin_prevue: data.dateFinPrevue ?? null,
          heures_prevues: data.heuresPrevues ?? 0,
          heures_passees: data.heuresPassees ?? 0,
        };

        const { data: created, error } = await supabase
          .from("chantiers")
          .insert([payload])
          .select("id")
          .single();

        if (error) throw error;

        await refresh();
        return created.id as string;
      },

      async update(id: string, patch: Partial<Omit<Chantier, "id">>) {
        const payload: Record<string, any> = {};

        if (patch.nom !== undefined) payload.nom = patch.nom;
        if (patch.client !== undefined) payload.client = patch.client ?? null;
        if (patch.adresse !== undefined) payload.adresse = patch.adresse ?? null;
        if (patch.status !== undefined) payload.status = patch.status;
        if (patch.avancement !== undefined) payload.avancement = patch.avancement;

        if (patch.dateDebut !== undefined) payload.date_debut = patch.dateDebut ?? null;
        if (patch.dateFinPrevue !== undefined)
          payload.date_fin_prevue = patch.dateFinPrevue ?? null;

        if (patch.heuresPrevues !== undefined) payload.heures_prevues = patch.heuresPrevues;
        if (patch.heuresPassees !== undefined) payload.heures_passees = patch.heuresPassees;

        const { error } = await supabase
          .from("chantiers")
          .update(payload)
          .eq("id", id);

        if (error) throw error;

        await refresh();
      },

      async remove(id: string) {
        const { error } = await supabase.from("chantiers").delete().eq("id", id);
        if (error) throw error;

        await refresh();
      },
    };
  }, [items, loading, error, refresh]);

  return api;
}
