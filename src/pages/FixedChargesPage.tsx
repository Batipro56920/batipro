import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Calculator, Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import {
  getCompanySettings,
  upsertCompanySettings,
  type CompanyChargeEntry,
} from "../services/companySettings.service";
import { useI18n } from "../i18n";

const CHARGE_CATEGORY_OPTIONS = [
  "assurances",
  "véhicules",
  "salaires",
  "charges sociales",
  "logiciels",
  "comptabilité",
  "banque",
  "locaux",
  "carburant",
  "outillage",
  "communication",
  "sous-traitance",
  "divers",
];

const FREQUENCY_OPTIONS = [
  { value: "one_time" as const, label: "Ponctuelle" },
  { value: "monthly" as const, label: "Mensuelle" },
  { value: "quarterly" as const, label: "Trimestrielle" },
  { value: "annual" as const, label: "Annuelle" },
];

const ALLOCATION_OPTIONS = [
  { value: "general" as const, label: "Entreprise générale" },
  { value: "project" as const, label: "Projet" },
  { value: "chantier" as const, label: "Chantier" },
];

function createDefaultChargeEntry(): CompanyChargeEntry {
  return {
    id: "",
    name: "",
    category: "divers",
    type: "fixed",
    amount: 0,
    isTtc: false,
    vatRecoverable: false,
    frequency: "monthly",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: null,
    allocation: "general",
    comment: "",
    active: true,
  };
}

