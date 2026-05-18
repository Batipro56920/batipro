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

  return (
    <div className="space-y-5">
      <ProjectProfitabilityWidgets metrics={metrics} />
      <ProjectProfitabilitySummary metrics={metrics} />

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Avancement financier" description="Facturation, encaissement et reste a traiter sur le projet.">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricCard label="Facture" value={formatCurrency(metrics.invoicedTtc)} helper={`${metrics.billingProgress}% du montant travaux`} />
            <MetricCard label="Encaisse" value={formatCurrency(metrics.paidTtc)} helper={`${metrics.paymentProgress}% des factures`} />
            <MetricCard label="Reste a facturer" value={formatCurrency(metrics.remainingToInvoiceTtc)} helper="Sur montant travaux vendu" />
            <MetricCard label="Reste a encaisser" value={formatCurrency(metrics.remainingToCollectTtc)} helper="Sur factures emises" />
          </div>
        </Panel>

        <Panel title="Origine des donnees" description="V1 lit les snapshots existants et estime le reste si le backend n'est pas encore pret.">
          <div className="space-y-3 text-sm text-slate-600">
            <InfoLine label="Devis accepte" value={metrics.acceptedQuoteNumber ?? "Aucun devis accepte detecte"} />
            <InfoLine label="Factures liees" value={`${metrics.invoiceCount}`} />
            <InfoLine label="Mode calcul" value={metrics.dataMode === "estimated" ? "Estimation locale" : metrics.dataMode === "mixed" ? "Reel + estimation" : "Donnees reelles"} />
            {metrics.dataMode === "estimated" ? (
              <EmptyProjectBlock
                title="Backend rentabilite a connecter"
                description="Les achats et la main-d'oeuvre sont estimes tant que les couts reels projet/chantier ne sont pas disponibles."
              />
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel title="Couts projet" description="Base V1 pour la future rentabilite projet et chantier.">
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
              <CostRow label="Achats / sous-traitance" value={metrics.purchasesHt} source={metrics.dataMode === "estimated" ? "Estimation V1" : "Chantier lie"} />
              <CostRow label="Main-d'oeuvre" value={metrics.laborHt} source={metrics.dataMode === "estimated" ? "Estimation V1" : "Chantier lie"} />
              <CostRow label="Marge brute" value={metrics.grossMarginHt} source="Calcul" strong />
            </tbody>
          </table>
        </div>
      </Panel>
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
