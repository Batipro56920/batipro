// src/services/intervenants.service.ts
import { supabase } from "../lib/supabaseClient";

/* =========================================================
   TYPES
   ========================================================= */

export type IntervenantRow = {
  id: string;
  chantier_id: string | null;
  nom: string;
  email: string | null;
  telephone: string | null;
  created_at?: string | null;
};

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function normalizeOptionalEmail(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return trimmed || null;
}

function sortIntervenants(rows: IntervenantRow[]) {
  return [...rows].sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
}

async function getIntervenantById(id: string) {
  const { data, error } = await supabase
    .from("intervenants")
    .select("id, chantier_id, nom, email, telephone, created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as IntervenantRow | null;
}

async function getIntervenantByEmail(email: string) {
  const normalizedEmail = normalizeOptionalEmail(email);
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .from("intervenants")
    .select("id, chantier_id, nom, email, telephone, created_at")
    .filter("email", "ilike", normalizedEmail)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as IntervenantRow | null;
}

async function listLinkedIntervenantIdsByChantierId(chantierId: string) {
  const [chantierLinksRes, intervenantLinksRes] = await Promise.all([
    (supabase as any).from("chantier_intervenants").select("intervenant_id").eq("chantier_id", chantierId),
    (supabase as any).from("intervenant_chantiers").select("intervenant_id").eq("chantier_id", chantierId),
  ]);

  if (chantierLinksRes.error) throw chantierLinksRes.error;
  if (intervenantLinksRes.error) throw intervenantLinksRes.error;

  return Array.from(
    new Set(
      [...(chantierLinksRes.data ?? []), ...(intervenantLinksRes.data ?? [])]
        .map((row) => String((row as { intervenant_id?: string | null }).intervenant_id ?? ""))
        .filter(Boolean),
    ),
  );
}

async function isIntervenantAssignedToChantier(intervenantId: string, chantierId: string) {
  if (!intervenantId || !chantierId) return false;

  const [chantierLinkRes, intervenantLinkRes, legacyRes] = await Promise.all([
    supabase
      .from("chantier_intervenants" as any)
      .select("intervenant_id", { head: true, count: "exact" })
      .eq("chantier_id", chantierId)
      .eq("intervenant_id", intervenantId),
    supabase
      .from("intervenant_chantiers" as any)
      .select("intervenant_id", { head: true, count: "exact" })
      .eq("chantier_id", chantierId)
      .eq("intervenant_id", intervenantId),
    supabase
      .from("intervenants")
      .select("id", { head: true, count: "exact" })
      .eq("id", intervenantId)
      .eq("chantier_id", chantierId),
  ]);

  if (chantierLinkRes.error) throw chantierLinkRes.error;
  if (intervenantLinkRes.error) throw intervenantLinkRes.error;
  if (legacyRes.error) throw legacyRes.error;

  return Boolean(
    (chantierLinkRes.count ?? 0) > 0 ||
      (intervenantLinkRes.count ?? 0) > 0 ||
      (legacyRes.count ?? 0) > 0,
  );
}

async function ensureIntervenantLinkedToChantier(chantierId: string, intervenantId: string) {
  const [chantierLinkRes, intervenantLinkRes] = await Promise.all([
    (supabase as any)
      .from("chantier_intervenants")
      .upsert({ chantier_id: chantierId, intervenant_id: intervenantId }, { onConflict: "chantier_id,intervenant_id" }),
    (supabase as any)
      .from("intervenant_chantiers")
      .upsert({ chantier_id: chantierId, intervenant_id: intervenantId }, { onConflict: "intervenant_id,chantier_id" }),
  ]);

  if (chantierLinkRes.error) throw chantierLinkRes.error;
  if (intervenantLinkRes.error) throw intervenantLinkRes.error;
}

async function syncPrimaryChantierId(intervenantId: string, preferredChantierId?: string | null) {
  const nextPreferred = normalizeOptionalText(preferredChantierId);
  if (nextPreferred) {
    const { error } = await supabase
      .from("intervenants")
      .update({ chantier_id: nextPreferred })
      .eq("id", intervenantId)
      .or(`chantier_id.is.null,chantier_id.neq.${nextPreferred}`);
    if (error) throw error;
    return nextPreferred;
  }

  const [chantierLinksRes, intervenantLinksRes] = await Promise.all([
    (supabase as any).from("chantier_intervenants").select("chantier_id").eq("intervenant_id", intervenantId).limit(1),
    (supabase as any).from("intervenant_chantiers").select("chantier_id").eq("intervenant_id", intervenantId).limit(1),
  ]);

  if (chantierLinksRes.error) throw chantierLinksRes.error;
  if (intervenantLinksRes.error) throw intervenantLinksRes.error;

  const nextChantierId =
    normalizeOptionalText((chantierLinksRes.data?.[0] as { chantier_id?: string | null } | undefined)?.chantier_id) ??
    normalizeOptionalText((intervenantLinksRes.data?.[0] as { chantier_id?: string | null } | undefined)?.chantier_id);

  const { error } = await supabase
    .from("intervenants")
    .update({ chantier_id: nextChantierId })
    .eq("id", intervenantId);

  if (error) throw error;
  return nextChantierId;
}

/* =========================================================
   QUERIES
   ========================================================= */

export async function listIntervenantsByChantierId(chantierId: string) {
  if (!chantierId) throw new Error("chantierId manquant.");

  const [legacyRes, linkedIds] = await Promise.all([
    supabase
      .from("intervenants")
      .select("id, chantier_id, nom, email, telephone, created_at")
      .eq("chantier_id", chantierId),
    listLinkedIntervenantIdsByChantierId(chantierId),
  ]);

  if (legacyRes.error) throw legacyRes.error;

  const byId = new Map<string, IntervenantRow>();
  for (const row of (legacyRes.data ?? []) as IntervenantRow[]) {
    byId.set(row.id, { ...row, chantier_id: chantierId });
  }

  const missingIds = linkedIds.filter((intervenantId) => !byId.has(intervenantId));
  if (missingIds.length > 0) {
    const linkedRowsRes = await supabase
      .from("intervenants")
      .select("id, chantier_id, nom, email, telephone, created_at")
      .in("id", missingIds);

    if (linkedRowsRes.error) throw linkedRowsRes.error;

    for (const row of (linkedRowsRes.data ?? []) as IntervenantRow[]) {
      byId.set(row.id, { ...row, chantier_id: chantierId });
    }
  }

  return sortIntervenants(Array.from(byId.values()));
}

export async function listIntervenants() {
  const { data, error } = await supabase
    .from("intervenants")
    .select("id, chantier_id, nom, email, telephone, created_at")
    .order("nom", { ascending: true });

  if (error) throw error;
  return (data ?? []) as IntervenantRow[];
}

export async function attachIntervenantToChantier(input: { chantier_id: string; intervenant_id: string }) {
  const chantierId = input?.chantier_id;
  const intervenantId = input?.intervenant_id;

  if (!chantierId) throw new Error("chantier_id manquant.");
  if (!intervenantId) throw new Error("intervenant_id manquant.");

  const alreadyAssigned = await isIntervenantAssignedToChantier(intervenantId, chantierId);
  if (alreadyAssigned) {
    throw new Error("Cet intervenant est déjà affecté à ce chantier.");
  }

  await ensureIntervenantLinkedToChantier(chantierId, intervenantId);
  await syncPrimaryChantierId(intervenantId, chantierId);

  const row = await getIntervenantById(intervenantId);
  if (!row) throw new Error("Intervenant introuvable.");
  return { ...row, chantier_id: chantierId };
}

export async function createIntervenant(payload: {
  chantier_id: string;
  nom: string;
  email?: string | null;
  telephone?: string | null;
}) {
  const chantier_id = payload?.chantier_id;
  const nom = normalizeOptionalText(payload?.nom);
  const email = normalizeOptionalEmail(payload?.email);
  const telephone = normalizeOptionalText(payload?.telephone);

  if (!chantier_id) throw new Error("chantier_id manquant.");
  if (!nom) throw new Error("nom intervenant manquant.");

  if (email) {
    const existing = await getIntervenantByEmail(email);
    if (existing) {
      const alreadyAssigned = await isIntervenantAssignedToChantier(existing.id, chantier_id);
      if (alreadyAssigned) {
        throw new Error("Cet intervenant est déjà affecté à ce chantier.");
      }

      const patch: Partial<Pick<IntervenantRow, "nom" | "telephone">> = {};
      if (!normalizeOptionalText(existing.telephone) && telephone) patch.telephone = telephone;
      if (!normalizeOptionalText(existing.nom) && nom) patch.nom = nom;

      let current = existing;
      if (Object.keys(patch).length > 0) {
        current = await updateIntervenant(existing.id, patch);
      }

      await ensureIntervenantLinkedToChantier(chantier_id, current.id);
      await syncPrimaryChantierId(current.id, chantier_id);
      return { ...current, chantier_id };
    }
  }

  const { data, error } = await supabase
    .from("intervenants")
    .insert([
      {
        chantier_id,
        nom,
        email,
        telephone,
      },
    ])
    .select("id, chantier_id, nom, email, telephone, created_at")
    .single();

  if (error) {
    if (email && String((error as { code?: string }).code ?? "") === "23505") {
      const existing = await getIntervenantByEmail(email);
      if (existing) {
        const alreadyAssigned = await isIntervenantAssignedToChantier(existing.id, chantier_id);
        if (alreadyAssigned) {
          throw new Error("Cet intervenant est déjà affecté à ce chantier.");
        }
        await ensureIntervenantLinkedToChantier(chantier_id, existing.id);
        await syncPrimaryChantierId(existing.id, chantier_id);
        return { ...existing, chantier_id };
      }
    }
    throw error;
  }

  const created = data as IntervenantRow;
  await ensureIntervenantLinkedToChantier(chantier_id, created.id);
  return created;
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
    throw new Error("Le nom de l’intervenant est obligatoire.");
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

export async function deleteIntervenant(id: string, chantierId?: string) {
  if (!id) throw new Error("id intervenant manquant.");

  if (chantierId) {
    const [chantierLinkDeleteRes, intervenantLinkDeleteRes] = await Promise.all([
      (supabase as any).from("chantier_intervenants").delete().eq("chantier_id", chantierId).eq("intervenant_id", id),
      (supabase as any).from("intervenant_chantiers").delete().eq("chantier_id", chantierId).eq("intervenant_id", id),
    ]);

    if (chantierLinkDeleteRes.error) throw chantierLinkDeleteRes.error;
    if (intervenantLinkDeleteRes.error) throw intervenantLinkDeleteRes.error;

    await syncPrimaryChantierId(id, null);
    return;
  }

  const { error } = await supabase.from("intervenants").delete().eq("id", id);
  if (error) throw error;
}

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
    console.error(`Erreur fonction ${name}`, error);
    const msg = (error as any)?.message ?? String(error);
    if (String(msg).includes("401") || String(msg).toLowerCase().includes("unauthorized")) {
      throw new Error("Accès refusé (401). Reconnecte-toi puis réessaie.");
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




