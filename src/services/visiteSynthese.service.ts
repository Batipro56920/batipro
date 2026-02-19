import { supabase } from "../lib/supabaseClient";
import type { VisiteSnapshot } from "../lib/buildVisiteSnapshot";

export type VisiteSyntheseResult = {
  synthese: string;
  points_cles: string[];
  resume?: string;
  points_positifs?: string[];
  points_bloquants?: string[];
  decisions?: Array<{ action: string; responsable: string | null; echeance: string | null }>;
};

function parsePoints(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 12);
}

export async function generateVisiteSynthese(payload: {
  visite_id?: string;
  notes_terrain: string;
  points_bloquants?: string;
  snapshot: VisiteSnapshot;
  actions?: Array<{ description: string; statut?: string | null }>;
}): Promise<VisiteSyntheseResult> {
  const { data, error } = await supabase.functions.invoke("generate-visite-synthese", {
    method: "POST",
    body: {
      visite_id: payload.visite_id ?? null,
      notes_terrain: payload.notes_terrain ?? "",
      points_bloquants: payload.points_bloquants ?? "",
      snapshot: payload.snapshot,
      actions: payload.actions ?? [],
    },
  });

  if (error) {
    const message = String(error.message ?? "");
    if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
      throw new Error("Synthese IA indisponible (acces non autorise).");
    }
    if (message.includes("404")) {
      throw new Error("Synthese IA indisponible (function non deployee).");
    }
    if (message.includes("429") || message.toLowerCase().includes("quota")) {
      throw new Error("Synthese IA indisponible (quota).");
    }
    throw new Error("Synthese IA indisponible.");
  }

  const synthese = String((data as any)?.synthese ?? "").trim();
  const points = parsePoints((data as any)?.points_cles);
  const resume = String((data as any)?.resume ?? "").trim();
  const pointsPositifs = parsePoints((data as any)?.points_positifs);
  const pointsBloquants = parsePoints((data as any)?.points_bloquants);
  const decisionsRaw = Array.isArray((data as any)?.decisions) ? (data as any).decisions : [];
  const decisions = decisionsRaw
    .map((row: any) => ({
      action: String(row?.action ?? "").trim(),
      responsable: String(row?.responsable ?? "").trim() || null,
      echeance: String(row?.echeance ?? "").trim() || null,
    }))
    .filter((row: any) => row.action.length > 0)
    .slice(0, 20);

  const finalResume = resume || synthese;
  if (!finalResume) {
    throw new Error("Synthese IA indisponible.");
  }

  const mergedPoints = points.length
    ? points
    : [...pointsPositifs, ...pointsBloquants].filter(Boolean).slice(0, 12);

  return {
    synthese: finalResume,
    points_cles: mergedPoints,
    resume: finalResume,
    points_positifs: pointsPositifs,
    points_bloquants: pointsBloquants,
    decisions,
  };
}
