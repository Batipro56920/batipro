import { supabase } from "../../lib/supabaseClient";
import { listProductCatalogItems, saveProductCatalogItem, type ProductCatalogItem } from "../product-catalog";
import { update as updateTaskTemplate } from "../../services/taskTemplates.service";
import { replaceTaskTemplatePreparation } from "../../services/taskTemplatePreparation.service";
import { TaskCostEngine } from "../task-cost-engine/TaskCostEngine";

export type KnowledgeTargetType = "product" | "task_template" | "lot_profile" | "field_knowledge" | "other";
export type KnowledgeChangeAction = "simulated" | "accepted" | "rejected" | "modified" | "applied" | "rollback";

export type KnowledgeImpactSimulation = {
  id: string;
  improvementId: string | null;
  targetType: KnowledgeTargetType;
  targetId: string;
  impactedProducts: number;
  impactedTemplates: number;
  impactedQuotes: number;
  impactedChantiers: number;
  impactedDoe: number;
  costBefore: Record<string, unknown> | null;
  costAfter: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  warnings: string[];
  createdBy: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export type KnowledgeApplyResult = {
  versionId: string | null;
  targetType: KnowledgeTargetType;
  targetId: string;
  action: "applied" | "rollback";
  appliedValue: unknown;
  versionNumber: number;
  createdAt: string;
};

export type KnowledgeVersion = {
  id: string;
  targetType: KnowledgeTargetType;
  targetId: string;
  versionNumber: number;
  previousVersionId: string | null;
  snapshot: Record<string, unknown>;
  changeSource: string;
  improvementId: string | null;
  createdBy: string | null;
  createdAt: string;
  reason: string | null;
  confidence: string | null;
  metadata: Record<string, unknown>;
};

export type KnowledgeAuditEntry = {
  id: string;
  improvementId: string | null;
  targetType: KnowledgeTargetType;
  targetId: string;
  action: KnowledgeChangeAction;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  actorId: string | null;
  actorLabel: string | null;
  reason: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
};

type KnowledgeImprovementRow = {
  id: string;
  improvement_type: string;
  product_id: string | null;
  task_template_id: string | null;
  template_id: string | null;
  lot_profile_id: string | null;
  field_feedback_id: string | null;
  field_execution_id: string | null;
  target_type: string | null;
  target_id: string | null;
  lot: string | null;
  current_value: unknown;
  proposed_value: unknown;
  proposed_patch: unknown;
  payload: unknown;
  metadata: unknown;
  reason: string;
  source: unknown;
  confidence: string;
  chantier_count: number;
  status: string;
  reviewer_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

type KnowledgeVersionRow = {
  id: string;
  target_type: string;
  target_id: string;
  version_number: number;
  previous_version_id: string | null;
  snapshot: Record<string, unknown>;
  change_source: string;
  improvement_id: string | null;
  created_by: string | null;
  created_at: string;
  reason: string | null;
  confidence: string | null;
  metadata: Record<string, unknown> | null;
};

type KnowledgeAuditRow = {
  id: string;
  improvement_id: string | null;
  target_type: string;
  target_id: string;
  action: string;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  actor_id: string | null;
  actor_label: string | null;
  reason: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function readValue(row: Record<string, unknown>, candidates: string[]): unknown {
  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.includes(".")) {
      const parts = candidate.split(".");
      let current: unknown = row;
      let found = true;
      for (const part of parts) {
        if (!isPlainObject(current) || !(part in current)) {
          found = false;
          break;
        }
        current = current[part];
      }
      if (found) return current;
      continue;
    }
    if (candidate in row) return row[candidate];
  }
  return undefined;
}

function normalizeImprovementValue(value: unknown): Record<string, unknown> {
  if (isPlainObject(value)) return value;
  return { value };
}

function inferTargetType(row: Record<string, unknown>): KnowledgeTargetType {
  const rawType = normalizeText(readValue(row, ["target_type", "targetType", "type", "target"]));
  const normalized = rawType?.toLowerCase() ?? "";
  if (normalized.includes("product") || normalized.includes("material_usage") || normalized.includes("ratio")) return "product";
  if (normalized.includes("template") || normalized.includes("task") || normalized.includes("task_template")) return "task_template";
  if (normalized.includes("lot_profile") || normalized.includes("trade_profile") || normalized.includes("lot")) return "lot_profile";
  if (normalized.includes("field_knowledge") || normalized.includes("field_feedback") || normalized.includes("field_execution")) return "field_knowledge";

  if (normalizeText(readValue(row, ["product_id", "productId"])) || normalizeText(readValue(row, ["product.id", "product.id"]))) return "product";
  if (normalizeText(readValue(row, ["task_template_id", "template_id", "taskTemplateId", "templateId"])) || normalizeText(readValue(row, ["task_template.id", "template.id"]))) return "task_template";
  if (normalizeText(readValue(row, ["lot_profile_id", "lotProfileId", "lot_profile.id", "trade_profile.id"])) || normalizeText(readValue(row, ["lot_profile.id", "lot_id", "lotId"]))) return "lot_profile";
  if (normalizeText(readValue(row, ["field_feedback_id", "fieldFeedbackId", "field_execution_id", "fieldExecutionId"])) || normalizeText(readValue(row, ["field_feedback.id", "field_feedback_id"]))) return "field_knowledge";

  return "other";
}

function inferTargetId(row: Record<string, unknown>): string | null {
  return normalizeText(readValue(row, ["target_id", "targetId", "target.id", "product_id", "productId", "task_template_id", "taskTemplateId", "template_id", "templateId", "lot_profile_id", "lotProfileId", "lot_id", "lotId", "field_feedback_id", "fieldFeedbackId", "field_execution_id", "fieldExecutionId"]));
}

function mergeValues(current: unknown, incoming: unknown): unknown {
  if (isPlainObject(current) && isPlainObject(incoming)) {
    const merged = clone(current) as Record<string, unknown>;
    for (const [key, value] of Object.entries(incoming)) {
      if (key in merged) {
        merged[key] = mergeValues(merged[key], value);
      } else {
        merged[key] = clone(value);
      }
    }
    return merged;
  }
  return clone(incoming);
}

function normalizeTargetType(value: string | null | undefined): KnowledgeTargetType {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "product" || normalized === "product_knowledge" || normalized === "material_usage" || normalized === "ratio") return "product";
  if (normalized === "task_template" || normalized === "template" || normalized === "task") return "task_template";
  if (normalized === "lot_profile" || normalized === "trade_profile" || normalized === "lot") return "lot_profile";
  if (normalized === "field_knowledge" || normalized === "field_feedback" || normalized === "field_execution") return "field_knowledge";
  return "other";
}

