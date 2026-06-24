import { supabase } from "../lib/supabaseClient";
import { getCurrentUserProfile, isAdminProfile, type CurrentUserProfile } from "./currentUserProfile.service";
import { findBestTaskTemplateMatch, list as listTaskTemplates, type TaskTemplateRow } from "./taskLibrary.service";
import { listSuppliers, type SupplierRow } from "./suppliers.service";

export type CocoDirectionChatMessage = { role: "user" | "assistant"; content: string };
export type CocoDirectionRisk = { id: string; level: "danger" | "warning" | "info"; title: string; detail: string; module: string };
export type CocoAssistantDraftKind = "visit_quote_analysis" | "quote" | "tasks" | "planning" | "materials" | "purchase_order" | "commercial_action" | "checklist";
export type CocoDraftConfidence = "haute" | "moyenne" | "faible";
export type CocoVisitQuoteDraftLine = {
  title: string;
  lot: string | null;
  unit: string | null;
  quantity: number;
  estimatedHours: number | null;
  unitPriceHt: number | null;
  totalHt: number | null;
  templateId: string | null;
  templateTitle: string | null;
  source: string;
  confidence: CocoDraftConfidence;
  assumptions: string[];
  pointsToVerify: string[];
};
export type CocoMaterialNeedDraft = {
  designation: string;
  quantity: number | null;
  unit: string | null;
  supplierId: string | null;
  supplierName: string | null;
  source: string;
  confidence: CocoDraftConfidence;
  pointsToVerify: string[];
};
export type CocoDraftAction = {
  label: string;
  module: string;
  actionType: "prepare" | "review" | "validate" | "ignore";
  requiresAdminValidation: boolean;
  detail: string;
};
export type CocoControlledDraft = {
  id: string;
  kind: CocoAssistantDraftKind;
  title: string;
  generatedAt: string;
  sourceSummary: string[];
  confidence: CocoDraftConfidence;
  hypotheses: string[];
  pointsToVerify: string[];
  risks: string[];
  quoteLines: CocoVisitQuoteDraftLine[];
  materialNeeds: CocoMaterialNeedDraft[];
  proposedActions: CocoDraftAction[];
  adminValidationRequired: true;
  finalWriteBlocked: true;
};
export type CocoDirectionContext = {
  generatedAt: string;
  profile: { displayName: string | null; email: string | null };
  summary: Record<string, number>;
  risks: CocoDirectionRisk[];
  datasets: Record<string, Array<Record<string, unknown>>>;
};

const PROFILE_PERMISSION_KEY = "assistant_coco_direction";

export const COCO_ASSISTANT_ARCHITECTURE = [
  { id: "direction", label: "Assistant Direction COCO", scope: "Pilotage global, anticipation, priorites, carnet de commandes, charge equipe et risques dirigeant." },
  { id: "chiffrage", label: "Assistant Chiffrage", scope: "Analyse visite, notes, photos, bibliotheque Batipro, pre-devis, temps et materiaux en brouillon." },
  { id: "preparation", label: "Assistant Preparation chantier", scope: "Taches, zones, documents, checklists et planning previsionnel, sans ecrire dans le planning officiel." },
  { id: "achats", label: "Assistant Achats", scope: "Besoins materiaux, fournisseurs habituels et bons de commande fournisseurs en brouillon." },
  { id: "suivi", label: "Assistant Suivi chantier", scope: "Retards, derives, reserves, retours terrain et actions correctives proposees." },
  { id: "commercial", label: "Assistant Commercial", scope: "Relances, devis a suivre, pipeline, periodes creuses et actions CRM proposees." },
] as const;

