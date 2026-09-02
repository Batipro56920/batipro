import { supabase } from "../lib/supabaseClient";

export type CocoLearningSourceKey =
  | "task_times"
  | "material_consumption"
  | "chantier_feed"
  | "terrain_feedback"
  | "reserves"
  | "purchases"
  | "planning";

export type CocoLearningSettings = {
  enabled: boolean;
  minimumSamples: number;
  lookbackDays: number;
  sources: Record<CocoLearningSourceKey, boolean>;
};

export type CocoLearningSignal = {
  id: string;
  kind: "immediate" | "trend" | "opportunity";
  category: "temps" | "materiaux" | "materiel" | "methode" | "qualite" | "planning" | "achats";
  priority: "haute" | "normale" | "faible";
  title: string;
  finding: string;
  proposedAction: string;
  evidence: string[];
  sourceKeys: CocoLearningSourceKey[];
  sourceRefs: Array<{ key: "chantier_feed" | "terrain_feedback"; id: string }>;
  signalKey: string;
  state: "active" | "pending";
  sourceId?: string;
  chantierId?: string;
  chantierName?: string;
  taskId?: string;
  actionOptions: CocoImprovementOption[];
  detectedAt?: string;
  targetHref?: string;
};

export type CocoImprovementActionType =
  | "create_task_template_with_equipment"
  | "add_equipment_to_templates"
  | "add_client_note"
  | "publish_decision";

export type CocoImprovementOption = {
  id: string;
  actionType: CocoImprovementActionType;
  label: string;
  detail: string;
  proposal: string;
  equipmentName?: string;
  templateIds?: string[];
  templateTitles?: string[];
  clientId?: string;
  clientName?: string;
  clientNote?: string;
  confirmationMessage: string;
};

export type CocoImprovementPlan = {
  actionType: CocoImprovementActionType;
  optionId: string;
  equipmentName?: string;
  templateIds?: string[];
  clientId?: string;
  clientNote?: string;
  confirmationMessage: string;
};

export const DEFAULT_COCO_LEARNING_SETTINGS: CocoLearningSettings = {
  enabled: true,
  minimumSamples: 3,
  lookbackDays: 180,
  sources: {
    task_times: true,
    material_consumption: true,
    chantier_feed: true,
    terrain_feedback: true,
    reserves: true,
    purchases: true,
    planning: true,
  },
};

const SOURCE_LABELS: Record<CocoLearningSourceKey, string> = {
  task_times: "Temps saisis par tâche",
  material_consumption: "Consommations de matériaux",
  chantier_feed: "Fil chantier",
  terrain_feedback: "Retours et blocages terrain",
  reserves: "Réserves et reprises",
  purchases: "Achats et approvisionnements",
  planning: "Planning prévu et réalisé",
};

export const COCO_LEARNING_SOURCES = (Object.keys(SOURCE_LABELS) as CocoLearningSourceKey[]).map((key) => ({
  key,
  label: SOURCE_LABELS[key],
  detail: {
    task_times: "Compare le temps prévu au temps réellement saisi, par tâche et modèle.",
    material_consumption: "Compare les quantités théoriques aux quantités déclarées sur le terrain.",
    chantier_feed: "Repère les difficultés, manques, erreurs et solutions écrites par l'équipe.",
    terrain_feedback: "Analyse les blocages, anomalies, urgences et retours structurés.",
    reserves: "Détecte les défauts récurrents, reprises et contrôles qualité manquants.",
    purchases: "Compare besoins, coûts, retards, fournisseurs et ruptures d'approvisionnement.",
    planning: "Mesure les retards et les écarts entre dates prévues et exécution réelle.",
  }[key],
}));

function missingSchema(error: unknown) {
  const code = String((error as { code?: string } | null)?.code ?? "");
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(code);
}

function normalizeSettings(value: unknown): CocoLearningSettings {
  const row = (value ?? {}) as Partial<CocoLearningSettings>;
  return {
    enabled: row.enabled !== false,
    minimumSamples: Math.min(20, Math.max(1, Number(row.minimumSamples) || 3)),
    lookbackDays: Math.min(730, Math.max(30, Number(row.lookbackDays) || 180)),
    sources: { ...DEFAULT_COCO_LEARNING_SETTINGS.sources, ...(row.sources ?? {}) },
  };
}

