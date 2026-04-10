import { supabase } from "../lib/supabaseClient";

export type ChantierChangeOrderType = "imprevu" | "travaux_supplementaires";

export type ChantierChangeOrderStatus =
  | "a_analyser"
  | "en_cours"
  | "traite"
  | "a_chiffrer"
  | "en_attente_validation_client"
  | "valide_client"
  | "refuse"
  | "termine"
  | "facture";

export type ChantierChangeOrderRow = {
  id: string;
  chantier_id: string;
  task_id: string | null;
  zone_id: string | null;
  devis_ligne_id: string | null;
  photo_ids: string[];
  type_ecart: ChantierChangeOrderType;
  titre: string;
  description: string | null;
  impact_temps_h: number;
  impact_cout_ht: number;
  quantite: number;
  unite: string | null;
  prix_unitaire_ht: number;
  tva_rate: number;
  total_ht: number;
  total_ttc: number;
  client_validation_required: boolean;
  statut: ChantierChangeOrderStatus;
  requested_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ChantierChangeOrderInput = {
  chantier_id: string;
  task_id?: string | null;
  zone_id?: string | null;
  devis_ligne_id?: string | null;
  photo_ids?: string[] | null;
  type_ecart?: ChantierChangeOrderType;
  titre: string;
  description?: string | null;
  impact_temps_h?: number | string | null;
  impact_cout_ht?: number | string | null;
  quantite?: number | string | null;
  unite?: string | null;
  prix_unitaire_ht?: number | string | null;
  tva_rate?: number | string | null;
  statut?: ChantierChangeOrderStatus;
};

export type ChantierChangeOrderPatch = Partial<Omit<ChantierChangeOrderInput, "chantier_id">>;

const CHANGE_ORDER_SELECT_V2 = [
  "id",
  "chantier_id",
  "task_id",
  "zone_id",
  "devis_ligne_id",
  "photo_ids",
  "type_ecart",
  "titre",
  "description",
  "impact_temps_h",
  "impact_cout_ht",
  "quantite",
  "unite",
  "prix_unitaire_ht",
  "tva_rate",
  "total_ht",
  "total_ttc",
  "client_validation_required",
  "statut",
  "requested_by",
  "approved_by",
  "approved_at",
  "created_at",
  "updated_at",
].join(",");

const CHANGE_ORDER_SELECT_V1 = [
  "id",
  "chantier_id",
  "task_id",
  "zone_id",
  "devis_ligne_id",
  "type_ecart",
  "titre",
  "description",
  "impact_temps_h",
  "impact_cout_ht",
  "statut",
  "requested_by",
  "approved_by",
  "approved_at",
  "created_at",
  "updated_at",
].join(",");

function fromChangeOrders() {
  return (supabase as any).from("chantier_change_orders");
}

function isMissingChangeOrderSchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  return msg.includes("chantier_change_orders") && (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"));
}

function isMissingChangeOrderColumnError(error: unknown, columns: string[]) {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code !== "42703" && code !== "PGRST205") return false;
  return columns.some((column) => msg.includes(column.toLowerCase()));
}

function normalizeNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "string") {
    const raw = value.trim().replace(",", ".");
    if (!raw) return 0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  return 0;
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function normalizeChangeOrderType(value: unknown): ChantierChangeOrderType {
  const raw = String(value ?? "").trim();
  if (raw === "travaux_supplementaires" || raw === "modification_client") {
    return "travaux_supplementaires";
  }
  return "imprevu";
}

export function getChangeOrderStatusOptions(
  type: ChantierChangeOrderType,
): Array<{ value: ChantierChangeOrderStatus; label: string }> {
  if (type === "travaux_supplementaires") {
    return [
      { value: "a_chiffrer", label: "À chiffrer" },
      { value: "en_attente_validation_client", label: "En attente validation client" },
      { value: "valide_client", label: "Validé client" },
      { value: "refuse", label: "Refusé" },
      { value: "en_cours", label: "En cours" },
      { value: "termine", label: "Terminé" },
      { value: "facture", label: "Facturé" },
    ];
  }

  return [
    { value: "a_analyser", label: "À analyser" },
    { value: "en_cours", label: "En cours" },
    { value: "traite", label: "Traité" },
  ];
}

export function normalizeChangeOrderStatus(
  value: unknown,
  type: ChantierChangeOrderType,
): ChantierChangeOrderStatus {
  const raw = String(value ?? "").trim();

  if (type === "travaux_supplementaires") {
    if (raw === "en_attente_validation_client" || raw === "en_attente_validation" || raw === "a_valider") {
      return "en_attente_validation_client";
    }
    if (raw === "valide_client" || raw === "valide") return "valide_client";
    if (raw === "refuse") return "refuse";
    if (raw === "en_cours") return "en_cours";
    if (raw === "termine" || raw === "realise" || raw === "integre") return "termine";
    if (raw === "facture") return "facture";
    return "a_chiffrer";
  }

  if (raw === "en_cours") return "en_cours";
  if (raw === "traite" || raw === "valide" || raw === "realise" || raw === "integre") return "traite";
  return "a_analyser";
}

function normalizePhotoIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

function normalizeChangeOrderRow(row: any): ChantierChangeOrderRow {
  const type = normalizeChangeOrderType(row?.type_ecart);
  const quantite = normalizeNumber(row?.quantite);
  const prixUnitaireHt = normalizeNumber(row?.prix_unitaire_ht);
  const tvaRate = normalizeNumber(row?.tva_rate);
  const computedTotalHt = roundMoney(quantite * prixUnitaireHt);
  const computedTotalTtc = roundMoney(computedTotalHt * (1 + tvaRate / 100));

  return {
    id: String(row?.id ?? ""),
    chantier_id: String(row?.chantier_id ?? ""),
    task_id: row?.task_id ?? null,
    zone_id: row?.zone_id ?? null,
    devis_ligne_id: row?.devis_ligne_id ?? null,
    photo_ids: normalizePhotoIds(row?.photo_ids),
    type_ecart: type,
    titre: String(row?.titre ?? "Imprévu chantier").trim() || "Imprévu chantier",
    description: row?.description ?? null,
    impact_temps_h: normalizeNumber(row?.impact_temps_h),
    impact_cout_ht: normalizeNumber(row?.impact_cout_ht),
    quantite,
    unite: String(row?.unite ?? "").trim() || null,
    prix_unitaire_ht: prixUnitaireHt,
    tva_rate: tvaRate,
    total_ht: row?.total_ht === undefined || row?.total_ht === null ? computedTotalHt : normalizeNumber(row?.total_ht),
    total_ttc: row?.total_ttc === undefined || row?.total_ttc === null ? computedTotalTtc : normalizeNumber(row?.total_ttc),
    client_validation_required:
      typeof row?.client_validation_required === "boolean"
        ? row.client_validation_required
        : type === "travaux_supplementaires",
    statut: normalizeChangeOrderStatus(row?.statut, type),
    requested_by: row?.requested_by ?? null,
    approved_by: row?.approved_by ?? null,
    approved_at: row?.approved_at ?? null,
    created_at: row?.created_at ?? null,
    updated_at: row?.updated_at ?? null,
  };
}

function buildCleanChangeOrderPayload(
  payload: ChantierChangeOrderInput | ChantierChangeOrderPatch,
  typeFallback: ChantierChangeOrderType = "imprevu",
) {
  const type = payload.type_ecart ? normalizeChangeOrderType(payload.type_ecart) : typeFallback;
  const titre = typeof payload.titre === "string" ? payload.titre.trim() : payload.titre;
  const description = typeof payload.description === "string" ? payload.description.trim() || null : payload.description;

  if (Object.prototype.hasOwnProperty.call(payload, "titre") && !titre) {
    throw new Error("Titre d'imprévu / TS obligatoire.");
  }

  const quantite = normalizeNumber(payload.quantite);
  const prixUnitaireHt = normalizeNumber(payload.prix_unitaire_ht);
  const tvaRate = normalizeNumber(payload.tva_rate);
  const totalHt = roundMoney(quantite * prixUnitaireHt);
  const totalTtc = roundMoney(totalHt * (1 + tvaRate / 100));
  const impactTemps = normalizeNumber(payload.impact_temps_h);
  const impactCout = normalizeNumber(payload.impact_cout_ht);
  const photoIds = normalizePhotoIds(payload.photo_ids);
  const nextStatus = payload.statut
    ? normalizeChangeOrderStatus(payload.statut, type)
    : type === "travaux_supplementaires"
      ? "a_chiffrer"
      : "a_analyser";

  if (type === "travaux_supplementaires" && ["en_cours", "termine", "facture"].includes(nextStatus)) {
    throw new Error("Un travaux supplémentaire doit d'abord être validé client.");
  }

  return {
    ...payload,
    task_id: payload.task_id || null,
    zone_id: payload.zone_id || null,
    devis_ligne_id: payload.devis_ligne_id || null,
    photo_ids: photoIds,
    type_ecart: type,
    titre,
    description,
    impact_temps_h: type === "imprevu" ? impactTemps : 0,
    impact_cout_ht: type === "imprevu" ? impactCout : totalHt,
    quantite: type === "travaux_supplementaires" ? quantite : null,
    unite: type === "travaux_supplementaires" ? String(payload.unite ?? "").trim() || null : null,
    prix_unitaire_ht: type === "travaux_supplementaires" ? prixUnitaireHt : null,
    tva_rate: type === "travaux_supplementaires" ? tvaRate : null,
    total_ht: type === "travaux_supplementaires" ? totalHt : null,
    total_ttc: type === "travaux_supplementaires" ? totalTtc : null,
    client_validation_required: type === "travaux_supplementaires",
    statut: nextStatus,
  };
}

async function getChangeOrderById(id: string): Promise<ChantierChangeOrderRow | null> {
  const first = await fromChangeOrders().select(CHANGE_ORDER_SELECT_V2).eq("id", id).maybeSingle();
  if (!first.error) return first.data ? normalizeChangeOrderRow(first.data) : null;
  if (isMissingChangeOrderColumnError(first.error, ["photo_ids", "quantite", "total_ht", "client_validation_required"])) {
    const legacy = await fromChangeOrders().select(CHANGE_ORDER_SELECT_V1).eq("id", id).maybeSingle();
    if (legacy.error) throw legacy.error;
    return legacy.data ? normalizeChangeOrderRow(legacy.data) : null;
  }
  throw first.error;
}

export async function listChantierChangeOrders(
  chantierId: string,
): Promise<{ changeOrders: ChantierChangeOrderRow[]; schemaReady: boolean }> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const first = await fromChangeOrders()
    .select(CHANGE_ORDER_SELECT_V2)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });

  if (!first.error) {
    return { changeOrders: (first.data ?? []).map(normalizeChangeOrderRow), schemaReady: true };
  }
  if (isMissingChangeOrderSchemaError(first.error)) return { changeOrders: [], schemaReady: false };
  if (isMissingChangeOrderColumnError(first.error, ["photo_ids", "quantite", "total_ht", "client_validation_required"])) {
    const legacy = await fromChangeOrders()
      .select(CHANGE_ORDER_SELECT_V1)
      .eq("chantier_id", chantierId)
      .order("created_at", { ascending: false });
    if (legacy.error) throw legacy.error;
    return { changeOrders: (legacy.data ?? []).map(normalizeChangeOrderRow), schemaReady: false };
  }
  throw first.error;
}

