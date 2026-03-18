import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getChantiers, type ChantierRow } from "../services/chantiers.service";
import { useI18n } from "../i18n";

type StatsCard = {
  label: string;
  value: string;
};

export default function StatistiquesPage() {
  const { locale, t } = useI18n();
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
        { label: t("statistiques.cards.chantiers"), value: String(chantiers.length) },
        { label: t("statistiques.cards.inProgress"), value: String(enCoursCount) },
        { label: t("common.chantierStatus.TERMINE"), value: String(termineCount) },
        { label: t("sidebar.intervenants"), value: String(intervenantsCountRes.count ?? 0) },
        { label: t("common.labels.documents"), value: String(documentsCountRes.count ?? 0) },
        { label: t("statistiques.cards.openReserves"), value: String(reservesOpenCountRes.count ?? 0) },
      ]);

      setTopChantiers([...chantiers].sort((a, b) => Number(b.avancement ?? 0) - Number(a.avancement ?? 0)).slice(0, 8));
    } catch (err: any) {
      setError(err?.message ?? t("statistiques.loadError"));
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
          <h1 className="text-2xl font-bold">{t("statistiques.title")}</h1>
          <p className="text-slate-500">{t("statistiques.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
        >
          {t("common.actions.refresh")}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("statistiques.loading")}</div>
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
            <div className="font-semibold">{t("dashboard.kpis.averageProgress")}</div>
            <div className="text-sm text-slate-500 mt-1">{t("dashboard.followUp")}</div>
            <div className="text-3xl font-semibold mt-2">{avgProgress}%</div>
            <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-slate-900" style={{ width: `${Math.max(0, Math.min(100, avgProgress))}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border bg-white overflow-hidden">
            <div className="px-4 py-3 border-b font-semibold">{t("statistiques.topTitle")}</div>
            {topChantiers.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">{t("statistiques.empty")}</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">{t("sidebar.chantiers")}</th>
                    <th className="px-4 py-3 text-left font-medium">{t("common.labels.client")}</th>
                    <th className="px-4 py-3 text-left font-medium">{t("common.labels.status")}</th>
                    <th className="px-4 py-3 text-left font-medium">{t("dashboard.kpis.averageProgress")}</th>
                  </tr>
                </thead>
                <tbody>
                  {topChantiers.map((chantier) => (
                    <tr key={chantier.id} className="border-t">
                      <td className="px-4 py-3 font-medium">{chantier.nom}</td>
                      <td className="px-4 py-3">{chantier.client ?? "-"}</td>
                      <td className="px-4 py-3">
                        {chantier.status ? t(`common.chantierStatus.${chantier.status}`) : "-"}
                      </td>
                      <td className="px-4 py-3">{new Intl.NumberFormat(locale).format(Number(chantier.avancement ?? 0))}%</td>
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
