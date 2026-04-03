import { supabase } from "../lib/supabaseClient";
import { createChantier, getChantierById, type ChantierRow } from "./chantiers.service";
import {
  getChantierPreparationChecklist,
  upsertChantierPreparationChecklist,
  type ChantierPreparationChecklistRow,
} from "./chantierPreparation.service";
import { getTasksByChantierId, createTask, type ChantierTaskRow } from "./chantierTasks.service";
import { createTaskStep, listTaskStepsByChantierId, type ChantierTaskStepRow } from "./chantierTaskSteps.service";
import { createChantierZone, listChantierZones, type ChantierZoneRow } from "./chantierZones.service";

export type ChantierTemplateRow = {
  id: string;
  nom: string;
  description: string | null;
  source_chantier_id: string | null;
  snapshot: ChantierTemplateSnapshot;
  created_at: string;
  updated_at: string;
};

export type ChantierTemplateSnapshot = {
  version: 1;
  source_chantier_nom: string | null;
  preparation: Pick<
    ChantierPreparationChecklistRow,
    | "plans_disponibles"
    | "materiaux_commandes"
    | "materiel_prevu"
    | "intervenants_affectes"
    | "acces_chantier_valide"
    | "commentaire"
  >;
  zones: Array<{
    ref: string;
    parent_ref: string | null;
    nom: string;
    zone_type: ChantierZoneRow["zone_type"];
    niveau: string | null;
    emplacement: ChantierZoneRow["emplacement"];
    ordre: number;
  }>;
  tasks: Array<{
    ref: string;
    zone_ref: string | null;
    titre: string;
    corps_etat: string | null;
    lot: string | null;
    etape_metier: string | null;
    date: string | null;
    status: ChantierTaskRow["status"];
    quality_status: ChantierTaskRow["quality_status"];
    admin_validation_status: ChantierTaskRow["admin_validation_status"];
    quantite: number | null;
    unite: string | null;
    temps_prevu_h: number | null;
    date_debut: string | null;
    date_fin: string | null;
    duration_days: number;
    order_index: number;
  }>;
  task_steps: Array<{
    task_ref: string;
    titre: string;
    statut: ChantierTaskStepRow["statut"];
    ordre: number;
  }>;
};

export type ChantierTemplateCreateInput = {
  nom: string;
  description?: string | null;
};

export type CreateChantierFromTemplateInput = {
  nom: string;
  client?: string | null;
  adresse?: string | null;
  status?: ChantierRow["status"];
  date_debut?: string | null;
  date_fin_prevue?: string | null;
};

const TEMPLATE_SELECT = [
  "id",
  "nom",
  "description",
  "source_chantier_id",
  "snapshot",
  "created_at",
  "updated_at",
].join(",");

function fromChantierTemplates() {
  return (supabase as any).from("chantier_templates");
}

function isMissingTemplateTableError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  return (
    msg.includes("chantier_templates") &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"))
  );
}

function normalizeTemplateSnapshot(snapshot: any): ChantierTemplateSnapshot {
  return {
    version: 1,
    source_chantier_nom: snapshot?.source_chantier_nom ?? null,
    preparation: {
      plans_disponibles: Boolean(snapshot?.preparation?.plans_disponibles),
      materiaux_commandes: Boolean(snapshot?.preparation?.materiaux_commandes),
      materiel_prevu: Boolean(snapshot?.preparation?.materiel_prevu),
      intervenants_affectes: Boolean(snapshot?.preparation?.intervenants_affectes),
      acces_chantier_valide: Boolean(snapshot?.preparation?.acces_chantier_valide),
      commentaire: snapshot?.preparation?.commentaire ?? null,
    },
    zones: Array.isArray(snapshot?.zones)
      ? snapshot.zones.map((zone: any, index: number) => ({
          ref: String(zone?.ref ?? `zone-${index + 1}`),
          parent_ref: zone?.parent_ref ? String(zone.parent_ref) : null,
          nom: String(zone?.nom ?? "Zone").trim() || "Zone",
          zone_type: (zone?.zone_type ?? "piece") as ChantierZoneRow["zone_type"],
          niveau: zone?.niveau ?? null,
          emplacement: (zone?.emplacement ?? "interieur") as ChantierZoneRow["emplacement"],
          ordre: Number.isFinite(Number(zone?.ordre)) ? Number(zone.ordre) : index,
        }))
      : [],
    tasks: Array.isArray(snapshot?.tasks)
      ? snapshot.tasks.map((task: any, index: number) => ({
          ref: String(task?.ref ?? `task-${index + 1}`),
          zone_ref: task?.zone_ref ? String(task.zone_ref) : null,
          titre: String(task?.titre ?? "Tâche").trim() || "Tâche",
          corps_etat: task?.corps_etat ?? null,
          lot: task?.lot ?? task?.corps_etat ?? null,
          etape_metier: task?.etape_metier ?? null,
          date: task?.date ?? null,
          status: (task?.status ?? "A_FAIRE") as ChantierTaskRow["status"],
          quality_status: (task?.quality_status ?? "a_faire") as ChantierTaskRow["quality_status"],
          admin_validation_status: (task?.admin_validation_status ?? "non_verifie") as ChantierTaskRow["admin_validation_status"],
          quantite: Number.isFinite(Number(task?.quantite)) ? Number(task.quantite) : null,
          unite: task?.unite ?? null,
          temps_prevu_h: Number.isFinite(Number(task?.temps_prevu_h)) ? Number(task.temps_prevu_h) : null,
          date_debut: task?.date_debut ?? null,
          date_fin: task?.date_fin ?? null,
          duration_days: Math.max(1, Math.trunc(Number(task?.duration_days ?? 1) || 1)),
          order_index: Math.max(0, Math.trunc(Number(task?.order_index ?? index) || 0)),
        }))
      : [],
    task_steps: Array.isArray(snapshot?.task_steps)
      ? snapshot.task_steps.map((step: any) => ({
          task_ref: String(step?.task_ref ?? ""),
          titre: String(step?.titre ?? "Étape").trim() || "Étape",
          statut: (step?.statut === "en_cours" || step?.statut === "termine" ? step.statut : "a_faire") as ChantierTaskStepRow["statut"],
          ordre: Math.max(0, Math.trunc(Number(step?.ordre ?? 0) || 0)),
        }))
      : [],
  };
}

