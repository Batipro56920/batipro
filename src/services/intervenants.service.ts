import { supabase } from "../lib/supabaseClient";

export type IntervenantStatus = "employee" | "subcontractor" | "temporary_worker" | "partner" | "other";

export type IntervenantRow = {
  id: string;
  chantier_id: string | null;
  nom: string;
  entreprise: string | null;
  metier: string | null;
  email: string | null;
  telephone: string | null;
  notes: string | null;
  user_id: string | null;
  invitation_last_sent_at?: string | null;
  archived_at?: string | null;
  status?: IntervenantStatus;
  job_title?: string | null;
  hourly_cost_ht?: number | null;
  hourly_sale_price_ht?: number | null;
  entry_date?: string | null;
  is_active?: boolean | null;
  subcontractor_company?: string | null;
  specialty?: string | null;
  daily_rate_ht?: number | null;
  insurance?: string | null;
  legal_documents?: unknown[] | null;
  created_at?: string | null;
};

export type IntervenantInvitationPreview = {
  intervenantId: string;
  email: string;
  expiresAt: string | null;
  alreadyLinked: boolean;
  intervenant: {
    id: string;
    nom: string | null;
    email: string | null;
    telephone: string | null;
    entreprise: string | null;
    metier: string | null;
    notes: string | null;
  };
};

const INTERVENANT_SELECT =
  "id, chantier_id, nom, entreprise, metier, email, telephone, notes, user_id, invitation_last_sent_at, archived_at, created_at";
const INTERVENANT_SELECT_V2 =
  "id, chantier_id, nom, entreprise, metier, email, telephone, notes, user_id, invitation_last_sent_at, archived_at, status, job_title, hourly_cost_ht, hourly_sale_price_ht, entry_date, is_active, subcontractor_company, specialty, daily_rate_ht, insurance, legal_documents, created_at";

let supportsBusinessColumns: boolean | null = null;

function normalizeOptionalText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function normalizeOptionalEmail(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim().toLowerCase();
  return trimmed || null;
}

function normalizeOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeIntervenantStatus(value: unknown): IntervenantStatus {
  const raw = String(value ?? "").trim();
  if (raw === "employee" || raw === "subcontractor" || raw === "temporary_worker" || raw === "partner" || raw === "other") {
    return raw;
  }
  return "subcontractor";
}

function getIntervenantSelect() {
  return supportsBusinessColumns === false ? INTERVENANT_SELECT : INTERVENANT_SELECT_V2;
}

function normalizeIntervenantRow(row: any): IntervenantRow {
  return {
    ...(row as IntervenantRow),
    status: normalizeIntervenantStatus(row?.status),
    hourly_cost_ht: normalizeOptionalNumber(row?.hourly_cost_ht),
    hourly_sale_price_ht: normalizeOptionalNumber(row?.hourly_sale_price_ht),
    daily_rate_ht: normalizeOptionalNumber(row?.daily_rate_ht),
    is_active: row?.is_active === false ? false : true,
    legal_documents: Array.isArray(row?.legal_documents) ? row.legal_documents : [],
  };
}

