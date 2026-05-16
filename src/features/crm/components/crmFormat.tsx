import type { CrmClientRow, CrmProspectRow } from "../../../services/crm.service";

export function eur(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

export function dateOnly(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

export function entityLabel(row: Pick<CrmProspectRow | CrmClientRow, "prenom" | "nom" | "societe" | "email"> | null | undefined) {
  if (!row) return "—";
  return [row.prenom, row.nom].filter(Boolean).join(" ") || row.societe || row.email || "Sans nom";
}

export function statusPill(status: string) {
  const danger = ["perdu", "refuse", "expire", "ouvert"].includes(status);
  const ok = ["gagne", "accepte", "signe", "clos", "terminee"].includes(status);
  return [
    "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
    ok
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : danger
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-slate-200 bg-slate-50 text-slate-700",
  ].join(" ");
}