export default function FixedChargesPage() {
  const { t } = useI18n();
  const [charges, setCharges] = useState<CompanyChargeEntry[]>([]);
  const [chargeForm, setChargeForm] = useState<CompanyChargeEntry>(() => createDefaultChargeEntry());
  const [editingCharge, setEditingCharge] = useState<CompanyChargeEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const settings = await getCompanySettings();
      setCharges(settings.charges_exploitation?.entries ?? []);
      setEditingCharge(null);
      setChargeForm(createDefaultChargeEntry());
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

  function resetChargeForm() {
    setEditingCharge(null);
    setChargeForm(createDefaultChargeEntry());
    setError(null);
    setNotice(null);
  }

  function onEditCharge(entry: CompanyChargeEntry) {
    setEditingCharge(entry);
    setChargeForm(entry);
    setError(null);
    setNotice(null);
  }

  function onDeleteCharge(id: string) {
    setCharges((prev) => prev.filter((entry) => entry.id !== id));
    setEditingCharge(null);
    setChargeForm(createDefaultChargeEntry());
    setNotice("Charge supprimée. Pensez à enregistrer les charges.");
  }

  function onSaveChargeDraft() {
    if (!chargeForm.name.trim()) {
      setError("Le nom de la charge est requis.");
      return;
    }
    if (!Number.isFinite(chargeForm.amount) || chargeForm.amount <= 0) {
      setError("Le montant doit être supérieur à 0.");
      return;
    }

    const nextEntry: CompanyChargeEntry = {
      ...chargeForm,
      id: editingCharge?.id || crypto.randomUUID(),
    };

    setCharges((prev) => {
      if (editingCharge) {
        return prev.map((entry) => (entry.id === editingCharge.id ? nextEntry : entry));
      }
      return [...prev, nextEntry];
    });
    setEditingCharge(null);
    setChargeForm(createDefaultChargeEntry());
    setError(null);
    setNotice(editingCharge ? "Charge mise à jour. Pensez à enregistrer les charges." : "Charge ajoutée. Pensez à enregistrer les charges.");
  }

  async function onSaveChargesSettings() {
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertCompanySettings({
        charges_exploitation: { entries: charges },
      });
      setCharges(saved.charges_exploitation?.entries ?? []);
      setEditingCharge(null);
      setChargeForm(createDefaultChargeEntry());
      setNotice("Charges enregistrées.");
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'enregistrer les charges.");
    } finally {
      setSaving(false);
    }
  }

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
              Gestion des charges structurelles, variables et du seuil de rentabilité estimé.
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
          <button
            type="button"
            onClick={() => void onSaveChargesSettings()}
            disabled={saving || loading}
            className={["inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold", saving || loading ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800"].join(" ")}
          >
            <Save className="h-4 w-4" /> {saving ? t("common.states.saving") : "Enregistrer"}
          </button>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div> : null}
      {loading ? <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement des charges fixes...</div> : null}

      {!loading ? (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Fixes mensuelles" value={formatCurrency(fixedMonthly)} hint="Charges fixes actives" />
            <Metric label="Fixes annuelles" value={formatCurrency(fixedAnnual)} hint="Projection annuelle" />
            <Metric label="Variables mensuelles" value={formatCurrency(variableMonthly)} hint="Charges variables actives" />
            <Metric label="Seuil mensuel estimé" value={formatCurrency(breakEvenMonthly)} hint="Hypothèse marge 30%" />
          </section>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
                <div>
                  <h2 className="font-semibold text-slate-950">Charges d'exploitation</h2>
                  <p className="mt-1 text-sm text-slate-500">Liste utilisée dans la lecture financière et le seuil de rentabilité.</p>
                </div>
                <button
                  type="button"
                  onClick={resetChargeForm}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" /> Nouvelle charge
                </button>
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
                      <Th>Statut</Th>
                      <Th align="right">Montant</Th>
                      <Th align="right">Mensuel</Th>
                      <Th>Actions</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((entry) => (
                      <tr key={entry.id} className="border-t border-slate-100">
                        <Td>{entry.name}</Td>
                        <Td>{entry.category}</Td>
                        <Td>{entry.type === "fixed" ? "Fixe" : "Variable"}</Td>
                        <Td>{frequencyLabel(entry.frequency)}</Td>
                        <Td>{allocationLabel(entry.allocation)}</Td>
                        <Td>{entry.active ? "Actif" : "Inactif"}</Td>
                        <Td align="right">{formatCurrency(entry.amount)}</Td>
                        <Td align="right">{formatCurrency(monthlyEquivalent(entry))}</Td>
                        <Td>
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => onEditCharge(entry)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50" aria-label="Modifier la charge">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" onClick={() => onDeleteCharge(entry.id)} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" aria-label="Supprimer la charge">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    ))}
                    {!charges.length ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-500">Aucune charge définie.</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Éditeur</div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">{editingCharge ? "Modifier une charge" : "Nouvelle charge"}</h2>
                </div>
                {editingCharge ? (
                  <button type="button" onClick={resetChargeForm} className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" aria-label="Annuler la modification">
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="mt-4 space-y-3">
                <Field label="Nom">
                  <input className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={chargeForm.name} onChange={(event) => setChargeForm((prev) => ({ ...prev, name: event.target.value }))} />
                </Field>
                <Field label="Catégorie">
                  <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={chargeForm.category} onChange={(event) => setChargeForm((prev) => ({ ...prev, category: event.target.value }))}>
                    {CHARGE_CATEGORY_OPTIONS.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Type">
                    <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={chargeForm.type} onChange={(event) => setChargeForm((prev) => ({ ...prev, type: event.target.value as CompanyChargeEntry["type"] }))}>
                      <option value="fixed">Charge fixe</option>
                      <option value="variable">Charge variable</option>
                    </select>
                  </Field>
                  <Field label="Montant">
                    <input type="number" step="0.01" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={chargeForm.amount} onChange={(event) => setChargeForm((prev) => ({ ...prev, amount: Number(event.target.value) }))} />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="HT ou TTC">
                    <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={chargeForm.isTtc ? "TTC" : "HT"} onChange={(event) => setChargeForm((prev) => ({ ...prev, isTtc: event.target.value === "TTC" }))}>
                      <option value="HT">HT</option>
                      <option value="TTC">TTC</option>
                    </select>
                  </Field>
                  <Field label="TVA récupérable">
                    <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={chargeForm.vatRecoverable ? "oui" : "non"} onChange={(event) => setChargeForm((prev) => ({ ...prev, vatRecoverable: event.target.value === "oui" }))}>
                      <option value="oui">Oui</option>
                      <option value="non">Non</option>
                    </select>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Fréquence">
                    <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={chargeForm.frequency} onChange={(event) => setChargeForm((prev) => ({ ...prev, frequency: event.target.value as CompanyChargeEntry["frequency"] }))}>
                      {FREQUENCY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Affectation">
                    <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={chargeForm.allocation} onChange={(event) => setChargeForm((prev) => ({ ...prev, allocation: event.target.value as CompanyChargeEntry["allocation"] }))}>
                      {ALLOCATION_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Date de début">
                    <input type="date" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={chargeForm.start_date} onChange={(event) => setChargeForm((prev) => ({ ...prev, start_date: event.target.value }))} />
                  </Field>
                  <Field label="Date de fin">
                    <input type="date" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={chargeForm.end_date ?? ""} onChange={(event) => setChargeForm((prev) => ({ ...prev, end_date: event.target.value || null }))} />
                  </Field>
                </div>
                <Field label="Commentaire">
                  <textarea className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" value={chargeForm.comment} onChange={(event) => setChargeForm((prev) => ({ ...prev, comment: event.target.value }))} />
                </Field>
                <label className="flex items-center gap-3 text-sm text-slate-700">
                  <input type="checkbox" checked={chargeForm.active} onChange={(event) => setChargeForm((prev) => ({ ...prev, active: event.target.checked }))} />
                  Charge active
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button type="button" onClick={onSaveChargeDraft} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  <Plus className="h-4 w-4" /> {editingCharge ? "Mettre à jour" : "Ajouter"}
                </button>
                <button type="button" onClick={resetChargeForm} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Annuler</button>
              </div>
            </section>
          </div>
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-sm text-slate-700">
      <div className="mb-1 text-xs uppercase tracking-[0.18em] text-slate-500">{label}</div>
      {children}
    </label>
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
