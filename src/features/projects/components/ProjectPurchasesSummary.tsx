import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ShoppingCart } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import { calculateDocumentTotals, type BusinessDocument } from "../../document-engine";
import type { ProjectRecord } from "../types";
import { formatCurrency } from "./ProjectShared";

const OPEN_PURCHASE_ORDER_STATUSES = ["draft", "sent", "confirmed", "partially_delivered"] as const;

type ProjectPurchaseOrderStatus = "draft" | "sent" | "confirmed" | "partially_delivered" | "delivered" | "cancelled";

type ProjectPurchaseOrderRow = {
  id: string;
  status: ProjectPurchaseOrderStatus;
  project_id: string | null;
  expected_delivery_date: string | null;
  document: BusinessDocument | null;
};

type ProjectPurchaseSummary = {
  total: number;
  open: number;
  overdue: number;
  totalHt: number;
};

export function ProjectPurchasesSummary({ project, purchaseOrdersPath }: { project: ProjectRecord; purchaseOrdersPath: string }) {
  const projectIds = useMemo(() => Array.from(new Set([project.id, project.sourceId].filter(Boolean))), [project.id, project.sourceId]);
  const [summary, setSummary] = useState<ProjectPurchaseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      if (!projectIds.length) {
        setSummary({ total: 0, open: 0, overdue: 0, totalHt: 0 });
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const { data, error: requestError } = await supabase
          .from("purchase_orders" as any)
          .select("id,status,project_id,expected_delivery_date,document")
          .in("project_id", projectIds)
          .overrideTypes<ProjectPurchaseOrderRow[]>();

        if (requestError) throw new Error(requestError.message);
        if (cancelled) return;
        setSummary(buildSummary(data ?? []));
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Suivi achats indisponible.");
        setSummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSummary();
    return () => {
      cancelled = true;
    };
  }, [projectIds]);

  if (loading) {
    return (
      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
        Chargement du suivi achats projet...
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:flex-row sm:items-center sm:justify-between">
        <span>Suivi achats projet indisponible.</span>
        <Link to={purchaseOrdersPath} className="inline-flex h-8 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-white px-3 text-xs font-semibold text-amber-800 transition hover:bg-amber-100">
          <ShoppingCart className="h-4 w-4" />
          Ouvrir les achats
        </Link>
      </div>
    );
  }

  const currentSummary = summary ?? { total: 0, open: 0, overdue: 0, totalHt: 0 };

  return (
    <section className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-950">
            <ShoppingCart className="h-4 w-4 text-blue-600" />
            Suivi achats projet
            {currentSummary.overdue > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                <AlertTriangle className="h-3.5 w-3.5" />
                {currentSummary.overdue} livraison{currentSummary.overdue > 1 ? "s" : ""} en retard
              </span>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
            <span>{currentSummary.total} bon{currentSummary.total > 1 ? "s" : ""} rattaché{currentSummary.total > 1 ? "s" : ""}</span>
            <span>{currentSummary.open} ouvert{currentSummary.open > 1 ? "s" : ""}</span>
            <span>{formatCurrency(currentSummary.totalHt)} HT engagé</span>
          </div>
        </div>
        <Link to={purchaseOrdersPath} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100">
          Voir les commandes
        </Link>
      </div>
    </section>
  );
}

function buildSummary(orders: ProjectPurchaseOrderRow[]): ProjectPurchaseSummary {
  const today = new Date().toISOString().slice(0, 10);
  return orders.reduce<ProjectPurchaseSummary>(
    (summary, order) => {
      const isOpen = OPEN_PURCHASE_ORDER_STATUSES.includes(order.status as (typeof OPEN_PURCHASE_ORDER_STATUSES)[number]);
      const expectedDeliveryDate = order.expected_delivery_date?.slice(0, 10) ?? "";
      return {
        total: summary.total + 1,
        open: summary.open + (isOpen ? 1 : 0),
        overdue: summary.overdue + (isOpen && expectedDeliveryDate && expectedDeliveryDate < today ? 1 : 0),
        totalHt: summary.totalHt + calculateOrderTotalHt(order.document),
      };
    },
    { total: 0, open: 0, overdue: 0, totalHt: 0 },
  );
}

function calculateOrderTotalHt(document: BusinessDocument | null) {
  if (!document) return 0;
  try {
    return calculateDocumentTotals(document).totalHt;
  } catch {
    return 0;
  }
}
