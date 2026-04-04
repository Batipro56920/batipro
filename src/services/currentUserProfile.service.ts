import { supabase } from "../lib/supabaseClient";

export type CurrentUserRole = "ADMIN" | "INTERVENANT" | string;

export type CurrentUserProfile = {
  id: string;
  role: CurrentUserRole | null;
  display_name: string | null;
};

function normalizeText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function isMissingProfileRowError(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  return code === "PGRST116" || msg.includes("multiple (or no) rows returned");
}

export async function getCurrentUserProfile(): Promise<CurrentUserProfile | null> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(userError.message);
  if (!userData.user?.id) return null;

  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("id, role, display_name")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (error) {
    if (isMissingProfileRowError(error)) return null;
    throw new Error(error.message);
  }

  if (!data) return null;

  return {
    id: String(data.id ?? userData.user.id),
    role: normalizeText(data.role),
    display_name: normalizeText(data.display_name),
  };
}

export function isAdminProfile(profile: CurrentUserProfile | null): boolean {
  return String(profile?.role ?? "").trim().toUpperCase() === "ADMIN";
}
