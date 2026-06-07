import { useMemo, useState } from "react";
import type { CrmProspectRow } from "../../../services/crm.service";
import { CrmModal } from "./CrmFormPrimitives";

type ProspectFormState = Record<string, string>;

const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const textareaClass = "min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

const projectTypes = [
  "Renovation globale",
  "Extension",
  "Cuisine",
  "Salle de bain",
  "Isolation",
  "Toiture",
  "Amenagement combles",
  "Electricite",
  "Plomberie",
  "Peinture",
  "Autre",
];

const sources = ["Appel entrant", "Site internet", "Recommandation", "Agent immobilier", "Apporteur", "Reseau", "Le Bon Coin", "Publicite", "Autre"];

function patch(setForm: React.Dispatch<React.SetStateAction<ProspectFormState>>, name: string, value: string) {
  setForm((current) => ({ ...current, [name]: value }));
}

function Field({ label, children, required = false }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block space-y-1 text-sm">
      <div className="font-medium text-slate-700">
        {label}{required ? <span className="text-red-500"> *</span> : null}
      </div>
      {children}
    </label>
  );
}

function Input({ form, setForm, name, label, required = false, inputMode }: { form: ProspectFormState; setForm: React.Dispatch<React.SetStateAction<ProspectFormState>>; name: string; label: string; required?: boolean; inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"] }) {
  return (
    <Field label={label} required={required}>
      <input className={inputClass} value={form[name] ?? ""} onChange={(event) => patch(setForm, name, event.target.value)} required={required} inputMode={inputMode} />
    </Field>
  );
}

function Select({ form, setForm, name, label, children, required = false }: { form: ProspectFormState; setForm: React.Dispatch<React.SetStateAction<ProspectFormState>>; name: string; label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <Field label={label} required={required}>
      <select className={inputClass} value={form[name] ?? ""} onChange={(event) => patch(setForm, name, event.target.value)} required={required}>
        {children}
      </select>
    </Field>
  );
}

function TextArea({ form, setForm, name, label, required = false }: { form: ProspectFormState; setForm: React.Dispatch<React.SetStateAction<ProspectFormState>>; name: string; label: string; required?: boolean }) {
  return (
    <Field label={label} required={required}>
      <textarea className={textareaClass} value={form[name] ?? ""} onChange={(event) => patch(setForm, name, event.target.value)} required={required} />
    </Field>
  );
}

function normalizeMoney(value: string) {
  const clean = value.trim().replace(/[\s\u202f]/g, "").replace(",", ".");
  return clean || "";
}

export default function ProspectForm({ saving, onClose, onSubmit }: { saving: boolean; onClose: () => void; onSubmit: (payload: Partial<CrmProspectRow>) => void }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [form, setForm] = useState<ProspectFormState>({
    type: "particulier",
    civilite: "",
    statut: "nouveau",
    urgence: "normale",
    source_acquisition: "Appel entrant",
    type_projet: "Renovation globale",
  });

  const displayName = useMemo(() => {
    const name = [form.prenom, form.nom].filter(Boolean).join(" ").trim();
    return name || form.societe || "Nouveau prospect";
  }, [form.nom, form.prenom, form.societe]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: Partial<CrmProspectRow> = {
      ...form,
      budget_estime: normalizeMoney(form.budget_estime ?? "") as unknown as number,
      tags: form.tags ? form.tags.split(",").map((item) => item.trim()).filter(Boolean) : [],
      notes: [form.notes, form.planification_visite === "oui" ? "Visite terrain a planifier." : ""].filter(Boolean).join("\n\n"),
    } as Partial<CrmProspectRow>;
    onSubmit(payload);
  }

  return (
    <CrmModal title="Ajouter un prospect" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Creation rapide</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">{displayName}</div>
          <p className="mt-1 text-sm text-slate-600">Renseigne le minimum utile. Batipro cree automatiquement l'opportunite commerciale.</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-blue-800">
            <span className="rounded-full bg-white px-3 py-1">1. Prospect</span>
            <span className="rounded-full bg-white px-3 py-1">2. Opportunite auto</span>
            <span className="rounded-full bg-white px-3 py-1">3. Visite terrain</span>
            <span className="rounded-full bg-white px-3 py-1">4. Pre-devis</span>
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-sm font-semibold text-slate-950">Contact</div>
          <div className="grid gap-3 md:grid-cols-3">
            <Select form={form} setForm={setForm} name="type" label="Type" required>
              <option value="particulier">Particulier</option>
              <option value="professionnel">Professionnel</option>
            </Select>
            <Input form={form} setForm={setForm} name="prenom" label="Prenom" />
            <Input form={form} setForm={setForm} name="nom" label="Nom" required={form.type !== "professionnel"} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Input form={form} setForm={setForm} name="telephone" label="Telephone" required inputMode="tel" />
            <Input form={form} setForm={setForm} name="email" label="Email" />
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-sm font-semibold text-slate-950">Adresse chantier</div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_140px_minmax(0,1fr)]">
            <Input form={form} setForm={setForm} name="adresse" label="Adresse" />
            <Input form={form} setForm={setForm} name="code_postal" label="Code postal" inputMode="numeric" />
            <Input form={form} setForm={setForm} name="ville" label="Ville" />
          </div>
        </section>

        <section className="space-y-3">
          <div className="text-sm font-semibold text-slate-950">Projet</div>
          <div className="grid gap-3 md:grid-cols-2">
            <Select form={form} setForm={setForm} name="type_projet" label="Type de projet" required>
              {projectTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
            <Input form={form} setForm={setForm} name="budget_estime" label="Budget estime" inputMode="decimal" />
          </div>
          <TextArea form={form} setForm={setForm} name="description_besoin" label="Description rapide du besoin" required />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-950">Suite commerciale</div>
              <p className="mt-1 text-sm text-slate-600">L'opportunite est creee automatiquement. La prochaine action sera la visite terrain.</p>
            </div>
            <label className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm">
              <input type="checkbox" checked={form.planification_visite !== "non"} onChange={(event) => patch(setForm, "planification_visite", event.target.checked ? "oui" : "non")} />
              Visite a planifier
            </label>
          </div>
        </section>

        <section>
          <button type="button" onClick={() => setShowAdvanced((value) => !value)} className="text-sm font-semibold text-blue-700 hover:text-blue-900">
            {showAdvanced ? "Masquer les informations avancees" : "Afficher les informations avancees"}
          </button>
          {showAdvanced ? (
            <div className="mt-3 grid gap-3 rounded-2xl border border-slate-200 p-4 md:grid-cols-2">
              <Input form={form} setForm={setForm} name="societe" label="Societe" required={form.type === "professionnel"} />
              <Select form={form} setForm={setForm} name="civilite" label="Civilite">
                <option value="">Non renseigne</option>
                <option value="M">M.</option>
                <option value="Mme">Mme</option>
                <option value="Societe">Societe</option>
              </Select>
              <Select form={form} setForm={setForm} name="source_acquisition" label="Source du contact">
                {sources.map((source) => <option key={source} value={source}>{source}</option>)}
              </Select>
              <Select form={form} setForm={setForm} name="urgence" label="Urgence">
                <option value="faible">Faible</option>
                <option value="normale">Normale</option>
                <option value="urgente">Urgente</option>
              </Select>
              <Input form={form} setForm={setForm} name="mobile" label="Mobile secondaire" inputMode="tel" />
              <Input form={form} setForm={setForm} name="apporteur_affaire" label="Apporteur / agent" />
              <div className="md:col-span-2"><Input form={form} setForm={setForm} name="tags" label="Tags internes" /></div>
              <div className="md:col-span-2"><TextArea form={form} setForm={setForm} name="notes" label="Notes internes" /></div>
            </div>
          ) : null}
        </section>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Annuler</button>
          <button disabled={saving} className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
            {saving ? "Enregistrement..." : "Creer prospect"}
          </button>
        </div>
      </form>
    </CrmModal>
  );
}
