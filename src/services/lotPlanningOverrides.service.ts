export type LotPlanningOverride = {
  lot_name: string;
  planning_start_date: string | null;
  planning_end_date: string | null;
  order_index: number;
};

function storageKey(chantierId: string): string {
  return `batipro:planning:lot-overrides:${chantierId}`;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizeLotName(value: string): string {
  return String(value ?? "").trim();
}

function normalizeDate(value: string | null | undefined): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeOrder(value: number | null | undefined): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

function readRaw(chantierId: string): Record<string, LotPlanningOverride> {
  if (!canUseStorage()) return {};
  const key = storageKey(chantierId);
  const raw = window.localStorage.getItem(key);
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, any>;
    if (!parsed || typeof parsed !== "object") return {};

    const result: Record<string, LotPlanningOverride> = {};
    for (const [k, value] of Object.entries(parsed)) {
      const lotName = normalizeLotName(k);
      if (!lotName) continue;
      result[lotName] = {
        lot_name: lotName,
        planning_start_date: normalizeDate(value?.planning_start_date),
        planning_end_date: normalizeDate(value?.planning_end_date),
        order_index: normalizeOrder(value?.order_index),
      };
    }
    return result;
  } catch {
    return {};
  }
}

function writeRaw(chantierId: string, map: Record<string, LotPlanningOverride>): void {
  if (!canUseStorage()) return;
  const key = storageKey(chantierId);
  window.localStorage.setItem(key, JSON.stringify(map));
}

export function listLotPlanningOverrides(chantierId: string): LotPlanningOverride[] {
  if (!chantierId) return [];
  const map = readRaw(chantierId);
  return Object.values(map).sort((a, b) => {
    const orderDiff = a.order_index - b.order_index;
    if (orderDiff !== 0) return orderDiff;
    return a.lot_name.localeCompare(b.lot_name, "fr");
  });
}

export function getLotPlanningOverride(
  chantierId: string,
  lotName: string,
): LotPlanningOverride | null {
  const cleanLotName = normalizeLotName(lotName);
  if (!chantierId || !cleanLotName) return null;
  const map = readRaw(chantierId);
  return map[cleanLotName] ?? null;
}

export function upsertLotPlanningOverride(
  chantierId: string,
  patch: Partial<LotPlanningOverride> & { lot_name: string },
): LotPlanningOverride {
  const cleanLotName = normalizeLotName(patch.lot_name);
  if (!chantierId) throw new Error("chantierId manquant.");
  if (!cleanLotName) throw new Error("Nom de lot manquant.");

  const map = readRaw(chantierId);
  const previous = map[cleanLotName];
  const next: LotPlanningOverride = {
    lot_name: cleanLotName,
    planning_start_date: normalizeDate(
      patch.planning_start_date !== undefined ? patch.planning_start_date : previous?.planning_start_date,
    ),
    planning_end_date: normalizeDate(
      patch.planning_end_date !== undefined ? patch.planning_end_date : previous?.planning_end_date,
    ),
    order_index: normalizeOrder(patch.order_index ?? previous?.order_index ?? 0),
  };

  map[cleanLotName] = next;
  writeRaw(chantierId, map);
  return next;
}

