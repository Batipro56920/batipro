import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  loadChantierBudgetDashboard,
  upsertChantierBudgetSettings,
  type ChantierBudgetDashboard,
} from "../../services/chantierBudget.service";
import { appendChantierActivityLog } from "../../services/chantierActivityLog.service";

type BudgetTabProps = {
  chantierId: string;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatPercent(value: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(value) || 0)} %`;
}

function formatHours(value: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(Number(value) || 0)} h`;
}

function marginToneClass(value: number, target: number) {
  if (value < target) return "text-red-700";
  if (value < target + 5) return "text-amber-700";
  return "text-emerald-700";
}

export default function BudgetTab({ chantierId }: BudgetTabProps) {
  const [dashboard, setDashboard] = useState<ChantierBudgetDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState("48");
  const [marginTargetPct, setMarginTargetPct] = useState("25");

  const lotRows = useMemo(() => dashboard?.lots ?? [], [dashboard]);

  async function refreshBudget() {
    setLoading(true);
    setError(null);
    try {
      const result = await loadChantierBudgetDashboard(chantierId);
      setDashboard(result);
      setHourlyRate(String(result.settings.taux_horaire_mo_ht));
      setMarginTargetPct(String(result.settings.objectif_marge_pct));
    } catch (err: any) {
      setDashboard(null);
      setError(err?.message ?? "Erreur chargement budget chantier.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshBudget();
  }, [chantierId]);

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const settings = await upsertChantierBudgetSettings(chantierId, {
        taux_horaire_mo_ht: hourlyRate,
        objectif_marge_pct: marginTargetPct,
      });
      await appendChantierActivityLog({
        chantierId,
        actionType: "updated",
        entityType: "budget_settings",
        entityId: chantierId,
        reason: "Parametres budget mis a jour",
        changes: {
          taux_horaire_mo_ht: settings.taux_horaire_mo_ht,
          objectif_marge_pct: settings.objectif_marge_pct,
        },
      });
      await refreshBudget();
    } catch (err: any) {
      setError(err?.message ?? "Erreur mise a jour budget chantier.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="font-semibold section-title">Budget & marge</div>
          <div className="text-sm text-slate-500">
            Consolidation devis, main d'oeuvre, achats et avenants valides.
          </div>
        </div>
        <button
          type="button"
          onClick={() => void refreshBudget()}
          disabled={loading}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? "Chargement..." : "Rafraichir"}
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {dashboard && !dashboard.settingsSchemaReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Migration budget chantier non appliquee sur Supabase.
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">CA prevu HT</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {formatMoney(dashboard?.chiffreAffairesPrevuHt ?? 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Devis {formatMoney(dashboard?.chiffreAffairesBaseHt ?? 0)} + avenants{" "}
            {formatMoney(dashboard?.avenantsValidesHt ?? 0)}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Couts prevus HT</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {formatMoney(dashboard?.coutPrevuHt ?? 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            MO {formatMoney(dashboard?.coutMoPrevuHt ?? 0)} · achats {formatMoney(dashboard?.achatsPrevusHt ?? 0)}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Couts reels HT</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">
            {formatMoney(dashboard?.coutReelHt ?? 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            MO {formatMoney(dashboard?.coutMoReelHt ?? 0)} · achats {formatMoney(dashboard?.achatsReelsHt ?? 0)}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Marge reelle</div>
          <div
            className={[
              "mt-2 text-2xl font-semibold",
              marginToneClass(
                dashboard?.margeReellePct ?? 0,
                dashboard?.settings.objectif_marge_pct ?? 25,
              ),
            ].join(" ")}
          >
            {formatMoney(dashboard?.margeReelleHt ?? 0)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {formatPercent(dashboard?.margeReellePct ?? 0)} · objectif{" "}
            {formatPercent(dashboard?.settings.objectif_marge_pct ?? 25)}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-6">
          <form
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            onSubmit={(event) => void saveSettings(event)}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              Parametres
            </div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">Regles de calcul</h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-xs text-slate-600">
                <div>Taux MO HT / heure</div>
                <input
                  value={hourlyRate}
                  onChange={(event) => setHourlyRate(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  inputMode="decimal"
                  disabled={saving || !dashboard?.settingsSchemaReady}
                />
              </label>
              <label className="space-y-1 text-xs text-slate-600">
                <div>Objectif marge (%)</div>
                <input
                  value={marginTargetPct}
                  onChange={(event) => setMarginTargetPct(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                  inputMode="decimal"
                  disabled={saving || !dashboard?.settingsSchemaReady}
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={saving || !dashboard?.settingsSchemaReady}
                className={[
                  "rounded-2xl px-5 py-3 text-sm font-medium",
                  saving || !dashboard?.settingsSchemaReady
                    ? "bg-slate-200 text-slate-500"
                    : "bg-blue-600 text-white hover:bg-blue-700",
                ].join(" ")}
              >
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </form>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Alertes budget</div>
            <div className="mt-4 space-y-2">
              {(dashboard?.alertes ?? []).length === 0 ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Aucun depassement detecte.
                </div>
              ) : (
                dashboard?.alertes.map((message) => (
                  <div
                    key={message}
                    className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {message}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Ventilation par lot
              </div>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">MO + achats</h2>
            </div>
            <div className="text-xs text-slate-500">{lotRows.length} lot(s)</div>
          </div>

          <div className="mt-4 space-y-3">
            {loading ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Chargement budget...
              </div>
            ) : lotRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Aucun lot exploitable pour le budget.
              </div>
            ) : (
              lotRows.map((row) => (
                <article
                  key={row.lot}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="text-sm font-semibold text-slate-950">{row.lot}</div>
                    <div className="text-xs text-slate-500">
                      {formatHours(row.temps_prevu_h)} prevues · {formatHours(row.temps_reel_h)} realisees
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-4">
                    <div className="rounded-xl bg-white px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">MO prevue</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatMoney(row.cout_mo_prevu_ht)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">MO reelle</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatMoney(row.cout_mo_reel_ht)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Achats prevus</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatMoney(row.achats_prevus_ht)}
                      </div>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Achats reels</div>
                      <div className="mt-1 text-sm font-semibold text-slate-900">
                        {formatMoney(row.achats_reels_ht)}
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
