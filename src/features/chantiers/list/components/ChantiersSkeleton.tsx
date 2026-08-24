function Line({ className = "" }: { className?: string }) {
  return <div className={`rounded bg-interactive ${className}`} />;
}

/** Le squelette reprend la geometrie reelle de la liste : rail, titre, meta. */
export function ChantiersSkeleton() {
  return (
    <section
      className="overflow-hidden rounded-card border border-subtle bg-surface motion-safe:animate-pulse"
      aria-label="Chargement des chantiers"
      aria-busy="true"
    >
      <div className="flex items-center gap-3 border-b border-subtle px-4 py-3 sm:px-5">
        <Line className="h-3 w-24" />
        <Line className="ml-auto h-3 w-16" />
      </div>
      <div className="divide-y divide-subtle">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="bt-row relative flex items-center gap-4 px-4 py-3 sm:px-5">
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-interactive" />
            <Line className="h-4 w-4 shrink-0 rounded-[5px]" />
            <div className="min-w-0 flex-1 space-y-2">
              <Line className="h-3.5 w-3/5" />
              <Line className="h-3 w-2/5" />
            </div>
            <Line className="hidden h-3 w-20 lg:block" />
            <Line className="hidden h-3 w-16 lg:block" />
            <Line className="h-7 w-20 rounded-field" />
          </div>
        ))}
      </div>
    </section>
  );
}
