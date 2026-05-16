import { useState } from "react";
import type { CrmDataset, CrmQuoteEngineData } from "../../../services/crm.service";
import { eur } from "../components/crmFormat";
import { CrmModal, Input } from "../forms/CrmFormPrimitives";

export default function CrmQuoteDialog({
  engine,
  templates,
  loading,
  saving,
  onClose,
  onAddLine,
  onAddSection,
  onAddComponent,
  onAddPaymentTerm,
  onPdf,
  onTransform,
}: {
  engine: CrmQuoteEngineData;
  templates: CrmDataset["taskTemplates"];
  loading: boolean;
  saving: boolean;
  onClose: () => void;
  onAddLine: (payload: {
    quoteId: string;
    sectionId: string;
    lotTitle: string;
    templateId: string;
    quantity: string;
    marginRate: string;
    coefficient: string;
    tvaRate: string;
  }) => void;
  onAddSection: (payload: { quoteId: string; parentId?: string | null; title: string; sectionType: "section" | "subsection" }) => void;
  onAddComponent: (payload: {
    quoteId: string;
    itemId: string;
    componentType: "material" | "labor" | "subcontracting" | "equipment" | "fee" | "text";
    designation: string;
    quantity: string;
    unit: string;
    purchaseUnitPrice: string;
    saleUnitPrice: string;
    tvaRate: string;
  }) => void;
  onAddPaymentTerm: (payload: { quoteId: string; label: string; percent: string; dueTrigger: string }) => void;
  onPdf: () => void;
  onTransform: () => void;
}) {
  const firstTemplate = templates[0];
  const [form, setForm] = useState<Record<string, string>>({
    lotTitle: firstTemplate?.lot ?? "Lot principal",
    sectionId: "",
    templateId: firstTemplate?.id ?? "",
    quantity: String(firstTemplate?.quantite_defaut ?? 1),
    marginRate: "25",
    coefficient: "1",
    tvaRate: "20",
  });
  const [sectionForm, setSectionForm] = useState<Record<string, string>>({ title: "", parentId: "", sectionType: "section" });
  const [componentForm, setComponentForm] = useState<Record<string, string>>({
    itemId: "",
    componentType: "material",
    designation: "",
    quantity: "1",
    unit: "u",
    purchaseUnitPrice: "0",
    saleUnitPrice: "0",
    tvaRate: "20",
  });
  const [paymentForm, setPaymentForm] = useState<Record<string, string>>({ label: "Acompte signature", percent: "30", dueTrigger: "signature" });
  const selectedTemplate = templates.find((row) => row.id === form.templateId) ?? null;
  const debourse = engine.items.reduce(
    (sum, row) =>
      sum +
      (Number(row.cost_materials_ht ?? 0) + Number(row.cost_labor_ht ?? 0) + Number(row.cost_subcontracting_ht ?? 0) + Number(row.cost_fees_ht ?? 0)) *
        Number(row.quantite ?? 1),
    0,
  );
  const margin = Number(engine.quote.montant_ht ?? 0) - debourse;

  return (
    <CrmModal title={`Chiffrage BTP - ${engine.quote.quote_number}`} onClose={onClose}>
      <div className="space-y-5">
        {loading ? <div className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-500">Chargement...</div> : null}
        <div className="grid gap-3 md:grid-cols-4">
          {[
            ["HT", eur(engine.quote.montant_ht)],
            ["TTC", eur(engine.quote.montant_ttc)],
            ["Debourse sec", eur(debourse)],
            ["Marge", eur(margin)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
              <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
            </div>
          ))}
        </div>

        <section className="rounded-2xl border bg-white p-4">
          <div className="font-semibold">Sections et sous-sections</div>
          <form
            className="mt-3 grid gap-3 md:grid-cols-[1fr_1fr_150px_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              onAddSection({
                quoteId: engine.quote.id,
                parentId: sectionForm.parentId || null,
                title: sectionForm.title,
                sectionType: sectionForm.sectionType === "subsection" ? "subsection" : "section",
              });
              setSectionForm({ title: "", parentId: "", sectionType: "section" });
            }}
          >
            <Input form={sectionForm} setForm={setSectionForm} name="title" label="Titre" required />
            <label className="block space-y-1 text-sm">
              <div className="text-slate-600">Parent</div>
              <select className="w-full rounded-xl border px-3 py-2" value={sectionForm.parentId} onChange={(event) => setSectionForm((prev) => ({ ...prev, parentId: event.target.value, sectionType: event.target.value ? "subsection" : "section" }))}>
                <option value="">Aucun</option>
                {engine.sections.filter((row) => !row.parent_id).map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
              </select>
            </label>
            <Input form={sectionForm} setForm={setSectionForm} name="sectionType" label="Type" />
            <div className="flex items-end">
              <button disabled={saving || !sectionForm.title} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60">Ajouter</button>
            </div>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {engine.sections.map((row) => (
              <span key={row.id} className="rounded-full border bg-slate-50 px-3 py-1">{row.parent_id ? "Sous-section" : "Section"} · {row.title}</span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4">
          <div className="font-semibold">Ajouter un ouvrage depuis la bibliotheque</div>
          <form
            className="mt-3 grid gap-3 md:grid-cols-[1fr_1.4fr_100px_100px_90px]"
            onSubmit={(event) => {
              event.preventDefault();
              onAddLine({
                quoteId: engine.quote.id,
                sectionId: form.sectionId,
                lotTitle: form.lotTitle,
                templateId: form.templateId,
                quantity: form.quantity,
                marginRate: form.marginRate,
                coefficient: form.coefficient,
                tvaRate: form.tvaRate,
              });
            }}
          >
            <Input form={form} setForm={setForm} name="lotTitle" label="Lot" />
            <label className="block space-y-1 text-sm">
              <div className="text-slate-600">Section</div>
              <select className="w-full rounded-xl border px-3 py-2" value={form.sectionId} onChange={(event) => setForm((prev) => ({ ...prev, sectionId: event.target.value }))}>
                <option value="">Aucune</option>
                {engine.sections.map((row) => <option key={row.id} value={row.id}>{row.parent_id ? "— " : ""}{row.title}</option>)}
              </select>
            </label>
            <label className="block space-y-1 text-sm">
              <div className="text-slate-600">Ouvrage bibliotheque</div>
              <select
                className="w-full rounded-xl border px-3 py-2"
                value={form.templateId}
                onChange={(event) => {
                  const template = templates.find((row) => row.id === event.target.value);
                  setForm((prev) => ({
                    ...prev,
                    templateId: event.target.value,
                    lotTitle: template?.lot ?? prev.lotTitle,
                    quantity: String(template?.quantite_defaut ?? prev.quantity ?? 1),
                  }));
                }}
                required
              >
                <option value="">Selectionner</option>
                {templates.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.lot ? `${row.lot} - ` : ""}{row.titre}
                  </option>
                ))}
              </select>
            </label>
            <Input form={form} setForm={setForm} name="quantity" label="Quantite" type="number" />
            <Input form={form} setForm={setForm} name="marginRate" label="Marge %" type="number" />
            <Input form={form} setForm={setForm} name="tvaRate" label="TVA" type="number" />
            <div className="md:col-span-5 flex items-end justify-between gap-3">
              <div className="text-xs text-slate-500">
                {selectedTemplate
                  ? `Base: ${selectedTemplate.unite ?? "u"} / ${eur(selectedTemplate.cout_reference_unitaire_ht ?? 0)} / ${selectedTemplate.temps_prevu_par_unite_h ?? 0}h`
                  : "La bibliotheque existante sert de catalogue d'ouvrages."}
              </div>
              <button disabled={saving || !form.templateId} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60">
                Ajouter ligne
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border bg-white p-4">
          <div className="font-semibold">Composants d'ouvrage et conditions de paiement</div>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                onAddComponent({
                  quoteId: engine.quote.id,
                  itemId: componentForm.itemId,
                  componentType: componentForm.componentType as any,
                  designation: componentForm.designation,
                  quantity: componentForm.quantity,
                  unit: componentForm.unit,
                  purchaseUnitPrice: componentForm.purchaseUnitPrice,
                  saleUnitPrice: componentForm.saleUnitPrice,
                  tvaRate: componentForm.tvaRate,
                });
                setComponentForm((prev) => ({ ...prev, designation: "", purchaseUnitPrice: "0", saleUnitPrice: "0" }));
              }}
            >
              <label className="block space-y-1 text-sm">
                <div className="text-slate-600">Ouvrage</div>
                <select className="w-full rounded-xl border px-3 py-2" value={componentForm.itemId} onChange={(event) => setComponentForm((prev) => ({ ...prev, itemId: event.target.value }))} required>
                  <option value="">Selectionner</option>
                  {engine.items.map((row) => <option key={row.id} value={row.id}>{row.designation}</option>)}
                </select>
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <Input form={componentForm} setForm={setComponentForm} name="componentType" label="Type" />
                <Input form={componentForm} setForm={setComponentForm} name="designation" label="Designation composant" required />
                <Input form={componentForm} setForm={setComponentForm} name="quantity" label="Quantite" type="number" />
                <Input form={componentForm} setForm={setComponentForm} name="unit" label="Unite" />
                <Input form={componentForm} setForm={setComponentForm} name="purchaseUnitPrice" label="Prix achat HT" type="number" />
                <Input form={componentForm} setForm={setComponentForm} name="saleUnitPrice" label="Prix vente HT" type="number" />
              </div>
              <button disabled={saving || !componentForm.itemId || !componentForm.designation} className="justify-self-end rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">Ajouter composant</button>
            </form>
            <form
              className="grid content-start gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                onAddPaymentTerm({
                  quoteId: engine.quote.id,
                  label: paymentForm.label,
                  percent: paymentForm.percent,
                  dueTrigger: paymentForm.dueTrigger,
                });
              }}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <Input form={paymentForm} setForm={setPaymentForm} name="label" label="Echeance" />
                <Input form={paymentForm} setForm={setPaymentForm} name="percent" label="Pourcentage" type="number" />
                <Input form={paymentForm} setForm={setPaymentForm} name="dueTrigger" label="Declencheur" />
              </div>
              <button disabled={saving} className="justify-self-end rounded-xl border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-60">Ajouter condition</button>
              <div className="space-y-2 text-xs text-slate-600">
                {engine.paymentTerms.map((row) => (
                  <div key={row.id} className="rounded-xl border bg-slate-50 p-2">{row.label} · {row.percent ?? 0}% · {eur(row.amount_ttc ?? 0)} TTC</div>
                ))}
              </div>
            </form>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>{["Lot / ouvrage", "Qte", "Debourse", "Marge", "TVA", "Total HT"].map((h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {engine.items.map((row) => {
                const lot = engine.lots.find((item) => item.id === row.lot_id)?.title ?? row.lot ?? "Sans lot";
                const cost =
                  (Number(row.cost_materials_ht ?? 0) + Number(row.cost_labor_ht ?? 0) + Number(row.cost_subcontracting_ht ?? 0) + Number(row.cost_fees_ht ?? 0)) *
                  Number(row.quantite ?? 1);
                return (
                  <tr key={row.id} className="border-t align-top">
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{lot}</div>
                      <div className="font-medium">{row.designation}</div>
                      {row.technical_description ? <div className="mt-1 text-xs text-slate-500">{row.technical_description}</div> : null}
                    </td>
                    <td className="px-4 py-3">{row.quantite} {row.unite ?? ""}</td>
                    <td className="px-4 py-3">{eur(cost)}</td>
                    <td className="px-4 py-3">{row.margin_rate}%</td>
                    <td className="px-4 py-3">{row.tva_rate}%</td>
                    <td className="px-4 py-3 font-semibold">{eur(row.sale_total_ht ?? row.total_ht)}</td>
                  </tr>
                );
              })}
              {!engine.items.length ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">
                    Aucune ligne. Ajoutez des ouvrages depuis la bibliotheque pour obtenir un devis exploitable.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onPdf} className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50">Generer PDF</button>
          <button type="button" onClick={onTransform} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white">Transformer en chantier</button>
        </div>
      </div>
    </CrmModal>
  );
}
