import type { CrmDataset, CrmProspectRow, CrmQuoteRow } from "../../../services/crm.service";
import type { ChantierRow } from "../../../services/chantiers.service";
import type { ProjectMetrics, ProjectRecord, ProjectStatus } from "../types";

const ACTIVE_STATUSES = new Set<ProjectStatus>([
  "nouveau",
  "qualification",
  "rdv_planifie",
  "visite_effectuee",
  "chiffrage",
  "devis_envoye",
  "negociation",
  "accepte",
  "preparation_chantier",
  "en_chantier",
  "sav",
]);

function fullName(row: { prenom?: string | null; nom?: string | null; societe?: string | null } | null) {
  if (!row) return "Client à qualifier";
  const person = [row.prenom, row.nom].filter(Boolean).join(" ").trim();
  return row.societe || person || "Client à qualifier";
}

function fullAddress(row: { adresse?: string | null; code_postal?: string | null; ville?: string | null } | null) {
  if (!row) return null;
  return [row.adresse, row.code_postal, row.ville].filter(Boolean).join(" ").trim() || null;
}

function isOpenSav(status: string) {
  return !["clos", "ferme", "fermé", "resolu", "résolu"].includes(status.toLowerCase());
}

function chantierStatusToProjectStatus(chantier: ChantierRow | undefined): ProjectStatus | null {
  if (!chantier) return null;
  if (chantier.status === "TERMINE" || chantier.status === "ARCHIVE") return "cloture";
  if (chantier.status === "PREPARATION") return "preparation_chantier";
  if (chantier.status === "EN_COURS" || chantier.status === "EN_PAUSE") return "en_chantier";
  if (chantier.status === "ANNULE") return "perdu";
  return null;
}

function quoteStatusToProjectStatus(quotes: CrmQuoteRow[]): ProjectStatus | null {
  if (quotes.some((quote) => quote.statut === "accepte")) return "accepte";
  if (quotes.some((quote) => quote.statut === "negociation")) return "negociation";
  if (quotes.some((quote) => ["envoye", "relance_1", "relance_2", "vu"].includes(quote.statut))) {
    return "devis_envoye";
  }
  if (quotes.some((quote) => ["brouillon", "en_preparation"].includes(quote.statut))) return "chiffrage";
  if (quotes.some((quote) => ["refuse", "annule", "expire"].includes(quote.statut))) return "perdu";
  return null;
}

function opportunityStatus(stageKey: string, status: string, lostReason: string | null): ProjectStatus {
  const normalized = `${stageKey} ${status}`.toLowerCase();
  if (lostReason || normalized.includes("perdu") || normalized.includes("lost")) return "perdu";
  if (normalized.includes("signature") || normalized.includes("gagne") || normalized.includes("won")) return "accepte";
  if (normalized.includes("negociation") || normalized.includes("négociation")) return "negociation";
  if (normalized.includes("devis")) return "devis_envoye";
  if (normalized.includes("chiffrage")) return "chiffrage";
  if (normalized.includes("visite")) return "rdv_planifie";
  if (normalized.includes("qualification")) return "qualification";
  return "nouveau";
}

function prospectStatus(row: CrmProspectRow): ProjectStatus {
  if (row.statut === "perdu" || row.statut === "archive") return "perdu";
  if (row.statut === "gagne") return "accepte";
  if (row.statut === "negociation") return "negociation";
  if (row.statut === "devis_en_cours") return "chiffrage";
  if (row.statut === "qualifie" || row.statut === "a_qualifier") return "qualification";
  return "nouveau";
}

function resolveStatus(params: {
  prospect: CrmProspectRow | null;
  stageKey?: string;
  opportunityStatus?: string;
  lostReason?: string | null;
  quotes: CrmQuoteRow[];
  chantiers: ChantierRow[];
  hasOpenSav: boolean;
}): ProjectStatus {
  if (params.hasOpenSav) return "sav";
  const chantierStatus = chantierStatusToProjectStatus(params.chantiers[0]);
  if (chantierStatus) return chantierStatus;
  const quoteStatus = quoteStatusToProjectStatus(params.quotes);
  if (quoteStatus) return quoteStatus;
  if (params.stageKey && params.opportunityStatus) {
    return opportunityStatus(params.stageKey, params.opportunityStatus, params.lostReason ?? null);
  }
  return params.prospect ? prospectStatus(params.prospect) : "nouveau";
}

