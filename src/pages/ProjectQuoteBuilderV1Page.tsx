import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QuoteBuilderWorkspace } from "../features/quotes/builder/QuoteBuilderWorkspace";
import { getDailyCleaningFlatRateDays } from "../features/quotes/builder/quoteBuilderDailyCleaning";
import { flattenQuoteBuilder } from "../features/quotes/builder/quoteBuilderCalculations";
import { loadQuoteBuilder } from "../features/quotes/builder/quoteBuilderRepository";
import {
  buildTravelCostInternalNote,
  calculateQuoteTravelCosts,
  normalizeQuoteTravelCostSettings,
} from "../features/quotes/builder/quoteBuilderTravelCosts";
import { useQuoteBuilderStore } from "../features/quotes/builder/quoteBuilderStore";
import { QuoteDocumentLoader } from "../features/quotes/builder/QuoteBuilderWorkspace";
import type { QuoteBuilderNode, QuoteBuilderQuote, QuoteTravelCostSettings } from "../features/quotes/builder/types";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";
import {
  getCurrentProfileFeaturePermissions,
  hasProfileFeaturePermission,
} from "../services/profileFeaturePermissions.service";

function quoteBuilderErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Chargement du devis impossible.";
}

function quoteRouteKey(projectId: string, quoteId?: string) {
  return `${projectId}:${quoteId ?? "new"}`;
}

export default function ProjectQuoteBuilderV1Page() {
  const { projectId, quoteId } = useParams();
  const navigate = useNavigate();
  const { projectsById, loading, error } = useProjectsData();
  const project = projectId ? projectsById.get(projectId) ?? null : null;
  const routeKey = project ? quoteRouteKey(project.id, quoteId) : null;
  const quote = useQuoteBuilderStore((state) => state.quote);
  const hydrate = useQuoteBuilderStore((state) => state.hydrate);
  const updateQuote = useQuoteBuilderStore((state) => state.updateQuote);
  const addItem = useQuoteBuilderStore((state) => state.addItem);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [permissionAllowed, setPermissionAllowed] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [loadedRouteKey, setLoadedRouteKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function verifyQuoteAccess() {
      setPermissionLoading(true);
      try {
        const current = await getCurrentProfileFeaturePermissions();
        const requiredPermission = quoteId ? "crm_quote_edit" : "crm_quote_create";
        const allowed =
          hasProfileFeaturePermission(current.permissions, "crm", current.role) &&
          hasProfileFeaturePermission(current.permissions, requiredPermission, current.role);
        if (!cancelled) setPermissionAllowed(allowed);
      } catch {
        if (!cancelled) setPermissionAllowed(false);
      } finally {
        if (!cancelled) setPermissionLoading(false);
      }
    }
    void verifyQuoteAccess();
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  useEffect(() => {
    if (!project || !permissionAllowed || !routeKey) return;
    let cancelled = false;
    setLoadedRouteKey(null);
    setQuoteLoading(true);
    setQuoteError(null);
    void loadQuoteBuilder(project, quoteId)
      .then((loaded) => {
        if (cancelled) return;
        hydrate(loaded);
        setLoadedRouteKey(routeKey);
        setQuoteLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setQuoteError(quoteBuilderErrorMessage(err));
        setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrate, permissionAllowed, project, quoteId, routeKey]);

  const quoteMatchesRoute = Boolean(
    project &&
      quote &&
      routeKey &&
      loadedRouteKey === routeKey &&
      quote.projectId === project.id &&
      (quoteId ? quote.id === quoteId : true),
  );

  if (permissionLoading) return <QuoteDocumentLoader />;

  if (!permissionAllowed) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        Votre profil ne permet pas {quoteId ? "de modifier ce devis" : "de créer un devis"}.
      </div>
    );
  }

  if (loading) return <QuoteDocumentLoader />;

  if (error || !project) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? "Projet introuvable."}</div>;
  }

  if (quoteError) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{quoteError}</div>;
  }

  if (quoteLoading || !quoteMatchesRoute || !quote) return <QuoteDocumentLoader />;

  function patchTravelCosts(patch: Partial<QuoteTravelCostSettings>) {
    if (!quote) return;
    const current = normalizeQuoteTravelCostSettings(quote.settings.travelCosts, quote.siteAddress);
    const next = normalizeQuoteTravelCostSettings({ ...current, ...patch }, quote.siteAddress);
    updateQuote({ settings: { ...quote.settings, travelCosts: next } });
  }

  function insertTravelCostLine() {
    if (!quote) return;
    const settings = normalizeQuoteTravelCostSettings(quote.settings.travelCosts, quote.siteAddress);
    const summary = calculateQuoteTravelCosts(quote);
    if (summary.totalCostHt <= 0) return;
    addItem("divers");
    window.setTimeout(() => {
      const current = useQuoteBuilderStore.getState().quote;
      const last = current ? flattenQuoteBuilder(current.nodes).filter((row) => row.node.type === "item").at(-1) : null;
      if (!last) return;
      useQuoteBuilderStore.getState().updateNode(last.id, {
        title: "Déplacement chantier",
        kind: "divers",
        quantity: 1,
        unit: "forfait",
        unitPriceHt: summary.totalCostHt,
        vatRate: settings.lineVatRate,
        internalNote: buildTravelCostInternalNote(summary),
      } as Partial<QuoteBuilderNode>);
      const latest = useQuoteBuilderStore.getState().quote;
      if (latest) {
        useQuoteBuilderStore.getState().updateQuote({
          settings: {
            ...latest.settings,
            travelCosts: {
              ...normalizeQuoteTravelCostSettings(latest.settings.travelCosts, latest.siteAddress),
              billingMode: "line",
            },
          },
        });
      }
    }, 0);
  }

  return (
    <>
      <QuoteBuilderWorkspace onClose={() => navigate(`/projets/${project.id}?tab=quotes`)} />
      <DailyCleaningFlatRateControl quote={quote} onToggle={(enabled) => updateQuote({ settings: { ...quote.settings, dailyCleaningFlatRateEnabled: enabled } })} />
      <TravelCostsControl quote={quote} onPatch={patchTravelCosts} onInsertLine={insertTravelCostLine} />
    </>
  );
}

