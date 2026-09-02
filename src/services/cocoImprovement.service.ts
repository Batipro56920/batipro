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
  sourceId?: string;
  chantierId?: string;
  chantierName?: string;
  taskId?: string;
  actionTitle?: string;
  detectedAt?: string;
  targetHref?: string;
};

export type CocoImprovementActionType = "create_purchase_request" | "publish_decision";

export type CocoImprovementPlan = {
  actionType: CocoImprovementActionType;
  title: string | null;
  supplierName: string | null;
  quantity: number;
  unit: string | null;
  dueDate: string | null;
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

function immediateFeedSignal(row: Row, chantierName: string | undefined, tasks: Row[]): CocoLearningSignal | null {
  const raw = String(row.body ?? "").trim();
  const body = cleanFeedBody(raw);
  if (!body) return null;
  const isBlocker = includesAny(raw, ["blocage signalé", "blocage", "bloqué", "bloque", "impossible", "ne peut pas", "on ne peut pas"]);
  const isSafety = includesAny(raw, ["danger", "dangereux", "sécurité", "securite", "accident", "risque grave"]);
  const isUrgent = includesAny(raw, ["urgent", "urgence", "avant de partir", "arrêt chantier", "arret chantier"]);
  const isEquipment = includesAny(raw, ["marteau piqueur", "matériel", "materiel", "outil", "machine", "échafaud", "echafaud", "louer", "location"]);
  if (!isBlocker && !isSafety && !isUrgent) return null;

  const taskMatch = body.match(/(?:souci|problème|probleme)\s+sur\s+["“]?([^"”]+)["”]?\s*:/i);
  const taskLabel = taskMatch?.[1]?.trim();
  const equipmentMatch = body.match(/(?:louer|acheter|réserver|reserver)\s+(?:un|une|le|la|des|du|de la)?\s*([^,.;]+?)(?:\s+avant|\s+pour|$)/i);
  const equipmentLabel = equipmentMatch?.[1]?.trim();
  const normalizedTaskLabel = normalizeComparableText(taskLabel);
  const matchedTask = normalizedTaskLabel
    ? tasks.find((task) => String(task.chantier_id) === String(row.chantier_id)
      && normalizeComparableText(task.titre).includes(normalizedTaskLabel))
    : undefined;
  return {
    id: `feed-immediate-${String(row.id)}`,
    kind: "immediate",
    category: isSafety ? "qualite" : isEquipment ? "materiel" : "methode",
    priority: "haute",
    title: isSafety ? "Risque sécurité signalé" : taskLabel ? `Blocage · ${taskLabel}` : "Blocage chantier signalé",
    finding: body,
    proposedAction: isEquipment
      ? `Créer une demande pour ${equipmentLabel || "le matériel nécessaire"}, préciser qui s'en charge, puis confirmer sa disponibilité à l'équipe avant l'intervention.`
      : "Attribuer ce blocage, décider de l'action corrective et confirmer la solution dans le fil chantier.",
    evidence: [raw],
    sourceKeys: ["chantier_feed"],
    sourceId: String(row.id ?? "") || undefined,
    chantierId: String(row.chantier_id ?? "") || undefined,
    chantierName,
    taskId: String(matchedTask?.id ?? "") || undefined,
    actionTitle: equipmentLabel ? `Location · ${equipmentLabel}` : undefined,
    detectedAt: String(row.created_at ?? "") || undefined,
    targetHref: row.chantier_id ? `/chantiers/${String(row.chantier_id)}/historique` : "/chantiers",
  };
}

export async function analyzeCocoLearning(settings: CocoLearningSettings): Promise<{ signals: CocoLearningSignal[]; sourceCounts: Record<CocoLearningSourceKey, number>; analyzedAt: string }> {
  const normalized = normalizeSettings(settings);
  const since = new Date(Date.now() - normalized.lookbackDays * 86_400_000).toISOString();
  const enabled = normalized.sources;
  const [tasks, consumptions, feed, feedbacks, reserves, purchases, chantiers, appliedActions] = await Promise.all([
    enabled.task_times || enabled.planning ? safeRows("chantier_tasks", "id, chantier_id, task_template_id, titre, status, temps_prevu_h, temps_reel_h, date_fin, created_at") : [],
    enabled.material_consumption ? safeRows("chantier_task_material_consumptions", "id, chantier_task_id, material_ratio_id, quantite_consommee, created_at", since) : [],
    enabled.chantier_feed ? safeRows("chantier_feed_posts", "id, chantier_id, body, visibility, created_at", since) : [],
    enabled.terrain_feedback ? safeRows("terrain_feedbacks", "id, chantier_id, category, urgency, title, description, status, created_at", since) : [],
    enabled.reserves ? safeRows("chantier_reserves", "id, chantier_id, title, description, status, created_at", since) : [],
    enabled.purchases ? safeRows("chantier_purchase_requests", "id, chantier_id, titre, statut_commande, cout_prevu_ht, cout_reel_ht, created_at", since) : [],
    safeRows("chantiers", "id, nom, created_at"),
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
  const chantierNameById = new Map(chantiers.map((row) => [String(row.id), String(row.nom ?? "Chantier")]));

  if (enabled.chantier_feed) {
    feed.forEach((row) => {
      const signal = immediateFeedSignal(row, chantierNameById.get(String(row.chantier_id)), tasks);
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
      signals.push({
        id: `feedback-immediate-${String(row.id)}`,
        kind: "immediate",
        category: category === "blocage" ? "methode" : "qualite",
        priority: "haute",
        title: String(row.title ?? "Retour terrain urgent"),
        finding: String(row.description ?? "Un retour terrain demande une décision rapide."),
        proposedAction: "Attribuer le retour, décider de la correction et confirmer la prise en charge à l'équipe.",
        evidence: [`Urgence : ${urgency || "blocage"}`],
        sourceKeys: ["terrain_feedback"],
        sourceId: String(row.id ?? "") || undefined,
        chantierId: chantierId || undefined,
        chantierName: chantierNameById.get(chantierId),
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
    signals.push({ id: "time-drift", kind: "trend", category: "temps", priority: "normale", title: "Temps prévus régulièrement dépassés", finding: `${lateTime.length} tâches dépassent leur temps prévu de plus de 15 %.`, proposedAction: `Proposer de relever les temps de référence concernés après revue (${Math.round(((actual / planned) - 1) * 100)} % d'écart cumulé).`, evidence: [`${Math.round(planned)} h prévues`, `${Math.round(actual)} h réalisées`], sourceKeys: ["task_times"], targetHref: "/temps" });
  }
  if (enabled.material_consumption && consumptions.length >= normalized.minimumSamples) {
    signals.push({ id: "material-learning", kind: "opportunity", category: "materiaux", priority: "faible", title: "Consommations terrain disponibles", finding: `${consumptions.length} déclarations peuvent fiabiliser les ratios et coefficients de perte.`, proposedAction: "Comparer par modèle la quantité théorique et la consommation réelle, puis proposer un nouveau ratio sans l'appliquer automatiquement.", evidence: [`${consumptions.length} saisies sur ${normalized.lookbackDays} jours`], sourceKeys: ["material_consumption"], targetHref: "/bibliotheque" });
  }
  const fieldText = [...feed.map((row) => row.body), ...feedbacks.map((row) => `${row.title} ${row.description}`)];
  const equipmentMentions = fieldText.filter((text) => includesAny(text, ["manque matériel", "manque materiel", "outil", "machine", "échafaud", "echafaud"]));
  if ((enabled.chantier_feed || enabled.terrain_feedback) && equipmentMentions.length >= normalized.minimumSamples) {
    signals.push({ id: "equipment-missing", kind: "trend", category: "materiel", priority: "normale", title: "Matériel manquant mentionné plusieurs fois", finding: `${equipmentMentions.length} messages ou retours signalent un problème de matériel/outillage.`, proposedAction: "Proposer d'ajouter le matériel récurrent aux modèles de tâches et aux contrôles du matin.", evidence: equipmentMentions.slice(0, 3).map((value) => String(value).slice(0, 120)), sourceKeys: ["chantier_feed", "terrain_feedback"], targetHref: "/bibliotheque?readiness=missing_preparation" });
  }
  const methodMentions = fieldText.filter((text) => includesAny(text, ["erreur", "refaire", "reprise", "pas prévu", "pas prevu", "difficulté", "difficulte", "support"]));
  if ((enabled.chantier_feed || enabled.terrain_feedback) && methodMentions.length >= normalized.minimumSamples) {
    signals.push({ id: "method-feedback", kind: "trend", category: "methode", priority: "normale", title: "Difficultés d'exécution récurrentes", finding: `${methodMentions.length} éléments du fil chantier ou des retours terrain décrivent une erreur, une reprise ou une difficulté.`, proposedAction: "Proposer une amélioration du mode opératoire, des prérequis et des points de contrôle des tâches concernées.", evidence: methodMentions.slice(0, 3).map((value) => String(value).slice(0, 120)), sourceKeys: ["chantier_feed", "terrain_feedback"], targetHref: "/retours-terrain" });
  }
  if (enabled.reserves && reserves.length >= normalized.minimumSamples) {
    signals.push({ id: "quality-reserves", kind: "trend", category: "qualite", priority: "normale", title: "Réserves à transformer en prévention", finding: `${reserves.length} réserves ont été enregistrées pendant la période analysée.`, proposedAction: "Regrouper les réserves par tâche et proposer des points de contrôle avant fermeture des travaux.", evidence: reserves.slice(0, 3).map((row) => String(row.title ?? row.description ?? "Réserve")), sourceKeys: ["reserves"], targetHref: "/reserves" });
  }
  const today = new Date().toISOString().slice(0, 10);
  const lateTasks = tasks.filter((row) => row.date_fin && String(row.date_fin) < today && !["FAIT", "TERMINE", "TERMINEE"].includes(String(row.status).toUpperCase()));
  if (enabled.planning && lateTasks.length >= normalized.minimumSamples) {
    signals.push({ id: "planning-drift", kind: "trend", category: "planning", priority: "normale", title: "Retards de planning récurrents", finding: `${lateTasks.length} tâches non terminées ont une date de fin dépassée.`, proposedAction: "Proposer des durées plus réalistes et signaler les dépendances ou ressources qui provoquent les reports.", evidence: lateTasks.slice(0, 3).map((row) => String(row.titre ?? "Tâche en retard")), sourceKeys: ["planning", "chantier_feed"], targetHref: "/planning" });
  }
  const purchaseDrift = purchases.filter((row) => Number(row.cout_prevu_ht) > 0 && Number(row.cout_reel_ht) > Number(row.cout_prevu_ht) * 1.1);
  if (enabled.purchases && purchaseDrift.length >= normalized.minimumSamples) {
    signals.push({ id: "purchase-drift", kind: "trend", category: "achats", priority: "normale", title: "Coûts d'achat supérieurs aux prévisions", finding: `${purchaseDrift.length} approvisionnements dépassent le coût prévu de plus de 10 %.`, proposedAction: "Proposer une mise à jour des prix d'achat de référence et identifier les fournisseurs ou familles concernés.", evidence: purchaseDrift.slice(0, 3).map((row) => String(row.titre ?? "Approvisionnement")), sourceKeys: ["purchases"], targetHref: "/fournisseurs" });
  }
  const appliedSignalIds = new Set(appliedActions.map((row) => String(row.signal_id ?? "")).filter(Boolean));
  return {
    signals: signals
      .filter((signal) => !appliedSignalIds.has(signal.id))
      .sort((a, b) => (a.kind === "immediate" ? -1 : 1) - (b.kind === "immediate" ? -1 : 1)),
    sourceCounts,
    analyzedAt: new Date().toISOString(),
  };
}

function actionTypeForSignal(signal: CocoLearningSignal): CocoImprovementActionType {
  return signal.kind === "immediate" && signal.category === "materiel" && signal.chantierId
    ? "create_purchase_request"
    : "publish_decision";
}

function normalizeImprovementPlan(value: unknown, signal: CocoLearningSignal): CocoImprovementPlan {
  const row = (value ?? {}) as Record<string, unknown>;
  const expectedActionType = actionTypeForSignal(signal);
  const quantity = Number(row.quantity);
  const dueDate = String(row.dueDate ?? "").trim();
  return {
    actionType: expectedActionType,
    title: String(row.title ?? "").trim() || null,
    supplierName: String(row.supplierName ?? "").trim() || null,
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    unit: String(row.unit ?? "").trim() || null,
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : null,
    confirmationMessage: String(row.confirmationMessage ?? "").trim(),
  };
}

export async function regenerateCocoImprovementProposal(
  signal: CocoLearningSignal,
  editedText: string,
): Promise<{ proposal: string; plan: CocoImprovementPlan }> {
  const message = editedText.trim();
  if (!message) throw new Error("Écris au moins quelques mots pour guider COCO.");
  if (!signal.chantierId) throw new Error("Cette proposition n'est pas encore reliée à un chantier précis.");
  const allowedActionType = actionTypeForSignal(signal);
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
        allowedActionType,
      },
    },
  });
  if (error) throw error;
  const response = (data ?? {}) as Record<string, unknown>;
  const proposal = String(response.proposal ?? "").trim();
  if (!proposal) throw new Error("COCO n'a pas produit de proposition exploitable.");
  return { proposal, plan: normalizeImprovementPlan(response.action, signal) };
}

export async function applyCocoImprovementAction(input: {
  signal: CocoLearningSignal;
  decisionText: string;
  plan?: CocoImprovementPlan | null;
}): Promise<{ purchaseRequestId?: string; feedPostId?: string }> {
  const decisionText = input.decisionText.trim();
  const signal = input.signal;
  if (!decisionText) throw new Error("La décision est vide.");
  if (!signal.chantierId) throw new Error("Cette décision n'est pas reliée à un chantier précis.");
  const actionType = actionTypeForSignal(signal);
  const plan = input.plan?.actionType === actionType
    ? input.plan
    : normalizeImprovementPlan({}, signal);
  const sourceType = signal.sourceKeys.includes("chantier_feed") ? "chantier_feed" : "terrain_feedback";
  const { data, error } = await (supabase as any).rpc("apply_coco_improvement_action", {
    p_signal_id: signal.id,
    p_source_type: sourceType,
    p_source_id: signal.sourceId ?? null,
    p_chantier_id: signal.chantierId,
    p_task_id: signal.taskId ?? null,
    p_decision_text: decisionText,
    p_action_type: actionType,
    p_action_payload: {
      title: plan.title ?? (actionType === "create_purchase_request" ? signal.actionTitle ?? decisionText.slice(0, 180) : null),
      supplierName: plan.supplierName,
      quantity: plan.quantity,
      unit: plan.unit,
      dueDate: plan.dueDate,
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
