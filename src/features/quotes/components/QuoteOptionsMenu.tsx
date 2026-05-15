import { useState } from "react";

const OPTIONS = [
  "Afficher calcul marges",
  "Afficher remises par ligne",
  "Afficher references",
  "Afficher stocks",
  "Numerotation personnalisee",
  "Afficher types",
  "Attestation TVA",
  "TVA par defaut",
  "Cacher details ouvrages",
  "Cacher colonnes quantite/unite",
  "Cacher colonne TVA",
  "Cacher totaux sections",
];

export function QuoteOptionsMenu() {
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  return (
    <div className="rounded-2xl border bg-white p-3 shadow-xl">
      {OPTIONS.map((option) => (
        <label key={option} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm hover:bg-slate-50">
          <span>{option}</span>
          <input type="checkbox" checked={Boolean(enabled[option])} onChange={(event) => setEnabled((prev) => ({ ...prev, [option]: event.target.checked }))} />
        </label>
      ))}
    </div>
  );
}