function sortIntervenants(rows: IntervenantRow[]) {
  return [...rows].sort((a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" }));
}

function sanitizeIntervenantPayload<T extends Record<string, unknown>>(input: T) {
  const payload = { ...input } as Record<string, unknown>;

  if ("nom" in payload) payload.nom = normalizeOptionalText(payload.nom as string | null | undefined);
  if ("entreprise" in payload) payload.entreprise = normalizeOptionalText(payload.entreprise as string | null | undefined);
  if ("metier" in payload) payload.metier = normalizeOptionalText(payload.metier as string | null | undefined);
  if ("email" in payload) payload.email = normalizeOptionalEmail(payload.email as string | null | undefined);
  if ("telephone" in payload) payload.telephone = normalizeOptionalText(payload.telephone as string | null | undefined);
  if ("notes" in payload) payload.notes = normalizeOptionalText(payload.notes as string | null | undefined);
  if ("chantier_id" in payload) payload.chantier_id = normalizeOptionalText(payload.chantier_id as string | null | undefined);
  if ("status" in payload) payload.status = normalizeIntervenantStatus(payload.status);
  if ("job_title" in payload) payload.job_title = normalizeOptionalText(payload.job_title as string | null | undefined);
  if ("hourly_cost_ht" in payload) payload.hourly_cost_ht = normalizeOptionalNumber(payload.hourly_cost_ht);
  if ("hourly_sale_price_ht" in payload) payload.hourly_sale_price_ht = normalizeOptionalNumber(payload.hourly_sale_price_ht);
  if ("entry_date" in payload) payload.entry_date = normalizeOptionalText(payload.entry_date as string | null | undefined);
  if ("is_active" in payload) payload.is_active = payload.is_active !== false;
  if ("subcontractor_company" in payload) {
    payload.subcontractor_company = normalizeOptionalText(payload.subcontractor_company as string | null | undefined);
  }
  if ("specialty" in payload) payload.specialty = normalizeOptionalText(payload.specialty as string | null | undefined);
  if ("daily_rate_ht" in payload) payload.daily_rate_ht = normalizeOptionalNumber(payload.daily_rate_ht);
  if ("insurance" in payload) payload.insurance = normalizeOptionalText(payload.insurance as string | null | undefined);

  return payload;
}

async function getIntervenantById(id: string) {
  const { data, error } = await supabase
    .from("intervenants")
    .select(getIntervenantSelect())
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeIntervenantRow(data) : null;
}

export async function getIntervenant(id: string) {
  if (!id) throw new Error("id intervenant manquant.");
  const row = await getIntervenantById(id);
  if (!row) throw new Error("Intervenant introuvable.");
  return row;
}

async function getIntervenantByEmail(email: string) {
  const normalizedEmail = normalizeOptionalEmail(email);
  if (!normalizedEmail) return null;

  const { data, error } = await supabase
    .from("intervenants")
    .select(getIntervenantSelect())
    .filter("email", "ilike", normalizedEmail)
    .maybeSingle();

  if (error) throw error;
  return data ? normalizeIntervenantRow(data) : null;
}

async function listLinkedIntervenantIdsByChantierId(chantierId: string) {
  const chantierLinksRes = await (supabase as any)
    .from("chantier_intervenants")
    .select("intervenant_id")
    .eq("chantier_id", chantierId);

  if (chantierLinksRes.error) throw chantierLinksRes.error;

  return Array.from(
    new Set(
      [...(chantierLinksRes.data ?? [])]
        .map((row) => String((row as { intervenant_id?: string | null }).intervenant_id ?? ""))
        .filter(Boolean),
    ),
  );
}

async function isIntervenantAssignedToChantier(intervenantId: string, chantierId: string) {
  if (!intervenantId || !chantierId) return false;

  const [chantierLinkRes, legacyRes] = await Promise.all([
    supabase
      .from("chantier_intervenants" as any)
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
  if (legacyRes.error) throw legacyRes.error;

  return Boolean((chantierLinkRes.count ?? 0) > 0 || (legacyRes.count ?? 0) > 0);
}

async function ensureIntervenantLinkedToChantier(chantierId: string, intervenantId: string) {
  const chantierLinkRes = await (supabase as any)
    .from("chantier_intervenants")
    .upsert({ chantier_id: chantierId, intervenant_id: intervenantId }, { onConflict: "chantier_id,intervenant_id" });

  if (chantierLinkRes.error) throw chantierLinkRes.error;
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

  const chantierLinksRes = await (supabase as any)
    .from("chantier_intervenants")
    .select("chantier_id")
    .eq("intervenant_id", intervenantId)
    .limit(1);

  if (chantierLinksRes.error) throw chantierLinksRes.error;

  const nextChantierId = normalizeOptionalText(
    (chantierLinksRes.data?.[0] as { chantier_id?: string | null } | undefined)?.chantier_id,
  );

  const { error } = await supabase
    .from("intervenants")
    .update({ chantier_id: nextChantierId })
    .eq("id", intervenantId);

  if (error) throw error;
  return nextChantierId;
}

export async function listIntervenantsByChantierId(chantierId: string) {
  if (!chantierId) throw new Error("chantierId manquant.");

  const [legacyRes, linkedIds] = await Promise.all([
    supabase
      .from("intervenants")
      .select(getIntervenantSelect())
      .eq("chantier_id", chantierId),
    listLinkedIntervenantIdsByChantierId(chantierId),
  ]);

  if (legacyRes.error) throw legacyRes.error;

  const byId = new Map<string, IntervenantRow>();
  for (const row of (legacyRes.data ?? [])) {
    const normalized = normalizeIntervenantRow(row);
    byId.set(normalized.id, { ...normalized, chantier_id: chantierId });
  }

  const missingIds = linkedIds.filter((intervenantId) => !byId.has(intervenantId));
  if (missingIds.length > 0) {
    const linkedRowsRes = await supabase
      .from("intervenants")
      .select(getIntervenantSelect())
      .in("id", missingIds);

    if (linkedRowsRes.error) throw linkedRowsRes.error;

    for (const row of (linkedRowsRes.data ?? [])) {
      const normalized = normalizeIntervenantRow(row);
      byId.set(normalized.id, { ...normalized, chantier_id: chantierId });
    }
  }

  return sortIntervenants(Array.from(byId.values()));
}

export async function listIntervenants() {
  const { data, error } = await supabase
    .from("intervenants")
    .select(getIntervenantSelect())
    .order("nom", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(normalizeIntervenantRow);
}

export async function listIntervenantChantierLinks(intervenantId?: string) {
  let query = (supabase as any).from("chantier_intervenants").select("intervenant_id, chantier_id, created_at");
  if (intervenantId) query = query.eq("intervenant_id", intervenantId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Array<{ intervenant_id: string; chantier_id: string; created_at?: string | null }>;
}

export async function attachIntervenantToChantier(input: { chantier_id: string; intervenant_id: string }) {
  const chantierId = input?.chantier_id;
  const intervenantId = input?.intervenant_id;

  if (!chantierId) throw new Error("chantier_id manquant.");
  if (!intervenantId) throw new Error("intervenant_id manquant.");

  const alreadyAssigned = await isIntervenantAssignedToChantier(intervenantId, chantierId);
  if (alreadyAssigned) {
    throw new Error("Cet intervenant est deja affecte a ce chantier.");
  }

  await ensureIntervenantLinkedToChantier(chantierId, intervenantId);
  await syncPrimaryChantierId(intervenantId, chantierId);

  const row = await getIntervenantById(intervenantId);
  if (!row) throw new Error("Intervenant introuvable.");
  return { ...row, chantier_id: chantierId };
}

export async function createIntervenant(payload: {
  chantier_id?: string | null;
  nom: string;
  entreprise?: string | null;
  metier?: string | null;
  email?: string | null;
  telephone?: string | null;
  notes?: string | null;
  status?: IntervenantStatus;
  job_title?: string | null;
  hourly_cost_ht?: number | string | null;
  hourly_sale_price_ht?: number | string | null;
  entry_date?: string | null;
  is_active?: boolean | null;
  subcontractor_company?: string | null;
  specialty?: string | null;
  daily_rate_ht?: number | string | null;
  insurance?: string | null;
}) {
  const cleaned = sanitizeIntervenantPayload(payload);
  const chantierId = normalizeOptionalText(cleaned.chantier_id as string | null | undefined);
  const nom = normalizeOptionalText(cleaned.nom as string | null | undefined);
  const entreprise = normalizeOptionalText(cleaned.entreprise as string | null | undefined);
  const metier = normalizeOptionalText(cleaned.metier as string | null | undefined);
  const email = normalizeOptionalEmail(cleaned.email as string | null | undefined);
  const telephone = normalizeOptionalText(cleaned.telephone as string | null | undefined);
  const notes = normalizeOptionalText(cleaned.notes as string | null | undefined);

  if (!nom) throw new Error("nom intervenant manquant.");

  if (email) {
    const existing = await getIntervenantByEmail(email);
    if (existing) {
      if (!chantierId) {
        throw new Error("Un intervenant avec cet email existe deja.");
      }

      const alreadyAssigned = await isIntervenantAssignedToChantier(existing.id, chantierId);
      if (alreadyAssigned) {
        throw new Error("Cet intervenant est deja affecte a ce chantier.");
      }

      const patch: Partial<
        Pick<IntervenantRow, "nom" | "entreprise" | "metier" | "telephone" | "notes">
      > = {};
      if (!normalizeOptionalText(existing.nom) && nom) patch.nom = nom;
      if (!normalizeOptionalText(existing.entreprise) && entreprise) patch.entreprise = entreprise;
      if (!normalizeOptionalText(existing.metier) && metier) patch.metier = metier;
      if (!normalizeOptionalText(existing.telephone) && telephone) patch.telephone = telephone;
      if (!normalizeOptionalText(existing.notes) && notes) patch.notes = notes;

      let current = existing;
      if (Object.keys(patch).length > 0) {
        current = await updateIntervenant(existing.id, patch);
      }

      await ensureIntervenantLinkedToChantier(chantierId, current.id);
      await syncPrimaryChantierId(current.id, chantierId);
      return { ...current, chantier_id: chantierId };
    }
  }

  const insertPayload = {
    chantier_id: chantierId,
    nom,
    entreprise,
    metier,
    email,
    telephone,
    notes,
    status: normalizeIntervenantStatus(cleaned.status),
    job_title: cleaned.job_title ?? null,
    hourly_cost_ht: cleaned.hourly_cost_ht ?? null,
    hourly_sale_price_ht: cleaned.hourly_sale_price_ht ?? null,
    entry_date: cleaned.entry_date ?? null,
    is_active: cleaned.is_active !== false,
    subcontractor_company: cleaned.subcontractor_company ?? null,
    specialty: cleaned.specialty ?? null,
    daily_rate_ht: cleaned.daily_rate_ht ?? null,
    insurance: cleaned.insurance ?? null,
  };

  const { data, error } = await supabase
    .from("intervenants")
    .insert([insertPayload])
    .select(getIntervenantSelect())
    .single();

  if (error) {
    if (email && String((error as { code?: string }).code ?? "") === "23505") {
      throw new Error("Un intervenant avec cet email existe deja.");
    }
    throw error;
  }

  const created = normalizeIntervenantRow(data);

  if (chantierId) {
    await ensureIntervenantLinkedToChantier(chantierId, created.id);
    await syncPrimaryChantierId(created.id, chantierId);
    return { ...created, chantier_id: chantierId };
  }

  return created;
}

export async function updateIntervenant(
  id: string,
  patch: Record<string, unknown>,
) {
  if (!id) throw new Error("id intervenant manquant.");

  const cleaned = sanitizeIntervenantPayload(patch);
  if (cleaned.nom !== undefined && !cleaned.nom) {
    throw new Error("Le nom de l'intervenant est obligatoire.");
  }

  const { data, error } = await supabase
    .from("intervenants")
    .update(cleaned)
    .eq("id", id)
    .select(getIntervenantSelect())
    .single();

  if (error) throw error;
  return normalizeIntervenantRow(data);
}

export async function archiveIntervenant(id: string) {
  return updateIntervenant(id, { archived_at: new Date().toISOString() });
}

export async function restoreIntervenant(id: string) {
  return updateIntervenant(id, { archived_at: null });
}

export async function deleteIntervenant(id: string, chantierId?: string) {
  if (!id) throw new Error("id intervenant manquant.");

  if (chantierId) {
    const chantierLinkDeleteRes = await (supabase as any)
      .from("chantier_intervenants")
      .delete()
      .eq("chantier_id", chantierId)
      .eq("intervenant_id", id);

    if (chantierLinkDeleteRes.error) throw chantierLinkDeleteRes.error;

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
    throw new Error("Pas connecte : session manquante. Reconnecte-toi puis reessaie.");
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (!expiresAtMs || expiresAtMs < Date.now() + 60_000) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr || !refreshed.session) {
      throw new Error("Session expiree. Reconnecte-toi puis reessaie.");
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
      throw new Error("Acces refuse (401). Reconnecte-toi puis reessaie.");
    }
    throw error;
  }

  return data as T;
}

async function invokePublicFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (error) throw error;
  return data as T;
}

export async function generateIntervenantInvitation(intervenantId: string) {
  if (!intervenantId) throw new Error("intervenantId manquant.");
  return invokeEdgeFunction<Record<string, unknown>>("generate-intervenant-link", { intervenantId });
}

export async function previewIntervenantInvitation(token: string): Promise<IntervenantInvitationPreview> {
  if (!token) throw new Error("token manquant.");
  const data = await invokePublicFunction<{ invitation: IntervenantInvitationPreview }>(
    "redeem-intervenant-invitation",
    { mode: "preview", token },
  );
  return data.invitation;
}

export async function redeemIntervenantInvitation(input: { token: string; password: string }) {
  if (!input?.token) throw new Error("token manquant.");
  if (!input?.password) throw new Error("mot de passe manquant.");
  return invokePublicFunction<Record<string, unknown>>("redeem-intervenant-invitation", {
    mode: "redeem",
    token: input.token,
    password: input.password,
  });
}
