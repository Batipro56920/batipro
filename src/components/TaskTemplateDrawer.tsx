import { useEffect, useMemo, useState } from "react";
import type { TaskTemplateInput, TaskTemplateRow } from "../services/taskLibrary.service";
import {
  getTaskTemplatePreparation,
  type TaskTemplateEquipmentItemInput,
  type TaskTemplateMaterialRatioInput,
} from "../services/taskTemplatePreparation.service";
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
  material_name: string;
  source_unit: string;
  ratio_quantity: string;
  ratio_unit: string;
  loss_percent: string;
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
    material_name: String(row?.material_name ?? ""),
    source_unit: String(row?.source_unit ?? ""),
    ratio_quantity: toField(row?.ratio_quantity ?? null),
    ratio_unit: String(row?.ratio_unit ?? ""),
    loss_percent: toField(row?.loss_percent ?? null),
    notes: String(row?.notes ?? ""),
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
    !row.source_unit.trim() &&
    !row.ratio_quantity.trim() &&
    !row.ratio_unit.trim() &&
    !row.loss_percent.trim() &&
    !row.notes.trim()
  );
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
  const [materialDrafts, setMaterialDrafts] = useState<MaterialRatioDraft[]>([]);
  const [equipmentDrafts, setEquipmentDrafts] = useState<EquipmentDraft[]>([]);
  const [preparationLoading, setPreparationLoading] = useState(false);
  const [preparationSchemaReady, setPreparationSchemaReady] = useState(true);
  const [preparationError, setPreparationError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

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
    }
    setPreparationSchemaReady(true);
    setPreparationError(null);
    setLocalError(null);
  }, [
    open,
    template?.id,
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
        if (!alive) return;
        setPreparationLoading(false);
      }
    }

    void loadPreparation();

    return () => {
      alive = false;
    };
  }, [open, template?.id, advancedPreparationEnabled]);

  const busy = saving || deleting;
  const title = useMemo(() => (template ? `${t("common.actions.edit")} template` : t("bibliothequeTasks.new")), [t, template]);

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

  function serializePreparation() {
    const preparationMaterials: TaskTemplateMaterialRatioInput[] = [];
    const preparationEquipment: TaskTemplateEquipmentItemInput[] = [];

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

      preparationMaterials.push({
        material_name: row.material_name.trim(),
        source_unit: row.source_unit.trim(),
        ratio_quantity: ratioQuantity,
        ratio_unit: row.ratio_unit.trim(),
        loss_percent: lossPercent,
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

    return { preparationMaterials, preparationEquipment };
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
    };

    await onSave(payload);
  }

  async function handleDelete() {
    if (!template?.id) return;
    const ok = window.confirm(t("taskTemplateDrawer.deleteConfirm", { name: template.titre }));
    if (!ok) return;
    await onDelete(template.id);
  }

  return (
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
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                placeholder="Ex: Peinture"
              />
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
              disabled={busy || preparationLoading}
            >
              {saving ? t("common.states.saving") : t("common.actions.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
