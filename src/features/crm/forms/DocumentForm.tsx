import { useState } from "react";
import type { CrmDataset } from "../../../services/crm.service";
import { CrmModal, Input, SelectEntity, Submit, TextArea } from "./CrmFormPrimitives";


export default function DocumentForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: any) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ type: "autre" });
  return (
    <CrmModal title="Ajouter document CRM" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
        <Input form={form} setForm={setForm} name="nom" label="Nom" required />
        <SelectEntity prospects={data.prospects} clients={data.clients} prospectId={form.prospect_id ?? ""} clientId={form.client_id ?? ""} setProspectId={(v) => setForm((p) => ({ ...p, prospect_id: v }))} setClientId={(v) => setForm((p) => ({ ...p, client_id: v }))} />
        <Input form={form} setForm={setForm} name="url" label="URL / lien document" />
        <TextArea form={form} setForm={setForm} name="notes" label="Notes" />
        <Submit saving={saving} label="Ajouter document" />
      </form>
    </CrmModal>
  );
}
