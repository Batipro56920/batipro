import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";

import {
  getChantierPreparationChecklist,
  upsertChantierPreparationChecklist,
  type ChantierPreparationChecklistRow,
} from "../../services/chantierPreparation.service";
import { listChantierPhotos, type ChantierPhotoRow } from "../../services/chantierPhotos.service";
import {
  buildChantierZonePathMap,
  buildChantierZoneTree,
  collectDescendantPieceIds,
  collectDescendantZoneIds,
  countDescendantPieces,
  createChantierZone,
  deleteChantierZone,
  getChantierZoneUsageSummary,
  listChantierZones,
  listValidZoneParents,
  localisationKindToZoneType,
  resolveChantierZonePath,
  updateChantierZone,
  zoneTypeToLocalisationKind,
  type ChantierLocalisationKind,
  type ChantierZoneRow,
  type ChantierZoneTreeNode,
} from "../../services/chantierZones.service";

const PREPARATION_FIELDS = [
  { key: "plans_disponibles", label: "Plans disponibles" },
  { key: "materiaux_commandes", label: "Materiaux commandes" },
  { key: "materiel_prevu", label: "Materiel prevu" },
  { key: "intervenants_affectes", label: "Intervenants affectes" },
  { key: "acces_chantier_valide", label: "Acces chantier valide" },
] as const;

const LOCALISATION_KIND_OPTIONS: Array<{ value: ChantierLocalisationKind; label: string }> = [
  { value: "batiment", label: "Batiment" },
  { value: "niveau", label: "Niveau" },
  { value: "piece", label: "Piece" },
] as const;

type PreparationTaskLink = {
  id: string;
  titre: string | null;
  titre_terrain: string | null;
  lot: string | null;
  zone_id: string | null;
};

type PreparationReserveLink = { id: string; title: string | null; status: string | null; zone_id: string | null };
type PreparationDocumentLink = { id: string; title: string | null; zone_id: string | null };
type PreparationConsigneLink = { id: string; title: string | null; description: string | null; zone_id: string | null };

type PreparationTreeTabProps = {
  chantierId: string;
  view?: "full" | "preparation" | "localisation";
  tasksCount: number;
  documentsCount: number;
  intervenantsCount: number;
  materielCount: number;
  tasks: PreparationTaskLink[];
  taskZoneIdsByTaskId: Record<string, string[]>;
  reserves: PreparationReserveLink[];
  documents: PreparationDocumentLink[];
  consignes: PreparationConsigneLink[];
};

type ZoneEditorState =
  | { mode: "create"; parentId: string | null; zoneId: null }
  | { mode: "edit"; parentId: string | null; zoneId: string }
  | null;

function preparationProgress(checklist: ChantierPreparationChecklistRow) {
  const doneCount = PREPARATION_FIELDS.filter((field) => Boolean(checklist[field.key])).length;
  return Math.round((doneCount / PREPARATION_FIELDS.length) * 100);
}

function localisationKindLabel(kind: ChantierLocalisationKind) {
  return LOCALISATION_KIND_OPTIONS.find((entry) => entry.value === kind)?.label ?? "Localisation";
}

