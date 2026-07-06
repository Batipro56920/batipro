import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import ApprovisionnementTab from "../../../components/chantiers/ApprovisionnementTab";
import { supabase } from "../../../lib/supabaseClient";
import type { ChantierTaskRow } from "../../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../../services/chantierZones.service";
import ChantierChapterDrawer from "../components/ChantierChapterDrawer";

type PurchaseOrderStatus = "draft" | "sent" | "confirmed" | "partially_delivered" | "delivered" | "cancelled";

type PurchaseOrderSummaryRow = {
  id: string;
  status: PurchaseOrderStatus;
  expected_delivery_date: string | null;
};

const OPEN_PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = ["draft", "sent", "confirmed", "partially_delivered"];

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
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderSummaryRow[]>([]);
  const [purchaseOrdersLoading, setPurchaseOrdersLoading] = useState(true);
  const [purchaseOrdersError, setPurchaseOrdersError] = useState(false);
  const purchaseOrderSummary = useMemo(() => buildPurchaseOrderSummary(purchaseOrders), [purchaseOrders]);

  useEffect(() => {
    let ignore = false;

    async function loadPurchaseOrderSummary() {
      setPurchaseOrdersLoading(true);
      setPurchaseOrdersError(false);
      try {
        const { data, error } = await supabase
          .from("purchase_orders" as any)
          .select("id,status,expected_delivery_date")
          .eq("chantier_id", chantierId)
          .overrideTypes<PurchaseOrderSummaryRow[]>();

        if (error) throw error;
        if (!ignore) setPurchaseOrders(data ?? []);
      } catch {
        if (!ignore) {
          setPurchaseOrders([]);
          setPurchaseOrdersError(true);
        }
      } finally {
        if (!ignore) setPurchaseOrdersLoading(false);
      }
    }

    void loadPurchaseOrderSummary();

    return () => {
      ignore = true;
    };
  }, [chantierId]);

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
            <div className="mt-3 flex flex-wrap gap-2">
              <PurchaseOrderSummaryBadge
                label="Bons chantier"
                value={purchaseOrdersLoading ? "..." : String(purchaseOrderSummary.total)}
              />
              <PurchaseOrderSummaryBadge
                label="Ouverts"
                value={purchaseOrdersLoading ? "..." : String(purchaseOrderSummary.open)}
                tone={purchaseOrderSummary.open > 0 ? "blue" : "slate"}
              />
              {purchaseOrdersError ? (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  Suivi commandes indisponible
                </span>
              ) : purchaseOrderSummary.late > 0 ? (
                <PurchaseOrderSummaryBadge label="Livraisons en retard" value={String(purchaseOrderSummary.late)} tone="amber" />
              ) : null}
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

function buildPurchaseOrderSummary(orders: PurchaseOrderSummaryRow[]) {
  const today = new Date().toISOString().slice(0, 10);
  return orders.reduce(
    (summary, order) => {
      const isOpen = OPEN_PURCHASE_ORDER_STATUSES.includes(order.status);
      const isLate = Boolean(isOpen && order.expected_delivery_date && order.expected_delivery_date < today);
      return {
        total: summary.total + 1,
        open: summary.open + (isOpen ? 1 : 0),
        late: summary.late + (isLate ? 1 : 0),
      };
    },
    { total: 0, open: 0, late: 0 },
  );
}

function PurchaseOrderSummaryBadge({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: string;
  tone?: "slate" | "blue" | "amber";
}) {
  const toneClass = {
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    blue: "border-blue-200 bg-white text-blue-800",
    slate: "border-slate-200 bg-white text-slate-600",
  }[tone];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      <span className="text-sm font-bold">{value}</span>
      {label}
    </span>
  );
}