function normalizeImprovement(row: KnowledgeImprovementRow) {
  const payload = isPlainObject(row.payload) ? row.payload : {};
  const metadata = isPlainObject(row.metadata) ? row.metadata : {};
  const currentValue = readValue(row, ["current_value", "currentValue", "payload.current_value", "payload.currentValue"]);
  const proposedValue = readValue(row, ["proposed_value", "proposedValue", "proposed_patch", "proposedPatch", "payload.proposed_value", "payload.proposedValue", "payload.proposed_patch"]);
  const targetType = inferTargetType(row);
  const targetId = inferTargetId(row);

  return {
    id: String(row.id ?? ""),
    improvementType: String(row.improvement_type ?? row.improvementType ?? "other"),
    productId: targetType === "product" ? targetId : normalizeText(readValue(row, ["product_id", "productId"])) ?? null,
    taskTemplateId: targetType === "task_template" ? targetId : normalizeText(readValue(row, ["task_template_id", "taskTemplateId", "template_id", "templateId"])) ?? null,
    lot: normalizeText(readValue(row, ["lot", "lot_name", "lotName"])) ?? null,
    currentValue: normalizeImprovementValue(currentValue ?? readValue(payload, ["current_value", "currentValue"]) ?? readValue(metadata, ["current_value", "currentValue"])),
    proposedValue: normalizeImprovementValue(proposedValue ?? readValue(payload, ["proposed_value", "proposedValue", "proposed_patch", "proposedPatch"]) ?? readValue(metadata, ["proposed_value", "proposedValue", "proposed_patch", "proposedPatch"])),
    reason: String(readValue(row, ["reason", "review_reason", "comment"]) ?? ""),
    source: isPlainObject(readValue(row, ["source", "payload.source", "metadata.source"])) ? (readValue(row, ["source", "payload.source", "metadata.source"]) as Record<string, unknown>) : {},
    confidence: (String(readValue(row, ["confidence", "metadata.confidence"]) ?? "low") as "high" | "medium" | "low") ?? "low",
    chantierCount: Number(readValue(row, ["chantier_count", "chantierCount", "metadata.chantier_count"]) ?? 0),
    status: String(readValue(row, ["status"]) ?? "pending") as "pending" | "accepted" | "rejected" | "modified" | "archived",
    reviewerComment: normalizeText(readValue(row, ["reviewer_comment", "reviewerComment"])),
    reviewedAt: normalizeText(readValue(row, ["reviewed_at", "reviewedAt"])),
    createdAt: normalizeText(readValue(row, ["created_at", "createdAt"])) ?? "",
    updatedAt: normalizeText(readValue(row, ["updated_at", "updatedAt"])) ?? "",
    targetType,
    targetId,
  };
}

function normalizeVersion(row: KnowledgeVersionRow): KnowledgeVersion {
  return {
    id: row.id,
    targetType: normalizeTargetType(row.target_type),
    targetId: row.target_id,
    versionNumber: row.version_number,
    previousVersionId: row.previous_version_id,
    snapshot: isPlainObject(row.snapshot) ? row.snapshot : { value: row.snapshot },
    changeSource: row.change_source,
    improvementId: row.improvement_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
    reason: row.reason,
    confidence: row.confidence,
    metadata: isPlainObject(row.metadata) ? row.metadata : {},
  };
}

function normalizeAudit(row: KnowledgeAuditRow): KnowledgeAuditEntry {
  return {
    id: row.id,
    improvementId: row.improvement_id,
    targetType: normalizeTargetType(row.target_type),
    targetId: row.target_id,
    action: row.action as KnowledgeChangeAction,
    beforeSnapshot: isPlainObject(row.before_snapshot) ? row.before_snapshot : null,
    afterSnapshot: isPlainObject(row.after_snapshot) ? row.after_snapshot : null,
    diff: isPlainObject(row.diff) ? row.diff : null,
    actorId: row.actor_id,
    actorLabel: row.actor_label,
    reason: row.reason,
    createdAt: row.created_at,
    metadata: isPlainObject(row.metadata) ? row.metadata : {},
  };
}

