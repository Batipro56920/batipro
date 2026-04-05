import type { ChantierTaskRow } from "./chantierTasks.service";
import { supabase } from "../lib/supabaseClient";

export type TaskTemplateMaterialRatioRow = {
  id: string;
  task_template_id: string;
  material_name: string;
  source_unit: string;
  ratio_quantity: number;
  ratio_unit: string;
  loss_percent: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string | null;
};

export type TaskTemplateMaterialRatioInput = {
  material_name: string;
  source_unit: string;
  ratio_quantity: number | null;
  ratio_unit: string;
  loss_percent?: number | null;
  notes?: string | null;
  sort_order?: number | null;
};

export type TaskTemplateEquipmentItemRow = {
  id: string;
  task_template_id: string;
  equipment_name: string;
  is_required: boolean;
  default_quantity: number | null;
  unit: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string | null;
};

export type TaskTemplateEquipmentItemInput = {
  equipment_name: string;
  is_required: boolean;
  default_quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
  sort_order?: number | null;
};

export type TaskTemplatePreparationBundle = {
  schemaReady: boolean;
  materials: TaskTemplateMaterialRatioRow[];
  equipment: TaskTemplateEquipmentItemRow[];
};

export type TaskTemplatePreparationCollection = {
  schemaReady: boolean;
  materialsByTemplateId: Record<string, TaskTemplateMaterialRatioRow[]>;
  equipmentByTemplateId: Record<string, TaskTemplateEquipmentItemRow[]>;
};

export type TaskPreparationEstimateMaterial = {
  id: string;
  material_name: string;
  source_unit: string;
  ratio_quantity: number;
  ratio_unit: string;
  loss_percent: number | null;
  notes: string | null;
  base_quantity: number;
  estimated_quantity: number;
  sort_order: number;
};

export type TaskPreparationEstimateEquipment = {
  id: string;
  equipment_name: string;
  is_required: boolean;
  default_quantity: number | null;
  unit: string | null;
  notes: string | null;
  sort_order: number;
};

export type TaskPreparationEstimate = {
  canEstimate: boolean;
  taskQuantity: number | null;
  taskUnit: string | null;
  materials: TaskPreparationEstimateMaterial[];
  incompatibleMaterials: TaskTemplateMaterialRatioRow[];
  equipment: TaskPreparationEstimateEquipment[];
};

const MATERIAL_SELECT = [
  "id",
  "task_template_id",
  "material_name",
  "source_unit",
  "ratio_quantity",
  "ratio_unit",
  "loss_percent",
  "notes",
  "sort_order",
  "created_at",
].join(", ");

const EQUIPMENT_SELECT = [
  "id",
  "task_template_id",
  "equipment_name",
  "is_required",
  "default_quantity",
  "unit",
  "notes",
  "sort_order",
  "created_at",
].join(", ");

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function isMissingPreparationSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42883" || code === "42703" || code === "PGRST205") return true;
  return (
    (msg.includes("task_template_material_ratios") ||
      msg.includes("task_template_equipment_items") ||
      msg.includes("replace_task_template_preparation") ||
      msg.includes("copy_task_template_preparation")) &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"))
  );
}

function normalizeMaterialRow(row: any): TaskTemplateMaterialRatioRow {
  return {
    id: String(row?.id ?? ""),
    task_template_id: String(row?.task_template_id ?? ""),
    material_name: String(row?.material_name ?? "").trim(),
    source_unit: String(row?.source_unit ?? "").trim(),
    ratio_quantity: normalizeNumber(row?.ratio_quantity) ?? 0,
    ratio_unit: String(row?.ratio_unit ?? "").trim(),
    loss_percent: normalizeNumber(row?.loss_percent),
    notes: normalizeText(row?.notes),
    sort_order: Math.max(0, Math.trunc(normalizeNumber(row?.sort_order) ?? 0)),
    created_at: normalizeText(row?.created_at),
  };
}

function normalizeEquipmentRow(row: any): TaskTemplateEquipmentItemRow {
  return {
    id: String(row?.id ?? ""),
    task_template_id: String(row?.task_template_id ?? ""),
    equipment_name: String(row?.equipment_name ?? "").trim(),
    is_required: row?.is_required === true,
    default_quantity: normalizeNumber(row?.default_quantity),
    unit: normalizeText(row?.unit),
    notes: normalizeText(row?.notes),
    sort_order: Math.max(0, Math.trunc(normalizeNumber(row?.sort_order) ?? 0)),
    created_at: normalizeText(row?.created_at),
  };
}

