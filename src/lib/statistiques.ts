import type { ChantierRow } from "../services/chantiers.service";
import type { IntervenantRow } from "../services/intervenants.service";
import type {
  StatisticsChecklistRow,
  StatisticsDataset,
  StatisticsInfoRequestRow,
  StatisticsReserveRow,
  StatisticsTaskAssigneeRow,
  StatisticsTaskRow,
  StatisticsTimeEntryRow,
} from "../services/statistiques.service";
import type { MaterielDemandeRow } from "../services/materielDemandes.service";

export type StatisticsPeriod = "7d" | "30d" | "90d" | "year" | "custom";
export type StatisticsClientType = "particulier" | "sci" | "professionnel" | "autre";
export type StatisticsChantierType = "renovation" | "neuf" | "partiel" | "complet" | "autre";
export type StatisticsChantierCategory = "salle_de_bain" | "cuisine" | "appartement" | "maison_complete" | "autre";

export type StatisticsFilters = {
  period: StatisticsPeriod;
  customStart: string;
  customEnd: string;
  chantierId: string;
  clientType: string;
  chantierType: string;
  lot: string;
  intervenantId: string;
  statutChantier: string;
};

export type StatisticsOption = {
  value: string;
  label: string;
};

export type StatisticsAlert = {
  key: string;
  title: string;
  detail: string;
  tone: "danger" | "warning" | "info";
};

export type StatisticsMetric = {
  label: string;
  value: number | null;
  unit?: string;
  help?: string;
};

export type StatisticsDriftRow = {
  id: string;
  label: string;
  chantierName: string;
  plannedHours: number | null;
  actualHours: number | null;
  driftHours: number | null;
  driftPercent: number | null;
};

export type StatisticsTaskFrequencyRow = {
  label: string;
  family: string;
  count: number;
  averageHours: number | null;
  totalHours: number | null;
  averageHoursPerUnit: number | null;
  totalQuantity: number | null;
  unit: string | null;
  lot: string;
};

export type StatisticsDistributionRow = {
  label: string;
  value: number | null;
  secondary?: string;
};

export type StatisticsChantierActivityRow = {
  chantierId: string;
  chantierName: string;
  lastActivityAt: string | null;
  openBlockages: number;
};

export type StatisticsIntervenantActivityRow = {
  intervenantId: string;
  intervenantName: string;
  lastActivityAt: string | null;
  chantierNames: string[];
};

export type StatisticsDefinition = {
  key: string;
  label: string;
  source: string;
  formula: string;
};

export type StatisticsView = {
  options: {
    clientTypes: StatisticsOption[];
    chantierTypes: StatisticsOption[];
    chantiers: StatisticsOption[];
    lots: StatisticsOption[];
    intervenants: StatisticsOption[];
    statuts: StatisticsOption[];
  };
  notes: string[];
  integrityWarnings: string[];
  alerts: StatisticsAlert[];
  globalActivity: StatisticsMetric[];
  performance: {
    summary: StatisticsMetric[];
    topChantiers: StatisticsDriftRow[];
    topTasks: StatisticsDriftRow[];
    tasksWithoutPlannedHours: number;
  };
  taskAnalysis: {
    topTasks: StatisticsTaskFrequencyRow[];
    topFamilies: StatisticsTaskFrequencyRow[];
    byLot: StatisticsDistributionRow[];
    quantityByFamily: StatisticsDistributionRow[];
  };
  businessAnalysis: {
    byClientType: StatisticsDistributionRow[];
    byChantierType: StatisticsDistributionRow[];
    tasksByLot: StatisticsDistributionRow[];
    totalTimeByLot: StatisticsDistributionRow[];
    averageTimeByLot: StatisticsDistributionRow[];
    averageTasksPerChantier: number | null;
    averageRealDurationByChantierType: StatisticsDistributionRow[];
  };
  quality: {
    summary: StatisticsMetric[];
    blockageTypes: StatisticsDistributionRow[];
    chantiersWithMostBlockages: StatisticsDistributionRow[];
    checklistValidationRate: number | null;
    timeLoggingRate: number | null;
    chantiersWithoutRecentActivity: StatisticsChantierActivityRow[];
    intervenantsWithoutRecentActivity: StatisticsIntervenantActivityRow[];
  };
  definitions: StatisticsDefinition[];
  scope: {
    filteredChantiers: number;
    filteredTasks: number;
    filteredTimeEntries: number;
    periodLabel: string;
  };
};

type EnrichedChantier = ChantierRow & {
  clientType: StatisticsClientType;
  chantierType: StatisticsChantierType;
  chantierCategory: StatisticsChantierCategory;
};

type EnrichedTask = StatisticsTaskRow & {
  chantier: EnrichedChantier | null;
  lotLabel: string;
  family: string;
  assignedIntervenantIds: string[];
  actualHours: number | null;
};

type EnrichedTimeEntry = StatisticsTimeEntryRow & {
  chantier: EnrichedChantier | null;
  task: EnrichedTask | null;
  lotLabel: string;
  family: string;
};

type EnrichedMateriel = MaterielDemandeRow & {
  chantier: EnrichedChantier | null;
  task: EnrichedTask | null;
  blockageType: "materiel" | "materiaux";
  open: boolean;
  resolvedAt: string | null;
};

type EnrichedInfoRequest = StatisticsInfoRequestRow & {
  chantier: EnrichedChantier | null;
  resolvedAt: string | null;
};

type EnrichedChecklist = StatisticsChecklistRow & {
  chantier: EnrichedChantier | null;
};

type EnrichedReserve = StatisticsReserveRow & {
  chantier: EnrichedChantier | null;
  task: EnrichedTask | null;
  open: boolean;
  resolvedAt: string | null;
};

