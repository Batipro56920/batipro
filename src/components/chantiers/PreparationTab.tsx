import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";

import {
  getChantierPreparationChecklist,
  upsertChantierPreparationChecklist,
  type ChantierPreparationChecklistRow,
} from "../../services/chantierPreparation.service";
import {
  createChantierZone,
  deleteChantierZone,
  listChantierZones,
  type ChantierZoneLocation,
  type ChantierZoneRow,
  type ChantierZoneType,
} from "../../services/chantierZones.service";

const PREPARATION_FIELDS = [
  { key: "plans_disponibles", label: "Plans disponibles" },
  { key: "materiaux_commandes", label: "Matériaux commandés" },
  { key: "materiel_prevu", label: "Matériel prévu" },
  { key: "intervenants_affectes", label: "Intervenants affectés" },
  { key: "acces_chantier_valide", label: "Accès chantier validé" },
] as const;

const ZONE_TYPE_OPTIONS: Array<{ value: ChantierZoneType; label: string }> = [
  { value: "piece", label: "Pièce" },
  { value: "zone", label: "Zone" },
  { value: "niveau", label: "Niveau" },
  { value: "etage", label: "Étage" },
  { value: "exterieur", label: "Extérieur" },
];

const ZONE_LOCATION_OPTIONS: Array<{ value: ChantierZoneLocation; label: string }> = [
  { value: "interieur", label: "Intérieur" },
  { value: "exterieur", label: "Extérieur" },
  { value: "mixte", label: "Mixte" },
];

type PreparationTabProps = {
  chantierId: string;
  tasksCount: number;
  documentsCount: number;
  intervenantsCount: number;
  materielCount: number;
};

function formatZoneType(type: string) {
  if (type === "piece") return "Pièce";
  if (type === "niveau") return "Niveau";
  if (type === "etage") return "Étage";
  if (type === "exterieur") return "Extérieur";
  return "Zone";
}

function formatLocation(value: string) {
  if (value === "interieur") return "Intérieur";
  if (value === "exterieur") return "Extérieur";
  return "Mixte";
}

