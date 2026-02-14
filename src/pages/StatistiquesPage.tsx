import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getChantiers, type ChantierRow } from "../services/chantiers.service";

type StatsCard = {
  label: string;
  value: string;
};

export default function StatistiquesPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<StatsCard[]>([]);
  const [topChantiers, setTopChantiers] = useState<ChantierRow[]>([]);

  const avgProgress = useMemo(() => {
    if (!topChantiers.length) return 0;
    const values = topChantiers.map((c) => Number(c.avancement ?? 0));
    const sum = values.reduce((acc, n) => acc + n, 0);
    return Math.round(sum / values.length);
  }, [topChantiers]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [chantiers, intervenantsCountRes, documentsCountRes, reservesOpenCountRes] = await Promise.all([
        getChantiers(),
        supabase.from("intervenants").select("id", { count: "exact", head: true }),
        supabase.from("chantier_documents").select("id", { count: "exact", head: true }),
        supabase.from("chantier_reserves").select("id", { count: "exact", head: true }).neq("status", "LEVEE"),
      ]);

      if (intervenantsCountRes.error) throw intervenantsCountRes.error;
      if (documentsCountRes.error) throw documentsCountRes.error;
      if (reservesOpenCountRes.error) throw reservesOpenCountRes.error;

      const enCoursCount = chantiers.filter((c) => c.status === "EN_COURS").length;
      const termineCount = chantiers.filter((c) => c.status === "TERMINE").length;

      setCards([
        { label: "Chantiers", value: String(chantiers.length) },
        { label: "En cours", value: String(enCoursCount) },
        { label: "Termines", value: String(termineCount) },
        { label: "Intervenants", value: String(intervenantsCountRes.count ?? 0) },
        { label: "Documents", value: String(documentsCountRes.count ?? 0) },
        { label: "Reserves ouvertes", value: String(reservesOpenCountRes.count ?? 0) },
      ]);

      setTopChantiers([...chantiers].sort((a, b) => Number(b.avancement ?? 0) - Number(a.avancement ?? 0)).slice(0, 8));
    } catch (err: any) {
      setError(err?.message ?? "Erreur chargement statistiques.");
      setCards([]);
      setTopChantiers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Statistiques</h1>
          <p className="text-slate-500">Indicateurs globaux d'activite.</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
        >
          Rafraichir
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Chargement...</div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => (
              <div key={card.label} className="rounded-2xl border bg-white p-4">
                <div className="text-sm text-slate-500">{card.label}</div>
                <div className="text-3xl font-semibold mt-1">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-white p-4">
            <div className="font-semibold">Avancement moyen</div>
            <div className="text-sm text-slate-500 mt-1">Calcul sur les chantiers visibles.</div>
            <div className="text-3xl font-semibold mt-2">{avgProgress}%</div>
            <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-slate-900" style={{ width: `${Math.max(0, Math.min(100, avgProgress))}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border bg-white overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold">Top chantiers par avancement</div>
            {topChantiers.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">Aucun chantier.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Chantier</th>
                    <th className="px-4 py-3 text-left font-medium">Client</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Avancement</th>
                  </tr>
                </thead>
                <tbody>
                  {topChantiers.map((chantier) => (
                    <tr key={chantier.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{chantier.nom}</td>
                      <td className="px-4 py-3">{chantier.client ?? "-"}</td>
                      <td className="px-4 py-3">{chantier.status}</td>
                      <td className="px-4 py-3">{Number(chantier.avancement ?? 0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