type DateRange = {
  start: Date | null;
  end: Date | null;
};

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(value: string | null | undefined): string {
  return stripDiacritics(String(value ?? "").toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizeLabel(value: string): string {
  if (!value) return "Autre";
  return value
    .split(" ")
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function dateFromString(value: string | null | undefined): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const normalized = raw.length === 10 ? `${raw}T00:00:00` : raw;
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function endOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(23, 59, 59, 999);
  return next;
}

function startOfDay(value: Date): Date {
  const next = new Date(value);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysBetween(start: string | null, end: string | null): number | null {
  const startDate = dateFromString(start);
  const endDate = dateFromString(end);
  if (!startDate || !endDate) return null;
  const delta = endOfDay(endDate).getTime() - startOfDay(startDate).getTime();
  if (delta < 0) return null;
  return Math.max(1, Math.round(delta / (24 * 60 * 60 * 1000)) + 1);
}

function sum(numbers: Array<number | null | undefined>): number {
  return numbers.reduce<number>((total, value) => total + (Number.isFinite(Number(value)) ? Number(value) : 0), 0);
}

function average(numbers: Array<number | null | undefined>): number | null {
  const filtered = numbers
    .map((value) => (Number.isFinite(Number(value)) ? Number(value) : null))
    .filter((value): value is number => value !== null);
  if (filtered.length === 0) return null;
  return sum(filtered) / filtered.length;
}

function toPercent(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

function valueInRange(date: string | null | undefined, range: DateRange): boolean {
  if (!range.start || !range.end) return true;
  const current = dateFromString(date);
  if (!current) return false;
  return current.getTime() >= range.start.getTime() && current.getTime() <= range.end.getTime();
}

function chantierOverlapsRange(chantier: ChantierRow, range: DateRange): boolean {
  if (!range.start || !range.end) return true;
  const start =
    dateFromString(chantier.date_debut) ??
    dateFromString(chantier.planning_start_date ?? null) ??
    dateFromString(chantier.created_at ?? null);
  const end =
    dateFromString(chantier.date_fin_prevue ?? null) ??
    dateFromString(chantier.planning_end_date ?? null) ??
    start;
  if (!start && !end) return true;
  const actualStart = start ?? end;
  const actualEnd = end ?? start;
  if (!actualStart || !actualEnd) return true;
  return actualStart.getTime() <= range.end.getTime() && actualEnd.getTime() >= range.start.getTime();
}

function buildPeriodRange(filters: StatisticsFilters, now = new Date()): DateRange {
  const end = endOfDay(now);
  if (filters.period === "custom") {
    const start = filters.customStart ? startOfDay(new Date(`${filters.customStart}T00:00:00`)) : null;
    const customEnd = filters.customEnd ? endOfDay(new Date(`${filters.customEnd}T00:00:00`)) : end;
    return { start, end: customEnd };
  }
  if (filters.period === "7d") return { start: startOfDay(new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)), end };
  if (filters.period === "30d") return { start: startOfDay(new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000)), end };
  if (filters.period === "90d") return { start: startOfDay(new Date(end.getTime() - 89 * 24 * 60 * 60 * 1000)), end };
  return { start: startOfDay(new Date(end.getFullYear(), 0, 1)), end };
}

function buildLast7DaysRange(now = new Date()): DateRange {
  const end = endOfDay(now);
  return { start: startOfDay(new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)), end };
}

function inferClientType(client: string | null | undefined): StatisticsClientType {
  const key = normalizeKey(client);
  if (!key) return "autre";
  if (key.includes("sci")) return "sci";
  const proKeywords = ["sarl", "sas", "eurl", "entreprise", "societe", "cabinet", "boutique", "hotel", "restaurant", "bureau", "agence", "mairie", "commune", "copropriete", "syndic", "association", "office"];
  if (proKeywords.some((keyword) => key.includes(keyword))) return "professionnel";
  if (/^[a-z]+(?: [a-z]+){0,2}$/.test(key)) return "particulier";
  return "autre";
}

function inferChantierType(chantier: Pick<ChantierRow, "nom" | "client">): StatisticsChantierType {
  const key = normalizeKey(`${chantier.nom} ${chantier.client ?? ""}`);
  if (key.includes("neuf") || key.includes("construction")) return "neuf";
  if (key.includes("complet") || key.includes("complete") || key.includes("globale") || key.includes("global")) return "complet";
  if (key.includes("partiel") || key.includes("rafraichissement") || key.includes("rafraichi")) return "partiel";
  if (key.includes("renovation") || key.includes("reno") || key.includes("rehabilitation")) return "renovation";
  return "autre";
}

function inferChantierCategory(chantier: Pick<ChantierRow, "nom">): StatisticsChantierCategory {
  const key = normalizeKey(chantier.nom);
  if (key.includes("salle de bain") || key.includes("sdb")) return "salle_de_bain";
  if (key.includes("cuisine")) return "cuisine";
  if (key.includes("appartement") || key.includes("studio")) return "appartement";
  if (key.includes("maison") || key.includes("villa")) return "maison_complete";
  return "autre";
}

function normalizeLot(value: string | null | undefined): string {
  return String(value ?? "").trim() || "Non classé";
}

const TASK_FAMILY_RULES: Array<{ family: string; keywords: string[] }> = [
  { family: "Pose receveur", keywords: ["receveur"] },
  { family: "Faïence murale", keywords: ["faience", "faiance"] },
  { family: "Carrelage", keywords: ["carrelage", "carreler"] },
  { family: "Réseau évacuation", keywords: ["evacuation", "evac", "vidange"] },
  { family: "Réseau alimentation", keywords: ["alimentation eau", "alimentation", "cuivre", "multicouche", "per"] },
  { family: "Cloison / Placo", keywords: ["placo", "cloison", "ossature"] },
  { family: "Peinture", keywords: ["peinture", "peindre", "enduit"] },
  { family: "Électricité", keywords: ["tableau electrique", "prise", "interrupteur", "electric", "luminaire"] },
  { family: "Douche / Sanitaires", keywords: ["wc", "vasque", "lavabo", "paroi", "robinet", "sanitaire", "douche"] },
  { family: "Menuiserie", keywords: ["menuiserie", "porte", "fenetre", "bloc porte"] },
  { family: "Sol", keywords: ["sol", "parquet", "ragr", "vinyle"] },
  { family: "Démolition", keywords: ["demolition", "curage", "depose"] },
  { family: "Isolation", keywords: ["isolation", "laine", "etancheite"] },
  { family: "Ventilation / Chauffage", keywords: ["vmc", "ventilation", "chauffage", "radiateur"] },
];

function normalizeTaskFamily(title: string): string {
  const key = normalizeKey(title);
  if (!key) return "Autre";
  const match = TASK_FAMILY_RULES.find((rule) => rule.keywords.some((keyword) => key.includes(keyword)));
  if (match) return match.family;
  const cleaned = key
    .split(" ")
    .filter((word) => !["de", "du", "des", "la", "le", "les", "a", "au", "aux", "et", "en", "pour", "sur"].includes(word))
    .slice(0, 4)
    .join(" ");
  return capitalizeLabel(cleaned);
}

function periodLabel(filters: StatisticsFilters): string {
  if (filters.period === "7d") return "7 jours";
  if (filters.period === "30d") return "30 jours";
  if (filters.period === "90d") return "90 jours";
  if (filters.period === "year") return "Année";
  if (filters.customStart && filters.customEnd) return `${filters.customStart} -> ${filters.customEnd}`;
  if (filters.customStart) return `Depuis ${filters.customStart}`;
  if (filters.customEnd) return `Jusqu'au ${filters.customEnd}`;
  return "Période personnalisée";
}

function labelForClientType(value: StatisticsClientType): string {
  if (value === "particulier") return "Particulier";
  if (value === "sci") return "SCI";
  if (value === "professionnel") return "Professionnel";
  return "Autre";
}

function labelForChantierType(value: StatisticsChantierType): string {
  if (value === "renovation") return "Rénovation";
  if (value === "neuf") return "Neuf";
  if (value === "partiel") return "Partiel";
  if (value === "complet") return "Complet";
  return "Autre";
}

function uniqueSortedOptions(values: string[], labelMap?: (value: string) => string): StatisticsOption[] {
  return Array.from(new Set(values.filter(Boolean)))
    .sort((a, b) => (labelMap ? labelMap(a).localeCompare(labelMap(b), "fr") : a.localeCompare(b, "fr")))
    .map((value) => ({ value, label: labelMap ? labelMap(value) : value }));
}

function averageDelayDays(rows: Array<{ createdAt: string | null; resolvedAt: string | null }>): number | null {
  const delays = rows
    .map((row) => daysBetween(row.createdAt, row.resolvedAt))
    .filter((value): value is number => value !== null);
  return average(delays);
}

function buildDriftRow(id: string, label: string, chantierName: string, plannedHours: number | null, actualHours: number | null): StatisticsDriftRow {
  const driftHours =
    plannedHours === null || actualHours === null ? null : Number((actualHours - plannedHours).toFixed(2));
  const driftPercent = plannedHours && plannedHours > 0 && driftHours !== null ? (driftHours / plannedHours) * 100 : null;
  return { id, label, chantierName, plannedHours, actualHours, driftHours, driftPercent };
}

function actualHoursForTask(task: StatisticsTaskRow, timeByTaskId: Map<string, number>, timeEntriesAvailable: boolean): number | null {
  if (timeEntriesAvailable) return timeByTaskId.has(task.id) ? Number(timeByTaskId.get(task.id) ?? 0) : 0;
  return task.temps_reel_h ?? null;
}

export function computeStatisticsView(dataset: StatisticsDataset, filters: StatisticsFilters): StatisticsView {
  const range = buildPeriodRange(filters);
  const recentRange = buildLast7DaysRange();

  const enrichedChantiers: EnrichedChantier[] = dataset.chantiers.map((chantier) => ({
    ...chantier,
    clientType: inferClientType(chantier.client),
    chantierType: inferChantierType(chantier),
    chantierCategory: inferChantierCategory(chantier),
  }));
  const chantierById = new Map(enrichedChantiers.map((chantier) => [chantier.id, chantier]));
  const intervenantById = new Map(dataset.intervenants.map((intervenant) => [intervenant.id, intervenant]));

  const options = {
    clientTypes: uniqueSortedOptions(enrichedChantiers.map((row) => row.clientType), (value) =>
      labelForClientType(value as StatisticsClientType),
    ),
    chantierTypes: uniqueSortedOptions(enrichedChantiers.map((row) => row.chantierType), (value) =>
      labelForChantierType(value as StatisticsChantierType),
    ),
    chantiers: uniqueSortedOptions(enrichedChantiers.map((row) => row.id), (value) => chantierById.get(value)?.nom ?? value),
    lots: uniqueSortedOptions(dataset.tasks.map((task) => normalizeLot(task.lot ?? task.corps_etat))),
    intervenants: uniqueSortedOptions(dataset.intervenants.map((row) => row.id), (value) => intervenantById.get(value)?.nom ?? value),
    statuts: uniqueSortedOptions(enrichedChantiers.map((row) => row.status ?? "PREPARATION")),
  };

  const baseChantiers = enrichedChantiers.filter((chantier) => {
    if (filters.chantierId && chantier.id !== filters.chantierId) return false;
    if (filters.clientType && chantier.clientType !== filters.clientType) return false;
    if (filters.chantierType && chantier.chantierType !== filters.chantierType) return false;
    if (filters.statutChantier && chantier.status !== filters.statutChantier) return false;
    return chantierOverlapsRange(chantier, range);
  });
  const baseChantierIds = new Set(baseChantiers.map((chantier) => chantier.id));

  const taskAssigneesByTaskId = new Map<string, Set<string>>();
  dataset.taskAssignees.forEach((link: StatisticsTaskAssigneeRow) => {
    if (!taskAssigneesByTaskId.has(link.task_id)) taskAssigneesByTaskId.set(link.task_id, new Set());
    taskAssigneesByTaskId.get(link.task_id)?.add(link.intervenant_id);
  });

  const scopedTimeEntriesForActuals = dataset.timeEntries.filter(
    (entry) => baseChantierIds.has(entry.chantier_id) && valueInRange(entry.work_date, range),
  );
  const timeByTaskId = scopedTimeEntriesForActuals.reduce((map, entry) => {
    if (!entry.task_id) return map;
    map.set(entry.task_id, (map.get(entry.task_id) ?? 0) + Number(entry.duration_hours ?? 0));
    return map;
  }, new Map<string, number>());

  const enrichedTasks: EnrichedTask[] = dataset.tasks.map((task) => {
    const assignedIds = Array.from(
      new Set([...(taskAssigneesByTaskId.get(task.id) ?? new Set<string>()), ...(task.intervenant_id ? [task.intervenant_id] : [])]),
    );
    return {
      ...task,
      chantier: chantierById.get(task.chantier_id) ?? null,
      lotLabel: normalizeLot(task.lot ?? task.corps_etat),
      family: normalizeTaskFamily(task.titre),
      assignedIntervenantIds: assignedIds,
      actualHours: actualHoursForTask(task, timeByTaskId, dataset.availability.timeEntries),
    };
  });
  const taskById = new Map(enrichedTasks.map((task) => [task.id, task]));

  const enrichedTimeEntries: EnrichedTimeEntry[] = dataset.timeEntries.map((entry: StatisticsTimeEntryRow) => {
    const task = entry.task_id ? taskById.get(entry.task_id) ?? null : null;
    return {
      ...entry,
      chantier: chantierById.get(entry.chantier_id) ?? null,
      task,
      lotLabel: task?.lotLabel ?? "Non classé",
      family: task?.family ?? "Sans tâche liée",
    };
  });

  const enrichedMateriel: EnrichedMateriel[] = dataset.materielDemandes.map((row: MaterielDemandeRow) => {
    const titleKey = normalizeKey(row.titre ?? row.designation ?? "");
    return {
      ...row,
      chantier: chantierById.get(row.chantier_id) ?? null,
      task: row.task_id ? taskById.get(row.task_id) ?? null : null,
      blockageType: titleKey.includes("materiau") ? "materiaux" : "materiel",
      open: row.statut === "en_attente",
      resolvedAt: row.statut === "en_attente" ? null : row.validated_at ?? row.updated_at ?? null,
    };
  });

  const enrichedInfoRequests: EnrichedInfoRequest[] = dataset.informationRequests.map((row: StatisticsInfoRequestRow) => ({
    ...row,
    chantier: chantierById.get(row.chantier_id) ?? null,
    resolvedAt: row.status === "traitee" ? row.updated_at ?? row.created_at : null,
  }));

  const enrichedChecklists: EnrichedChecklist[] = dataset.dailyChecklists.map((row: StatisticsChecklistRow) => ({
    ...row,
    chantier: row.chantier_id ? chantierById.get(row.chantier_id) ?? null : null,
  }));

  const enrichedReserves: EnrichedReserve[] = dataset.reserves.map((row: StatisticsReserveRow) => ({
    ...row,
    chantier: chantierById.get(row.chantier_id) ?? null,
    task: row.task_id ? taskById.get(row.task_id) ?? null : null,
    open: String(row.status ?? "").toUpperCase() !== "LEVEE",
    resolvedAt: String(row.status ?? "").toUpperCase() === "LEVEE" ? row.levee_at ?? row.updated_at ?? null : null,
  }));

  const filtersNeedEntityIntersection = Boolean(filters.lot || filters.intervenantId);

  const filteredTasksRaw = enrichedTasks.filter((task) => {
    if (!baseChantierIds.has(task.chantier_id)) return false;
    const taskMatchesRange =
      valueInRange(task.date_debut, range) ||
      valueInRange(task.date_fin, range) ||
      valueInRange(task.date, range) ||
      valueInRange(task.updated_at, range) ||
      valueInRange(task.created_at, range) ||
      (!range.start && !range.end);
    if (!taskMatchesRange) return false;
    if (filters.lot && task.lotLabel !== filters.lot) return false;
    if (filters.intervenantId && !task.assignedIntervenantIds.includes(filters.intervenantId)) return false;
    return true;
  });

  const filteredTimeEntriesRaw = enrichedTimeEntries.filter((entry) => {
    if (!baseChantierIds.has(entry.chantier_id)) return false;
    if (!valueInRange(entry.work_date, range)) return false;
    if (filters.intervenantId && entry.intervenant_id !== filters.intervenantId) return false;
    if (filters.lot && entry.lotLabel !== filters.lot) return false;
    return true;
  });

  const filteredMaterielRaw = enrichedMateriel.filter((row) => {
    if (!baseChantierIds.has(row.chantier_id)) return false;
    if (!valueInRange(row.created_at, range)) return false;
    if (filters.intervenantId && row.intervenant_id !== filters.intervenantId) return false;
    if (filters.lot && row.task?.lotLabel !== filters.lot) return false;
    return true;
  });

  const filteredInfoRequestsRaw = enrichedInfoRequests.filter((row) => {
    if (!baseChantierIds.has(row.chantier_id)) return false;
    if (!valueInRange(row.request_date || row.created_at, range)) return false;
    if (filters.intervenantId && row.intervenant_id !== filters.intervenantId) return false;
    return true;
  });

  const filteredChecklistsRaw = enrichedChecklists.filter((row) => {
    if (row.chantier_id && !baseChantierIds.has(row.chantier_id)) return false;
    if (!valueInRange(row.checklist_date, range)) return false;
    if (filters.intervenantId && row.intervenant_id !== filters.intervenantId) return false;
    return true;
  });

  const filteredReservesRaw = enrichedReserves.filter((row) => {
    if (!baseChantierIds.has(row.chantier_id)) return false;
    if (!valueInRange(row.created_at, range)) return false;
    if (filters.intervenantId && row.intervenant_id !== filters.intervenantId) return false;
    if (filters.lot && row.task?.lotLabel !== filters.lot) return false;
    return true;
  });

  const entityChantierIds = new Set<string>();
  filteredTasksRaw.forEach((row) => entityChantierIds.add(row.chantier_id));
  filteredTimeEntriesRaw.forEach((row) => entityChantierIds.add(row.chantier_id));
  filteredMaterielRaw.forEach((row) => entityChantierIds.add(row.chantier_id));
  filteredInfoRequestsRaw.forEach((row) => entityChantierIds.add(row.chantier_id));
  filteredReservesRaw.forEach((row) => entityChantierIds.add(row.chantier_id));
  filteredChecklistsRaw.forEach((row) => {
    if (row.chantier_id) entityChantierIds.add(row.chantier_id);
  });

  const filteredChantiers = baseChantiers.filter((chantier) =>
    filtersNeedEntityIntersection ? entityChantierIds.has(chantier.id) : true,
  );
  const filteredChantierIds = new Set(filteredChantiers.map((chantier) => chantier.id));

  const filteredTasks = filteredTasksRaw.filter((task) => filteredChantierIds.has(task.chantier_id));
  const filteredTimeEntries = filteredTimeEntriesRaw.filter((entry) => filteredChantierIds.has(entry.chantier_id));
  const filteredMateriel = filteredMaterielRaw.filter((row) => filteredChantierIds.has(row.chantier_id));
  const filteredInfoRequests = filteredInfoRequestsRaw.filter((row) => filteredChantierIds.has(row.chantier_id));
  const filteredChecklists = filteredChecklistsRaw.filter((row) => !row.chantier_id || filteredChantierIds.has(row.chantier_id));
  const filteredReserves = filteredReservesRaw.filter((row) => filteredChantierIds.has(row.chantier_id));

  const chantiersEnRetard = filteredChantiers.filter((chantier) => {
    if (chantier.status === "TERMINE") return false;
    const end = dateFromString(chantier.date_fin_prevue ?? chantier.planning_end_date ?? null);
    return Boolean(end && end.getTime() < startOfDay(new Date()).getTime());
  });

  const openMateriel = filteredMateriel.filter((row) => row.open);
  const openInfoRequests = filteredInfoRequests.filter((row) => row.status !== "traitee");
  const openReserves = filteredReserves.filter((row) => row.open);
  const openBlockagesCount = openMateriel.length + openInfoRequests.length + openReserves.length;

  const activeIntervenantIds7d = new Set<string>();
  filteredTimeEntries.filter((row) => valueInRange(row.work_date, recentRange)).forEach((row) => activeIntervenantIds7d.add(row.intervenant_id));
  filteredChecklists.filter((row) => valueInRange(row.checklist_date, recentRange)).forEach((row) => activeIntervenantIds7d.add(row.intervenant_id));
  filteredMateriel.filter((row) => valueInRange(row.created_at, recentRange)).forEach((row) => activeIntervenantIds7d.add(row.intervenant_id));
  filteredInfoRequests.filter((row) => valueInRange(row.request_date || row.created_at, recentRange)).forEach((row) => activeIntervenantIds7d.add(row.intervenant_id));

  const totalPlannedHours = sum(filteredTasks.map((task) => task.temps_prevu_h));
  const totalActualHours = dataset.availability.timeEntries
    ? sum(filteredTimeEntries.map((entry) => entry.duration_hours))
    : sum(filteredTasks.map((task) => task.actualHours));
  const totalDriftHours =
    totalPlannedHours > 0 || totalActualHours > 0 ? Number((totalActualHours - totalPlannedHours).toFixed(2)) : null;
  const totalDriftPercent = totalPlannedHours > 0 && totalDriftHours !== null ? (totalDriftHours / totalPlannedHours) * 100 : null;

  const chantierPerformance = filteredChantiers
    .map((chantier) => {
      const chantierTasks = filteredTasks.filter((task) => task.chantier_id === chantier.id);
      const plannedHours = sum(chantierTasks.map((task) => task.temps_prevu_h));
      const actualHours = dataset.availability.timeEntries
        ? sum(filteredTimeEntries.filter((entry) => entry.chantier_id === chantier.id).map((entry) => entry.duration_hours))
        : sum(chantierTasks.map((task) => task.actualHours));
      return buildDriftRow(chantier.id, chantier.nom, chantier.nom, plannedHours > 0 ? plannedHours : null, actualHours > 0 ? actualHours : 0);
    })
    .filter((row) => row.plannedHours !== null && row.driftHours !== null)
    .sort((a, b) => Number(b.driftHours ?? 0) - Number(a.driftHours ?? 0))
    .slice(0, 8);

  const taskPerformance = filteredTasks
    .map((task) => buildDriftRow(task.id, task.titre, task.chantier?.nom ?? "Chantier", task.temps_prevu_h, task.actualHours))
    .filter((row) => row.plannedHours !== null && row.actualHours !== null)
    .sort((a, b) => Number(b.driftHours ?? 0) - Number(a.driftHours ?? 0))
    .slice(0, 10);

  const tasksWithoutPlannedHours = filteredTasks.filter((task) => !task.temps_prevu_h || task.temps_prevu_h <= 0).length;

  const groupedTasksByFamily = new Map<string, EnrichedTask[]>();
  filteredTasks.forEach((task) => {
    if (!groupedTasksByFamily.has(task.family)) groupedTasksByFamily.set(task.family, []);
    groupedTasksByFamily.get(task.family)?.push(task);
  });
  const groupedTasksByLot = new Map<string, EnrichedTask[]>();
  filteredTasks.forEach((task) => {
    if (!groupedTasksByLot.has(task.lotLabel)) groupedTasksByLot.set(task.lotLabel, []);
    groupedTasksByLot.get(task.lotLabel)?.push(task);
  });

  const topTaskFamilies: StatisticsTaskFrequencyRow[] = Array.from(groupedTasksByFamily.entries())
    .map(([family, tasks]) => {
      const totalHours = sum(tasks.map((task) => task.actualHours));
      const quantities = tasks.map((task) => task.quantite_realisee ?? task.quantite);
      const units = Array.from(new Set(tasks.map((task) => task.unite).filter(Boolean)));
      const uniqueUnit = units.length === 1 ? units[0] ?? null : null;
      const totalQuantity = uniqueUnit ? sum(quantities) : null;
      return {
        label: tasks[0]?.titre ?? family,
        family,
        count: tasks.length,
        averageHours: average(tasks.map((task) => task.actualHours)),
        totalHours: totalHours > 0 ? totalHours : null,
        averageHoursPerUnit: uniqueUnit && totalQuantity && totalQuantity > 0 ? totalHours / totalQuantity : null,
        totalQuantity: totalQuantity && totalQuantity > 0 ? totalQuantity : null,
        unit: uniqueUnit,
        lot: tasks[0]?.lotLabel ?? "Non classé",
      };
    })
    .sort((a, b) => b.count - a.count || Number(b.totalHours ?? 0) - Number(a.totalHours ?? 0))
    .slice(0, 10);

  const topExactTasks: StatisticsTaskFrequencyRow[] = Array.from(
    filteredTasks.reduce((map, task) => {
      const key = `${normalizeKey(task.titre)}|${task.lotLabel}`;
      const current = map.get(key) ?? [];
      current.push(task);
      map.set(key, current);
      return map;
    }, new Map<string, EnrichedTask[]>()),
  )
    .map(([, tasks]) => {
      const totalHours = sum(tasks.map((task) => task.actualHours));
      const quantities = tasks.map((task) => task.quantite_realisee ?? task.quantite);
      const units = Array.from(new Set(tasks.map((task) => task.unite).filter(Boolean)));
      const uniqueUnit = units.length === 1 ? units[0] ?? null : null;
      const totalQuantity = uniqueUnit ? sum(quantities) : null;
      return {
        label: tasks[0]?.titre ?? "Tâche",
        family: tasks[0]?.family ?? "Autre",
        count: tasks.length,
        averageHours: average(tasks.map((task) => task.actualHours)),
        totalHours: totalHours > 0 ? totalHours : null,
        averageHoursPerUnit: uniqueUnit && totalQuantity && totalQuantity > 0 ? totalHours / totalQuantity : null,
        totalQuantity: totalQuantity && totalQuantity > 0 ? totalQuantity : null,
        unit: uniqueUnit,
        lot: tasks[0]?.lotLabel ?? "Non classé",
      };
    })
    .sort((a, b) => b.count - a.count || Number(b.totalHours ?? 0) - Number(a.totalHours ?? 0))
    .slice(0, 10);

  const quantityByFamily = topTaskFamilies
    .filter((row) => row.totalQuantity !== null)
    .map((row) => ({
      label: row.family,
      value: row.totalQuantity,
      secondary: row.unit ? `${row.unit} • ${row.count} occurrence(s)` : `${row.count} occurrence(s)`,
    }))
    .slice(0, 8);

  const clientTypeDistribution: StatisticsDistributionRow[] = uniqueSortedOptions(
    filteredChantiers.map((chantier) => chantier.clientType),
    (value) => labelForClientType(value as StatisticsClientType),
  ).map((option) => ({
    label: option.label,
    value: filteredChantiers.filter((chantier) => chantier.clientType === option.value).length,
  }));

  const chantierTypeDistribution: StatisticsDistributionRow[] = uniqueSortedOptions(
    filteredChantiers.map((chantier) => chantier.chantierType),
    (value) => labelForChantierType(value as StatisticsChantierType),
  ).map((option) => {
    const current = filteredChantiers.filter((chantier) => chantier.chantierType === option.value);
    return {
      label: option.label,
      value: current.length,
      secondary: current.length > 0 ? `${average(current.map((chantier) => chantier.heures_prevues))?.toFixed(1) ?? "—"} h prévues moy.` : undefined,
    };
  });

  const tasksByLot: StatisticsDistributionRow[] = Array.from(groupedTasksByLot.entries())
    .map(([lot, tasks]) => ({ label: lot, value: tasks.length }))
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));

  const totalTimeByLot: StatisticsDistributionRow[] = Array.from(groupedTasksByLot.entries())
    .map(([lot, tasks]) => ({ label: lot, value: sum(tasks.map((task) => task.actualHours)), secondary: `${tasks.length} tâche(s)` }))
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));

  const averageTimeByLot: StatisticsDistributionRow[] = Array.from(groupedTasksByLot.entries())
    .map(([lot, tasks]) => ({ label: lot, value: average(tasks.map((task) => task.actualHours)), secondary: `${tasks.length} tâche(s)` }))
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));

  const averageTasksPerChantier = filteredChantiers.length > 0 ? filteredTasks.length / filteredChantiers.length : null;

  const realDurationByChantierId = new Map<string, number | null>();
  filteredChantiers.forEach((chantier) => {
    const chantierTimeRows = filteredTimeEntries
      .filter((entry) => entry.chantier_id === chantier.id)
      .map((entry) => entry.work_date)
      .sort();
    if (chantierTimeRows.length === 0) {
      realDurationByChantierId.set(chantier.id, null);
      return;
    }
    realDurationByChantierId.set(chantier.id, daysBetween(chantierTimeRows[0] ?? null, chantierTimeRows[chantierTimeRows.length - 1] ?? null));
  });

  const averageRealDurationByChantierType: StatisticsDistributionRow[] = uniqueSortedOptions(
    filteredChantiers.map((chantier) => chantier.chantierType),
    (value) => labelForChantierType(value as StatisticsChantierType),
  ).map((option) => {
    const current = filteredChantiers.filter((chantier) => chantier.chantierType === option.value);
    return {
      label: option.label,
      value: average(current.map((chantier) => realDurationByChantierId.get(chantier.id) ?? null)),
      secondary: `${current.length} chantier(s)`,
    };
  });

  const blockageTypeDistribution: StatisticsDistributionRow[] = [
    { label: "Demandes matériel en attente", value: openMateriel.filter((row) => row.blockageType === "materiel").length },
    { label: "Demandes matériaux en attente", value: openMateriel.filter((row) => row.blockageType === "materiaux").length },
    { label: "Demandes d'information en attente", value: openInfoRequests.length },
    { label: "Réserves ouvertes", value: openReserves.length },
  ].filter((row) => Number(row.value ?? 0) > 0);

  const blockagesByChantier = filteredChantiers
    .map((chantier) => ({
      label: chantier.nom,
      value:
        openMateriel.filter((row) => row.chantier_id === chantier.id).length +
        openInfoRequests.filter((row) => row.chantier_id === chantier.id).length +
        openReserves.filter((row) => row.chantier_id === chantier.id).length,
    }))
    .filter((row) => Number(row.value ?? 0) > 0)
    .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0))
    .slice(0, 8);

  const checklistValidationRate =
    dataset.availability.dailyChecklists && filteredChecklists.length > 0
      ? toPercent(filteredChecklists.filter((row) => Boolean(row.validated_at)).length, filteredChecklists.length)
      : null;

  const checklistDayKeys = new Set(filteredChecklists.map((row) => `${row.intervenant_id}:${row.checklist_date}`));
  const timeDayKeys = new Set(filteredTimeEntries.map((entry) => `${entry.intervenant_id}:${entry.work_date}`));
  const timeLoggingRate =
    dataset.availability.dailyChecklists && dataset.availability.timeEntries && checklistDayKeys.size > 0
      ? toPercent(Array.from(checklistDayKeys).filter((key) => timeDayKeys.has(key)).length, checklistDayKeys.size)
      : null;

  const resolvedBlockagesForDelay = [
    ...filteredMateriel.filter((row) => !row.open).map((row) => ({ createdAt: row.created_at, resolvedAt: row.resolvedAt })),
    ...filteredInfoRequests.filter((row) => row.status === "traitee").map((row) => ({ createdAt: row.created_at, resolvedAt: row.resolvedAt })),
    ...filteredReserves.filter((row) => !row.open).map((row) => ({ createdAt: row.created_at, resolvedAt: row.resolvedAt })),
  ];
  const averageProcessingDelay = averageDelayDays(resolvedBlockagesForDelay);

  const chantierLastActivity = filteredChantiers.map((chantier) => {
    const timestamps = [
      ...filteredTimeEntries.filter((row) => row.chantier_id === chantier.id).map((row) => row.work_date),
      ...filteredChecklists.filter((row) => row.chantier_id === chantier.id).map((row) => row.checklist_date),
      ...filteredInfoRequests.filter((row) => row.chantier_id === chantier.id).map((row) => row.request_date || row.created_at || ""),
      ...filteredMateriel.filter((row) => row.chantier_id === chantier.id).map((row) => row.created_at || ""),
      ...filteredTasks.filter((row) => row.chantier_id === chantier.id).map((row) => row.updated_at || row.created_at || ""),
    ]
      .map((value) => dateFromString(value))
      .filter((value): value is Date => Boolean(value))
      .sort((a, b) => b.getTime() - a.getTime());
    return {
      chantierId: chantier.id,
      chantierName: chantier.nom,
      lastActivityAt: timestamps[0] ? timestamps[0].toISOString() : null,
      openBlockages:
        openMateriel.filter((row) => row.chantier_id === chantier.id).length +
        openInfoRequests.filter((row) => row.chantier_id === chantier.id).length +
        openReserves.filter((row) => row.chantier_id === chantier.id).length,
    };
  });

  const chantiersWithoutRecentActivity = chantierLastActivity.filter((row) => !row.lastActivityAt || !valueInRange(row.lastActivityAt, recentRange)).slice(0, 8);

  const intervenantActivity = dataset.intervenants
    .filter((intervenant) => !filters.intervenantId || intervenant.id === filters.intervenantId)
    .map((intervenant: IntervenantRow) => {
      const timestamps = [
        ...filteredTimeEntries.filter((row) => row.intervenant_id === intervenant.id).map((row) => row.work_date),
        ...filteredChecklists.filter((row) => row.intervenant_id === intervenant.id).map((row) => row.checklist_date),
        ...filteredInfoRequests.filter((row) => row.intervenant_id === intervenant.id).map((row) => row.request_date || row.created_at || ""),
        ...filteredMateriel.filter((row) => row.intervenant_id === intervenant.id).map((row) => row.created_at || ""),
      ]
        .map((value) => dateFromString(value))
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => b.getTime() - a.getTime());

      const chantierNames = Array.from(
        new Set(
          [
            ...filteredTimeEntries.filter((row) => row.intervenant_id === intervenant.id).map((row) => row.chantier?.nom ?? ""),
            ...filteredChecklists.filter((row) => row.intervenant_id === intervenant.id).map((row) => row.chantier?.nom ?? ""),
            ...filteredInfoRequests.filter((row) => row.intervenant_id === intervenant.id).map((row) => row.chantier?.nom ?? ""),
            ...filteredMateriel.filter((row) => row.intervenant_id === intervenant.id).map((row) => row.chantier?.nom ?? ""),
          ].filter(Boolean),
        ),
      );

      return {
        intervenantId: intervenant.id,
        intervenantName: intervenant.nom,
        lastActivityAt: timestamps[0] ? timestamps[0].toISOString() : null,
        chantierNames,
      };
    });

  const intervenantsWithoutRecentActivity = intervenantActivity
    .filter((row) => row.chantierNames.length > 0 || !filters.intervenantId)
    .filter((row) => !row.lastActivityAt || !valueInRange(row.lastActivityAt, recentRange))
    .slice(0, 8);

  const integrityWarnings = [
    ...dataset.notes,
    ...(
      [
        filteredTimeEntries.filter((entry) => entry.task_id && !entry.task).length > 0
          ? `${filteredTimeEntries.filter((entry) => entry.task_id && !entry.task).length} saisie(s) temps pointent vers une tâche introuvable.`
          : "",
        filteredTimeEntries.filter((entry) => !entry.chantier).length > 0
          ? `${filteredTimeEntries.filter((entry) => !entry.chantier).length} saisie(s) temps pointent vers un chantier introuvable.`
          : "",
        filteredTasks.filter((task) => task.assignedIntervenantIds.some((id) => !intervenantById.has(id))).length > 0
          ? `${filteredTasks.filter((task) => task.assignedIntervenantIds.some((id) => !intervenantById.has(id))).length} tâche(s) référencent un intervenant introuvable.`
          : "",
      ] as string[]
    ).filter(Boolean),
  ];

  const alerts: StatisticsAlert[] = [
    ...chantiersEnRetard.slice(0, 3).map((chantier) => ({
      key: `retard-${chantier.id}`,
      title: "Chantier en retard",
      detail: `${chantier.nom} dépasse sa fin prévue.`,
      tone: "danger" as const,
    })),
    ...(tasksWithoutPlannedHours > 0 ? [{ key: "planned-hours-missing", title: "Temps prévus incomplets", detail: `${tasksWithoutPlannedHours} tâche(s) sans temps prévu fiable.`, tone: "warning" as const }] : []),
    ...(chantiersWithoutRecentActivity.length > 0 ? [{ key: "recent-activity", title: "Activité récente manquante", detail: `${chantiersWithoutRecentActivity.length} chantier(s) sans remontée récente.`, tone: "warning" as const }] : []),
    ...integrityWarnings.slice(0, 3).map((message, index) => ({
      key: `integrity-${index}`,
      title: "Contrôle de cohérence",
      detail: message,
      tone: "info" as const,
    })),
  ];

  const definitions: StatisticsDefinition[] = [
    { key: "global_time_drift", label: "Écart global temps", source: "chantier_tasks.temps_prevu_h + chantier_time_entries.duration_hours (ou chantier_tasks.temps_reel_h si les saisies sont indisponibles)", formula: "Somme temps réel - somme temps prévu ; dérive % = (écart / temps prévu) x 100" },
    { key: "active_intervenants_7d", label: "Intervenants actifs sur 7 jours", source: "chantier_time_entries, intervenant_daily_checklists, materiel_demandes, intervenant_information_requests", formula: "Nombre d'intervenants distincts avec au moins une remontée sur les 7 derniers jours" },
    { key: "task_average_hours", label: "Temps moyen par tâche", source: "chantier_tasks + chantier_time_entries", formula: "Temps réel cumulé des tâches du groupe / nombre d'occurrences du groupe" },
    { key: "processing_delay", label: "Délai moyen de traitement", source: "materiel_demandes, intervenant_information_requests, chantier_reserves", formula: "Moyenne des jours entre création et résolution pour les blocages clôturés" },
    { key: "checklist_validation_rate", label: "Taux de checklists validées", source: "intervenant_daily_checklists", formula: "Nombre de checklists avec validated_at / nombre total de checklists dans le périmètre" },
  ];

  return {
    options,
    notes: [
      "Les types de clientèle et de chantier sont déduits automatiquement à partir des libellés existants quand aucune colonne métier dédiée n'est disponible.",
      "Les dérives temps excluent les tâches sans temps prévu pour éviter un faux pourcentage.",
      ...dataset.notes,
    ],
    integrityWarnings,
    alerts,
    globalActivity: [
      { label: "Chantiers total", value: filteredChantiers.length, help: "Nombre de chantiers dans le périmètre filtré" },
      { label: "Chantiers actifs", value: filteredChantiers.filter((chantier) => chantier.status === "EN_COURS").length },
      { label: "Chantiers terminés", value: filteredChantiers.filter((chantier) => chantier.status === "TERMINE").length },
      { label: "Chantiers en retard", value: chantiersEnRetard.length },
      { label: "Intervenants actifs (7 j)", value: activeIntervenantIds7d.size },
      { label: "Saisies temps (7 j)", value: filteredTimeEntries.filter((row) => valueInRange(row.work_date, recentRange)).length },
      { label: "Blocages ouverts", value: openBlockagesCount },
      { label: "Demandes d'information en attente", value: openInfoRequests.length },
    ],
    performance: {
      summary: [
        { label: "Temps total prévu", value: totalPlannedHours, unit: "h" },
        { label: "Temps total réalisé", value: totalActualHours, unit: "h" },
        { label: "Écart global", value: totalDriftHours, unit: "h" },
        { label: "Écart global %", value: totalDriftPercent, unit: "%" },
      ],
      topChantiers: chantierPerformance,
      topTasks: taskPerformance,
      tasksWithoutPlannedHours,
    },
    taskAnalysis: {
      topTasks: topExactTasks,
      topFamilies: topTaskFamilies,
      byLot: tasksByLot,
      quantityByFamily,
    },
    businessAnalysis: {
      byClientType: clientTypeDistribution,
      byChantierType: chantierTypeDistribution,
      tasksByLot,
      totalTimeByLot,
      averageTimeByLot,
      averageTasksPerChantier,
      averageRealDurationByChantierType,
    },
    quality: {
      summary: [
        { label: "Demandes matériel en attente", value: openMateriel.filter((row) => row.blockageType === "materiel").length },
        { label: "Demandes matériaux en attente", value: openMateriel.filter((row) => row.blockageType === "materiaux").length },
        { label: "Demandes d'information en attente", value: openInfoRequests.length },
        { label: "Délai moyen de traitement", value: averageProcessingDelay, unit: "j" },
        { label: "Checklists validées", value: checklistValidationRate, unit: "%" },
        { label: "Jours avec saisie temps", value: timeLoggingRate, unit: "%" },
      ],
      blockageTypes: blockageTypeDistribution,
      chantiersWithMostBlockages: blockagesByChantier,
      checklistValidationRate,
      timeLoggingRate,
      chantiersWithoutRecentActivity,
      intervenantsWithoutRecentActivity,
    },
    definitions,
    scope: {
      filteredChantiers: filteredChantiers.length,
      filteredTasks: filteredTasks.length,
      filteredTimeEntries: filteredTimeEntries.length,
      periodLabel: periodLabel(filters),
    },
  };
}
