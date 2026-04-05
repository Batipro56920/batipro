import { supabase } from "../lib/supabaseClient";

export type ProfileFeaturePermissionKey = "task_library_preparation";

export type ProfileFeaturePermissions = Record<ProfileFeaturePermissionKey, boolean>;

export type ProfileFeaturePermissionsResult = {
  role: string | null;
  permissions: ProfileFeaturePermissions;
  schemaReady: boolean;
};

const DEFAULT_PERMISSIONS: ProfileFeaturePermissions = {
  task_library_preparation: false,
};

let supportsProfileFeaturePermissions: boolean | null = null;

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizePermissions(raw: unknown): ProfileFeaturePermissions {
  const input =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  return {
    task_library_preparation: input.task_library_preparation === true,
  };
}

function isMissingFeaturePermissionsColumnError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42703") return true;
  return (
    msg.includes("feature_permissions") &&
    (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("could not find"))
  );
}

async function getCurrentUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  return data.user?.id ?? null;
}

export async function getCurrentProfileFeaturePermissions(): Promise<ProfileFeaturePermissionsResult> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return {
      role: null,
      permissions: { ...DEFAULT_PERMISSIONS },
      schemaReady: supportsProfileFeaturePermissions !== false,
    };
  }

  const query = await (supabase as any)
    .from("profiles")
    .select(supportsProfileFeaturePermissions === false ? "role" : "role, feature_permissions")
    .eq("id", userId)
    .maybeSingle();

  if (query.error) {
    if (supportsProfileFeaturePermissions !== false && isMissingFeaturePermissionsColumnError(query.error)) {
      supportsProfileFeaturePermissions = false;
      const fallback = await (supabase as any)
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if (fallback.error) throw new Error(fallback.error.message);
      return {
        role: normalizeText(fallback.data?.role),
        permissions: { ...DEFAULT_PERMISSIONS },
        schemaReady: false,
      };
    }

    throw new Error(query.error.message);
  }

  if (supportsProfileFeaturePermissions !== false) {
    supportsProfileFeaturePermissions = true;
  }

  return {
    role: normalizeText(query.data?.role),
    permissions: normalizePermissions(query.data?.feature_permissions),
    schemaReady: true,
  };
}

export async function setCurrentProfileFeaturePermission(
  key: ProfileFeaturePermissionKey,
  enabled: boolean,
): Promise<ProfileFeaturePermissions> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Utilisateur non authentifié.");

  const current = await getCurrentProfileFeaturePermissions();
  if (current.role?.toUpperCase() !== "ADMIN") {
    throw new Error("Seul un profil ADMIN peut activer cette permission.");
  }
  if (!current.schemaReady) {
    throw new Error("Migration permissions profil non appliquée sur Supabase.");
  }

  const nextPermissions = {
    ...current.permissions,
    [key]: enabled,
  };

  const { data, error } = await (supabase as any)
    .from("profiles")
    .update({ feature_permissions: nextPermissions })
    .eq("id", userId)
    .select("feature_permissions")
    .maybeSingle();

  if (error) {
    if (isMissingFeaturePermissionsColumnError(error)) {
      supportsProfileFeaturePermissions = false;
      throw new Error("Migration permissions profil non appliquée sur Supabase.");
    }
    throw new Error(error.message);
  }

  supportsProfileFeaturePermissions = true;
  return normalizePermissions(data?.feature_permissions);
}

export function hasProfileFeaturePermission(
  permissions: ProfileFeaturePermissions | null | undefined,
  key: ProfileFeaturePermissionKey,
): boolean {
  if (!permissions) return false;
  return permissions[key] === true;
}
