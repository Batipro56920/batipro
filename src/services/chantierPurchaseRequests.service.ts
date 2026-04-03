import { supabase } from "../lib/supabaseClient";

export type ChantierPurchaseRequestStatus = "a_commander" | "commande" | "livre" | "annule";

export type ChantierPurchaseRequestRow = {
  id: string;
  chantier_id: string;
  task_id: string | null;
  zone_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  titre: string;
  quantite: number | null;
  unite: string | null;
  statut_commande: ChantierPurchaseRequestStatus;
  livraison_prevue_le: string | null;
  recu: boolean;
  commentaire: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ChantierPurchaseRequestInput = {
  chantier_id: string;
  task_id?: string | null;
  zone_id?: string | null;
  supplier_name?: string | null;
  titre: string;
  quantite?: number | null;
  unite?: string | null;
  statut_commande?: ChantierPurchaseRequestStatus;
  livraison_prevue_le?: string | null;
  recu?: boolean;
  commentaire?: string | null;
};

export type ChantierPurchaseRequestPatch = Partial<Omit<ChantierPurchaseRequestInput, "chantier_id">>;

const PURCHASE_SELECT = [
  "id",
  "chantier_id",
  "task_id",
  "zone_id",
  "supplier_id",
  "supplier_name",
  "titre",
  "quantite",
  "unite",
  "statut_commande",
  "livraison_prevue_le",
  "recu",
  "commentaire",
  "created_by",
  "created_at",
  "updated_at",
].join(",");

function fromPurchaseRequests() {
  return (supabase as any).from("chantier_purchase_requests");
}

function isMissingPurchaseSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  return (
    msg.includes("chantier_purchase_requests") &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"))
  );
}

function normalizePurchaseRequestRow(row: any): ChantierPurchaseRequestRow {
  return {
    id: String(row?.id ?? ""),
    chantier_id: String(row?.chantier_id ?? ""),
    task_id: row?.task_id ?? null,
    zone_id: row?.zone_id ?? null,
    supplier_id: row?.supplier_id ?? null,
    supplier_name: row?.supplier_name ?? null,
    titre: String(row?.titre ?? "Demande approvisionnement").trim() || "Demande approvisionnement",
    quantite: row?.quantite == null ? null : Number(row.quantite),
    unite: row?.unite ?? null,
    statut_commande: (row?.statut_commande ?? "a_commander") as ChantierPurchaseRequestStatus,
    livraison_prevue_le: row?.livraison_prevue_le ?? null,
    recu: Boolean(row?.recu),
    commentaire: row?.commentaire ?? null,
    created_by: row?.created_by ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

function cleanPurchasePayload(payload: ChantierPurchaseRequestInput | ChantierPurchaseRequestPatch) {
  const titre = typeof payload.titre === "string" ? payload.titre.trim() : undefined;
  const supplierName =
    typeof payload.supplier_name === "string" ? payload.supplier_name.trim() || null : payload.supplier_name;
  const unite = typeof payload.unite === "string" ? payload.unite.trim() || null : payload.unite;
  const commentaire =
    typeof payload.commentaire === "string" ? payload.commentaire.trim() || null : payload.commentaire;
  const quantite =
    payload.quantite == null
      ? null
      : Number.isFinite(Number(payload.quantite))
        ? Number(payload.quantite)
        : null;

  if (Object.prototype.hasOwnProperty.call(payload, "titre") && !titre) {
    throw new Error("Titre de demande obligatoire.");
  }

  return {
    ...payload,
    task_id: payload.task_id || null,
    zone_id: payload.zone_id || null,
    supplier_name: supplierName,
    titre,
    quantite,
    unite,
    statut_commande: payload.statut_commande ?? "a_commander",
    livraison_prevue_le: payload.livraison_prevue_le || null,
    recu: Boolean(payload.recu),
    commentaire,
  };
}

export async function listChantierPurchaseRequests(
  chantierId: string,
): Promise<{ requests: ChantierPurchaseRequestRow[]; schemaReady: boolean }> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await fromPurchaseRequests()
    .select(PURCHASE_SELECT)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (!error) {
    return {
      requests: (data ?? []).map(normalizePurchaseRequestRow),
      schemaReady: true,
    };
  }

  if (isMissingPurchaseSchemaError(error)) {
    return {
      requests: [],
      schemaReady: false,
    };
  }

  throw error;
}

export async function createChantierPurchaseRequest(
  payload: ChantierPurchaseRequestInput,
): Promise<ChantierPurchaseRequestRow> {
  if (!payload.chantier_id) throw new Error("chantier_id manquant.");

  const { data, error } = await fromPurchaseRequests()
    .insert([cleanPurchasePayload(payload)])
    .select(PURCHASE_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingPurchaseSchemaError(error)) {
      throw new Error("Migration approvisionnement non appliquée sur Supabase.");
    }
    throw error;
  }
  if (!data) throw new Error("Création demande OK mais ligne non retournée.");
  return normalizePurchaseRequestRow(data);
}

export async function updateChantierPurchaseRequest(
  id: string,
  patch: ChantierPurchaseRequestPatch,
): Promise<ChantierPurchaseRequestRow> {
  if (!id) throw new Error("id demande manquant.");

  const { data, error } = await fromPurchaseRequests()
    .update(cleanPurchasePayload(patch))
    .eq("id", id)
    .select(PURCHASE_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingPurchaseSchemaError(error)) {
      throw new Error("Migration approvisionnement non appliquée sur Supabase.");
    }
    throw error;
  }
  if (!data) throw new Error("Mise à jour demande OK mais ligne non retournée.");
  return normalizePurchaseRequestRow(data);
}

export async function deleteChantierPurchaseRequest(id: string): Promise<void> {
  if (!id) throw new Error("id demande manquant.");
  const { error } = await fromPurchaseRequests().delete().eq("id", id);
  if (error) {
    if (isMissingPurchaseSchemaError(error)) {
      throw new Error("Migration approvisionnement non appliquée sur Supabase.");
    }
    throw error;
  }
}
