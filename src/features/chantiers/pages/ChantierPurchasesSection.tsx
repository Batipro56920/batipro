import { Link } from "react-router-dom";

import ApprovisionnementTab from "../../../components/chantiers/ApprovisionnementTab";
import type { ChantierTaskRow } from "../../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../../services/chantierZones.service";
import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

export default function ChantierPurchasesSection({
  chantierId,
  tasks,
  zones,
}: {
  chantierId: string;
  tasks: ChantierTaskRow[];
  zones: ChantierZoneRow[];
}) {
  const purchaseOrdersHref = `/bons-commande?chantierId=${encodeURIComponent(chantierId)}`;

  return (
    <ChantierChapterDrawer
      eyebrow="Approvisionnement"
      title="Materiel et achats"
      subtitle="Demandes et besoins materiel du chantier. La saisie detaillee se fait dans le panneau lateral."
      actionLabel="Gerer l'approvisionnement"
      previewClassName="batipro-chapter-preview--purchases"
    >
      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-semibold">Suite achat liee au chantier</div>
            <div className="mt-1 text-blue-800/80">
              Controlez les produits disponibles ou transformez les besoins materiel en commande fournisseur depuis les modules achats.
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/catalogue-produits"
              className="inline-flex shrink-0 items-center justify-center rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
            >
              Catalogue produits
            </Link>
            <Link
              to={purchaseOrdersHref}
              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
            >
              Bons de commande chantier
            </Link>
          </div>
        </div>
      </div>
      <ApprovisionnementTab chantierId={chantierId} tasks={tasks} zones={zones} />
    </ChantierChapterDrawer>
  );
}
