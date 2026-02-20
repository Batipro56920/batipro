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
 * ? Portail PUBLIC (pas de session)
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

