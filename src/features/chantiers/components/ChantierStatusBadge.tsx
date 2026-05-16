export function ChantierStatusBadge({ label, className }: { label: string; className: string }) {
  return <span className={["rounded-full border px-2.5 py-1 text-xs font-medium", className].join(" ")}>{label}</span>;
}

