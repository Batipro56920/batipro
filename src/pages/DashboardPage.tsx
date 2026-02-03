export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tableau de bord</h1>
        <p className="text-slate-500">Vue d’ensemble de vos chantiers</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Chantiers en cours</div>
          <div className="text-3xl font-bold">4</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Réserves ouvertes</div>
          <div className="text-3xl font-bold">3</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Matériel manquant</div>
          <div className="text-3xl font-bold">3</div>
        </div>
        <div className="rounded-2xl bg-white border border-slate-200 p-4">
          <div className="text-sm text-slate-500">Temps global</div>
          <div className="text-3xl font-bold">114h</div>
        </div>
      </div>
    </div>
  );
}
