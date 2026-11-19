import type { IntervenantRow, IntervenantStatus } from "../../services/intervenants.service";
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

