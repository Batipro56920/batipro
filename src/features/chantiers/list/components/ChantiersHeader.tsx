import { Download, Hammer, Plus } from "lucide-react";
import { Button } from "../../../../components/ui/button";

type Props = {
  eyebrow?: string;
  title?: string;
  description?: string;
  onNewFromSignedQuote: () => void;
  onNewBlank: () => void;
  onExport: () => void;
};

/**
 * Niveau 0 : ligne de contexte, titre de page, actions.
 * L'eyebrow reste affiche mais perd ses capitales et son tracking (charte, section 3).
 */
export function ChantiersHeader({
  eyebrow = "Production",
  title = "Production chantier",
  description = "Pilotez vos chantiers, avancement, alertes et équipes.",
  onNewFromSignedQuote,
  onNewBlank,
  onExport,
}: Props) {
  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="bt-caption text-muted">{eyebrow}</p> : null}
        <h1 className="bt-page-title mt-0.5 text-ink">{title}</h1>
        {description ? <p className="bt-secondary mt-1 max-w-3xl text-muted">{description}</p> : null}
      </div>

      {/* Une seule action primaire : lancer la production depuis une affaire signee. */}
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button type="button" variant="primary" onClick={onNewFromSignedQuote}>
          <Hammer className="h-4 w-4" strokeWidth={1.75} />
          Depuis affaire signée
        </Button>
        <Button type="button" variant="secondary" onClick={onNewBlank}>
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Chantier libre
        </Button>
        <Button type="button" variant="ghost" onClick={onExport}>
          <Download className="h-4 w-4" strokeWidth={1.75} />
          Export
        </Button>
      </div>
    </header>
  );
}
