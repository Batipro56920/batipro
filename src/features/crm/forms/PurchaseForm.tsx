import { useState } from "react";
import type { CrmDataset } from "../../../services/crm.service";
import { CrmModal, Input, Submit, TextArea } from "./CrmFormPrimitives";


export default function PurchaseForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: any) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ category: "materials", status: "planned", tva_rate: "20" });
  return (
    <CrmModal title="Créer un achat fournisseur" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm block">
            <div className="text-slate-600">Chantier</div>
            <select className="w-full rounded-xl border px-3 py-2" value={form.chantier_id ?? ""} onChange={(e) => setForm((p) => ({ ...p, chantier_id: e.target.value }))}>
              <option value="">Aucun</option>
              {data.chantiers.map((row) => <option key={row.id} value={row.id}>{row.nom}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm block">
            <div className="text-slate-600">Devis CRM</div>
            <select className="w-full rounded-xl border px-3 py-2" value={form.quote_id ?? ""} onChange={(e) => setForm((p) => ({ ...p, quote_id: e.target.value }))}>
              <option value="">Aucun</option>
              {data.quotes.map((row) => <option key={row.id} value={row.id}>{row.quote_number}</option>)}
            </select>
          </label>
        </div>
        <Input form={form} setForm={setForm} name="label" label="Libellé achat" required />
        <div className="grid gap-4 md:grid-cols-4">
          <Input form={form} setForm={setForm} name="category" label="Catégorie" />
          <Input form={form} setForm={setForm} name="amount_ht" label="Montant HT" type="number" />
          <Input form={form} setForm={setForm} name="tva_rate" label="TVA %" type="number" />
          <Input form={form} setForm={setForm} name="status" label="Statut" />
        </div>
        <TextArea form={form} setForm={setForm} name="notes" label="Notes" />
        <Submit saving={saving} label="Créer achat" />
      </form>
    </CrmModal>
  );
}
