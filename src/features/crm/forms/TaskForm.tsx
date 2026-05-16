import { useState } from "react";
import type { CrmDataset, CrmTaskRow } from "../../../services/crm.service";
import { CrmModal, Input, SelectEntity, Submit, TextArea } from "./CrmFormPrimitives";


export default function TaskForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmTaskRow>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ type: "relance", priorite: "normale", statut: "a_faire" });
  return (
    <CrmModal title="Créer une tâche commerciale" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmTaskRow>); }} className="space-y-4">
        <Input form={form} setForm={setForm} name="titre" label="Titre" required />
        <SelectEntity prospects={data.prospects} clients={data.clients} prospectId={form.prospect_id ?? ""} clientId={form.client_id ?? ""} setProspectId={(v) => setForm((p) => ({ ...p, prospect_id: v }))} setClientId={(v) => setForm((p) => ({ ...p, client_id: v }))} />
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="type" label="Type" />
          <Input form={form} setForm={setForm} name="due_at" label="Échéance" type="datetime-local" />
          <Input form={form} setForm={setForm} name="priorite" label="Priorité" />
        </div>
        <TextArea form={form} setForm={setForm} name="description" label="Description" />
        <Submit saving={saving} label="Créer tâche" />
      </form>
    </CrmModal>
  );
}
