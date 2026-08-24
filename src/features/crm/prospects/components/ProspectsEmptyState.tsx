import { Upload, UserPlus } from "lucide-react";
import { Button } from "../../../../components/ui/button";

export function ProspectsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <section className="rounded-surface border border-dashed border-subtle bg-surface p-8 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-card bg-primary-soft text-primary-on">
        <UserPlus className="h-6 w-6" strokeWidth={1.75} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-ink">Aucun prospect pour le moment</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Ajoutez votre premier prospect ou importez une liste de contacts.</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button type="button" variant="primary" size="md" onClick={onCreate}>
          <UserPlus className="h-4 w-4" />
          Ajouter un prospect
        </Button>
        <Button type="button" variant="secondary" size="md" disabled title="Import CSV/XLSX à finaliser">
          <Upload className="h-4 w-4" />
          Importer
        </Button>
      </div>
    </section>
  );
}
