import { BriefcaseBusiness, CalendarDays, Upload, UserPlus } from "lucide-react";
import { Button } from "../../../../components/ui/button";

export function ProspectsHeader({
  onCreate,
  onCreateOpportunity,
  onCreateAppointment,
}: {
  onCreate: () => void;
  onCreateOpportunity: () => void;
  onCreateAppointment: () => void;
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
          <Button type="button" variant="secondary" size="md" onClick={onCreateOpportunity}>
            <BriefcaseBusiness className="h-4 w-4" />
            Créer affaire
          </Button>
          <Button type="button" variant="secondary" size="md" onClick={onCreateAppointment}>
            <CalendarDays className="h-4 w-4" />
            Prise de RDV
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