export async function getCocoLearningSettings(): Promise<{ settings: CocoLearningSettings; schemaReady: boolean }> {
  const { data, error } = await (supabase as any)
    .from("coco_learning_settings")
    .select("enabled, minimum_samples, lookback_days, sources")
    .limit(1)
    .maybeSingle();
  if (error) {
    if (missingSchema(error)) return { settings: DEFAULT_COCO_LEARNING_SETTINGS, schemaReady: false };
    throw new Error(error.message);
  }
  return {
    schemaReady: true,
    settings: normalizeSettings(data ? {
      enabled: data.enabled,
      minimumSamples: data.minimum_samples,
      lookbackDays: data.lookback_days,
      sources: data.sources,
    } : DEFAULT_COCO_LEARNING_SETTINGS),
  };
}

export async function saveCocoLearningSettings(settings: CocoLearningSettings): Promise<void> {
  const normalized = normalizeSettings(settings);
  const { error } = await (supabase as any).from("coco_learning_settings").upsert({
    singleton_key: "company",
    enabled: normalized.enabled,
    minimum_samples: normalized.minimumSamples,
    lookback_days: normalized.lookbackDays,
    sources: normalized.sources,
    updated_at: new Date().toISOString(),
  }, { onConflict: "singleton_key" });
  if (error) throw new Error(missingSchema(error) ? "La migration du moteur d'amélioration n'est pas encore appliquée." : error.message);
}

