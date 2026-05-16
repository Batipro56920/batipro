import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { CrmClientRow, CrmProspectRow } from "../../../services/crm.service";
import { entityLabel } from "../components/crmFormat";

export function CrmModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4" onClick={onClose}>
      <div className="mx-auto my-8 max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-950/10" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-slate-50">
            Fermer
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function SelectEntity({
  prospects,
  clients,
  prospectId,
  clientId,
  setProspectId,
  setClientId,
}: {
  prospects: CrmProspectRow[];
  clients: CrmClientRow[];
  prospectId: string;
  clientId: string;
  setProspectId: (value: string) => void;
  setClientId: (value: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1 text-sm">
        <div className="text-slate-600">Prospect</div>
        <select className="w-full rounded-xl border px-3 py-2" value={prospectId} onChange={(e) => setProspectId(e.target.value)}>
          <option value="">Aucun</option>
          {prospects.map((row) => (
            <option key={row.id} value={row.id}>{entityLabel(row)}</option>
          ))}
        </select>
      </label>
      <label className="space-y-1 text-sm">
        <div className="text-slate-600">Client</div>
        <select className="w-full rounded-xl border px-3 py-2" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Aucun</option>
          {clients.map((row) => (
            <option key={row.id} value={row.id}>{entityLabel(row)}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function CrmIdentityFields({ form, setForm }: { form: Record<string, string>; setForm: Dispatch<SetStateAction<Record<string, string>>> }) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <Input form={form} setForm={setForm} name="type" label="Type" />
        <Input form={form} setForm={setForm} name="civilite" label="Civilité" />
        <Input form={form} setForm={setForm} name="societe" label="Société" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Input form={form} setForm={setForm} name="prenom" label="Prénom" />
        <Input form={form} setForm={setForm} name="nom" label="Nom" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Input form={form} setForm={setForm} name="email" label="Email" type="email" />
        <Input form={form} setForm={setForm} name="telephone" label="Téléphone" />
        <Input form={form} setForm={setForm} name="mobile" label="Mobile" />
      </div>
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_140px_minmax(0,1fr)]">
        <Input form={form} setForm={setForm} name="adresse" label="Adresse" />
        <Input form={form} setForm={setForm} name="code_postal" label="Code postal" />
        <Input form={form} setForm={setForm} name="ville" label="Ville" />
      </div>
      <Input form={form} setForm={setForm} name="tags" label="Tags (séparés par virgules)" />
    </>
  );
}

export function Input({ form, setForm, name, label, type = "text", required = false }: { form: Record<string, string>; setForm: Dispatch<SetStateAction<Record<string, string>>>; name: string; label: string; type?: string; required?: boolean }) {
  return (
    <label className="block space-y-1 text-sm">
      <div className="text-slate-600">{label}</div>
      <input
        className="w-full rounded-xl border px-3 py-2"
        value={form[name] ?? ""}
        onChange={(event) => setForm((prev) => ({ ...prev, [name]: event.target.value }))}
        type={type}
        required={required}
      />
    </label>
  );
}

export function TextArea({ form, setForm, name, label }: { form: Record<string, string>; setForm: Dispatch<SetStateAction<Record<string, string>>>; name: string; label: string }) {
  return (
    <label className="block space-y-1 text-sm">
      <div className="text-slate-600">{label}</div>
      <textarea
        className="min-h-28 w-full rounded-xl border px-3 py-2"
        value={form[name] ?? ""}
        onChange={(event) => setForm((prev) => ({ ...prev, [name]: event.target.value }))}
      />
    </label>
  );
}

export function Submit({ saving, label }: { saving: boolean; label: string }) {
  return (
    <div className="flex justify-end">
      <button disabled={saving} className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60">
        {saving ? "Enregistrement..." : label}
      </button>
    </div>
  );
}