function preparationProgress(checklist: ChantierPreparationChecklistRow) {
  const doneCount = PREPARATION_FIELDS.filter((field) => Boolean(checklist[field.key])).length;
  return Math.round((doneCount / PREPARATION_FIELDS.length) * 100);
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
  const [zoneName, setZoneName] = useState("");
  const [zoneType, setZoneType] = useState<ChantierZoneType>("piece");
  const [zoneLevel, setZoneLevel] = useState("");
  const [zoneLocation, setZoneLocation] = useState<ChantierZoneLocation>("interieur");
  const [zoneParentId, setZoneParentId] = useState("");

  const percentReady = useMemo(() => (checklist ? preparationProgress(checklist) : 0), [checklist]);
  const parentZoneOptions = useMemo(() => zones.filter((zone) => zone.zone_type !== "piece"), [zones]);

  async function refreshPreparation() {
    setChecklistLoading(true);
    setChecklistError(null);
    try {
      const result = await getChantierPreparationChecklist(chantierId);
      setChecklist(result.checklist);
      setChecklistComment(result.checklist.commentaire ?? "");
      setChecklistSchemaReady(result.schemaReady);
    } catch (error: any) {
      setChecklistError(error?.message ?? "Erreur chargement préparation.");
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
      setZonesError(error?.message ?? "Erreur chargement zones.");
    } finally {
      setZonesLoading(false);
    }
  }

  useEffect(() => {
    void refreshPreparation();
    void refreshZones();
  }, [chantierId]);

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
      setChecklistError(error?.message ?? "Erreur mise à jour checklist.");
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

  async function addZone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setZonesSaving(true);
    setZonesError(null);
    try {
      const saved = await createChantierZone({
        chantier_id: chantierId,
        parent_zone_id: zoneParentId || null,
        nom: zoneName,
        zone_type: zoneType,
        niveau: zoneLevel || null,
        emplacement: zoneLocation,
        ordre: zones.length,
      });
      setZones((current) => [...current, saved]);
      setZoneName("");
      setZoneLevel("");
      setZoneType("piece");
      setZoneLocation("interieur");
      setZoneParentId("");
    } catch (error: any) {
      setZonesError(error?.message ?? "Erreur création zone.");
    } finally {
      setZonesSaving(false);
    }
  }

  async function removeZone(zone: ChantierZoneRow) {
    const ok = confirm(`Supprimer la zone "${zone.nom}" ?`);
    if (!ok) return;

    const before = zones;
    setZones((current) => current.filter((entry) => entry.id !== zone.id));
    try {
      await deleteChantierZone(zone.id);
    } catch (error: any) {
      setZones(before);
      setZonesError(error?.message ?? "Erreur suppression zone.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(380px,0.95fr)_minmax(420px,1.05fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Préparer</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Checklist avant démarrage</h2>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Valide les prérequis essentiels pour passer le chantier en mode exécution sans démarrer avec des manques.
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
              {checklist?.statut === "chantier_pret" ? "Chantier prêt" : "Chantier incomplet"}
            </div>
          </div>

          {!checklistSchemaReady ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Migration `20260402100000_batipro_v2_foundation_prepare_control_pilot.sql` non appliquée : la checklist
              est visible mais pas encore sauvegardable.
            </div>
          ) : null}

          {checklistError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {checklistError}
            </div>
          ) : null}

          <div className="mt-5 rounded-3xl bg-slate-50 p-4">
            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
              <span>Progression de préparation</span>
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
              Commentaire préparation
            </label>
            <textarea
              value={checklistComment}
              onChange={(event) => setChecklistComment(event.target.value)}
              disabled={checklistSaving || !checklistSchemaReady}
              className="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400 focus:bg-white"
              placeholder="Noter ce qu’il manque, les points bloquants, ou les validations à faire."
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
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Tâches</div>
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
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Demandes matériel</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{materielCount}</div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Localisation</div>
              <h2 className="mt-1 text-xl font-semibold text-slate-950">Zones, pièces et niveaux</h2>
              <p className="mt-2 max-w-xl text-sm text-slate-500">
                Structure le chantier par salle, étage ou zone pour rattacher ensuite tâches, photos, réserves,
                documents et consignes.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshZones()}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              {zonesLoading ? "Chargement..." : "Rafraîchir"}
            </button>
          </div>

          {!zonesSchemaReady ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Migration zones non appliquée sur Supabase. Applique le socle Batipro v2 pour activer la création.
            </div>
          ) : null}

          {zonesError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {zonesError}
            </div>
          ) : null}

          <form onSubmit={(event) => void addZone(event)} className="mt-5 rounded-3xl bg-slate-50 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-600">
                <div>Nom de la zone</div>
                <input
                  value={zoneName}
                  onChange={(event) => setZoneName(event.target.value)}
                  disabled={zonesSaving || !zonesSchemaReady}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  placeholder="Ex : Salle de bain"
                />
              </label>

              <label className="space-y-1 text-xs text-slate-600">
                <div>Type</div>
                <select
                  value={zoneType}
                  onChange={(event) => setZoneType(event.target.value as ChantierZoneType)}
                  disabled={zonesSaving || !zonesSchemaReady}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                >
                  {ZONE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-1 text-xs text-slate-600">
                <div>Niveau / étage</div>
                <input
                  value={zoneLevel}
                  onChange={(event) => setZoneLevel(event.target.value)}
                  disabled={zonesSaving || !zonesSchemaReady}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                  placeholder="Ex : RDC, R+1"
                />
              </label>

              <label className="space-y-1 text-xs text-slate-600">
                <div>Intérieur / extérieur</div>
                <select
                  value={zoneLocation}
                  onChange={(event) => setZoneLocation(event.target.value as ChantierZoneLocation)}
                  disabled={zonesSaving || !zonesSchemaReady}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                >
                  {ZONE_LOCATION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="space-y-1 text-xs text-slate-600">
                <div>Zone parente (optionnel)</div>
                <select
                  value={zoneParentId}
                  onChange={(event) => setZoneParentId(event.target.value)}
                  disabled={zonesSaving || !zonesSchemaReady}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900"
                >
                  <option value="">Aucune</option>
                  {parentZoneOptions.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.nom}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={zonesSaving || !zonesSchemaReady}
                  className={[
                    "w-full rounded-2xl px-5 py-3 text-sm font-medium md:w-auto",
                    zonesSaving || !zonesSchemaReady
                      ? "bg-slate-200 text-slate-500"
                      : "bg-blue-600 text-white hover:bg-blue-700",
                  ].join(" ")}
                >
                  {zonesSaving ? "Création..." : "+ Ajouter zone"}
                </button>
              </div>
            </div>
          </form>

          <div className="mt-5 space-y-3">
            {zonesLoading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Chargement des zones...
              </div>
            ) : zones.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Aucune zone créée. Commence par ajouter les pièces et niveaux du chantier.
              </div>
            ) : (
              zones.map((zone) => {
                const parentName = zone.parent_zone_id
                  ? zones.find((entry) => entry.id === zone.parent_zone_id)?.nom ?? null
                  : null;

                return (
                  <div
                    key={zone.id}
                    className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-4 shadow-sm md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate text-sm font-semibold text-slate-950">{zone.nom}</div>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                          {formatZoneType(zone.zone_type)}
                        </span>
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                          {formatLocation(zone.emplacement)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {zone.niveau ? `${zone.niveau}` : "Niveau non renseigné"}
                        {parentName ? ` · Parent : ${parentName}` : ""}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void removeZone(zone)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 hover:bg-red-50 hover:text-red-700"
                    >
                      Supprimer
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