export function projectStatusLabel(status: ProjectStatus) {
  const labels: Record<ProjectStatus, string> = {
    nouveau: "Nouveau",
    qualification: "Qualification",
    rdv_planifie: "RDV planifié",
    visite_effectuee: "Visite effectuée",
    chiffrage: "Chiffrage",
    devis_envoye: "Devis envoyé",
    negociation: "Négociation",
    accepte: "Accepté",
    preparation_chantier: "Préparation chantier",
    en_chantier: "En chantier",
    cloture: "Clôturé",
    sav: "SAV",
    perdu: "Perdu",
  };
  return labels[status];
}

export function buildProjects(dataset: CrmDataset): ProjectRecord[] {
  const clientsById = new Map(dataset.clients.map((client) => [client.id, client]));
  const prospectsById = new Map(dataset.prospects.map((prospect) => [prospect.id, prospect]));
  const projects: ProjectRecord[] = [];
  const usedProspects = new Set<string>();

  for (const opportunity of dataset.opportunities) {
    const prospect = opportunity.prospect_id ? prospectsById.get(opportunity.prospect_id) ?? null : null;
    const client = opportunity.client_id ? clientsById.get(opportunity.client_id) ?? null : prospect?.client_id ? clientsById.get(prospect.client_id) ?? null : null;
    if (prospect) usedProspects.add(prospect.id);
    const quotes = dataset.quotes.filter((quote) => quote.opportunity_id === opportunity.id);
    const chantiers = dataset.chantiers.filter((chantier) => chantier.crm_opportunity_id === opportunity.id || chantier.id === opportunity.chantier_id);
    const sav = dataset.sav.filter((ticket) => chantiers.some((chantier) => chantier.id === ticket.chantier_id) || (client && ticket.client_id === client.id));
    const tasks = dataset.tasks.filter((task) => task.opportunity_id === opportunity.id || (prospect && task.prospect_id === prospect.id) || (client && task.client_id === client.id));
    const appointments = dataset.appointments.filter((appointment) => appointment.opportunity_id === opportunity.id || (prospect && appointment.prospect_id === prospect.id) || (client && appointment.client_id === client.id));
    const documents = dataset.documents.filter((document) => document.opportunity_id === opportunity.id || quotes.some((quote) => quote.id === document.quote_id) || chantiers.some((chantier) => chantier.id === document.chantier_id));
    const communications = dataset.communications.filter((communication) => communication.opportunity_id === opportunity.id || quotes.some((quote) => quote.id === communication.quote_id));

    projects.push({
      id: `opportunity-${opportunity.id}`,
      sourceType: "opportunity",
      sourceId: opportunity.id,
      name: opportunity.nom_affaire || prospect?.description_besoin || "Projet sans nom",
      clientName: fullName(client ?? prospect),
      contactEmail: client?.email ?? prospect?.email ?? null,
      contactPhone: client?.telephone ?? client?.mobile ?? prospect?.telephone ?? prospect?.mobile ?? null,
      address: chantiers[0]?.adresse ?? fullAddress(client ?? prospect),
      salesperson: opportunity.responsable_id,
      status: resolveStatus({
        prospect,
        stageKey: opportunity.stage_key,
        opportunityStatus: opportunity.status,
        lostReason: opportunity.lost_reason,
        quotes,
        chantiers,
        hasOpenSav: sav.some((ticket) => isOpenSav(ticket.statut)),
      }),
      nextAction: opportunity.prochaine_action,
      nextActionDate: opportunity.prochaine_action_date,
      quoteAmount: quotes.reduce((sum, quote) => sum + Number(quote.montant_ht || 0), 0) || Number(opportunity.montant_estime || 0),
      createdAt: opportunity.created_at,
      desiredDeadline: opportunity.echeance,
      projectType: prospect?.type_projet ?? null,
      sourceLabel: prospect?.source_acquisition ?? null,
      budgetEstimate: prospect?.budget_estime ?? opportunity.montant_estime ?? null,
      needDescription: prospect?.description_besoin ?? opportunity.notes,
      notes: opportunity.notes ?? prospect?.notes ?? null,
      prospect,
      client,
      opportunity,
      quotes,
      chantiers,
      tasks,
      appointments,
      documents,
      communications,
      sav,
    });
  }

  for (const prospect of dataset.prospects) {
    if (usedProspects.has(prospect.id)) continue;
    const client = prospect.client_id ? clientsById.get(prospect.client_id) ?? null : null;
    const quotes = dataset.quotes.filter((quote) => quote.prospect_id === prospect.id || (client && quote.client_id === client.id));
    const chantiers = dataset.chantiers.filter((chantier) => chantier.crm_prospect_id === prospect.id || (client && chantier.crm_client_id === client.id));
    const sav = dataset.sav.filter((ticket) => client && ticket.client_id === client.id);

    projects.push({
      id: `prospect-${prospect.id}`,
      sourceType: "prospect",
      sourceId: prospect.id,
      name: prospect.description_besoin || prospect.type_projet || `Projet ${fullName(prospect)}`,
      clientName: fullName(client ?? prospect),
      contactEmail: client?.email ?? prospect.email,
      contactPhone: client?.telephone ?? client?.mobile ?? prospect.telephone ?? prospect.mobile,
      address: chantiers[0]?.adresse ?? fullAddress(client ?? prospect),
      salesperson: prospect.owner_id,
      status: resolveStatus({
        prospect,
        quotes,
        chantiers,
        hasOpenSav: sav.some((ticket) => isOpenSav(ticket.statut)),
      }),
      nextAction: null,
      nextActionDate: null,
      quoteAmount: quotes.reduce((sum, quote) => sum + Number(quote.montant_ht || 0), 0) || Number(prospect.budget_estime || 0),
      createdAt: prospect.created_at,
      desiredDeadline: null,
      projectType: prospect.type_projet,
      sourceLabel: prospect.source_acquisition,
      budgetEstimate: prospect.budget_estime,
      needDescription: prospect.description_besoin,
      notes: prospect.notes,
      prospect,
      client,
      opportunity: null,
      quotes,
      chantiers,
      tasks: dataset.tasks.filter((task) => task.prospect_id === prospect.id || (client && task.client_id === client.id)),
      appointments: dataset.appointments.filter((appointment) => appointment.prospect_id === prospect.id || (client && appointment.client_id === client.id)),
      documents: dataset.documents.filter((document) => document.prospect_id === prospect.id || quotes.some((quote) => quote.id === document.quote_id)),
      communications: dataset.communications.filter((communication) => communication.prospect_id === prospect.id || quotes.some((quote) => quote.id === communication.quote_id)),
      sav,
    });
  }

  return projects.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

export function buildProjectMetrics(projects: ProjectRecord[]): ProjectMetrics {
  const today = new Date().toISOString().slice(0, 10);
  return {
    activeProjects: projects.filter((project) => ACTIVE_STATUSES.has(project.status)).length,
    pendingQuotes: projects.filter((project) => ["chiffrage", "devis_envoye", "negociation"].includes(project.status)).length,
    followUpsDue: projects.filter((project) => project.nextActionDate && project.nextActionDate < today).length,
    acceptedProjects: projects.filter((project) => ["accepte", "preparation_chantier", "en_chantier", "cloture"].includes(project.status)).length,
    lostProjects: projects.filter((project) => project.status === "perdu").length,
    pipelineAmount: projects
      .filter((project) => project.status !== "perdu" && project.status !== "cloture")
      .reduce((sum, project) => sum + Number(project.quoteAmount || 0), 0),
  };
}
