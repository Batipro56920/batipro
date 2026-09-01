import { useEffect, useMemo, useState } from "react";
import { PackagePlus, Search } from "lucide-react";
import {
  createStockReception,
  listProductStockLevels,
  type ProductStockLevel,
} from "../../../services/productStock.service";

export function ProductStockLevelsPanel() {
  const [levels, setLevels] = useState<ProductStockLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [receivingProductId, setReceivingProductId] = useState<string | null>(null);
  const [receiveQuantity, setReceiveQuantity] = useState("");
  const [receiveNote, setReceiveNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listProductStockLevels();
      setLevels(rows);
    } catch (err: any) {
      setError(err?.message ?? "Chargement du stock impossible.");
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return levels;
    return levels.filter((row) => row.designation.toLowerCase().includes(text) || (row.category ?? "").toLowerCase().includes(text));
  }, [levels, query]);

  function startReceiving(productId: string) {
    setReceivingProductId(productId);
    setReceiveQuantity("");
    setReceiveNote("");
  }

  async function confirmReceiving() {
    if (!receivingProductId || !receiveQuantity.trim() || saving) return;
    setSaving(true);
    try {
      await createStockReception({
        productId: receivingProductId,
        quantity: Number(receiveQuantity.replace(",", ".")),
        note: receiveNote || null,
      });
      setReceivingProductId(null);
      setReceiveQuantity("");
      setReceiveNote("");
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
        <div>
          <div className="text-sm font-semibold text-slate-900">Stock actuel</div>
          <div className="text-xs text-slate-500">
            Sorties déclarées par les ouvriers depuis le portail terrain + réceptions saisies ici.
          </div>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un produit..."
            className="rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
          />
        </div>
      </div>

      {error && <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="p-4 text-sm text-slate-500">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="p-4 text-sm text-slate-500">Aucun produit.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {filtered.map((row) => (
            <div key={row.productId} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-slate-900">{row.designation}</div>
                <div className="text-xs text-slate-500">{row.category ?? "Sans catégorie"}</div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <div className={["text-sm font-semibold", row.stockQuantity <= 0 ? "text-red-600" : "text-slate-900"].join(" ")}>
                    {row.stockQuantity} {row.unit}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startReceiving(row.productId)}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <PackagePlus className="h-4 w-4" />
                  Réceptionner
                </button>
              </div>

              {receivingProductId === row.productId ? (
                <div className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 sm:w-auto">
                  <input
                    autoFocus
                    value={receiveQuantity}
                    onChange={(e) => setReceiveQuantity(e.target.value)}
                    inputMode="decimal"
                    placeholder={`Quantité reçue (${row.unit})`}
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    value={receiveNote}
                    onChange={(e) => setReceiveNote(e.target.value)}
                    placeholder="Note (bon de commande, fournisseur...)"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={confirmReceiving}
                    disabled={saving || !receiveQuantity.trim()}
                    className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {saving ? "..." : "Confirmer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReceivingProductId(null)}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600"
                  >
                    Annuler
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
