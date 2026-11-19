import { useState } from "react";
import type { IntervenantRow, IntervenantStatus } from "../../services/intervenants.service";
import { EXTERNAL_WORKING_HOURS_PER_DAY, effectiveIntervenantHourlyCost } from "../../services/intervenantCosts.service";
export { effectiveIntervenantHourlyCost as effectiveHourlyCost } from "../../services/intervenantCosts.service";

export type IntervenantFormState = {
  nom: string;
  entreprise: string;
  metier: string;
  email: string;
  telephone: string;
  notes: string;
  status: IntervenantStatus;
  job_title: string;
  hourly_cost_ht: string;
  hourly_sale_price_ht: string;
  entry_date: string;
  is_active: boolean;
  daily_rate_ht: string;
  insurance: string;
};

export const EMPTY_INTERVENANT_FORM: IntervenantFormState = {
  nom: "", entreprise: "", metier: "", email: "", telephone: "", notes: "",
  status: "employee", job_title: "", hourly_cost_ht: "",
  hourly_sale_price_ht: "", entry_date: "", is_active: true,
  daily_rate_ht: "", insurance: "",
};

export const INTERVENANT_STATUS_LABELS: Record<IntervenantStatus, string> = {
  employee: "Salarié",
  subcontractor: "Sous-traitant",
  temporary_worker: "Intérimaire",
  partner: "Partenaire",
  other: "Autre",
};

export const moneyFr = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value)
    ? "Non renseigné"
    : value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function parseHourlyValue(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", ".").replace(/\s/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}


export function intervenantFormFromRow(row: IntervenantRow): IntervenantFormState {
  return {
    nom: row.nom ?? "",
    entreprise: row.entreprise || row.subcontractor_company || "",
    metier: row.metier || row.specialty || "",
    email: row.email ?? "",
    telephone: row.telephone ?? "",
    notes: row.notes ?? "",
    status: row.status ?? "other",
    job_title: row.job_title ?? "",
    hourly_cost_ht: row.hourly_cost_ht == null ? "" : String(row.hourly_cost_ht).replace(".", ","),
    hourly_sale_price_ht: row.hourly_sale_price_ht == null ? "" : String(row.hourly_sale_price_ht).replace(".", ","),
    entry_date: row.entry_date ?? "",
    is_active: row.is_active !== false,
    daily_rate_ht: row.daily_rate_ht == null ? "" : String(row.daily_rate_ht).replace(".", ","),
    insurance: row.insurance ?? "",
  };
}

/** One record, one set of values, regardless of creation/editing route. */
export function intervenantPayload(form: IntervenantFormState) {
  const entreprise = form.entreprise.trim();
  const metier = form.metier.trim();
  const subcontractor = form.status === "subcontractor";
  return {
    ...form,
    nom: form.nom.trim(),
    entreprise,
    metier,
    email: form.email.trim(),
    telephone: form.telephone.trim(),
    // Legacy columns retained for older consumers, but never entered twice.
    subcontractor_company: subcontractor ? entreprise : "",
    specialty: subcontractor ? metier : "",
  };
}

function SalaryEstimator({ hourlyCost, onHourlyCostChange }: { hourlyCost: string; onHourlyCostChange: (value: string) => void }) {
  const [mode, setMode] = useState<"gross"|"net"|"employer">("employer");
  const [monthly, setMonthly] = useState(() => (Number(hourlyCost.replace(",", ".")) * 151.67).toFixed(2).replace(".", ","));
  const [days, setDays] = useState("210");
  const [hours, setHours] = useState("7");
  const [netRatio, setNetRatio] = useState("78");
  const [employerRatio, setEmployerRatio] = useState("142");
  const val=(s:string)=>Math.max(0,Number(s.replace(",","."))||0);
  const employeeNet=val(netRatio)/100, employerFactor=val(employerRatio)/100;
  const gross=mode==="gross"?val(monthly):mode==="net"?employeeNet>0?val(monthly)/employeeNet:0:employerFactor>0?val(monthly)/employerFactor:0;
  const net=gross*employeeNet, employer=gross*employerFactor;
  const yearlyHours=val(days)*val(hours);
  function changeValue(next:string) {
    setMonthly(next);
    const numeric=val(next);
    const employerMonthly=mode==="employer"?numeric:mode==="gross"?numeric*employerFactor:employeeNet>0?numeric/employeeNet*employerFactor:0;
    onHourlyCostChange(yearlyHours>0?(employerMonthly*12/yearlyHours).toFixed(2).replace(".",","):"");
  }
  function changeSchedule(nextDays:string,nextHours:string){
    setDays(nextDays);setHours(nextHours);
    const total=val(nextDays)*val(nextHours);
    onHourlyCostChange(total>0?(employer*12/total).toFixed(2).replace(".",","):"");
  }
  const format=(n:number)=>n.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2})+" €";
  return <div className="mt-4 space-y-3 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
    <h3 className="font-semibold">Simulation salariale et productivité</h3>
    <p className="text-xs text-slate-600">Estimations paramétrables, hors primes et situations particulières. Vérifier avec la paie. Le coût horaire chargé enregistré dans Batipro est recalculé à partir du coût employeur et des heures productives.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Montant saisi
        <select className="mt-1 w-full rounded-lg border bg-white p-2" value={mode} onChange={e=>setMode(e.target.value as "gross"|"net"|"employer")}><option value="gross">Brut mensuel</option><option value="net">Net mensuel estimé</option><option value="employer">Coût employeur mensuel</option></select>
        <input className="mt-2 w-full rounded-lg border bg-white p-2" inputMode="decimal" value={monthly} onChange={e=>changeValue(e.target.value.replace(".",","))}/>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">Net / brut (%)<input className="mt-1 w-full rounded-lg border bg-white p-2" inputMode="decimal" value={netRatio} onChange={e=>setNetRatio(e.target.value.replace(".",","))}/></label>
        <label className="text-sm">Employeur / brut (%)<input className="mt-1 w-full rounded-lg border bg-white p-2" inputMode="decimal" value={employerRatio} onChange={e=>setEmployerRatio(e.target.value.replace(".",","))}/></label>
      </div>
      <label className="text-sm">Jours productifs / an<input className="mt-1 w-full rounded-lg border bg-white p-2" inputMode="decimal" value={days} onChange={e=>changeSchedule(e.target.value.replace(".",","),hours)}/></label>
      <label className="text-sm">Heures productives / jour<input className="mt-1 w-full rounded-lg border bg-white p-2" inputMode="decimal" value={hours} onChange={e=>changeSchedule(days,e.target.value.replace(".",","))}/></label>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[["Brut mensuel",format(gross)],["Net mensuel estimé",format(net)],["Coût employeur / mois",format(employer)],["Heures productives / an",yearlyHours.toLocaleString("fr-FR")+" h"],["Coût employeur / h",yearlyHours>0?format(employer*12/yearlyHours):"—"],["Coût employeur / jour",val(days)>0?format(employer*12/val(days)):"—"]].map(([label,value])=><div key={label} className="rounded-lg bg-white p-3"><div className="text-xs text-slate-500">{label}</div><strong>{value}</strong></div>)}</div>
  </div>;
}


