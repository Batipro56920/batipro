import { Building2, Hammer, Plus } from "lucide-react";
import { Button } from "../../../../components/ui/button";

type Props = {
  onNewFromSignedQuote: () => void;
  onNewBlank: () => void;
};

export function ChantiersEmptyState({ onNewFromSignedQuote, onNewBlank }: Props) {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm shadow-slate-950/[0.03]">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
        <Building2 className="h-6 w-6" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-950">Aucun chantier à afficher</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Lancez la production depuis une affaire signée pour reprendre le client, le devis, les budgets et les tâches de préparation.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button type="button" variant="success" onClick={onNewFromSignedQuote}>
          <Hammer className="h-4 w-4" />
          Depuis affaire signée
        </Button>
        <Button type="button" variant="secondary" onClick={onNewBlank}>
          <Plus className="h-4 w-4" />
          Chantier libre
        </Button>
      </div>
    </section>
  );
}

