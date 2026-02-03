// src/services/chantierAccessAdmin.service.ts
import { supabase } from "../lib/supabaseClient";

export type SendIntervenantAccessInput = {
  chantierId: string;
  intervenantId?: string;
  email?: string;
  nom?: string;
  role?: "intervenant" | "client";
  expiresInDays?: number;
};

export type SendIntervenantAccessResult = {
  token: string;
  accessUrl: string;
  accessId?: string;
  chantierId?: string;
  expiresAt?: string;
};

export async function sendIntervenantAccess(
  input: SendIntervenantAccessInput
): Promise<SendIntervenantAccessResult> {
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

  // invoke + headers
  const { data, error } = await supabase.functions.invoke("chantier-access-admin", {
    body: input,
  });

  if (error) {
    console.error("Edge function error:", error);
    throw error;
  }

  const token = (data as any)?.token;
  const accessUrl = (data as any)?.accessUrl;

  if (!token || !accessUrl) {
    console.error("Invalid function response:", data);
    throw new Error("Réponse Edge Function invalide : attendu { token, accessUrl }.");
  }

  return {
    token,
    accessUrl,
    accessId: (data as any)?.accessId,
    chantierId: (data as any)?.chantierId,
    expiresAt: (data as any)?.expiresAt,
  };
}
