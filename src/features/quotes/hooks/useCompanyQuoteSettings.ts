import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCompanyQuoteSettings, updateCompanyQuoteSettings } from "../infrastructure/companyQuoteSettingsRepository";
import type { CompanyQuoteSettings } from "../domain/QuoteSettings";

export function useCompanyQuoteSettings() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["company-quote-settings"],
    queryFn: getCompanyQuoteSettings,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (patch: Partial<CompanyQuoteSettings>) => updateCompanyQuoteSettings(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-quote-settings"] }),
  });

  return {
    settings: query.data ?? null,
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    update: mutation.mutateAsync,
    saving: mutation.isPending,
  };
}
