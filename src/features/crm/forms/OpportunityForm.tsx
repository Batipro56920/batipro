import { useMemo, useState } from "react";
import type { CrmDataset, CrmOpportunityRow, CrmProspectRow } from "../../../services/crm.service";
import { CrmModal, Input, SelectEntity, Submit, TextArea } from "./CrmFormPrimitives";

type Props = { data: CrmDataset; saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmOpportunityRow>) => void; initialProspect?: CrmProspectRow | null };

function prospectName(prospect: CrmProspectRow) {
  return [prospect.prenom, prospect.nom].filter(Boolean).join(" ") || prospect.societe || "Prospect";
}

function initialForm(prospect?: CrmProspectRow | null): Record<string, string> {
  if (!prospect) return { stage_key: "lead", montant_estime: "0", probabilite: "25" };
  return {
    stage_key: "visite",
    prospect_id: prospect.id,
    nom_affaire: prospect.type_projet || `Projet ${prospectName(prospect)}`,
    montant_estime: prospect.budget_estime ? String(prospect.budget_estime) : "0",
    probabilite: "40",
    notes: [prospect.description_besoin, prospect.adresse, prospect.urgence].filter(Boolean).join("\n"),
  };
}

export default function OpportunityForm({ data, saving, onClose, onSubmit, initialProspect }: Props) {
  const seed = useMemo(() => initialForm(initialProspect), [initialProspect?.id]);
  const [form, setForm] = useState<Record<string, string>>(seed);
  return (
    <CrmModal title={initialProspect ? "Creer opportunite prospect" : "Creer une opportunite"} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(form as Partial<CrmOpportunityRow>); }} className="space-y-4">
        {initialProspect ? <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-slate-700"><div className="font-semibold text-slate-950">{prospectName(initialProspect)}</div><div>{initialProspect.type_projet || "Projet a qualifier"}</div></div> : null}
        <Input form={form} setForm={setForm} name="nom_affaire" label="Nom affaire" required />
        <SelectEntity prospects={data.prospects} clients={data.clients} prospectId={form.prospect_id ?? ""} clientId={form.client_id ?? ""} setProspectId={(v) => setForm((p) => ({ ...p, prospect_id: v }))} setClientId={(v) => setForm((p) => ({ ...p, client_id: v }))} />
        <div className="grid gap-4 md:grid-cols-3">
          <Input form={form} setForm={setForm} name="montant_estime" label="Montant estime" type="number" />
          <Input form={form} setForm={setForm} name="probabilite" label="Probabilite" type="number" />
          <Input form={form} setForm={setForm} name="echeance" label="Echeance" type="date" />
        </div>
        <TextArea form={form} setForm={setForm} name="notes" label="Notes" />
        <Submit saving={saving} label={initialProspect ? "Creer opportunite liee" : "Creer opportunite"} />
      </form>
    </CrmModal>
  );
}
