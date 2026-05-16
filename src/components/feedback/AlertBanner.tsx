import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "../../lib/cn";

type AlertTone = "info" | "success" | "warning" | "danger";

export function AlertBanner({ tone = "info", title, children, className }: { tone?: AlertTone; title?: string; children: ReactNode; className?: string }) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertTriangle;
  const tones = {
    info: "border-sky-200 bg-sky-50 text-sky-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
  };
  return (
    <div className={cn("flex gap-3 rounded-card border p-3 text-sm", tones[tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div>
        {title ? <div className="font-semibold">{title}</div> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
