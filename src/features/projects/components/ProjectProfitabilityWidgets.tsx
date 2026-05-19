import type { ProjectRecord } from "../types";
import { useEffect, useState } from "react";
import { buildProjectProfitability, type ProjectProfitabilityMetrics } from "../utils/projectProfitability";

export function ProjectProfitabilityWidgets({ project, metrics: providedMetrics }: { project?: ProjectRecord; metrics?: ProjectProfitabilityMetrics }) {
  const [loadedMetrics, setLoadedMetrics] = useState<ProjectProfitabilityMetrics | null>(providedMetrics ?? null);

  useEffect(() => {
    if (providedMetrics) {
      setLoadedMetrics(providedMetrics);
      return;
    }

    if (!project) {
      setLoadedMetrics(null);
      return;
    }

    let active = true;
    setLoadedMetrics(null);
    buildProjectProfitability(project)
      .then((metrics) => {
        if (active) setLoadedMetrics(metrics);
      })
      .catch(() => {
        if (active) setLoadedMetrics(null);
      });

    return () => {
      active = false;
    };
  }, [project, providedMetrics]);

  const metrics = providedMetrics ?? loadedMetrics;

  if (!metrics) {
    return (
      <div className="grid gap-3 lg:grid-cols-3">
        {["Facturation", "Paiement", "Marge"].map((title) => (
          <div key={title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="h-4 w-28 rounded bg-slate-100" />
            <div className="mt-3 h-3 w-40 rounded bg-slate-100" />
            <div className="mt-4 h-2 rounded-full bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <ProgressWidget
        title="Facturation"
        value={metrics.billingProgress}
        description={`${formatCurrency(metrics.invoicedTtc)} factures sur ${formatCurrency(metrics.soldAmountTtc)}`}
        tone="blue"
      />
      <ProgressWidget
        title="Paiement"
        value={metrics.paymentProgress}
        description={`${formatCurrency(metrics.paidTtc)} encaissés, ${formatCurrency(metrics.remainingToCollectTtc)} restants`}
        tone="emerald"
      />
      <ProgressWidget
        title="Marge"
        value={metrics.marginProgress}
        description={`${formatCurrency(metrics.grossMarginHt)} HT - ${formatPercent(metrics.marginRate)}`}
        tone={metrics.marginRate < 15 ? "amber" : "slate"}
      />
    </div>
  );
}

export function ProjectProfitabilitySummary({ metrics }: { metrics: ProjectProfitabilityMetrics }) {
  const rows = [
    ["Montant travaux", formatCurrency(metrics.soldAmountHt), "HT"],
    ["Achats", formatCurrency(metrics.purchasesHt), "HT"],
    ["Main d'œuvre", formatCurrency(metrics.laborHt), "HT"],
    ["Marge brute", formatCurrency(metrics.grossMarginHt), "HT"],
    ["Taux de marge", formatPercent(metrics.marginRate), metrics.dataMode === "estimated" ? "estimé" : metrics.dataMode],
  ];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950">Synthèse rentabilité</h3>
          <p className="mt-1 text-sm text-slate-500">Vision travaux, coûts et marge du dossier projet.</p>
        </div>
        <DataModeBadge mode={metrics.dataMode} />
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {rows.map(([label, value, meta]) => (
          <div key={label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
            <div className="mt-2 text-lg font-bold text-slate-950">{value}</div>
            <div className="mt-1 text-xs font-medium text-slate-500">{meta}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressWidget({ title, value, description, tone }: { title: string; value: number; description: string; tone: "blue" | "emerald" | "amber" | "slate" }) {
  const color = {
    blue: "bg-blue-600",
    emerald: "bg-emerald-600",
    amber: "bg-amber-500",
    slate: "bg-slate-950",
  }[tone];

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-950">{title}</div>
          <div className="mt-1 text-xs text-slate-500">{description}</div>
        </div>
        <div className="text-xl font-bold text-slate-950">{value}%</div>
      </div>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function DataModeBadge({ mode }: { mode: ProjectProfitabilityMetrics["dataMode"] }) {
  const label = mode === "real" ? "Données réelles" : mode === "mixed" ? "Données mixtes" : "Estimation V1";
  const className = mode === "real"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : mode === "mixed"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${className}`}>{label}</span>;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)}%`;
}
