import { useState } from "react";
import type { CrmDataset, CrmOpportunityRow } from "../../../services/crm.service";
import { CrmModal, Input, SelectEntity, Submit, TextArea } from "./CrmFormPrimitives";


export default function OpportunityForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmOpportunityRow>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ stage_key: "lead", montant_estime: "0", probabilite: "25" });
  return (
    <CrmModal title="Créer une opportunité" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmOpportunityRow>); }} className="space-y-4">
        <Input form={form} setForm={setForm} name="nom_affaire" label="Nom affaire" required />
        <SelectEntity prospects={data.prospects} clients={data.clients} prospectId={form.prospect_id ?? ""} clientId={form.client_id ?? ""} setProspectId={(v) => setForm((p) => ({ ...p, prospect_id: v }))} setClientId={(v) => setForm((p) => ({ ...p, client_id: v }))} />
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="montant_estime" label="Montant estimé" type="number" />
          <Input form={form} setForm={setForm} name="probabilite" label="Probabilité" type="number" />
          <Input form={form} setForm={setForm} name="echeance" label="Échéance" type="date" />
        </div>
        <TextArea form={form} setForm={setForm} name="notes" label="Notes" />
        <Submit saving={saving} label="Créer opportunité" />
      </form>
    </CrmModal>
  );
}