function normalizeTemplateRow(row: any): ChantierTemplateRow {
  return {
    id: String(row?.id ?? ""),
    nom: String(row?.nom ?? "").trim() || "Modèle chantier",
    description: row?.description ?? null,
    source_chantier_id: row?.source_chantier_id ?? null,
    snapshot: normalizeTemplateSnapshot(row?.snapshot),
    created_at: row?.created_at ?? new Date().toISOString(),
    updated_at: row?.updated_at ?? row?.created_at ?? new Date().toISOString(),
  };
}

export async function listChantierTemplates(): Promise<{ templates: ChantierTemplateRow[]; schemaReady: boolean }> {
  const { data, error } = await fromChantierTemplates()
    .select(TEMPLATE_SELECT)
    .order("updated_at", { ascending: false })
    .order("nom", { ascending: true });

  if (!error) return { templates: (data ?? []).map(normalizeTemplateRow), schemaReady: true };
  if (isMissingTemplateTableError(error)) return { templates: [], schemaReady: false };
  throw error;
}

export async function createChantierTemplateFromChantier(
  chantierId: string,
  input: ChantierTemplateCreateInput,
): Promise<ChantierTemplateRow> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const nom = String(input.nom ?? "").trim();
  if (!nom) throw new Error("Nom de modèle obligatoire.");

  const [chantier, zonesResult, tasks, stepsResult, preparationResult] = await Promise.all([
    getChantierById(chantierId),
    listChantierZones(chantierId),
    getTasksByChantierId(chantierId),
    listTaskStepsByChantierId(chantierId),
    getChantierPreparationChecklist(chantierId),
  ]);

  if (!zonesResult.schemaReady || !stepsResult.schemaReady || !preparationResult.schemaReady) {
    throw new Error("Migrations préparation / zones / étapes non appliquées sur Supabase.");
  }

  const zoneRefById = new Map<string, string>();
  const zones = zonesResult.zones.map((zone, index) => {
    const ref = `zone-${index + 1}`;
    zoneRefById.set(zone.id, ref);
    return {
      ref,
      parent_ref: null as string | null,
      nom: zone.nom,
      zone_type: zone.zone_type,
      niveau: zone.niveau,
      emplacement: zone.emplacement,
      ordre: zone.ordre,
    };
  });

  zonesResult.zones.forEach((zone, index) => {
    zones[index].parent_ref = zone.parent_zone_id ? zoneRefById.get(zone.parent_zone_id) ?? null : null;
  });

  const taskRefById = new Map<string, string>();
  const snapshot: ChantierTemplateSnapshot = {
    version: 1,
    source_chantier_nom: chantier.nom ?? null,
    preparation: {
      plans_disponibles: preparationResult.checklist.plans_disponibles,
      materiaux_commandes: preparationResult.checklist.materiaux_commandes,
      materiel_prevu: preparationResult.checklist.materiel_prevu,
      intervenants_affectes: preparationResult.checklist.intervenants_affectes,
      acces_chantier_valide: preparationResult.checklist.acces_chantier_valide,
      commentaire: preparationResult.checklist.commentaire,
    },
    zones,
    tasks: tasks.map((task, index) => {
      const ref = `task-${index + 1}`;
      taskRefById.set(task.id, ref);
      return {
        ref,
        zone_ref: task.zone_id ? zoneRefById.get(task.zone_id) ?? null : null,
        titre: task.titre,
        corps_etat: task.corps_etat,
        lot: task.lot,
        etape_metier: task.etape_metier,
        date: task.date,
        status: task.status,
        quality_status: task.quality_status,
        admin_validation_status: task.admin_validation_status,
        quantite: task.quantite,
        unite: task.unite,
        temps_prevu_h: task.temps_prevu_h,
        date_debut: task.date_debut,
        date_fin: task.date_fin,
        duration_days: task.duration_days,
        order_index: task.order_index,
      };
    }),
    task_steps: stepsResult.steps
      .map((step) => ({
        task_ref: taskRefById.get(step.task_id) ?? "",
        titre: step.titre,
        statut: step.statut,
        ordre: step.ordre,
      }))
      .filter((step) => step.task_ref),
  };

  const { data, error } = await fromChantierTemplates()
    .insert([{
      nom,
      description: String(input.description ?? "").trim() || null,
      source_chantier_id: chantierId,
      snapshot,
      updated_at: new Date().toISOString(),
    }])
    .select(TEMPLATE_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingTemplateTableError(error)) {
      throw new Error("Migration modèles chantier non appliquée sur Supabase.");
    }
    throw error;
  }
  if (!data) throw new Error("Création modèle OK mais modèle non retourné.");
  return normalizeTemplateRow(data);
}

