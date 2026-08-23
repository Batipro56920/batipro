import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Button } from "../../../components/ui/button";

/** Etat vide de premier lancement : une bonne nouvelle, pas une panne. */
export function DashboardEmptyState() {
  return (
    <section className="flex flex-col items-center gap-3 rounded-card border border-subtle bg-surface px-6 py-14 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary-on">
        <Compass className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h2 className="bt-section-title text-ink">Rien à piloter pour l’instant</h2>
      <p className="bt-secondary max-w-md text-muted">
        Créez un chantier ou ouvrez le CRM : les priorités, les alertes et la charge de vos équipes apparaîtront ici.
      </p>
      <div className="mt-1 flex flex-wrap justify-center gap-2">
        <Link to="/chantiers/nouveau">
          <Button variant="primary" size="md">Nouveau chantier</Button>
        </Link>
        <Link to="/crm">
          <Button variant="secondary" size="md">Ouvrir le CRM</Button>
        </Link>
      </div>
    </section>
  );
}