export async function createChantierChangeOrder(
  payload: ChantierChangeOrderInput,
): Promise<ChantierChangeOrderRow> {
  if (!payload.chantier_id) throw new Error("chantier_id manquant.");

  const { data, error } = await fromChangeOrders()
    .insert([
      buildCleanChangeOrderPayload(
        payload,
        payload.type_ecart ? normalizeChangeOrderType(payload.type_ecart) : "imprevu",
      ),
    ])
    .select(CHANGE_ORDER_SELECT_V2)
    .maybeSingle();

  if (error) {
    if (
      isMissingChangeOrderSchemaError(error) ||
      isMissingChangeOrderColumnError(error, ["photo_ids", "quantite", "total_ht", "client_validation_required"])
    ) {
      throw new Error("Migration imprévus / TS non appliquée sur Supabase.");
    }
    throw error;
  }
  if (!data) throw new Error("Création imprévu / TS OK mais ligne non retournée.");
  return normalizeChangeOrderRow(data);
}

export async function updateChantierChangeOrder(
  id: string,
  patch: ChantierChangeOrderPatch,
): Promise<ChantierChangeOrderRow> {
  if (!id) throw new Error("id imprévu / TS manquant.");

  const current = await getChangeOrderById(id);
  if (!current) throw new Error("Imprévu / TS introuvable.");

  const nextType = patch.type_ecart ? normalizeChangeOrderType(patch.type_ecart) : current.type_ecart;
  const cleaned = buildCleanChangeOrderPayload(patch, nextType);
  const nextStatus = cleaned.statut ?? current.statut;

  if (
    nextType === "travaux_supplementaires" &&
    ["en_cours", "termine", "facture"].includes(nextStatus) &&
    !["valide_client", "en_cours", "termine", "facture"].includes(current.statut)
  ) {
    throw new Error("Validation client obligatoire avant exécution du TS.");
  }

  const patchWithApproval =
    nextType === "travaux_supplementaires" && nextStatus === "valide_client"
      ? { ...cleaned, approved_at: new Date().toISOString() }
      : cleaned;

  const { data, error } = await fromChangeOrders()
    .update(patchWithApproval)
    .eq("id", id)
    .select(CHANGE_ORDER_SELECT_V2)
    .maybeSingle();

  if (error) {
    if (
      isMissingChangeOrderSchemaError(error) ||
      isMissingChangeOrderColumnError(error, ["photo_ids", "quantite", "total_ht", "client_validation_required"])
    ) {
      throw new Error("Migration imprévus / TS non appliquée sur Supabase.");
    }
    throw error;
  }
  if (!data) throw new Error("Mise à jour imprévu / TS OK mais ligne non retournée.");
  return normalizeChangeOrderRow(data);
}

export async function deleteChantierChangeOrder(id: string): Promise<void> {
  if (!id) throw new Error("id imprévu / TS manquant.");
  const { error } = await fromChangeOrders().delete().eq("id", id);
  if (error) {
    if (isMissingChangeOrderSchemaError(error)) throw new Error("Migration imprévus / TS non appliquée sur Supabase.");
    throw error;
  }
}
