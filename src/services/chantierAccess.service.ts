// src/services/chantierAccess.service.ts
import { supabase } from "../lib/supabaseClient";
export type AccessCheckResult = {
  ok: boolean;
  chantier_id: string;
  intervenant_id: string | null;
  access_role: string;
  jwt: string;
};

const FUNCTION_NAME = "chantier-access";

/**
 * ✅ Portail PUBLIC (pas de session)
 * Appel via supabase.functions.invoke avec anon key.
 */
export async function checkAccessToken(token: string): Promise<AccessCheckResult> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, mark_used: false }),
  });

  if (error) {
    throw new Error(error.message || "Erreur Edge Function.");
  }

  if (!(data as any)?.ok) {
    throw new Error((data as any)?.error || "Accès refusé.");
  }

  if (!(data as any)?.jwt || !(data as any)?.chantier_id) {
    throw new Error("Token invalide (jwt ou chantier_id manquant).");
  }

  return data as AccessCheckResult;
}

/**
 * ⚠️ Nettoyage :
 * Les fonctions ci-dessous utilisent l'ancienne table "chantier_intervenant_access"
 * Elles ne correspondent plus à ta V2 (table "chantier_access" + edge functions).
 * => On les garde en commenté pour ne pas casser si tu les utilisais ailleurs,
 * mais la bonne méthode admin est maintenant sendIntervenantAccess()
 * via chantierAccessAdmin.service.ts
 */

/*
// --- Ancien V1 (à supprimer si plus utilisé) ---

export async function createOrGetAccessLink(
  chantierId: string,
  intervenantId: string,
): Promise<{ token: string; url: string }> {
  const { data: existing, error: exErr } = await supabase
    .from("chantier_intervenant_access")
    .select("token, enabled")
    .eq("chantier_id", chantierId)
    .eq("intervenant_id", intervenantId)
    .maybeSingle();

  if (exErr) throw new Error(exErr.message);

  let token = existing?.token;

  if (!token) {
    const newToken = cryptoRandomToken(48);

    const { data: inserted, error: inErr } = await supabase
      .from("chantier_intervenant_access")
      .insert({
        chantier_id: chantierId,
        intervenant_id: intervenantId,
        token: newToken,
        role: "INTERVENANT",
        enabled: true,
      })
      .select("token")
      .single();

    if (inErr) throw new Error(inErr.message);
    token = inserted.token;
  } else if (existing?.enabled === false) {
    const { error: upErr } = await supabase
      .from("chantier_intervenant_access")
      .update({ enabled: true })
      .eq("chantier_id", chantierId)
      .eq("intervenant_id", intervenantId);

    if (upErr) throw new Error(upErr.message);
  }

  const url = `${window.location.origin}/acces/${token}`;
  return { token, url };
}

export async function disableAccessLink(chantierId: string, intervenantId: string) {
  const { error } = await supabase
    .from("chantier_intervenant_access")
    .update({ enabled: false })
    .eq("chantier_id", chantierId)
    .eq("intervenant_id", intervenantId);

  if (error) throw new Error(error.message);
}

export async function regenerateAccessLink(chantierId: string, intervenantId: string) {
  const newToken = cryptoRandomToken(48);

  const { data, error } = await supabase
    .from("chantier_intervenant_access")
    .update({ token: newToken, enabled: true })
    .eq("chantier_id", chantierId)
    .eq("intervenant_id", intervenantId)
    .select("token")
    .single();

  if (error) throw new Error(error.message);

  const url = `${window.location.origin}/acces/${data.token}`;
  return { token: data.token, url };
}

function cryptoRandomToken(byteLen: number) {
  const bytes = new Uint8Array(byteLen);
  crypto.getRandomValues(bytes);
  const bin = String.fromCharCode(...bytes);
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
*/
