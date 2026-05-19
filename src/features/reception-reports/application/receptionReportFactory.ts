import { calculateDocumentTotals, createEmptyBusinessDocument, createDocumentSection, createDocumentText } from "../../document-engine";
import type { ChantierRow } from "../../../services/chantiers.service";
import type { ReceptionReportDecision, ReceptionReportRecord } from "../domain/types";

export function createReceptionReport(chantier: ChantierRow): ReceptionReportRecord {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const document = createEmptyBusinessDocument("reception_report");
  const section = createDocumentSection("Réception du chantier", 0);
  const text = createDocumentText(section.id, "Le client et l'entreprise constatent l'état du chantier à la date de réception.", 0);
  const nodes = [{ ...section, children: [text] }];
  const nextDocument = {
    ...document,
    number: createReceptionReportNumber(),
    status: "draft" as const,
    issueDate: today,
    chantierId: chantier.id,
    title: "PV de réception",
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
      paymentTerms: "PV de réception du chantier.",
      legalMentions: "La réception marque le point de départ des garanties légales applicables.",
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
  if (decision === "without_reserves") return "Réception sans réserve";
  if (decision === "with_reserves") return "Réception avec réserves";
  return "Refus de réception";
}

function createReceptionReportNumber() {
  return `PV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
}
