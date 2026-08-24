import type { CrmProspectRow } from "../../../../services/crm.service";

export const prospectStatusLabels: Record<CrmProspectRow["statut"], string> = {
  nouveau: "Nouveau",
  a_qualifier: "À qualifier",
  qualifie: "Qualifié",
  devis_en_cours: "Devis en cours",
  negociation: "Négociation",
  gagne: "Converti",
  perdu: "Sans suite",
  archive: "Archivé",
};

export function prospectStatusLabel(status: CrmProspectRow["statut"]) {
  return prospectStatusLabels[status];
}
