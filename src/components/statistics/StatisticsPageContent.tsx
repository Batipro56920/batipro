import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../../i18n";
import { computeStatisticsView, type StatisticsFilters, type StatisticsView } from "../../lib/statistiques";
import { loadStatisticsDataset, type StatisticsDataset } from "../../services/statistiques.service";
import {
  StatisticsDefinitionsTable,
  StatisticsDistributionList,
  StatisticsDriftTable,
  StatisticsMetricCard,
  StatisticsSectionCard,
  StatisticsSimpleTable,
  StatisticsTaskFrequencyTable,
  formatStatValue,
} from "./StatisticsUi";

const DEFAULT_FILTERS: StatisticsFilters = {
  period: "90d",
  customStart: "",
  customEnd: "",
  chantierId: "",
  clientType: "",
  chantierType: "",
  lot: "",
  intervenantId: "",
  statutChantier: "",
};

function FiltersBar({
  filters,
  view,
  onChange,
}: {
  filters: StatisticsFilters;
  view: StatisticsView | null;
  onChange: (patch: Partial<StatisticsFilters>) => void;
}) {
  return (
    <div className="mt-5 space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[220px_minmax(0,1fr)]">
        <label className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Période</div>
          <select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.period} onChange={(e) => onChange({ period: e.target.value as StatisticsFilters["period"] })}>
            <option value="7d">7 jours</option>
            <option value="30d">30 jours</option>
            <option value="90d">90 jours</option>
            <option value="year">Année</option>
            <option value="custom">Personnalisé</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Chantier</div>
          <select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.chantierId} onChange={(e) => onChange({ chantierId: e.target.value })}>
            <option value="">Tous les chantiers</option>
            {view?.options.chantiers.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {filters.period === "custom" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:max-w-xl">
          <label className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Début</div>
            <input type="date" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.customStart} onChange={(e) => onChange({ customStart: e.target.value })} />
          </label>
          <label className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Fin</div>
            <input type="date" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.customEnd} onChange={(e) => onChange({ customEnd: e.target.value })} />
          </label>
        </div>
      ) : null}

      <details className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">Filtres avancés</summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Type clientèle</div>
            <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.clientType} onChange={(e) => onChange({ clientType: e.target.value })}>
              <option value="">Tous</option>
              {view?.options.clientTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Type chantier</div>
            <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.chantierType} onChange={(e) => onChange({ chantierType: e.target.value })}>
              <option value="">Tous</option>
              {view?.options.chantierTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Lot</div>
            <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.lot} onChange={(e) => onChange({ lot: e.target.value })}>
              <option value="">Tous</option>
              {view?.options.lots.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Intervenant</div>
            <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.intervenantId} onChange={(e) => onChange({ intervenantId: e.target.value })}>
              <option value="">Tous</option>
              {view?.options.intervenants.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>

          <label className="space-y-1.5">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Statut chantier</div>
            <select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={filters.statutChantier} onChange={(e) => onChange({ statutChantier: e.target.value })}>
              <option value="">Tous</option>
              {view?.options.statuts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
      </details>
    </div>
  );
}

