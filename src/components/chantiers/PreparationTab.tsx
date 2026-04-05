import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  getChantierPreparationChecklist,
  upsertChantierPreparationChecklist,
  type ChantierPreparationChecklistRow,
} from "../../services/chantierPreparation.service";
import {
  buildChantierZonePathMap,
  buildChantierZoneTree,
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
  type ChantierZoneLocation,
  type ChantierZoneRow,
  type ChantierZoneTreeNode,
  type ChantierZoneUsageSummary,
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
];

const ZONE_LOCATION_OPTIONS: Array<{ value: ChantierZoneLocation; label: string }> = [
  { value: "interieur", label: "Interieur" },
  { value: "exterieur", label: "Exterieur" },
  { value: "mixte", label: "Mixte" },
];

type PreparationTabProps = {
  chantierId: string;
  tasksCount: number;
  documentsCount: number;
  intervenantsCount: number;
  materielCount: number;
};

type ZoneEditorMode = "create" | "edit" | null;

function preparationProgress(checklist: ChantierPreparationChecklistRow) {
  const doneCount = PREPARATION_FIELDS.filter((field) => Boolean(checklist[field.key])).length;
  return Math.round((doneCount / PREPARATION_FIELDS.length) * 100);
}

function localisationKindLabel(kind: ChantierLocalisationKind) {
  return LOCALISATION_KIND_OPTIONS.find((entry) => entry.value === kind)?.label ?? "Localisation";
}

function emplacementLabel(value: ChantierZoneLocation) {
  return ZONE_LOCATION_OPTIONS.find((entry) => entry.value === value)?.label ?? "Interieur";
}

