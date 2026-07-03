import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness } from "lucide-react";
import { supabase } from "../../../lib/supabaseClient";
import type { DashboardBusinessMetric, DashboardTone } from "../types";

type DashboardBusinessPanelProps = {
  metrics: DashboardBusinessMetric[];
};

type BusinessMetricCounts = Partial<Record<DashboardBusinessMetric["key"], number>>;

const toneClass = {
  normal: "bg-slate-50 text-slate-700",
  info: "bg-blue-50 text-blue-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-red-50 text-red-700",
};

const clientDocumentsMetric: DashboardBusinessMetric = {
  key: "clientDocuments",
  label: "Docs client en attente",
  value: "—",
  hint: "Validation / signature client",
  href: "/factures",
  tone: "warning",
};

const purchaseOrdersMetric: DashboardBusinessMetric = {
  key: "purchaseOrders",
  label: "Commandes à traiter",
  value: "—",
  hint: "Suivi décaissements",
  href: "/financier/decaissements",
  tone: "warning",
};

function metricTone(metric: DashboardBusinessMetric, count: number | null): DashboardTone {
  if (count === null) return metric.tone;
  if (count === 0) return "success";
  return metric.tone === "normal" ? "warning" : metric.tone;
}

async function countRows(query: PromiseLike<{ count: number | null; error: { message?: string } | null }>) {
  const { count, error } = await query;
  if (error) return null;
  return count ?? 0;
}

async function loadBusinessMetricCounts(): Promise<BusinessMetricCounts> {
  const [quotes, opportunities, invoices, sav, clientDocuments, purchaseOrders] = await Promise.all([
    countRows(
      supabase
        .from("crm_quotes" as any)
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .not("sent_at", "is", null)
        .not("signature_status", "in", "(signe,refuse)") as any,
    ),
    countRows(
      supabase
        .from("crm_opportunities" as any)
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .not("status", "in", "(won,lost,archive,archived)") as any,
    ),
    countRows(
      supabase
        .from("invoices" as any)
        .select("id", { count: "exact", head: true })
        .in("status", ["sent", "overdue", "viewed"]) as any,
    ),
    countRows(
      supabase
        .from("crm_sav" as any)
        .select("id", { count: "exact", head: true })
        .is("closed_at", null) as any,
    ),
    countRows(
      supabase
        .from("document_client_workflows" as any)
        .select("id", { count: "exact", head: true })
        .is("revoked_at", null)
        .in("status", ["sent", "viewed", "modification_requested"]) as any,
    ),
    countRows(
      supabase
        .from("purchase_orders" as any)
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "sent", "confirmed", "partially_delivered"]) as any,
    ),
  ]);

  return {
    quotes: quotes ?? undefined,
    opportunities: opportunities ?? undefined,
    invoices: invoices ?? undefined,
    sav: sav ?? undefined,
    clientDocuments: clientDocuments ?? undefined,
    purchaseOrders: purchaseOrders ?? undefined,
  };
}

export function DashboardBusinessPanel({ metrics }: DashboardBusinessPanelProps) {
  const [counts, setCounts] = useState<BusinessMetricCounts>({});
  const [loadingCounts, setLoadingCounts] = useState(false);
  const panelMetrics = useMemo(() => [...metrics, clientDocumentsMetric, purchaseOrdersMetric], [metrics]);

  useEffect(() => {
    let alive = true;
    setLoadingCounts(true);
    loadBusinessMetricCounts()
      .then((nextCounts) => {
        if (alive) setCounts(nextCounts);
      })
      .catch(() => {
        if (alive) setCounts({});
      })
      .finally(() => {
        if (alive) setLoadingCounts(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-950/[0.03]">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-700">Business</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">CRM & rentabilité</h2>
        </div>
        <BriefcaseBusiness className="h-5 w-5 text-slate-300" />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {panelMetrics.map((metric) => {
          const count = counts[metric.key] ?? null;
          const value = loadingCounts && count === null ? "..." : count === null ? metric.value : String(count);
          const tone = metricTone(metric, count);

          return (
            <Link key={metric.key} to={metric.href} className="group rounded-2xl border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50/40">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-950">{metric.label}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{metric.hint}</div>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-sm font-bold ${toneClass[tone]}`}>{value}</span>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-700">
                Ouvrir
                <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