export async function createChantierFromTemplate(
  templateId: string,
  input: CreateChantierFromTemplateInput,
): Promise<ChantierRow> {
  if (!templateId) throw new Error("templateId manquant.");

  const { data, error } = await fromChantierTemplates()
    .select(TEMPLATE_SELECT)
    .eq("id", templateId)
    .maybeSingle();

  if (error) {
    if (isMissingTemplateTableError(error)) {
      throw new Error("Migration modèles chantier non appliquée sur Supabase.");
    }
    throw error;
  }
  if (!data) throw new Error("Modèle chantier introuvable.");

  const template = normalizeTemplateRow(data);
  const chantier = await createChantier({
    nom: input.nom,
    client: input.client ?? null,
    adresse: input.adresse ?? null,
    status: input.status ?? "PREPARATION",
    date_debut: input.date_debut ?? null,
    date_fin_prevue: input.date_fin_prevue ?? null,
  });

  const zoneIdByRef = new Map<string, string>();
  let pendingZones = [...template.snapshot.zones];
  while (pendingZones.length) {
    const nextPending = pendingZones.filter(
      (zone) => zone.parent_ref && !zoneIdByRef.has(zone.parent_ref),
    );
    const readyZones = pendingZones.filter(
      (zone) => !zone.parent_ref || zoneIdByRef.has(zone.parent_ref),
    );

    if (!readyZones.length) {
      pendingZones = pendingZones.map((zone) => ({ ...zone, parent_ref: null }));
      continue;
    }

    for (const zone of readyZones) {
      const createdZone = await createChantierZone({
        chantier_id: chantier.id,
        parent_zone_id: zone.parent_ref ? zoneIdByRef.get(zone.parent_ref) ?? null : null,
        nom: zone.nom,
        zone_type: zone.zone_type,
        niveau: zone.niveau,
        emplacement: zone.emplacement,
        ordre: zone.ordre,
      });
      zoneIdByRef.set(zone.ref, createdZone.id);
    }

    pendingZones = nextPending;
  }

  const taskIdByRef = new Map<string, string>();
  for (const task of template.snapshot.tasks) {
    const createdTask = await createTask({
      chantier_id: chantier.id,
      titre: task.titre,
      corps_etat: task.corps_etat,
      lot: task.lot ?? task.corps_etat,
      zone_id: task.zone_ref ? zoneIdByRef.get(task.zone_ref) ?? null : null,
      etape_metier: task.etape_metier,
      date: task.date,
      status: "A_FAIRE",
      quality_status: "a_faire",
      admin_validation_status: "non_verifie",
      quantite: task.quantite,
      unite: task.unite,
      temps_prevu_h: task.temps_prevu_h,
      date_debut: task.date_debut,
      date_fin: task.date_fin,
      duration_days: task.duration_days,
      order_index: task.order_index,
    });
    taskIdByRef.set(task.ref, createdTask.id);
  }

  for (const step of template.snapshot.task_steps) {
    const taskId = taskIdByRef.get(step.task_ref);
    if (!taskId) continue;
    await createTaskStep({
      chantier_id: chantier.id,
      task_id: taskId,
      titre: step.titre,
      ordre: step.ordre,
    });
  }

  await upsertChantierPreparationChecklist(chantier.id, {
    plans_disponibles: false,
    materiaux_commandes: false,
    materiel_prevu: false,
    intervenants_affectes: false,
    acces_chantier_valide: false,
    commentaire: template.snapshot.preparation.commentaire,
  });
  return chantier;
}