function localisationKindBadgeClass(kind: ChantierLocalisationKind) {
  if (kind === "batiment") return "border-blue-200 bg-blue-50 text-blue-700";
  if (kind === "niveau") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function suggestChildKind(parent: ChantierZoneRow | null): ChantierLocalisationKind {
  if (!parent) return "batiment";
  const parentKind = zoneTypeToLocalisationKind(parent.zone_type);
  if (parentKind === "batiment") return "niveau";
  return "piece";
}

function countDescendants(zones: ChantierZoneRow[], zoneId: string) {
  const childrenByParent = new Map<string, ChantierZoneRow[]>();
  for (const zone of zones) {
    const key = zone.parent_zone_id ?? "__root__";
    const rows = childrenByParent.get(key) ?? [];
    rows.push(zone);
    childrenByParent.set(key, rows);
  }

  let count = 0;
  const stack = [...(childrenByParent.get(zoneId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    count += 1;
    stack.push(...(childrenByParent.get(current.id) ?? []));
  }
  return count;
}

function ZoneTreeBranch({
  node,
  selectedZoneId,
  expandedZoneIds,
  onToggle,
  onSelect,
}: {
  node: ChantierZoneTreeNode;
  selectedZoneId: string | null;
  expandedZoneIds: Record<string, boolean>;
  onToggle: (zoneId: string) => void;
  onSelect: (zoneId: string) => void;
}) {
  const expanded = expandedZoneIds[node.id] ?? true;
  const selected = selectedZoneId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <div className="space-y-2">
      <div
        className={[
          "flex items-center gap-2 rounded-2xl border px-3 py-3 transition",
          selected
            ? "border-blue-300 bg-blue-50 shadow-sm"
            : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
        ].join(" ")}
        style={{ marginLeft: `${node.depth * 18}px` }}
      >
        <button
          type="button"
          onClick={() => (hasChildren ? onToggle(node.id) : onSelect(node.id))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs text-slate-600 hover:bg-white"
          aria-label={hasChildren ? (expanded ? "Replier" : "Deplier") : "Selectionner"}
        >
          {hasChildren ? (expanded ? "-" : "+") : "•"}
        </button>
        <button type="button" onClick={() => onSelect(node.id)} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold text-slate-950">{node.nom}</span>
            <span className={[
              "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
              localisationKindBadgeClass(node.kind),
            ].join(" ")}>
              {localisationKindLabel(node.kind)}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{node.path}</div>
        </button>
      </div>

      {hasChildren && expanded ? (
        <div className="space-y-2">
          {node.children.map((child) => (
            <ZoneTreeBranch
              key={child.id}
              node={child}
              selectedZoneId={selectedZoneId}
              expandedZoneIds={expandedZoneIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function PreparationTab({
  chantierId,
  tasksCount,
  documentsCount,
  intervenantsCount,
  materielCount,
}: PreparationTabProps) {
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
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [expandedZoneIds, setExpandedZoneIds] = useState<Record<string, boolean>>({});
  const [zoneEditorMode, setZoneEditorMode] = useState<ZoneEditorMode>(null);
  const [zoneEditorParentId, setZoneEditorParentId] = useState<string | null>(null);
  const [zoneDraftName, setZoneDraftName] = useState("");
  const [zoneDraftKind, setZoneDraftKind] = useState<ChantierLocalisationKind>("batiment");
  const [zoneDraftLocation, setZoneDraftLocation] = useState<ChantierZoneLocation>("interieur");
  const [zoneDraftMoveParentId, setZoneDraftMoveParentId] = useState("");
  const [zoneUsageSummary, setZoneUsageSummary] = useState<ChantierZoneUsageSummary | null>(null);
  const [zoneUsageLoading, setZoneUsageLoading] = useState(false);
  const percentReady = useMemo(() => (checklist ? preparationProgress(checklist) : 0), [checklist]);
  const zoneTree = useMemo(() => buildChantierZoneTree(zones), [zones]);
  const zoneById = useMemo(() => new Map(zones.map((zone) => [zone.id, zone])), [zones]);
  const zonePathById = useMemo(() => buildChantierZonePathMap(zones), [zones]);
  const selectedZone = selectedZoneId ? zoneById.get(selectedZoneId) ?? null : null;
  const selectedZonePath = selectedZoneId
    ? resolveChantierZonePath(selectedZoneId, zonePathById)
    : "Racine du chantier";
  const availableParentZones = useMemo(
    () => listValidZoneParents(zones, zoneEditorMode === "edit" ? selectedZoneId : null),
    [zones, zoneEditorMode, selectedZoneId],
  );
  const selectedZoneChildrenCount = useMemo(
    () => (selectedZone ? countDescendants(zones, selectedZone.id) : 0),
    [selectedZone, zones],
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
    setExpandedZoneIds((current) => {
      const next: Record<string, boolean> = {};
      for (const zone of zones) {
        next[zone.id] = current[zone.id] ?? true;
      }
      return next;
    });

    if (zones.length === 0) {
      setSelectedZoneId(null);
      return;
    }

    if (!selectedZoneId || !zoneById.has(selectedZoneId)) {
      setSelectedZoneId(zones[0].id);
    }
  }, [zones, selectedZoneId, zoneById]);

  useEffect(() => {
    if (!selectedZoneId) {
      setZoneUsageSummary(null);
      return;
    }

    let cancelled = false;
    setZoneUsageLoading(true);
    getChantierZoneUsageSummary(selectedZoneId)
      .then((result) => {
        if (!cancelled) setZoneUsageSummary(result);
      })
      .catch((error: any) => {
        if (!cancelled) setZonesError(error?.message ?? "Erreur lecture usages localisation.");
      })
      .finally(() => {
        if (!cancelled) setZoneUsageLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedZoneId]);

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
    setZoneEditorMode(null);
    setZoneEditorParentId(null);
    setZoneDraftName("");
    setZoneDraftKind("batiment");
    setZoneDraftLocation("interieur");
    setZoneDraftMoveParentId("");
  }

  function openCreateZone(parentZone: ChantierZoneRow | null) {
    setZoneEditorMode("create");
    setZoneEditorParentId(parentZone?.id ?? null);
    setZoneDraftKind(suggestChildKind(parentZone));
    setZoneDraftName("");
    setZoneDraftLocation(parentZone?.emplacement ?? "interieur");
    setZoneDraftMoveParentId(parentZone?.id ?? "");
  }

  function openEditZone(zone: ChantierZoneRow) {
    setZoneEditorMode("edit");
    setZoneEditorParentId(zone.parent_zone_id ?? null);
    setZoneDraftName(zone.nom);
    setZoneDraftKind(zoneTypeToLocalisationKind(zone.zone_type));
    setZoneDraftLocation(zone.emplacement);
    setZoneDraftMoveParentId(zone.parent_zone_id ?? "");
  }

  async function submitZoneEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedName = zoneDraftName.trim();
    if (!trimmedName) {
      setZonesError("Nom de localisation obligatoire.");
      return;
    }

    setZonesSaving(true);
    setZonesError(null);
    try {
      if (zoneEditorMode === "create") {
        const siblingCount = zones.filter(
          (zone) => (zone.parent_zone_id ?? null) === (zoneEditorParentId ?? null),
        ).length;
        const saved = await createChantierZone({
          chantier_id: chantierId,
          parent_zone_id: zoneEditorParentId,
          nom: trimmedName,
          zone_type: localisationKindToZoneType(zoneDraftKind),
          niveau: zoneDraftKind === "niveau" ? trimmedName : null,
          emplacement: zoneDraftLocation,
          ordre: siblingCount,
        });
        setZones((current) => [...current, saved]);
        setSelectedZoneId(saved.id);
        setExpandedZoneIds((current) => ({
          ...current,
          [saved.id]: true,
          ...(zoneEditorParentId ? { [zoneEditorParentId]: true } : {}),
        }));
      } else if (zoneEditorMode === "edit" && selectedZone) {
        const saved = await updateChantierZone(selectedZone.id, {
          parent_zone_id: zoneDraftMoveParentId || null,
          nom: trimmedName,
          zone_type: localisationKindToZoneType(zoneDraftKind),
          niveau: zoneDraftKind === "niveau" ? trimmedName : null,
          emplacement: zoneDraftLocation,
        });
        setZones((current) => current.map((zone) => (zone.id === saved.id ? saved : zone)));
        setSelectedZoneId(saved.id);
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
    const usage =
      zone.id === selectedZoneId && zoneUsageSummary ? zoneUsageSummary : await getChantierZoneUsageSummary(zone.id);
    const descendants = countDescendants(zones, zone.id);
    const warnings: string[] = [];

    if (descendants > 0) {
      warnings.push(`${descendants} sous-localisation(s) seront detachees.`);
    }
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
      `Supprimer la localisation "${zone.nom}" ?`,
      warnings.length > 0 ? "" : null,
      ...warnings,
      warnings.length > 0 ? "" : null,
      warnings.length > 0 ? "Les rattachements seront detaches automatiquement." : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (!window.confirm(message)) return;

    setZonesSaving(true);
    try {
      await deleteChantierZone(zone.id);
      setZones((current) =>
        current
          .filter((entry) => entry.id !== zone.id)
          .map((entry) => (entry.parent_zone_id === zone.id ? { ...entry, parent_zone_id: null } : entry)),
      );
      setSelectedZoneId((current) => (current === zone.id ? null : current));
      resetZoneEditor();
    } catch (error: any) {
      setZonesError(error?.message ?? "Erreur suppression localisation.");
    } finally {
      setZonesSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(380px,0.95fr)_minmax(460px,1.05fr)]">
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

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Localisation</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Arborescence chantier</h2>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Construis le plan logique du chantier par batiment, niveau et piece pour rattacher ensuite taches,
                photos, reserves, documents, remarques et analyses.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => openCreateZone(null)}
                disabled={zonesSaving || !zonesSchemaReady}
                className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                + Ajouter un element racine
              </button>
              <button
                type="button"
                onClick={() => void refreshZones()}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                {zonesLoading ? "Chargement..." : "Rafraichir"}
              </button>
            </div>
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

          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Structure visible du chantier</div>
                  <div className="text-xs text-slate-500">Clique un element pour agir dessus ou ajouter un enfant.</div>
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
                  {zones.length} element{zones.length > 1 ? "s" : ""}
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {zonesLoading ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                    Chargement de l'arborescence...
                  </div>
                ) : zoneTree.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    Aucune localisation encore creee. Commence par un batiment ou un niveau racine.
                  </div>
                ) : (
                  zoneTree.map((node) => (
                    <ZoneTreeBranch
                      key={node.id}
                      node={node}
                      selectedZoneId={selectedZoneId}
                      expandedZoneIds={expandedZoneIds}
                      onToggle={toggleZoneExpanded}
                      onSelect={setSelectedZoneId}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <section className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="text-sm font-semibold text-slate-900">
                  {selectedZone ? "Actions contextuelles" : "Point d'entree chantier"}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {selectedZone
                    ? "Le parent est implicite : ajoute un enfant directement depuis l'element selectionne."
                    : "Selectionne une localisation ou cree un premier element racine."}
                </div>

                {selectedZone ? (
                  <div className="mt-4 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-base font-semibold text-slate-950">{selectedZone.nom}</div>
                        <span className={[
                          "rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          localisationKindBadgeClass(zoneTypeToLocalisationKind(selectedZone.zone_type)),
                        ].join(" ")}>
                          {localisationKindLabel(zoneTypeToLocalisationKind(selectedZone.zone_type))}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                          {emplacementLabel(selectedZone.emplacement)}
                        </span>
                      </div>
                      <div className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">Chemin complet</div>
                      <div className="mt-1 text-sm font-medium text-slate-900">{selectedZonePath}</div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Sous-elements</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">{selectedZoneChildrenCount}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Usages lies</div>
                        <div className="mt-2 text-2xl font-semibold text-slate-950">
                          {zoneUsageLoading ? "..." : zoneUsageSummary?.totalLinks ?? 0}
                        </div>
                      </div>
                    </div>
                    {zoneUsageSummary ? (
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>Taches : {zoneUsageSummary.links.tasks}</div>
                          <div>Photos : {zoneUsageSummary.links.photos}</div>
                          <div>Reserves : {zoneUsageSummary.links.reserves}</div>
                          <div>Documents : {zoneUsageSummary.links.documents}</div>
                          <div>Consignes : {zoneUsageSummary.links.consignes}</div>
                          <div>Achats : {zoneUsageSummary.links.achats}</div>
                          <div>Ecarts : {zoneUsageSummary.links.ecarts}</div>
                          <div>Retours : {zoneUsageSummary.links.retours}</div>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openCreateZone(selectedZone)}
                        disabled={zonesSaving || !zonesSchemaReady}
                        className="rounded-2xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Ajouter un enfant
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditZone(selectedZone)}
                        disabled={zonesSaving || !zonesSchemaReady}
                        className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeZone(selectedZone)}
                        disabled={zonesSaving || !zonesSchemaReady}
                        className="rounded-2xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">
                    L'arborescence sera visible ici des que tu creeras le premier batiment, niveau ou piece.
                  </div>
                )}
              </section>

              {(zoneEditorMode || zones.length === 0) && zonesSchemaReady ? (
                <form
                  onSubmit={(event) => void submitZoneEditor(event)}
                  className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">
                        {zoneEditorMode === "edit" ? "Modifier la localisation" : "Ajouter une localisation"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {zoneEditorMode === "edit"
                          ? "Renomme, deplace ou ajuste cet element sans perdre la structure."
                          : zoneEditorParentId
                          ? `Parent pre-rempli : ${resolveChantierZonePath(zoneEditorParentId, zonePathById)}`
                          : "Creation a la racine du chantier."}
                      </div>
                    </div>
                    {zoneEditorMode ? (
                      <button
                        type="button"
                        onClick={resetZoneEditor}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Fermer
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-4 grid gap-3">
                    <label className="space-y-1 text-xs text-slate-600">
                      <div>Type</div>
                      <select
                        value={zoneDraftKind}
                        onChange={(event) => setZoneDraftKind(event.target.value as ChantierLocalisationKind)}
                        disabled={zonesSaving}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
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
                        value={zoneDraftName}
                        onChange={(event) => setZoneDraftName(event.target.value)}
                        disabled={zonesSaving}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                        placeholder={
                          zoneDraftKind === "batiment"
                            ? "Ex : Maison"
                            : zoneDraftKind === "niveau"
                            ? "Ex : RDC"
                            : "Ex : Cuisine"
                        }
                      />
                    </label>

                    <label className="space-y-1 text-xs text-slate-600">
                      <div>Interieur / exterieur</div>
                      <select
                        value={zoneDraftLocation}
                        onChange={(event) => setZoneDraftLocation(event.target.value as ChantierZoneLocation)}
                        disabled={zonesSaving}
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
                      >
                        {ZONE_LOCATION_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {zoneEditorMode === "edit" ? (
                      <label className="space-y-1 text-xs text-slate-600">
                        <div>Deplacer sous</div>
                        <select
                          value={zoneDraftMoveParentId}
                          onChange={(event) => setZoneDraftMoveParentId(event.target.value)}
                          disabled={zonesSaving}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900"
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
                  </div>

                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    {zoneEditorMode ? (
                      <button
                        type="button"
                        onClick={resetZoneEditor}
                        disabled={zonesSaving}
                        className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Annuler
                      </button>
                    ) : null}
                    <button
                      type="submit"
                      disabled={zonesSaving}
                      className={[
                        "rounded-2xl px-4 py-2 text-sm font-medium",
                        zonesSaving ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white hover:bg-slate-800",
                      ].join(" ")}
                    >
                      {zonesSaving
                        ? "Enregistrement..."
                        : zoneEditorMode === "edit"
                        ? "Enregistrer les changements"
                        : "Ajouter a l'arborescence"}
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