function localisationKindBadgeClass(kind: ChantierLocalisationKind) {
  if (kind === "batiment") return "border-blue-200 bg-blue-50 text-blue-700";
  if (kind === "niveau") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function suggestChildKind(parent: ChantierZoneRow | null): ChantierLocalisationKind {
  if (!parent) return "batiment";
  return zoneTypeToLocalisationKind(parent.zone_type) === "batiment" ? "niveau" : "piece";
}

function zoneActionLabel(kind: ChantierLocalisationKind) {
  if (kind === "batiment") return "Ajouter un niveau";
  if (kind === "niveau") return "Ajouter une piece";
  return null;
}

function resolveTaskLabel(task: PreparationTaskLink) {
  return String(task.titre_terrain ?? "").trim() || String(task.titre ?? "").trim() || "Sans titre";
}

function ZoneInlineEditor({
  state,
  saving,
  draftName,
  setDraftName,
  draftKind,
  setDraftKind,
  draftMoveParentId,
  setDraftMoveParentId,
  parentLabel,
  availableParentZones,
  zonePathById,
  onSubmit,
  onCancel,
}: {
  state: ZoneEditorState;
  saving: boolean;
  draftName: string;
  setDraftName: (value: string) => void;
  draftKind: ChantierLocalisationKind;
  setDraftKind: (value: ChantierLocalisationKind) => void;
  draftMoveParentId: string;
  setDraftMoveParentId: (value: string) => void;
  parentLabel: string | null;
  availableParentZones: ChantierZoneRow[];
  zonePathById: Map<string, string>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="rounded-2xl border border-blue-200 bg-blue-50/70 p-3">
      <div className="text-sm font-semibold text-slate-900">
        {state?.mode === "edit" ? "Modifier l'element" : "Ajouter a l'arborescence"}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {state?.mode === "edit"
          ? "Ajuste le nom ou deplace l'element sans quitter l'arborescence."
          : parentLabel
            ? `Parent : ${parentLabel}`
            : "Creation a la racine du chantier."}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-xs text-slate-600">
          <div>Type</div>
          <select
            value={draftKind}
            onChange={(event) => setDraftKind(event.target.value as ChantierLocalisationKind)}
            disabled={saving || state?.mode === "create"}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            {LOCALISATION_KIND_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1 text-xs text-slate-600">
          <div>Nom</div>
          <input
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            disabled={saving}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            placeholder={
              draftKind === "batiment" ? "Ex : Maison" : draftKind === "niveau" ? "Ex : RDC" : "Ex : Cuisine"
            }
          />
        </label>
      </div>

      {state?.mode === "edit" ? (
        <label className="mt-3 block space-y-1 text-xs text-slate-600">
          <div>Deplacer sous</div>
          <select
            value={draftMoveParentId}
            onChange={(event) => setDraftMoveParentId(event.target.value)}
            disabled={saving}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">Racine du chantier</option>
            {availableParentZones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zonePathById.get(zone.id) ?? zone.nom}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {saving ? "Enregistrement..." : state?.mode === "edit" ? "Enregistrer" : "Ajouter"}
        </button>
      </div>
    </form>
  );
}

function ZoneTreeBranch({
  node,
  expandedZoneIds,
  selectedZoneId,
  editorState,
  zonesSaving,
  onToggle,
  onOpenDetail,
  onCreateChild,
  onEdit,
  onDelete,
  renderInlineEditor,
}: {
  node: ChantierZoneTreeNode;
  expandedZoneIds: Record<string, boolean>;
  selectedZoneId: string | null;
  editorState: ZoneEditorState;
  zonesSaving: boolean;
  onToggle: (zoneId: string) => void;
  onOpenDetail: (zoneId: string) => void;
  onCreateChild: (zone: ChantierZoneRow) => void;
  onEdit: (zone: ChantierZoneRow) => void;
  onDelete: (zone: ChantierZoneRow) => void;
  renderInlineEditor: () => ReactNode;
}) {
  const expanded = expandedZoneIds[node.id] ?? true;
  const hasChildren = node.children.length > 0;
  const childAction = zoneActionLabel(node.kind);
  const showEditor =
    editorState &&
    ((editorState.mode === "create" && editorState.parentId === node.id) || editorState.zoneId === node.id);

  return (
    <div className="space-y-2">
      <div
        className={[
          "rounded-2xl border px-3 py-3 transition",
          selectedZoneId === node.id ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200 bg-white",
        ].join(" ")}
        style={{ marginLeft: `${node.depth * 18}px` }}
      >
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs text-slate-600 hover:bg-white"
            aria-label={expanded ? "Replier" : "Deplier"}
          >
            {hasChildren ? (expanded ? "-" : "+") : "•"}
          </button>
          <button type="button" onClick={() => onOpenDetail(node.id)} className="min-w-0 flex-1 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate text-sm font-semibold text-slate-950">{node.nom}</span>
              <span className={["rounded-full border px-2 py-0.5 text-[11px] font-semibold", localisationKindBadgeClass(node.kind)].join(" ")}>
                {localisationKindLabel(node.kind)}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500">{node.path}</div>
          </button>
          <div className="flex flex-wrap justify-end gap-2">
            {childAction ? (
              <button
                type="button"
                onClick={() => onCreateChild(node)}
                disabled={zonesSaving}
                className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
              >
                {childAction}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onEdit(node)}
              disabled={zonesSaving}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Modifier
            </button>
            <button
              type="button"
              onClick={() => void onDelete(node)}
              disabled={zonesSaving}
              className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
      {showEditor ? renderInlineEditor() : null}
      {hasChildren && expanded ? (
        <div className="space-y-2">
          {node.children.map((child) => (
            <ZoneTreeBranch
              key={child.id}
              node={child}
              expandedZoneIds={expandedZoneIds}
              selectedZoneId={selectedZoneId}
              editorState={editorState}
              zonesSaving={zonesSaving}
              onToggle={onToggle}
              onOpenDetail={onOpenDetail}
              onCreateChild={onCreateChild}
              onEdit={onEdit}
              onDelete={onDelete}
              renderInlineEditor={renderInlineEditor}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PreparationTreeTab({
  chantierId,
  view = "full",
  tasksCount,
  documentsCount,
  intervenantsCount,
  materielCount,
  tasks,
  taskZoneIdsByTaskId,
  reserves,
  documents,
  consignes,
}: PreparationTreeTabProps) {
  const [checklist, setChecklist] = useState<ChantierPreparationChecklistRow | null>(null);
  const [checklistSchemaReady, setChecklistSchemaReady] = useState(true);
  const [checklistLoading, setChecklistLoading] = useState(true);
  const [checklistSaving, setChecklistSaving] = useState(false);
  const [checklistError, setChecklistError] = useState<string | null>(null);
  const [checklistComment, setChecklistComment] = useState("");

  const [zones, setZones] = useState<ChantierZoneRow[]>([]);
  const [zonesSchemaReady, setZonesSchemaReady] = useState(true);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zonesSaving, setZonesSaving] = useState(false);
  const [zonesError, setZonesError] = useState<string | null>(null);
  const [expandedZoneIds, setExpandedZoneIds] = useState<Record<string, boolean>>({});
  const [zoneEditorState, setZoneEditorState] = useState<ZoneEditorState>(null);
  const [zoneDraftName, setZoneDraftName] = useState("");
  const [zoneDraftKind, setZoneDraftKind] = useState<ChantierLocalisationKind>("batiment");
  const [zoneDraftMoveParentId, setZoneDraftMoveParentId] = useState("");
  const [zoneDetailOpenId, setZoneDetailOpenId] = useState<string | null>(null);
  const [zonePhotos, setZonePhotos] = useState<ChantierPhotoRow[]>([]);

  const percentReady = useMemo(() => (checklist ? preparationProgress(checklist) : 0), [checklist]);
  const zoneTree = useMemo(() => buildChantierZoneTree(zones), [zones]);
  const zoneById = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones]);
  const zonePathById = useMemo(() => buildChantierZonePathMap(zones), [zones]);
  const detailZone = zoneDetailOpenId ? zoneById.get(zoneDetailOpenId) ?? null : null;
  const availableParentZones = useMemo(
    () => listValidZoneParents(zones, zoneEditorState?.mode === "edit" ? zoneEditorState.zoneId : null),
    [zones, zoneEditorState],
  );

  async function refreshPreparation() {
    setChecklistLoading(true);
    setChecklistError(null);
    try {
      const result = await getChantierPreparationChecklist(chantierId);
      setChecklist(result.checklist);
      setChecklistComment(result.checklist.commentaire ?? "");
      setChecklistSchemaReady(result.schemaReady);
    } catch (error: any) {
      setChecklistError(error?.message ?? "Erreur chargement preparation.");
    } finally {
      setChecklistLoading(false);
    }
  }

  async function refreshZones() {
    setZonesLoading(true);
    setZonesError(null);
    try {
      const result = await listChantierZones(chantierId);
      setZones(result.zones);
      setZonesSchemaReady(result.schemaReady);
    } catch (error: any) {
      setZonesError(error?.message ?? "Erreur chargement localisations.");
    } finally {
      setZonesLoading(false);
    }
  }

  useEffect(() => {
    void refreshPreparation();
    void refreshZones();
  }, [chantierId]);

  useEffect(() => {
    let cancelled = false;

    async function refreshPhotos() {
      try {
        const result = await listChantierPhotos(chantierId);
        if (!cancelled) setZonePhotos(result.photos);
      } catch {
        if (!cancelled) setZonePhotos([]);
      }
    }

    void refreshPhotos();
    return () => {
      cancelled = true;
    };
  }, [chantierId]);

  useEffect(() => {
    setExpandedZoneIds((current) => {
      const next: Record<string, boolean> = {};
      for (const zone of zones) next[zone.id] = current[zone.id] ?? true;
      return next;
    });
  }, [zones]);

  useEffect(() => {
    if (zones.length === 0 && zonesSchemaReady) {
      setZoneEditorState({ mode: "create", parentId: null, zoneId: null });
      setZoneDraftKind("batiment");
      setZoneDraftName("");
      setZoneDraftMoveParentId("");
    }
  }, [zones.length, zonesSchemaReady]);

  async function toggleChecklistField(field: (typeof PREPARATION_FIELDS)[number]["key"], value: boolean) {
    if (!checklist) return;
    setChecklistSaving(true);
    setChecklistError(null);
    const previous = checklist;
    setChecklist((current) => (current ? { ...current, [field]: value } : current));
    try {
      const saved = await upsertChantierPreparationChecklist(chantierId, {
        [field]: value,
        commentaire: checklistComment,
      });
      setChecklist(saved);
      setChecklistComment(saved.commentaire ?? "");
    } catch (error: any) {
      setChecklist(previous);
      setChecklistError(error?.message ?? "Erreur mise a jour checklist.");
    } finally {
      setChecklistSaving(false);
    }
  }

  async function saveChecklistComment() {
    if (!checklist) return;
    setChecklistSaving(true);
    setChecklistError(null);
    try {
      const saved = await upsertChantierPreparationChecklist(chantierId, { commentaire: checklistComment });
      setChecklist(saved);
      setChecklistComment(saved.commentaire ?? "");
    } catch (error: any) {
      setChecklistError(error?.message ?? "Erreur enregistrement commentaire.");
    } finally {
      setChecklistSaving(false);
    }
  }

  function toggleZoneExpanded(zoneId: string) {
    setExpandedZoneIds((current) => ({
      ...current,
      [zoneId]: !(current[zoneId] ?? true),
    }));
  }

  function resetZoneEditor() {
    setZoneEditorState(null);
    setZoneDraftName("");
    setZoneDraftKind("batiment");
    setZoneDraftMoveParentId("");
  }

  function openCreateRoot() {
    setZoneEditorState({ mode: "create", parentId: null, zoneId: null });
    setZoneDraftKind("batiment");
    setZoneDraftName("");
    setZoneDraftMoveParentId("");
  }

  function openCreateZone(parentZone: ChantierZoneRow) {
    setExpandedZoneIds((current) => ({ ...current, [parentZone.id]: true }));
    setZoneEditorState({ mode: "create", parentId: parentZone.id, zoneId: null });
    setZoneDraftKind(suggestChildKind(parentZone));
    setZoneDraftName("");
    setZoneDraftMoveParentId(parentZone.id);
  }

  function openEditZone(zone: ChantierZoneRow) {
    setZoneEditorState({ mode: "edit", parentId: zone.parent_zone_id ?? null, zoneId: zone.id });
    setZoneDraftName(zone.nom);
    setZoneDraftKind(zoneTypeToLocalisationKind(zone.zone_type));
    setZoneDraftMoveParentId(zone.parent_zone_id ?? "");
  }

  async function submitZoneEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!zoneEditorState || !zoneDraftName.trim()) {
      setZonesError("Nom de localisation obligatoire.");
      return;
    }

    setZonesSaving(true);
    setZonesError(null);
    try {
      if (zoneEditorState.mode === "create") {
        const siblingCount = zones.filter(
          (zone) => (zone.parent_zone_id ?? null) === (zoneEditorState.parentId ?? null),
        ).length;
        const saved = await createChantierZone({
          chantier_id: chantierId,
          parent_zone_id: zoneEditorState.parentId,
          nom: zoneDraftName.trim(),
          zone_type: localisationKindToZoneType(zoneDraftKind),
          niveau: zoneDraftKind === "niveau" ? zoneDraftName.trim() : null,
          ordre: siblingCount,
        });
        await refreshZones();
        setZoneDetailOpenId(saved.id);
        setExpandedZoneIds((current) => ({
          ...current,
          [saved.id]: true,
          ...(zoneEditorState.parentId ? { [zoneEditorState.parentId]: true } : {}),
        }));
      } else {
        const saved = await updateChantierZone(zoneEditorState.zoneId, {
          parent_zone_id: zoneDraftMoveParentId || null,
          nom: zoneDraftName.trim(),
          zone_type: localisationKindToZoneType(zoneDraftKind),
          niveau: zoneDraftKind === "niveau" ? zoneDraftName.trim() : null,
        });
        await refreshZones();
        setZoneDetailOpenId(saved.id);
      }
      resetZoneEditor();
    } catch (error: any) {
      setZonesError(error?.message ?? "Erreur enregistrement localisation.");
    } finally {
      setZonesSaving(false);
    }
  }

  async function removeZone(zone: ChantierZoneRow) {
    setZonesError(null);
    const usage = await getChantierZoneUsageSummary(zone.id);
    const descendants = collectDescendantZoneIds(zones, zone.id).length - 1;
    const warnings: string[] = [];

    if (descendants > 0) warnings.push(`${descendants} sous-localisation(s) seront detachees.`);
    if (usage.totalLinks > 0) {
      warnings.push(
        [
          usage.links.tasks ? `${usage.links.tasks} tache(s)` : null,
          usage.links.photos ? `${usage.links.photos} photo(s)` : null,
          usage.links.reserves ? `${usage.links.reserves} reserve(s)` : null,
          usage.links.documents ? `${usage.links.documents} document(s)` : null,
          usage.links.consignes ? `${usage.links.consignes} consigne(s)` : null,
          usage.links.achats ? `${usage.links.achats} achat(s)` : null,
          usage.links.ecarts ? `${usage.links.ecarts} ecart(s)` : null,
          usage.links.retours ? `${usage.links.retours} retour(s)` : null,
        ]
          .filter(Boolean)
          .join(", "),
      );
    }

    const message = [
      `Supprimer "${zone.nom}" ?`,
      warnings.length > 0 ? "" : null,
      ...warnings,
      warnings.length > 0 ? "" : null,
      warnings.length > 0 ? "Les liens existants seront detaches automatiquement." : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (!window.confirm(message)) return;

    setZonesSaving(true);
    try {
      await deleteChantierZone(zone.id);
      await refreshZones();
      if (zoneDetailOpenId === zone.id) setZoneDetailOpenId(null);
      resetZoneEditor();
    } catch (error: any) {
      setZonesError(error?.message ?? "Erreur suppression localisation.");
    } finally {
      setZonesSaving(false);
    }
  }

  function renderInlineEditor() {
    if (!zoneEditorState) return null;

    return (
      <ZoneInlineEditor
        state={zoneEditorState}
        saving={zonesSaving}
        draftName={zoneDraftName}
        setDraftName={setZoneDraftName}
        draftKind={zoneDraftKind}
        setDraftKind={setZoneDraftKind}
        draftMoveParentId={zoneDraftMoveParentId}
        setDraftMoveParentId={setZoneDraftMoveParentId}
        parentLabel={
          zoneEditorState.mode === "create" && zoneEditorState.parentId
            ? resolveChantierZonePath(zoneEditorState.parentId, zonePathById)
            : null
        }
        availableParentZones={availableParentZones}
        zonePathById={zonePathById}
        onSubmit={(event) => void submitZoneEditor(event)}
        onCancel={resetZoneEditor}
      />
    );
  }

  const detailSummary = useMemo(() => {
    if (!detailZone) return null;

    const zoneIds = new Set(collectDescendantZoneIds(zones, detailZone.id));
    const pieceIds = new Set(collectDescendantPieceIds(zones, detailZone.id));
    const childZones = zones.filter((zone) => (zone.parent_zone_id ?? null) === detailZone.id);

    const linkedTasks = tasks.filter((task) => {
      const explicitPieceIds = taskZoneIdsByTaskId[task.id] ?? [];
      if (explicitPieceIds.length > 0) {
        return explicitPieceIds.some((zoneId) => pieceIds.has(zoneId));
      }
      const fallbackZoneId = String(task.zone_id ?? "").trim();
      if (!fallbackZoneId) return false;
      if (zoneIds.has(fallbackZoneId)) return true;
      return collectDescendantPieceIds(zones, fallbackZoneId).some((zoneId) => pieceIds.has(zoneId));
    });

    return {
      path: resolveChantierZonePath(detailZone.id, zonePathById),
      kind: zoneTypeToLocalisationKind(detailZone.zone_type),
      childZones,
      pieceCount: countDescendantPieces(zones, detailZone.id),
      tasks: linkedTasks,
      photos: zonePhotos.filter((row) => row.zone_id && zoneIds.has(row.zone_id)),
      reserves: reserves.filter((row) => row.zone_id && zoneIds.has(row.zone_id)),
      documents: documents.filter((row) => row.zone_id && zoneIds.has(row.zone_id)),
      consignes: consignes.filter((row) => row.zone_id && zoneIds.has(row.zone_id)),
    };
  }, [consignes, detailZone, documents, reserves, taskZoneIdsByTaskId, tasks, zonePathById, zonePhotos, zones]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(380px,0.95fr)_minmax(460px,1.05fr)]">
        {view !== "localisation" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Preparer</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Checklist avant demarrage</h2>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Valide les prerequis essentiels pour passer le chantier en execution sans demarrer avec des manques.
              </p>
            </div>
            <div
              className={[
                "rounded-full border px-3 py-1 text-xs font-semibold",
                checklist?.statut === "chantier_pret"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700",
              ].join(" ")}
            >
              {checklist?.statut === "chantier_pret" ? "Chantier pret" : "Chantier incomplet"}
            </div>
          </div>

          {!checklistSchemaReady ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Migration preparation non appliquee : checklist visible mais non sauvegardable.
            </div>
          ) : null}

          {checklistError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {checklistError}
            </div>
          ) : null}

          <div className="mt-5 rounded-3xl bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Progression de preparation</span>
              <span>{percentReady}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className={[
                  "h-full rounded-full transition-all",
                  percentReady >= 100 ? "bg-emerald-500" : "bg-blue-600",
                ].join(" ")}
                style={{ width: `${percentReady}%` }}
              />
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {checklistLoading || !checklist ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Chargement de la checklist...
              </div>
            ) : (
              PREPARATION_FIELDS.map((field) => (
                <label
                  key={field.key}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(checklist[field.key])}
                    disabled={checklistSaving || !checklistSchemaReady}
                    onChange={(event) => void toggleChecklistField(field.key, event.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  <span className="font-medium">{field.label}</span>
                </label>
              ))
            )}
          </div>

          <div className="mt-5 space-y-3">
            <label className="block text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
              Commentaire preparation
            </label>
            <textarea
              value={checklistComment}
              onChange={(event) => setChecklistComment(event.target.value)}
              disabled={checklistSaving || !checklistSchemaReady}
              className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:bg-white"
              placeholder="Noter les points bloquants, validations ou manques a traiter."
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void saveChecklistComment()}
                disabled={checklistSaving || !checklistSchemaReady}
                className={[
                  "rounded-2xl px-4 py-2 text-sm font-medium",
                  checklistSaving || !checklistSchemaReady
                    ? "bg-slate-200 text-slate-500"
                    : "bg-slate-900 text-white hover:bg-slate-800",
                ].join(" ")}
              >
                {checklistSaving ? "Enregistrement..." : "Enregistrer le commentaire"}
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Taches</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{tasksCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Intervenants</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{intervenantsCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Documents</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{documentsCount}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Demandes materiel</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{materielCount}</div>
            </div>
          </div>
        </section>
        ) : null}
        {view !== "preparation" ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Localisation</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Arborescence chantier</h2>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                La structure du chantier devient le socle pour rattacher ensuite les taches, photos, reserves,
                documents et remarques.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateRoot}
              disabled={zonesSaving || !zonesSchemaReady}
              className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60"
            >
              + Ajouter un batiment
            </button>
          </div>

          {!zonesSchemaReady ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Migration localisations non appliquee sur Supabase.
            </div>
          ) : null}

          {zonesError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {zonesError}
            </div>
          ) : null}

          <div className="mt-5 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
            <div className="text-sm font-semibold text-slate-900">Structure visible du chantier</div>

            {zoneEditorState?.mode === "create" && zoneEditorState.parentId === null ? (
              <div className="mt-4">{renderInlineEditor()}</div>
            ) : null}

            <div className="mt-4 space-y-2">
              {zonesLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                  Chargement de l'arborescence...
                </div>
              ) : zoneTree.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                  Aucune localisation encore creee. Ajoute d'abord un batiment, puis ses niveaux et ses pieces.
                </div>
              ) : (
                zoneTree.map((node) => (
                  <ZoneTreeBranch
                    key={node.id}
                    node={node}
                    expandedZoneIds={expandedZoneIds}
                    selectedZoneId={zoneDetailOpenId}
                    editorState={zoneEditorState}
                    zonesSaving={zonesSaving}
                    onToggle={toggleZoneExpanded}
                    onOpenDetail={setZoneDetailOpenId}
                    onCreateChild={openCreateZone}
                    onEdit={openEditZone}
                    onDelete={removeZone}
                    renderInlineEditor={renderInlineEditor}
                  />
                ))
              )}
            </div>
          </div>
        </section>
        ) : null}
      </div>

      {detailZone && detailSummary ? (
        <div className="fixed inset-0 z-40 bg-slate-900/40" onClick={() => setZoneDetailOpenId(null)}>
          <aside
            className="absolute inset-y-0 right-0 w-full max-w-3xl overflow-y-auto border-l border-slate-200 bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="space-y-5">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Localisation</div>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-950">{detailZone.nom}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                    <span className={["rounded-full border px-2 py-1 font-semibold", localisationKindBadgeClass(detailSummary.kind)].join(" ")}>
                      {localisationKindLabel(detailSummary.kind)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{detailSummary.path}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setZoneDetailOpenId(null)}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                >
                  Fermer
                </button>
              </header>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Pieces</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{detailSummary.pieceCount}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Taches liees</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{detailSummary.tasks.length}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Photos</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{detailSummary.photos.length}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Documents</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{detailSummary.documents.length}</div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Taches liees</div>
                  <div className="mt-4 space-y-2">
                    {detailSummary.tasks.length === 0 ? (
                      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">Aucune tache liee.</div>
                    ) : (
                      detailSummary.tasks.map((task) => (
                        <div key={task.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-800">
                          <div className="font-medium text-slate-950">{resolveTaskLabel(task)}</div>
                          <div className="mt-1 text-xs text-slate-500">{task.lot || "Sans lot"}</div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Reserves liees</div>
                  <div className="mt-4 space-y-2">
                    {detailSummary.reserves.length === 0 ? (
                      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">Aucune reserve liee.</div>
                    ) : (
                      detailSummary.reserves.map((reserve) => (
                        <div key={reserve.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-800">
                          <div className="font-medium text-slate-950">{reserve.title || "Reserve"}</div>
                          <div className="mt-1 text-xs text-slate-500">{reserve.status || "Sans statut"}</div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Photos liees</div>
                  <div className="mt-4 space-y-2">
                    {detailSummary.photos.length === 0 ? (
                      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">Aucune photo liee.</div>
                    ) : (
                      detailSummary.photos.map((photo) => (
                        <div key={photo.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-800">
                          <div className="font-medium text-slate-950">{photo.titre || "Photo chantier"}</div>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Documents et remarques</div>
                  <div className="mt-4 space-y-2">
                    {detailSummary.documents.length === 0 && detailSummary.consignes.length === 0 ? (
                      <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-500">Aucun document ni remarque lies.</div>
                    ) : (
                      <>
                        {detailSummary.documents.map((document) => (
                          <div key={document.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-800">
                            <div className="font-medium text-slate-950">{document.title || "Document chantier"}</div>
                          </div>
                        ))}
                        {detailSummary.consignes.map((consigne) => (
                          <div key={consigne.id} className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-800">
                            <div className="font-medium text-slate-950">{consigne.title || "Remarque chantier"}</div>
                            <div className="mt-1 text-xs text-slate-500">{consigne.description || "Sans detail"}</div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
