import { statusPill } from "./crmFormat";

export function CrmStatusBadge({ status, label = status }: { status: string; label?: string }) {
  return <span className={statusPill(status)}>{label}</span>;
}