type Row = Record<string, any>;
async function safeRows(table: string, select: string, since?: string): Promise<Row[]> {
  let query = (supabase as any).from(table).select(select).limit(800);
  if (since) query = query.gte("created_at", since);
  const { data, error } = await query;
  if (error) {
    if (missingSchema(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as Row[];
}

function includesAny(value: unknown, words: string[]) {
  const text = String(value ?? "").toLocaleLowerCase("fr");
  return words.some((word) => text.includes(word));
}

function cleanFeedBody(value: unknown) {
  return String(value ?? "")
    .replace(/^\s*(?:🔴|🟠|⚠️)\s*/u, "")
    .replace(/^blocage signalé\s*:\s*/i, "")
    .trim();
}

function normalizeComparableText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function signalKeyFor(chantierId: string, finding: string) {
  return `chantier:${chantierId}:finding:${normalizeComparableText(cleanFeedBody(finding))}`;
}

function equipmentFromText(value: unknown) {
  const text = String(value ?? "");
  const match = text.match(/(?:louer|acheter|réserver|reserver)\s+(?:(?:un|une|le|la|des|du|de la)\s+)?([^,.;]+?)(?:\s+avant|\s+pour|$)/i);
  const raw = match?.[1]?.replace(/^vrai\s+/i, "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/marteau\s+piqueur/i, "marteau-piqueur");
  return `${normalized.charAt(0).toLocaleUpperCase("fr")}${normalized.slice(1)}${includesAny(text, ["louer", "location"]) ? " (location)" : ""}`;
}

function taskLabelFromText(value: unknown) {
  return String(value ?? "").match(/(?:souci|problème|probleme)\s+sur\s+["“]?([^"”]+)["”]?\s*:/i)?.[1]?.trim() ?? null;
}

function findTask(tasks: Row[], chantierId: string, text: string) {
  const label = taskLabelFromText(text);
  const normalized = normalizeComparableText(label);
  if (!normalized) return undefined;
  return tasks.find((task) => String(task.chantier_id) === chantierId && (
    normalizeComparableText(task.titre).includes(normalized)
    || normalized.includes(normalizeComparableText(task.titre))
  ));
}

function clientDisplayName(row: Row | undefined) {
  if (!row) return "ce client";
  return [row.prenom, row.nom].filter(Boolean).join(" ").trim() || String(row.societe ?? "ce client");
}

function templateSimilarity(task: Row, template: Row) {
  const taskTokens = new Set(normalizeComparableText(`${task.titre} ${task.lot} ${task.description_technique}`).split(" ").filter((token) => token.length > 3));
  const templateTokens = normalizeComparableText(`${template.titre} ${template.lot} ${template.description_technique}`).split(" ").filter((token) => token.length > 3);
  return templateTokens.filter((token) => taskTokens.has(token)).length;
}

function actionOptionsFor(input: { finding: string; task?: Row; chantier?: Row; client?: Row; templates: Row[] }) {
  const { finding, task, chantier, client, templates } = input;
  const equipmentName = equipmentFromText(finding);
  if (!task || !equipmentName) return [] as CocoImprovementOption[];
  const taskTitle = String(task.titre ?? "la tâche");
  const options: CocoImprovementOption[] = [];
  if (task.task_template_id) {
    options.push({
      id: `template-${String(task.task_template_id)}`,
      actionType: "add_equipment_to_templates",
      label: `Ajouter au template « ${task.task_template_label || taskTitle} »`,
      detail: "COCO ajoute ce matériel obligatoire au template déjà relié à la tâche.",
      proposal: `J’ajoute « ${equipmentName} » comme matériel obligatoire dans le template « ${task.task_template_label || taskTitle} » afin qu’il soit prévu sur les prochains chantiers.`,
      equipmentName,
      templateIds: [String(task.task_template_id)],
      templateTitles: [String(task.task_template_label || taskTitle)],
      confirmationMessage: `✅ COCO a ajouté « ${equipmentName} » au template « ${task.task_template_label || taskTitle} » après validation de ce retour terrain.`,
    });
  } else {
    options.push({
      id: `create-template-${String(task.id)}`,
      actionType: "create_task_template_with_equipment",
      label: `Créer le template « ${taskTitle} »`,
      detail: "COCO crée un template depuis la tâche, y inscrit le matériel et relie la tâche au nouveau template.",
      proposal: `Je crée le template « ${taskTitle} » à partir de cette tâche, j’y ajoute « ${equipmentName} » comme matériel obligatoire, puis je relie la tâche à ce template.`,
      equipmentName,
      confirmationMessage: `✅ COCO a créé le template « ${taskTitle} », ajouté « ${equipmentName} » au matériel obligatoire et relié la tâche au template.`,
    });
  }
  const similar = templates
    .map((template) => ({ template, score: templateSimilarity(task, template) }))
    .filter(({ template, score }) => score >= 2 && String(template.id) !== String(task.task_template_id ?? ""))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ template }) => template);
  if (similar.length) {
    const titles = similar.map((template) => String(template.titre));
    options.push({
      id: `similar-templates-${String(task.id)}`,
      actionType: "add_equipment_to_templates",
      label: `Ajouter aux templates similaires (${similar.length})`,
      detail: `Templates détectés : ${titles.join(" · ")}`,
      proposal: `J’ajoute « ${equipmentName} » comme matériel obligatoire aux templates similaires sélectionnés : ${titles.join(", ")}.`,
      equipmentName,
      templateIds: similar.map((template) => String(template.id)),
      templateTitles: titles,
      confirmationMessage: `✅ COCO a ajouté « ${equipmentName} » aux ${similar.length} templates similaires sélectionnés.`,
    });
  }
  if (chantier?.crm_client_id && client) {
    const name = clientDisplayName(client);
    const note = `Pour les futurs chantiers comprenant de la démolition béton, prévoir la location d’un marteau-piqueur.`;
    options.push({
      id: `client-note-${String(client.id)}`,
      actionType: "add_client_note",
      label: `Ajouter un pense-bête à ${name}`,
      detail: "COCO ajoute cette note à la fiche client pour les futurs chantiers similaires.",
      proposal: `J’ajoute sur la fiche client « ${name} » le pense-bête : « ${note} »`,
      clientId: String(client.id),
      clientName: name,
      clientNote: note,
      confirmationMessage: `✅ COCO a ajouté un pense-bête à la fiche client « ${name} » pour anticiper ce besoin sur les prochains chantiers.`,
    });
  }
  return options;
}

function immediateFeedSignal(row: Row, chantier: Row | undefined, tasks: Row[], templates: Row[], client: Row | undefined): CocoLearningSignal | null {
  const raw = String(row.body ?? "").trim();
  const body = cleanFeedBody(raw);
  if (!body) return null;
  const isBlocker = includesAny(raw, ["blocage signalé", "blocage", "bloqué", "bloque", "impossible", "ne peut pas", "on ne peut pas"]);
  const isSafety = includesAny(raw, ["danger", "dangereux", "sécurité", "securite", "accident", "risque grave"]);
  const isUrgent = includesAny(raw, ["urgent", "urgence", "avant de partir", "arrêt chantier", "arret chantier"]);
  const isEquipment = includesAny(raw, ["marteau piqueur", "matériel", "materiel", "outil", "machine", "échafaud", "echafaud", "louer", "location"]);
  if (!isBlocker && !isSafety && !isUrgent) return null;

  const taskLabel = taskLabelFromText(body);
  const matchedTask = findTask(tasks, String(row.chantier_id), body);
  const actionOptions = actionOptionsFor({ finding: body, task: matchedTask, chantier, client, templates });
  const signalKey = signalKeyFor(String(row.chantier_id), body);
  return {
    id: signalKey,
    signalKey,
    state: "active",
    kind: "immediate",
    category: isSafety ? "qualite" : isEquipment ? "materiel" : "methode",
    priority: "haute",
    title: isSafety ? "Risque sécurité signalé" : taskLabel ? `Blocage · ${taskLabel}` : "Blocage chantier signalé",
    finding: body,
    proposedAction: actionOptions[0]?.proposal ?? "Publier la décision corrective dans le fil chantier.",
    evidence: [raw],
    sourceKeys: ["chantier_feed"],
    sourceRefs: [{ key: "chantier_feed", id: String(row.id) }],
    sourceId: String(row.id ?? "") || undefined,
    chantierId: String(row.chantier_id ?? "") || undefined,
    chantierName: String(chantier?.nom ?? "Chantier"),
    taskId: String(matchedTask?.id ?? "") || undefined,
    actionOptions,
    detectedAt: String(row.created_at ?? "") || undefined,
    targetHref: row.chantier_id ? `/chantiers/${String(row.chantier_id)}/historique` : "/chantiers",
  };
}

export async function analyzeCocoLearning(settings: CocoLearningSettings): Promise<{ signals: CocoLearningSignal[]; sourceCounts: Record<CocoLearningSourceKey, number>; analyzedAt: string }> {
  const normalized = normalizeSettings(settings);
  const since = new Date(Date.now() - normalized.lookbackDays * 86_400_000).toISOString();
  const enabled = normalized.sources;
  const [tasks, consumptions, feed, feedbacks, reserves, purchases, chantiers, templates, clients, signalStates, appliedActions] = await Promise.all([
    enabled.task_times || enabled.planning || enabled.chantier_feed || enabled.terrain_feedback ? safeRows("chantier_tasks", "id, chantier_id, task_template_id, task_template_label, titre, lot, unite, quantite, status, temps_prevu_h, temps_reel_h, date_fin, description_technique, caracteristiques, created_at") : [],
    enabled.material_consumption ? safeRows("chantier_task_material_consumptions", "id, chantier_task_id, material_ratio_id, quantite_consommee, created_at", since) : [],
    enabled.chantier_feed ? safeRows("chantier_feed_posts", "id, chantier_id, body, visibility, created_at", since) : [],
    enabled.terrain_feedback ? safeRows("terrain_feedbacks", "id, chantier_id, category, urgency, title, description, status, created_at", since) : [],
    enabled.reserves ? safeRows("chantier_reserves", "id, chantier_id, title, description, status, created_at", since) : [],
    enabled.purchases ? safeRows("chantier_purchase_requests", "id, chantier_id, titre, statut_commande, cout_prevu_ht, cout_reel_ht, created_at", since) : [],
    safeRows("chantiers", "id, nom, client, crm_client_id, created_at"),
    safeRows("task_templates", "id, titre, lot, description_technique, created_at"),
    safeRows("crm_clients", "id, prenom, nom, societe, notes, created_at"),
    safeRows("coco_improvement_signal_states", "signal_key, status, updated_at"),
    safeRows("coco_improvement_actions", "signal_id, created_at"),
  ]);
  const sourceCounts: Record<CocoLearningSourceKey, number> = {
    task_times: tasks.filter((row) => Number(row.temps_reel_h) > 0).length,
    material_consumption: consumptions.length,
    chantier_feed: feed.length,
    terrain_feedback: feedbacks.length,
    reserves: reserves.length,
    purchases: purchases.length,
    planning: tasks.filter((row) => row.date_fin).length,
  };
  const signals: CocoLearningSignal[] = [];
  const chantierById = new Map(chantiers.map((row) => [String(row.id), row]));
  const clientById = new Map(clients.map((row) => [String(row.id), row]));

  if (enabled.chantier_feed) {
    feed.forEach((row) => {
      const chantier = chantierById.get(String(row.chantier_id));
      const signal = immediateFeedSignal(row, chantier, tasks, templates, clientById.get(String(chantier?.crm_client_id ?? "")));
      if (signal) signals.push(signal);
    });
  }

  if (enabled.terrain_feedback) {
    feedbacks.forEach((row) => {
      const urgency = String(row.urgency ?? "").toLowerCase();
      const category = String(row.category ?? "").toLowerCase();
      const status = String(row.status ?? "").toLowerCase();
      if (!["urgente", "critique"].includes(urgency) && category !== "blocage") return;
      if (["traite", "traité", "ferme", "fermée", "classe_sans_suite"].includes(status)) return;
      const chantierId = String(row.chantier_id ?? "");
      const finding = String(row.description ?? "Un retour terrain demande une décision rapide.");
      const chantier = chantierById.get(chantierId);
      const task = findTask(tasks, chantierId, finding);
      const actionOptions = actionOptionsFor({ finding, task, chantier, client: clientById.get(String(chantier?.crm_client_id ?? "")), templates });
      const signalKey = signalKeyFor(chantierId, finding);
      signals.push({
        id: signalKey,
        signalKey,
        state: "active",
        kind: "immediate",
        category: category === "blocage" ? "methode" : "qualite",
        priority: "haute",
        title: String(row.title ?? "Retour terrain urgent"),
        finding,
        proposedAction: actionOptions[0]?.proposal ?? "Publier la décision corrective dans le fil chantier.",
        evidence: [`Urgence : ${urgency || "blocage"}`],
        sourceKeys: ["terrain_feedback"],
        sourceRefs: [{ key: "terrain_feedback", id: String(row.id) }],
        sourceId: String(row.id ?? "") || undefined,
        chantierId: chantierId || undefined,
        chantierName: String(chantier?.nom ?? "Chantier"),
        taskId: String(task?.id ?? "") || undefined,
        actionOptions,
        detectedAt: String(row.created_at ?? "") || undefined,
        targetHref: row.id ? `/retours-terrain?feedbackId=${encodeURIComponent(String(row.id))}` : "/retours-terrain",
      });
    });
  }
  const comparable = tasks.filter((row) => Number(row.temps_prevu_h) > 0 && Number(row.temps_reel_h) > 0);
  const lateTime = comparable.filter((row) => Number(row.temps_reel_h) > Number(row.temps_prevu_h) * 1.15);
  if (enabled.task_times && lateTime.length >= normalized.minimumSamples) {
    const planned = lateTime.reduce((sum, row) => sum + Number(row.temps_prevu_h), 0);
    const actual = lateTime.reduce((sum, row) => sum + Number(row.temps_reel_h), 0);
    signals.push({ id: "time-drift", signalKey: "time-drift", state: "active", kind: "trend", category: "temps", priority: "normale", title: "Temps prévus régulièrement dépassés", finding: `${lateTime.length} tâches dépassent leur temps prévu de plus de 15 %.`, proposedAction: `Proposer de relever les temps de référence concernés après revue (${Math.round(((actual / planned) - 1) * 100)} % d'écart cumulé).`, evidence: [`${Math.round(planned)} h prévues`, `${Math.round(actual)} h réalisées`], sourceKeys: ["task_times"], sourceRefs: [], actionOptions: [], targetHref: "/temps" });
  }
  if (enabled.material_consumption && consumptions.length >= normalized.minimumSamples) {
    signals.push({ id: "material-learning", signalKey: "material-learning", state: "active", kind: "opportunity", category: "materiaux", priority: "faible", title: "Consommations terrain disponibles", finding: `${consumptions.length} déclarations peuvent fiabiliser les ratios et coefficients de perte.`, proposedAction: "Comparer par modèle la quantité théorique et la consommation réelle, puis proposer un nouveau ratio sans l'appliquer automatiquement.", evidence: [`${consumptions.length} saisies sur ${normalized.lookbackDays} jours`], sourceKeys: ["material_consumption"], sourceRefs: [], actionOptions: [], targetHref: "/bibliotheque" });
  }
  const fieldText = [...feed.map((row) => row.body), ...feedbacks.map((row) => `${row.title} ${row.description}`)];
  const equipmentMentions = fieldText.filter((text) => includesAny(text, ["manque matériel", "manque materiel", "outil", "machine", "échafaud", "echafaud"]));
  if ((enabled.chantier_feed || enabled.terrain_feedback) && equipmentMentions.length >= normalized.minimumSamples) {
    signals.push({ id: "equipment-missing", signalKey: "equipment-missing", state: "active", kind: "trend", category: "materiel", priority: "normale", title: "Matériel manquant mentionné plusieurs fois", finding: `${equipmentMentions.length} messages ou retours signalent un problème de matériel/outillage.`, proposedAction: "Proposer d'ajouter le matériel récurrent aux modèles de tâches et aux contrôles du matin.", evidence: equipmentMentions.slice(0, 3).map((value) => String(value).slice(0, 120)), sourceKeys: ["chantier_feed", "terrain_feedback"], sourceRefs: [], actionOptions: [], targetHref: "/bibliotheque?readiness=missing_preparation" });
  }
  const methodMentions = fieldText.filter((text) => includesAny(text, ["erreur", "refaire", "reprise", "pas prévu", "pas prevu", "difficulté", "difficulte", "support"]));
  if ((enabled.chantier_feed || enabled.terrain_feedback) && methodMentions.length >= normalized.minimumSamples) {
    signals.push({ id: "method-feedback", signalKey: "method-feedback", state: "active", kind: "trend", category: "methode", priority: "normale", title: "Difficultés d'exécution récurrentes", finding: `${methodMentions.length} éléments du fil chantier ou des retours terrain décrivent une erreur, une reprise ou une difficulté.`, proposedAction: "Proposer une amélioration du mode opératoire, des prérequis et des points de contrôle des tâches concernées.", evidence: methodMentions.slice(0, 3).map((value) => String(value).slice(0, 120)), sourceKeys: ["chantier_feed", "terrain_feedback"], sourceRefs: [], actionOptions: [], targetHref: "/retours-terrain" });
  }
  if (enabled.reserves && reserves.length >= normalized.minimumSamples) {
    signals.push({ id: "quality-reserves", signalKey: "quality-reserves", state: "active", kind: "trend", category: "qualite", priority: "normale", title: "Réserves à transformer en prévention", finding: `${reserves.length} réserves ont été enregistrées pendant la période analysée.`, proposedAction: "Regrouper les réserves par tâche et proposer des points de contrôle avant fermeture des travaux.", evidence: reserves.slice(0, 3).map((row) => String(row.title ?? row.description ?? "Réserve")), sourceKeys: ["reserves"], sourceRefs: [], actionOptions: [], targetHref: "/reserves" });
  }
  const today = new Date().toISOString().slice(0, 10);
  const lateTasks = tasks.filter((row) => row.date_fin && String(row.date_fin) < today && !["FAIT", "TERMINE", "TERMINEE"].includes(String(row.status).toUpperCase()));
  if (enabled.planning && lateTasks.length >= normalized.minimumSamples) {
    signals.push({ id: "planning-drift", signalKey: "planning-drift", state: "active", kind: "trend", category: "planning", priority: "normale", title: "Retards de planning récurrents", finding: `${lateTasks.length} tâches non terminées ont une date de fin dépassée.`, proposedAction: "Proposer des durées plus réalistes et signaler les dépendances ou ressources qui provoquent les reports.", evidence: lateTasks.slice(0, 3).map((row) => String(row.titre ?? "Tâche en retard")), sourceKeys: ["planning", "chantier_feed"], sourceRefs: [], actionOptions: [], targetHref: "/planning" });
  }
  const purchaseDrift = purchases.filter((row) => Number(row.cout_prevu_ht) > 0 && Number(row.cout_reel_ht) > Number(row.cout_prevu_ht) * 1.1);
  if (enabled.purchases && purchaseDrift.length >= normalized.minimumSamples) {
    signals.push({ id: "purchase-drift", signalKey: "purchase-drift", state: "active", kind: "trend", category: "achats", priority: "normale", title: "Coûts d'achat supérieurs aux prévisions", finding: `${purchaseDrift.length} approvisionnements dépassent le coût prévu de plus de 10 %.`, proposedAction: "Proposer une mise à jour des prix d'achat de référence et identifier les fournisseurs ou familles concernés.", evidence: purchaseDrift.slice(0, 3).map((row) => String(row.titre ?? "Approvisionnement")), sourceKeys: ["purchases"], sourceRefs: [], actionOptions: [], targetHref: "/fournisseurs" });
  }
  const appliedSignalIds = new Set(appliedActions.map((row) => String(row.signal_id ?? "")).filter(Boolean));
  const stateBySignalKey = new Map(signalStates.map((row) => [String(row.signal_key), String(row.status)]));
  const merged = new Map<string, CocoLearningSignal>();
  signals.forEach((signal) => {
    const existing = merged.get(signal.signalKey);
    if (!existing) {
      merged.set(signal.signalKey, signal);
      return;
    }
    existing.sourceRefs = [...existing.sourceRefs, ...signal.sourceRefs.filter((ref) => !existing.sourceRefs.some((current) => current.key === ref.key && current.id === ref.id))];
    existing.sourceKeys = [...new Set([...existing.sourceKeys, ...signal.sourceKeys])];
    existing.evidence = [...new Set([...existing.evidence, ...signal.evidence])];
    if (signal.sourceKeys.includes("chantier_feed")) {
      existing.sourceId = signal.sourceId;
      existing.targetHref = signal.targetHref;
    }
    if (!existing.taskId && signal.taskId) existing.taskId = signal.taskId;
    if (!existing.actionOptions.length && signal.actionOptions.length) {
      existing.actionOptions = signal.actionOptions;
      existing.proposedAction = signal.proposedAction;
      existing.category = signal.category;
    }
  });
  return {
    signals: [...merged.values()]
      .filter((signal) => !appliedSignalIds.has(signal.signalKey) && !["dismissed", "applied"].includes(stateBySignalKey.get(signal.signalKey) ?? ""))
      .map((signal) => ({ ...signal, state: stateBySignalKey.get(signal.signalKey) === "pending" ? "pending" as const : "active" as const }))
      .sort((a, b) => (a.kind === "immediate" ? -1 : 1) - (b.kind === "immediate" ? -1 : 1)),
    sourceCounts,
    analyzedAt: new Date().toISOString(),
  };
}

function planFromOption(option: CocoImprovementOption, value?: unknown): CocoImprovementPlan {
  const row = (value ?? {}) as Record<string, unknown>;
  return {
    actionType: option.actionType,
    optionId: option.id,
    equipmentName: option.equipmentName,
    templateIds: option.templateIds,
    clientId: option.clientId,
    clientNote: String(row.clientNote ?? option.clientNote ?? "").trim() || undefined,
    confirmationMessage: String(row.confirmationMessage ?? option.confirmationMessage).trim(),
  };
}

export async function regenerateCocoImprovementProposal(
  signal: CocoLearningSignal,
  editedText: string,
  option: CocoImprovementOption,
): Promise<{ proposal: string; plan: CocoImprovementPlan }> {
  const message = editedText.trim();
  if (!message) throw new Error("Écris au moins quelques mots pour guider COCO.");
  if (!signal.chantierId) throw new Error("Cette proposition n'est pas encore reliée à un chantier précis.");
  const { data, error } = await supabase.functions.invoke("coco-direction-assistant", {
    body: {
      mode: "improvement_rewrite",
      message,
      context: {
        signalId: signal.id,
        kind: signal.kind,
        category: signal.category,
        title: signal.title,
        finding: signal.finding,
        chantierId: signal.chantierId,
        chantierName: signal.chantierName ?? null,
        taskId: signal.taskId ?? null,
        allowedActionType: option.actionType,
        allowedActionLabel: option.label,
        allowedActionDetail: option.detail,
        equipmentName: option.equipmentName ?? null,
        templateIds: option.templateIds ?? [],
        templateTitles: option.templateTitles ?? [],
        clientId: option.clientId ?? null,
        clientName: option.clientName ?? null,
        currentClientNote: option.clientNote ?? null,
      },
    },
  });
  if (error) throw error;
  const response = (data ?? {}) as Record<string, unknown>;
  const proposal = String(response.proposal ?? "").trim();
  if (!proposal) throw new Error("COCO n'a pas produit de proposition exploitable.");
  return { proposal, plan: planFromOption(option, response.action) };
}

export async function setCocoDetectionState(signalKey: string, status: "active" | "pending" | "dismissed") {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("Connexion requise pour modifier cette détection.");
  const { error } = await (supabase as any).from("coco_improvement_signal_states").upsert({
    signal_key: signalKey,
    status,
    updated_by: authData.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: "signal_key" });
  if (error) throw new Error(missingSchema(error) ? "La migration des états de détection n'est pas encore installée." : error.message);
}

export async function applyCocoImprovementAction(input: {
  signal: CocoLearningSignal;
  decisionText: string;
  option: CocoImprovementOption;
  plan?: CocoImprovementPlan | null;
}): Promise<{ purchaseRequestId?: string; feedPostId?: string }> {
  const decisionText = input.decisionText.trim();
  const signal = input.signal;
  if (!decisionText) throw new Error("La décision est vide.");
  if (!signal.chantierId) throw new Error("Cette décision n'est pas reliée à un chantier précis.");
  const option = input.option;
  const plan = input.plan?.optionId === option.id ? input.plan : planFromOption(option);
  const sourceRef = signal.sourceRefs.find((ref) => ref.key === "chantier_feed") ?? signal.sourceRefs[0];
  if (!sourceRef) throw new Error("Cette proposition n'est pas reliée à une donnée source précise.");
  const { data, error } = await (supabase as any).rpc("apply_coco_improvement_action", {
    p_signal_id: signal.signalKey,
    p_source_type: sourceRef.key,
    p_source_id: sourceRef.id,
    p_chantier_id: signal.chantierId,
    p_task_id: signal.taskId ?? null,
    p_decision_text: decisionText,
    p_action_type: option.actionType,
    p_action_payload: {
      equipmentName: plan.equipmentName,
      templateIds: plan.templateIds,
      clientId: plan.clientId,
      clientNote: option.actionType === "add_client_note" ? (input.plan?.optionId === option.id ? plan.clientNote : decisionText) : plan.clientNote,
      confirmationMessage: plan.confirmationMessage || `✅ Décision appliquée par COCO : ${decisionText}`,
    },
  });
  if (error) {
    const message = String(error.message ?? "");
    if (missingSchema(error) || message.includes("apply_coco_improvement_action")) {
      throw new Error("La migration permettant à COCO d'appliquer les décisions n'est pas encore installée.");
    }
    if (message.includes("coco_action_already_applied")) throw new Error("Cette décision a déjà été appliquée.");
    throw new Error(message || "Application impossible.");
  }
  return (data ?? {}) as { purchaseRequestId?: string; feedPostId?: string };
}
