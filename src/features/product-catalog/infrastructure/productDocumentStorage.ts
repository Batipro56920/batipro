import { supabase } from "../../../lib/supabaseClient";

export const PRODUCT_DOCUMENTS_BUCKET = "product-documents";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/**
 * Une fiche produit stockee est referencee par son chemin Supabase, pas par une
 * URL signee : les URLs signees expirent, le chemin non. `resolveProductDocumentUrl`
 * fabrique l'URL au moment de l'ouverture.
 */
export function isStoredProductDocumentPath(url: string | null | undefined): boolean {
  const value = String(url ?? "").trim();
  if (!value) return false;
  if (/^https?:\/\//i.test(value)) return false;
  return value.includes("/");
}

function sanitizeFileName(name: string): string {
  const trimmed = String(name ?? "").trim().replace(/\\/g, "/").split("/").pop() ?? "";
  const normalized = trimmed
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  return normalized.slice(0, 120);
}

function formatUploadError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("bucket") && normalized.includes("not found")) {
    return `Bucket Supabase introuvable (${PRODUCT_DOCUMENTS_BUCKET}). Appliquez la migration de stockage des fiches produits.`;
  }
  if (normalized.includes("row-level security") || normalized.includes("policy")) {
    return "Import refuse par les droits Supabase Storage sur les fiches produits.";
  }
  if (normalized.includes("mime") || normalized.includes("content type")) {
    return "Type de fichier refuse par le bucket des fiches produits.";
  }
  return message || "Impossible d'enregistrer la fiche produit.";
}

/**
 * Depose le fichier dans le bucket des fiches produits et renvoie son chemin de
 * stockage, a placer dans ProductDocument.url.
 */
export async function uploadProductDocumentFile(input: {
  productId: string;
  documentId: string;
  file: File;
}): Promise<string> {
  const { productId, documentId, file } = input;
  if (!file) throw new Error("Fichier manquant.");
  if (!Number.isFinite(file.size) || file.size <= 0) throw new Error("Fichier vide ou invalide.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("Fichier trop volumineux (max 20 Mo).");

  const safeName = sanitizeFileName(file.name) || `${documentId}.bin`;
  // En import de lot le produit n existe pas encore : l identifiant du document
  // suffit a rendre le chemin unique.
  const storagePath = `${productId || "catalogue"}/${documentId}/${safeName}`;

  const { error } = await supabase.storage.from(PRODUCT_DOCUMENTS_BUCKET).upload(storagePath, file, {
    upsert: true,
    contentType: file.type || undefined,
  });
  if (error) throw new Error(formatUploadError(error.message));
  return storagePath;
}

export async function getProductDocumentSignedUrl(storagePath: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(PRODUCT_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(error.message);
  if (!data?.signedUrl) throw new Error("URL de fiche produit indisponible.");
  return data.signedUrl;
}

/**
 * Ouvre indifferemment un lien fournisseur externe ou une piece stockee.
 */
export async function resolveProductDocumentUrl(url: string | null | undefined): Promise<string | null> {
  const value = String(url ?? "").trim();
  if (!value) return null;
  if (!isStoredProductDocumentPath(value)) return value;
  return getProductDocumentSignedUrl(value);
}

export async function downloadProductDocument(storagePath: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(PRODUCT_DOCUMENTS_BUCKET).download(storagePath);
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Fiche produit introuvable dans le stockage.");
  return data;
}

export async function removeProductDocumentFile(storagePath: string): Promise<void> {
  if (!isStoredProductDocumentPath(storagePath)) return;
  const { error } = await supabase.storage.from(PRODUCT_DOCUMENTS_BUCKET).remove([storagePath]);
  if (error) throw new Error(error.message);
}
