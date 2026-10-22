import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Wrench } from "lucide-react";
import {
  getCompanySettings,
  normalizeIndirectCosts,
  upsertCompanySettings,
  DEFAULT_PRODUCTIVE_HOURS_PER_EMPLOYEE_YEAR,
  getInvestmentMonthlyTotal,
  type CompanyIndirectCostsSettings,
} from "../../../services/companySettings.service";
import { getCompanyHourlyRates, type CompanyHourlyRates } from "../../../services/indirectCosts.service";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0,
  );
}

export default function IndirectCostsPanel({ chargesVersion = 0 }: { chargesVersion?: number }) {
  const [settings, setSettings] = useState<CompanyIndirectCostsSettings | null>(null);
  const [rates, setRates] = useState<CompanyHourlyRates | null>(null);
  const [investmentAnnual, setInvestmentAnnual] = useState(0);
  const [dayHours, setDayHours] = useState("7");
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
      setInvestmentAnnual(getInvestmentMonthlyTotal(company.investment_plan?.entries ?? []) * 12);
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

  const missingEmployees = rates.productiveEmployeeCount === 0;
  // Un salarie actif sans cout horaire : soit c'est un poste administratif et
  // c'est normal, soit c'est un ouvrier dont le cout manque et son temps est
  // chiffre a zero. Le dire plutot que de laisser deviner.
  const withoutHourlyCost = Math.max(0, rates.activeEmployeeCount - rates.productiveEmployeeCount);

  const annualHours = rates.productiveHoursPerYear;
  const hourlyLabor = rates.averageEmployeeHourlyCostHt;
  const hourlyGeneral = annualHours > 0 ? Math.max(0, rates.overheadAnnualHt - investmentAnnual) / annualHours : 0;
  const hourlyInvestment = annualHours > 0 ? investmentAnnual / annualHours : 0;
  const hourlyEquipmentGeneral = rates.amortizationRatePerHour;
  const hoursPerDay = Number(dayHours.replace(",", "."));
  const validHours = Number.isFinite(hoursPerDay) && hoursPerDay > 0 && hoursPerDay <= 24;
  const levels = [
    { name: "Coût salarial seul", hour: hourlyLabor, detail: "Coût horaire chargé moyen des ouvriers" },
    { name: "Salaire + frais généraux", hour: hourlyLabor + hourlyGeneral, detail: "Hors investissements et matériels" },
    { name: "Salaire + frais généraux + investissements", hour: hourlyLabor + hourlyGeneral + hourlyInvestment, detail: "Coût de structure complet, hors matériel imputé aux tâches" },
    { name: "Avec matériel général", hour: hourlyLabor + hourlyGeneral + hourlyInvestment + hourlyEquipmentGeneral, detail: "Uniquement l’amortissement du matériel général non affecté aux tâches" },
  ];
  const markup = Math.max(0, rates.defaultLaborMarginRate);
  const money=(value:number)=>formatCurrency(value);
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h2 className="font-semibold text-slate-950">Coûts indirects imputés aux tâches</h2>
        <p className="mt-1 text-sm text-slate-500">
          Les frais généraux sont répartis sur les heures productives. Le matériel lié à une tâche est calculé séparément
          selon son temps unitaire, afin de ne jamais le compter deux fois.
        </p>
      </div>

      {error ? <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div> : null}

      <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        <Rate label="Coût horaire moyen ouvrier" value={`${formatCurrency(rates.averageEmployeeHourlyCostHt)}/h`} hint={`${rates.productiveEmployeeCount} salarié(s) au temps vendu`} />
        <Rate label="Heures productives / an" value={`${rates.productiveHoursPerYear.toLocaleString("fr-FR")} h`} hint={`${rates.productiveEmployeeCount} × ${rates.productiveHoursPerEmployeeYear} h`} />
        <Rate label="Matériel général historique" value={`${formatCurrency(rates.amortizationRatePerHour)}/h`} hint={`${formatCurrency(rates.amortizationAnnualHt)} / an`} />
        <Rate label="Frais généraux" value={`${formatCurrency(rates.overheadRatePerHour)}/h`} hint={`${formatCurrency(rates.overheadAnnualHt)} / an`} />
      </div>

      <div className="border-t border-slate-100 p-4 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h3 className="text-lg font-bold text-slate-950">Coût de revient et prix de vente par ouvrier</h3><p className="text-sm text-slate-500">Montants HT calculés par heure productive vendue, avec les frais détaillés séparément.</p></div>
          <label className="text-sm font-semibold text-slate-700">Heures par journée
            <input className="mt-1 block w-32 rounded-xl border border-slate-200 px-3 py-2" type="text" inputMode="decimal" value={dayHours} onChange={e=>setDayHours(e.target.value.replace(".", ","))}/>
          </label>
        </div>
        {!validHours && <p className="text-sm text-red-700">Indiquez un nombre d'heures par journée entre 0 et 24.</p>}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[650px] text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="p-3 text-left">Composition</th><th className="p-3 text-right">Coût / h</th><th className="p-3 text-right">Coût / jour</th><th className="p-3 text-right">Vente / h</th><th className="p-3 text-right">Vente / jour</th></tr></thead>
            <tbody>{levels.map((level,index)=><tr key={level.name} className={index===2?"border-t bg-blue-50/60 font-semibold":"border-t"}>
              <td className="p-3"><div>{level.name}</div><div className="text-xs font-normal text-slate-500">{level.detail}</div></td>
              <td className="p-3 text-right">{money(level.hour)}</td>
              <td className="p-3 text-right">{validHours?money(level.hour*hoursPerDay):"—"}</td>
              <td className="p-3 text-right">{money(level.hour*(1+markup/100))}</td>
              <td className="p-3 text-right">{validHours?money(level.hour*hoursPerDay*(1+markup/100)):"—"}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">Prix de vente simulé avec une majoration sur coût de {markup.toLocaleString("fr-FR")}% (taux de main-d’œuvre enregistré). Les matériaux, consommables et matériels affectés directement aux tâches sont à chiffrer séparément. Les investissements sont isolés des frais généraux pour éviter leur double comptabilisation.</p>
        <p className="text-xs text-amber-800">Vérifiez que les salaires des ouvriers déjà pris en compte dans leur coût horaire chargé ne sont pas aussi saisis dans les charges d'exploitation : ils seraient alors comptés deux fois. Les heures réellement facturables déterminent ces ratios.</p>
      </div>

      {missingEmployees ? (
        <div className="mx-4 mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Aucun salarié actif de statut "Salarié" ne porte de coût horaire chargé dans Profils &amp; accès : les coûts
          horaires d'amortissement et de frais généraux restent à 0 tant qu'il n'y a pas d'heures productives à répartir.
        </div>
      ) : null}

      {!missingEmployees && withoutHourlyCost > 0 ? (
        <div className="mx-4 mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {withoutHourlyCost} salarié(s) actif(s) sans coût horaire chargé : leur temps n'entre ni dans le coût horaire
          moyen, ni dans les heures vendues. C'est ce qu'il faut pour un poste administratif — son salaire se saisit
          alors dans les charges fixes, catégorie "salaires", et ressort au prix de revient par le coût horaire des
          frais généraux. Si c'est un ouvrier, renseignez son coût horaire : sans lui son temps est chiffré à zéro.
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
            disabled={saving}
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
        <Link to="/materiels" className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4 hover:border-blue-200 hover:bg-blue-50">
          <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white"><Wrench className="h-5 w-5" /></span><span><span className="block font-semibold text-slate-950">Gérer les matériels</span><span className="block text-sm text-slate-500">{settings.equipmentAssets.length} référence(s) dans la liste</span></span></span>
          <ArrowRight className="h-5 w-5 text-slate-500" />
        </Link>
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