export const COCO_SPECIALIZED_SYSTEM_PROMPTS = {
  direction: "Raisonner comme bras droit dirigeant Batipro. Distinguer faits, hypotheses et actions. Ne jamais modifier sans validation admin.",
  chiffrage: "Analyser une visite de chiffrage Batipro. Produire des lignes de pre-devis, temps, materiaux, fournisseurs, risques et points a verifier. Tout reste brouillon validable.",
  preparation: "Preparer un chantier Batipro a partir d'un devis ou d'une visite. Proposer taches, zones, documents, checklist et planning previsionnel en brouillon uniquement.",
  achats: "Identifier les besoins d'achat Batipro, fournisseurs possibles et bons de commande brouillons. Ne jamais passer commande sans validation admin.",
  suivi: "Analyser chantiers, retards, reserves et retours terrain. Proposer actions correctives tracables sans modifier les donnees finales.",
  commercial: "Analyser CRM, devis et pipeline Batipro. Proposer relances et actions commerciales brouillons, sans envoyer de message client sans validation.",
} as const;

export const COCO_DIRECTION_QUICK_QUESTIONS = [
  { label: "Point hebdomadaire entreprise", prompt: "Fais-moi un point hebdomadaire de direction avec priorités, risques et décisions à prendre." },
  { label: "Carnet de commandes suffisant ?", prompt: "Analyse si le carnet de commandes semble suffisant pour les prochaines semaines et où relancer la prospection." },
  { label: "Devis à relancer", prompt: "Quels devis faut-il relancer en priorité et pourquoi ?" },
  { label: "Chantiers à risque", prompt: "Quels chantiers sont à risque ou susceptibles de prendre du retard ?" },
  { label: "Tâches bloquées ou en dérive", prompt: "Quelles tâches bloquent l'avancement ou dérivent par rapport au prévu ?" },
  { label: "Avancement réel vs prévu", prompt: "Compare l'avancement réel avec le planning et les temps prévus quand les données existent." },
  { label: "Charge planning à venir", prompt: "Analyse la charge planning à venir et les risques de surcharge ou sous-charge." },
  { label: "Besoins humains", prompt: "Dis-moi si l'entreprise risque d'avoir besoin de renfort, embauche ou sous-traitance." },
  { label: "Besoins matériel", prompt: "Quels besoins matériel ou fournisseurs peuvent bloquer les chantiers ?" },
  { label: "Impact retards prochains chantiers", prompt: "Quels retards actuels risquent de désorganiser les chantiers suivants ?" },
  { label: "Prévision CA", prompt: "Fais une lecture de prévision de chiffre d'affaires à partir des devis, chantiers et factures disponibles." },
  { label: "Priorités de la semaine", prompt: "Donne-moi les priorités de gestion de la semaine, classées par impact." },
] as const;

function text(value: unknown): string | null {
  const cleaned = String(value ?? "").trim();
  return cleaned || null;
}

