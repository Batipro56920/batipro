import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Portail sous-traitant : documents obligatoires, devis et factures.
 *
 * Le sous-traitant n'a aucun droit direct sur les tables ni sur le stockage.
 * Son identité est établie par subcontractor_portal_identity, avec les mêmes
 * règles que le portail terrain (compte connecté ou lien d'accès), puis tout se
 * fait ici avec la clé de service, borné à ce qui lui appartient.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, Authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "subcontractor-files";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const DOCUMENT_KINDS = new Set(["urssaf_vigilance", "kbis", "decennale", "rc_pro", "autre"]);
const INVOICE_KINDS = new Set(["devis", "facture", "situation"]);

type Identity = {
  intervenant_id: string;
  nom: string | null;
  status: string;
  company: string | null;
  email: string | null;
  chantier_ids: string[];
};

class PortalError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name) ?? "";
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function text(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function optionalDate(value: unknown): string | null {
  const raw = text(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function optionalAmount(value: unknown): number | null {
  const raw = text(value).replace(/\s/g, "").replace(",", ".");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed * 100) / 100 : null;
}

function sanitizeFileName(name: string) {
  const base = text(name) || "document";
  const noAccents = base.normalize("NFD").replace(/[̀-ͯ]/g, "");
  const safe = noAccents.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9._-]/g, "");
  return (safe.replace(/^_+|_+$/g, "") || "document").slice(0, 120);
}

/**
 * Qui est le sous-traitant. Le client porteur de l'en-tête d'origine laisse la
 * fonction SQL trancher : jeton d'accès valide, ou utilisateur connecté relié à
 * une fiche intervenant.
 */
async function resolveIdentity(req: Request, token: string): Promise<Identity> {
  const authHeader = text(req.headers.get("authorization") ?? req.headers.get("Authorization"));
  if (!authHeader) throw new PortalError("Session expirée : reconnecte-toi au portail.", 401);

  const caller = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await caller.rpc("subcontractor_portal_identity", { p_token: token || null });
  if (error) {
    const message = text(error.message);
    if (message.includes("invalid_or_expired_token")) {
      // Sans lien d'accès, c'est la session qui manque, pas un lien expiré.
      throw new PortalError(
        token ? "Ton lien d'accès a expiré. Demande-en un nouveau à CB Rénovation." : "Session expirée : reconnecte-toi au portail.",
        401,
      );
    }
    throw new PortalError("Accès au portail refusé.", 403);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.intervenant_id) throw new PortalError("Accès au portail refusé.", 403);
  if (text(row.status) !== "subcontractor") {
    throw new PortalError("Cet espace est réservé aux sous-traitants.", 403);
  }
  return {
    intervenant_id: String(row.intervenant_id),
    nom: row.nom ?? null,
    status: text(row.status),
    company: row.company ?? null,
    email: row.email ?? null,
    chantier_ids: Array.isArray(row.chantier_ids) ? row.chantier_ids.map(String) : [],
  };
}

async function signedUrl(admin: any, path: string): Promise<string | null> {
  const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  return data?.signedUrl ?? null;
}

