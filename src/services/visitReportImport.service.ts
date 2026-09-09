import { supabase } from "../lib/supabaseClient";

export type VisitImportTask = {
  title: string;
  unit: string;
  quantity: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  estimatedHours: number | null;
  priceHintHt: number | null;
  technicalNotes: string;
  constraints: string;
  taskTemplateId: string | null;
  taskTemplateLabel: string | null;
};

export type VisitImportSection = {
  title: string;
  tasks: VisitImportTask[];
};

export type VisitImportProposal = {
  project: {
    clientObjective: string;
    needDescription: string;
    zones: string;
    urgency: string;
    desiredDeadline: string;
  };
  sections: VisitImportSection[];
  constraints: Record<string, string>;
  budget: Record<string, string>;
  followUp: { nextAction: string; followUpDate: string };
  unassigned: string[];
  confidence: "high" | "medium" | "low";
};

export type VisitImportInput = {
  transcript: string;
  project: { name: string; clientName: string; address: string; projectType: string } | null;
  currentDraft: Record<string, unknown> | null;
  taskLibrary: Array<{ id: string; titre: string; lot: string | null; unite: string | null }>;
};

/**
 * Envoie le compte rendu d'un rendez-vous à Coco pour qu'il remplisse la fiche
 * de visite. La proposition n'est jamais appliquée ici : c'est l'utilisateur qui
 * choisit ce qu'il garde.
 */
export async function importVisitReportWithCoco(input: VisitImportInput): Promise<VisitImportProposal> {
  const { data, error } = await supabase.functions.invoke("import-visit-report", { body: input });
  if (error) {
    const detail = (error as { message?: string }).message ?? "";
    throw new Error(detail || "Analyse du compte rendu impossible.");
  }
  const result = (data as { result?: VisitImportProposal; error?: string } | null)?.result;
  if (!result) {
    const message = (data as { error?: string } | null)?.error;
    throw new Error(message || "Coco n'a rien pu tirer de ce compte rendu.");
  }
  return result;
}
