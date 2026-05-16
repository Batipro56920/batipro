import { Upload, UserPlus, Target } from "lucide-react";
import { Button } from "../../../../components/ui/button";

export function ProspectsHeader({
  onCreate,
  onCreateOpportunity,
}: {
  onCreate: () => void;
  onCreateOpportunity: () => void;
}) {
  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">CRM</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Prospects</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Gérez vos leads, demandes entrantes et opportunités commerciales.</p>
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
          <Button type="button" variant="secondary" size="md" onClick={onCreateOpportunity}>
            <Target className="h-4 w-4" />
            Opportunité
          </Button>
        </div>
      </div>
    </header>
  );
}
