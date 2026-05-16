import type { CrmSection } from "../types";
import { CrmNavigation } from "./CrmNavigation";

export function CrmHeader({
  section,
  onRefresh,
  onCreateProspect,
  onCreateQuote,
}: {
  section: CrmSection;
  onRefresh: () => void;
  onCreateProspect: () => void;
  onCreateQuote: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">CRM Admin</div>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">Cockpit commercial Batipro</h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-500">
            Prospects, pipeline, devis, relances, rendez-vous, transformation chantier et SAV dans un mÃªme module.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRefresh} className="rounded-xl border bg-white px-3 py-2 text-sm hover:bg-slate-50">
            RafraÃ®chir
          </button>
          <button type="button" onClick={onCreateProspect} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800">
            + Prospect
          </button>
          <button type="button" onClick={onCreateQuote} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 hover:bg-blue-100">
            + Devis
          </button>
        </div>
      </div>

      <CrmNavigation section={section} />
    </div>
  );
}

