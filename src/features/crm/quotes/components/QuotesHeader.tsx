import { FileText, Layers3, Upload } from "lucide-react";
import { Button } from "../../../../components/ui/button";

export function QuotesHeader({ onCreate }: { onCreate: () => void }) {
  return (
    <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">CRM</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Devis</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Suivez les devis, signatures et transformations chantier. La création et l'édition passent par le Quote Builder depuis un projet.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="primary" size="md" onClick={onCreate}>
            <FileText className="h-4 w-4" />
            Créer depuis un projet
          </Button>
          <Button type="button" variant="secondary" size="md" disabled title="Import devis à finaliser">
            <Upload className="h-4 w-4" />
            Import
          </Button>
          <Button type="button" variant="secondary" size="md" disabled title="Modèles de devis à finaliser">
            <Layers3 className="h-4 w-4" />
            Modèles
          </Button>
        </div>
      </div>
    </header>
  );
}
