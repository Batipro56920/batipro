import { Download, FileUp, Plus } from "lucide-react";
import { PageHeader } from "../../../../components/layout/PageHeader";
import { Button } from "../../../../components/ui/button";

export function ChantiersHeader({ onNew, onExport }: { onNew: () => void; onExport: () => void }) {
  return (
    <PageHeader
      eyebrow="Production"
      title="Production chantier"
      description="Pilotez vos chantiers, avancement, alertes et équipes."
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

