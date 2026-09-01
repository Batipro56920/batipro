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
  category: "temps" | "materiaux" | "materiel" | "methode" | "qualite" | "planning" | "achats";
  priority: "haute" | "normale" | "faible";
  title: string;
  finding: string;
  proposedAction: string;
  evidence: string[];
  sourceKeys: CocoLearningSourceKey[];
  targetHref?: string;
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

export async function analyzeCocoLearning(settings: CocoLearningSettings): Promise<{ signals: CocoLearningSignal[]; sourceCounts: Record<CocoLearningSourceKey, number>; analyzedAt: string }> {
  const normalized = normalizeSettings(settings);
  const since = new Date(Date.now() - normalized.lookbackDays * 86_400_000).toISOString();
  const enabled = normalized.sources;
  const [tasks, consumptions, feed, feedbacks, reserves, purchases] = await Promise.all([
    enabled.task_times || enabled.planning ? safeRows("chantier_tasks", "id, chantier_id, task_template_id, titre, status, temps_prevu_h, temps_reel_h, date_fin, created_at") : [],
    enabled.material_consumption ? safeRows("chantier_task_material_consumptions", "id, chantier_task_id, material_ratio_id, quantite_consommee, created_at", since) : [],
    enabled.chantier_feed ? safeRows("chantier_feed_posts", "id, chantier_id, body, visibility, created_at", since) : [],
    enabled.terrain_feedback ? safeRows("terrain_feedbacks", "id, chantier_id, category, urgency, title, description, status, created_at", since) : [],
    enabled.reserves ? safeRows("chantier_reserves", "id, chantier_id, title, description, status, created_at", since) : [],
    enabled.purchases ? safeRows("chantier_purchase_requests", "id, chantier_id, titre, statut_commande, cout_prevu_ht, cout_reel_ht, created_at", since) : [],
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
  const comparable = tasks.filter((row) => Number(row.temps_prevu_h) > 0 && Number(row.temps_reel_h) > 0);
  const lateTime = comparable.filter((row) => Number(row.temps_reel_h) > Number(row.temps_prevu_h) * 1.15);
  if (enabled.task_times && lateTime.length >= normalized.minimumSamples) {
    const planned = lateTime.reduce((sum, row) => sum + Number(row.temps_prevu_h), 0);
    const actual = lateTime.reduce((sum, row) => sum + Number(row.temps_reel_h), 0);
    signals.push({ id: "time-drift", category: "temps", priority: "haute", title: "Temps prévus régulièrement dépassés", finding: `${lateTime.length} tâches dépassent leur temps prévu de plus de 15 %.`, proposedAction: `Proposer de relever les temps de référence concernés après revue (${Math.round(((actual / planned) - 1) * 100)} % d'écart cumulé).`, evidence: [`${Math.round(planned)} h prévues`, `${Math.round(actual)} h réalisées`], sourceKeys: ["task_times"], targetHref: "/temps" });
  }
  if (enabled.material_consumption && consumptions.length >= normalized.minimumSamples) {
    signals.push({ id: "material-learning", category: "materiaux", priority: "normale", title: "Consommations terrain disponibles", finding: `${consumptions.length} déclarations peuvent fiabiliser les ratios et coefficients de perte.`, proposedAction: "Comparer par modèle la quantité théorique et la consommation réelle, puis proposer un nouveau ratio sans l'appliquer automatiquement.", evidence: [`${consumptions.length} saisies sur ${normalized.lookbackDays} jours`], sourceKeys: ["material_consumption"], targetHref: "/bibliotheque" });
  }
  const fieldText = [...feed.map((row) => row.body), ...feedbacks.map((row) => `${row.title} ${row.description}`)];
  const equipmentMentions = fieldText.filter((text) => includesAny(text, ["manque matériel", "manque materiel", "outil", "machine", "échafaud", "echafaud"]));
  if ((enabled.chantier_feed || enabled.terrain_feedback) && equipmentMentions.length >= normalized.minimumSamples) {
    signals.push({ id: "equipment-missing", category: "materiel", priority: "haute", title: "Matériel manquant mentionné plusieurs fois", finding: `${equipmentMentions.length} messages ou retours signalent un problème de matériel/outillage.`, proposedAction: "Proposer d'ajouter le matériel récurrent aux modèles de tâches et aux contrôles du matin.", evidence: equipmentMentions.slice(0, 3).map((value) => String(value).slice(0, 120)), sourceKeys: ["chantier_feed", "terrain_feedback"], targetHref: "/bibliotheque?readiness=missing_preparation" });
  }
  const methodMentions = fieldText.filter((text) => includesAny(text, ["erreur", "refaire", "reprise", "pas prévu", "pas prevu", "difficulté", "difficulte", "support"]));
  if ((enabled.chantier_feed || enabled.terrain_feedback) && methodMentions.length >= normalized.minimumSamples) {
    signals.push({ id: "method-feedback", category: "methode", priority: "normale", title: "Difficultés d'exécution récurrentes", finding: `${methodMentions.length} éléments du fil chantier ou des retours terrain décrivent une erreur, une reprise ou une difficulté.`, proposedAction: "Proposer une amélioration du mode opératoire, des prérequis et des points de contrôle des tâches concernées.", evidence: methodMentions.slice(0, 3).map((value) => String(value).slice(0, 120)), sourceKeys: ["chantier_feed", "terrain_feedback"], targetHref: "/retours-terrain" });
  }
  if (enabled.reserves && reserves.length >= normalized.minimumSamples) {
    signals.push({ id: "quality-reserves", category: "qualite", priority: "normale", title: "Réserves à transformer en prévention", finding: `${reserves.length} réserves ont été enregistrées pendant la période analysée.`, proposedAction: "Regrouper les réserves par tâche et proposer des points de contrôle avant fermeture des travaux.", evidence: reserves.slice(0, 3).map((row) => String(row.title ?? row.description ?? "Réserve")), sourceKeys: ["reserves"], targetHref: "/reserves" });
  }
  const today = new Date().toISOString().slice(0, 10);
  const lateTasks = tasks.filter((row) => row.date_fin && String(row.date_fin) < today && !["FAIT", "TERMINE", "TERMINEE"].includes(String(row.status).toUpperCase()));
  if (enabled.planning && lateTasks.length >= normalized.minimumSamples) {
    signals.push({ id: "planning-drift", category: "planning", priority: "haute", title: "Retards de planning récurrents", finding: `${lateTasks.length} tâches non terminées ont une date de fin dépassée.`, proposedAction: "Proposer des durées plus réalistes et signaler les dépendances ou ressources qui provoquent les reports.", evidence: lateTasks.slice(0, 3).map((row) => String(row.titre ?? "Tâche en retard")), sourceKeys: ["planning", "chantier_feed"], targetHref: "/planning" });
  }
  const purchaseDrift = purchases.filter((row) => Number(row.cout_prevu_ht) > 0 && Number(row.cout_reel_ht) > Number(row.cout_prevu_ht) * 1.1);
  if (enabled.purchases && purchaseDrift.length >= normalized.minimumSamples) {
    signals.push({ id: "purchase-drift", category: "achats", priority: "normale", title: "Coûts d'achat supérieurs aux prévisions", finding: `${purchaseDrift.length} approvisionnements dépassent le coût prévu de plus de 10 %.`, proposedAction: "Proposer une mise à jour des prix d'achat de référence et identifier les fournisseurs ou familles concernés.", evidence: purchaseDrift.slice(0, 3).map((row) => String(row.titre ?? "Approvisionnement")), sourceKeys: ["purchases"], targetHref: "/fournisseurs" });
  }
  return { signals, sourceCounts, analyzedAt: new Date().toISOString() };
}
