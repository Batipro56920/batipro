export function ChantierEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
      <div className="font-semibold text-slate-900">{title}</div>
      {description ? <div className="mt-1">{description}</div> : null}
    </div>
  );
}