async function listAll(admin: any, identity: Identity) {
  const [documents, invoices, chantiers] = await Promise.all([
    admin
      .from("subcontractor_documents")
      .select("id, kind, label, file_name, mime_type, size_bytes, storage_path, valid_until, status, review_note, reviewed_at, created_at")
      .eq("intervenant_id", identity.intervenant_id)
      .order("created_at", { ascending: false }),
    admin
      .from("subcontractor_invoices")
      .select("id, chantier_id, kind, reference, amount_ht, issued_on, file_name, mime_type, size_bytes, storage_path, status, review_note, reviewed_at, paid_at, created_at")
      .eq("intervenant_id", identity.intervenant_id)
      .order("created_at", { ascending: false }),
    identity.chantier_ids.length
      ? admin.from("chantiers").select("id, nom").in("id", identity.chantier_ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (documents.error) throw new PortalError(documents.error.message);
  if (invoices.error) throw new PortalError(invoices.error.message);
  if (chantiers.error) throw new PortalError(chantiers.error.message);

  const withUrl = async (rows: any[]) =>
    Promise.all(
      rows.map(async ({ storage_path, ...rest }) => ({ ...rest, url: await signedUrl(admin, storage_path) })),
    );

  return {
    identity: {
      intervenant_id: identity.intervenant_id,
      nom: identity.nom,
      company: identity.company,
      email: identity.email,
    },
    chantiers: (chantiers.data ?? []).map((row: any) => ({ id: String(row.id), nom: String(row.nom ?? "Chantier") })),
    documents: await withUrl(documents.data ?? []),
    invoices: await withUrl(invoices.data ?? []),
  };
}

async function storeFile(admin: any, identity: Identity, folder: string, file: File) {
  if (!file || !file.size) throw new PortalError("Le fichier est vide.");
  if (file.size > MAX_UPLOAD_BYTES) throw new PortalError("Fichier trop lourd : 20 Mo maximum.");
  const contentType = text(file.type).toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw new PortalError("Format non accepté : dépose un PDF ou une photo (JPEG, PNG).");
  }
  const path = `${identity.intervenant_id}/${folder}/${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const { error } = await admin.storage.from(BUCKET).upload(path, file, { contentType, upsert: false });
  if (error) throw new PortalError(`Dépôt du fichier impossible : ${error.message}`);
  return { path, contentType };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Méthode non supportée." }, 405);

  try {
    const admin = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
    const contentType = text(req.headers.get("content-type")).toLowerCase();

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const action = text(form.get("action"));
      const identity = await resolveIdentity(req, text(form.get("token")));
      const file = form.get("file");
      if (!(file instanceof File)) throw new PortalError("Aucun fichier reçu.");

      if (action === "upload_document") {
        const kind = text(form.get("kind"));
        if (!DOCUMENT_KINDS.has(kind)) throw new PortalError("Type de document inconnu.");
        const { path, contentType: mime } = await storeFile(admin, identity, `documents/${kind}`, file);
        const { error } = await admin.from("subcontractor_documents").insert({
          intervenant_id: identity.intervenant_id,
          kind,
          label: text(form.get("label")) || null,
          file_name: file.name || "document",
          mime_type: mime,
          size_bytes: file.size,
          storage_path: path,
          valid_until: optionalDate(form.get("valid_until")),
        });
        if (error) {
          await admin.storage.from(BUCKET).remove([path]);
          throw new PortalError(error.message);
        }
        return json(await listAll(admin, identity));
      }

      if (action === "upload_invoice") {
        const kind = text(form.get("kind"));
        if (!INVOICE_KINDS.has(kind)) throw new PortalError("Type de pièce inconnu.");
        const chantierId = text(form.get("chantier_id")) || null;
        // Un sous-traitant ne facture que sur un chantier qui lui est affecté.
        if (chantierId && !identity.chantier_ids.includes(chantierId)) {
          throw new PortalError("Ce chantier ne fait pas partie de ceux qui te sont affectés.", 403);
        }
        const { path, contentType: mime } = await storeFile(admin, identity, `pieces/${kind}`, file);
        const { error } = await admin.from("subcontractor_invoices").insert({
          intervenant_id: identity.intervenant_id,
          chantier_id: chantierId,
          kind,
          reference: text(form.get("reference")) || null,
          amount_ht: optionalAmount(form.get("amount_ht")),
          issued_on: optionalDate(form.get("issued_on")),
          file_name: file.name || "document",
          mime_type: mime,
          size_bytes: file.size,
          storage_path: path,
        });
        if (error) {
          await admin.storage.from(BUCKET).remove([path]);
          throw new PortalError(error.message);
        }
        return json(await listAll(admin, identity));
      }

      throw new PortalError("Action inconnue.");
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = text(body.action);
    const identity = await resolveIdentity(req, text(body.token));

    if (action === "list") return json(await listAll(admin, identity));

    if (action === "delete") {
      const target = text(body.target);
      const id = text(body.id);
      const table = target === "document" ? "subcontractor_documents" : target === "invoice" ? "subcontractor_invoices" : "";
      if (!table || !id) throw new PortalError("Suppression incomplète.");
      const { data: row, error: readError } = await admin
        .from(table)
        .select("id, intervenant_id, status, storage_path")
        .eq("id", id)
        .maybeSingle();
      if (readError) throw new PortalError(readError.message);
      if (!row || String(row.intervenant_id) !== identity.intervenant_id) throw new PortalError("Pièce introuvable.", 404);
      // Une pièce examinée par le bureau fait foi : on ne la retire plus d'ici.
      if (row.status !== "soumis") throw new PortalError("Cette pièce a déjà été examinée par CB Rénovation : elle ne peut plus être retirée.");
      const { error: deleteError } = await admin.from(table).delete().eq("id", id);
      if (deleteError) throw new PortalError(deleteError.message);
      await admin.storage.from(BUCKET).remove([String(row.storage_path)]);
      return json(await listAll(admin, identity));
    }

    throw new PortalError("Action inconnue.");
  } catch (error) {
    if (error instanceof PortalError) return json({ error: error.message }, error.status);
    return json({ error: error instanceof Error ? error.message : "Portail sous-traitant indisponible." }, 500);
  }
});
