import { Download, Hammer, Plus } from "lucide-react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { Button } from "../../../../components/ui/button";

type Props = {
  eyebrow?: string;
  title?: string;
  description?: string;
  onNewFromSignedQuote: () => void;
  onNewBlank: () => void;
  onExport: () => void;
};

export function ChantiersHeader({
  eyebrow = "Production",
  title = "Production chantier",
  description = "Pilotez vos chantiers, avancement, alertes et équipes.",
  onNewFromSignedQuote,
  onNewBlank,
  onExport,
}: Props) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={
        <>
          <Button type="button" variant="success" onClick={onNewFromSignedQuote}>
            <Hammer className="h-4 w-4" />
            Depuis affaire signée
          </Button>
          <Button type="button" variant="secondary" onClick={onNewBlank}>
            <Plus className="h-4 w-4" />
            Chantier libre
          </Button>
          <Button type="button" variant="secondary" onClick={onExport}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </>
      }
    />
  );
}