export default function StatisticsPageContent() {
  const { locale, t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dataset, setDataset] = useState<StatisticsDataset | null>(null);
  const [filters, setFilters] = useState<StatisticsFilters>(DEFAULT_FILTERS);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setDataset(await loadStatisticsDataset());
    } catch (err: any) {
      setError(err?.message ?? "Chargement statistiques impossible.");
      setDataset(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const view = useMemo(() => (dataset ? computeStatisticsView(dataset, filters) : null), [dataset, filters]);
  const hasTaskAnalysis = Boolean(view && (
    view.taskAnalysis.topTasks.length ||
    view.taskAnalysis.topFamilies.length ||
    view.taskAnalysis.byLot.length ||
    view.taskAnalysis.quantityByFamily.length
  ));
  const hasBusinessAnalysis = Boolean(view && (
    view.businessAnalysis.byClientType.length ||
    view.businessAnalysis.byChantierType.length ||
    view.businessAnalysis.tasksByLot.length ||
    view.businessAnalysis.totalTimeByLot.length ||
    view.businessAnalysis.averageTimeByLot.length ||
    view.businessAnalysis.averageRealDurationByChantierType.length
  ));
  const hasQualityDetails = Boolean(view && (
    view.quality.blockageTypes.length ||
    view.quality.chantiersWithMostBlockages.length ||
    view.quality.chantiersWithoutRecentActivity.length ||
    view.quality.intervenantsWithoutRecentActivity.length
  ));

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">Pilotage CB Rénovation</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">{t("statistiques.title")}</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Vue générale : activité, dérives temps, blocages et suivi terrain.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setFilters(DEFAULT_FILTERS)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Réinitialiser
            </button>
            <button type="button" onClick={refresh} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
              {t("common.actions.refresh")}
            </button>
          </div>
        </div>

        <FiltersBar filters={filters} view={view} onChange={(patch) => setFilters((current) => ({ ...current, ...patch }))} />

        {view ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {view.scope.filteredChantiers} chantier(s), {view.scope.filteredTasks} tâche(s), {view.scope.filteredTimeEntries} saisie(s) temps · {view.scope.periodLabel}
          </div>
        ) : null}
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      {loading || !view ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("statistiques.loading")}</div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {view.globalActivity.map((metric) => (
              <StatisticsMetricCard key={metric.label} locale={locale} metric={metric} />
            ))}
          </section>

          {view.alerts.length ? (
            <StatisticsSectionCard eyebrow="Priorités" title="À traiter" subtitle="Alertes à regarder en premier.">
              <div className="grid gap-3 lg:grid-cols-2">
                {view.alerts.map((alert) => (
                  <div key={alert.key} className={["rounded-2xl border px-4 py-4", alert.tone === "danger" ? "border-red-200 bg-red-50" : alert.tone === "warning" ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"].join(" ")}>
                    <div className={["text-sm font-semibold", alert.tone === "danger" ? "text-red-700" : alert.tone === "warning" ? "text-amber-700" : "text-blue-700"].join(" ")}>{alert.title}</div>
                    <div className="mt-1 text-sm text-slate-700">{alert.detail}</div>
                  </div>
                ))}
              </div>
            </StatisticsSectionCard>
          ) : null}

          <StatisticsSectionCard eyebrow="Temps" title="Dérives et heures" subtitle="Comparer rapidement le temps prévu et le temps réalisé.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {view.performance.summary.map((metric) => (
                <StatisticsMetricCard key={metric.label} locale={locale} metric={metric} />
              ))}
            </div>
            {(view.performance.topChantiers.length || view.performance.topTasks.length) ? (
              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Chantiers en dérive</div>
                  <StatisticsDriftTable locale={locale} rows={view.performance.topChantiers} empty="Aucune dérive chantier calculable." />
                </div>
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Tâches en dérive</div>
                  <StatisticsDriftTable locale={locale} rows={view.performance.topTasks} empty="Aucune dérive tâche calculable." />
                </div>
              </div>
            ) : null}
            {view.performance.tasksWithoutPlannedHours > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {view.performance.tasksWithoutPlannedHours} tâche(s) sans temps prévu sont exclues du calcul de dérive.
              </div>
            ) : null}
          </StatisticsSectionCard>

          <StatisticsSectionCard eyebrow="Terrain" title="Blocages et suivi" subtitle="Ce qui ralentit les équipes et ce qui manque côté remontées terrain.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {view.quality.summary.map((metric) => (
                <StatisticsMetricCard key={metric.label} locale={locale} metric={metric} />
              ))}
            </div>
            {hasQualityDetails ? (
              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Blocages fréquents</div>
                  <StatisticsDistributionList locale={locale} rows={view.quality.blockageTypes} empty="Aucun blocage ouvert sur le périmètre." />
                </div>
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Chantiers bloqués</div>
                  <StatisticsDistributionList locale={locale} rows={view.quality.chantiersWithMostBlockages} empty="Aucun chantier bloqué actuellement." />
                </div>
                {view.quality.chantiersWithoutRecentActivity.length ? (
                  <div>
                    <div className="mb-3 text-sm font-semibold text-slate-900">Chantiers sans activité récente</div>
                    <StatisticsSimpleTable
                      headers={["Chantier", "Dernière activité", "Blocages ouverts"]}
                      rows={view.quality.chantiersWithoutRecentActivity.map((row) => [row.chantierName, row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleDateString(locale) : "Aucune", row.openBlockages])}
                      empty="Tous les chantiers ont eu une activité récente."
                    />
                  </div>
                ) : null}
                {view.quality.intervenantsWithoutRecentActivity.length ? (
                  <div>
                    <div className="mb-3 text-sm font-semibold text-slate-900">Intervenants sans remontée récente</div>
                    <StatisticsSimpleTable
                      headers={["Intervenant", "Dernière remontée", "Chantiers concernés"]}
                      rows={view.quality.intervenantsWithoutRecentActivity.map((row) => [row.intervenantName, row.lastActivityAt ? new Date(row.lastActivityAt).toLocaleDateString(locale) : "Aucune", row.chantierNames.length > 0 ? row.chantierNames.join(", ") : "Aucun chantier visible"])}
                      empty="Aucun intervenant silencieux sur la période récente."
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </StatisticsSectionCard>

          {hasTaskAnalysis ? (
            <StatisticsSectionCard eyebrow="Tâches" title="Récurrence" subtitle="Ce qui revient souvent et peut améliorer les futurs devis.">
              <div className="grid gap-5 xl:grid-cols-2">
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Tâches répétitives</div>
                  <StatisticsTaskFrequencyTable locale={locale} rows={view.taskAnalysis.topTasks} empty="Aucune tâche exploitable pour ce périmètre." />
                </div>
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Familles de tâches</div>
                  <StatisticsTaskFrequencyTable locale={locale} rows={view.taskAnalysis.topFamilies} empty="Aucune famille de tâche exploitable." />
                </div>
              </div>
              <div className="mt-5 grid gap-5 xl:grid-cols-2">
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Fréquence par lot</div>
                  <StatisticsDistributionList locale={locale} rows={view.taskAnalysis.byLot} empty="Aucune fréquence de lot disponible." />
                </div>
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Quantité par famille</div>
                  <StatisticsDistributionList locale={locale} rows={view.taskAnalysis.quantityByFamily} empty="Aucune quantité consolidée disponible." />
                </div>
              </div>
            </StatisticsSectionCard>
          ) : null}

          {hasBusinessAnalysis ? (
            <StatisticsSectionCard eyebrow="Métier" title="Répartition activité" subtitle="Nature des chantiers, lots et temps réellement consommé.">
              <div className="grid gap-5 xl:grid-cols-2">
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Type clientèle</div>
                  <StatisticsDistributionList locale={locale} rows={view.businessAnalysis.byClientType} empty="Aucune donnée clientèle exploitable." />
                </div>
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Type chantier</div>
                  <StatisticsDistributionList locale={locale} rows={view.businessAnalysis.byChantierType} empty="Aucune donnée type chantier exploitable." />
                </div>
              </div>
              <div className="mt-5 grid gap-5 xl:grid-cols-3">
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Tâches par lot</div>
                  <StatisticsDistributionList locale={locale} rows={view.businessAnalysis.tasksByLot} empty="Aucune tâche groupée par lot." />
                </div>
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Temps total par lot</div>
                  <StatisticsDistributionList locale={locale} rows={view.businessAnalysis.totalTimeByLot} unit="h" empty="Aucun temps total par lot disponible." />
                </div>
                <div>
                  <div className="mb-3 text-sm font-semibold text-slate-900">Temps moyen par lot</div>
                  <StatisticsDistributionList locale={locale} rows={view.businessAnalysis.averageTimeByLot} unit="h" empty="Aucun temps moyen par lot disponible." />
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Nombre moyen de tâches par chantier</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-950">{formatStatValue(locale, view.businessAnalysis.averageTasksPerChantier)}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">Durée réelle moyenne par type de chantier</div>
                  <div className="mt-3 space-y-2">
                    {view.businessAnalysis.averageRealDurationByChantierType.length === 0 ? (
                      <div className="text-sm text-slate-500">Non disponible</div>
                    ) : (
                      view.businessAnalysis.averageRealDurationByChantierType.map((row) => (
                        <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-slate-700">{row.label}</span>
                          <span className="font-medium text-slate-950">{formatStatValue(locale, row.value, "j")}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </StatisticsSectionCard>
          ) : null}

          <details className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer text-sm font-semibold text-slate-700">Détails techniques de calcul</summary>
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">Notes</div>
                <div className="space-y-2">
                  {view.notes.map((note, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      {note}
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-sm font-semibold text-slate-900">Avertissements</div>
                {view.integrityWarnings.length === 0 ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">Aucune incohérence détectée.</div>
                ) : (
                  <div className="space-y-2">
                    {view.integrityWarnings.map((warning, index) => (
                      <div key={index} className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        {warning}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-5">
              <div className="mb-3 text-sm font-semibold text-slate-900">Sources et formules</div>
              <StatisticsDefinitionsTable definitions={view.definitions} />
            </div>
          </details>
        </>
      )}
    </div>
  );
}
