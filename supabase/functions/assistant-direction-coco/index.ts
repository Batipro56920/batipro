import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `Tu es l’assistant IA de direction du compte admin COCO dans Batipro.

Tu es le bras droit du dirigeant d’une entreprise de rénovation / bâtiment.
Ton objectif principal est d’aider à piloter l’entreprise avec anticipation, rigueur et vision globale.

Mot clé central : ANTICIPATION.

Tu aides COCO à anticiper :
- le chiffre d’affaires
- la trésorerie si les données existent
- la charge de travail
- les chantiers à venir
- les chantiers en cours
- l’avancement réel des chantiers
- les écarts entre planning prévu et réalité terrain
- les risques de sous-charge ou surcharge
- les besoins en prospection
- les besoins en matériel
- les besoins en main-d’œuvre
- les besoins d’embauche ou de sous-traitance
- les retards chantier
- les dérives de temps
- les impacts sur marge
- les impacts sur planning
- les impacts sur trésorerie
- les priorités commerciales
- les décisions de gestion

Tu peux analyser les données Batipro disponibles sur :
- CRM
- prospects
- clients
- projets commerciaux
- devis
- chantiers signés
- chantiers en préparation
- chantiers en cours
- avancement chantier
- planning
- tâches
- temps prévus
- temps passés
- intervenants
- sous-traitants
- matériel
- achats
- fournisseurs
- documents
- réserves
- SAV
- statistiques
- paramètres entreprise

Ta mission est d’aider le dirigeant à prendre de meilleures décisions avant que les problèmes arrivent.

Tu dois notamment répondre à ces questions :
- Est-ce qu’on a assez de travail dans les semaines/mois à venir ?
- Est-ce qu’on doit relancer la prospection ?
- Quels devis doivent être relancés en priorité ?
- Quels chantiers risquent de prendre du retard ?
- Quels chantiers sont déjà en retard ?
- Quels chantiers avancent moins vite que prévu ?
- Quelles tâches bloquent l’avancement ?
- Quels chantiers risquent de coûter plus cher que prévu ?
- Quel retard risque d’impacter les chantiers suivants ?
- Faut-il replanifier, relancer un fournisseur, renforcer l’équipe, sous-traiter ou embaucher ?

Règles strictes :
- Tu analyses et tu recommandes, mais tu ne modifies jamais les données Batipro.
- Tu distingues les faits issus des données, les risques probables et les hypothèses.
- Tu ne prétends jamais disposer d’une donnée absente du contexte.
- Quand une donnée manque, tu expliques l’impact métier de cette absence.
- Tu réponds en français, de façon structurée, directe et exploitable par un dirigeant.
- Termine par 3 à 6 priorités concrètes, classées par urgence.`;

type ChatRole = "user" | "assistant";
type ChatMessage = {
  role?: ChatRole;
  content?: string;
};

type RequestBody = {
  message?: string;
  history?: ChatMessage[];
};

type ProfileRow = {
  role?: string | null;
  display_name?: string | null;
  feature_permissions?: Record<string, unknown> | null;
};

