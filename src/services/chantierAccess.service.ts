// src/services/chantierAccess.service.ts

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
 * On fait un fetch direct vers /functions/v1/..., avec apikey + Authorization Bearer <anonKey>
 * (fonctionne en local et en cloud).
 */
export async function checkAccessToken(token: string): Promise<AccessCheckResult> {
  const baseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

  if (!baseUrl || !anonKey) {
    throw new Error("Env manquante: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
  }

  const url = `${baseUrl.replace(/\/$/, "")}/functions/v1/${FUNCTION_NAME}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`, // ✅ public
    },
    // mark_used optionnel (à false par défaut côté function)
    body: JSON.stringify({ token, mark_used: false }),
  });

  const data = await res.json().catch(() => null);

  // la function renvoie toujours 200, mais on gère quand même le cas non-200
  if (!res.ok) {
    const detail =
      (data && (data.error || data.msg || data.detail)) || `HTTP ${res.status}`;
    throw new Error(`Edge Function error ${res.status}: ${detail}`);
  }

  if (!data?.ok) {
    throw new Error(data?.error || "Accès refusé.");
  }

  if (!data?.jwt || !data?.chantier_id) {
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
