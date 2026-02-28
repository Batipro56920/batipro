import { supabase } from "../lib/supabaseClient";

export type MaterielStatus = "en_attente" | "validee" | "refusee" | "livree";

export type MaterielDemandeRow = {
  id: string;
  chantier_id: string;
  intervenant_id: string;
  task_id: string | null;
  task_titre?: string | null;
  intervenant_nom?: string | null;
  titre: string;
  designation: string;
  quantite: number;
  unite: string | null;
  commentaire: string | null;
  remarques: string | null;
  date_souhaitee: string | null;
  date_livraison: string | null;
  statut: MaterielStatus;
  status: string | null;
  admin_commentaire: string | null;
  validated_at: string | null;
  validated_by: string | null;
  created_at: string;
  updated_at: string;
};

const TABLE = "materiel_demandes";

function normalizeNumber(input: unknown): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const raw = String(input ?? "").trim().replace(",", ".");
  const n = Number(raw);
  if (!Number.isFinite(n)) return NaN;
  return n;
}

function assertRequired(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function normalizeStatus(input: unknown): MaterielStatus {
  const value = String(input ?? "").trim().toLowerCase();
  if (value === "validee") return "validee";
  if (value === "refusee") return "refusee";
  if (value === "livree") return "livree";
  return "en_attente";
}

function legacyStatusFromStatut(statut: MaterielStatus): string {
  if (statut === "validee") return "COMMANDE";
  if (statut === "refusee") return "REFUSEE";
  if (statut === "livree") return "LIVRE";
  return "A_COMMANDER";
}

function mapRow(row: Record<string, unknown>): MaterielDemandeRow {
  const statut = normalizeStatus(row.statut ?? row.status);
  const titre = String(row.titre ?? row.designation ?? "Demande materiel").trim() || "Demande materiel";
  const commentaire = (row.commentaire as string | null | undefined) ?? (row.remarques as string | null | undefined) ?? null;
  return {
    id: String(row.id ?? ""),
    chantier_id: String(row.chantier_id ?? ""),
    intervenant_id: String(row.intervenant_id ?? ""),
    task_id: (row.task_id as string | null | undefined) ?? null,
    task_titre: (row.task_titre as string | null | undefined) ?? null,
    intervenant_nom: (row.intervenant_nom as string | null | undefined) ?? null,
    titre,
    designation: String(row.designation ?? titre),
    quantite: Number(row.quantite ?? 0) || 0,
    unite: (row.unite as string | null | undefined) ?? null,
    commentaire,
    remarques: (row.remarques as string | null | undefined) ?? commentaire ?? null,
    date_souhaitee:
      (row.date_souhaitee as string | null | undefined) ??
      (row.date_besoin as string | null | undefined) ??
      (row.date_livraison as string | null | undefined) ??
      null,
    date_livraison: (row.date_livraison as string | null | undefined) ?? null,
    statut,
    status: (row.status as string | null | undefined) ?? legacyStatusFromStatut(statut),
    admin_commentaire: (row.admin_commentaire as string | null | undefined) ?? null,
    validated_at: (row.validated_at as string | null | undefined) ?? null,
    validated_by: (row.validated_by as string | null | undefined) ?? null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? row.created_at ?? ""),
  };
}

