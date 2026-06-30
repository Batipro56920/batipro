import { supabase } from "../lib/supabaseClient";

export type GlobalSearchKind =
  | "chantier"
  | "chantier_tache"
  | "chantier_reserve"
  | "chantier_document"
  | "chantier_visite"
  | "chantier_consigne"
  | "projet"
  | "prospect"
  | "client"
  | "devis"
  | "facture"
  | "bon_commande"
  | "retour_terrain"
  | "crm_rdv"
  | "sav"
  | "apporteur"
  | "lead_apporteur"
  | "intervenant"
  | "fournisseur"
  | "modele_tache"
  | "produit";

export type GlobalSearchResult = {
  id: string;
  kind: GlobalSearchKind;
  title: string;
  subtitle: string;
  href: string;
  badge: string;
};

type SearchRow = Record<string, unknown>;

type SearchSource = {
  table: string;
  select: string;
  filter: string;
  map: (row: SearchRow) => GlobalSearchResult | null;
};

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function asRecord(value: unknown): SearchRow {
  return value && typeof value === "object" && !Array.isArray(value) ? value as SearchRow : {};
}

function clientName(row: SearchRow) {
  return [cleanText(row.prenom), cleanText(row.nom)].filter(Boolean).join(" ") || cleanText(row.societe) || "Client sans nom";
}

function documentText(row: SearchRow, key: string) {
  return cleanText(asRecord(row.document)[key]);
}

function documentNestedText(row: SearchRow, parentKey: string, key: string) {
  return cleanText(asRecord(asRecord(row.document)[parentKey])[key]);
}

function documentTotalTtc(row: SearchRow) {
  const value = Number(asRecord(asRecord(row.document).totals).totalTtc);
  return Number.isFinite(value) ? value : null;
}

function formatSearchCurrency(value: number | null) {
  if (value === null) return "";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}

function invoiceTypeLabel(value: unknown) {
  const type = cleanText(value);
  if (type === "deposit") return "Acompte";
  if (type === "intermediate") return "Intermédiaire";
  if (type === "final") return "Finale";
  if (type === "credit_note") return "Avoir";
  return type || "Facture";
}

function invoiceStatusLabel(value: unknown) {
  const status = cleanText(value);
  if (status === "draft") return "Brouillon";
  if (status === "sent") return "Envoyée";
  if (status === "partially_paid") return "Partiellement payée";
  if (status === "paid") return "Payée";
  if (status === "overdue") return "En retard";
  if (status === "cancelled") return "Annulée";
  return status;
}

function purchaseOrderStatusLabel(value: unknown) {
  const status = cleanText(value);
  if (status === "draft") return "Brouillon";
  if (status === "sent") return "Envoyé";
  if (status === "confirmed") return "Confirmé";
  if (status === "partially_delivered") return "Livré partiellement";
  if (status === "delivered") return "Livré";
  if (status === "cancelled") return "Annulé";
  return status;
}

function appointmentTypeLabel(value: unknown) {
  const type = cleanText(value);
  if (type === "visite_chiffrage") return "Visite de chiffrage";
  if (type === "visite_chiffrage_pre_devis") return "Préparation devis";
  if (type === "appel") return "Appel";
  if (type === "rdv_client") return "RDV client";
  if (type === "relance") return "Relance";
  return type || "Rendez-vous";
}

function appointmentStatusLabel(value: unknown) {
  const status = cleanText(value);
  if (status === "planifie") return "Planifié";
  if (status === "realise") return "Réalisé";
  if (status === "annule") return "Annulé";
  if (status === "reporte") return "Reporté";
  return status;
}

function savPriorityLabel(value: unknown) {
  const priority = cleanText(value);
  if (priority === "basse") return "Priorité basse";
  if (priority === "normale") return "Priorité normale";
  if (priority === "haute") return "Priorité haute";
  if (priority === "critique") return "Priorité critique";
  return priority;
}

function intervenantAccessLabel(row: SearchRow) {
  if (cleanText(row.archived_at)) return "Archivé";
  if (cleanText(row.user_id)) return "Compte actif";
  return "Profil sans compte";
}

