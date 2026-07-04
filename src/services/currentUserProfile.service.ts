import { supabase } from "../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";

export type CurrentUserRole = "ADMIN" | "INTERVENANT" | string;
export type CurrentUserHomeRoute = "/dashboard" | "/portail/employe" | "/login";

export type CurrentUserProfile = {
  id: string;
  role: CurrentUserRole | null;
  display_name: string | null;
  email: string | null;
  feature_permissions?: Record<string, unknown>;
};

const ADMIN_EMAILS = new Set(
  String(import.meta.env.VITE_ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeRole(value: unknown): CurrentUserRole | null {
  const role = normalizeText(value);
  return role ? (role.toUpperCase() as CurrentUserRole) : null;
}

function normalizeFeaturePermissions(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isWhitelistedAdminEmail(email: string | null | undefined): boolean {
  return !!email && ADMIN_EMAILS.has(String(email).trim().toLowerCase());
}

function isTransientNetworkError(error: unknown): boolean {
  const message = String((error as any)?.message ?? "").toLowerCase();
  return (
    message.includes("load failed") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("fetcherror")
  );
}

function buildFallbackProfile(user: User): CurrentUserProfile {
  const email = normalizeText(user.email);
  const role =
    normalizeRole(user.app_metadata?.role) ??
    (isWhitelistedAdminEmail(email) ? "ADMIN" : null);
  const displayName =
    normalizeText(user.user_metadata?.display_name) ??
    normalizeText(user.user_metadata?.full_name) ??
    email;

  return {
    id: user.id,
    role,
    display_name: displayName,
    email,
    feature_permissions: {},
  };
}

function isMissingProfileRowError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  return code === "PGRST116" || msg.includes("multiple (or no) rows returned");
}

function isMissingFeaturePermissionsColumnError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  return code === "42703" || (msg.includes("feature_permissions") && (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("could not find")));
}

function isMissingOptionalIntervenantLinkError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  if (code === "42P01" || code === "42703") return true;
  return (
    (msg.includes("intervenants") || msg.includes("intervenant_users")) &&
    (msg.includes("schema cache") || msg.includes("does not exist") || msg.includes("could not find") || msg.includes("relation"))
  );
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  let user = sessionData.session?.user ?? null;

  if (!user) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw new Error(userError.message);
    user = userData.user;
  }

  if (!user?.id) return null;

  const fallbackProfile = buildFallbackProfile(user);
  const fallbackEmail = fallbackProfile.email;

  let query = await (supabase as any)
    .from("profiles")
    .select("id, role, display_name, feature_permissions")
    .eq("id", user.id)
    .maybeSingle();

  if (query.error && isMissingFeaturePermissionsColumnError(query.error)) {
    query = await (supabase as any)
      .from("profiles")
      .select("id, role, display_name")
      .eq("id", user.id)
      .maybeSingle();
  }

  const { data, error } = query;

  if (error) {
    if (isMissingProfileRowError(error)) {
      return fallbackProfile;
    }

    if (isWhitelistedAdminEmail(fallbackEmail) || isTransientNetworkError(error)) {
      return fallbackProfile;
    }

    throw new Error(error.message);
  }

  if (!data) {
    return fallbackProfile;
  }

  return {
    id: String(data.id ?? user.id),
    role: normalizeRole(data.role) ?? fallbackProfile.role,
    display_name: normalizeText(data.display_name) ?? fallbackProfile.display_name,
    email: fallbackEmail,
    feature_permissions: normalizeFeaturePermissions(data.feature_permissions),
  };
}

export function isAdminProfile(profile: CurrentUserProfile | null): boolean {
  return normalizeRole(profile?.role) === "ADMIN" || isWhitelistedAdminEmail(profile?.email);
}

export function isIntervenantProfile(profile: CurrentUserProfile | null): boolean {
  return normalizeRole(profile?.role) === "INTERVENANT";
}

export async function hasLinkedIntervenantAccount(userId: string): Promise<boolean> {
  if (!userId) return false;

  const [directLink, junctionLink] = await Promise.all([
    supabase
      .from("intervenants")
      .select("id", { head: true, count: "exact" })
      .eq("user_id", userId),
    supabase
      .from("intervenant_users")
      .select("user_id", { head: true, count: "exact" })
      .eq("user_id", userId),
  ]);

  if (directLink.error && !isMissingOptionalIntervenantLinkError(directLink.error)) {
    throw new Error(directLink.error.message);
  }
  if (junctionLink.error && !isMissingOptionalIntervenantLinkError(junctionLink.error)) {
    throw new Error(junctionLink.error.message);
  }

  return Boolean((directLink.count ?? 0) > 0 || (junctionLink.count ?? 0) > 0);
}

export async function getCurrentUserHomeRoute(): Promise<CurrentUserHomeRoute> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  let user = sessionData.session?.user ?? null;
  if (!user) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    user = userData.user;
  }

  if (!user?.id) return "/login";

  const profile = await getCurrentUserProfile();
  if (isAdminProfile(profile)) return "/dashboard";
  if (isIntervenantProfile(profile)) return "/portail/employe";
  if (await hasLinkedIntervenantAccount(user.id)) return "/portail/employe";
  return "/login";
}