export async function listMaterielDemandesByChantierId(chantierId: string): Promise<MaterielDemandeRow[]> {
  assertRequired(Boolean(chantierId), "chantierId manquant.");

  const rpc = await (supabase as any).rpc("admin_materiel_list", { p_chantier_id: chantierId });
  if (!rpc.error) {
    const rows = Array.isArray(rpc.data) ? rpc.data : [];
    return rows.map((row: unknown) => mapRow((row ?? {}) as Record<string, unknown>));
  }

  const { data, error } = await supabase.from(TABLE).select("*").eq("chantier_id", chantierId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  return rows.map((row) => mapRow(row));
}

export async function createMaterielDemande(input: {
  chantier_id: string;
  intervenant_id: string;
  task_id?: string | null;
  designation?: string;
  titre?: string;
  quantite?: number | string;
  unite?: string | null;
  date_livraison?: string | null;
  date_souhaitee?: string | null;
  remarques?: string | null;
  commentaire?: string | null;
  statut?: MaterielStatus;
}): Promise<MaterielDemandeRow> {
  const chantier_id = input?.chantier_id;
  const intervenant_id = input?.intervenant_id;
  const titre = String(input?.titre ?? input?.designation ?? "").trim();

  assertRequired(Boolean(chantier_id), "chantier_id obligatoire.");
  assertRequired(Boolean(intervenant_id), "intervenant_id obligatoire.");
  assertRequired(Boolean(titre), "titre/designation obligatoire.");

  const q = normalizeNumber(input?.quantite ?? 1);
  assertRequired(!Number.isNaN(q), "quantite invalide.");
  assertRequired(q > 0, "quantite doit etre > 0.");

  const statut = normalizeStatus(input?.statut ?? "en_attente");
  const commentaire = input.commentaire ?? input.remarques ?? null;
  const dateSouhaitee = input.date_souhaitee ?? input.date_livraison ?? null;

  const payload = {
    chantier_id,
    intervenant_id,
    task_id: input.task_id ?? null,
    titre,
    designation: titre,
    quantite: q,
    unite: input.unite ?? null,
    date_souhaitee: dateSouhaitee,
    date_livraison: input.date_livraison ?? dateSouhaitee,
    commentaire,
    remarques: commentaire,
    statut,
    status: legacyStatusFromStatut(statut),
  };

  const { data, error } = await supabase.from(TABLE).insert(payload).select("*").single();
  if (error) throw new Error(error.message);

  return mapRow((data ?? {}) as Record<string, unknown>);
}

export async function updateMaterielDemande(
  id: string,
  patch: Partial<{
    intervenant_id: string;
    task_id: string | null;
    titre: string;
    designation: string;
    quantite: number | string;
    unite: string | null;
    date_livraison: string | null;
    date_souhaitee: string | null;
    remarques: string | null;
    commentaire: string | null;
    statut: MaterielStatus;
    admin_commentaire: string | null;
  }>,
): Promise<MaterielDemandeRow> {
  assertRequired(Boolean(id), "id manquant.");

  if (patch.statut !== undefined) {
    const statut = normalizeStatus(patch.statut);
    const { data, error } = await (supabase as any).rpc("admin_materiel_update_status", {
      p_id: id,
      p_statut: statut,
      p_admin_commentaire: patch.admin_commentaire ?? null,
    });
    if (error) throw new Error(error.message);
    return mapRow((data ?? {}) as Record<string, unknown>);
  }

  const updatePayload: Record<string, unknown> = {};

  if (patch.intervenant_id !== undefined) {
    assertRequired(Boolean(patch.intervenant_id), "intervenant_id obligatoire.");
    updatePayload.intervenant_id = patch.intervenant_id;
  }

  if (patch.task_id !== undefined) {
    updatePayload.task_id = patch.task_id ?? null;
  }

  if (patch.titre !== undefined || patch.designation !== undefined) {
    const titre = String(patch.titre ?? patch.designation ?? "").trim();
    assertRequired(Boolean(titre), "titre/designation obligatoire.");
    updatePayload.titre = titre;
    updatePayload.designation = titre;
  }

  if (patch.quantite !== undefined) {
    const q = normalizeNumber(patch.quantite);
    assertRequired(!Number.isNaN(q), "quantite invalide.");
    assertRequired(q > 0, "quantite doit etre > 0.");
    updatePayload.quantite = q;
  }

  if (patch.unite !== undefined) updatePayload.unite = patch.unite ?? null;

  if (patch.date_souhaitee !== undefined || patch.date_livraison !== undefined) {
    const dateSouhaitee = patch.date_souhaitee ?? patch.date_livraison ?? null;
    updatePayload.date_souhaitee = dateSouhaitee;
    updatePayload.date_livraison = patch.date_livraison ?? dateSouhaitee;
  }

  if (patch.commentaire !== undefined || patch.remarques !== undefined) {
    const commentaire = patch.commentaire ?? patch.remarques ?? null;
    updatePayload.commentaire = commentaire;
    updatePayload.remarques = commentaire;
  }

  const { data, error } = await supabase.from(TABLE).update(updatePayload).eq("id", id).select("*").single();
  if (error) throw new Error(error.message);

  return mapRow((data ?? {}) as Record<string, unknown>);
}

export async function deleteMaterielDemande(id: string): Promise<void> {
  assertRequired(Boolean(id), "id manquant.");

  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw new Error(error.message);
}