function normalizeMaterialInput(
  item: TaskTemplateMaterialRatioInput,
  index: number,
): TaskTemplateMaterialRatioInput | null {
  const material_name = String(item.material_name ?? "").trim();
  const source_unit = String(item.source_unit ?? "").trim();
  const ratio_unit = String(item.ratio_unit ?? "").trim();
  const ratio_quantity = normalizeNumber(item.ratio_quantity);
  const loss_percent = normalizeNumber(item.loss_percent);

  if (!material_name || !source_unit || !ratio_unit || ratio_quantity === null) return null;

  return {
    material_name,
    source_unit,
    ratio_quantity,
    ratio_unit,
    loss_percent,
    notes: normalizeText(item.notes),
    sort_order: Math.max(0, Math.trunc(normalizeNumber(item.sort_order) ?? index)),
  };
}

function normalizeEquipmentInput(
  item: TaskTemplateEquipmentItemInput,
  index: number,
): TaskTemplateEquipmentItemInput | null {
  const equipment_name = String(item.equipment_name ?? "").trim();
  if (!equipment_name) return null;

  return {
    equipment_name,
    is_required: item.is_required === true,
    default_quantity: normalizeNumber(item.default_quantity),
    unit: normalizeText(item.unit),
    notes: normalizeText(item.notes),
    sort_order: Math.max(0, Math.trunc(normalizeNumber(item.sort_order) ?? index)),
  };
}

function normalizeComparableUnit(value: string | null | undefined): string | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!raw) return null;

  const compact = raw.replace(/\s+/g, "").replace(/\./g, "");

  if (compact === "m²" || compact === "m2") return "m2";
  if (compact === "m³" || compact === "m3") return "m3";
  if (compact === "ml" || compact === "mlin" || compact === "metrelineaire" || compact === "mettrelineaire") {
    return "ml";
  }
  if (
    compact === "u" ||
    compact === "un" ||
    compact === "unite" ||
    compact === "unit" ||
    compact === "piece" ||
    compact === "pieces" ||
    compact === "pc" ||
    compact === "pcs"
  ) {
    return "unit";
  }
  return compact;
}

function areUnitsCompatible(taskUnit: string | null | undefined, sourceUnit: string | null | undefined) {
  const normalizedTask = normalizeComparableUnit(taskUnit);
  const normalizedSource = normalizeComparableUnit(sourceUnit);
  return Boolean(normalizedTask && normalizedSource && normalizedTask === normalizedSource);
}

function roundEstimate(value: number) {
  return Math.round(value * 100) / 100;
}

