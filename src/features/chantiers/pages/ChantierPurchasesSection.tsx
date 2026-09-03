import { useEffect, useMemo, useState } from "react";

import ApprovisionnementTab from "../../../components/chantiers/ApprovisionnementTab";
import { PurchaseOrdersPanel } from "../../purchase-orders/components/PurchaseOrdersPanel";
import { supabase } from "../../../lib/supabaseClient";
import type { ChantierTaskRow } from "../../../services/chantierTasks.service";
import type { ChantierZoneRow } from "../../../services/chantierZones.service";
import { listSuppliers, type SupplierRow } from "../../../services/suppliers.service";
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
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderSummaryRow[]>([]);
  const [purchaseOrdersLoading, setPurchaseOrdersLoading] = useState(true);
  const [purchaseOrdersError, setPurchaseOrdersError] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [suppliersError, setSuppliersError] = useState(false);
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

  useEffect(() => {
    let ignore = false;
    setSuppliersError(false);
    listSuppliers()
      .then((rows) => {
        if (!ignore) setSuppliers(rows);
      })
      .catch(() => {
        if (!ignore) {
          setSuppliers([]);
          setSuppliersError(true);
        }
      });
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <ChantierChapterDrawer
      eyebrow="Approvisionnement"
      title="Matériel, achats et commandes"
      subtitle="Besoins, commandes fournisseurs et livraisons rattachés à ce chantier, sans quitter son dossier."
      actionLabel="Gérer les achats du chantier"
      previewClassName="batipro-chapter-preview--purchases"
      preview={<ApprovisionnementTab chantierId={chantierId} tasks={tasks} zones={zones} />}
    >
      <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="font-semibold">Suite achat liee au chantier</div>
            <div className="mt-1 text-blue-800/80">
              Contrôlez les besoins, créez les bons de commande et suivez les livraisons directement dans ce dossier chantier.
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
        </div>
      </div>
      <ApprovisionnementTab chantierId={chantierId} tasks={tasks} zones={zones} />
      <div className="mt-6 border-t border-slate-200 pt-6">
        {suppliersError ? (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Les fournisseurs n'ont pas pu être chargés. Les commandes existantes restent consultables, mais la création peut être limitée.
          </div>
        ) : null}
        <PurchaseOrdersPanel suppliers={suppliers} chantierId={chantierId} />
      </div>
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
    amber: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    blue: "border-blue-200 bg-white text-blue-800 hover:bg-blue-100",
    slate: "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
  }[tone];
  const className = `inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`;
  const content = (
    <>
      <span className="text-sm font-bold">{value}</span>
      {label}
    </>
  );

  return <span className={className}>{content}</span>;
}
