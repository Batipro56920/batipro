import { supabase } from "../lib/supabaseClient";

export type ChantierZoneType = "piece" | "zone" | "niveau" | "etage" | "exterieur";
export type ChantierZoneLocation = "interieur" | "exterieur" | "mixte";

export type ChantierZoneRow = {
  id: string;
  chantier_id: string;
  parent_zone_id: string | null;
  nom: string;
  zone_type: ChantierZoneType;
  niveau: string | null;
  emplacement: ChantierZoneLocation;
  ordre: number;
  created_at: string | null;
  updated_at: string | null;
};

export type ChantierZoneInput = {
  chantier_id: string;
  parent_zone_id?: string | null;
  nom: string;
  zone_type?: ChantierZoneType;
  niveau?: string | null;
  emplacement?: ChantierZoneLocation;
  ordre?: number | null;
};

export type ChantierZonePatch = Partial<Omit<ChantierZoneInput, "chantier_id">>;

const ZONE_SELECT = [
  "id",
  "chantier_id",
  "parent_zone_id",
  "nom",
  "zone_type",
  "niveau",
  "emplacement",
  "ordre",
  "created_at",
  "updated_at",
].join(",");

function fromChantierZones() {
  return (supabase as any).from("chantier_zones");
}

function normalizeZone(row: any): ChantierZoneRow {
  return {
    id: row.id,
    chantier_id: row.chantier_id,
    parent_zone_id: row.parent_zone_id ?? null,
    nom: row.nom,
    zone_type: (row.zone_type ?? "piece") as ChantierZoneType,
    niveau: row.niveau ?? null,
    emplacement: (row.emplacement ?? "interieur") as ChantierZoneLocation,
    ordre: Number.isFinite(Number(row.ordre)) ? Number(row.ordre) : 0,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

function cleanZonePayload(payload: ChantierZoneInput | ChantierZonePatch) {
  const nom = typeof payload.nom === "string" ? payload.nom.trim() : undefined;
  const niveau = typeof payload.niveau === "string" ? payload.niveau.trim() || null : payload.niveau;

  if (Object.prototype.hasOwnProperty.call(payload, "nom") && !nom) {
    throw new Error("Nom de zone obligatoire.");
  }

  return {
    ...payload,
    nom,
    niveau,
    parent_zone_id: payload.parent_zone_id || null,
    zone_type: payload.zone_type ?? "piece",
    emplacement: payload.emplacement ?? "interieur",
    ordre: Math.max(0, Math.trunc(Number(payload.ordre ?? 0) || 0)),
  };
}

function isMissingZonesTableError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  if (!msg) return false;
  return (
    msg.includes("chantier_zones") &&
    (msg.includes("does not exist") || msg.includes("schema cache") || msg.includes("could not find"))
  );
}

export async function listChantierZones(
  chantierId: string,
): Promise<{ zones: ChantierZoneRow[]; schemaReady: boolean }> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await fromChantierZones()
    .select(ZONE_SELECT)
    .eq("chantier_id", chantierId)
    .order("ordre", { ascending: true })
    .order("nom", { ascending: true });

  if (!error) {
    return {
      zones: (data ?? []).map(normalizeZone),
      schemaReady: true,
    };
  }

  if (isMissingZonesTableError(error)) {
    return {
      zones: [],
      schemaReady: false,
    };
  }

  throw error;
}

export async function createChantierZone(payload: ChantierZoneInput): Promise<ChantierZoneRow> {
  if (!payload.chantier_id) throw new Error("chantier_id manquant.");

  const { data, error } = await fromChantierZones()
    .insert([cleanZonePayload(payload)])
    .select(ZONE_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingZonesTableError(error)) {
      throw new Error("Migration zones chantier non appliquée sur Supabase.");
    }
    throw error;
  }
  if (!data) throw new Error("Création zone OK mais zone non retournée.");
  return normalizeZone(data);
}

export async function updateChantierZone(id: string, patch: ChantierZonePatch): Promise<ChantierZoneRow> {
  if (!id) throw new Error("id zone manquant.");

  const { data, error } = await fromChantierZones()
    .update(cleanZonePayload(patch))
    .eq("id", id)
    .select(ZONE_SELECT)
    .maybeSingle();

  if (error) {
    if (isMissingZonesTableError(error)) {
      throw new Error("Migration zones chantier non appliquée sur Supabase.");
    }
    throw error;
  }
  if (!data) throw new Error("Mise a jour zone OK mais zone non retournée.");
  return normalizeZone(data);
}

export async function deleteChantierZone(id: string): Promise<void> {
  if (!id) throw new Error("id zone manquant.");

  const { error } = await fromChantierZones().delete().eq("id", id);
  if (error) {
    if (isMissingZonesTableError(error)) {
      throw new Error("Migration zones chantier non appliquée sur Supabase.");
    }
    throw error;
  }
}
