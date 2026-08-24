import { Building2, Hammer, Plus } from "lucide-react";
import { Button } from "../../../../components/ui/button";

type Props = {
  onNewFromSignedQuote: () => void;
  onNewBlank: () => void;
};

/** Etat vide : une invitation, jamais une bordure pointillee (annexe F.6). */
export function ChantiersEmptyState({ onNewFromSignedQuote, onNewBlank }: Props) {
  return (
    <section className="flex flex-col items-center gap-3 rounded-card border border-subtle bg-surface px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary-on">
        <Building2 className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <h2 className="bt-card-title text-ink">Aucun chantier à afficher</h2>
      <p className="bt-secondary max-w-md text-muted">
        Lancez la production depuis une affaire signée pour reprendre le client, le devis, les budgets et les tâches de préparation.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Button type="button" variant="primary" onClick={onNewFromSignedQuote}>
          <Hammer className="h-4 w-4" strokeWidth={1.75} />
          Depuis affaire signée
        </Button>
        <Button type="button" variant="secondary" onClick={onNewBlank}>
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Chantier libre
        </Button>
      </div>
    </section>
  );
}
