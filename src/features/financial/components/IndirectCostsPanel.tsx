import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Wrench } from "lucide-react";
import {
  getCompanySettings,
  normalizeIndirectCosts,
  upsertCompanySettings,
  DEFAULT_PRODUCTIVE_HOURS_PER_EMPLOYEE_YEAR,
  type CompanyEquipmentAsset,
  type CompanyIndirectCostsSettings,
} from "../../../services/companySettings.service";
import { getCompanyHourlyRates, type CompanyHourlyRates } from "../../../services/indirectCosts.service";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0,
  );
}

function createAsset(): CompanyEquipmentAsset {
  return { id: crypto.randomUUID(), name: "", purchaseValueHt: 0, amortizationYears: 5, active: true };
}

export default function IndirectCostsPanel({ chargesVersion = 0 }: { chargesVersion?: number }) {
  const [settings, setSettings] = useState<CompanyIndirectCostsSettings | null>(null);
  const [rates, setRates] = useState<CompanyHourlyRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [company, computed] = await Promise.all([getCompanySettings(), getCompanyHourlyRates()]);
      setSettings(normalizeIndirectCosts(company.indirect_costs));
      setRates(computed);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les coûts indirects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh, chargesVersion]);

  async function persist(next: CompanyIndirectCostsSettings) {
    setSettings(next);
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await upsertCompanySettings({ indirect_costs: next });
      setRates(await getCompanyHourlyRates());
      setNotice("Coûts indirects enregistrés.");
    } catch (err: any) {
      setError(err?.message ?? "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  function updateAsset(id: string, patch: Partial<CompanyEquipmentAsset>) {
    if (!settings) return;
    setSettings({
      ...settings,
      equipmentAssets: settings.equipmentAssets.map((asset) => (asset.id === id ? { ...asset, ...patch } : asset)),
    });
  }

  if (loading) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Chargement des coûts indirects...
      </section>
    );
  }

  if (!settings || !rates) {
    return (
      <section className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error ?? "Coûts indirects indisponibles."}
      </section>
    );
  }

  const missingEmployees = rates.activeEmployeeCount === 0;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h2 className="font-semibold text-slate-950">Coûts indirects imputés aux tâches</h2>
        <p className="mt-1 text-sm text-slate-500">
          L'amortissement du matériel et les frais généraux sont ramenés à un coût horaire, puis imputés au temps de
          main d'oeuvre de chaque tâche lors de la préparation par Coco.
        </p>
      </div>

      {error ? <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        <Rate label="Coût horaire moyen ouvrier" value={`${formatCurrency(rates.averageEmployeeHourlyCostHt)}/h`} hint={`${rates.activeEmployeeCount} salarié(s) CB Rénovation`} />
        <Rate label="Heures productives / an" value={`${rates.productiveHoursPerYear.toLocaleString("fr-FR")} h`} hint={`${rates.activeEmployeeCount} × ${rates.productiveHoursPerEmployeeYear} h`} />
        <Rate label="Amortissement matériel" value={`${formatCurrency(rates.amortizationRatePerHour)}/h`} hint={`${formatCurrency(rates.amortizationAnnualHt)} / an`} />
        <Rate label="Frais généraux" value={`${formatCurrency(rates.overheadRatePerHour)}/h`} hint={`${formatCurrency(rates.overheadAnnualHt)} / an`} />
      </div>

      {missingEmployees ? (
        <div className="mx-4 mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Aucun salarié actif de statut "Salarié" n'est enregistré dans Profils &amp; accès : les coûts horaires
          d'amortissement et de frais généraux restent à 0 tant qu'il n'y a pas d'heures productives à répartir.
        </div>
      ) : null}

      <div className="border-t border-slate-100 p-4">
        <label className="block max-w-sm text-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Heures productives par salarié et par an
          </div>
          <input
            type="number"
            min={1}
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={settings.productiveHoursPerEmployeeYear}
            onChange={(event) =>
              setSettings({ ...settings, productiveHoursPerEmployeeYear: Number(event.target.value) || 0 })
            }
            onBlur={() => void persist(settings)}
          />
          <p className="mt-1 text-xs text-slate-500">
            Base légale française : {DEFAULT_PRODUCTIVE_HOURS_PER_EMPLOYEE_YEAR} h. Retirez les congés et le temps non
            facturable si vous voulez un coût horaire plus prudent.
          </p>
        </label>
      </div>

      <div className="border-t border-slate-100 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-semibold text-slate-950">Matériel amorti</div>
            <p className="mt-1 text-sm text-slate-500">
              Échafaudages, outillage, véhicules... Amortissement linéaire : valeur d'achat ÷ durée.
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void persist({ ...settings, equipmentAssets: [...settings.equipmentAssets, createAsset()] })}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            <Plus className="h-4 w-4" /> Ajouter un matériel
          </button>
        </div>

        <div className="space-y-2">
          {settings.equipmentAssets.map((asset) => {
            const annual = asset.amortizationYears > 0 ? asset.purchaseValueHt / asset.amortizationYears : 0;
            return (
              <div key={asset.id} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[2fr_1fr_1fr_auto_auto] md:items-end">
                <label className="text-sm">
                  <div className="text-xs text-slate-500">Désignation</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    placeholder="Ex : échafaudage roulant"
                    value={asset.name}
                    onChange={(event) => updateAsset(asset.id, { name: event.target.value })}
                    onBlur={() => void persist(settings)}
                  />
                </label>
                <label className="text-sm">
                  <div className="text-xs text-slate-500">Valeur d'achat HT</div>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={asset.purchaseValueHt}
                    onChange={(event) => updateAsset(asset.id, { purchaseValueHt: Number(event.target.value) || 0 })}
                    onBlur={() => void persist(settings)}
                  />
                </label>
                <label className="text-sm">
                  <div className="text-xs text-slate-500">Durée (années)</div>
                  <input
                    type="number"
                    min={0}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                    value={asset.amortizationYears}
                    onChange={(event) => updateAsset(asset.id, { amortizationYears: Number(event.target.value) || 0 })}
                    onBlur={() => void persist(settings)}
                  />
                </label>
                <div className="rounded-xl bg-white px-3 py-2 text-sm">
                  <div className="text-xs text-slate-500">Dotation / an</div>
                  <div className="mt-1 font-semibold text-slate-950">{formatCurrency(annual)}</div>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    void persist({
                      ...settings,
                      equipmentAssets: settings.equipmentAssets.filter((row) => row.id !== asset.id),
                    })
                  }
                  className="h-10 rounded-xl border border-red-200 px-3 text-red-600 hover:bg-red-50 disabled:opacity-60"
                  aria-label="Supprimer ce matériel"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          {!settings.equipmentAssets.length ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white text-slate-700 shadow-sm">
                <Wrench className="h-5 w-5" />
              </div>
              <div className="mt-3 font-semibold text-slate-950">Aucun matériel amorti</div>
              <p className="mt-1 text-sm text-slate-500">
                Sans matériel renseigné, le prix de revient des tâches n'intègre pas d'amortissement.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Rate({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}
