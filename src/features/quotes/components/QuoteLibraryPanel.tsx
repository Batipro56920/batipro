import { Plus } from "lucide-react";
import { useQuoteStore } from "../store/quoteStore";
import type { QuoteLine } from "../types";

const sampleItems = ["Pose BA13", "Peinture murs", "Pose carrelage", "Main d'oeuvre renovation"];

export function QuoteLibraryPanel() {
  const addLine = useQuoteStore((state) => state.addLine);

  function insertLibraryLine(label: string) {
    const line: QuoteLine = {
      id: crypto.randomUUID(),
      parentId: null,
      kind: "composite",
      designation: label,
      quantity: 1,
      unit: "u",
      unitPriceHt: 0,
      vatRate: 20,
      purchaseCostHt: 0,
      order: Date.now(),
    };
    addLine(line);
  }

  return (
    <aside className="h-full border-r bg-white p-4">
      <h2 className="font-semibold text-slate-950">Bibliotheque</h2>
      <input className="mt-3 w-full rounded-xl border px-3 py-2 text-sm" placeholder="Rechercher ouvrage, fourniture..." />
      <div className="mt-4 space-y-2">
        {sampleItems.map((item) => (
          <button key={item} className="flex w-full items-center justify-between rounded-xl border bg-slate-50 p-3 text-left text-sm hover:bg-blue-50" onClick={() => insertLibraryLine(item)}>
            <span>{item}</span>
            <Plus className="h-4 w-4" />
          </button>
        ))}
      </div>
    </aside>
  );
}
