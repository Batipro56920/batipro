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
 * âœ… Nettoie une dÃ©signation â€œpolluÃ©eâ€ (si jamais le back renvoie encore collÃ©)
 * - enlÃ¨ve " â‚¬ ..." et "%", etc.
 * - enlÃ¨ve les doubles espaces
 */
function sanitizeDesignation(s: string) {
  let t = (s ?? "").trim();

  // vire les montants aprÃ¨s la quantitÃ© si Ã§a a Ã©tÃ© collÃ©
  // ex: "... 69,50 mÂ² 10,50 â‚¬ 10,00 %" -> on garde avant "â‚¬"
  t = t.replace(/\s+\d+(?:[.,]\d+)?\s*â‚¬.*$/i, "").trim();

  // vire TVA en % si collÃ©e
  t = t.replace(/\s+\d+(?:[.,]\d+)?\s*%.*$/i, "").trim();

  // espaces
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

/**
 * âœ… Import PDF -> Edge Function "process-devis-text"
 * IMPORTANT :
 * - on nâ€™upload rien en storage
 * - on nâ€™importe PAS PU/TVA (suivi chantier uniquement)
 * - on ne crÃ©e PAS de tÃ¢che pour lots / sous-lots (uniquement lignes chiffrÃ©es)
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

  // Log utile (tu lâ€™avais dans la console)
  console.log("[importDevisPdfToLinesAndTasks] sending", {
    chantierId,
    devisId,
    extractedTextLength: extractedText.length,
    preview: extractedText.slice(0, 180),
  });

  // 1) Appel Edge Function : elle doit insÃ©rer devis_lignes + chantier_tasks
  const { data, error } = await supabase.functions.invoke("process-devis-text", {
    body: { chantierId, devisId, extractedText },
  });

  if (error) {
    // error.message est souvent: "Edge Function returned a non-2xx status code"
    console.error("[process-devis-text] error", error);
    throw new Error(error.message || "Erreur Edge Function.");
  }

  const res = (data ?? {}) as ProcessDevisTextResult;
  console.log("[process-devis-text] OK", res);

  // 2) SÃ©curitÃ© : si le back est encore â€œancienâ€ et renvoie des lignes brutes,
  // on empÃªche le client dâ€™en dÃ©duire des tÃ¢ches/finances.
  // (Normalement le back gÃ¨re tout, mais on â€œverrouilleâ€ cÃ´tÃ© client.)
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
 * (Optionnel) Helper UI : si tu veux afficher quantitÃ©/unitÃ© en badges
 * depuis le titre tÃ¢che, tu pourras l'utiliser dans ChantierPage plus tard.
 *
 * Exemple :
 *   const { cleanTitle, quantite, unite } = decodeQtyUnit(task.titre)
 */
export function decodeQtyUnit(titre: string): { cleanTitle: string; quantite: number | null; unite: string | null } {
  const t = (titre ?? "").trim();

  const qm = t.match(/âŸ¦Q=([0-9.]+)âŸ§/);
  const um = t.match(/âŸ¦U=([^âŸ§]+)âŸ§/);

  const quantite = qm ? Number(qm[1]) : null;
  const unite = um ? String(um[1]).trim() : null;

  const cleanTitle = sanitizeDesignation(
    t
      .replace(/âŸ¦Q=[0-9.]+âŸ§/g, "")
      .replace(/âŸ¦U=[^âŸ§]+âŸ§/g, "")
      .trim(),
  );

  return {
    cleanTitle,
    quantite: Number.isFinite(quantite as any) ? (quantite as number) : null,
    unite: unite || null,
  };
}

