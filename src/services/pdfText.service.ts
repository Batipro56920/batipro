// src/services/pdfText.service.ts
import { supabase } from "../lib/supabaseClient";
import * as pdfjsLib from "pdfjs-dist";

// ✅ Worker servi par Vite depuis /public/pdfjs/...
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";

/** Extrait le texte d'un PDF texte (non scanné) */
export async function extractTextFromPdf(file: File): Promise<string> {
  if (!file) throw new Error("Aucun fichier PDF fourni");

  const buffer = await file.arrayBuffer();

  // ✅ Disable worker fallback: on veut une erreur si le worker n'est pas chargé
  // (sinon "fake worker" => extraction instable)
  const loadingTask = pdfjsLib.getDocument({
    data: buffer,
    // @ts-expect-error -- pdfjs types don't include disableWorker
    disableWorker: false,
  });

  const pdf = await loadingTask.promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    const pageText = (content.items as any[])
      .map((item) => {
        if (item && typeof item === "object" && "str" in item) return String(item.str);
        return "";
      })
      .join(" ");

    fullText += pageText + "\n";
  }

  const out = fullText.trim();
  if (!out || out.length < 20) {
    throw new Error("Texte PDF vide ou trop court (PDF scanné => OCR nécessaire).");
  }

  return out;
}

/** Appelle l'Edge Function Supabase pour parser le texte */
export async function processDevisText(input: {
  devisId: string;
  extractedText: string;
}): Promise<{
  ok: boolean;
  linesInserted: number;
  tasksCreated: number;
  debug?: any;
  error?: string;
  version?: string;
}> {
  const { devisId, extractedText } = input;

  if (!devisId) throw new Error("devisId manquant");
  if (!extractedText || extractedText.trim().length < 20) {
    throw new Error("Texte extrait trop court ou vide");
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new Error("Impossible de récupérer la session utilisateur");
  if (!sessionData?.session?.access_token) throw new Error("Utilisateur non authentifié");

  const { data, error } = await supabase.functions.invoke("process-devis-text", {
    body: { devisId, extractedText },
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });

  if (error) {
    // ✅ On veut voir le vrai message (pas juste "non-2xx")
    console.error("Edge Function invoke error:", error);
    throw new Error(error.message || "Erreur Edge Function");
  }

  if (!data) throw new Error("Aucune donnée retournée par la fonction");

  return data;
}
