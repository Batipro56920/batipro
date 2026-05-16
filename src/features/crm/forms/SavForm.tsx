import { useState } from "react";
import type { CrmDataset } from "../../../services/crm.service";
import { entityLabel } from "../components/crmFormat";
import { CrmModal, Input, Submit, TextArea } from "./CrmFormPrimitives";


export default function SavForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmDataset["sav"][number]>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ urgence: "normale", statut: "ouvert" });
  return (
    <CrmModal title="Créer ticket SAV" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmDataset["sav"][number]>); }} className="space-y-4">
        <Input form={form} setForm={setForm} name="titre" label="Titre" required />
        <label className="space-y-1 text-sm block">
          <div className="text-slate-600">Client</div>
          <select className="w-full rounded-xl border px-3 py-2" value={form.client_id ?? ""} onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))}>
            <option value="">Aucun</option>
            {data.clients.map((row) => <option key={row.id} value={row.id}>{entityLabel(row)}</option>)}
          </select>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <Input form={form} setForm={setForm} name="urgence" label="Urgence" />
          <Input form={form} setForm={setForm} name="planned_at" label="Planifié le" type="datetime-local" />
        </div>
        <TextArea form={form} setForm={setForm} name="description" label="Description" />
        <Submit saving={saving} label="Créer SAV" />
      </form>
    </CrmModal>
  );
}
