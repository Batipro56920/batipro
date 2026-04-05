import { supabase } from "../lib/supabaseClient";

export type ChantierZoneType = "piece" | "zone" | "niveau" | "etage" | "exterieur";
export type ChantierZoneLocation = "interieur" | "exterieur" | "mixte";
export type ChantierLocalisationKind = "batiment" | "niveau" | "piece";

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

export type ChantierZoneTreeNode = ChantierZoneRow & {
  kind: ChantierLocalisationKind;
  depth: number;
  path: string;
  children: ChantierZoneTreeNode[];
};

export type ChantierZoneUsageSummary = {
  links: {
    tasks: number;
    photos: number;
    reserves: number;
    documents: number;
    consignes: number;
    achats: number;
    ecarts: number;
    retours: number;
  };
  totalLinks: number;
};

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

export function zoneTypeToLocalisationKind(zoneType: string | null | undefined): ChantierLocalisationKind {
  if (zoneType === "piece") return "piece";
  if (zoneType === "niveau" || zoneType === "etage") return "niveau";
  return "batiment";
}

export function localisationKindToZoneType(kind: ChantierLocalisationKind): ChantierZoneType {
  if (kind === "piece") return "piece";
  if (kind === "niveau") return "niveau";
  return "zone";
}

function sortZones(a: ChantierZoneRow, b: ChantierZoneRow) {
  return a.ordre - b.ordre || a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
}

export function buildChantierZonePathMap(zones: ChantierZoneRow[]): Map<string, string> {
  const byId = new Map<string, ChantierZoneRow>();
  for (const zone of zones) byId.set(zone.id, zone);

  const pathById = new Map<string, string>();

  function resolve(zoneId: string): string {
    const cached = pathById.get(zoneId);
    if (cached) return cached;

    const labels: string[] = [];
    const visited = new Set<string>();
    let currentId: string | null = zoneId;

    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const zone = byId.get(currentId);
      if (!zone) break;
      labels.unshift(zone.nom);
      currentId = zone.parent_zone_id ?? null;
    }

    const path = labels.join(" > ");
    pathById.set(zoneId, path);
    return path;
  }

  for (const zone of zones) {
    resolve(zone.id);
  }

  return pathById;
}

export function resolveChantierZonePath(
  zoneId: string | null | undefined,
  zones: ChantierZoneRow[] | Map<string, string>,
): string {
  const cleanZoneId = String(zoneId ?? "").trim();
  if (!cleanZoneId) return "Sans localisation";

  if (zones instanceof Map) {
    return zones.get(cleanZoneId) ?? "Localisation inconnue";
  }

  return buildChantierZonePathMap(zones).get(cleanZoneId) ?? "Localisation inconnue";
}

export function buildChantierZoneTree(zones: ChantierZoneRow[]): ChantierZoneTreeNode[] {
  const sortedZones = [...zones].sort(sortZones);
  const pathById = buildChantierZonePathMap(sortedZones);
  const nodeById = new Map<string, ChantierZoneTreeNode>();

  for (const zone of sortedZones) {
    nodeById.set(zone.id, {
      ...zone,
      kind: zoneTypeToLocalisationKind(zone.zone_type),
      depth: 0,
      path: pathById.get(zone.id) ?? zone.nom,
      children: [],
    });
  }

  const roots: ChantierZoneTreeNode[] = [];

  for (const zone of sortedZones) {
    const node = nodeById.get(zone.id);
    if (!node) continue;
    const parentNode = zone.parent_zone_id ? nodeById.get(zone.parent_zone_id) ?? null : null;
    if (!parentNode) {
      roots.push(node);
      continue;
    }
    node.depth = parentNode.depth + 1;
    parentNode.children.push(node);
  }

  const decorateDepth = (nodes: ChantierZoneTreeNode[], depth: number) => {
    for (const node of nodes) {
      node.depth = depth;
      node.children.sort(sortZones);
      decorateDepth(node.children, depth + 1);
    }
  };

  roots.sort(sortZones);
  decorateDepth(roots, 0);
  return roots;
}

export function listValidZoneParents(zones: ChantierZoneRow[], zoneId: string | null): ChantierZoneRow[] {
  const blocked = new Set<string>();
  const cleanZoneId = String(zoneId ?? "").trim();
  if (cleanZoneId) {
    blocked.add(cleanZoneId);
    let changed = true;
    while (changed) {
      changed = false;
      for (const zone of zones) {
        if (zone.parent_zone_id && blocked.has(zone.parent_zone_id) && !blocked.has(zone.id)) {
          blocked.add(zone.id);
          changed = true;
        }
      }
    }
  }

  return [...zones]
    .filter((zone) => !blocked.has(zone.id))
    .sort(sortZones);
}

function normalizeZoneMatchLabel(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bsdb\b/g, "salle de bain")
    .replace(/\bsde\b/g, "salle d eau")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function findBestChantierZoneMatch(input: string, zones: ChantierZoneRow[]): ChantierZoneRow | null {
  const normalizedInput = normalizeZoneMatchLabel(input);
  if (!normalizedInput) return null;

  let best: { zone: ChantierZoneRow; score: number } | null = null;
  const pathById = buildChantierZonePathMap(zones);

  for (const zone of zones) {
    const candidates = [zone.nom, pathById.get(zone.id) ?? ""].map(normalizeZoneMatchLabel);
    let score = 0;
    for (const candidate of candidates) {
      if (!candidate) continue;
      if (candidate === normalizedInput) score = Math.max(score, 100);
      else if (candidate.includes(normalizedInput) || normalizedInput.includes(candidate)) score = Math.max(score, 72);
      else {
        const inputTokens = new Set(normalizedInput.split(" ").filter(Boolean));
        const candidateTokens = candidate.split(" ").filter(Boolean);
        const overlap = candidateTokens.filter((token) => inputTokens.has(token)).length;
        const overlapScore = overlap * 18;
        score = Math.max(score, overlapScore);
      }
    }
    if (!best || score > best.score) {
      best = { zone, score };
    }
  }

  return best && best.score >= 36 ? best.zone : null;
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

function isMissingZoneLinkedTableError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "PGRST205") return true;
  return msg.includes("does not exist") || msg.includes("schema cache");
}

async function countZoneLinks(table: string, zoneId: string): Promise<number> {
  const { count, error } = await (supabase as any)
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("zone_id", zoneId);

  if (error) {
    if (isMissingZoneLinkedTableError(error)) return 0;
    throw error;
  }

  return Number(count ?? 0) || 0;
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

export async function getChantierZoneUsageSummary(zoneId: string): Promise<ChantierZoneUsageSummary> {
  if (!zoneId) throw new Error("id zone manquant.");

  const [tasks, photos, reserves, documents, consignes, achats, ecarts, retours] = await Promise.all([
    countZoneLinks("chantier_tasks", zoneId),
    countZoneLinks("chantier_photos", zoneId),
    countZoneLinks("chantier_reserves", zoneId),
    countZoneLinks("chantier_documents", zoneId),
    countZoneLinks("chantier_consignes", zoneId),
    countZoneLinks("chantier_purchase_requests", zoneId),
    countZoneLinks("chantier_change_orders", zoneId),
    countZoneLinks("terrain_feedbacks", zoneId),
  ]);

  const links = {
    tasks,
    photos,
    reserves,
    documents,
    consignes,
    achats,
    ecarts,
    retours,
  };

  return {
    links,
    totalLinks: Object.values(links).reduce((sum, value) => sum + value, 0),
  };
}