const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100";

export default function IntervenantFormFields({
  form,
  onChange,
}: {
  form: IntervenantFormState;
  onChange: (next: IntervenantFormState) => void;
}) {
  const update = <K extends keyof IntervenantFormState>(key: K, value: IntervenantFormState[K]) =>
    onChange({ ...form, [key]: value });
  const employee = form.status === "employee";
  const external = form.status === "subcontractor" || form.status === "temporary_worker";
  const hourly = parseHourlyValue(form.hourly_cost_ht);
  const daily = parseHourlyValue(form.daily_rate_ht);
  const inferredHour = hourly == null && external && daily != null ? effectiveIntervenantHourlyCost({status: form.status, hourly_cost_ht: null, daily_rate_ht: daily}) : null;
  const numericInput = (key: "hourly_cost_ht" | "hourly_sale_price_ht" | "daily_rate_ht", label: string, hint?: string) => (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input className={inputClass} inputMode="decimal" value={form[key]} placeholder="Ex. 28,50"
        onChange={(e) => update(key, e.target.value.replace(".", ","))}/>
      {hint ? <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  );
  return <div className="space-y-6">
    <section className="space-y-4">
      <div>
        <h3 className="font-semibold text-slate-950">Identité et activité</h3>
        <p className="text-xs text-slate-500">Une seule fiche par intervenant, avec les mêmes informations à la création et à la modification.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">Type d'intervenant
          <select className={inputClass} value={form.status} onChange={(e) => update("status", e.target.value as IntervenantStatus)}>
            {Object.entries(INTERVENANT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-slate-700">Nom complet *
          <input className={inputClass} value={form.nom} required placeholder="Prénom et nom"
            onChange={(e) => update("nom", e.target.value)}/>
        </label>
        <label className="block text-sm font-medium text-slate-700">{external ? "Entreprise employeuse / sous-traitante" : "Entreprise"}
          <input className={inputClass} value={form.entreprise} placeholder="Nom de l'entreprise"
            onChange={(e) => update("entreprise", e.target.value)}/>
        </label>
        <label className="block text-sm font-medium text-slate-700">Métier / spécialité
          <input className={inputClass} value={form.metier} placeholder="Plaquiste, plombier..."
            onChange={(e) => update("metier", e.target.value)}/>
        </label>
        <label className="block text-sm font-medium text-slate-700">Adresse e-mail
          <input className={inputClass} type="email" value={form.email} placeholder="prenom@entreprise.fr"
            onChange={(e) => update("email", e.target.value)}/>
        </label>
        <label className="block text-sm font-medium text-slate-700">Téléphone
          <input className={inputClass} type="tel" value={form.telephone} placeholder="06..."
            onChange={(e) => update("telephone", e.target.value)}/>
        </label>
      </div>
    </section>
    <section className="rounded-2xl border border-sky-100 bg-sky-50/50 p-4 md:p-5">
      <h3 className="font-semibold text-slate-950">Coûts et rentabilité</h3>
      <p className="mt-1 text-xs text-slate-600">Coûts de base utilisés pour les calculs métier. Les frais généraux sont ajoutés séparément par le moteur de rentabilité.</p>
      {employee ? <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">Poste
          <input className={inputClass} value={form.job_title} placeholder="Plaquiste..."
            onChange={(e) => update("job_title", e.target.value)}/>
        </label>
        <label className="block text-sm font-medium text-slate-700">Date d'entrée
          <input className={inputClass} type="date" value={form.entry_date}
            onChange={(e) => update("entry_date", e.target.value)}/>
        </label>
        {numericInput("hourly_cost_ht", "Coût horaire employeur chargé", "À renseigner à partir du coût employeur et des heures réellement productives.")}
        {numericInput("hourly_sale_price_ht", "Prix de vente horaire")}
        <div className="md:col-span-2"><SalaryEstimator key={form.status} hourlyCost={form.hourly_cost_ht} onHourlyCostChange={(value) => update("hourly_cost_ht", value)} /></div>
      </div> : external ? <div className="mt-4 grid gap-4 md:grid-cols-2">
        {numericInput("daily_rate_ht", "Tarif d'achat journalier HT", "Base de conversion indicative : ${EXTERNAL_WORKING_HOURS_PER_DAY} heures par jour.")}
        {numericInput("hourly_cost_ht", "Coût horaire d'achat HT (facultatif)", "Prioritaire sur le tarif journalier lorsqu'il est renseigné.")}
        {form.status === "subcontractor" ? <label className="block text-sm font-medium text-slate-700 md:col-span-2">Assurance / références
          <input className={inputClass} value={form.insurance} placeholder="RC pro, décennale..."
            onChange={(e) => update("insurance", e.target.value)}/>
        </label> : null}
      </div> : <p className="mt-3 text-sm text-slate-600">Aucun coût de main-d'œuvre obligatoire pour ce type de profil.</p>}
      {(employee || external) && <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-sky-100 bg-white p-4">
        <div><div className="text-xs text-slate-500">Coût horaire de référence</div><strong className="text-xl text-slate-950">{moneyFr(hourly ?? inferredHour)}</strong></div>
        {inferredHour !== null && <span className="text-xs text-slate-500">Calculé à partir du tarif journalier (7 h)</span>}
        {hourly == null && inferredHour == null && <span className="text-xs text-amber-700">À renseigner pour fiabiliser les coûts réels.</span>}
      </div>}
    </section>
    <section className="space-y-4">
      <h3 className="font-semibold text-slate-950">Gestion et informations complémentaires</h3>
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
        <input type="checkbox" className="h-4 w-4 accent-sky-600" checked={form.is_active}
          onChange={(e) => update("is_active", e.target.checked)}/> Intervenant actif et disponible pour les affectations
      </label>
      <label className="block text-sm font-medium text-slate-700">Notes internes
        <textarea className={inputClass + " min-h-24"} value={form.notes} placeholder="Compétences, disponibilités, informations utiles..."
          onChange={(e) => update("notes", e.target.value)}/>
      </label>
    </section>
  </div>;
}