async function getImprovement(improvementId: string) {
  const { data, error } = await (supabase as any)
    .from("knowledge_improvements")
    .select("*")
    .eq("id", improvementId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Amélioration IA introuvable.");
  return normalizeImprovement(data as KnowledgeImprovementRow);
}

async function getVersionById(versionId: string) {
  const { data, error } = await (supabase as any)
    .from("knowledge_versions")
    .select("*")
    .eq("id", versionId)
    .single();

  if (error) throw new Error(error.message);
  return data ? normalizeVersion(data as KnowledgeVersionRow) : null;
}

async function getLatestVersion(targetType: KnowledgeTargetType, targetId: string) {
  const { data, error } = await (supabase as any)
    .from("knowledge_versions")
    .select("*")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? normalizeVersion(data as KnowledgeVersionRow) : null;
}

async function getNextVersionNumber(targetType: KnowledgeTargetType, targetId: string) {
  const latest = await getLatestVersion(targetType, targetId);
  return latest ? latest.versionNumber + 1 : 1;
}

async function createVersion(payload: {
  targetType: KnowledgeTargetType;
  targetId: string;
  versionNumber: number;
  previousVersionId: string | null;
  snapshot: Record<string, unknown>;
  changeSource: string;
  improvementId: string | null;
  createdBy: string | null;
  reason: string | null;
  confidence: string | null;
  metadata: Record<string, unknown>;
}) {
  const { data, error } = await (supabase as any)
    .from("knowledge_versions")
    .insert({
      target_type: payload.targetType,
      target_id: payload.targetId,
      version_number: payload.versionNumber,
      previous_version_id: payload.previousVersionId,
      snapshot: payload.snapshot,
      change_source: payload.changeSource,
      improvement_id: payload.improvementId,
      created_by: payload.createdBy,
      reason: payload.reason,
      confidence: payload.confidence,
      metadata: payload.metadata,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return normalizeVersion(data as KnowledgeVersionRow);
}

async function createAuditEntry(payload: {
  improvementId: string | null;
  targetType: KnowledgeTargetType;
  targetId: string;
  action: KnowledgeChangeAction;
  beforeSnapshot: Record<string, unknown> | null;
  afterSnapshot: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  actorId: string | null;
  actorLabel: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
}) {
  const { error } = await (supabase as any).from("knowledge_change_audit").insert({
    improvement_id: payload.improvementId,
    target_type: payload.targetType,
    target_id: payload.targetId,
    action: payload.action,
    before_snapshot: payload.beforeSnapshot,
    after_snapshot: payload.afterSnapshot,
    diff: payload.diff,
    actor_id: payload.actorId,
    actor_label: payload.actorLabel,
    reason: payload.reason,
    metadata: payload.metadata,
  });

  if (error) throw new Error(error.message);
}

async function upsertSimulation(payload: {
  improvementId: string | null;
  targetType: KnowledgeTargetType;
  targetId: string;
  impactedProducts: number;
  impactedTemplates: number;
  impactedQuotes: number;
  impactedChantiers: number;
  impactedDoe: number;
  costBefore: Record<string, unknown> | null;
  costAfter: Record<string, unknown> | null;
  diff: Record<string, unknown> | null;
  warnings: string[];
  createdBy: string | null;
  metadata: Record<string, unknown>;
}) {
  const { data, error } = await (supabase as any)
    .from("knowledge_impact_simulations")
    .insert({
      improvement_id: payload.improvementId,
      target_type: payload.targetType,
      target_id: payload.targetId,
      impacted_products: payload.impactedProducts,
      impacted_templates: payload.impactedTemplates,
      impacted_quotes: payload.impactedQuotes,
      impacted_chantiers: payload.impactedChantiers,
      impacted_doe: payload.impactedDoe,
      cost_before: payload.costBefore,
      cost_after: payload.costAfter,
      diff: payload.diff,
      warnings: payload.warnings,
      created_by: payload.createdBy,
      metadata: payload.metadata,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return {
    id: data.id,
    improvementId: data.improvement_id,
    targetType: normalizeTargetType(data.target_type),
    targetId: data.target_id,
    impactedProducts: Number(data.impacted_products ?? 0),
    impactedTemplates: Number(data.impacted_templates ?? 0),
    impactedQuotes: Number(data.impacted_quotes ?? 0),
    impactedChantiers: Number(data.impacted_chantiers ?? 0),
    impactedDoe: Number(data.impacted_doe ?? 0),
    costBefore: isPlainObject(data.cost_before) ? data.cost_before : null,
    costAfter: isPlainObject(data.cost_after) ? data.cost_after : null,
    diff: isPlainObject(data.diff) ? data.diff : null,
    warnings: Array.isArray(data.warnings) ? data.warnings.filter((entry: unknown): entry is string => typeof entry === "string") : [],
    createdBy: data.created_by,
    createdAt: data.created_at,
    metadata: isPlainObject(data.metadata) ? data.metadata : {},
  } satisfies KnowledgeImpactSimulation;
}

async function applyToTarget(targetType: KnowledgeTargetType, targetId: string, proposedValue: unknown) {
  const normalized = proposedValue === undefined ? null : proposedValue;

  if (targetType === "product") {
    const products = await listProductCatalogItems();
    const currentProduct = products.find((product) => product.id === targetId) ?? null;
    if (!currentProduct) throw new Error("Produit introuvable.");

    const patch = isPlainObject(normalized) ? normalized : { value: normalized };
    const nextKnowledge = mergeValues(currentProduct.knowledge ?? {}, patch as Record<string, unknown>);
    const nextProduct: ProductCatalogItem = {
      ...currentProduct,
      knowledge: nextKnowledge as ProductCatalogItem["knowledge"],
      updatedAt: new Date().toISOString(),
    };

    await saveProductCatalogItem(nextProduct, "knowledge manager");

    return {
      snapshot: {
        targetType,
        targetId,
        data: nextProduct,
      },
      appliedValue: nextKnowledge,
    };
  }

  if (targetType === "task_template") {
    const { data: templateRow, error: templateError } = await (supabase as any)
      .from("task_templates")
      .select("id, titre, lot, unite, quantite_defaut, temps_prevu_par_unite_h, remarques")
      .eq("id", targetId)
      .single();

    if (templateError) throw new Error(templateError.message);

    const patch = isPlainObject(normalized) ? normalized : { value: normalized };
    const nextPayload: Record<string, unknown> = {};
    const mappedKeys: Record<string, string> = {
      title: "titre",
      titre: "titre",
      lot: "lot",
      unit: "unite",
      unite: "unite",
      quantity: "quantite_defaut",
      quantite_defaut: "quantite_defaut",
      quantityDefault: "quantite_defaut",
      hours: "temps_prevu_par_unite_h",
      temps_prevu_par_unite_h: "temps_prevu_par_unite_h",
      remarks: "remarques",
      remarques: "remarques",
      notes: "remarques",
      time: "temps_prevu_par_unite_h",
      cost: "remarques",
    };

    for (const [key, value] of Object.entries(patch)) {
      const targetKey = mappedKeys[key] ?? key;
      if (targetKey === "remarques" && key !== "remarques" && key !== "notes") {
        continue;
      }
      if (targetKey in (templateRow ?? {})) {
        nextPayload[targetKey] = value;
      }
    }

    if (Array.isArray(patch.materials) || Array.isArray(patch.equipment)) {
      const materials = Array.isArray(patch.materials)
        ? patch.materials
            .filter(isPlainObject)
            .map((item) => ({
              product_id: normalizeText(item.product_id),
              material_name: normalizeText(item.material_name) ?? "Matériau",
              source_unit: normalizeText(item.source_unit) ?? "u",
              ratio_quantity: normalizeNumber(item.ratio_quantity) ?? 1,
              ratio_unit: normalizeText(item.ratio_unit) ?? "u",
              loss_percent: normalizeNumber(item.loss_percent),
              supplier_id: normalizeText(item.supplier_id),
              purchase_price_ht: normalizeNumber(item.purchase_price_ht),
              sale_price_ht: normalizeNumber(item.sale_price_ht),
              price_source: normalizeText(item.price_source),
              manual_override: item.manual_override === true,
              notes: normalizeText(item.notes),
              sort_order: normalizeNumber(item.sort_order) ?? 0,
            }))
        : [];
      const equipment = Array.isArray(patch.equipment)
        ? patch.equipment
            .filter(isPlainObject)
            .map((item) => ({
              equipment_name: normalizeText(item.equipment_name) ?? "Équipement",
              is_required: item.is_required === true,
              default_quantity: normalizeNumber(item.default_quantity) ?? 1,
              unit: normalizeText(item.unit),
              notes: normalizeText(item.notes),
              sort_order: normalizeNumber(item.sort_order) ?? 0,
            }))
        : [];

      await replaceTaskTemplatePreparation(targetId, { materials, equipment });
    }

    const remarkPayload: Record<string, unknown> = {};
    if (patch.procedure !== undefined) remarkPayload.procedure = patch.procedure;
    if (patch.controls !== undefined) remarkPayload.controls = patch.controls;
    if (patch.fieldReturns !== undefined) remarkPayload.fieldReturns = patch.fieldReturns;
    if (patch.time !== undefined) remarkPayload.time = patch.time;
    if (patch.cost !== undefined) remarkPayload.cost = patch.cost;
    if (patch.modeOperatoire !== undefined) remarkPayload.modeOperatoire = patch.modeOperatoire;
    if (patch.notes !== undefined) remarkPayload.notes = patch.notes;
    if (Object.keys(remarkPayload).length > 0) {
      const existingRemarks = normalizeText(templateRow?.remarques) ?? "";
      const nextRemarks = [existingRemarks, JSON.stringify(remarkPayload)].filter(Boolean).join("\n\n");
      nextPayload.remarques = nextRemarks;
    }

    if (Object.keys(nextPayload).length > 0) {
      await updateTaskTemplate(targetId, {
        titre: normalizeText(nextPayload.titre) ?? normalizeText(templateRow?.titre) ?? "Template",
        lot: normalizeText(nextPayload.lot) ?? normalizeText(templateRow?.lot),
        unite: normalizeText(nextPayload.unite) ?? normalizeText(templateRow?.unite),
        quantite_defaut: normalizeNumber(nextPayload.quantite_defaut) ?? normalizeNumber(templateRow?.quantite_defaut),
        temps_prevu_par_unite_h: normalizeNumber(nextPayload.temps_prevu_par_unite_h) ?? normalizeNumber(templateRow?.temps_prevu_par_unite_h),
        remarques: normalizeText(nextPayload.remarques) ?? normalizeText(templateRow?.remarques),
      });
    }

    const { data: refreshedTemplate, error: refreshedError } = await (supabase as any)
      .from("task_templates")
      .select("id, titre, lot, unite, quantite_defaut, temps_prevu_par_unite_h, remarques")
      .eq("id", targetId)
      .single();

    if (refreshedError) throw new Error(refreshedError.message);

    return {
      snapshot: {
        targetType,
        targetId,
        data: {
          id: targetId,
          ...(refreshedTemplate ?? {}),
        },
      },
      appliedValue: nextPayload,
    };
  }

  if (targetType === "lot_profile") {
    const { data: profileRow, error: profileError } = await (supabase as any)
      .from("task_template_lot_profiles")
      .select("*")
      .eq("id", targetId)
      .single();

    if (profileError) throw new Error(profileError.message);
    const patch = isPlainObject(normalized) ? normalized : { value: normalized };
    const nextPayload: Record<string, unknown> = {};
    const mappedKeys: Record<string, string> = {
      name: "name",
      keywords: "keywords",
      laborMarginRate: "labor_margin_rate",
      equipmentMarginRate: "equipment_margin_rate",
      materialsMarginRate: "materials_margin_rate",
      feesMarginRate: "fees_margin_rate",
      defaultUnit: "default_unit",
      averageTimeHours: "average_time_hours",
      qualityControls: "quality_controls",
      commonMistakes: "common_mistakes",
      chantierInstructions: "chantier_instructions",
      defaultEquipment: "default_equipment",
      defaultPpe: "default_ppe",
      defaultConsumables: "default_consumables",
      doeDocuments: "doe_documents",
      fieldReturns: "field_returns",
      sortOrder: "sort_order",
      isActive: "is_active",
    };

    for (const [key, value] of Object.entries(patch)) {
      const targetKey = mappedKeys[key] ?? key;
      if (targetKey in (profileRow ?? {})) {
        nextPayload[targetKey] = value;
      }
    }

    const { error: updateError } = await (supabase as any)
      .from("task_template_lot_profiles")
      .update({ ...nextPayload, updated_at: new Date().toISOString() })
      .eq("id", targetId);

    if (updateError) throw new Error(updateError.message);

    return {
      snapshot: {
        targetType,
        targetId,
        data: {
          id: targetId,
          ...(profileRow ?? {}),
          ...nextPayload,
        },
      },
      appliedValue: nextPayload,
    };
  }

  if (targetType === "field_knowledge") {
    const { data: feedbackRow, error: feedbackError } = await (supabase as any)
      .from("field_feedback")
      .select("*")
      .eq("id", targetId)
      .single();

    if (feedbackError) throw new Error(feedbackError.message);

    const patch = isPlainObject(normalized) ? normalized : { value: normalized };
    const nextAnalysis = mergeValues(isPlainObject(feedbackRow?.analysis) ? feedbackRow.analysis : {}, {
      knowledgeManager: {
        integrated: true,
        appliedAt: new Date().toISOString(),
        patch,
      },
    });

    const { error: updateError } = await (supabase as any)
      .from("field_feedback")
      .update({ analysis: nextAnalysis, updated_at: new Date().toISOString() })
      .eq("id", targetId);

    if (updateError) throw new Error(updateError.message);

    return {
      snapshot: {
        targetType,
        targetId,
        data: {
          id: targetId,
          ...(feedbackRow ?? {}),
          analysis: nextAnalysis,
        },
      },
      appliedValue: nextAnalysis,
    };
  }

  return {
    snapshot: {
      targetType,
      targetId,
      data: { targetType, targetId, value: normalized },
    },
    appliedValue: normalized,
  };
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Erreur inconnue.";
}

function isSecurityPolicyError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes("policy") || message.includes("row-level security") || message.includes("permission denied") || message.includes("not authorized");
}

function throwIfPolicyError(error: unknown, fallback: string): never {
  if (isSecurityPolicyError(error)) {
    throw new Error("Accès refusé par les politiques de sécurité. Un administrateur doit valider cette opération.");
  }
  throw new Error(getErrorMessage(error) || fallback);
}

async function loadTargetSnapshot(targetType: KnowledgeTargetType, targetId: string): Promise<Record<string, unknown>> {
  const resolvedType = normalizeTargetType(targetType);

  if (resolvedType === "product") {
    const products = await listProductCatalogItems();
    const item = products.find((product) => product.id === targetId) ?? null;
    if (!item) throw new Error("Produit introuvable pour la versionnage.");
    return {
      targetType: resolvedType,
      targetId,
      data: item as Record<string, unknown>,
    };
  }

  if (resolvedType === "task_template") {
    const { data, error } = await (supabase as any).from("task_templates").select("*").eq("id", targetId).maybeSingle();
    if (error) throwIfPolicyError(error, "Impossible de charger le template.");
    if (!data) throw new Error("Template introuvable pour la versionnage.");
    return {
      targetType: resolvedType,
      targetId,
      data: data as Record<string, unknown>,
    };
  }

  if (resolvedType === "lot_profile") {
    const { data, error } = await (supabase as any).from("task_template_lot_profiles").select("*").eq("id", targetId).maybeSingle();
    if (error) throwIfPolicyError(error, "Impossible de charger le lot métier.");
    if (!data) throw new Error("Lot métier introuvable pour la versionnage.");
    return {
      targetType: resolvedType,
      targetId,
      data: data as Record<string, unknown>,
    };
  }

  if (resolvedType === "field_knowledge") {
    const { data, error } = await (supabase as any).from("field_feedback").select("*").eq("id", targetId).maybeSingle();
    if (error) throwIfPolicyError(error, "Impossible de charger le retour terrain.");
    if (!data) throw new Error("Retour terrain introuvable pour la versionnage.");
    return {
      targetType: resolvedType,
      targetId,
      data: data as Record<string, unknown>,
    };
  }

  return {
    targetType: resolvedType,
    targetId,
    data: {},
  };
}

async function restoreTargetSnapshot(snapshot: Record<string, unknown>) {
  const targetType = normalizeTargetType(String(snapshot.targetType ?? "other"));
  const targetId = String(snapshot.targetId ?? "");
  const data = isPlainObject(snapshot.data) ? snapshot.data : {};

  if (targetType === "product") {
    const candidate = data as Partial<ProductCatalogItem> & Record<string, unknown>;
    const productSnapshot = {
      ...candidate,
      id: targetId,
      updatedAt: new Date().toISOString(),
    } as ProductCatalogItem;
    await saveProductCatalogItem(productSnapshot, "knowledge manager rollback");
    return;
  }

  if (targetType === "task_template") {
    const payload: Record<string, unknown> = {};
    for (const key of ["titre", "lot", "unite", "quantite_defaut", "temps_prevu_par_unite_h", "remarques"]) {
      if (key in data) payload[key] = data[key];
    }
    const { error } = await (supabase as any)
      .from("task_templates")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", targetId);
    if (error) throwIfPolicyError(error, "Impossible d'appliquer le rollback sur le template.");
    return;
  }

  if (targetType === "lot_profile") {
    const payload: Record<string, unknown> = {};
    for (const key of ["name", "keywords", "labor_margin_rate", "equipment_margin_rate", "materials_margin_rate", "fees_margin_rate", "default_unit", "average_time_hours", "quality_controls", "common_mistakes", "chantier_instructions", "default_equipment", "default_ppe", "default_consumables", "doe_documents", "field_returns", "sort_order", "is_active"]) {
      if (key in data) payload[key] = data[key];
    }
    const { error } = await (supabase as any)
      .from("task_template_lot_profiles")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", targetId);
    if (error) throwIfPolicyError(error, "Impossible d'appliquer le rollback sur le lot métier.");
  }
}

export function createJsonDiff(before: unknown, after: unknown) {
  const changed: Array<{ path: string; before: unknown; after: unknown }> = [];
  const added: Array<{ path: string; value: unknown }> = [];
  const removed: Array<{ path: string; value: unknown }> = [];

  function walk(current: unknown, next: unknown, path: string) {
    if (isPlainObject(current) && isPlainObject(next)) {
      const keys = new Set([...Object.keys(current), ...Object.keys(next)]);
      for (const key of keys) {
        const nextPath = path ? `${path}.${key}` : key;
        if (!(key in current)) {
          added.push({ path: nextPath, value: next[key] });
        } else if (!(key in next)) {
          removed.push({ path: nextPath, value: current[key] });
        } else {
          walk(current[key], next[key], nextPath);
        }
      }
      return;
    }

    if (Array.isArray(current) && Array.isArray(next)) {
      const maxLength = Math.max(current.length, next.length);
      for (let index = 0; index < maxLength; index += 1) {
        const nextPath = path ? `${path}[${index}]` : `[${index}]`;
        if (index >= current.length) {
          added.push({ path: nextPath, value: next[index] });
        } else if (index >= next.length) {
          removed.push({ path: nextPath, value: current[index] });
        } else {
          walk(current[index], next[index], nextPath);
        }
      }
      return;
    }

    if (current !== next) {
      changed.push({ path, before: current, after: next });
    }
  }

  walk(before, after, "");
  return { changed, added, removed };
}

function buildCostSummary(beforeValue: unknown, afterValue: unknown) {
  const maybeNumber = (value: unknown) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const buildCostInput = (value: unknown) => {
    const source = isPlainObject(value) ? value : {};
    const ratioQuantity = maybeNumber(readValue(source, ["ratioQuantity", "ratio_quantity", "ratio", "materialUsage.ratioQuantity", "materialUsage.ratio_quantity"])) ?? null;
    const unitCostHt = maybeNumber(readValue(source, ["unitCostHt", "purchasePrice", "purchase_price_ht", "price", "costPrice"])) ?? 1;
    const unitSaleHt = maybeNumber(readValue(source, ["unitSaleHt", "salePrice", "sale_price_ht"])) ?? unitCostHt;
    const hours = maybeNumber(readValue(source, ["hours", "time", "durationHours", "duration_hours", "estimatedTimeHours", "temps_prevu_h", "temps_prevu_par_unite_h"])) ?? null;
    const marginRate = maybeNumber(readValue(source, ["marginRate", "margin_rate", "marge", "margin", "margins"])) ?? null;
    const amount = maybeNumber(readValue(source, ["amount", "amountCostHt", "amount_cost_ht"])) ?? 100;

    const input: Record<string, unknown> = {};
    if (ratioQuantity !== null) {
      input.materials = [{ quantity: ratioQuantity, unitCostHt, unitSaleHt, marginRate: 0 }];
    }
    if (hours !== null) {
      input.labor = [{ durationHours: hours, hourlyCostHt: 100, hourlySaleHt: 110, marginRate: 0 }];
    }
    if (marginRate !== null) {
      input.fees = [{ amountCostHt: amount, amountSaleHt: amount * (1 + marginRate / 100), marginRate }];
    }

    return Object.keys(input).length > 0 ? input : null;
  };

  const beforeInput = buildCostInput(beforeValue);
  const afterInput = buildCostInput(afterValue);
  if (!beforeInput && !afterInput) return null;

  const beforeCost = beforeInput ? TaskCostEngine.calculate(beforeInput as Parameters<typeof TaskCostEngine.calculate>[0]) : null;
  const afterCost = afterInput ? TaskCostEngine.calculate(afterInput as Parameters<typeof TaskCostEngine.calculate>[0]) : null;

  if (!beforeCost && !afterCost) return null;
  return {
    before: beforeCost ? { cost: beforeCost.cost, sale: beforeCost.sale, margin: beforeCost.margin, marginRate: beforeCost.marginRate, estimatedTimeHours: beforeCost.estimatedTimeHours } : null,
    after: afterCost ? { cost: afterCost.cost, sale: afterCost.sale, margin: afterCost.margin, marginRate: afterCost.marginRate, estimatedTimeHours: afterCost.estimatedTimeHours } : null,
    delta: beforeCost && afterCost ? { cost: afterCost.cost - beforeCost.cost, sale: afterCost.sale - beforeCost.sale, margin: afterCost.margin - beforeCost.margin } : null,
  };
}

export async function simulateKnowledgeImprovement(improvementId: string): Promise<KnowledgeImpactSimulation> {
  const improvement = await getImprovement(improvementId);
  const targetType = inferTargetType(improvement as Record<string, unknown>);
  const targetId = inferTargetId(improvement as Record<string, unknown>) ?? "";
  const warnings: string[] = [];
  if (!targetId) warnings.push("Aucune cible métier identifiable pour cette proposition.");

  let targetSnapshot: Record<string, unknown> | null = null;
  if (targetId) {
    try {
      targetSnapshot = await loadTargetSnapshot(targetType, targetId);
    } catch (error) {
      warnings.push(getErrorMessage(error));
    }
  }

  const beforeValue = improvement.currentValue;
  const afterValue = improvement.proposedValue;
  const diff = createJsonDiff(beforeValue, afterValue);
  const costSummary = buildCostSummary(beforeValue, afterValue);

  const simulation = await upsertSimulation({
    improvementId: improvement.id,
    targetType,
    targetId,
    impactedProducts: targetType === "product" ? 1 : 0,
    impactedTemplates: targetType === "task_template" ? 1 : 0,
    impactedQuotes: improvement.chantierCount > 0 ? 1 : 0,
    impactedChantiers: improvement.chantierCount,
    impactedDoe: isPlainObject(afterValue) && ("doe" in afterValue || "doeDocuments" in afterValue) ? 1 : targetType === "product" ? 1 : 0,
    costBefore: costSummary ? (costSummary.before as Record<string, unknown> | null) : null,
    costAfter: costSummary ? (costSummary.after as Record<string, unknown> | null) : null,
    diff: diff as Record<string, unknown>,
    warnings,
    createdBy: null,
    metadata: {
      improvementType: improvement.improvementType,
      reason: improvement.reason,
      confidence: improvement.confidence,
      targetLoaded: Boolean(targetSnapshot),
    },
  });

  await createAuditEntry({
    improvementId: improvement.id,
    targetType,
    targetId,
    action: "simulated",
    beforeSnapshot: { currentValue: beforeValue, target: targetSnapshot },
    afterSnapshot: { proposedValue: afterValue },
    diff: diff as Record<string, unknown>,
    actorId: null,
    actorLabel: "simulation",
    reason: improvement.reason,
    metadata: { simulationId: simulation.id },
  });

  return simulation;
}

export async function applyKnowledgeImprovement(
  improvementId: string,
  options?: {
    actorId?: string | null;
    actorLabel?: string | null;
    reason?: string | null;
    overrideProposedValue?: unknown;
  },
): Promise<KnowledgeApplyResult> {
  const improvement = await getImprovement(improvementId);
  const targetType = inferTargetType(improvement as Record<string, unknown>);
  const targetId = inferTargetId(improvement as Record<string, unknown>) ?? "";
  if (!targetId) throw new Error("Aucune cible métier identifiable pour cette proposition.");
  if (improvement.status !== "pending") throw new Error("Cette proposition n'est plus en attente d'application.");

  const beforeTargetSnapshot = await loadTargetSnapshot(targetType, targetId);
  const beforeValue = improvement.currentValue;
  const proposedValue = options?.overrideProposedValue ?? improvement.proposedValue;
  const applied = await applyToTarget(targetType, targetId, proposedValue);
  const nextVersionNumber = await getNextVersionNumber(targetType, targetId);
  const latestVersion = await getLatestVersion(targetType, targetId);
  const version = await createVersion({
    targetType,
    targetId,
    versionNumber: nextVersionNumber,
    previousVersionId: latestVersion?.id ?? null,
    snapshot: applied.snapshot,
    changeSource: "ai_improvement",
    improvementId: improvement.id,
    createdBy: options?.actorId ?? null,
    reason: options?.reason ?? improvement.reason,
    confidence: improvement.confidence,
    metadata: { actorLabel: options?.actorLabel ?? null, beforeTargetSnapshot },
  });

  await createAuditEntry({
    improvementId: improvement.id,
    targetType,
    targetId,
    action: "applied",
    beforeSnapshot: { currentValue: beforeValue, target: beforeTargetSnapshot },
    afterSnapshot: { target: applied.snapshot, appliedValue: proposedValue },
    diff: createJsonDiff(beforeValue, proposedValue) as Record<string, unknown>,
    actorId: options?.actorId ?? null,
    actorLabel: options?.actorLabel ?? null,
    reason: options?.reason ?? improvement.reason,
    metadata: { versionId: version.id },
  });

  const { error } = await (supabase as any)
    .from("knowledge_improvements")
    .update({ status: "accepted", reviewed_at: new Date().toISOString(), reviewer_comment: options?.reason ?? improvement.reason })
    .eq("id", improvementId);

  if (error) throwIfPolicyError(error, "Impossible de mettre à jour le statut de la proposition.");

  return {
    versionId: version.id,
    targetType,
    targetId,
    action: "applied",
    appliedValue: applied.appliedValue,
    versionNumber: version.versionNumber,
    createdAt: version.createdAt,
  };
}

export async function rejectKnowledgeImprovement(
  improvementId: string,
  options?: {
    actorId?: string | null;
    actorLabel?: string | null;
    reason?: string | null;
  },
): Promise<void> {
  const improvement = await getImprovement(improvementId);
  const targetType = inferTargetType(improvement as Record<string, unknown>);
  const targetId = inferTargetId(improvement as Record<string, unknown>) ?? "";

  await createAuditEntry({
    improvementId: improvement.id,
    targetType,
    targetId,
    action: "rejected",
    beforeSnapshot: { currentValue: improvement.currentValue },
    afterSnapshot: null,
    diff: null,
    actorId: options?.actorId ?? null,
    actorLabel: options?.actorLabel ?? null,
    reason: options?.reason ?? improvement.reason,
    metadata: {},
  });

  const { error } = await (supabase as any)
    .from("knowledge_improvements")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewer_comment: options?.reason ?? improvement.reason })
    .eq("id", improvementId);

  if (error) throwIfPolicyError(error, "Impossible de rejeter la proposition.");
}

export async function rollbackKnowledgeVersion(
  versionId: string,
  options?: {
    actorId?: string | null;
    actorLabel?: string | null;
    reason?: string | null;
  },
): Promise<KnowledgeApplyResult> {
  const { data, error } = await (supabase as any)
    .from("knowledge_versions")
    .select("*")
    .eq("id", versionId)
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Version introuvable.");

  const version = normalizeVersion(data as KnowledgeVersionRow);
  const previousVersion = version.previousVersionId ? await getVersionById(version.previousVersionId) : null;

  if (!previousVersion) {
    throw new Error("Aucune version précédente disponible pour ce rollback.");
  }

  await restoreTargetSnapshot(previousVersion.snapshot);
  const nextNumber = await getNextVersionNumber(version.targetType, version.targetId);
  const rollbackVersion = await createVersion({
    targetType: version.targetType,
    targetId: version.targetId,
    versionNumber: nextNumber,
    previousVersionId: version.id,
    snapshot: previousVersion.snapshot,
    changeSource: "rollback",
    improvementId: version.improvementId,
    createdBy: options?.actorId ?? null,
    reason: options?.reason ?? "Rollback de version",
    confidence: version.confidence,
    metadata: { actorLabel: options?.actorLabel ?? null, rolledBackVersionId: version.id },
  });

  await createAuditEntry({
    improvementId: version.improvementId,
    targetType: version.targetType,
    targetId: version.targetId,
    action: "rollback",
    beforeSnapshot: version.snapshot,
    afterSnapshot: previousVersion.snapshot,
    diff: createJsonDiff(version.snapshot, previousVersion.snapshot) as Record<string, unknown>,
    actorId: options?.actorId ?? null,
    actorLabel: options?.actorLabel ?? null,
    reason: options?.reason ?? "Rollback de version",
    metadata: { rollbackVersionId: rollbackVersion.id },
  });

  const { error: improvementError } = await (supabase as any)
    .from("knowledge_improvements")
    .update({ status: "archived", reviewed_at: new Date().toISOString(), reviewer_comment: options?.reason ?? "Rollback" })
    .eq("id", version.improvementId);

  if (improvementError) throwIfPolicyError(improvementError, "Impossible de mettre à jour la proposition après rollback.");

  return {
    versionId: rollbackVersion.id,
    targetType: version.targetType,
    targetId: version.targetId,
    action: "rollback",
    appliedValue: previousVersion.snapshot,
    versionNumber: rollbackVersion.versionNumber,
    createdAt: rollbackVersion.createdAt,
  };
}

export async function listKnowledgeVersions(targetType: string, targetId: string): Promise<KnowledgeVersion[]> {
  const { data, error } = await (supabase as any)
    .from("knowledge_versions")
    .select("*")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("version_number", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as KnowledgeVersionRow[]).map(normalizeVersion);
}

export async function listKnowledgeAudit(targetType: string, targetId: string): Promise<KnowledgeAuditEntry[]> {
  const { data, error } = await (supabase as any)
    .from("knowledge_change_audit")
    .select("*")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as KnowledgeAuditRow[]).map(normalizeAudit);
}
