import { useEffect, useState } from "react";
import type { ProjectRecord } from "../types";
import type { ProjectProfitabilityMetrics } from "../utils/projectProfitability";
import { buildProjectProfitability } from "../utils/projectProfitability";
import { EmptyProjectBlock, Panel } from "./ProjectShared";
import { ProjectProfitabilitySummary, ProjectProfitabilityWidgets, formatCurrency } from "./ProjectProfitabilityWidgets";

export function ProjectProfitabilityTab({ project }: { project: ProjectRecord }) {
  const [metrics, setMetrics] = useState<ProjectProfitabilityMetrics | null>(null);

  useEffect(() => {
    let alive = true;
    setMetrics(null);
    buildProjectProfitability(project)
      .then((nextMetrics) => {
        if (alive) setMetrics(nextMetrics);
      })
      .catch(() => {
        if (alive) setMetrics(null);
      });
    return () => {
      alive = false;
    };
  }, [project]);

  if (!metrics) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement de la rentabilité...</div>;
  }

  const alerts = buildProfitabilityAlerts(metrics);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-blue-600">Rentabilité projet</div>
            <h2 className="mt-1 text-xl font-semibold text-slate-950">Lecture dirigeant</h2>
            <p className="mt-1 text-sm text-slate-500">Vendu, facturé, encaissé, coûts et marge à lire en moins de 30 secondes.</p>
          </div>
          <DataQualityBadge mode={metrics.dataMode} />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <DirectorKpi label="Vendu" value={formatCurrency(metrics.soldAmountHt)} helper="Montant travaux HT" />
          <DirectorKpi label="Facturé" value={formatCurrency(metrics.invoicedTtc)} helper={`${metrics.billingProgress}% TTC`} />
          <DirectorKpi label="Encaissé" value={formatCurrency(metrics.paidTtc)} helper={`${metrics.paymentProgress}% TTC`} />
          <DirectorKpi label="Achats" value={formatCurrency(metrics.purchasesHt)} helper="Fournisseurs / ST" />
          <DirectorKpi label="Main d'œuvre" value={formatCurrency(metrics.laborHt)} helper="Prévue ou réelle" />
          <DirectorKpi label="Marge brute" value={formatCurrency(metrics.grossMarginHt)} helper="HT" tone={metrics.grossMarginHt < 0 ? "danger" : metrics.marginRate < 15 ? "warning" : "success"} />
          <DirectorKpi label="Taux marge" value={`${metrics.marginRate}%`} helper="Objectif à piloter" tone={metrics.marginRate < 15 ? "warning" : "success"} />
        </div>
      </section>

      <ProjectProfitabilityWidgets metrics={metrics} />
      <ProjectProfitabilitySummary metrics={metrics} />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Avancement financier" description="Facturation, encaissement, achats et marge du projet.">
          <div className="space-y-4">
            <FinanceBar label="Facturation" value={metrics.billingProgress} amount={formatCurrency(metrics.invoicedTtc)} target={formatCurrency(metrics.soldAmountTtc)} tone="blue" />
            <FinanceBar label="Encaissement" value={metrics.paymentProgress} amount={formatCurrency(metrics.paidTtc)} target={formatCurrency(metrics.invoicedTtc || metrics.soldAmountTtc)} tone="emerald" />
            <FinanceBar label="Achats" value={progress(metrics.purchasesHt, metrics.soldAmountHt)} amount={formatCurrency(metrics.purchasesHt)} target={formatCurrency(metrics.soldAmountHt)} tone="amber" />
            <FinanceBar label="Marge" value={Math.max(0, Math.min(100, metrics.marginRate))} amount={formatCurrency(metrics.grossMarginHt)} target={`${metrics.marginRate}%`} tone={metrics.marginRate < 15 ? "red" : "slate"} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <MetricCard label="Reste à facturer" value={formatCurrency(metrics.remainingToInvoiceTtc)} helper="Sur montant travaux vendu" />
            <MetricCard label="Reste à encaisser" value={formatCurrency(metrics.remainingToCollectTtc)} helper="Sur factures émises" />
          </div>
        </Panel>

        <Panel title="Alertes dirigeant" description="Points financiers à traiter avant dérive.">
          <div className="space-y-3 text-sm text-slate-600">
            {alerts.length === 0 ? (
              <EmptyProjectBlock title="Aucune alerte critique" description="La rentabilité projet ne présente pas d'écart majeur avec les données disponibles." />
            ) : (
              alerts.map((alert) => <ProfitabilityAlert key={alert.title} {...alert} />)
            )}
            <div className="space-y-3 border-t border-slate-100 pt-3">
              <InfoLine label="Devis accepté" value={metrics.acceptedQuoteNumber ?? "Aucun devis accepté détecté"} />
              <InfoLine label="Factures liées" value={`${metrics.invoiceCount}`} />
              <InfoLine label="Mode calcul" value={metrics.dataMode === "estimated" ? "Estimation locale" : metrics.dataMode === "mixed" ? "Réel + estimation" : "Données réelles"} />
            </div>
            {metrics.dataMode === "estimated" ? (
              <EmptyProjectBlock
                title="Backend rentabilité à connecter"
                description="Les achats et la main-d'œuvre sont estimés tant que les coûts réels projet/chantier ne sont pas disponibles."
              />
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel title="Coûts projet" description="Base V1 pour la future rentabilité projet et chantier.">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Poste</th>
                <th className="px-4 py-3 text-right">Montant HT</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <CostRow label="Achats / sous-traitance" value={metrics.purchasesHt} source={metrics.dataMode === "estimated" ? "Estimation V1" : "Chantier lié"} />
              <CostRow label="Main d'œuvre" value={metrics.laborHt} source={metrics.dataMode === "estimated" ? "Estimation V1" : "Chantier lié"} />
              <CostRow label="Marge brute" value={metrics.grossMarginHt} source="Calcul" strong />
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function DirectorKpi({ label, value, helper, tone = "neutral" }: { label: string; value: string; helper: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const toneClass = {
    neutral: "border-slate-200 bg-slate-50 text-slate-950",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
  }[tone];
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] opacity-70">{label}</div>
      <div className="mt-2 text-lg font-bold">{value}</div>
      <div className="mt-1 text-xs opacity-70">{helper}</div>
    </div>
  );
}

function FinanceBar({ label, value, amount, target, tone }: { label: string; value: number; amount: string; target: string; tone: "blue" | "emerald" | "amber" | "slate" | "red" }) {
  const color = {
    blue: "bg-blue-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-500",
    slate: "bg-slate-950",
    red: "bg-red-500",
  }[tone];
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-950">{label}</span>
        <span className="text-slate-500">{amount} / {target}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-xl font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{helper}</div>
    </div>
  );
}

