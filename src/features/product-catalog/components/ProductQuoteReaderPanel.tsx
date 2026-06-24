import { useMemo, useState } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import type { ProductQuoteImportResult } from "../services/productQuoteImport.service";

export default function ProductQuoteReaderPanel({
  busy,
  result,
  onImport,
}: {
  busy: boolean;
  result: ProductQuoteImportResult | null;
  onImport: (text: string) => Promise<void> | void;
}) {
  const [text, setText] = useState("");
  const canImport = useMemo(() => text.trim().length >= 20 && !busy, [busy, text]);

  async function submit() {
    if (!canImport) return;
    await onImport(text);
  }

  return (
    <section className="rounded-3xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
            <UploadCloud className="h-3.5 w-3.5" /> Lecteur de devis
          </div>
          <h2 className="mt-3 text-base font-semibold text-slate-950">Créer automatiquement des produits depuis un devis fournisseur</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Collez le texte du devis ou d'une grille tarifaire. Le lecteur extrait les produits, rattache le fournisseur détecté, crée le fournisseur s'il manque, puis remplit prix, unité, TVA, marque, catégorie et référence quand l'information est présente.
          </p>
        </div>
        <button
          type="button"
          disabled={!canImport}
          onClick={() => void submit()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {busy ? "Lecture en cours..." : "Créer les produits"}
        </button>
      </div>

      <textarea
        className="mt-4 min-h-44 w-full rounded-2xl border border-blue-100 bg-white p-3 text-sm text-slate-900 outline-none focus:border-blue-300"
        placeholder="Collez ici le texte du devis fournisseur : désignation, référence, marque, unité, prix HT, TVA, fournisseur..."
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      {result ? (
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-4">
          <ImportMetric label="Lignes détectées" value={result.extracted} />
          <ImportMetric label="Produits créés" value={result.createdProducts} />
          <ImportMetric label="Fournisseurs créés" value={result.createdSuppliers} />
          <ImportMetric label="Doublons ignorés" value={result.skippedProducts} />
          {result.products.length ? (
            <div className="md:col-span-4 rounded-2xl border border-emerald-100 bg-white p-3 text-emerald-700">
              <div className="flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" /> Import terminé</div>
              <div className="mt-1 text-xs text-emerald-700/80">
                Derniers produits : {result.products.slice(0, 5).map((product) => product.designation).join(", ")}
                {result.products.length > 5 ? "..." : ""}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ImportMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-bold text-slate-950">{value}</div>
    </div>
  );
}
