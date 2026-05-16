import { useMemo, useState } from "react";
import { Copy, Plus, Trash2, X } from "lucide-react";
import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import {
  addCompositeComponent,
  applyCompositeFixedPrice,
  applyCompositeMargin,
  calculateComponentMargin,
  calculateComponentMarginRate,
  calculateComponentSale,
  calculateCompositeSummary,
  duplicateCompositeComponent,
  removeCompositeComponent,
  updateCompositeComponent,
} from "../../application/quoteCompositeEngine";
import type { QuoteComponentKind } from "../../domain/QuoteEnums";
import type { QuoteCompositeComponent } from "../../domain/QuoteComposite";
import type { QuoteCompositeNode } from "../../domain/QuoteLine";

type Props = {
  node: QuoteCompositeNode;
  onClose: () => void;
  onSave: (node: QuoteCompositeNode) => void;
};

const tabs: Array<{ kind: QuoteComponentKind; label: string }> = [
  { kind: "fourniture", label: "Fourniture" },
  { kind: "main_oeuvre", label: "Main d'oeuvre" },
  { kind: "materiel", label: "Materiel" },
  { kind: "sous_traitance", label: "Sous-traitance" },
  { kind: "divers", label: "Divers" },
];

export function CompositeQuoteDialog({ node, onClose, onSave }: Props) {
  const [draft, setDraft] = useState(node);
  const [activeKind, setActiveKind] = useState<QuoteComponentKind>("fourniture");
  const summary = useMemo(() => calculateCompositeSummary(draft), [draft]);
  const rows = draft.components.filter((component) => component.kind === activeKind);

  function updateComponent(componentId: string, patch: Partial<QuoteCompositeComponent>) {
    setDraft((current) => updateCompositeComponent(current, componentId, patch));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <Card className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Ouvrage compose</div>
            <Input className="mt-1 border-transparent px-0 text-xl font-semibold" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}><X className="mr-2 h-4 w-4" />Annuler</Button>
            <Button onClick={() => onSave(draft)}>Enregistrer ouvrage</Button>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_18rem] overflow-hidden">
          <main className="min-w-0 overflow-auto p-5">
            <div className="mb-4 grid gap-3 md:grid-cols-4">
              <Field label="Quantite"><NumberInput value={draft.quantity} onChange={(quantity) => setDraft((current) => ({ ...current, quantity }))} /></Field>
              <Field label="Unite"><Input value={draft.unit} onChange={(event) => setDraft((current) => ({ ...current, unit: event.target.value }))} /></Field>
              <Field label="TVA"><NumberInput value={draft.vatRate} onChange={(vatRate) => setDraft((current) => ({ ...current, vatRate: vatRate as any }))} /></Field>
              <Field label="Mode prix">
                <select className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" value={draft.pricingMode} onChange={(event) => setDraft((current) => ({ ...current, pricingMode: event.target.value as QuoteCompositeNode["pricingMode"] }))}>
                  <option value="margin">Marge imposee</option>
                  <option value="fixed_price">Prix impose</option>
                </select>
              </Field>
            </div>

            <div className="mb-4 grid gap-3 md:grid-cols-2">
              <Field label="Taux marge cible">
                <NumberInput value={draft.targetMarginRate} onChange={(margin) => setDraft((current) => applyCompositeMargin(current, margin))} disabled={draft.pricingMode !== "margin"} />
              </Field>
              <Field label="Prix de vente HT impose">
                <NumberInput value={draft.fixedSellingPriceHt ?? summary.sellingPrice} onChange={(price) => setDraft((current) => applyCompositeFixedPrice(current, price))} disabled={draft.pricingMode !== "fixed_price"} />
              </Field>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <Button key={tab.kind} variant={activeKind === tab.kind ? "default" : "secondary"} onClick={() => setActiveKind(tab.kind)}>
                  {tab.label}
                </Button>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-100">
              <div className="grid grid-cols-[1fr_5rem_5rem_7rem_7rem_7rem_7rem_7rem] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                <div>Designation</div>
                <div>Qte</div>
                <div>Unite</div>
                <div>Cout achat</div>
                <div>Prix vente</div>
                <div>Marge</div>
                <div>Total</div>
                <div className="text-right">Actions</div>
              </div>
              {rows.map((component) => (
                <div key={component.id} className="grid grid-cols-[1fr_5rem_5rem_7rem_7rem_7rem_7rem_7rem] items-center gap-2 border-t px-3 py-2 text-sm">
                  <Input value={component.label} onChange={(event) => updateComponent(component.id, { label: event.target.value })} />
                  <NumberInput value={component.quantity} onChange={(quantity) => updateComponent(component.id, { quantity })} />
                  <Input value={component.unit} onChange={(event) => updateComponent(component.id, { unit: event.target.value })} />
                  <NumberInput value={component.purchaseUnitPriceHt} onChange={(purchaseUnitPriceHt) => updateComponent(component.id, { purchaseUnitPriceHt })} />
                  <NumberInput value={component.saleUnitPriceHt} onChange={(saleUnitPriceHt) => updateComponent(component.id, { saleUnitPriceHt })} />
                  <div>{money(calculateComponentMargin(component))}<span className="block text-xs text-slate-400">{calculateComponentMarginRate(component)}%</span></div>
                  <div className="font-medium">{money(calculateComponentSale(component))}</div>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" className="px-2" onClick={() => setDraft((current) => duplicateCompositeComponent(current, component.id))}><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" className="px-2 text-red-600" onClick={() => setDraft((current) => removeCompositeComponent(current, component.id))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
              {!rows.length ? <div className="border-t p-6 text-center text-sm text-slate-500">Aucun composant dans cet onglet.</div> : null}
            </div>

            <Button className="mt-4" variant="secondary" onClick={() => setDraft((current) => addCompositeComponent(current, activeKind))}>
              <Plus className="mr-2 h-4 w-4" />
              Ajouter {tabs.find((tab) => tab.kind === activeKind)?.label.toLowerCase()}
            </Button>
          </main>

          <aside className="border-l bg-slate-50 p-5">
            <h3 className="font-semibold text-slate-950">Synthese ouvrage</h3>
            <div className="mt-4 space-y-3 text-sm">
              <SummaryRow label="Debourse sec" value={money(summary.deboursSec)} />
              <SummaryRow label="Prix vente HT" value={money(summary.sellingPrice)} strong />
              <SummaryRow label="Marge brute" value={money(summary.marginAmount)} />
              <SummaryRow label="Taux marge" value={`${summary.marginRate}%`} />
              <SummaryRow label="TVA" value={money(summary.vat)} />
              <SummaryRow label="Total TTC" value={money(summary.totalTtc)} strong />
            </div>
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
              Les composants sont calcules au niveau ouvrage. Le devis utilise le prix de vente HT de l'ouvrage multiplie par la quantite.
            </div>
          </aside>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function NumberInput({ value, onChange, disabled = false }: { value: number; onChange: (value: number) => void; disabled?: boolean }) {
  return <Input type="number" disabled={disabled} value={Number.isFinite(value) ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />;
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={["flex justify-between gap-3", strong ? "font-semibold text-slate-950" : "text-slate-600"].join(" ")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function money(value: number) {
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}
