export function ChantierProgress({ value }: { value: number }) {
  return (
    <div className="min-w-[120px]">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Avancement</span>
        <span className="font-semibold text-slate-700">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

