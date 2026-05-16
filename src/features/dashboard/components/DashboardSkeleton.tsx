export function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-label="Chargement du dashboard">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white p-4">
            <div className="h-9 w-9 rounded-xl bg-slate-100" />
            <div className="mt-5 h-7 w-20 rounded bg-slate-100" />
            <div className="mt-3 h-4 w-28 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white" />
        <div className="h-80 animate-pulse rounded-3xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