type AccessResult = {
  allowed: boolean;
  status: number;
  error: string | null;
  userId: string | null;
  email: string | null;
  admin: any | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name) ?? "";
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function optionalEnv(name: string) {
  return String(Deno.env.get(name) ?? "").trim();
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeLower(value: unknown) {
  return normalizeText(value).toLowerCase();
}

function getBearerToken(req: Request) {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function normalizeMessage(value: unknown, maxLength: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sanitizeHistory(history: unknown): Array<{ role: ChatRole; content: string }> {
  if (!Array.isArray(history)) return [];
  return history
    .map((entry) => {
      const row = (entry ?? {}) as ChatMessage;
      const role = row.role === "assistant" ? "assistant" : row.role === "user" ? "user" : null;
      const content = normalizeMessage(row.content, 2400);
      if (!role || !content) return null;
      return { role, content };
    })
    .filter((entry): entry is { role: ChatRole; content: string } => Boolean(entry))
    .slice(-10);
}

function envSet(names: string[]) {
  const values = names.flatMap((name) => optionalEnv(name).split(","));
  return new Set(values.map((value) => normalizeLower(value)).filter(Boolean));
}

function isAdminProfile(profile: ProfileRow | null) {
  return normalizeLower(profile?.role) === "admin";
}

function isCocoProfile(profile: ProfileRow | null, email: string | null, userId: string | null) {
  if (!isAdminProfile(profile)) return false;
  const allowedEmails = envSet(["COCO_ADMIN_EMAILS", "OPENAI_COCO_ADMIN_EMAILS"]);
  const allowedUserIds = envSet(["COCO_ADMIN_USER_IDS"]);
  const normalizedEmail = normalizeLower(email);
  const normalizedUserId = normalizeLower(userId);
  const displayName = normalizeLower(profile?.display_name);

  if (normalizedEmail && allowedEmails.has(normalizedEmail)) return true;
  if (normalizedUserId && allowedUserIds.has(normalizedUserId)) return true;
  return displayName.includes("coco") || normalizedEmail.includes("coco") || displayName.includes("corentin") || normalizedEmail.includes("corentin");
}

function isMissingSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (["42P01", "42703", "PGRST205"].includes(code)) return true;
  return msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find");
}

async function safeQuery<T>(query: PromiseLike<{ data: T | null; error: any }>, fallback: T): Promise<T> {
  const result = await query;
  if (!result.error) return result.data ?? fallback;
  if (isMissingSchemaError(result.error)) return fallback;
  throw result.error;
}

function limitRows<T>(rows: T[], limit: number): T[] {
  return rows.slice(0, limit);
}

function countBy<T>(rows: T[], getKey: (row: T) => string | null | undefined) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const key = normalizeText(getKey(row) ?? "non_renseigne") || "non_renseigne";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function parseDate(value: unknown): number | null {
  const text = normalizeText(value);
  if (!text) return null;
  const timestamp = Date.parse(text.length === 10 ? `${text}T00:00:00Z` : text);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function summarizeContext(raw: Record<string, any[]>) {
  const now = Date.now();
  const in30Days = now + 30 * 24 * 60 * 60 * 1000;
  const chantiers = raw.chantiers ?? [];
  const tasks = raw.chantier_tasks ?? [];
  const timeEntries = raw.chantier_time_entries ?? [];
  const materialRequests = raw.materiel_demandes ?? [];
  const reserves = raw.chantier_reserves ?? [];
  const quotes = raw.crm_quotes ?? [];
  const opportunities = raw.crm_opportunities ?? [];
  const crmTasks = raw.crm_tasks ?? [];
  const expenses = raw.chantier_financial_expenses ?? [];
  const billings = raw.chantier_client_billings ?? [];

  const activeChantiers = chantiers.filter((row) => !["TERMINE", "ARCHIVE", "ANNULE"].includes(normalizeText(row.status).toUpperCase()));
  const lateChantiers = activeChantiers.filter((row) => {
    const end = parseDate(row.planning_end_date ?? row.date_fin_prevue);
    return end !== null && end < now && numberValue(row.avancement) < 100;
  });
  const upcomingChantiers = activeChantiers.filter((row) => {
    const start = parseDate(row.planning_start_date ?? row.date_debut);
    return start !== null && start >= now && start <= in30Days;
  });
  const lateTasks = tasks.filter((row) => {
    const due = parseDate(row.date_fin ?? row.date ?? row.date_debut);
    const status = normalizeText(row.status).toUpperCase();
    const quality = normalizeLower(row.quality_status);
    return due !== null && due < now && status !== "FAIT" && !["termine_intervenant", "valide_admin"].includes(quality);
  });
  const blockedTasks = tasks.filter((row) => ["a_reprendre", "bloque", "bloquee"].includes(normalizeLower(row.quality_status ?? row.status)));
  const pendingMaterials = materialRequests.filter((row) => !["livree", "refusee"].includes(normalizeLower(row.statut ?? row.status)));
  const openReserves = reserves.filter((row) => !["LEVEE", "CLOTUREE", "FERMEE"].includes(normalizeText(row.status).toUpperCase()));
  const quotesToFollow = quotes.filter((row) => ["envoye", "envoyé", "attente_signature", "a_relancer"].includes(normalizeLower(row.statut ?? row.signature_status)));
  const overdueCrmTasks = crmTasks.filter((row) => {
    const due = parseDate(row.due_at);
    return due !== null && due < now && normalizeLower(row.statut) !== "termine";
  });

  const plannedHours = chantiers.reduce((sum, row) => sum + numberValue(row.heures_prevues), 0);
  const spentHours = chantiers.reduce((sum, row) => sum + numberValue(row.heures_passees), 0);
  const timeEntryHours = timeEntries.reduce((sum, row) => sum + numberValue(row.duration_hours), 0);
  const signedRevenueTtc = chantiers.reduce((sum, row) => sum + numberValue(row.signed_quote_amount_ttc), 0);
  const openQuotesTtc = quotesToFollow.reduce((sum, row) => sum + numberValue(row.montant_ttc), 0);
  const expensesTotal = expenses.reduce((sum, row) => sum + numberValue(row.amount_ht ?? row.total_ht), 0);
  const billingsTtc = billings.reduce((sum, row) => sum + numberValue(row.amount_ttc ?? row.total_ttc), 0);

  return {
    generated_at: new Date().toISOString(),
    counts: {
      chantiers: chantiers.length,
      active_chantiers: activeChantiers.length,
      upcoming_chantiers_30_days: upcomingChantiers.length,
      late_chantiers: lateChantiers.length,
      tasks: tasks.length,
      late_tasks: lateTasks.length,
      blocked_tasks: blockedTasks.length,
      pending_material_requests: pendingMaterials.length,
      open_reserves: openReserves.length,
      quotes_to_follow: quotesToFollow.length,
      opportunities: opportunities.length,
      overdue_crm_tasks: overdueCrmTasks.length,
    },
    status_distribution: {
      chantiers: countBy(chantiers, (row) => row.status),
      tasks: countBy(tasks, (row) => row.status),
      quotes: countBy(quotes, (row) => row.statut),
      materials: countBy(materialRequests, (row) => row.statut ?? row.status),
    },
    totals: {
      planned_hours_from_chantiers: plannedHours,
      spent_hours_from_chantiers: spentHours,
      spent_hours_from_time_entries: timeEntryHours,
      hours_gap: spentHours - plannedHours,
      signed_revenue_ttc_from_chantiers: signedRevenueTtc,
      open_quotes_ttc: openQuotesTtc,
      chantier_expenses_ht: expensesTotal,
      chantier_billings_ttc: billingsTtc,
    },
    watchlists: {
      late_chantiers: limitRows(lateChantiers, 8),
      upcoming_chantiers_30_days: limitRows(upcomingChantiers, 8),
      late_tasks: limitRows(lateTasks, 12),
      blocked_tasks: limitRows(blockedTasks, 12),
      pending_material_requests: limitRows(pendingMaterials, 12),
      open_reserves: limitRows(openReserves, 12),
      quotes_to_follow: limitRows(quotesToFollow, 12),
      overdue_crm_tasks: limitRows(overdueCrmTasks, 12),
    },
  };
}

function extractOutputText(payload: any) {
  const direct = String(payload?.output_text ?? "").trim();
  if (direct) return direct;

  const parts: string[] = [];
  for (const item of Array.isArray(payload?.output) ? payload.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      const text = String(content?.text ?? content?.output_text ?? "").trim();
      if (text) parts.push(text);
    }
  }
  return parts.join("\n").trim();
}

async function assertCocoAccess(req: Request): Promise<AccessResult> {
  const token = getBearerToken(req);
  if (!token) return { allowed: false, status: 401, error: "Session utilisateur manquante.", userId: null, email: null, admin: null };

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const userId = userData.user?.id ?? null;
  const email = userData.user?.email ?? null;
  if (userError || !userId) return { allowed: false, status: 401, error: "Session utilisateur invalide.", userId: null, email: null, admin: null };

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, display_name, feature_permissions")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) return { allowed: false, status: 500, error: "Lecture du profil impossible.", userId, email, admin: null };
  if (!isCocoProfile(profile as ProfileRow | null, email, userId)) {
    return { allowed: false, status: 403, error: "Assistant Direction COCO réservé au compte admin COCO.", userId, email, admin: null };
  }

  return { allowed: true, status: 200, error: null, userId, email, admin };
}

async function loadBatiproContext(admin: any, organizationId: string) {
  const [
    companySettings,
    chantiers,
    tasks,
    timeEntries,
    materialRequests,
    reserves,
    purchaseRequests,
    quotes,
    opportunities,
    crmTasks,
    prospects,
    suppliers,
    expenses,
    billings,
  ] = await Promise.all([
    safeQuery(admin.from("company_settings").select("company_name, address, phone, email").eq("organization_id", organizationId).maybeSingle(), null),
    safeQuery(admin.from("chantiers").select("id, nom, client, status, avancement, date_debut, date_fin_prevue, planning_start_date, planning_end_date, heures_prevues, heures_passees, signed_quote_amount_ht, signed_quote_amount_ttc, budget_labor_planned_ht, budget_materials_planned_ht, budget_subcontracting_planned_ht, created_at").order("created_at", { ascending: false }).limit(80), []),
    safeQuery(admin.from("chantier_tasks").select("id, chantier_id, titre, status, quality_status, reprise_reason, date, date_debut, date_fin, temps_prevu_h, temps_reel_h, duration_days, progress_override_percent, updated_at, created_at").order("updated_at", { ascending: false }).limit(200), []),
    safeQuery(admin.from("chantier_time_entries").select("id, chantier_id, task_id, intervenant_id, duration_hours, progress_percent, quantite_realisee, entry_date, created_at").order("created_at", { ascending: false }).limit(200), []),
    safeQuery(admin.from("materiel_demandes").select("id, chantier_id, titre, designation, statut, status, quantite, unite, created_at").order("created_at", { ascending: false }).limit(120), []),
    safeQuery(admin.from("chantier_reserves").select("id, chantier_id, title, priority, status, created_at").order("created_at", { ascending: false }).limit(120), []),
    safeQuery(admin.from("chantier_purchase_requests").select("id, chantier_id, titre, statut_commande, livraison_prevue_le, created_at").order("created_at", { ascending: false }).limit(120), []),
    safeQuery(admin.from("crm_quotes").select("id, quote_number, statut, signature_status, montant_ht, montant_ttc, marge_estimee, valid_until, chantier_id, client_id, opportunity_id, created_at, updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(120), []),
    safeQuery(admin.from("crm_opportunities").select("id, nom_affaire, montant_estime, probabilite, stage_key, status, echeance, prochaine_action, prochaine_action_date, created_at, updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(120), []),
    safeQuery(admin.from("crm_tasks").select("id, titre, type, statut, priorite, due_at, quote_id, opportunity_id, created_at, updated_at").eq("organization_id", organizationId).order("due_at", { ascending: true }).limit(120), []),
    safeQuery(admin.from("crm_prospects").select("id, statut, budget_estime, urgence, type_projet, created_at, updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false }).limit(120), []),
    safeQuery(admin.from("suppliers").select("id, name, specialty, is_active, created_at").eq("organization_id", organizationId).order("name", { ascending: true }).limit(120), []),
    safeQuery(admin.from("chantier_financial_expenses").select("id, chantier_id, category, status, amount_ht, total_ht, created_at").order("created_at", { ascending: false }).limit(160), []),
    safeQuery(admin.from("chantier_client_billings").select("id, chantier_id, type, payment_status, amount_ttc, total_ttc, due_date, paid_amount_ttc, created_at").order("created_at", { ascending: false }).limit(160), []),
  ]);

  const raw = {
    chantiers,
    chantier_tasks: tasks,
    chantier_time_entries: timeEntries,
    materiel_demandes: materialRequests,
    chantier_reserves: reserves,
    chantier_purchase_requests: purchaseRequests,
    crm_quotes: quotes,
    crm_opportunities: opportunities,
    crm_tasks: crmTasks,
    crm_prospects: prospects,
    suppliers,
    chantier_financial_expenses: expenses,
    chantier_client_billings: billings,
  };

  return {
    company: companySettings,
    summary: summarizeContext(raw),
    samples: raw,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const access = await assertCocoAccess(req);
  if (!access.allowed) return json({ error: access.error }, access.status);

  const message = normalizeMessage(body.message, 4000);
  if (!message) return json({ error: "Message manquant." }, 400);

  const context = await loadBatiproContext(access.admin, access.userId!);
  const history = sanitizeHistory(body.history).filter((entry) => entry.content !== message);
  const openAiKey = requireEnv("OPENAI_API_KEY");
  const model = optionalEnv("OPENAI_DIRECTION_COCO_MODEL") || optionalEnv("OPENAI_MODEL") || "gpt-4.1-mini";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions: SYSTEM_PROMPT,
      input: [
        ...history,
        {
          role: "user",
          content: [
            `Question de COCO : ${message}`,
            "",
            "Contexte Batipro réel disponible au moment de la demande :",
            JSON.stringify(context, null, 2),
          ].join("\n"),
        },
      ],
      temperature: 0.2,
      max_output_tokens: 1300,
    }),
  });

  if (!response.ok) return json({ error: "OpenAI request failed" }, 502);

  const data = await response.json();
  const reply = extractOutputText(data);
  if (!reply) return json({ error: "Réponse vide de l’assistant direction." }, 502);

  return json({ reply, summary: context.summary });
});
