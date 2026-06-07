import { useState, type FormEvent } from "react";
import type { CrmAppointmentRow, CrmDataset, CrmProspectRow } from "../../../services/crm.service";
import { entityLabel } from "../components/crmFormat";
import { CrmModal, Input, Submit, TextArea } from "./CrmFormPrimitives";

export default function AppointmentForm({
  data,
  saving,
  initialProspect,
  onClose,
  onSubmit,
}: {
  data: CrmDataset;
  saving: boolean;
  initialProspect?: CrmProspectRow | null;
  onClose: () => void;
  onSubmit: (payload: Partial<CrmAppointmentRow>) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => ({
    type: "rdv_commercial",
    statut: "planifie",
    prospect_id: initialProspect?.id ?? "",
    titre: initialProspect ? `RDV commercial - ${entityLabel(initialProspect)}` : "",
  }));

  function submitAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      type: form.type || "rdv_commercial",
      statut: form.statut || "planifie",
      prospect_id: form.prospect_id || null,
      titre: form.titre,
      starts_at: form.starts_at,
      notes: form.notes || null,
    });
  }

  return (
    <CrmModal title="Créer un rendez-vous" onClose={onClose}>
      <form onSubmit={submitAppointment} className="space-y-4">
        <Input form={form} setForm={setForm} name="titre" label="Titre" required />
        <label className="block space-y-1 text-sm">
          <div className="text-slate-600">Prospect</div>
          <select className="w-full rounded-xl border px-3 py-2" value={form.prospect_id ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, prospect_id: e.target.value }))}>
            <option value="">Aucun</option>
            {data.prospects.map((row) => (
              <option key={row.id} value={row.id}>{entityLabel(row)}</option>
            ))}
          </select>
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <Input form={form} setForm={setForm} name="type" label="Type" />
          <Input form={form} setForm={setForm} name="starts_at" label="Début" type="datetime-local" required />
        </div>
        <TextArea form={form} setForm={setForm} name="notes" label="Notes / compte rendu" />
        <Submit saving={saving} label="Créer RDV" />
      </form>
    </CrmModal>
  );
}