function ProfitabilityAlert({ title, description, tone }: { title: string; description: string; tone: "danger" | "warning" }) {
  const className = tone === "danger" ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <div className={`rounded-2xl border px-4 py-3 ${className}`}>
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-xs opacity-80">{description}</div>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-950">{value}</span>
    </div>
  );
}

function CostRow({ label, value, source, strong }: { label: string; value: number; source: string; strong?: boolean }) {
  return (
    <tr className={strong ? "bg-slate-50" : undefined}>
      <td className="px-4 py-3 font-semibold text-slate-950">{label}</td>
      <td className="px-4 py-3 text-right font-semibold text-slate-950">{formatCurrency(value)}</td>
      <td className="px-4 py-3 text-slate-500">{source}</td>
    </tr>
  );
}

function DataQualityBadge({ mode }: { mode: ProjectProfitabilityMetrics["dataMode"] }) {
  const label = mode === "real" ? "Données réelles" : mode === "mixed" ? "Réel + estimation" : "Estimation V1";
  const className = mode === "real"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : mode === "mixed"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

function buildProfitabilityAlerts(metrics: ProjectProfitabilityMetrics) {
  const alerts: Array<{ title: string; description: string; tone: "danger" | "warning" }> = [];
  if (metrics.marginRate > 0 && metrics.marginRate < 15) {
    alerts.push({ title: "Marge faible", description: `Taux de marge à ${metrics.marginRate}%. Vérifier achats, main d'œuvre et prix de vente.`, tone: "warning" });
  }
  if (metrics.grossMarginHt < 0) {
    alerts.push({ title: "Marge négative", description: "Les coûts estimés dépassent le montant vendu.", tone: "danger" });
  }
  if (metrics.purchasesHt > metrics.soldAmountHt && metrics.soldAmountHt > 0) {
    alerts.push({ title: "Achats supérieurs au vendu", description: "Les achats engagés dépassent le montant travaux HT.", tone: "danger" });
  }
  if (metrics.remainingToCollectTtc > 0 && metrics.invoicedTtc > 0) {
    alerts.push({ title: "Encaissement à suivre", description: `${formatCurrency(metrics.remainingToCollectTtc)} restent à encaisser.`, tone: "warning" });
  }
  if (metrics.remainingToInvoiceTtc > 0 && metrics.soldAmountTtc > 0) {
    alerts.push({ title: "Facturation incomplète", description: `${formatCurrency(metrics.remainingToInvoiceTtc)} restent à facturer.`, tone: "warning" });
  }
  return alerts;
}

function progress(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}
