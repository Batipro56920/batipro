import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Calculator, RefreshCw, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import {
  getCompanySettings,
  type CompanyChargeEntry,
} from "../services/companySettings.service";

export default function FixedChargesPage() {
  const [charges, setCharges] = useState<CompanyChargeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const settings = await getCompanySettings();
      setCharges(settings.charges_exploitation?.entries ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les charges fixes.");
      setCharges([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const activeCharges = useMemo(() => charges.filter((entry) => entry.active), [charges]);
  const fixedCharges = useMemo(() => activeCharges.filter((entry) => entry.type === "fixed"), [activeCharges]);
  const variableCharges = useMemo(() => activeCharges.filter((entry) => entry.type === "variable"), [activeCharges]);
  const fixedMonthly = fixedCharges.reduce((sum, entry) => sum + monthlyEquivalent(entry), 0);
  const fixedAnnual = fixedCharges.reduce((sum, entry) => sum + annualEquivalent(entry), 0);
  const variableMonthly = variableCharges.reduce((sum, entry) => sum + monthlyEquivalent(entry), 0);
  const exploitationAnnual = fixedAnnual + variableMonthly * 12;
  const exploitationMonthly = exploitationAnnual / 12;
  const breakEvenMonthly = exploitationMonthly / 0.7;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-900 text-white">
            <Calculator className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Financier</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">Charges fixes</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Lecture dirigeant des charges structurelles et du seuil de rentabilité estimé.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" /> Rafraîchir
          </button>
          <Link
            to="/entreprise/charges"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Settings className="h-4 w-4" /> Gérer les charges
          </Link>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement des charges fixes...</div> : null}

      {!loading ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Fixes mensuelles" value={formatCurrency(fixedMonthly)} hint="Charges fixes actives" />
            <Metric label="Fixes annuelles" value={formatCurrency(fixedAnnual)} hint="Projection annuelle" />
            <Metric label="Variables mensuelles" value={formatCurrency(variableMonthly)} hint="Charges variables actives" />
            <Metric label="Seuil mensuel estimé" value={formatCurrency(breakEvenMonthly)} hint="Hypothèse marge 30%" />
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-semibold text-slate-950">Charges actives</h2>
              <p className="mt-1 text-sm text-slate-500">Charges prises en compte dans la lecture financière.</p>
            </div>
            <div className="overflow-x-auto p-4">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <Th>Nom</Th>
                    <Th>Catégorie</Th>
                    <Th>Type</Th>
                    <Th>Fréquence</Th>
                    <Th>Affectation</Th>
                    <Th align="right">Montant</Th>
                    <Th align="right">Mensuel</Th>
                  </tr>
                </thead>
                <tbody>
                  {activeCharges.map((entry) => (
                    <tr key={entry.id} className="border-t border-slate-100">
                      <Td>{entry.name}</Td>
                      <Td>{entry.category}</Td>
                      <Td>{entry.type === "fixed" ? "Fixe" : "Variable"}</Td>
                      <Td>{frequencyLabel(entry.frequency)}</Td>
                      <Td>{allocationLabel(entry.allocation)}</Td>
                      <Td align="right">{formatCurrency(entry.amount)}</Td>
                      <Td align="right">{formatCurrency(monthlyEquivalent(entry))}</Td>
                    </tr>
                  ))}
                  {!activeCharges.length ? (
                    <tr>
                      <Td>Aucune charge active.</Td>
                      <Td />
                      <Td />
                      <Td />
                      <Td />
                      <Td />
                      <Td />
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{hint}</div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: ReactNode; align?: "left" | "right" }) {
  return <th className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"} font-medium`}>{children}</th>;
}

function Td({ children, align = "left" }: { children?: ReactNode; align?: "left" | "right" }) {
  return <td className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"} text-slate-700`}>{children}</td>;
}

function monthlyEquivalent(entry: CompanyChargeEntry) {
  switch (entry.frequency) {
    case "monthly":
      return entry.amount;
    case "quarterly":
      return entry.amount / 3;
    case "annual":
      return entry.amount / 12;
    case "one_time":
    default:
      return 0;
  }
}

function annualEquivalent(entry: CompanyChargeEntry) {
  if (entry.frequency === "annual") return entry.amount;
  return monthlyEquivalent(entry) * 12;
}

function frequencyLabel(value: CompanyChargeEntry["frequency"]) {
  if (value === "monthly") return "Mensuelle";
  if (value === "quarterly") return "Trimestrielle";
  if (value === "annual") return "Annuelle";
  return "Ponctuelle";
}

function allocationLabel(value: CompanyChargeEntry["allocation"]) {
  if (value === "project") return "Projet";
  if (value === "chantier") return "Chantier";
  return "Entreprise générale";
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
}
