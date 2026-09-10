import { Upload, UserPlus } from "lucide-react";
import { Button } from "../../../../components/ui/button";

export function ProspectsHeader({
  onCreate,
}: {
  onCreate: () => void;
  /**
   * Conservés pour les appelants. Créer une affaire ou poser un RDV sans prospect
   * désigné n'a pas de sens : ces actions vivent sur la ligne du prospect.
   */
  onCreateAppointment?: () => void;
}) {
  return (
    <header className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="bt-caption text-primary-on">Acquisition</div>
          <h2 className="bt-card-title mt-1 text-ink">Demandes entrantes et prospects actifs</h2>
          <p className="bt-secondary mt-1 max-w-2xl text-muted">Qualifiez, planifiez les RDV et transformez les demandes en projets commerciaux.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" size="md" onClick={onCreate}>
            <UserPlus className="h-4 w-4" />
            Ajouter prospect
          </Button>
          <Button type="button" variant="secondary" size="md" disabled title="Import CSV/XLSX à finaliser">
            <Upload className="h-4 w-4" />
            Import
          </Button>
        </div>
      </div>
    </header>
  );
}
