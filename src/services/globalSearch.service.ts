import { supabase } from "../lib/supabaseClient";

export type GlobalSearchKind =
  | "chantier"
  | "projet"
  | "prospect"
  | "client"
  | "devis"
  | "retour_terrain"
  | "apporteur"
  | "lead_apporteur";

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

function clientName(row: SearchRow) {
  return [cleanText(row.prenom), cleanText(row.nom)].filter(Boolean).join(" ") || cleanText(row.societe) || "Client sans nom";
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

function quoteProjectHref(row: SearchRow) {
  const opportunityId = cleanText(row.opportunity_id);
  const prospectId = cleanText(row.prospect_id);
  const clientId = cleanText(row.client_id);

  if (opportunityId) return `/projets/opportunity-${opportunityId}?tab=quotes`;
  if (prospectId) return `/projets/prospect-${prospectId}?tab=quotes`;
  if (clientId) return `/projets/client-${clientId}?tab=quotes`;
  return "/crm/devis";
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
      href: "/crm/clients",
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
    table: "terrain_feedbacks",
    select: "id,chantier_id,title,description,category,urgency,status",
    filter: "title.ilike.$term,description.ilike.$term,category.ilike.$term,urgency.ilike.$term,status.ilike.$term",
    map: (row) => {
      const chantierId = cleanText(row.chantier_id);
      return {
        id: cleanText(row.id),
        kind: "retour_terrain",
        title: cleanText(row.title) || "Retour terrain sans titre",
        subtitle: [cleanText(row.category), cleanText(row.urgency), cleanText(row.status)].filter(Boolean).join(" - ") || "Retour terrain",
        href: chantierId ? `/retours-terrain?chantierId=${chantierId}` : "/retours-terrain",
        badge: "Retour terrain",
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
      href: "/crm/apporteurs",
      badge: "Apporteur",
    }),
  },
  {
    table: "apporteur_leads",
    select: "id,client_name,telephone,project_address,project_type,status",
    filter: "client_name.ilike.$term,telephone.ilike.$term,project_address.ilike.$term,project_type.ilike.$term,status.ilike.$term",
    map: (row) => ({
      id: cleanText(row.id),
      kind: "lead_apporteur",
      title: cleanText(row.client_name) || "Client apporteur sans nom",
      subtitle: [cleanText(row.project_type), cleanText(row.project_address), cleanText(row.status)].filter(Boolean).join(" - ") || "Projet apporté",
      href: "/crm/apporteurs",
      badge: "Projet apporté",
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
