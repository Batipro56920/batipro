import { Download, FileUp, Plus } from "lucide-react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { Button } from "../../../../components/ui/button";

type Props = {
  eyebrow?: string;
  title?: string;
  description?: string;
  onNew: () => void;
  onExport: () => void;
};

export function ChantiersHeader({
  eyebrow = "Production",
  title = "Production chantier",
  description = "Pilotez vos chantiers, avancement, alertes et équipes.",
  onNew,
  onExport,
}: Props) {
  return (
    <PageHeader
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={
        <>
          <Button type="button" variant="secondary" onClick={onNew}>
            <Plus className="h-4 w-4" />
            Nouveau chantier
          </Button>
          <Button type="button" variant="secondary" disabled title="Import chantier à brancher sur le moteur d'import.">
            <FileUp className="h-4 w-4" />
            Import
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
