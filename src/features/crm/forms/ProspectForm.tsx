import { useState } from "react";
import type { CrmProspectRow } from "../../../services/crm.service";
import { CrmIdentityFields, CrmModal, Input, Submit, TextArea } from "./CrmFormPrimitives";


export default function ProspectForm({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmProspectRow>) => void }) {
  const [form, setForm] = useState<Record<string, string>>({ type: "particulier", statut: "nouveau", urgence: "normale" });
  return (
    <CrmModal title="Ajouter un prospect" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmProspectRow>); }} className="space-y-4">
        <CrmIdentityFields form={form} setForm={setForm} />
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="source_acquisition" label="Source acquisition" />
          <Input form={form} setForm={setForm} name="budget_estime" label="Budget estimé" type="number" />
          <Input form={form} setForm={setForm} name="type_projet" label="Type projet" />
        </div>
        <TextArea form={form} setForm={setForm} name="description_besoin" label="Description besoin" />
        <Submit saving={saving} label="Créer prospect" />
      </form>
    </CrmModal>
  );
}