function number(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function dateTime(value: unknown): number {
  const valueText = text(value);
  if (!valueText) return Number.NaN;
  const parsed = Date.parse(valueText.length <= 10 ? `${valueText}T00:00:00` : valueText);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isMissingSchemaError(error: unknown): boolean {
  const code = String((error as { code?: string } | null)?.code ?? "");
  const message = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return ["42P01", "42703", "PGRST205"].includes(code) || message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find");
}

async function safeRows(query: PromiseLike<{ data: Array<Record<string, unknown>> | null; error: unknown }>) {
  const result = await query;
  if (!result.error) return result.data ?? [];
  if (isMissingSchemaError(result.error)) return [];
  throw result.error;
}

function isCocoPermissionDisabled(profile: CurrentUserProfile | null): boolean {
  return profile?.feature_permissions?.[PROFILE_PERMISSION_KEY] === false;
}

export function isCocoAdminProfile(profile: CurrentUserProfile | null): boolean {
  return isAdminProfile(profile) && !isCocoPermissionDisabled(profile);
}

export async function isCurrentUserCocoAdmin(): Promise<boolean> {
  return isCocoAdminProfile(await getCurrentUserProfile());
}

export async function loadCocoDirectionContext(): Promise<CocoDirectionContext> {
  const profile = await getCurrentUserProfile();
  if (!isCocoAdminProfile(profile)) throw new Error("Assistant Direction COCO réservé aux administrateurs.");

  const today = new Date().toISOString().slice(0, 10);
  const todayTime = dateTime(today);
  const chantiers = await safeRows((supabase as any).from("chantiers").select("id, nom, client, status, avancement, date_debut, date_fin_prevue, planning_start_date, planning_end_date, heures_prevues, heures_passees, signed_quote_amount_ht, signed_quote_amount_ttc, budget_labor_planned_ht, budget_materials_planned_ht, budget_subcontracting_planned_ht, created_at").order("created_at", { ascending: false }).limit(80));
  const chantierIds = chantiers.map((row) => String(row.id ?? "")).filter(Boolean);
  const [tasks, timeEntries, materialRequests] = chantierIds.length ? await Promise.all([
    safeRows((supabase as any).from("chantier_tasks").select("id, chantier_id, titre, status, quality_status, admin_validation_status, priorite, date, date_debut, date_fin, temps_prevu_h, temps_reel_h, progress_admin_offset_percent, montant_total_devis_ht, cout_estime_ht, cout_matiere_estime_ht, cout_mo_estime_ht, intervenant_id, updated_at, created_at").in("chantier_id", chantierIds).order("updated_at", { ascending: false }).limit(300)),
    safeRows((supabase as any).from("chantier_time_entries").select("id, chantier_id, task_id, intervenant_id, work_date, duration_hours, quantite_realisee, created_at").in("chantier_id", chantierIds).order("work_date", { ascending: false }).limit(300)),
    safeRows((supabase as any).from("materiel_demandes").select("id, chantier_id, task_id, titre, designation, quantite, unite, statut, status, date_souhaitee, date_livraison, created_at").in("chantier_id", chantierIds).order("created_at", { ascending: false }).limit(200)),
  ]) : [[], [], []];
  const [quotes, opportunities, invoices] = await Promise.all([
    safeRows((supabase as any).from("crm_quotes").select("id, quote_number, statut, date_emission, valid_until, montant_ht, montant_ttc, marge_estimee, sent_at, last_reminder_at, accepted_at, refused_at, chantier_id, created_at, updated_at").order("updated_at", { ascending: false }).limit(120)),
    safeRows((supabase as any).from("crm_opportunities").select("id, nom_affaire, stage_key, montant_estime, probabilite, echeance, prochaine_action, prochaine_action_date, status, chantier_id, created_at, updated_at").order("updated_at", { ascending: false }).limit(120)),
    safeRows((supabase as any).from("invoices").select("id, type, status, document, payments, source_quote_id, project_id, chantier_id, created_at, updated_at").order("created_at", { ascending: false }).limit(120)),
  ]);

  const activeChantiers = chantiers.filter((row) => !["TERMINE", "ARCHIVE", "ANNULE"].includes(String(row.status ?? "").toUpperCase()));
  const lateChantiers = activeChantiers.filter((row) => {
    const endTime = dateTime(row.date_fin_prevue ?? row.planning_end_date);
    return Number.isFinite(endTime) && endTime < todayTime && number(row.avancement) < 100;
  });
  const openTasks = tasks.filter((row) => String(row.status ?? "").toUpperCase() !== "FAIT");
  const lateTasks = openTasks.filter((row) => {
    const dueTime = dateTime(row.date_fin ?? row.date ?? row.date_debut);
    return Number.isFinite(dueTime) && dueTime < todayTime;
  });
  const blockedTasks = openTasks.filter((row) => ["a_reprendre", "bloquee", "bloque"].includes(String(row.quality_status ?? "").toLowerCase()));
  const pendingMaterialRequests = materialRequests.filter((row) => !["livree", "refusee", "livre", "refuse"].includes(String(row.statut ?? row.status ?? "").toLowerCase()));
  const openQuotes = quotes.filter((row) => !["accepte", "refuse", "expire", "annule"].includes(String(row.statut ?? "").toLowerCase()));
  const quotesToFollowUp = openQuotes.filter((row) => {
    const referenceTime = dateTime(row.last_reminder_at) || dateTime(row.sent_at ?? row.date_emission ?? row.created_at);
    return Number.isFinite(referenceTime) && todayTime - referenceTime > 7 * 24 * 60 * 60 * 1000;
  });
  const openOpportunities = opportunities.filter((row) => !["gagnee", "gagne", "perdue", "perdu", "archive"].includes(String(row.status ?? "").toLowerCase()));
  const plannedHours = chantiers.reduce((sum, row) => sum + number(row.heures_prevues), 0) + tasks.reduce((sum, row) => sum + number(row.temps_prevu_h), 0);
  const spentHours = chantiers.reduce((sum, row) => sum + number(row.heures_passees), 0) + timeEntries.reduce((sum, row) => sum + number(row.duration_hours), 0);
  const risks: CocoDirectionRisk[] = [];

  lateChantiers.slice(0, 6).forEach((chantier) => risks.push({ id: `chantier-late-${chantier.id}`, level: "danger", title: "Chantier en retard", detail: `${text(chantier.nom) ?? "Chantier"} devait finir le ${text(chantier.date_fin_prevue ?? chantier.planning_end_date) ?? "date prévue inconnue"} avec ${Math.round(number(chantier.avancement))}% d'avancement.`, module: "Chantiers" }));
  if (lateTasks.length) risks.push({ id: "late-tasks", level: "warning", title: "Tâches en retard", detail: `${lateTasks.length} tâche(s) non terminée(s) ont une échéance dépassée.`, module: "Tâches" });
  if (plannedHours > 0 && spentHours > plannedHours * 0.9) risks.push({ id: "time-drift", level: spentHours > plannedHours ? "danger" : "warning", title: "Dérive de temps", detail: `${Math.round(spentHours)} h consommées pour ${Math.round(plannedHours)} h prévues.`, module: "Temps" });
  if (pendingMaterialRequests.length) risks.push({ id: "material-pending", level: "warning", title: "Matériel à sécuriser", detail: `${pendingMaterialRequests.length} demande(s) matériel non livrée(s) ou non refusée(s).`, module: "Matériel" });
  if (quotesToFollowUp.length) risks.push({ id: "quotes-follow-up", level: "info", title: "Devis à relancer", detail: `${quotesToFollowUp.length} devis ouvert(s) sans relance récente détectée.`, module: "Commerce" });

  return {
    generatedAt: new Date().toISOString(),
    profile: { displayName: profile?.display_name ?? null, email: profile?.email ?? null },
    summary: {
      activeChantiers: activeChantiers.length,
      preparationChantiers: activeChantiers.filter((row) => String(row.status ?? "").toUpperCase() === "PREPARATION").length,
      runningChantiers: activeChantiers.filter((row) => String(row.status ?? "").toUpperCase() === "EN_COURS").length,
      lateChantiers: lateChantiers.length,
      averageProgress: activeChantiers.length ? activeChantiers.reduce((sum, row) => sum + number(row.avancement), 0) / activeChantiers.length : 0,
      plannedHours,
      spentHours,
      openTasks: openTasks.length,
      lateTasks: lateTasks.length,
      blockedTasks: blockedTasks.length,
      pendingMaterialRequests: pendingMaterialRequests.length,
      openQuotes: openQuotes.length,
      quotesToFollowUp: quotesToFollowUp.length,
      openOpportunities: openOpportunities.length,
      estimatedPipelineTtc: openQuotes.reduce((sum, row) => sum + number(row.montant_ttc), 0) + openOpportunities.reduce((sum, row) => sum + number(row.montant_estime) * (number(row.probabilite) / 100), 0),
      overdueInvoices: invoices.filter((row) => String(row.status ?? "").toLowerCase() === "overdue").length,
      unpaidInvoiceAmountTtc: invoices.filter((row) => String(row.status ?? "").toLowerCase() === "overdue").reduce((sum, row) => sum + number((row.document as any)?.totals?.totalTtc), 0),
    },
    risks,
    datasets: { chantiers: activeChantiers.slice(0, 30), tasks: tasks.slice(0, 120), timeEntries: timeEntries.slice(0, 120), materialRequests: materialRequests.slice(0, 80), quotes: quotes.slice(0, 80), opportunities: opportunities.slice(0, 80), invoices: invoices.slice(0, 80) },
  };
}

export async function askCocoDirectionAssistant(input: { message: string; history: CocoDirectionChatMessage[]; context: CocoDirectionContext }): Promise<string> {
  const { data, error } = await supabase.functions.invoke("coco-direction-assistant", { body: { mode: "direction_chat", message: input.message, history: input.history.slice(-10), context: input.context } });
  if (error) throw error;
  const reply = String((data as { reply?: string } | null)?.reply ?? "").trim();
  if (!reply) throw new Error("Réponse vide de l'assistant direction.");
  return reply;
}

function templateToReference(row: TaskTemplateRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    titre: row.titre,
    lot: row.lot,
    unite: row.unite,
    quantite_defaut: row.quantite_defaut,
    temps_prevu_par_unite_h: row.temps_prevu_par_unite_h,
    cout_reference_unitaire_ht: row.cout_reference_unitaire_ht,
    description_technique: row.description_technique,
    remarques: row.remarques,
  };
}

function supplierToReference(row: SupplierRow) {
  return { id: row.id, name: row.name, specialty: row.specialty, city: row.city, notes: row.notes };
}

function safeArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeDraft(raw: Partial<CocoControlledDraft> | null | undefined): CocoControlledDraft {
  const now = new Date().toISOString();
  return {
    id: String(raw?.id ?? crypto.randomUUID()),
    kind: raw?.kind ?? "visit_quote_analysis",
    title: text(raw?.title) ?? "Brouillon IA apres visite de chiffrage",
    generatedAt: text(raw?.generatedAt) ?? now,
    sourceSummary: safeArray(raw?.sourceSummary).map(String).filter(Boolean),
    confidence: raw?.confidence === "haute" || raw?.confidence === "faible" ? raw.confidence : "moyenne",
    hypotheses: safeArray(raw?.hypotheses).map(String).filter(Boolean),
    pointsToVerify: safeArray(raw?.pointsToVerify).map(String).filter(Boolean),
    risks: safeArray(raw?.risks).map(String).filter(Boolean),
    quoteLines: safeArray(raw?.quoteLines).map((line: any) => ({
      title: text(line?.title) ?? "Prestation a chiffrer",
      lot: text(line?.lot),
      unit: text(line?.unit) ?? "u",
      quantity: number(line?.quantity) || 1,
      estimatedHours: line?.estimatedHours === null || line?.estimatedHours === undefined ? null : number(line.estimatedHours),
      unitPriceHt: line?.unitPriceHt === null || line?.unitPriceHt === undefined ? null : number(line.unitPriceHt),
      totalHt: line?.totalHt === null || line?.totalHt === undefined ? null : number(line.totalHt),
      templateId: text(line?.templateId),
      templateTitle: text(line?.templateTitle),
      source: text(line?.source) ?? "Visite commerciale",
      confidence: line?.confidence === "haute" || line?.confidence === "faible" ? line.confidence : "moyenne",
      assumptions: safeArray(line?.assumptions).map(String).filter(Boolean),
      pointsToVerify: safeArray(line?.pointsToVerify).map(String).filter(Boolean),
    })),
    materialNeeds: safeArray(raw?.materialNeeds).map((need: any) => ({
      designation: text(need?.designation) ?? "Materiau a verifier",
      quantity: need?.quantity === null || need?.quantity === undefined ? null : number(need.quantity),
      unit: text(need?.unit),
      supplierId: text(need?.supplierId),
      supplierName: text(need?.supplierName),
      source: text(need?.source) ?? "Analyse chiffrage",
      confidence: need?.confidence === "haute" || need?.confidence === "faible" ? need.confidence : "moyenne",
      pointsToVerify: safeArray(need?.pointsToVerify).map(String).filter(Boolean),
    })),
    proposedActions: safeArray(raw?.proposedActions).map((action: any) => ({
      label: text(action?.label) ?? "Revoir la proposition",
      module: text(action?.module) ?? "Assistant Direction COCO",
      actionType: ["prepare", "review", "validate", "ignore"].includes(String(action?.actionType)) ? action.actionType : "review",
      requiresAdminValidation: true,
      detail: text(action?.detail) ?? "Action a valider par un administrateur avant toute ecriture metier.",
    })),
    adminValidationRequired: true,
    finalWriteBlocked: true,
  };
}

export async function prepareCocoVisitQuoteDraft(input: { project: Record<string, unknown>; appointment: Record<string, unknown>; visitDraft: Record<string, unknown> | null }): Promise<CocoControlledDraft> {
  const profile = await getCurrentUserProfile();
  if (!isCocoAdminProfile(profile)) throw new Error("Brouillon IA reserve aux administrateurs.");

  const visitLines = safeArray(input.visitDraft?.lines);
  const [templates, suppliers] = await Promise.all([
    listTaskTemplates().catch(() => []),
    listSuppliers().catch(() => []),
  ]);
  const templateMatches = visitLines.map((line: any) => {
    const match = findBestTaskTemplateMatch({ title: line?.title, source_line: [line?.title, line?.technicalNotes, line?.constraints].filter(Boolean).join(" "), lot: line?.family }, templates);
    return {
      sourceLineId: line?.id ?? null,
      sourceTitle: line?.title ?? null,
      quantity: line?.quantity ?? null,
      unit: line?.unit ?? null,
      estimatedHoursFromVisit: line?.estimatedHours ?? null,
      priceHintHtFromVisit: line?.priceHintHt ?? null,
      template: templateToReference(match),
    };
  });

  const sourceContext = {
    prompt: COCO_SPECIALIZED_SYSTEM_PROMPTS.chiffrage,
    guardrails: {
      adminValidationRequired: true,
      noFinalWrite: true,
      forbiddenActions: ["creer_devis_final", "envoyer_devis", "creer_chantier", "modifier_planning_officiel", "passer_commande", "supprimer_donnee"],
    },
    project: {
      id: input.project.id,
      name: input.project.name,
      clientName: input.project.clientName,
      address: input.project.address,
      projectType: input.project.projectType,
      needDescription: input.project.needDescription,
      budgetEstimate: input.project.budgetEstimate,
      nextAction: input.project.nextAction,
    },
    appointment: input.appointment,
    visitDraft: input.visitDraft,
    batiproReferences: {
      taskTemplateMatches: templateMatches,
      activeSuppliers: suppliers.filter((row) => row.is_active !== false).slice(0, 80).map(supplierToReference),
    },
    expectedDraft: {
      kind: "visit_quote_analysis",
      mustInclude: ["sourceSummary", "confidence", "hypotheses", "pointsToVerify", "risks", "quoteLines", "materialNeeds", "proposedActions"],
      validation: "L'administrateur doit revoir et valider avant creation definitive dans le devis Batipro.",
    },
  };

  const { data, error } = await supabase.functions.invoke("coco-direction-assistant", { body: { mode: "visit_quote_draft", context: sourceContext } });
  if (error) throw error;
  const draft = (data as { draft?: Partial<CocoControlledDraft> } | null)?.draft;
  if (!draft) throw new Error("Brouillon IA vide pour la visite de chiffrage.");
  return normalizeDraft(draft);
}
