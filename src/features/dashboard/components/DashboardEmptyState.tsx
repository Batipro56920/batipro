import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { EmptyState } from "../../../components/ui/design-system";

export function DashboardEmptyState() {
  return (
    <EmptyState
      title="Cockpit prêt à démarrer"
      description="Créez un chantier ou ouvrez le CRM pour alimenter les priorités, alertes et indicateurs."
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/chantiers/nouveau">
            <Button variant="primary" size="sm">Nouveau chantier</Button>
          </Link>
          <Link to="/crm">
            <Button variant="secondary" size="sm">Ouvrir le CRM</Button>
          </Link>
        </div>
      }
    />
  );
}
