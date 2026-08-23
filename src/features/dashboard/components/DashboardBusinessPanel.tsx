import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { supabase } from "../../../lib/supabaseClient";
import { DashboardSection } from "./DashboardSection";
import { TONE_SOFT } from "./tone";
import type { DashboardBusinessMetric, DashboardTone } from "../types";

type DashboardBusinessPanelProps = {
  metrics: DashboardBusinessMetric[];
  defaultOpen?: boolean;
};

type BusinessMetricCounts = Partial<Record<string, number>>;

const CLIENT_DOCUMENT_ACTIONABLE_STATUSES = ["sent", "viewed", "modification_requested", "expired"];
const COLLECTABLE_INVOICE_STATUSES = ["sent", "partially_paid", "overdue"];

function metricTone(metric: DashboardBusinessMetric, count: number | null): DashboardTone {
  // Compteur indisponible : ton neutre. Une donnee absente ne se presente pas
  // comme une donnee, encore moins comme une alerte.
  if (count === null) return "normal";
  if (count === 0) return "success";
  return metric.tone === "normal" ? "warning" : metric.tone;
}

async function countRows(query: PromiseLike<{ count: number | null; error: { message?: string } | null }>) {
  const { count, error } = await query;
  if (error) return null;
  return count ?? 0;
}

async function loadBusinessMetricCounts(): Promise<BusinessMetricCounts> {
  const [quotes, opportunities, invoices, sav, clientDocuments, purchaseOrders, apporteurCommissions] = await Promise.all([
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
        .in("status", COLLECTABLE_INVOICE_STATUSES) as any,
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
        .in("status", CLIENT_DOCUMENT_ACTIONABLE_STATUSES) as any,
    ),
    countRows(
      supabase
        .from("purchase_orders" as any)
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "sent", "confirmed", "partially_delivered"]) as any,
    ),
    countRows(
      supabase
        .from("apporteur_leads" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "commission_a_payer") as any,
    ),
  ]);

  return {
    quotes: quotes ?? undefined,
    opportunities: opportunities ?? undefined,
    invoices: invoices ?? undefined,
    sav: sav ?? undefined,
    clientDocuments: clientDocuments ?? undefined,
    purchaseOrders: purchaseOrders ?? undefined,
    apporteurCommissions: apporteurCommissions ?? undefined,
  };
}

/**
 * Niveau contexte : repliee par defaut, elle ne remonte que le total reellement
 * actionnable (encaissements, documents client, commandes) sur son en-tete.
 */
export function DashboardBusinessPanel({ metrics, defaultOpen = false }: DashboardBusinessPanelProps) {
  const [counts, setCounts] = useState<BusinessMetricCounts>({});
  const [loadingCounts, setLoadingCounts] = useState(true);

  useEffect(() => {
    let alive = true;
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

  const actionableTotal = useMemo(
    () =>
      metrics
        .filter((metric) => metric.actionable)
        .reduce<number>((sum, metric) => sum + (counts[metric.key] ?? 0), 0),
    [counts, metrics],
  );

  // Un compteur indisponible n'est pas un compteur a zero : on n'annonce pas
  // "Rien a traiter" quand la requete a echoue.
  const hasCounts = Object.values(counts).some((value) => typeof value === "number");

  const summary = loadingCounts
    ? "Chargement…"
    : !hasCounts
      ? "Compteurs indisponibles"
      : actionableTotal > 0
        ? `${actionableTotal} en attente`
        : "Rien à traiter";

  return (
    <DashboardSection
      title="Activité commerciale"
      summary={summary}
      defaultOpen={defaultOpen}
      action={
        <Link to="/crm">
          <Button variant="secondary" size="sm">Ouvrir le CRM</Button>
        </Link>
      }
    >
      <ul className="divide-y divide-subtle">
        {metrics.map((metric) => {
          const count = counts[metric.key] ?? null;
          const value = loadingCounts && count === null ? "…" : count === null ? metric.value : String(count);
          const tone = metricTone(metric, count);

          return (
            <li key={metric.key}>
              <Link
                to={metric.href}
                className="bt-row flex items-center justify-between gap-4 px-4 py-3 transition-colors duration-[90ms] hover:bg-interactive focus-visible:bg-interactive sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="bt-card-title block truncate text-ink">{metric.label}</span>
                  <span className="bt-secondary mt-0.5 block truncate text-muted">{metric.hint}</span>
                </span>
                <span className={`bt-num shrink-0 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${TONE_SOFT[tone]}`}>
                  {value}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </DashboardSection>
  );
}
