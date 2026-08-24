import type { CrmProspectRow } from "../../../../services/crm.service";
import { prospectStatusLabel } from "./prospectStatusFormat";

const classes: Record<CrmProspectRow["statut"], string> = {
  nouveau: "border-primary/20 bg-primary-soft text-primary-on",
  a_qualifier: "border-warning/20 bg-warning-soft text-warning-on",
  qualifie: "border-success/20 bg-success-soft text-success-on",
  devis_en_cours: "border-info/20 bg-info-soft text-info-on",
  negociation: "border-primary/20 bg-primary-soft text-primary-on",
  gagne: "border-success/20 bg-success-soft text-success-on",
  perdu: "border-danger/20 bg-danger-soft text-danger-on",
  archive: "border-subtle bg-interactive text-ink-secondary",
};

export function ProspectStatusBadge({ status }: { status: CrmProspectRow["statut"] }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${classes[status]}`}>{prospectStatusLabel(status)}</span>;
}
