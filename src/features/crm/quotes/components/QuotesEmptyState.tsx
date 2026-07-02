import { FileText, RotateCcw, Upload } from "lucide-react";
import { Button } from "../../../../components/ui/button";

type QuotesEmptyStateProps = {
  onCreate: () => void;
  hasActiveFilters?: boolean;
  searchTerm?: string;
  onResetFilters?: () => void;
};

export function QuotesEmptyState({
  onCreate,
  hasActiveFilters = false,
  searchTerm = "",
  onResetFilters,
}: QuotesEmptyStateProps) {
  return (
    <section className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center shadow-sm shadow-slate-950/[0.03]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <FileText className="h-6 w-6" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-950">
        {hasActiveFilters ? "Aucun devis ne correspond aux filtres" : "Aucun devis pour le moment"}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        {hasActiveFilters
          ? searchTerm
            ? `La recherche "${searchTerm}" ne retourne aucun devis accessible. Effacez les filtres ou vérifiez le rattachement CRM du devis.`
            : "Aucun devis accessible ne correspond aux filtres sélectionnés. Effacez les filtres pour revenir à la liste complète."
          : "Créez un devis depuis un projet pour conserver un seul parcours commerce -> devis -> chantier."}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {hasActiveFilters ? (
          <Button type="button" variant="secondary" size="md" onClick={onResetFilters} disabled={!onResetFilters}>
            <RotateCcw className="h-4 w-4" />
            Effacer les filtres
          </Button>
        ) : null}
        <Button type="button" variant="primary" size="md" onClick={onCreate}>
          <FileText className="h-4 w-4" />
          Créer depuis un projet
        </Button>
        {!hasActiveFilters ? (
          <Button type="button" variant="secondary" size="md" disabled title="Import devis à finaliser">
            <Upload className="h-4 w-4" />
            Importer
          </Button>
        ) : null}
      </div>
    </section>
  );
}
