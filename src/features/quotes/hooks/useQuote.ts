import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadQuoteWorkspaceData, saveQuote } from "../infrastructure/quoteRepository";
import { mapDatasetToOptions, mapEngineToQuote } from "../infrastructure/quoteMapper";
import { useQuoteStore } from "../store/quoteStore";

export function useQuote(quoteId: string | undefined) {
  const queryClient = useQueryClient();
  const hydrate = useQuoteStore((state) => state.hydrate);
  const quote = useQuoteStore((state) => state.quote);
  const setSaveState = useQuoteStore((state) => state.setSaveState);

  const query = useQuery({
    queryKey: ["quote-workspace", quoteId],
    queryFn: () => {
      if (!quoteId) throw new Error("Identifiant devis manquant.");
      return loadQuoteWorkspaceData(quoteId);
    },
    enabled: Boolean(quoteId),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!query.data) return;
    hydrate(mapEngineToQuote(query.data.engine, query.data.dataset));
  }, [hydrate, query.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!query.data) throw new Error("Devis non charge.");
      setSaveState("saving");
      await saveQuote(quote, query.data.engine);
    },
    onSuccess: async () => {
      setSaveState("saved");
      await queryClient.invalidateQueries({ queryKey: ["quote-workspace", quoteId] });
    },
    onError: (error) => setSaveState("error", error instanceof Error ? error.message : "Sauvegarde impossible."),
  });

  return {
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    dataset: query.data?.dataset ?? null,
    options: query.data ? mapDatasetToOptions(query.data.dataset) : { clients: [], prospects: [], projects: [] },
    save: saveMutation.mutateAsync,
    saving: saveMutation.isPending,
  };
}
