export function ChantierProgress({ value }: { value: number }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className="min-w-[120px]">
      <div className="bt-caption flex items-center justify-between gap-2 text-muted">
        <span>Avancement</span>
        <span className="bt-num text-ink-secondary">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full bg-primary transition-[width] duration-[240ms]" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
