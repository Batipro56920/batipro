import { calculateDocumentTotals, createEmptyBusinessDocument, createDocumentSection, createDocumentText } from "../../document-engine";
import type { ChantierRow } from "../../../services/chantiers.service";
import type { ReceptionReportDecision, ReceptionReportRecord } from "../domain/types";

export function createReceptionReport(chantier: ChantierRow): ReceptionReportRecord {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const document = createEmptyBusinessDocument("reception_report");
  const section = createDocumentSection("Reception du chantier", 0);
  const text = createDocumentText(section.id, "Le client et l'entreprise constatent l'etat du chantier a la date de reception.", 0);
  const nodes = [{ ...section, children: [text] }];
  const nextDocument = {
    ...document,
    number: createReceptionReportNumber(),
    status: "draft" as const,
    issueDate: today,
    chantierId: chantier.id,
    title: "PV de reception",
    recipient: {
      ...document.recipient,
      displayName: chantier.client ?? "Client",
      address: chantier.adresse ?? null,
      phone: chantier.crm_client_phone ?? null,
      email: chantier.crm_client_email ?? null,
    },
    siteAddress: chantier.adresse ?? null,
    description: chantier.crm_project_description ?? chantier.nom,
    nodes,
    terms: {
      ...document.terms,
      paymentTerms: "PV de reception du chantier.",
      legalMentions: "La reception marque le point de depart des garanties legales applicables.",
      depositPercent: null,
      depositAmount: null,
    },
  };

  return {
    id: crypto.randomUUID(),
    chantierId: chantier.id,
    status: "draft",
    decision: "without_reserves",
    receptionDate: today,
    projectReference: chantier.crm_quote_id ?? chantier.id,
    observations: "",
    clientSignerName: chantier.client ?? null,
    companySignerName: null,
    reserves: [],
    document: { ...nextDocument, totals: calculateDocumentTotals(nextDocument) },
    createdAt: now,
    updatedAt: now,
  };
}

export function receptionDecisionLabel(decision: ReceptionReportDecision) {
  if (decision === "without_reserves") return "Reception sans reserve";
  if (decision === "with_reserves") return "Reception avec reserves";
  return "Refus de reception";
}

function createReceptionReportNumber() {
  return `PV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
}
