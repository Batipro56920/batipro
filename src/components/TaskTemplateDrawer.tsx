import { useEffect, useMemo, useState } from "react";
import type { TaskTemplateInput, TaskTemplateRow } from "../services/taskLibrary.service";
import {
  findLotProfileByName,
  listTaskTemplateLotProfiles,
  saveTaskTemplateLotProfile,
  type TaskTemplateLotProfile,
  type TaskTemplateLotProfileInput,
} from "../services/taskTemplateLotProfiles.service";
import {
  getTaskTemplatePreparation,
  type TaskTemplateEquipmentItemInput,
  type TaskTemplateFeeItemInput,
  type TaskTemplateLaborItemInput,
  type TaskTemplateMaterialRatioInput,
} from "../services/taskTemplatePreparation.service";
import type { ProductCatalogItem } from "../features/product-catalog";
import { getBestSupplierPrice, listProductCatalogItems } from "../features/product-catalog";
import { TaskCostEngine } from "../features/task-cost-engine/TaskCostEngine";
import {
  generateWithCoco,
  type TaskTemplateCocoResult,
} from "../features/product-catalog/services/taskTemplateCocoAssistantBridge";
import { useI18n } from "../i18n";

type Props = {
  open: boolean;
  template: TaskTemplateRow | null;
  initialValues?: TaskTemplateInput | null;
  saving: boolean;
  deleting: boolean;
  error: string | null;
  advancedPreparationEnabled?: boolean;
  onClose: () => void;
  onSave: (payload: TaskTemplateInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

type MaterialRatioDraft = {
  id: string;
  product_id: string;
  material_name: string;
  source_unit: string;
  ratio_quantity: string;
  ratio_unit: string;
  loss_percent: string;
  supplier_id: string;
  purchase_price_ht: string;
  sale_price_ht: string;
  price_source: string;
  manual_override: boolean;
  notes: string;
};

type EquipmentDraft = {
  id: string;
  equipment_name: string;
  is_required: boolean;
  default_quantity: string;
  unit: string;
  notes: string;
};

type LaborDraft = {
  id: string;
  resourceType: "manual" | "employee_role" | "subcontractor";
  duration: string;
  unit: string;
  hourlyCost: string;
  hourlySalePrice: string;
  note: string;
};

type FeeDraft = {
  id: string;
  type: "equipment_rental" | "consumables" | "fixed_fee" | "other";
  designation: string;
  amountCostHt: string;
  amountSaleHt: string;
  note: string;
};

function toField(value: number | null): string {
  if (value === null || value === undefined) return "";
  if (Number.isInteger(value)) return String(value);
  return String(value);
}

function parseNumberField(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDraftAmount(value: string): number {
  return parseNumberField(value) ?? 0;
}

function createMaterialDraft(row?: {
  id?: string | null;
  material_name?: string | null;
  source_unit?: string | null;
  ratio_quantity?: number | null;
  ratio_unit?: string | null;
  loss_percent?: number | null;
  notes?: string | null;
}): MaterialRatioDraft {
  return {
    id: String(row?.id ?? crypto.randomUUID()),
    product_id: String((row as any)?.product_id ?? ""),
    material_name: String(row?.material_name ?? ""),
    source_unit: String(row?.source_unit ?? ""),
    ratio_quantity: toField(row?.ratio_quantity ?? null),
    ratio_unit: String(row?.ratio_unit ?? ""),
    loss_percent: toField(row?.loss_percent ?? null),
    supplier_id: String((row as any)?.supplier_id ?? ""),
    purchase_price_ht: toField((row as any)?.purchase_price_ht ?? null),
    sale_price_ht: toField((row as any)?.sale_price_ht ?? null),
    price_source: String((row as any)?.price_source ?? "manual"),
    manual_override: (row as any)?.manual_override === true,
    notes: String(row?.notes ?? ""),
  };
}

function createLaborDraft(row?: Partial<TaskTemplateLaborItemInput>): LaborDraft {
  return {
    id: String(row?.id ?? crypto.randomUUID()),
    resourceType: row?.resourceType ?? "manual",
    duration: toField(row?.duration ?? null),
    unit: String(row?.unit ?? "h"),
    hourlyCost: toField(row?.hourlyCost ?? null),
    hourlySalePrice: toField(row?.hourlySalePrice ?? null),
    note: String(row?.note ?? ""),
  };
}

function createFeeDraft(row?: Partial<TaskTemplateFeeItemInput>): FeeDraft {
  return {
    id: String(row?.id ?? crypto.randomUUID()),
    type: row?.type ?? "other",
    designation: String(row?.designation ?? ""),
    amountCostHt: toField(row?.amountCostHt ?? null),
    amountSaleHt: toField(row?.amountSaleHt ?? null),
    note: String(row?.note ?? ""),
  };
}

function createEquipmentDraft(row?: {
  id?: string | null;
  equipment_name?: string | null;
  is_required?: boolean | null;
  default_quantity?: number | null;
  unit?: string | null;
  notes?: string | null;
}): EquipmentDraft {
  return {
    id: String(row?.id ?? crypto.randomUUID()),
    equipment_name: String(row?.equipment_name ?? ""),
    is_required: row?.is_required === true,
    default_quantity: toField(row?.default_quantity ?? null),
    unit: String(row?.unit ?? ""),
    notes: String(row?.notes ?? ""),
  };
}

function isMaterialDraftEmpty(row: MaterialRatioDraft) {
  return (
    !row.material_name.trim() &&
    !row.product_id.trim() &&
    !row.source_unit.trim() &&
    !row.ratio_quantity.trim() &&
    !row.ratio_unit.trim() &&
    !row.loss_percent.trim() &&
    !row.supplier_id.trim() &&
    !row.purchase_price_ht.trim() &&
    !row.sale_price_ht.trim() &&
    !row.notes.trim()
  );
}

function isLaborDraftEmpty(row: LaborDraft) {
  return !row.duration.trim() && !row.hourlyCost.trim() && !row.hourlySalePrice.trim() && !row.note.trim();
}

function isFeeDraftEmpty(row: FeeDraft) {
  return !row.designation.trim() && !row.amountCostHt.trim() && !row.amountSaleHt.trim() && !row.note.trim();
}

function isEquipmentDraftEmpty(row: EquipmentDraft) {
  return (
    !row.equipment_name.trim() &&
    !row.default_quantity.trim() &&
    !row.unit.trim() &&
    !row.notes.trim() &&
    row.is_required === false
  );
}

function reorderItems<T>(items: T[], index: number, direction: -1 | 1) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function formatList(title: string, items: string[]) {
  if (!items.length) return "";
  return [title, ...items.map((item) => `- ${item}`)].join("\n");
}

function fillIfEmpty(existing: string, content: string) {
  const cleanContent = content.trim();
  if (!cleanContent) return existing;
  const cleanExisting = existing.trim();
  return cleanExisting ? existing : cleanContent;
}

function materialResultText(item: TaskTemplateCocoResult["materials"][number]) {
  const quantity = item.quantity !== null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : "";
  return [item.label, quantity, item.detail].filter(Boolean).join(" - ");
}

function equipmentResultText(item: TaskTemplateCocoResult["equipment"][number]) {
  const quantity = item.quantity !== null ? `${item.quantity}${item.unit ? ` ${item.unit}` : ""}` : "";
  const required = item.required ? "obligatoire" : "";
  return [item.label, quantity, required, item.detail].filter(Boolean).join(" - ");
}

function costSummaryLines(result: TaskTemplateCocoResult) {
  const summary = result.costSummary;
  if (summary.lines.length) return summary.lines;
  return [
    summary.materialCostHt !== null ? `Materiaux: ${summary.materialCostHt.toFixed(2)} EUR HT` : "",
    summary.laborCostHt !== null ? `Main d'oeuvre: ${summary.laborCostHt.toFixed(2)} EUR HT` : "",
    summary.feeCostHt !== null ? `Frais: ${summary.feeCostHt.toFixed(2)} EUR HT` : "",
    summary.totalCostHt !== null ? `Total revient: ${summary.totalCostHt.toFixed(2)} EUR HT` : "",
    summary.salePriceHt !== null ? `Prix vente: ${summary.salePriceHt.toFixed(2)} EUR HT` : "",
    summary.marginRate !== null ? `Marge: ${summary.marginRate.toFixed(1)} %` : "",
  ].filter(Boolean);
}

function CocoResultBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</div>
      {items.length ? (
        <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-700">
          {items.map((item, index) => <li key={`${title}-${index}`}>- {item}</li>)}
        </ul>
      ) : (
        <div className="mt-2 text-sm text-slate-500">Non renseigne.</div>
      )}
    </div>
  );
}

export default function TaskTemplateDrawer({
  open,
  template,
  initialValues = null,
  saving,
  deleting,
  error,
  advancedPreparationEnabled = false,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const { t } = useI18n();
  const [titre, setTitre] = useState("");
  const [lot, setLot] = useState("");
  const [unite, setUnite] = useState("");
  const [quantiteDefaut, setQuantiteDefaut] = useState("");
  const [tempsParUnite, setTempsParUnite] = useState("");
  const [coutReferenceUnitaire, setCoutReferenceUnitaire] = useState("");
  const [descriptionTechnique, setDescriptionTechnique] = useState("");
  const [caracteristiques, setCaracteristiques] = useState("");
  const [remarques, setRemarques] = useState("");
  const [usageMetier, setUsageMetier] = useState("");
  const [materialDrafts, setMaterialDrafts] = useState<MaterialRatioDraft[]>([]);
  const [equipmentDrafts, setEquipmentDrafts] = useState<EquipmentDraft[]>([]);
  const [laborDrafts, setLaborDrafts] = useState<LaborDraft[]>([]);
  const [feeDrafts, setFeeDrafts] = useState<FeeDraft[]>([]);
  const [products, setProducts] = useState<ProductCatalogItem[]>([]);
  const [lotProfiles, setLotProfiles] = useState<TaskTemplateLotProfile[]>([]);
  const [lotProfilesLoading, setLotProfilesLoading] = useState(false);
  const [lotProfilesError, setLotProfilesError] = useState<string | null>(null);
  const [lotSettingsOpen, setLotSettingsOpen] = useState(false);
  const [lotSettingsSaving, setLotSettingsSaving] = useState(false);
  const [preparationLoading, setPreparationLoading] = useState(false);
  const [preparationSchemaReady, setPreparationSchemaReady] = useState(true);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [cocoLoading, setCocoLoading] = useState(false);
  const [cocoResult, setCocoResult] = useState<TaskTemplateCocoResult | null>(null);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLotProfilesLoading(true);
    Promise.all([listProductCatalogItems(), listTaskTemplateLotProfiles()])
      .then(([items, profiles]) => {
        if (!alive) return;
        setProducts(items);
        setLotProfiles(profiles);
        setLotProfilesError(null);
      })
      .catch((err: any) => {
        if (!alive) return;
        setProducts([]);
        setLotProfiles([]);
        setLotProfilesError(err?.message ?? "Chargement des lots métier impossible.");
      })
      .finally(() => {
        if (alive) setLotProfilesLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (template) {
      setTitre(template.titre ?? "");
      setLot(template.lot ?? "");
      setUnite(template.unite ?? "");
      setQuantiteDefaut(toField(template.quantite_defaut ?? null));
      setTempsParUnite(toField(template.temps_prevu_par_unite_h ?? null));
      setCoutReferenceUnitaire(toField(template.cout_reference_unitaire_ht ?? null));
      setDescriptionTechnique(template.description_technique ?? "");
      setCaracteristiques((template.caracteristiques ?? []).join("\n"));
      setRemarques(template.remarques ?? "");
      setUsageMetier("");
      setLaborDrafts((template.labor_items ?? []).map((row) => createLaborDraft(row)));
      setFeeDrafts((template.fee_items ?? []).map((row) => createFeeDraft(row)));
    } else {
      setTitre(initialValues?.titre ?? "");
      setLot(initialValues?.lot ?? "");
      setUnite(initialValues?.unite ?? "");
      setQuantiteDefaut(toField(initialValues?.quantite_defaut ?? null));
      setTempsParUnite(toField(initialValues?.temps_prevu_par_unite_h ?? null));
      setCoutReferenceUnitaire(toField(initialValues?.cout_reference_unitaire_ht ?? null));
      setDescriptionTechnique(initialValues?.description_technique ?? "");
      setCaracteristiques((initialValues?.caracteristiques ?? []).join("\n"));
      setRemarques(initialValues?.remarques ?? "");
      setUsageMetier("");
      setMaterialDrafts(
        (initialValues?.preparation_materials ?? []).map((row) =>
          createMaterialDraft({
            id: crypto.randomUUID(),
            material_name: row.material_name,
            source_unit: row.source_unit,
            ratio_quantity: row.ratio_quantity ?? null,
            ratio_unit: row.ratio_unit,
            loss_percent: row.loss_percent ?? null,
            notes: row.notes ?? null,
          }),
        ),
      );
      setEquipmentDrafts(
        (initialValues?.preparation_equipment ?? []).map((row) =>
          createEquipmentDraft({
            id: crypto.randomUUID(),
            equipment_name: row.equipment_name,
            is_required: row.is_required,
            default_quantity: row.default_quantity ?? null,
            unit: row.unit ?? null,
            notes: row.notes ?? null,
          }),
        ),
      );
      setLaborDrafts((initialValues?.labor_items ?? []).map((row) => createLaborDraft(row)));
      setFeeDrafts((initialValues?.fee_items ?? []).map((row) => createFeeDraft(row)));
    }
    setPreparationSchemaReady(true);
    setPreparationError(null);
    setLocalError(null);
    setCocoResult(null);
    setCocoLoading(false);
  }, [
    open,
    template,
    template?.id,
    template?.titre,
    template?.lot,
    template?.unite,
    template?.quantite_defaut,
    template?.temps_prevu_par_unite_h,
    template?.cout_reference_unitaire_ht,
    template?.description_technique,
    template?.caracteristiques,
    template?.remarques,
    template?.labor_items,
    template?.fee_items,
    initialValues?.titre,
    initialValues?.lot,
    initialValues?.unite,
    initialValues?.quantite_defaut,
    initialValues?.temps_prevu_par_unite_h,
    initialValues?.cout_reference_unitaire_ht,
    initialValues?.description_technique,
    initialValues?.caracteristiques,
    initialValues?.remarques,
    initialValues?.preparation_materials,
    initialValues?.preparation_equipment,
    initialValues?.labor_items,
    initialValues?.fee_items,
  ]);

  useEffect(() => {
    if (!open || !advancedPreparationEnabled || !template?.id) {
      setPreparationLoading(false);
      return;
    }

    const templateId = template.id;

    let alive = true;

    async function loadPreparation() {
      setPreparationLoading(true);
      setPreparationError(null);
      try {
        const result = await getTaskTemplatePreparation(templateId);
        if (!alive) return;
        setPreparationSchemaReady(result.schemaReady);
        setMaterialDrafts(result.materials.map((row) => createMaterialDraft(row)));
        setEquipmentDrafts(result.equipment.map((row) => createEquipmentDraft(row)));
      } catch (err: any) {
        if (!alive) return;
        setPreparationError(err?.message ?? "Erreur chargement préparation avancée.");
        setMaterialDrafts([]);
        setEquipmentDrafts([]);
      } finally {
        if (alive) setPreparationLoading(false);
      }
    }

    void loadPreparation();

    return () => {
      alive = false;
    };
  }, [open, template?.id, advancedPreparationEnabled]);

  const busy = saving || deleting;
  const title = useMemo(() => (template ? `${t("common.actions.edit")} template` : t("bibliothequeTasks.new")), [t, template]);
  const selectedLotProfile = useMemo(() => findLotProfileByName(lotProfiles, lot), [lotProfiles, lot]);
  const compositionTotals = useMemo(() => {
    const engineTotals = TaskCostEngine.calculate({
      materials: materialDrafts.map((row) => ({
        quantity: parseDraftAmount(row.ratio_quantity),
        unitCostHt: parseDraftAmount(row.purchase_price_ht),
        unitSaleHt: parseDraftAmount(row.sale_price_ht),
        lossPercent: parseDraftAmount(row.loss_percent),
        marginRate: selectedLotProfile?.materialsMarginRate ?? null,
      })),
      labor: laborDrafts.map((row) => ({
        durationHours: parseDraftAmount(row.duration),
        hourlyCostHt: parseDraftAmount(row.hourlyCost),
        hourlySaleHt: parseDraftAmount(row.hourlySalePrice),
        marginRate: selectedLotProfile?.laborMarginRate ?? null,
      })),
      equipment: equipmentDrafts.map((row) => ({
        quantity: parseDraftAmount(row.default_quantity) || 1,
        unitCostHt: 0,
        unitSaleHt: 0,
        marginRate: selectedLotProfile?.equipmentMarginRate ?? null,
      })),
      fees: feeDrafts.map((row) => ({
        amountCostHt: parseDraftAmount(row.amountCostHt),
        amountSaleHt: parseDraftAmount(row.amountSaleHt),
        marginRate: selectedLotProfile?.feesMarginRate ?? null,
      })),
      estimatedTimeHours: parseDraftAmount(tempsParUnite),
    });

    return {
      materialCost: engineTotals.materialCost,
      materialSale: engineTotals.materialSale,
      laborCost: engineTotals.laborCost,
      laborSale: engineTotals.laborSale,
      equipmentCost: engineTotals.equipmentCost,
      equipmentSale: engineTotals.equipmentSale,
      feeCost: engineTotals.feeCost,
      feeSale: engineTotals.feeSale,
      cost: engineTotals.cost,
      sale: engineTotals.sale,
      margin: engineTotals.margin,
      marginRate: engineTotals.marginRate,
      estimatedTimeHours: engineTotals.estimatedTimeHours,
      humanTimeHours: engineTotals.humanTimeHours,
      teamTimeHours: engineTotals.teamTimeHours,
      dailyCost: engineTotals.dailyCost,
      profitabilityRate: engineTotals.profitabilityRate,
      lines: engineTotals.lines,
    };
  }, [materialDrafts, laborDrafts, equipmentDrafts, feeDrafts, selectedLotProfile, tempsParUnite]);

  if (!open) return null;

  function updateMaterialDraft(index: number, patch: Partial<MaterialRatioDraft>) {
    setMaterialDrafts((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  function updateEquipmentDraft(index: number, patch: Partial<EquipmentDraft>) {
    setEquipmentDrafts((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  function updateLaborDraft(index: number, patch: Partial<LaborDraft>) {
    setLaborDrafts((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  function updateFeeDraft(index: number, patch: Partial<FeeDraft>) {
    setFeeDrafts((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    );
  }

  function applyLotProfile(profile: TaskTemplateLotProfile, mode: "soft" | "force" = "soft") {
    if ((mode === "force" || !unite.trim()) && profile.defaultUnit) setUnite(profile.defaultUnit);
    if ((mode === "force" || !tempsParUnite.trim()) && profile.averageTimeHours !== null) {
      setTempsParUnite(toField(profile.averageTimeHours));
    }

    if (mode === "force" || equipmentDrafts.length === 0) {
      const equipment = profile.defaultEquipment.map((name) => createEquipmentDraft({
        equipment_name: name,
        is_required: true,
        default_quantity: null,
        unit: null,
        notes: "Profil lot",
      }));
      if (equipment.length) setEquipmentDrafts(equipment);
    }

    const notesFromProfile = [
      formatList("Consignes chantier du lot", profile.chantierInstructions),
      formatList("EPI par defaut", profile.defaultPpe),
      formatList("Consommables par defaut", profile.defaultConsumables),
      formatList("Documents DOE attendus", profile.doeDocuments),
      formatList("Retours terrain attendus", profile.fieldReturns),
    ].filter(Boolean).join("\n\n");
    setRemarques((prev) => fillIfEmpty(prev, notesFromProfile));

    const characteristicsFromProfile = [
      formatList("Controles qualite du lot", profile.qualityControls),
      formatList("Erreurs frequentes du lot", profile.commonMistakes),
    ].filter(Boolean).join("\n\n");
    setCaracteristiques((prev) => fillIfEmpty(prev, characteristicsFromProfile));
  }

  function selectLotProfile(name: string) {
    setLot(name);
    const profile = findLotProfileByName(lotProfiles, name);
    if (profile) applyLotProfile(profile, "soft");
  }

  function applyProductToMaterial(index: number, productId: string) {
    if (!productId) {
      updateMaterialDraft(index, {
        product_id: "",
        supplier_id: "",
        price_source: "manual",
      });
      return;
    }
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const bestPrice = getBestSupplierPrice(product);
    updateMaterialDraft(index, {
      product_id: product.id,
      material_name: product.designation,
      source_unit: product.unit,
      ratio_unit: product.unit,
      supplier_id: bestPrice?.supplierId ?? product.mainSupplierId ?? "",
      purchase_price_ht: toField(bestPrice?.priceHt ?? product.standardPurchasePriceHt ?? null),
      sale_price_ht: toField(product.recommendedSalePriceHt ?? null),
      price_source: bestPrice ? "supplier_price" : "standard",
      manual_override: false,
    });
  }

  function serializePreparation() {
    const preparationMaterials: TaskTemplateMaterialRatioInput[] = [];
    const preparationEquipment: TaskTemplateEquipmentItemInput[] = [];
    const laborItems: TaskTemplateLaborItemInput[] = [];
    const feeItems: TaskTemplateFeeItemInput[] = [];

    for (const [index, row] of materialDrafts.entries()) {
      if (isMaterialDraftEmpty(row)) continue;

      const ratioQuantity = parseNumberField(row.ratio_quantity);
      const lossPercent =
        row.loss_percent.trim() === "" ? null : parseNumberField(row.loss_percent);

      if (!row.material_name.trim() || !row.source_unit.trim() || !row.ratio_unit.trim()) {
        throw new Error("Complète chaque ligne matériau ou laisse-la vide.");
      }
      if (ratioQuantity === null) {
        throw new Error("Ratio matériau invalide.");
      }
      if (row.loss_percent.trim() !== "" && lossPercent === null) {
        throw new Error("Coefficient de perte invalide.");
      }
      if (lossPercent !== null && (lossPercent < 0 || lossPercent > 100)) {
        throw new Error("La perte doit rester entre 0 et 100 %.");
      }
      const purchasePrice =
        row.purchase_price_ht.trim() === "" ? null : parseNumberField(row.purchase_price_ht);
      const salePrice = row.sale_price_ht.trim() === "" ? null : parseNumberField(row.sale_price_ht);
      if (row.purchase_price_ht.trim() !== "" && purchasePrice === null) {
        throw new Error("Prix d'achat matériau invalide.");
      }
      if (row.sale_price_ht.trim() !== "" && salePrice === null) {
        throw new Error("Prix de vente matériau invalide.");
      }

      preparationMaterials.push({
        product_id: row.product_id.trim() || null,
        material_name: row.material_name.trim(),
        source_unit: row.source_unit.trim(),
        ratio_quantity: ratioQuantity,
        ratio_unit: row.ratio_unit.trim(),
        loss_percent: lossPercent,
        supplier_id: row.supplier_id.trim() || null,
        purchase_price_ht: purchasePrice,
        sale_price_ht: salePrice,
        price_source: row.price_source.trim() || "manual",
        manual_override: row.manual_override,
        notes: row.notes.trim() || null,
        sort_order: index,
      });
    }

    for (const [index, row] of equipmentDrafts.entries()) {
      if (isEquipmentDraftEmpty(row)) continue;

      const defaultQuantity =
        row.default_quantity.trim() === "" ? null : parseNumberField(row.default_quantity);

      if (!row.equipment_name.trim()) {
        throw new Error("Complète chaque ligne matériel ou laisse-la vide.");
      }
      if (row.default_quantity.trim() !== "" && defaultQuantity === null) {
        throw new Error("Quantité matériel invalide.");
      }

      preparationEquipment.push({
        equipment_name: row.equipment_name.trim(),
        is_required: row.is_required,
        default_quantity: defaultQuantity,
        unit: row.unit.trim() || null,
        notes: row.notes.trim() || null,
        sort_order: index,
      });
    }

    for (const row of laborDrafts) {
      if (isLaborDraftEmpty(row)) continue;
      const duration = parseNumberField(row.duration);
      const hourlyCost = row.hourlyCost.trim() === "" ? null : parseNumberField(row.hourlyCost);
      const hourlySalePrice =
        row.hourlySalePrice.trim() === "" ? null : parseNumberField(row.hourlySalePrice);
      if (duration === null) throw new Error("Temps main d'oeuvre invalide.");
      if (row.hourlyCost.trim() !== "" && hourlyCost === null) {
        throw new Error("Coût horaire main d'oeuvre invalide.");
      }
      if (row.hourlySalePrice.trim() !== "" && hourlySalePrice === null) {
        throw new Error("Prix de vente horaire main d'oeuvre invalide.");
      }
      laborItems.push({
        id: row.id,
        resourceType: row.resourceType,
        duration,
        unit: row.unit.trim() || "h",
        hourlyCost,
        hourlySalePrice,
        note: row.note.trim() || null,
      });
    }

    for (const row of feeDrafts) {
      if (isFeeDraftEmpty(row)) continue;
      const amountCostHt = row.amountCostHt.trim() === "" ? null : parseNumberField(row.amountCostHt);
      const amountSaleHt = row.amountSaleHt.trim() === "" ? null : parseNumberField(row.amountSaleHt);
      if (!row.designation.trim()) throw new Error("Désignation frais obligatoire.");
      if (row.amountCostHt.trim() !== "" && amountCostHt === null) throw new Error("Coût frais invalide.");
      if (row.amountSaleHt.trim() !== "" && amountSaleHt === null) throw new Error("Prix de vente frais invalide.");
      feeItems.push({
        id: row.id,
        type: row.type,
        designation: row.designation.trim(),
        amountCostHt,
        amountSaleHt,
        note: row.note.trim() || null,
      });
    }

    return { preparationMaterials, preparationEquipment, laborItems, feeItems };
  }

  async function handleSave() {
    setLocalError(null);
    if (!titre.trim()) {
      setLocalError(`${t("common.labels.title")} obligatoire.`);
      return;
    }
    const quantiteDefautValue = quantiteDefaut.trim() === "" ? null : Number(quantiteDefaut);
    const tempsParUniteValue = tempsParUnite.trim() === "" ? null : Number(tempsParUnite);
    const coutReferenceValue =
      coutReferenceUnitaire.trim() === "" ? null : Number(coutReferenceUnitaire);
    if (quantiteDefautValue !== null && Number.isNaN(quantiteDefautValue)) {
      setLocalError(t("taskTemplateDrawer.invalidDefaultQuantity"));
      return;
    }
    if (tempsParUniteValue !== null && Number.isNaN(tempsParUniteValue)) {
      setLocalError(t("taskTemplateDrawer.invalidTimePerUnit"));
      return;
    }
    if (coutReferenceValue !== null && Number.isNaN(coutReferenceValue)) {
      setLocalError("Coût de référence invalide.");
      return;
    }

    let serializedPreparation: {
      preparationMaterials: TaskTemplateMaterialRatioInput[];
      preparationEquipment: TaskTemplateEquipmentItemInput[];
      laborItems: TaskTemplateLaborItemInput[];
      feeItems: TaskTemplateFeeItemInput[];
    };

    try {
      serializedPreparation = serializePreparation();
    } catch (err: any) {
      setLocalError(err?.message ?? "Préparation avancée invalide.");
      return;
    }

    const payload: TaskTemplateInput = {
      titre: titre.trim(),
      lot: lot.trim() || null,
      unite: unite.trim() || null,
      quantite_defaut: quantiteDefautValue,
      temps_prevu_par_unite_h: tempsParUniteValue,
      cout_reference_unitaire_ht: coutReferenceValue,
      description_technique: descriptionTechnique.trim() || null,
      caracteristiques: caracteristiques
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
      remarques: remarques.trim() || null,
      preparation_materials: advancedPreparationEnabled
        ? serializedPreparation.preparationMaterials
        : undefined,
      preparation_equipment: advancedPreparationEnabled
        ? serializedPreparation.preparationEquipment
        : undefined,
      labor_items: advancedPreparationEnabled ? serializedPreparation.laborItems : undefined,
      fee_items: advancedPreparationEnabled ? serializedPreparation.feeItems : undefined,
    };

    await onSave(payload);
  }

  async function handleGenerateWithCoco() {
    setLocalError(null);
    setCocoLoading(true);
    try {
      const result = await generateWithCoco({
        title: titre,
        unit: unite,
        lot,
        defaultQuantity: quantiteDefaut,
        timePerUnit: tempsParUnite,
        referenceUnitCostHt: coutReferenceUnitaire,
        usage: usageMetier,
        existingTechnicalDescription: descriptionTechnique,
        existingCharacteristics: caracteristiques,
        existingNotes: remarques,
        materials: materialDrafts,
        equipment: equipmentDrafts,
        labor: laborDrafts,
        fees: feeDrafts,
        costSummary: compositionTotals,
        products,
        lotProfile: selectedLotProfile,
      });

      setCocoResult(result);

      const materialLines = result.materials.map(materialResultText);
      const equipmentLines = result.equipment.map(equipmentResultText);
      const summaryLines = costSummaryLines(result);
      const technicalContent = [
        result.technicalDescription,
        formatList("Mode operatoire COCO", result.procedure),
      ].filter(Boolean).join("\n\n");
      const characteristicsContent = [
        formatList("Materiaux COCO", materialLines),
        formatList("Materiel COCO", equipmentLines),
        formatList("Consommables COCO", result.consumables),
        formatList("EPI COCO", result.ppe),
        formatList("Controles qualite COCO", result.controls),
        formatList("Photos DOE attendues", result.doePhotos),
        formatList("Documents DOE attendus", result.doeDocuments),
        formatList("Resume couts COCO", summaryLines),
        formatList("Caracteristiques COCO", result.characteristics),
      ].filter(Boolean).join("\n\n");
      const notesContent = [
        formatList("Retours terrain a alimenter", result.fieldReturns),
        formatList("Questions retour terrain", result.fieldReturnQuestions),
        formatList("Erreurs a eviter", result.errorsToAvoid),
        formatList("Points securite", result.safetyPoints),
        formatList("Informations manquantes", result.missingInformation),
      ].filter(Boolean).join("\n\n");

      setDescriptionTechnique((prev) => fillIfEmpty(prev, technicalContent));
      setCaracteristiques((prev) => fillIfEmpty(prev, characteristicsContent));
      setRemarques((prev) => fillIfEmpty(prev, notesContent));

      if (result.usedFallback) {
        setLocalError(`Coco IA indisponible. Fallback local applique: ${result.errorMessage ?? "erreur inconnue"}`);
      }
    } catch (err: any) {
      setLocalError(err?.message ?? "Coco n'a pas pu generer le template.");
    } finally {
      setCocoLoading(false);
    }
  }

  async function handleDelete() {
    if (!template?.id) return;
    const ok = window.confirm(t("taskTemplateDrawer.deleteConfirm", { name: template.titre }));
    if (!ok) return;
    await onDelete(template.id);
  }

  async function handleSaveLotProfile(profile: TaskTemplateLotProfileInput) {
    setLotSettingsSaving(true);
    setLotProfilesError(null);
    try {
      await saveTaskTemplateLotProfile(profile);
      const profiles = await listTaskTemplateLotProfiles();
      setLotProfiles(profiles);
      setLot(profile.name);
      const savedProfile = findLotProfileByName(profiles, profile.name);
      if (savedProfile) applyLotProfile(savedProfile, "soft");
    } catch (err: any) {
      setLotProfilesError(err?.message ?? "Enregistrement du lot impossible.");
    } finally {
      setLotSettingsSaving(false);
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-screen w-[46vw] max-w-[860px] min-w-[360px] bg-white border-l shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold truncate">{title}</div>
          <button
            type="button"
            className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
            onClick={onClose}
            disabled={busy}
          >
            {t("common.actions.close")}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <label className="block space-y-1">
            <div className="text-xs text-slate-600">{t("common.labels.title")} *</div>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
              placeholder="Ex: Pose plinthes MDF"
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1">
              <div className="text-xs text-slate-600">{t("common.labels.lot")}</div>
              <select
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                value={lot}
                onChange={(e) => selectLotProfile(e.target.value)}
              >
                <option value="">Lot à définir</option>
                {lotProfiles.filter((profile) => profile.isActive).map((profile) => (
                  <option key={profile.id} value={profile.name}>{profile.name}</option>
                ))}
                {lot && !findLotProfileByName(lotProfiles, lot) ? <option value={lot}>{lot}</option> : null}
              </select>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="text-xs font-semibold text-blue-700 hover:text-blue-900" onClick={() => setLotSettingsOpen(true)}>
                  Paramétrer les lots
                </button>
                {lotProfilesLoading ? <span className="text-xs text-slate-500">Chargement...</span> : null}
                {lotProfilesError ? <span className="text-xs text-red-600">{lotProfilesError}</span> : null}
              </div>
            </label>
            <label className="block space-y-1">
              <div className="text-xs text-slate-600">{t("taskTemplateDrawer.fields.unit")}</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={unite}
                onChange={(e) => setUnite(e.target.value)}
                placeholder="Ex: m2"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <div className="text-xs text-slate-600">Usage metier</div>
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm min-h-20"
              value={usageMetier}
              onChange={(e) => setUsageMetier(e.target.value)}
              placeholder="Ex : application peinture facade sur support prepare, renovation interieure, pose en local humide..."
            />
          </label>

          <div className="grid gap-3 md:grid-cols-3">
            <label className="block space-y-1">
              <div className="text-xs text-slate-600">{t("taskTemplateDrawer.fields.defaultQuantity")}</div>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={quantiteDefaut}
                onChange={(e) => setQuantiteDefaut(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <div className="text-xs text-slate-600">{t("taskTemplateDrawer.fields.timePerUnit")}</div>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={tempsParUnite}
                onChange={(e) => setTempsParUnite(e.target.value)}
              />
            </label>
            <label className="block space-y-1">
              <div className="text-xs text-slate-600">Coût de référence HT / unité</div>
              <input
                type="number"
                step="0.01"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={coutReferenceUnitaire}
                onChange={(e) => setCoutReferenceUnitaire(e.target.value)}
                placeholder="Ex: 38"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <div className="text-xs text-slate-600">Description technique</div>
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm min-h-24"
              value={descriptionTechnique}
              onChange={(e) => setDescriptionTechnique(e.target.value)}
              placeholder="Ex : doublage sur ossature avec isolant et plaques hydrofuges."
            />
          </label>

          <label className="block space-y-1">
            <div className="text-xs text-slate-600">Caractéristiques (1 par ligne)</div>
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm min-h-28"
              value={caracteristiques}
              onChange={(e) => setCaracteristiques(e.target.value)}
              placeholder={"Plaque : BA13 hydrofuge\nIsolation : laine de roche 120 mm\nSystème : Optima"}
            />
          </label>

          <label className="block space-y-1">
            <div className="text-xs text-slate-600">Remarques</div>
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm min-h-28"
              value={remarques}
              onChange={(e) => setRemarques(e.target.value)}
            />
          </label>

          {advancedPreparationEnabled ? (
            <div className="space-y-4 rounded-2xl border border-blue-200 bg-blue-50/40 p-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Préparation avancée
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  Ces données servent à produire une prévision théorique de matériaux et matériel sur les tâches chantier.
                </div>
              </div>

              {preparationLoading ? (
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
                  Chargement préparation avancée...
                </div>
              ) : null}

              {!preparationSchemaReady ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Migration préparation avancée non appliquée sur Supabase.
                </div>
              ) : null}

              {preparationError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {preparationError}
                </div>
              ) : null}

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Ratios matériaux</div>
                    <div className="text-xs text-slate-500">Exemple : rail 1.8 ml / m2, plaque 1.05 m2 / m2.</div>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-xs hover:bg-slate-50"
                    onClick={() => setMaterialDrafts((prev) => [...prev, createMaterialDraft()])}
                    disabled={busy || preparationLoading || !preparationSchemaReady}
                  >
                    Ajouter un matériau
                  </button>
                </div>

                {materialDrafts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    Aucune donnée de préparation définie.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {materialDrafts.map((row, index) => (
                      <div key={row.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-medium text-slate-700">Matériau #{index + 1}</div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-white"
                              onClick={() => setMaterialDrafts((prev) => reorderItems(prev, index, -1))}
                              disabled={index === 0 || busy}
                            >
                              Monter
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-white"
                              onClick={() => setMaterialDrafts((prev) => reorderItems(prev, index, 1))}
                              disabled={index === materialDrafts.length - 1 || busy}
                            >
                              Descendre
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                              onClick={() => setMaterialDrafts((prev) => prev.filter((item) => item.id !== row.id))}
                              disabled={busy}
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <select
                            className="rounded-xl border bg-white px-3 py-2 text-sm xl:col-span-2"
                            value={row.product_id}
                            onChange={(e) => applyProductToMaterial(index, e.target.value)}
                          >
                            <option value="">Ligne libre / choisir produit catalogue</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.designation}
                              </option>
                            ))}
                          </select>
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm"
                            value={row.material_name}
                            onChange={(e) => updateMaterialDraft(index, { material_name: e.target.value })}
                            placeholder="Matériau"
                          />
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm"
                            value={row.source_unit}
                            onChange={(e) => updateMaterialDraft(index, { source_unit: e.target.value })}
                            placeholder="Unité source"
                          />
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm"
                            inputMode="decimal"
                            value={row.ratio_quantity}
                            onChange={(e) => updateMaterialDraft(index, { ratio_quantity: e.target.value })}
                            placeholder="Quantité ratio"
                          />
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm"
                            value={row.ratio_unit}
                            onChange={(e) => updateMaterialDraft(index, { ratio_unit: e.target.value })}
                            placeholder="Unité ratio"
                          />
                        </div>

                        <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)]">
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm"
                            inputMode="decimal"
                            value={row.loss_percent}
                            onChange={(e) => updateMaterialDraft(index, { loss_percent: e.target.value })}
                            placeholder="Perte %"
                          />
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm"
                            value={row.notes}
                            onChange={(e) => updateMaterialDraft(index, { notes: e.target.value })}
                            placeholder="Remarque"
                          />
                        </div>
                        <div className="grid gap-2 md:grid-cols-4">
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm"
                            inputMode="decimal"
                            value={row.purchase_price_ht}
                            onChange={(e) =>
                              updateMaterialDraft(index, {
                                purchase_price_ht: e.target.value,
                                price_source: "manual",
                                manual_override: true,
                              })
                            }
                            placeholder="Prix achat HT"
                          />
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm"
                            inputMode="decimal"
                            value={row.sale_price_ht}
                            onChange={(e) =>
                              updateMaterialDraft(index, {
                                sale_price_ht: e.target.value,
                                price_source: "manual",
                                manual_override: true,
                              })
                            }
                            placeholder="Prix vente HT"
                          />
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm"
                            value={row.supplier_id}
                            onChange={(e) => updateMaterialDraft(index, { supplier_id: e.target.value })}
                            placeholder="Fournisseur"
                          />
                          <div className="rounded-xl border bg-white px-3 py-2 text-xs text-slate-500">
                            Source : {row.manual_override ? "manuel" : row.price_source || "manuel"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Matériel à prévoir</div>
                    <div className="text-xs text-slate-500">Définis le matériel obligatoire ou recommandé à prévoir.</div>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-xs hover:bg-slate-50"
                    onClick={() => setEquipmentDrafts((prev) => [...prev, createEquipmentDraft()])}
                    disabled={busy || preparationLoading || !preparationSchemaReady}
                  >
                    Ajouter du matériel
                  </button>
                </div>

                {equipmentDrafts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    Aucune donnée de préparation définie.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {equipmentDrafts.map((row, index) => (
                      <div key={row.id} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-xs font-medium text-slate-700">Matériel #{index + 1}</div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-white"
                              onClick={() => setEquipmentDrafts((prev) => reorderItems(prev, index, -1))}
                              disabled={index === 0 || busy}
                            >
                              Monter
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-white"
                              onClick={() => setEquipmentDrafts((prev) => reorderItems(prev, index, 1))}
                              disabled={index === equipmentDrafts.length - 1 || busy}
                            >
                              Descendre
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                              onClick={() => setEquipmentDrafts((prev) => prev.filter((item) => item.id !== row.id))}
                              disabled={busy}
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm xl:col-span-2"
                            value={row.equipment_name}
                            onChange={(e) => updateEquipmentDraft(index, { equipment_name: e.target.value })}
                            placeholder="Matériel"
                          />
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm"
                            inputMode="decimal"
                            value={row.default_quantity}
                            onChange={(e) => updateEquipmentDraft(index, { default_quantity: e.target.value })}
                            placeholder="Quantité"
                          />
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm"
                            value={row.unit}
                            onChange={(e) => updateEquipmentDraft(index, { unit: e.target.value })}
                            placeholder="Unité"
                          />
                        </div>

                        <div className="grid gap-2 md:grid-cols-[180px_minmax(0,1fr)]">
                          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={row.is_required}
                              onChange={(e) => updateEquipmentDraft(index, { is_required: e.target.checked })}
                            />
                            <span>{row.is_required ? "Obligatoire" : "Recommandé"}</span>
                          </label>
                          <input
                            className="rounded-xl border bg-white px-3 py-2 text-sm"
                            value={row.notes}
                            onChange={(e) => updateEquipmentDraft(index, { notes: e.target.value })}
                            placeholder="Remarque"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Main d'oeuvre</div>
                    <div className="text-xs text-slate-500">Temps prévu, coût chargé et prix de vente horaire.</div>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-xs hover:bg-slate-50"
                    onClick={() => setLaborDrafts((prev) => [...prev, createLaborDraft()])}
                    disabled={busy}
                  >
                    Ajouter main d'oeuvre
                  </button>
                </div>
                {laborDrafts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    Aucune main d'oeuvre définie.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {laborDrafts.map((row, index) => (
                      <div key={row.id} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-6">
                        <select
                          className="rounded-xl border bg-white px-3 py-2 text-sm"
                          value={row.resourceType}
                          onChange={(e) =>
                            updateLaborDraft(index, {
                              resourceType: e.target.value as LaborDraft["resourceType"],
                            })
                          }
                        >
                          <option value="manual">Saisie manuelle</option>
                          <option value="employee_role">Rôle salarié</option>
                          <option value="subcontractor">Sous-traitant</option>
                        </select>
                        <input
                          className="rounded-xl border bg-white px-3 py-2 text-sm"
                          inputMode="decimal"
                          value={row.duration}
                          onChange={(e) => updateLaborDraft(index, { duration: e.target.value })}
                          placeholder="Temps"
                        />
                        <input
                          className="rounded-xl border bg-white px-3 py-2 text-sm"
                          value={row.unit}
                          onChange={(e) => updateLaborDraft(index, { unit: e.target.value })}
                          placeholder="h"
                        />
                        <input
                          className="rounded-xl border bg-white px-3 py-2 text-sm"
                          inputMode="decimal"
                          value={row.hourlyCost}
                          onChange={(e) => updateLaborDraft(index, { hourlyCost: e.target.value })}
                          placeholder="Coût horaire"
                        />
                        <input
                          className="rounded-xl border bg-white px-3 py-2 text-sm"
                          inputMode="decimal"
                          value={row.hourlySalePrice}
                          onChange={(e) => updateLaborDraft(index, { hourlySalePrice: e.target.value })}
                          placeholder="PV horaire"
                        />
                        <button
                          type="button"
                          className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                          onClick={() => setLaborDrafts((prev) => prev.filter((item) => item.id !== row.id))}
                        >
                          Supprimer
                        </button>
                        <input
                          className="rounded-xl border bg-white px-3 py-2 text-sm md:col-span-6"
                          value={row.note}
                          onChange={(e) => updateLaborDraft(index, { note: e.target.value })}
                          placeholder="Remarque"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Matériel / frais</div>
                    <div className="text-xs text-slate-500">Location, consommables, frais fixes et divers.</div>
                  </div>
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-xs hover:bg-slate-50"
                    onClick={() => setFeeDrafts((prev) => [...prev, createFeeDraft()])}
                    disabled={busy}
                  >
                    Ajouter un frais
                  </button>
                </div>
                {feeDrafts.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    Aucun frais défini.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {feeDrafts.map((row, index) => (
                      <div key={row.id} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-5">
                        <select
                          className="rounded-xl border bg-white px-3 py-2 text-sm"
                          value={row.type}
                          onChange={(e) => updateFeeDraft(index, { type: e.target.value as FeeDraft["type"] })}
                        >
                          <option value="equipment_rental">Location matériel</option>
                          <option value="consumables">Consommables</option>
                          <option value="fixed_fee">Frais fixe</option>
                          <option value="other">Autre</option>
                        </select>
                        <input
                          className="rounded-xl border bg-white px-3 py-2 text-sm"
                          value={row.designation}
                          onChange={(e) => updateFeeDraft(index, { designation: e.target.value })}
                          placeholder="Désignation"
                        />
                        <input
                          className="rounded-xl border bg-white px-3 py-2 text-sm"
                          inputMode="decimal"
                          value={row.amountCostHt}
                          onChange={(e) => updateFeeDraft(index, { amountCostHt: e.target.value })}
                          placeholder="Coût HT"
                        />
                        <input
                          className="rounded-xl border bg-white px-3 py-2 text-sm"
                          inputMode="decimal"
                          value={row.amountSaleHt}
                          onChange={(e) => updateFeeDraft(index, { amountSaleHt: e.target.value })}
                          placeholder="PV HT"
                        />
                        <button
                          type="button"
                          className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                          onClick={() => setFeeDrafts((prev) => prev.filter((item) => item.id !== row.id))}
                        >
                          Supprimer
                        </button>
                        <input
                          className="rounded-xl border bg-white px-3 py-2 text-sm md:col-span-5"
                          value={row.note}
                          onChange={(e) => updateFeeDraft(index, { note: e.target.value })}
                          placeholder="Remarque"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Calcul automatique ouvrage</div>
                    <div className="mt-1 text-xs text-slate-500">Calcul centralisé par TaskCostEngine.</div>
                  </div>
                  {selectedLotProfile ? (
                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      Marges lot {selectedLotProfile.name}
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Prix de revient HT</div>
                    <div className="font-semibold">{compositionTotals.cost.toFixed(2)} €</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Prix vente conseillé HT</div>
                    <div className="font-semibold">{compositionTotals.sale.toFixed(2)} €</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Marge HT</div>
                    <div className="font-semibold">{compositionTotals.margin.toFixed(2)} €</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Taux marge</div>
                    <div className="font-semibold">{compositionTotals.marginRate.toFixed(1)} %</div>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 text-sm md:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">PR matériaux</div>
                    <div className="font-semibold">{compositionTotals.materialCost.toFixed(2)} €</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">PR MO</div>
                    <div className="font-semibold">{compositionTotals.laborCost.toFixed(2)} €</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Temps homme</div>
                    <div className="font-semibold">{compositionTotals.humanTimeHours.toFixed(2)} h</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs text-slate-500">Rentabilité</div>
                    <div className="font-semibold">{compositionTotals.profitabilityRate.toFixed(1)} %</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Assistant Coco - generation technique</div>
                    <div className="mt-1 text-xs text-slate-500">
                      Coco exploite la designation, l'unite, l'usage, les produits lies, les ratios, la main d'oeuvre et les frais avant de remplir les blocs techniques.
                    </div>
                  </div>
                  <button
                    type="button"
                    className={[
                      "rounded-xl px-4 py-2 text-sm font-medium",
                      cocoLoading || busy
                        ? "bg-slate-200 text-slate-500"
                        : "bg-blue-600 text-white hover:bg-blue-700",
                    ].join(" ")}
                    onClick={() => void handleGenerateWithCoco()}
                    disabled={cocoLoading || busy || preparationLoading}
                  >
                    {cocoLoading ? "Coco réfléchit..." : "Generer avec Coco"}
                  </button>
                </div>

                {cocoResult?.usedFallback ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Generation IA indisponible. Coco a applique un fallback local minimal a verifier.
                    {cocoResult.errorMessage ? ` Detail : ${cocoResult.errorMessage}` : ""}
                  </div>
                ) : null}

                {cocoResult ? (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                        Confiance: {cocoResult.confidence}
                      </span>
                      {cocoResult.missingInformation.length ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                          {cocoResult.missingInformation.length} information(s) manquante(s)
                        </span>
                      ) : null}
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      <CocoResultBlock title="Liste materiaux Coco" items={cocoResult.materials.map(materialResultText)} />
                      <CocoResultBlock title="Liste materiel Coco" items={cocoResult.equipment.map(equipmentResultText)} />
                      <CocoResultBlock title="Consommables" items={cocoResult.consumables} />
                      <CocoResultBlock title="EPI" items={cocoResult.ppe} />
                      <CocoResultBlock title="Mode operatoire complet" items={cocoResult.procedure} />
                      <CocoResultBlock
                        title="Controles / erreurs a eviter"
                        items={[...cocoResult.controls, ...cocoResult.errorsToAvoid.map((item) => `Erreur: ${item}`)]}
                      />
                      <CocoResultBlock title="Securite" items={cocoResult.safetyPoints} />
                      <CocoResultBlock title="Photos DOE" items={cocoResult.doePhotos} />
                      <CocoResultBlock title="Documents DOE" items={cocoResult.doeDocuments} />
                      <CocoResultBlock title="Retour terrain attendu" items={[...cocoResult.fieldReturns, ...cocoResult.fieldReturnQuestions]} />
                      <CocoResultBlock title="Informations manquantes" items={cocoResult.missingInformation} />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                    Aucun resultat Coco pour le moment.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {(localError || error) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {localError ?? error}
            </div>
          )}
        </div>

        <div className="border-t p-4 flex justify-between gap-2">
          <button
            type="button"
            className="rounded-xl border border-red-200 text-red-700 px-3 py-2 text-sm hover:bg-red-50"
            onClick={handleDelete}
            disabled={busy || !template}
          >
            {deleting ? t("common.states.deleting") : t("common.actions.delete")}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
              onClick={onClose}
              disabled={busy}
            >
              {t("common.actions.cancel")}
            </button>
            <button
              type="button"
              className={[
                "rounded-xl px-4 py-2 text-sm",
                busy ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
              ].join(" ")}
              onClick={handleSave}
              disabled={busy || preparationLoading || cocoLoading}
            >
              {saving ? t("common.states.saving") : t("common.actions.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
    {lotSettingsOpen ? (
      <LotProfilesDrawer
        profiles={lotProfiles}
        saving={lotSettingsSaving}
        error={lotProfilesError}
        onClose={() => setLotSettingsOpen(false)}
        onSave={handleSaveLotProfile}
      />
    ) : null}
    </>
  );
}

function emptyLotProfileDraft(sortOrder: number): TaskTemplateLotProfileInput {
  return {
    name: "",
    keywords: [],
    laborMarginRate: 35,
    equipmentMarginRate: 25,
    materialsMarginRate: 30,
    feesMarginRate: 20,
    defaultUnit: "m2",
    averageTimeHours: null,
    qualityControls: [],
    commonMistakes: [],
    chantierInstructions: [],
    defaultEquipment: [],
    defaultPpe: [],
    defaultConsumables: [],
    doeDocuments: [],
    fieldReturns: [],
    sortOrder,
    isActive: true,
  };
}

function profileToInput(profile: TaskTemplateLotProfile): TaskTemplateLotProfileInput {
  return {
    id: profile.id,
    name: profile.name,
    keywords: profile.keywords,
    laborMarginRate: profile.laborMarginRate,
    equipmentMarginRate: profile.equipmentMarginRate,
    materialsMarginRate: profile.materialsMarginRate,
    feesMarginRate: profile.feesMarginRate,
    defaultUnit: profile.defaultUnit,
    averageTimeHours: profile.averageTimeHours,
    qualityControls: profile.qualityControls,
    commonMistakes: profile.commonMistakes,
    chantierInstructions: profile.chantierInstructions,
    defaultEquipment: profile.defaultEquipment,
    defaultPpe: profile.defaultPpe,
    defaultConsumables: profile.defaultConsumables,
    doeDocuments: profile.doeDocuments,
    fieldReturns: profile.fieldReturns,
    sortOrder: profile.sortOrder,
    isActive: profile.isActive,
  };
}

function splitMultiline(value: string): string[] {
  return value
    .split(/\r?\n|,/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function LotProfilesDrawer({
  profiles,
  saving,
  error,
  onClose,
  onSave,
}: {
  profiles: TaskTemplateLotProfile[];
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (profile: TaskTemplateLotProfileInput) => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState(profiles[0]?.id ?? "__new__");
  const selectedProfile = profiles.find((profile) => profile.id === selectedId) ?? null;
  const [draft, setDraft] = useState<TaskTemplateLotProfileInput>(() =>
    selectedProfile ? profileToInput(selectedProfile) : emptyLotProfileDraft(profiles.length + 1),
  );

  useEffect(() => {
    const profile = profiles.find((row) => row.id === selectedId) ?? null;
    setDraft(profile ? profileToInput(profile) : emptyLotProfileDraft(profiles.length + 1));
  }, [profiles, selectedId]);

  function patch(patch: Partial<TaskTemplateLotProfileInput>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 flex h-screen w-full max-w-5xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-700">Moteur métier</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Paramétrer les lots</h2>
            <p className="mt-1 text-sm text-slate-500">Profils communs à toute l'entreprise, lus et écrits en base.</p>
          </div>
          <button type="button" className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={onClose}>Fermer</button>
        </div>

        <div className="grid min-h-0 flex-1 md:grid-cols-[260px_minmax(0,1fr)]">
          <div className="border-r border-slate-200 p-4">
            <button type="button" className="mb-3 w-full rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white" onClick={() => setSelectedId("__new__")}>
              Nouveau lot
            </button>
            <div className="space-y-2">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  className={[
                    "w-full rounded-xl px-3 py-2 text-left text-sm",
                    profile.id === selectedId ? "bg-blue-50 font-semibold text-blue-800" : "hover:bg-slate-50",
                  ].join(" ")}
                  onClick={() => setSelectedId(profile.id)}
                >
                  {profile.name}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            {error ? <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <div className="grid gap-4 lg:grid-cols-4">
              <LotField label="Nom" value={draft.name} onChange={(name) => patch({ name })} className="lg:col-span-2" />
              <LotField label="Unité par défaut" value={draft.defaultUnit ?? ""} onChange={(defaultUnit) => patch({ defaultUnit: defaultUnit || null })} />
              <LotNumber label="Temps moyen h" value={draft.averageTimeHours} onChange={(averageTimeHours) => patch({ averageTimeHours })} />
              <LotNumber label="Marge MO %" value={draft.laborMarginRate} onChange={(laborMarginRate) => patch({ laborMarginRate: laborMarginRate ?? 0 })} />
              <LotNumber label="Marge matériel %" value={draft.equipmentMarginRate} onChange={(equipmentMarginRate) => patch({ equipmentMarginRate: equipmentMarginRate ?? 0 })} />
              <LotNumber label="Marge matériaux %" value={draft.materialsMarginRate} onChange={(materialsMarginRate) => patch({ materialsMarginRate: materialsMarginRate ?? 0 })} />
              <LotNumber label="Marge frais %" value={draft.feesMarginRate} onChange={(feesMarginRate) => patch({ feesMarginRate: feesMarginRate ?? 0 })} />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <LotList label="Mots clés" value={draft.keywords} onChange={(keywords) => patch({ keywords })} />
              <LotList label="Contrôles qualité" value={draft.qualityControls} onChange={(qualityControls) => patch({ qualityControls })} />
              <LotList label="Erreurs fréquentes" value={draft.commonMistakes} onChange={(commonMistakes) => patch({ commonMistakes })} />
              <LotList label="Consignes chantier" value={draft.chantierInstructions} onChange={(chantierInstructions) => patch({ chantierInstructions })} />
              <LotList label="Matériel par défaut" value={draft.defaultEquipment} onChange={(defaultEquipment) => patch({ defaultEquipment })} />
              <LotList label="EPI" value={draft.defaultPpe} onChange={(defaultPpe) => patch({ defaultPpe })} />
              <LotList label="Consommables" value={draft.defaultConsumables} onChange={(defaultConsumables) => patch({ defaultConsumables })} />
              <LotList label="Documents DOE" value={draft.doeDocuments} onChange={(doeDocuments) => patch({ doeDocuments })} />
              <LotList label="Retours terrain" value={draft.fieldReturns} onChange={(fieldReturns) => patch({ fieldReturns })} />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-4">
          <button type="button" className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50" onClick={onClose}>Annuler</button>
          <button type="button" className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" disabled={saving || !draft.name.trim()} onClick={() => void onSave(draft)}>
            {saving ? "Enregistrement..." : "Enregistrer le lot"}
          </button>
        </div>
      </aside>
    </div>
  );
}

function LotField({ label, value, onChange, className = "" }: { label: string; value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function LotNumber({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <label className="block space-y-1">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <input
        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
        inputMode="decimal"
        value={value ?? ""}
        onChange={(event) => {
          const parsed = parseNumberField(event.target.value);
          onChange(event.target.value.trim() === "" ? null : parsed);
        }}
      />
    </label>
  );
}

function LotList({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <label className="block space-y-1">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <textarea
        className="min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300"
        value={value.join("\n")}
        onChange={(event) => onChange(splitMultiline(event.target.value))}
        placeholder="Une ligne par élément"
      />
    </label>
  );
}
