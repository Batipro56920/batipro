// src/services/intervenants.service.ts
import { supabase } from "../lib/supabaseClient";

/* =========================================================
   TYPES
   ========================================================= */

export type IntervenantRow = {
  id: string;
  chantier_id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  created_at?: string | null;
};

/* =========================================================
   QUERIES
   ========================================================= */

export async function listIntervenantsByChantierId(chantierId: string) {
  if (!chantierId) throw new Error("chantierId manquant.");

  const { data, error } = await supabase
    .from("intervenants")
    .select("id, chantier_id, nom, email, telephone, created_at")
    .eq("chantier_id", chantierId)
    .order("nom", { ascending: true });

  if (error) throw error;
  return (data ?? []) as IntervenantRow[];
}

export async function createIntervenant(payload: {
  chantier_id: string;
  nom: string;
  email?: string | null;
  telephone?: string | null;
}) {
  const chantier_id = payload?.chantier_id;
  const nom = (payload?.nom ?? "").trim();

  if (!chantier_id) throw new Error("chantier_id manquant.");
  if (!nom) throw new Error("nom intervenant manquant.");

  const { data, error } = await supabase
    .from("intervenants")
    .insert([
      {
        chantier_id,
        nom,
        email: payload.email ?? null,
        telephone: payload.telephone ?? null,
      },
    ])
    .select("id, chantier_id, nom, email, telephone, created_at")
    .single();

  if (error) throw error;
  return data as IntervenantRow;
}

export async function updateIntervenant(
  id: string,
  patch: Partial<Pick<IntervenantRow, "nom" | "email" | "telephone">>,
) {
  if (!id) throw new Error("id intervenant manquant.");

  const cleaned: any = { ...patch };
  if (typeof cleaned.nom === "string") cleaned.nom = cleaned.nom.trim();
  if (cleaned.email === "") cleaned.email = null;
  if (cleaned.telephone === "") cleaned.telephone = null;

  if (cleaned.nom !== undefined && !cleaned.nom) {
    throw new Error("Le nom de lâ€™intervenant est obligatoire.");
  }

  const { data, error } = await supabase
    .from("intervenants")
    .update(cleaned)
    .eq("id", id)
    .select("id, chantier_id, nom, email, telephone, created_at")
    .single();

  if (error) throw error;
  return data as IntervenantRow;
}

export async function deleteIntervenant(id: string) {
  if (!id) throw new Error("id intervenant manquant.");
  const { error } = await supabase.from("intervenants").delete().eq("id", id);
  if (error) throw error;
}

async function ensureSession(): Promise<string> {
  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr) throw sessionErr;

  let session = sessionData.session;
  if (!session) {
    throw new Error("Pas connectÃƒÂ© : session manquante. Reconnecte-toi puis rÃƒÂ©essaie.");
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (!expiresAtMs || expiresAtMs < Date.now() + 60_000) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshed.session) {
      throw new Error("Session expirÃƒÂ©e. Reconnecte-toi puis rÃƒÂ©essaie.");
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
    console.error(`Erreur fonction ${name}`, error);
    const msg = (error as any)?.message ?? String(error);
    if (String(msg).includes("401") || String(msg).toLowerCase().includes("unauthorized")) {
      throw new Error("AccÃ¨s refusÃ© (401). Reconnecte-toi puis rÃ©essaie.");
    }
    throw error;
  }

  return data as T;
}

export async function generateIntervenantLink(intervenantId: string) {
  if (!intervenantId) throw new Error("intervenantId manquant.");
  return invokeEdgeFunction<Record<string, unknown>>("generate-intervenant-link", { intervenantId });
}

export async function linkIntervenantUser(input: { token_access: string }) {
  if (!input?.token_access) throw new Error("token_access manquant.");
  return invokeEdgeFunction<Record<string, unknown>>("link-intervenant-user", input);
}

