import { supabase } from "../../lib/supabaseClient";
import type { ChantierTaskRow } from "../../services/chantierTasks.service";
import {
  estimateTaskTemplatePreparation,
  getTaskTemplatePreparation,
  type TaskTemplateEquipmentItemRow,
  type TaskTemplateMaterialRatioRow,
} from "../../services/taskTemplatePreparation.service";
import { findLotProfileByName, listTaskTemplateLotProfiles, type TaskTemplateLotProfile } from "../../services/taskTemplateLotProfiles.service";
import { listProductCatalogItems, type ProductCatalogItem } from "../product-catalog";
import { TaskCostEngine, type TaskCostEngineTotals } from "../task-cost-engine/TaskCostEngine";

export type FieldExecutionLogType =
  | "preparation"
  | "execution"
  | "checklist"
  | "quality_control"
  | "safety"
  | "photo"
  | "document"
  | "consumption"
  | "time"
  | "issue"
  | "comment"
  | "completion";

export type FieldExecutionLog = {
  id: string;
  chantierId: string;
  taskId: string;
  intervenantId: string | null;
  logType: FieldExecutionLogType;
  status: "open" | "done" | "blocked" | "skipped" | "review";
  title: string;
  description: string | null;
  payload: Record<string, unknown>;
  plannedValue: number | null;
  actualValue: number | null;
  unit: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type FieldFeedbackInput = {
  chantierId: string;
  taskId?: string | null;
  taskTemplateId?: string | null;
  productId?: string | null;
  intervenantId?: string | null;
  feedbackType?: string;
  workDate?: string | null;
  plannedTimeHours?: number | null;
  actualTimeHours?: number | null;
  plannedQuantity?: number | null;
  actualQuantity?: number | null;
  unit?: string | null;
  missingEquipment?: string[];
  missingProducts?: string[];
  supportProblem?: string | null;
  weatherConditions?: string | null;
  difficulty?: string | null;
  remark?: string | null;
  suggestion?: string | null;
  sourceFeedbackId?: string | null;
  attachments?: unknown[];
};

export type FieldFeedback = FieldFeedbackInput & {
  id: string;
  analysis: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type PhotoRequirement = {
  id: string;
  chantierId: string;
  taskId: string;
  title: string;
  description: string | null;
  phase: "before" | "during" | "after" | "doe" | "quality";
  isRequired: boolean;
  expectedCount: number;
  status: "pending" | "received" | "validated" | "waived";
  source: string | null;
  metadata: Record<string, unknown>;
};

export type DoeRequirement = {
  id: string;
  chantierId: string;
  taskId: string | null;
  productId: string | null;
  title: string;
  requirementType: string;
  isRequired: boolean;
  status: "pending" | "attached" | "validated" | "waived";
  source: string | null;
  metadata: Record<string, unknown>;
};

export type KnowledgeImprovement = {
  id: string;
  improvementType: string;
  chantierId: string | null;
  taskId: string | null;
  taskTemplateId: string | null;
  productId: string | null;
  lot: string | null;
  currentValue: Record<string, unknown>;
  proposedValue: Record<string, unknown>;
  reason: string;
  source: Record<string, unknown>;
  confidence: "high" | "medium" | "low";
  chantierCount: number;
  validationRequired: boolean;
  status: "pending" | "accepted" | "rejected" | "modified" | "archived";
  reviewerComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FieldKnowledgeBundle = {
  taskId: string;
  preparationLogs: FieldExecutionLog[];
  executionLogs: FieldExecutionLog[];
  qualityLogs: FieldExecutionLog[];
  safetyLogs: FieldExecutionLog[];
  feedback: FieldFeedback[];
  photoRequirements: PhotoRequirement[];
  doeRequirements: DoeRequirement[];
  costPlanned: TaskCostEngineTotals;
  costActual: TaskCostEngineTotals;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function nullableText(value: unknown): string | null {
  const valueText = text(value);
  return valueText || null;
}

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => text(item)).filter(Boolean);
}

function normalizeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function taskLot(task: ChantierTaskRow): string | null {
  return nullableText(task.lot) ?? nullableText(task.corps_etat);
}

function productById(products: ProductCatalogItem[]) {
  return new Map(products.map((product) => [product.id, product]));
}

function getProductProcedure(product: ProductCatalogItem | null): string[] {
  return product?.knowledge?.procedure.value ?? [];
}

function getProductControls(product: ProductCatalogItem | null): string[] {
  return product?.knowledge?.controls.value ?? [];
}

function getProductMistakes(product: ProductCatalogItem | null): string[] {
  return product?.knowledge?.commonMistakes.value ?? [];
}

function getProductPpe(product: ProductCatalogItem | null): string[] {
  return product?.knowledge?.PPE.value ?? [];
}

function getProductDoe(product: ProductCatalogItem | null): string[] {
  return product?.knowledge?.doe.value ?? [];
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function rowPayload<T extends Record<string, unknown>>(value: T): T {
  return value;
}

function logRow(
  task: ChantierTaskRow,
  logType: FieldExecutionLogType,
  title: string,
  payload: Record<string, unknown>,
  options: Partial<Pick<FieldExecutionLog, "description" | "plannedValue" | "unit" | "source">> = {},
) {
  return {
    chantier_id: task.chantier_id,
    task_id: task.id,
    intervenant_id: task.intervenant_id,
    log_type: logType,
    status: "open",
    title,
    description: options.description ?? null,
    payload,
    planned_value: options.plannedValue ?? null,
    unit: options.unit ?? null,
    source: options.source ?? null,
  };
}

function photoRow(task: ChantierTaskRow, title: string, phase: PhotoRequirement["phase"], required = true, description?: string | null) {
  return {
    chantier_id: task.chantier_id,
    task_id: task.id,
    title,
    description: description ?? null,
    phase,
    is_required: required,
    expected_count: 1,
    source: "field_knowledge_engine",
    metadata: {},
  };
}

function doeRow(task: ChantierTaskRow, title: string, productId: string | null, type = "technical_document") {
  return {
    chantier_id: task.chantier_id,
    task_id: task.id,
    product_id: productId,
    title,
    requirement_type: type,
    is_required: true,
    source: "product_knowledge",
    metadata: {},
  };
}

function mapLog(row: Record<string, unknown>): FieldExecutionLog {
  return {
    id: String(row.id ?? ""),
    chantierId: String(row.chantier_id ?? ""),
    taskId: String(row.task_id ?? ""),
    intervenantId: nullableText(row.intervenant_id),
    logType: String(row.log_type ?? "execution") as FieldExecutionLogType,
    status: String(row.status ?? "open") as FieldExecutionLog["status"],
    title: String(row.title ?? ""),
    description: nullableText(row.description),
    payload: normalizeObject(row.payload),
    plannedValue: number(row.planned_value),
    actualValue: number(row.actual_value),
    unit: nullableText(row.unit),
    source: nullableText(row.source),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
    completedAt: nullableText(row.completed_at),
  };
}

function mapPhoto(row: Record<string, unknown>): PhotoRequirement {
  return {
    id: String(row.id ?? ""),
    chantierId: String(row.chantier_id ?? ""),
    taskId: String(row.task_id ?? ""),
    title: String(row.title ?? ""),
    description: nullableText(row.description),
    phase: String(row.phase ?? "during") as PhotoRequirement["phase"],
    isRequired: row.is_required !== false,
    expectedCount: number(row.expected_count) ?? 1,
    status: String(row.status ?? "pending") as PhotoRequirement["status"],
    source: nullableText(row.source),
    metadata: normalizeObject(row.metadata),
  };
}

function mapDoe(row: Record<string, unknown>): DoeRequirement {
  return {
    id: String(row.id ?? ""),
    chantierId: String(row.chantier_id ?? ""),
    taskId: nullableText(row.task_id),
    productId: nullableText(row.product_id),
    title: String(row.title ?? ""),
    requirementType: String(row.requirement_type ?? "technical_document"),
    isRequired: row.is_required !== false,
    status: String(row.status ?? "pending") as DoeRequirement["status"],
    source: nullableText(row.source),
    metadata: normalizeObject(row.metadata),
  };
}

function mapFeedback(row: Record<string, unknown>): FieldFeedback {
  return {
    id: String(row.id ?? ""),
    chantierId: String(row.chantier_id ?? ""),
    taskId: nullableText(row.task_id),
    taskTemplateId: nullableText(row.task_template_id),
    productId: nullableText(row.product_id),
    intervenantId: nullableText(row.intervenant_id),
    feedbackType: String(row.feedback_type ?? "field_report"),
    workDate: nullableText(row.work_date),
    plannedTimeHours: number(row.planned_time_hours),
    actualTimeHours: number(row.actual_time_hours),
    plannedQuantity: number(row.planned_quantity),
    actualQuantity: number(row.actual_quantity),
    unit: nullableText(row.unit),
    missingEquipment: stringArray(row.missing_equipment),
    missingProducts: stringArray(row.missing_products),
    supportProblem: nullableText(row.support_problem),
    weatherConditions: nullableText(row.weather_conditions),
    difficulty: nullableText(row.difficulty),
    remark: nullableText(row.remark),
    suggestion: nullableText(row.suggestion),
    sourceFeedbackId: nullableText(row.source_feedback_id),
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    analysis: normalizeObject(row.analysis),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

function mapImprovement(row: Record<string, unknown>): KnowledgeImprovement {
  return {
    id: String(row.id ?? ""),
    improvementType: String(row.improvement_type ?? "other"),
    chantierId: nullableText(row.chantier_id),
    taskId: nullableText(row.task_id),
    taskTemplateId: nullableText(row.task_template_id),
    productId: nullableText(row.product_id),
    lot: nullableText(row.lot),
    currentValue: normalizeObject(row.current_value),
    proposedValue: normalizeObject(row.proposed_value),
    reason: String(row.reason ?? ""),
    source: normalizeObject(row.source),
    confidence: String(row.confidence ?? "low") as KnowledgeImprovement["confidence"],
    chantierCount: number(row.chantier_count) ?? 0,
    validationRequired: row.validation_required !== false,
    status: String(row.status ?? "pending") as KnowledgeImprovement["status"],
    reviewerComment: nullableText(row.reviewer_comment),
    reviewedAt: nullableText(row.reviewed_at),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function createFieldKnowledgeForTask(task: ChantierTaskRow): Promise<FieldKnowledgeBundle | null> {
  if (!task.id || !task.chantier_id) return null;

  const existing = await (supabase as any)
    .from("field_execution_logs")
    .select("id")
    .eq("task_id", task.id)
    .limit(1);
  if (!existing.error && (existing.data ?? []).length > 0) return getFieldKnowledgeForTask(task);

  const [preparation, products, lotProfiles] = await Promise.all([
    task.task_template_id ? getTaskTemplatePreparation(task.task_template_id) : Promise.resolve({ schemaReady: true, materials: [] as TaskTemplateMaterialRatioRow[], equipment: [] as TaskTemplateEquipmentItemRow[] }),
    listProductCatalogItems().catch(() => [] as ProductCatalogItem[]),
    listTaskTemplateLotProfiles().catch(() => [] as TaskTemplateLotProfile[]),
  ]);

  const productMap = productById(products);
  const lotProfile = findLotProfileByName(lotProfiles, taskLot(task));
  const estimate = estimateTaskTemplatePreparation(task, preparation.materials, preparation.equipment);
  const materialLogs = estimate.materials.map((material) => {
    const source = preparation.materials.find((row) => row.id === material.id) ?? null;
    const product = source?.product_id ? productMap.get(source.product_id) ?? null : null;
    return logRow(task, "preparation", material.material_name, rowPayload({
      kind: "material",
      productId: source?.product_id ?? null,
      plannedQuantity: material.estimated_quantity,
      baseQuantity: material.base_quantity,
      ratioQuantity: material.ratio_quantity,
      ratioUnit: material.ratio_unit,
      lossPercent: material.loss_percent,
      purchasePriceHt: source?.purchase_price_ht ?? null,
      salePriceHt: source?.sale_price_ht ?? null,
      location: task.zone_id ?? null,
      productKnowledge: product?.knowledge ?? null,
    }), {
      plannedValue: material.estimated_quantity,
      unit: material.ratio_unit,
      source: "task_template_material_ratio",
    });
  });

  const equipmentNames = unique([
    ...estimate.equipment.map((item) => item.equipment_name),
    ...(lotProfile?.defaultEquipment ?? []),
  ]);
  const equipmentLogs = equipmentNames.map((name) => logRow(task, "preparation", name, rowPayload({ kind: "equipment", sourceLot: lotProfile?.name ?? null }), { source: "lot_or_template_equipment" }));
  const ppeLogs = unique([
    ...(lotProfile?.defaultPpe ?? []),
    ...preparation.materials.flatMap((material) => getProductPpe(material.product_id ? productMap.get(material.product_id) ?? null : null)),
  ]).map((name) => logRow(task, "safety", name, rowPayload({ kind: "ppe" }), { source: "product_or_lot_knowledge" }));
  const consumableLogs = (lotProfile?.defaultConsumables ?? []).map((name) => logRow(task, "preparation", name, rowPayload({ kind: "consumable" }), { source: "lot_knowledge" }));

  const procedureItems = unique([
    ...preparation.materials.flatMap((material) => getProductProcedure(material.product_id ? productMap.get(material.product_id) ?? null : null)),
    ...stringArray(task.caracteristiques),
  ]);
  const procedureLogs = procedureItems.map((title, index) => logRow(task, "execution", title, rowPayload({
    kind: "procedure_step",
    order: index + 1,
    objective: title,
    estimatedDurationHours: null,
    equipment: equipmentNames,
    control: null,
    risk: null,
  }), { source: "product_knowledge" }));

  const controlLogs = unique([
    ...(lotProfile?.qualityControls ?? []),
    ...preparation.materials.flatMap((material) => getProductControls(material.product_id ? productMap.get(material.product_id) ?? null : null)),
    ...text(task.points_controle).split(/\r?\n/),
  ]).map((title) => logRow(task, "quality_control", title, rowPayload({ kind: "quality_control" }), { source: "product_lot_or_task" }));

  const mistakeLogs = unique([
    ...(lotProfile?.commonMistakes ?? []),
    ...preparation.materials.flatMap((material) => getProductMistakes(material.product_id ? productMap.get(material.product_id) ?? null : null)),
  ]).map((title) => logRow(task, "quality_control", `Erreur a eviter: ${title}`, rowPayload({ kind: "common_mistake" }), { source: "product_or_lot_knowledge" }));

  const logs = [...materialLogs, ...equipmentLogs, ...consumableLogs, ...ppeLogs, ...procedureLogs, ...controlLogs, ...mistakeLogs];
  if (logs.length) {
    const { error } = await (supabase as any).from("field_execution_logs").insert(logs);
    if (error) throw new Error(error.message);
  }

  const photoRows = [
    photoRow(task, "Avant intervention", "before", true, "Etat initial et support avant travaux."),
    photoRow(task, "Pendant intervention", "during", false, "Etape intermediaire utile au suivi."),
    photoRow(task, "Apres intervention", "after", true, "Resultat final visible."),
    photoRow(task, "Controle qualite", "quality", true, "Point de controle principal."),
  ];
  const { error: photoError } = await (supabase as any).from("photo_requirements").insert(photoRows);
  if (photoError) throw new Error(photoError.message);

  const doeRows = preparation.materials.flatMap((material) => {
    const product = material.product_id ? productMap.get(material.product_id) ?? null : null;
    return getProductDoe(product).map((title) => doeRow(task, title, material.product_id ?? null));
  });
  const lotDoeRows = (lotProfile?.doeDocuments ?? []).map((title) => doeRow(task, title, null));
  if (doeRows.length || lotDoeRows.length) {
    const { error } = await (supabase as any).from("doe_requirements").insert([...doeRows, ...lotDoeRows]);
    if (error) throw new Error(error.message);
  }

  return getFieldKnowledgeForTask(task);
}

export async function getFieldKnowledgeForTask(task: Pick<ChantierTaskRow, "id" | "chantier_id" | "task_template_id" | "quantite" | "unite" | "temps_prevu_h">): Promise<FieldKnowledgeBundle> {
  const [logsRes, feedbackRes, photosRes, doeRes] = await Promise.all([
    (supabase as any).from("field_execution_logs").select("*").eq("task_id", task.id).order("created_at", { ascending: true }),
    (supabase as any).from("field_feedback").select("*").eq("task_id", task.id).order("created_at", { ascending: false }),
    (supabase as any).from("photo_requirements").select("*").eq("task_id", task.id).order("created_at", { ascending: true }),
    (supabase as any).from("doe_requirements").select("*").eq("task_id", task.id).order("created_at", { ascending: true }),
  ]);
  for (const result of [logsRes, feedbackRes, photosRes, doeRes]) {
    if (result.error) throw new Error(result.error.message);
  }

  const logs = ((logsRes.data ?? []) as Record<string, unknown>[]).map(mapLog);
  const feedback = ((feedbackRes.data ?? []) as Record<string, unknown>[]).map(mapFeedback);
  const costPlanned = TaskCostEngine.calculate({
    materials: logs.filter((log) => log.logType === "preparation" && log.payload.kind === "material").map((log) => ({
      quantity: number(log.payload.plannedQuantity),
      unitCostHt: number(log.payload.purchasePriceHt),
      unitSaleHt: number(log.payload.salePriceHt),
      lossPercent: 0,
    })),
    labor: [{ durationHours: number(task.temps_prevu_h), hourlyCostHt: 0, hourlySaleHt: 0 }],
    estimatedTimeHours: number(task.temps_prevu_h),
  });
  const costActual = TaskCostEngine.calculate({
    materials: feedback.filter((row) => row.actualQuantity !== null).map((row) => ({
      quantity: row.actualQuantity,
      unitCostHt: 0,
      unitSaleHt: 0,
    })),
    labor: [{ durationHours: feedback.reduce((sum, row) => sum + (row.actualTimeHours ?? 0), 0), hourlyCostHt: 0, hourlySaleHt: 0 }],
  });

  return {
    taskId: task.id,
    preparationLogs: logs.filter((log) => log.logType === "preparation"),
    executionLogs: logs.filter((log) => log.logType === "execution"),
    qualityLogs: logs.filter((log) => log.logType === "quality_control"),
    safetyLogs: logs.filter((log) => log.logType === "safety"),
    feedback,
    photoRequirements: ((photosRes.data ?? []) as Record<string, unknown>[]).map(mapPhoto),
    doeRequirements: ((doeRes.data ?? []) as Record<string, unknown>[]).map(mapDoe),
    costPlanned,
    costActual,
  };
}

export async function updateFieldExecutionLog(id: string, patch: Partial<Pick<FieldExecutionLog, "status" | "actualValue" | "description">>): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (patch.status !== undefined) {
    payload.status = patch.status;
    if (patch.status === "done") payload.completed_at = new Date().toISOString();
  }
  if (patch.actualValue !== undefined) payload.actual_value = patch.actualValue;
  if (patch.description !== undefined) payload.description = patch.description;
  const { error } = await (supabase as any).from("field_execution_logs").update(payload).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function createFieldFeedback(input: FieldFeedbackInput): Promise<FieldFeedback> {
  const payload = {
    chantier_id: input.chantierId,
    task_id: input.taskId ?? null,
    task_template_id: input.taskTemplateId ?? null,
    product_id: input.productId ?? null,
    intervenant_id: input.intervenantId ?? null,
    feedback_type: input.feedbackType ?? "field_report",
    work_date: input.workDate ?? null,
    planned_time_hours: input.plannedTimeHours ?? null,
    actual_time_hours: input.actualTimeHours ?? null,
    planned_quantity: input.plannedQuantity ?? null,
    actual_quantity: input.actualQuantity ?? null,
    unit: input.unit ?? null,
    missing_equipment: input.missingEquipment ?? [],
    missing_products: input.missingProducts ?? [],
    support_problem: input.supportProblem ?? null,
    weather_conditions: input.weatherConditions ?? null,
    difficulty: input.difficulty ?? null,
    remark: input.remark ?? null,
    suggestion: input.suggestion ?? null,
    source_feedback_id: input.sourceFeedbackId ?? null,
    attachments: input.attachments ?? [],
  };
  const { data, error } = await (supabase as any).from("field_feedback").insert([payload]).select("*").single();
  if (error) throw new Error(error.message);
  return mapFeedback(data);
}

export async function summarizeFieldFeedback(taskId: string): Promise<Record<string, unknown>> {
  const bundle = await getFieldKnowledgeForTask({ id: taskId, chantier_id: "", task_template_id: null, quantite: null, unite: null, temps_prevu_h: null });
  const { data, error } = await supabase.functions.invoke("summarize-field-feedback", { body: { taskId, bundle } });
  if (error) throw error;
  return normalizeObject((data as { summary?: unknown } | null)?.summary);
}

export async function proposeTemplateImprovements(taskId: string): Promise<KnowledgeImprovement[]> {
  const bundle = await getFieldKnowledgeForTask({ id: taskId, chantier_id: "", task_template_id: null, quantite: null, unite: null, temps_prevu_h: null });
  const { data, error } = await supabase.functions.invoke("propose-template-improvements", { body: { taskId, bundle } });
  if (error) throw error;
  const improvements = Array.isArray((data as any)?.improvements) ? (data as any).improvements : [];
  return improvements.map(mapImprovement);
}

export async function listKnowledgeImprovements(status: KnowledgeImprovement["status"] | "all" = "pending"): Promise<KnowledgeImprovement[]> {
  let query = (supabase as any).from("knowledge_improvements").select("*").order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapImprovement);
}

export async function reviewKnowledgeImprovement(id: string, status: "accepted" | "rejected" | "modified", proposedValue?: Record<string, unknown>, reviewerComment?: string | null): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    reviewer_comment: reviewerComment ?? null,
    reviewed_at: new Date().toISOString(),
  };
  if (proposedValue) patch.proposed_value = proposedValue;
  const { error } = await (supabase as any).from("knowledge_improvements").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