function DailyCleaningFlatRateControl({ quote, onToggle }: { quote: QuoteBuilderQuote; onToggle: (enabled: boolean) => void }) {
  const days = getDailyCleaningFlatRateDays(quote);
  const checked = Boolean(quote.settings.dailyCleaningFlatRateEnabled);
  return (
    <aside className="fixed right-4 top-16 z-40 w-[300px] rounded-xl border border-slate-200 bg-white p-3 text-sm shadow-xl">
      <label className="flex items-start gap-3 text-slate-700">
        <input type="checkbox" className="mt-1" checked={checked} onChange={(event) => onToggle(event.target.checked)} />
        <span>
          <span className="block font-semibold text-slate-950">Forfait nettoyage journalier</span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">
            {days > 0 ? `${days} forfait(s) calculé(s) depuis la durée estimée.` : "Renseigner la durée estimée pour calculer la quantité."}
          </span>
        </span>
      </label>
    </aside>
  );
}

function TravelCostsControl({
  quote,
  onPatch,
  onInsertLine,
}: {
  quote: QuoteBuilderQuote;
  onPatch: (patch: Partial<QuoteTravelCostSettings>) => void;
  onInsertLine: () => void;
}) {
  const settings = normalizeQuoteTravelCostSettings(quote.settings.travelCosts, quote.siteAddress);
  const summary = calculateQuoteTravelCosts({ ...quote, settings: { ...quote.settings, travelCosts: settings } });
  const hasDistance = summary.oneWayDistanceKm > 0;
  return (
    <aside className="fixed right-4 top-44 z-40 hidden max-h-[calc(100vh-12rem)] w-[340px] overflow-auto rounded-xl border border-slate-200 bg-white p-4 text-sm shadow-xl xl:block">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">Coûts cachés</div>
          <h2 className="mt-1 text-base font-semibold text-slate-950">Déplacement chantier</h2>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{formatCurrency(summary.totalCostHt)}</span>
      </div>

      <div className="mt-4 grid gap-2">
        <TextField label="Adresse siège" value={settings.companyAddress} onChange={(companyAddress) => onPatch({ companyAddress })} />
        <TextField label="Adresse chantier" value={settings.siteAddress || quote.siteAddress} onChange={(siteAddress) => onPatch({ siteAddress })} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <NumberField label="Distance aller km" value={settings.oneWayDistanceKm} onChange={(oneWayDistanceKm) => onPatch({ oneWayDistanceKm })} />
        <NumberField label="Temps aller min" value={settings.oneWayDurationMinutes} onChange={(oneWayDurationMinutes) => onPatch({ oneWayDurationMinutes })} />
        <NumberField label="Jours chantier" value={settings.worksiteDays ?? summary.worksiteDays} onChange={(worksiteDays) => onPatch({ worksiteDays })} />
        <NumberField label="Véhicules" value={settings.vehiclesCount} onChange={(vehiclesCount) => onPatch({ vehiclesCount })} />
        <NumberField label="Coût km" value={settings.costPerKm} step="0.01" onChange={(costPerKm) => onPatch({ costPerKm })} />
        <NumberField label="Taux véhicule h" value={settings.vehicleHourlyCost} step="0.01" onChange={(vehicleHourlyCost) => onPatch({ vehicleHourlyCost })} />
        <NumberField label="Usure km" value={settings.vehicleWearCostPerKm} step="0.01" onChange={(vehicleWearCostPerKm) => onPatch({ vehicleWearCostPerKm })} />
        <NumberField label="Péages A/R" value={settings.tollsPerRoundTripHt} step="0.01" onChange={(tollsPerRoundTripHt) => onPatch({ tollsPerRoundTripHt })} />
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <SummaryRow label="Aller-retour" value={`${formatNumber(summary.roundTripDistanceKm)} km`} />
        <SummaryRow label="Km totaux" value={`${formatNumber(summary.totalKm)} km`} />
        <SummaryRow label="Temps trajet" value={`${formatNumber(summary.travelHours)} h`} />
        <SummaryRow label="Carburant" value={formatCurrency(summary.fuelCostHt)} />
        <SummaryRow label="Temps trajet" value={formatCurrency(summary.travelTimeCostHt)} />
        <SummaryRow label="Usure véhicule" value={formatCurrency(summary.vehicleWearCostHt)} />
        <SummaryRow label="Péages" value={formatCurrency(summary.tollsCostHt)} />
      </div>

      <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Traitement devis</label>
      <select
        className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-300"
        value={settings.billingMode}
        onChange={(event) => onPatch({ billingMode: event.target.value as QuoteTravelCostSettings["billingMode"] })}
      >
        <option value="hidden">Ne pas facturer</option>
        <option value="absorb">Répercuter dans les prix</option>
        <option value="line">Créer une ligne déplacement</option>
      </select>

      <button
        type="button"
        className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-slate-300"
        disabled={!hasDistance || summary.totalCostHt <= 0}
        onClick={onInsertLine}
      >
        Ajouter la ligne déplacement
      </button>
      {!hasDistance ? <p className="mt-2 text-xs leading-5 text-slate-500">Renseigner au minimum la distance aller pour calculer le déplacement.</p> : null}
    </aside>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-300" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({ label, value, step = "1", onChange }: { label: string; value: number; step?: string; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      <input type="number" min={0} step={step} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm outline-none focus:border-blue-300" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-xs">
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}
