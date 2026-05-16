import { useState } from "react";
import type { CrmDataset, CrmQuoteRow } from "../../../services/crm.service";
import { CrmModal, Input, SelectEntity, Submit, TextArea } from "./CrmFormPrimitives";


export default function QuoteForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmQuoteRow>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ statut: "brouillon", montant_ht: "0", tva: "20" });
  return (
    <CrmModal title="Créer un devis CRM" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmQuoteRow>); }} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Input form={form} setForm={setForm} name="quote_number" label="Numéro devis" />
          <Input form={form} setForm={setForm} name="valid_until" label="Validité" type="date" />
        </div>
        <SelectEntity prospects={data.prospects} clients={data.clients} prospectId={form.prospect_id ?? ""} clientId={form.client_id ?? ""} setProspectId={(v) => setForm((p) => ({ ...p, prospect_id: v }))} setClientId={(v) => setForm((p) => ({ ...p, client_id: v }))} />
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="montant_ht" label="Montant HT" type="number" />
          <Input form={form} setForm={setForm} name="tva" label="TVA %" type="number" />
          <Input form={form} setForm={setForm} name="marge_estimee" label="Marge estimée" type="number" />
        </div>
        <Input form={form} setForm={setForm} name="lot" label="Lot" />
        <TextArea form={form} setForm={setForm} name="description" label="Description" />
        <Submit saving={saving} label="Créer devis" />
      </form>
    </CrmModal>
  );
}
