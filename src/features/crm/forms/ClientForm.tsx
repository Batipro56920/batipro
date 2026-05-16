import { useState } from "react";
import type { CrmClientRow } from "../../../services/crm.service";
import { CrmIdentityFields, CrmModal, Submit, TextArea } from "./CrmFormPrimitives";


export default function ClientForm({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmClientRow>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ type: "particulier" });
  return (
    <CrmModal title="Ajouter un client" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmClientRow>); }} className="space-y-4">
        <CrmIdentityFields form={form} setForm={setForm} />
        <TextArea form={form} setForm={setForm} name="notes" label="Notes internes" />
        <Submit saving={saving} label="Créer client" />
      </form>
    </CrmModal>
  );
}
