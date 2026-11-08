import { supabase } from "../lib/supabaseClient";

export type WorkerOfficeAssignment = {
  id: string;
  chantier_id: string;
  date_start: string;
  date_end: string;
  note: string;
};

export type WorkerOfficePlanningResult = {
  assignments: WorkerOfficeAssignment[];
  failedChantierNames: string[];
};

export async function intervenantOfficePlanning(token: string, chantierId: string): Promise<WorkerOfficeAssignment[]> {
  const { data, error } = await (supabase as any).rpc("intervenant_office_planning", {
    p_token: token,
    p_chantier_id: chantierId,
  });
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? (data as WorkerOfficeAssignment[]) : [];
}

/**
 * Utilise la RPC existante, qui valide le jeton et l'accès chantier pour
 * chaque lecture. Aucune lecture directe non autorisée des affectations bureau.
 */
export async function intervenantOfficePlanningAcrossChantiers(
  token: string,
  chantiers: Array<{ id: string; nom: string }>,
): Promise<WorkerOfficePlanningResult> {
  const results = await Promise.allSettled(
    chantiers.map((chantier) => intervenantOfficePlanning(token, chantier.id)),
  );
  const assignments: WorkerOfficeAssignment[] = [];
  const failedChantierNames: string[] = [];

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      failedChantierNames.push(chantiers[index].nom);
    } else {
      // La même affectation peut être remontée par plusieurs contextes :
      // l'identifiant reste la clé de déduplication.
      assignments.push(...result.value);
    }
  });

  return {
    assignments: Array.from(new Map(assignments.map((row) => [row.id, row])).values())
      .sort((a, b) => a.date_start.localeCompare(b.date_start) || a.date_end.localeCompare(b.date_end)),
    failedChantierNames,
  };
}
