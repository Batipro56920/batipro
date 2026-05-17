export function ChantiersSkeleton() {
  return (
    <section className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
          <div className="mt-3 h-3 w-2/3 animate-pulse rounded bg-slate-100" />
          <div className="mt-4 h-2 w-full animate-pulse rounded bg-slate-100" />
        </div>
      ))}
    </section>
  );
}

