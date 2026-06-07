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

export function CrmWorkflowSteps({ steps, compact = false }: { steps: CrmWorkflowStep[]; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-2xl bg-slate-50 p-3" : "rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"}>
      {!compact ? <div className="mb-3 text-sm font-semibold text-slate-950">Avancement metier</div> : null}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {steps.map((step, index) => (
          <div key={step.key} className="flex shrink-0 items-center gap-2">
            <div className={[
              "flex min-w-[96px] items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold",
              step.state === "done" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : step.state === "current" ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-500",
            ].join(" ")}>
              <span className={[
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                step.state === "done" ? "bg-emerald-600 text-white" : step.state === "current" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400",
              ].join(" ")}>{step.state === "done" ? "OK" : index + 1}</span>
              <span>{step.label}</span>
            </div>
            {index < steps.length - 1 ? <span className="text-slate-300">/</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
