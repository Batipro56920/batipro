// src/services/devisImport.service.ts
import { supabase } from "../lib/supabaseClient";

export type ProcessDevisTextResult = {
  ok: boolean;
  linesInserted?: number;
  tasksCreated?: number;
  note?: string;
  warning?: string;
  error?: string;
  details?: any;
  structure?: any[];
};

type ImportPayload = {
  chantierId: string;
  devisId: string;
  extractedText: string;
};

/**
 * Nettoie une désignation “polluée” (si jamais le back renvoie encore collé)
 * - enlève " € ..." et "%", etc.
 * - enlève les doubles espaces
 */
function sanitizeDesignation(s: string) {
  let t = (s ?? "").trim();

  // vire les montants après la quantité si ça a été collé
  // ex: "... 69,50 m² 10,50 € 10,00 %" -> on garde avant "€"
  t = t.replace(/\s+\d+(?:[.,]\d+)?\s*€.*$/i, "").trim();

  // vire TVA en % si collée
  t = t.replace(/\s+\d+(?:[.,]\d+)?\s*%.*$/i, "").trim();

  // espaces
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/**
 * Import PDF -> Edge Function "process-devis-text"
 * IMPORTANT :
 * - on n’upload rien en storage
 * - on n’importe PAS PU/TVA (suivi chantier uniquement)
 * - on ne crée PAS de tâche pour lots / sous-lots (uniquement lignes chiffrées)
 */
export async function uploadDevisPdf(file: File, chantierId: string) {
  if (!file) throw new Error("Aucun fichier PDF fourni");
  const chantier = (chantierId ?? "").trim();
  if (!chantier) throw new Error("chantierId manquant.");

const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
const objectPath = `${chantier}/${safeName}`;


  const { data, error } = await supabase.storage.from("devis-pdf").upload(objectPath, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || "application/pdf",
  });

  if (error) {
    console.error("[uploadDevisPdf] storage error", error);
    throw new Error(error.message || "Upload devis PDF impossible.");
  }

  return {
    chantierId: chantier,
    fileName: file.name,
    size: file.size,
    bucket: "devis-pdf",
    path: data?.path ?? objectPath,
    fullPath: data?.fullPath,
  };
}
export async function importDevisPdfToLinesAndTasks(payload: ImportPayload): Promise<ProcessDevisTextResult> {
  const chantierId = (payload?.chantierId ?? "").trim();
  const devisId = (payload?.devisId ?? "").trim();
  const extractedText = (payload?.extractedText ?? "").trim();

  if (!chantierId) throw new Error("chantierId manquant.");
  if (!devisId) throw new Error("devisId manquant.");
  if (!extractedText || extractedText.length < 20) throw new Error("Texte PDF vide / trop court.");

  // Log utile (tu l’avais dans la console)
  console.log("[importDevisPdfToLinesAndTasks] sending", {
    chantierId,
    devisId,
    extractedTextLength: extractedText.length,
    preview: extractedText.slice(0, 180),
  });

  // 1) Appel Edge Function : elle doit insérer devis_lignes + chantier_tasks
  const { data, error } = await supabase.functions.invoke("process-devis-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chantierId, devisId, extractedText }),
  });

  if (error) {
    // error.message est souvent: "Edge Function returned a non-2xx status code"
    console.error("[process-devis-text] error", error);
    throw new Error(error.message || "Erreur Edge Function.");
  }

  const res = (data ?? {}) as ProcessDevisTextResult;
  console.log("[process-devis-text] OK", res);

  // 2) Sécurité : si le back est encore “ancien” et renvoie des lignes brutes,
  // on empêche le client d’en déduire des tâches/finances.
  // (Normalement le back gère tout, mais on “verrouille” côté client.)
  if (res?.ok !== true) {
    return res;
  }

  return {
    ok: true,
    linesInserted: Number(res.linesInserted ?? 0),
    tasksCreated: Number(res.tasksCreated ?? 0),
    structure: Array.isArray(res.structure) ? res.structure : [],
    note: res.note,
    warning: res.warning,
  };
}

/**
 * (Optionnel) Helper UI : si tu veux afficher quantité/unité en badges
 * depuis le titre tâche, tu pourras l'utiliser dans ChantierPage plus tard.
 *
 * Exemple :
 *   const { cleanTitle, quantite, unite } = decodeQtyUnit(task.titre)
 */
export function decodeQtyUnit(titre: string): { cleanTitle: string; quantite: number | null; unite: string | null } {
  const t = (titre ?? "").trim();

  const qm = t.match(/\u27E6Q=([0-9.]+)\u27E7/);
  const um = t.match(/\u27E6U=([^\u27E7]+)\u27E7/);

  const quantite = qm ? Number(qm[1]) : null;
  const unite = um ? String(um[1]).trim() : null;

  const cleanTitle = sanitizeDesignation(
    t
      .replace(/\u27E6Q=[0-9.]+\u27E7/g, "")
      .replace(/\u27E6U=[^\u27E7]+\u27E7/g, "")
      .trim(),
  );

  return {
    cleanTitle,
    quantite: Number.isFinite(quantite as any) ? (quantite as number) : null,
    unite: unite || null,
  };
}




