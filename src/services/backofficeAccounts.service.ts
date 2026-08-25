import { supabase } from "../lib/supabaseClient";

export const SIDEBAR_GROUPS = ["Pilotage", "Commerce", "Production", "Ressources", "Achats", "Financier", "Paramètres"] as const;
export type SidebarGroup = (typeof SIDEBAR_GROUPS)[number];

export type BackofficeAccount = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string;
  allowedSidebarGroups: string[] | null;
};

async function ensureSession(): Promise<string> {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  let session = sessionData.session;
  if (!session) {
    throw new Error("Pas connecté : session manquante. Reconnecte-toi puis réessaie.");
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (!expiresAtMs || expiresAtMs < Date.now() + 60_000) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshed.session) {
      throw new Error("Session expirée. Reconnecte-toi puis réessaie.");
    }
    session = refreshed.session;
  }

  return session.access_token;
}

async function invokeEdgeFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const accessToken = await ensureSession();

  const { data, error } = await supabase.functions.invoke(name, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
  });

  if (error) {
    const msg = (error as any)?.message ?? String(error);
    if (String(msg).includes("401") || String(msg).toLowerCase().includes("unauthorized")) {
      throw new Error("Accès refusé (401). Reconnecte-toi puis réessaie.");
    }
    throw error;
  }

  return data as T;
}

export async function listBackofficeAccounts(): Promise<BackofficeAccount[]> {
  const result = await invokeEdgeFunction<{ ok: boolean; accounts?: BackofficeAccount[]; error?: string }>("list-backoffice-accounts", {});
  if (!result?.ok) throw new Error(result?.error ?? "Impossible de charger les comptes bureau.");
  return result.accounts ?? [];
}

export async function generateBackofficeAccount(input: { email: string; displayName?: string; allowedSidebarGroups: string[] | null }) {
  const result = await invokeEdgeFunction<{ ok: boolean; accessUrl?: string; error?: string }>("generate-backoffice-account", {
    email: input.email,
    displayName: input.displayName ?? "",
    allowedSidebarGroups: input.allowedSidebarGroups,
  });
  if (!result?.ok) throw new Error(result?.error ?? "Impossible de créer le compte.");
  return result;
}

export async function setBackofficeAccountAllowedGroups(userId: string, allowedSidebarGroups: string[] | null): Promise<void> {
  const targetUserId = String(userId ?? "").trim();
  if (!targetUserId) throw new Error("Utilisateur cible manquant.");

  const { error } = await (supabase as any)
    .from("profiles")
    .update({ allowed_sidebar_groups: allowedSidebarGroups })
    .eq("id", targetUserId);

  if (error) throw new Error(error.message);
}
