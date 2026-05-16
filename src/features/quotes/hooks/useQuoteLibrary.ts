import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  createQuoteLibraryItem,
  deleteQuoteLibraryItem,
  importQuoteLibraryFile,
  listQuoteLibrary,
  toggleQuoteLibraryFavorite,
  updateQuoteLibraryItem,
} from "../infrastructure/quoteLibraryRepository";
import type { QuoteLibraryFilters, QuoteLibraryItem, QuoteLibraryTab } from "../domain/QuoteLibrary";

const DEFAULT_FILTERS: QuoteLibraryFilters = {
  tab: "library",
  query: "",
  family: "all",
  type: "all",
  favoritesOnly: false,
  page: 1,
  pageSize: 25,
};

export function useQuoteLibrary() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const query = useQuery({
    queryKey: ["quote-library", filters],
    queryFn: () => listQuoteLibrary(filters),
    staleTime: 15_000,
  });

  const families = useMemo(() => {
    const values = new Set<string>();
    query.data?.items.forEach((item) => {
      if (item.family) values.add(item.family);
    });
    return ["all", ...Array.from(values).sort()];
  }, [query.data?.items]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["quote-library"] });

  const createMutation = useMutation({ mutationFn: createQuoteLibraryItem, onSuccess: invalidate });
  const updateMutation = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<QuoteLibraryItem> }) => updateQuoteLibraryItem(id, patch), onSuccess: invalidate });
  const deleteMutation = useMutation({ mutationFn: deleteQuoteLibraryItem, onSuccess: invalidate });
  const favoriteMutation = useMutation({ mutationFn: toggleQuoteLibraryFavorite, onSuccess: invalidate });
  const importMutation = useMutation({ mutationFn: importQuoteLibraryFile, onSuccess: invalidate });

  return {
    filters,
    setTab: (tab: QuoteLibraryTab) => setFilters((current) => ({ ...current, tab, page: 1 })),
    setQuery: (value: string) => setFilters((current) => ({ ...current, query: value, page: 1 })),
    setFamily: (family: string) => setFilters((current) => ({ ...current, family, page: 1 })),
    setType: (type: string) => setFilters((current) => ({ ...current, type, page: 1 })),
    setFavoritesOnly: (favoritesOnly: boolean) => setFilters((current) => ({ ...current, favoritesOnly, page: 1 })),
    setPage: (page: number) => setFilters((current) => ({ ...current, page })),
    data: query.data ?? { items: [], templates: [], imports: [], total: 0 },
    families,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    createItem: createMutation.mutateAsync,
    updateItem: updateMutation.mutateAsync,
    deleteItem: deleteMutation.mutateAsync,
    toggleFavorite: favoriteMutation.mutateAsync,
    importFile: importMutation.mutateAsync,
    importing: importMutation.isPending,
  };
}
