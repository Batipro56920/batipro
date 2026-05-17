import { Building2, Plus } from "lucide-react";
import { Button } from "../../../../components/ui/button";

export function ChantiersEmptyState({ onNew }: { onNew: () => void }) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm shadow-slate-950/[0.03]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <Building2 className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-950">Aucun chantier à afficher</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Créez un chantier ou ajustez vos filtres pour retrouver votre production.</p>
      <div className="mt-5 flex justify-center">
        <Button type="button" variant="primary" onClick={onNew}>
          <Plus className="h-4 w-4" />
          Nouveau chantier
        </Button>
      </div>
    </section>
  );
}

