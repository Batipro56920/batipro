import type { CrmWorkflowStep } from "./crmWorkflowModel";

export function CrmWorkflowSteps({ steps, compact = false }: { steps: CrmWorkflowStep[]; compact?: boolean }) {
  return (
    <div className={compact ? "rounded-card border border-subtle bg-interactive p-3" : "rounded-surface border border-subtle bg-surface p-4 shadow-sm"}>
      {!compact ? <div className="mb-3 text-sm font-semibold text-ink">Avancement metier</div> : null}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {steps.map((step, index) => (
          <div key={step.key} className="flex shrink-0 items-center gap-2">
            <div className={[
              "flex min-w-[96px] items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold",
              step.state === "done" ? "border-success/20 bg-success-soft text-success-on" : step.state === "current" ? "border-primary/20 bg-primary-soft text-primary-on" : "border-subtle bg-surface text-muted",
            ].join(" ")}>
              <span className={[
                "flex h-5 w-5 items-center justify-center rounded-full text-[10px]",
                step.state === "done" ? "bg-success text-success-contrast" : step.state === "current" ? "bg-primary text-primary-contrast" : "bg-interactive text-muted",
              ].join(" ")}>{step.state === "done" ? "OK" : index + 1}</span>
              <span>{step.label}</span>
            </div>
            {index < steps.length - 1 ? <span className="text-muted">/</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
