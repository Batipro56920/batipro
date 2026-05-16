import { useState } from "react";
import type { CrmDataset } from "../../../services/crm.service";
import { entityLabel } from "../components/crmFormat";
import { CrmModal, Input, Submit } from "./CrmFormPrimitives";


export default function InvoiceForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: any) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ type: "acompte", statut: "brouillon" });
  return (
    <CrmModal title="Créer facture base" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
        <label className="space-y-1 text-sm block">
          <div className="text-slate-600">Client</div>
          <select className="w-full rounded-xl border px-3 py-2" value={form.client_id ?? ""} onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}>
            <option value="">Aucun</option>
            {data.clients.map((row) => <option key={row.id} value={row.id}>{entityLabel(row)}</option>)}
          </select>
        </label>
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="type" label="Type" />
          <Input form={form} setForm={setForm} name="amount_ht" label="Montant HT" type="number" />
          <Input form={form} setForm={setForm} name="due_date" label="Échéance" type="date" />
        </div>
        <Submit saving={saving} label="Créer facture" />
      </form>
    </CrmModal>
  );
}
