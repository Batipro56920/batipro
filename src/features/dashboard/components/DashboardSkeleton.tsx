export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-label="Chargement du dashboard">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-28 rounded bg-slate-100" />
              <div className="h-8 w-8 rounded-lg bg-slate-100" />
            </div>
            <div className="mt-4 h-7 w-16 rounded bg-slate-100" />
            <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-2xl border border-slate-200 bg-white" />
    </div>
  );
}
