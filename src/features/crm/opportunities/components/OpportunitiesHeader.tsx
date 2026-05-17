import { Filter, Upload, Plus } from "lucide-react";
import { Button } from "../../../../components/ui/button";

export function OpportunitiesHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">CRM</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Pipeline commercial</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Suivez chaque affaire du premier contact à la signature.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" size="md" onClick={onCreate}>
            <Plus className="h-4 w-4" />
            Nouvelle opportunité
          </Button>
          <Button type="button" variant="secondary" size="md" disabled title="Import opportunités à finaliser">
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button type="button" variant="secondary" size="md" disabled title="Les filtres sont disponibles dans la toolbar">
            <Filter className="h-4 w-4" />
            Filtres
          </Button>
        </div>
      </div>
    </header>
  );
}