export async function listTaskTemplatePreparationByTemplateIds(
  templateIds: string[],
): Promise<TaskTemplatePreparationCollection> {
  const ids = Array.from(new Set((templateIds ?? []).map((id) => String(id ?? "").trim()).filter(Boolean)));
  if (ids.length === 0) {
    return {
      schemaReady: true,
      materialsByTemplateId: {},
      equipmentByTemplateId: {},
    };
  }

  const [materialsResult, equipmentResult] = await Promise.all([
    (supabase as any)
      .from("task_template_material_ratios")
      .select(MATERIAL_SELECT)
      .in("task_template_id", ids)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
    (supabase as any)
      .from("task_template_equipment_items")
      .select(EQUIPMENT_SELECT)
      .in("task_template_id", ids)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  if (materialsResult.error || equipmentResult.error) {
    const error = materialsResult.error ?? equipmentResult.error;
    if (isMissingPreparationSchemaError(error)) {
      return {
        schemaReady: false,
        materialsByTemplateId: {},
        equipmentByTemplateId: {},
      };
    }
    throw new Error(error?.message ?? "Erreur chargement préparation bibliothèque.");
  }

  const materialsByTemplateId: Record<string, TaskTemplateMaterialRatioRow[]> = {};
  const equipmentByTemplateId: Record<string, TaskTemplateEquipmentItemRow[]> = {};

  for (const row of (materialsResult.data ?? []) as any[]) {
    const material = normalizeMaterialRow(row);
    if (!materialsByTemplateId[material.task_template_id]) {
      materialsByTemplateId[material.task_template_id] = [];
    }
    materialsByTemplateId[material.task_template_id].push(material);
  }

  for (const row of (equipmentResult.data ?? []) as any[]) {
    const equipment = normalizeEquipmentRow(row);
    if (!equipmentByTemplateId[equipment.task_template_id]) {
      equipmentByTemplateId[equipment.task_template_id] = [];
    }
    equipmentByTemplateId[equipment.task_template_id].push(equipment);
  }

  return {
    schemaReady: true,
    materialsByTemplateId,
    equipmentByTemplateId,
  };
}

export async function getTaskTemplatePreparation(
  templateId: string,
): Promise<TaskTemplatePreparationBundle> {
  if (!templateId) {
    return { schemaReady: true, materials: [], equipment: [] };
  }

  const result = await listTaskTemplatePreparationByTemplateIds([templateId]);
  return {
    schemaReady: result.schemaReady,
    materials: result.materialsByTemplateId[templateId] ?? [],
    equipment: result.equipmentByTemplateId[templateId] ?? [],
  };
}

export async function replaceTaskTemplatePreparation(
  taskTemplateId: string,
  input: {
    materials: TaskTemplateMaterialRatioInput[];
    equipment: TaskTemplateEquipmentItemInput[];
  },
): Promise<void> {
  if (!taskTemplateId) throw new Error("taskTemplateId manquant.");

  const materials = (input.materials ?? [])
    .map((item, index) => normalizeMaterialInput(item, index))
    .filter((item): item is TaskTemplateMaterialRatioInput => Boolean(item));
  const equipment = (input.equipment ?? [])
    .map((item, index) => normalizeEquipmentInput(item, index))
    .filter((item): item is TaskTemplateEquipmentItemInput => Boolean(item));

  const { error } = await (supabase as any).rpc("replace_task_template_preparation", {
    p_task_template_id: taskTemplateId,
    p_materials: materials,
    p_equipment: equipment,
  });

  if (error) {
    if (isMissingPreparationSchemaError(error)) {
      throw new Error("Migration préparation avancée non appliquée sur Supabase.");
    }
    throw new Error(error.message);
  }
}

export async function duplicateTaskTemplatePreparation(
  sourceTaskTemplateId: string,
  targetTaskTemplateId: string,
): Promise<void> {
  if (!sourceTaskTemplateId || !targetTaskTemplateId) return;

  const { error } = await (supabase as any).rpc("copy_task_template_preparation", {
    p_source_task_template_id: sourceTaskTemplateId,
    p_target_task_template_id: targetTaskTemplateId,
  });

  if (error) {
    if (isMissingPreparationSchemaError(error)) return;
    throw new Error(error.message);
  }
}

export function estimateTaskTemplatePreparation(
  task: Pick<ChantierTaskRow, "quantite" | "unite">,
  materials: TaskTemplateMaterialRatioRow[],
  equipment: TaskTemplateEquipmentItemRow[],
): TaskPreparationEstimate {
  const taskQuantity = normalizeNumber(task.quantite);
  const taskUnit = normalizeText(task.unite);

  if (taskQuantity === null || taskQuantity <= 0 || !taskUnit) {
    return {
      canEstimate: false,
      taskQuantity,
      taskUnit,
      materials: [],
      incompatibleMaterials: [...materials],
      equipment: equipment.map((item) => ({
        id: item.id,
        equipment_name: item.equipment_name,
        is_required: item.is_required,
        default_quantity: item.default_quantity,
        unit: item.unit,
        notes: item.notes,
        sort_order: item.sort_order,
      })),
    };
  }

  const compatibleMaterials: TaskPreparationEstimateMaterial[] = [];
  const incompatibleMaterials: TaskTemplateMaterialRatioRow[] = [];

  for (const material of materials) {
    if (!areUnitsCompatible(taskUnit, material.source_unit)) {
      incompatibleMaterials.push(material);
      continue;
    }

    const base_quantity = roundEstimate(taskQuantity * material.ratio_quantity);
    const estimated_quantity = roundEstimate(
      base_quantity * (1 + (normalizeNumber(material.loss_percent) ?? 0) / 100),
    );

    compatibleMaterials.push({
      id: material.id,
      material_name: material.material_name,
      source_unit: material.source_unit,
      ratio_quantity: material.ratio_quantity,
      ratio_unit: material.ratio_unit,
      loss_percent: material.loss_percent,
      notes: material.notes,
      base_quantity,
      estimated_quantity,
      sort_order: material.sort_order,
    });
  }

  return {
    canEstimate: compatibleMaterials.length > 0,
    taskQuantity,
    taskUnit,
    materials: compatibleMaterials,
    incompatibleMaterials,
    equipment: equipment.map((item) => ({
      id: item.id,
      equipment_name: item.equipment_name,
      is_required: item.is_required,
      default_quantity: item.default_quantity,
      unit: item.unit,
      notes: item.notes,
      sort_order: item.sort_order,
    })),
  };
}
