import { useState } from "react";
import type { CrmAppointmentRow, CrmDataset } from "../../../services/crm.service";
import { CrmModal, Input, SelectEntity, Submit, TextArea } from "./CrmFormPrimitives";


export default function AppointmentForm({ data, saving, onClose, onSubmit }: { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmAppointmentRow>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ type: "rdv_commercial", statut: "planifie" });
  return (
    <CrmModal title="Créer un rendez-vous" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmAppointmentRow>); }} className="space-y-4">
        <Input form={form} setForm={setForm} name="titre" label="Titre" required />
        <SelectEntity prospects={data.prospects} clients={data.clients} prospectId={form.prospect_id ?? ""} clientId={form.client_id ?? ""} setProspectId={(v) => setForm((p) => ({ ...p, prospect_id: v }))} setClientId={(v) => setForm((p) => ({ ...p, client_id: v }))} />
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="type" label="Type" />
          <Input form={form} setForm={setForm} name="starts_at" label="Début" type="datetime-local" required />
          <Input form={form} setForm={setForm} name="ends_at" label="Fin" type="datetime-local" />
        </div>
        <TextArea form={form} setForm={setForm} name="notes" label="Notes / compte rendu" />
        <Submit saving={saving} label="Créer RDV" />
      </form>
    </CrmModal>
  );
}
