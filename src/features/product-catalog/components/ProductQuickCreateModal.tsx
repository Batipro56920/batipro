import { useState } from "react";
import type { DocumentUnit } from "../../document-engine";
import type { SupplierRow } from "../../../services/suppliers.service";

const DOCUMENT_UNITS: DocumentUnit[] = ["u", "h", "ml", "m2", "m3", "forfait", "kg", "l"];

export function toDocumentUnit(unit: string): DocumentUnit {
  const normalized = unit.trim().toLowerCase() as DocumentUnit;
  return DOCUMENT_UNITS.includes(normalized) ? normalized : "u";
}

function toNumberOrNull(value: string) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

export type ProductQuickCreateInitial = { materialName: string; unit: string };

export function ProductQuickCreateModal({
  initial,
  suppliers,
  saving,
  onCancel,
  onSubmit,
}: {
  initial: ProductQuickCreateInitial;
  suppliers: SupplierRow[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (values: { designation: string; unit: DocumentUnit; supplierId: string; priceHt: number }) => void;
}) {
  const [designation, setDesignation] = useState(initial.materialName);
  const [unit, setUnit] = useState<DocumentUnit>(toDocumentUnit(initial.unit));
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [priceHt, setPriceHt] = useState("");

  const priceValue = toNumberOrNull(priceHt);
  const canSubmit = designation.trim().length > 0 && Boolean(supplierId) && priceValue !== null && priceValue >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="text-sm font-semibold uppercase tracking-[0.12em] text-blue-600">Nouveau produit catalogue</div>
        <p className="mt-1 text-xs text-slate-500">
          Demande le prix au fournisseur puis enregistre-le ici : ce materiau sera desormais reconnu automatiquement.
        </p>

        <div className="mt-4 space-y-3">
          <label className="block space-y-1 text-sm">
            <div className="text-xs text-slate-600">Designation</div>
            <input
              value={designation}
              onChange={(event) => setDesignation(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1 text-sm">
              <div className="text-xs text-slate-600">Unite</div>
              <select
                value={unit}
                onChange={(event) => setUnit(event.target.value as DocumentUnit)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              >
                {DOCUMENT_UNITS.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <div className="text-xs text-slate-600">Prix d'achat HT</div>
              <input
                value={priceHt}
                onChange={(event) => setPriceHt(event.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            <div className="text-xs text-slate-600">Fournisseur</div>
            <select
              value={supplierId}
              onChange={(event) => setSupplierId(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            >
              <option value="">Selectionner</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Annuler
          </button>
          <button
            type="button"
            disabled={!canSubmit || saving}
            onClick={() => canSubmit && onSubmit({ designation: designation.trim(), unit, supplierId, priceHt: priceValue ?? 0 })}
            className={[
              "rounded-xl px-4 py-2 text-sm font-semibold",
              !canSubmit || saving ? "bg-slate-200 text-slate-500" : "bg-blue-600 text-white hover:bg-blue-700",
            ].join(" ")}
          >
            {saving ? "Enregistrement..." : "Creer le produit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export async function buildProductDraftFromQuickCreate(
  values: { designation: string; unit: DocumentUnit; supplierId: string; priceHt: number },
  suppliers: SupplierRow[],
) {
  const supplier = suppliers.find((row) => row.id === values.supplierId) ?? null;
  return {
    designation: values.designation,
    internalReference: null,
    manufacturerReference: null,
    brand: null,
    category: null,
    unit: values.unit,
    vatRate: 20,
    mainSupplierId: supplier?.id ?? null,
    mainSupplierName: supplier?.name ?? null,
    standardPurchasePriceHt: values.priceHt,
    recommendedSalePriceHt: values.priceHt,
    targetMarginRate: 30,
    isSellable: true,
    supplierPrices: supplier
      ? [
          {
            id: crypto.randomUUID(),
            supplierId: supplier.id,
            supplierName: supplier.name,
            priceHt: values.priceHt,
            discountPercent: null,
            startDate: null,
            endDate: null,
            packaging: null,
            minimumQuantity: null,
            deliveryLeadTimeDays: null,
          },
        ]
      : [],
    documents: [],
    notes: null,
  };
}