function supplierStatusLabel(value: unknown) {
  return value === false || cleanText(value) === "false" ? "Inactif" : "Actif";
}

function normalizeQuery(query: string) {
  return query
    .trim()
    .replace(/[%,()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function searchableText(result: GlobalSearchResult) {
  return `${result.title} ${result.subtitle} ${result.badge}`.toLocaleLowerCase("fr-FR");
}

function resultRank(result: GlobalSearchResult, query: string) {
  const text = query.toLocaleLowerCase("fr-FR");
  const title = result.title.toLocaleLowerCase("fr-FR");
  const subtitle = result.subtitle.toLocaleLowerCase("fr-FR");
  if (title.startsWith(text)) return 0;
  if (title.includes(text)) return 1;
  if (subtitle.includes(text)) return 2;
  return 3;
}

function chantierSectionHref(row: SearchRow, section: "execution" | "qualite" | "documents", paramName: string) {
  const chantierId = cleanText(row.chantier_id);
  const id = cleanText(row.id);
  if (!chantierId) return "/chantiers";

  const params = new URLSearchParams({ [paramName]: id });
  return `/chantiers/${encodeURIComponent(chantierId)}/${section}?${params.toString()}`;
}

function chantierVisitHref(row: SearchRow) {
  const chantierId = cleanText(row.chantier_id);
  if (!chantierId) return "/chantiers";

  const id = cleanText(row.id);
  const params = new URLSearchParams();
  if (id) params.set("visiteId", id);
  const query = params.toString();
  return `/chantiers/${encodeURIComponent(chantierId)}/visites${query ? `?${query}` : ""}`;
}

function chantierConsigneHref(row: SearchRow) {
  const chantierId = cleanText(row.chantier_id);
  if (!chantierId) return "/chantiers";

  const id = cleanText(row.id);
  const params = new URLSearchParams();
  if (id) params.set("consigneId", id);
  const query = params.toString();
  return `/chantiers/${encodeURIComponent(chantierId)}/preparation${query ? `?${query}` : ""}`;
}

function quoteProjectHref(row: SearchRow) {
  const quoteId = cleanText(row.id);
  const opportunityId = cleanText(row.opportunity_id);
  const prospectId = cleanText(row.prospect_id);
  const clientId = cleanText(row.client_id);

  if (quoteId) return `/crm/devis/${encodeURIComponent(quoteId)}/edit`;
  if (opportunityId) return `/projets/opportunity-${opportunityId}?tab=quotes`;
  if (prospectId) return `/projets/prospect-${prospectId}?tab=quotes`;
  if (clientId) return `/projets/client-${clientId}?tab=quotes`;
  return "/crm/devis";
}

function appointmentHref(row: SearchRow) {
  const appointmentId = cleanText(row.id);
  const opportunityId = cleanText(row.opportunity_id);
  const prospectId = cleanText(row.prospect_id);
  const clientId = cleanText(row.client_id);
  const projectId = opportunityId ? `opportunity-${opportunityId}` : prospectId ? `prospect-${prospectId}` : clientId ? `client-${clientId}` : "";
  if (!projectId) return "/crm/agenda";

  const type = cleanText(row.type);
  const encodedProjectId = encodeURIComponent(projectId);
  const encodedAppointmentId = encodeURIComponent(appointmentId);
  if (type === "visite_chiffrage" || type === "visite_chiffrage_pre_devis") {
    return `/projets/${encodedProjectId}/visites/${encodedAppointmentId}`;
  }
  return `/projets/${encodedProjectId}/rdv/${encodedAppointmentId}`;
}

function clientHref(row: SearchRow) {
  const clientId = cleanText(row.id);
  return clientId ? `/crm/clients?client=${encodeURIComponent(clientId)}` : "/crm/clients";
}

function purchaseOrderHref(row: SearchRow) {
  const purchaseOrderId = cleanText(row.id);
  const params = new URLSearchParams({ tab: "orders" });
  if (purchaseOrderId) params.set("purchaseOrderId", purchaseOrderId);
  return `/fournisseurs?${params.toString()}`;
}

function apporteurHref(row: SearchRow) {
  const apporteurId = cleanText(row.id);
  const query = cleanText(row.nom) || cleanText(row.entreprise) || cleanText(row.telephone) || cleanText(row.email);
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (apporteurId) params.set("apporteurId", apporteurId);
  const queryString = params.toString();
  return queryString ? `/crm/apporteurs?${queryString}` : "/crm/apporteurs";
}

function apporteurLeadHref(row: SearchRow) {
  const opportunityId = cleanText(row.crm_opportunity_id);
  const prospectId = cleanText(row.crm_prospect_id);
  const apporteurId = cleanText(row.apporteur_id);
  const leadId = cleanText(row.id);
  const query = cleanText(row.client_name) || cleanText(row.project_address) || cleanText(row.project_type);

  if (opportunityId) return `/projets/opportunity-${opportunityId}`;
  if (prospectId) return `/projets/prospect-${prospectId}`;

  const params = new URLSearchParams();
  if (apporteurId) params.set("apporteurId", apporteurId);
  if (leadId) params.set("leadId", leadId);
  if (query) params.set("q", query);
  const queryString = params.toString();
  return queryString ? `/crm/apporteurs?${queryString}` : "/crm/apporteurs";
}

function supplierHref(row: SearchRow) {
  const supplierId = cleanText(row.id);
  const query = cleanText(row.name) || cleanText(row.specialty) || cleanText(row.city) || cleanText(row.email) || cleanText(row.phone);
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (supplierId) params.set("supplierId", supplierId);
  const queryString = params.toString();
  return queryString ? `/fournisseurs?${queryString}` : "/fournisseurs";
}

function taskTemplateHref(row: SearchRow) {
  const templateId = cleanText(row.id);
  const query = cleanText(row.titre) || cleanText(row.lot) || cleanText(row.unite) || cleanText(row.remarques);
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (templateId) params.set("templateId", templateId);
  const queryString = params.toString();
  return queryString ? `/bibliotheque?${queryString}` : "/bibliotheque";
}

function productCatalogHref(row: SearchRow) {
  const productId = cleanText(row.id);
  const query = cleanText(row.designation)
    || cleanText(row.internal_reference)
    || cleanText(row.manufacturer_reference)
    || cleanText(row.brand)
    || cleanText(row.category)
    || cleanText(row.main_supplier_name);
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (productId) params.set("productId", productId);
  const queryString = params.toString();
  return queryString ? `/catalogue-produits?${queryString}` : "/catalogue-produits";
}

function productPriceLabel(row: SearchRow) {
  const salePrice = Number(row.recommended_sale_price_ht);
  if (Number.isFinite(salePrice) && salePrice > 0) return `${formatSearchCurrency(salePrice)} vente HT`;

  const purchasePrice = Number(row.standard_purchase_price_ht);
  if (Number.isFinite(purchasePrice) && purchasePrice > 0) return `${formatSearchCurrency(purchasePrice)} achat HT`;

  return "";
}

async function querySource(source: SearchSource, query: string): Promise<GlobalSearchResult[]> {
  const like = `%${query}%`;
  const { data, error } = await supabase
    .from(source.table)
    .select(source.select)
    .or(source.filter.replaceAll("$term", like))
    .limit(8);

  if (error) {
    const code = String(error.code ?? "");
    const message = String(error.message ?? "").toLowerCase();
    if (code === "42P01" || code === "42703" || message.includes("does not exist") || message.includes("schema cache")) {
      return [];
    }
    throw error;
  }

  return (data ?? []).map((row) => source.map(row as SearchRow)).filter((row): row is GlobalSearchResult => Boolean(row));
}

const SOURCES: SearchSource[] = [
  {
    table: "chantiers",
    select: "id,nom,client,adresse,status",
    filter: "nom.ilike.$term,client.ilike.$term,adresse.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "chantier",
      title: cleanText(row.nom) || "Chantier sans nom",
      subtitle: [cleanText(row.client), cleanText(row.adresse)].filter(Boolean).join(" - ") || "Chantier",
      href: `/chantiers/${cleanText(row.id)}`,
      badge: "Chantier",
    }),
  },
  {
    table: "chantier_tasks",
    select: "id,chantier_id,titre,titre_terrain,lot,corps_etat,status,quality_status,priorite",
    filter: "titre.ilike.$term,titre_terrain.ilike.$term,lot.ilike.$term,corps_etat.ilike.$term,status.ilike.$term,quality_status.ilike.$term,priorite.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "chantier_tache",
      title: cleanText(row.titre_terrain) || cleanText(row.titre) || "Tache chantier sans titre",
      subtitle: [cleanText(row.lot) || cleanText(row.corps_etat), cleanText(row.status), cleanText(row.quality_status), cleanText(row.priorite)].filter(Boolean).join(" - ") || "Tache chantier",
      href: chantierSectionHref(row, "execution", "taskId"),
      badge: "Tache chantier",
    }),
  },
  {
    table: "chantier_reserves",
    select: "id,chantier_id,title,description,status,priority",
    filter: "title.ilike.$term,description.ilike.$term,status.ilike.$term,priority.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "chantier_reserve",
      title: cleanText(row.title) || "Reserve sans titre",
      subtitle: [cleanText(row.status), cleanText(row.priority), cleanText(row.description)].filter(Boolean).join(" - ") || "Reserve chantier",
      href: chantierSectionHref(row, "qualite", "reserveId"),
      badge: "Reserve",
    }),
  },
  {
    table: "chantier_documents",
    select: "id,chantier_id,title,file_name,category,document_type,visibility_mode",
    filter: "title.ilike.$term,file_name.ilike.$term,category.ilike.$term,document_type.ilike.$term,visibility_mode.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "chantier_document",
      title: cleanText(row.title) || cleanText(row.file_name) || "Document chantier sans titre",
      subtitle: [cleanText(row.category), cleanText(row.document_type), cleanText(row.visibility_mode)].filter(Boolean).join(" - ") || "Document chantier",
      href: chantierSectionHref(row, "documents", "documentId"),
      badge: "Document chantier",
    }),
  },
  {
    table: "chantier_visites",
    select: "id,chantier_id,visit_datetime,redactor_email,meteo,avancement_text,observations,safety_points,decisions",
    filter: "redactor_email.ilike.$term,meteo.ilike.$term,avancement_text.ilike.$term,observations.ilike.$term,safety_points.ilike.$term,decisions.ilike.$term",
    map: (row) => {
      const visitDate = cleanText(row.visit_datetime).slice(0, 10);
      return {
        id: cleanText(row.id),
        kind: "chantier_visite",
        title: visitDate ? `Visite chantier du ${visitDate}` : "Visite chantier",
        subtitle: [cleanText(row.avancement_text), cleanText(row.meteo), cleanText(row.observations) || cleanText(row.decisions), cleanText(row.redactor_email)].filter(Boolean).join(" - ") || "Compte rendu de visite chantier",
        href: chantierVisitHref(row),
        badge: "Visite chantier",
      };
    },
  },
  {
    table: "chantier_consignes",
    select: "id,chantier_id,title,description,priority,date_debut,date_fin,task_id,applies_to_all,zone_id",
    filter: "title.ilike.$term,description.ilike.$term,priority.ilike.$term",
    map: (row) => {
      const startDate = cleanText(row.date_debut);
      const endDate = cleanText(row.date_fin);
      const dateLabel = startDate && endDate ? `${startDate} -> ${endDate}` : startDate;
      return {
        id: cleanText(row.id),
        kind: "chantier_consigne",
        title: cleanText(row.title) || "Consigne chantier sans titre",
        subtitle: [cleanText(row.priority), dateLabel, cleanText(row.applies_to_all) === "false" ? "Ciblée" : "Tous intervenants", cleanText(row.description)].filter(Boolean).join(" - ") || "Consigne chantier",
        href: chantierConsigneHref(row),
        badge: "Consigne",
      };
    },
  },
  {
    table: "crm_opportunities",
    select: "id,nom_affaire,stage_key,status",
    filter: "nom_affaire.ilike.$term,stage_key.ilike.$term,status.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "projet",
      title: cleanText(row.nom_affaire) || "Projet commercial sans nom",
      subtitle: [cleanText(row.stage_key), cleanText(row.status)].filter(Boolean).join(" - ") || "Projet commercial",
      href: `/projets/opportunity-${cleanText(row.id)}`,
      badge: "Projet",
    }),
  },
  {
    table: "crm_prospects",
    select: "id,prenom,nom,societe,telephone,email,type_projet,ville,statut",
    filter: "prenom.ilike.$term,nom.ilike.$term,societe.ilike.$term,telephone.ilike.$term,email.ilike.$term,type_projet.ilike.$term,ville.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "prospect",
      title: clientName(row),
      subtitle: [cleanText(row.type_projet), cleanText(row.telephone), cleanText(row.ville)].filter(Boolean).join(" - ") || "Prospect CRM",
      href: `/projets/prospect-${cleanText(row.id)}`,
      badge: "Prospect",
    }),
  },
  {
    table: "crm_clients",
    select: "id,prenom,nom,societe,telephone,mobile,email,ville",
    filter: "prenom.ilike.$term,nom.ilike.$term,societe.ilike.$term,telephone.ilike.$term,mobile.ilike.$term,email.ilike.$term,ville.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "client",
      title: clientName(row),
      subtitle: [cleanText(row.telephone) || cleanText(row.mobile), cleanText(row.email), cleanText(row.ville)].filter(Boolean).join(" - ") || "Client CRM",
      href: clientHref(row),
      badge: "Client",
    }),
  },
  {
    table: "crm_quotes",
    select: "id,quote_number,description,lot,statut,montant_ttc,opportunity_id,prospect_id,client_id",
    filter: "quote_number.ilike.$term,description.ilike.$term,lot.ilike.$term,statut.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "devis",
      title: cleanText(row.quote_number) || "Devis sans numéro",
      subtitle: [cleanText(row.description) || cleanText(row.lot), cleanText(row.statut)].filter(Boolean).join(" - ") || "Devis CRM",
      href: quoteProjectHref(row),
      badge: "Devis",
    }),
  },
  {
    table: "invoices",
    select: "id,type,status,document,source_quote_id,project_id,chantier_id",
    filter: "document->>number.ilike.$term,document->>title.ilike.$term,document->>siteAddress.ilike.$term,document->recipient->>displayName.ilike.$term,status.ilike.$term,type.ilike.$term",
    map: (row) => {
      const id = cleanText(row.id);
      const recipient = documentNestedText(row, "recipient", "displayName");
      const siteAddress = documentText(row, "siteAddress");
      return {
        id,
        kind: "facture",
        title: documentText(row, "number") || "Facture sans numéro",
        subtitle: [recipient, siteAddress, invoiceTypeLabel(row.type), invoiceStatusLabel(row.status), formatSearchCurrency(documentTotalTtc(row))].filter(Boolean).join(" - ") || "Facture",
        href: `/factures?invoice=${encodeURIComponent(id)}`,
        badge: "Facture",
      };
    },
  },
  {
    table: "purchase_orders",
    select: "id,status,document,supplier_name,supplier_reference,expected_delivery_date,delivery_address,project_id,chantier_id",
    filter: "document->>number.ilike.$term,document->>title.ilike.$term,document->recipient->>displayName.ilike.$term,supplier_name.ilike.$term,supplier_reference.ilike.$term,delivery_address.ilike.$term,status.ilike.$term",
    map: (row) => {
      const recipient = documentNestedText(row, "recipient", "displayName");
      const deliveryAddress = cleanText(row.delivery_address) || documentText(row, "siteAddress");
      return {
        id: cleanText(row.id),
        kind: "bon_commande",
        title: documentText(row, "number") || "Bon de commande sans numéro",
        subtitle: [
          cleanText(row.supplier_name) || recipient,
          deliveryAddress,
          cleanText(row.supplier_reference),
          purchaseOrderStatusLabel(row.status),
          formatSearchCurrency(documentTotalTtc(row)),
        ].filter(Boolean).join(" - ") || "Bon de commande fournisseur",
        href: purchaseOrderHref(row),
        badge: "Bon commande",
      };
    },
  },
  {
    table: "terrain_feedbacks",
    select: "id,chantier_id,title,description,category,urgency,status",
    filter: "title.ilike.$term,description.ilike.$term,category.ilike.$term,urgency.ilike.$term,status.ilike.$term",
    map: (row) => {
      const id = cleanText(row.id);
      const chantierId = cleanText(row.chantier_id);
      const params = new URLSearchParams({ feedbackId: id });
      if (chantierId) params.set("chantierId", chantierId);
      return {
        id,
        kind: "retour_terrain",
        title: cleanText(row.title) || "Retour terrain sans titre",
        subtitle: [cleanText(row.category), cleanText(row.urgency), cleanText(row.status)].filter(Boolean).join(" - ") || "Retour terrain",
        href: `/retours-terrain?${params.toString()}`,
        badge: "Retour terrain",
      };
    },
  },
  {
    table: "crm_appointments",
    select: "id,prospect_id,client_id,opportunity_id,type,titre,starts_at,statut,notes,compte_rendu",
    filter: "titre.ilike.$term,type.ilike.$term,statut.ilike.$term,notes.ilike.$term,compte_rendu.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "crm_rdv",
      title: cleanText(row.titre) || appointmentTypeLabel(row.type),
      subtitle: [appointmentTypeLabel(row.type), appointmentStatusLabel(row.statut), cleanText(row.starts_at).slice(0, 10)].filter(Boolean).join(" - ") || "Agenda CRM",
      href: appointmentHref(row),
      badge: appointmentTypeLabel(row.type),
    }),
  },
  {
    table: "crm_sav",
    select: "id,client_id,chantier_id,titre,description,urgence,statut,assigned_to,planned_at",
    filter: "titre.ilike.$term,description.ilike.$term,urgence.ilike.$term,statut.ilike.$term,assigned_to.ilike.$term",
    map: (row) => {
      const id = cleanText(row.id);
      const plannedDate = cleanText(row.planned_at).slice(0, 10);
      return {
        id,
        kind: "sav",
        title: cleanText(row.titre) || "Ticket SAV sans titre",
        subtitle: [savPriorityLabel(row.urgence), cleanText(row.statut), plannedDate, cleanText(row.description)].filter(Boolean).join(" - ") || "Ticket SAV",
        href: `/crm/sav?savId=${encodeURIComponent(id)}`,
        badge: "SAV",
      };
    },
  },
  {
    table: "apporteurs_affaires",
    select: "id,nom,entreprise,type,telephone,email,active",
    filter: "nom.ilike.$term,entreprise.ilike.$term,type.ilike.$term,telephone.ilike.$term,email.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "apporteur",
      title: cleanText(row.nom) || "Apporteur sans nom",
      subtitle: [cleanText(row.entreprise), cleanText(row.telephone) || cleanText(row.email), cleanText(row.active) === "false" ? "Inactif" : "Actif"].filter(Boolean).join(" - ") || "Apporteur d'affaires",
      href: apporteurHref(row),
      badge: "Apporteur",
    }),
  },
  {
    table: "apporteur_leads",
    select: "id,apporteur_id,client_name,telephone,project_address,project_type,status,crm_opportunity_id,crm_prospect_id",
    filter: "client_name.ilike.$term,telephone.ilike.$term,project_address.ilike.$term,project_type.ilike.$term,status.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "lead_apporteur",
      title: cleanText(row.client_name) || "Client apporteur sans nom",
      subtitle: [cleanText(row.project_type), cleanText(row.project_address), cleanText(row.status)].filter(Boolean).join(" - ") || "Projet apporté",
      href: apporteurLeadHref(row),
      badge: "Projet apporté",
    }),
  },
  {
    table: "intervenants",
    select: "id,nom,entreprise,metier,email,telephone,user_id,archived_at",
    filter: "nom.ilike.$term,entreprise.ilike.$term,metier.ilike.$term,email.ilike.$term,telephone.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "intervenant",
      title: cleanText(row.nom) || "Intervenant sans nom",
      subtitle: [cleanText(row.metier), cleanText(row.entreprise), cleanText(row.telephone) || cleanText(row.email), intervenantAccessLabel(row)].filter(Boolean).join(" - ") || "Profil et accès",
      href: `/intervenants/${encodeURIComponent(cleanText(row.id))}`,
      badge: "Intervenant",
    }),
  },
  {
    table: "suppliers",
    select: "id,name,specialty,address,city,phone,email,is_active",
    filter: "name.ilike.$term,specialty.ilike.$term,address.ilike.$term,city.ilike.$term,phone.ilike.$term,email.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "fournisseur",
      title: cleanText(row.name) || "Fournisseur sans nom",
      subtitle: [cleanText(row.specialty), cleanText(row.city), cleanText(row.phone) || cleanText(row.email), supplierStatusLabel(row.is_active)].filter(Boolean).join(" - ") || "Fournisseur",
      href: supplierHref(row),
      badge: "Fournisseur",
    }),
  },
  {
    table: "task_templates",
    select: "id,titre,lot,unite,remarques,temps_prevu_par_unite_h,cout_reference_unitaire_ht",
    filter: "titre.ilike.$term,lot.ilike.$term,unite.ilike.$term,remarques.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "modele_tache",
      title: cleanText(row.titre) || "Modèle de tâche sans titre",
      subtitle: [
        cleanText(row.lot),
        cleanText(row.unite),
        Number(row.temps_prevu_par_unite_h) > 0 ? `${row.temps_prevu_par_unite_h} h/u` : "",
        Number(row.cout_reference_unitaire_ht) > 0 ? `${formatSearchCurrency(Number(row.cout_reference_unitaire_ht))} HT` : "",
        cleanText(row.remarques),
      ].filter(Boolean).join(" - ") || "Bibliothèque de tâches",
      href: taskTemplateHref(row),
      badge: "Modèle tâche",
    }),
  },
  {
    table: "product_catalog_items",
    select: "id,designation,internal_reference,manufacturer_reference,brand,category,unit,main_supplier_name,standard_purchase_price_ht,recommended_sale_price_ht",
    filter: "designation.ilike.$term,internal_reference.ilike.$term,manufacturer_reference.ilike.$term,brand.ilike.$term,category.ilike.$term,main_supplier_name.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "produit",
      title: cleanText(row.designation) || "Produit sans désignation",
      subtitle: [
        cleanText(row.internal_reference) || cleanText(row.manufacturer_reference),
        cleanText(row.brand),
        cleanText(row.category),
        cleanText(row.main_supplier_name),
        productPriceLabel(row),
      ].filter(Boolean).join(" - ") || "Catalogue produits",
      href: productCatalogHref(row),
      badge: "Produit",
    }),
  },
];

export async function searchGlobalBatipro(rawQuery: string): Promise<GlobalSearchResult[]> {
  const query = normalizeQuery(rawQuery);
  if (query.length < 2) return [];

  const batches = await Promise.all(SOURCES.map((source) => querySource(source, query)));
  const seen = new Set<string>();
  return batches
    .flat()
    .filter((result) => {
      const key = `${result.kind}:${result.id}`;
      if (!result.id || seen.has(key)) return false;
      seen.add(key);
      return searchableText(result).includes(query.toLocaleLowerCase("fr-FR"));
    })
    .sort((a, b) => resultRank(a, query) - resultRank(b, query) || a.title.localeCompare(b.title, "fr"))
    .slice(0, 8);
}
