export type CrmWorkflowStepKey = "prospect" | "opportunity" | "visit" | "prequote" | "quote" | "chantier" | "invoice";

export type CrmWorkflowStep = {
  key: CrmWorkflowStepKey;
  label: string;
  state: "done" | "current" | "todo";
};

const DEFAULT_STEPS: Array<{ key: CrmWorkflowStepKey; label: string }> = [
  { key: "prospect", label: "Prospect" },
  { key: "opportunity", label: "Projet" },
  { key: "visit", label: "Visite" },
  { key: "prequote", label: "Pre-devis" },
  { key: "quote", label: "Devis" },
  { key: "chantier", label: "Chantier" },
  { key: "invoice", label: "Facture" },
];

export function buildCrmWorkflowSteps(current: CrmWorkflowStepKey = "prospect", done: CrmWorkflowStepKey[] = ["prospect"]): CrmWorkflowStep[] {
  return DEFAULT_STEPS.map((step) => ({
    ...step,
    state: done.includes(step.key) ? "done" : step.key === current ? "current" : "todo",
  }));
}
