function Line({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-interactive ${className}`} />;
}

/** Le squelette reprend la structure reelle : verdict, file, sections repliees. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-5 motion-safe:animate-pulse" aria-label="Chargement du dashboard" aria-busy="true">
      <div className="rounded-card border border-subtle bg-surface p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <Line className="h-8 w-8 shrink-0 rounded-full" />
          <Line className="h-5 w-3/5 max-w-sm" />
        </div>
        <Line className="mt-4 h-2 w-full rounded-full" />
        <div className="mt-3 flex gap-4">
          <Line className="h-3 w-20" />
          <Line className="h-3 w-20" />
          <Line className="h-3 w-24" />
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-subtle bg-surface">
        <div className="flex items-center justify-between px-4 pt-4 sm:px-5 sm:pt-5">
          <Line className="h-4 w-24" />
          <Line className="h-3 w-16" />
        </div>
        <div className="flex gap-1.5 px-4 py-3 sm:px-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <Line key={index} className="h-7 w-24 rounded-full" />
          ))}
        </div>
        <div className="divide-y divide-subtle border-t border-subtle">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
              <div className="min-w-0 flex-1 space-y-2">
                <Line className="h-3.5 w-2/5" />
                <Line className="h-3 w-3/5" />
              </div>
              <Line className="h-3 w-14" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-card border border-subtle bg-surface px-4 py-3 sm:px-5">
        <Line className="h-4 w-40" />
        <Line className="h-8 w-24 rounded-field" />
      </div>
    </div>
  );
}
