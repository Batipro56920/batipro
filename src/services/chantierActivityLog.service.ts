import { supabase } from "../lib/supabaseClient";

export type ChantierActivityLogRow = {
  id: string;
  chantier_id: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action_type: string;
  entity_type: string;
  entity_id: string | null;
  reason: string | null;
  changes: Record<string, unknown>;
  created_at: string;
};

export type ChantierActivityLogInput = {
  chantierId: string;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  changes?: Record<string, unknown>;
  actorName?: string | null;
};

const ACTIVITY_SELECT = [
  "id",
  "chantier_id",
  "actor_id",
  "actor_name",
  "actor_role",
  "action_type",
  "entity_type",
  "entity_id",
  "reason",
  "changes",
  "created_at",
].join(",");

function fromActivityLog() {
  return (supabase as any).from("chantier_activity_log");
}

function isMissingActivitySchemaError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703" || code === "42883" || code === "PGRST205") return true;
  return (
    msg.includes("chantier_activity_log") ||
    msg.includes("chantier_activity_log_insert") ||
    msg.includes("schema cache") ||
    msg.includes("does not exist") ||
    msg.includes("could not find")
  );
}

function normalizeActivityLogRow(row: any): ChantierActivityLogRow {
  const changes = row?.changes && typeof row.changes === "object" ? row.changes : {};
  return {
    id: String(row?.id ?? ""),
    chantier_id: String(row?.chantier_id ?? ""),
    actor_id: row?.actor_id ?? null,
    actor_name: row?.actor_name ?? null,
    actor_role: row?.actor_role ?? null,
    action_type: String(row?.action_type ?? "updated"),
    entity_type: String(row?.entity_type ?? "chantier"),
    entity_id: row?.entity_id ?? null,
    reason: row?.reason ?? null,
    changes,
    created_at: String(row?.created_at ?? new Date().toISOString()),
  };
}

export async function listChantierActivityLogs(
  chantierId: string,
): Promise<{ logs: ChantierActivityLogRow[]; schemaReady: boolean }> {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await fromActivityLog()
    .select(ACTIVITY_SELECT)
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!error) {
    return {
      logs: (data ?? []).map(normalizeActivityLogRow),
      schemaReady: true,
    };
  }

  if (isMissingActivitySchemaError(error)) {
    return {
      logs: [],
      schemaReady: false,
    };
  }

  throw error;
}

export async function appendChantierActivityLog(input: ChantierActivityLogInput): Promise<void> {
  const chantierId = String(input.chantierId ?? "").trim();
  const actionType = String(input.actionType ?? "").trim();
  const entityType = String(input.entityType ?? "").trim();

  if (!chantierId || !actionType || !entityType) {
    throw new Error("Paramètres journal incomplets.");
  }

  const { error } = await (supabase as any).rpc("chantier_activity_log_insert", {
    p_chantier_id: chantierId,
    p_action_type: actionType,
    p_entity_type: entityType,
    p_entity_id: input.entityId ?? null,
    p_reason: input.reason ?? null,
    p_changes: input.changes ?? {},
    p_actor_name: input.actorName ?? null,
  });

  if (error) {
    if (isMissingActivitySchemaError(error)) return;
    throw error;
  }
}
