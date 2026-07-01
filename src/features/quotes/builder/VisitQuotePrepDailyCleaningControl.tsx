import { useEffect, useState } from "react";
import { readVisitQuoteOptions, writeVisitQuoteOptions } from "./quoteBuilderVisitOptions";

export function VisitQuotePrepDailyCleaningControl({ projectId }: { projectId: string }) {
  const [checked, setChecked] = useState(() => readVisitQuoteOptions(projectId).dailyCleaningFlatRateEnabled);

  useEffect(() => {
    setChecked(readVisitQuoteOptions(projectId).dailyCleaningFlatRateEnabled);
  }, [projectId]);

  function toggle(enabled: boolean) {
    setChecked(enabled);
    writeVisitQuoteOptions(projectId, { dailyCleaningFlatRateEnabled: enabled });
  }

  return (
    <aside className="fixed bottom-4 right-4 z-40 w-[320px] rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl">
      <label className="flex items-start gap-3 text-slate-700">
        <input type="checkbox" className="mt-1" checked={checked} onChange={(event) => toggle(event.target.checked)} />
        <span>
          <span className="block font-semibold text-slate-950">Forfait nettoyage journalier</span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            Si coche, le devis creera automatiquement la ligne nettoyage et la recalculera avec la duree chantier estimee.
          </span>
        </span>
      </label>
    </aside>
  );
}
