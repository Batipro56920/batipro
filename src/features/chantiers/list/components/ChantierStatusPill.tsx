import type { ChantierStatus } from "../../../../types/chantier";
import { chantierStatusBadge } from "../../../../lib/chantierRules";

export function ChantierStatusPill({ status }: { status: ChantierStatus }) {
  const badge = chantierStatusBadge(status);
  return <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", badge.className].join(" ")}>{badge.label}</span>;
}

