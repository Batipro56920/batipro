import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  loadChantierBudgetDashboard,
  upsertChantierBudgetSettings,
  type ChantierBudgetDashboard,
} from "../../services/chantierBudget.service";
import {
  createChantierClientBilling,
  createChantierFinancialChangeOrder,
  createChantierFinancialExpense,
  loadChantierFinanceDataset,
  type ChantierFinanceDataset,
} from "../../services/chantierFinance.service";
import { getChantierById, type ChantierRow } from "../../services/chantiers.service";
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
  const [finance, setFinance] = useState<ChantierFinanceDataset | null>(null);
  const [chantier, setChantier] = useState<ChantierRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hourlyRate, setHourlyRate] = useState("48");
  const [marginTargetPct, setMarginTargetPct] = useState("25");
  const [expenseForm, setExpenseForm] = useState({
    supplier_name: "",
    category: "materiaux",
    description: "",
    amount_ht: "",
    tva: "20",
    status: "prevu",
  });
  const [billingForm, setBillingForm] = useState({
    type: "acompte",
    label: "",
    amount_ht: "",
    amount_ttc: "",
    payment_status: "a_facturer",
  });
  const [changeOrderForm, setChangeOrderForm] = useState({
    description: "",
    amount_ht: "",
    status: "propose",
  });

  const lotRows = useMemo(() => dashboard?.lots ?? [], [dashboard]);

  async function refreshBudget() {
    setLoading(true);
    setError(null);
    try {
      const [result, financeResult, chantierResult] = await Promise.all([
        loadChantierBudgetDashboard(chantierId),
        loadChantierFinanceDataset(chantierId),
        getChantierById(chantierId),
      ]);
      setDashboard(result);
      setFinance(financeResult);
      setChantier(chantierResult);
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

  async function addExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createChantierFinancialExpense({
        chantier_id: chantierId,
        supplier_name: expenseForm.supplier_name,
        category: expenseForm.category,
        description: expenseForm.description,
        amount_ht: Number(expenseForm.amount_ht || 0),
        tva: Number(expenseForm.tva || 20),
        status: expenseForm.status as any,
      });
      setExpenseForm({ supplier_name: "", category: "materiaux", description: "", amount_ht: "", tva: "20", status: "prevu" });
      await refreshBudget();
    } catch (err: any) {
      setError(err?.message ?? "Erreur ajout dépense.");
    } finally {
      setSaving(false);
    }
  }

  async function addBilling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createChantierClientBilling({
        chantier_id: chantierId,
        type: billingForm.type as any,
        label: billingForm.label,
        amount_ht: Number(billingForm.amount_ht || 0),
        amount_ttc: Number(billingForm.amount_ttc || billingForm.amount_ht || 0),
        payment_status: billingForm.payment_status as any,
      });
      setBillingForm({ type: "acompte", label: "", amount_ht: "", amount_ttc: "", payment_status: "a_facturer" });
      await refreshBudget();
    } catch (err: any) {
      setError(err?.message ?? "Erreur ajout facturation.");
    } finally {
      setSaving(false);
    }
  }

  async function addChangeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createChantierFinancialChangeOrder({
        chantier_id: chantierId,
        description: changeOrderForm.description,
        amount_ht: Number(changeOrderForm.amount_ht || 0),
        status: changeOrderForm.status as any,
      });
      setChangeOrderForm({ description: "", amount_ht: "", status: "propose" });
      await refreshBudget();
    } catch (err: any) {
      setError(err?.message ?? "Erreur ajout avenant.");
    } finally {
      setSaving(false);
    }
  }

  const expenses = finance?.expenses ?? [];
  const billings = finance?.billings ?? [];
  const financeChangeOrders = finance?.changeOrders ?? [];
  const extraExpensesHt = expenses.reduce((sum, row) => sum + Number(row.amount_ht ?? 0), 0);
  const billedTtc = billings.reduce((sum, row) => sum + Number(row.amount_ttc ?? 0), 0);
  const paidTtc = billings.reduce((sum, row) => sum + Number(row.paid_amount_ttc ?? 0), 0);
  const acceptedChangeOrdersHt = financeChangeOrders
    .filter((row) => row.status === "accepte")
    .reduce((sum, row) => sum + Number(row.amount_ht ?? 0), 0);
  const signedQuoteHt = Number(chantier?.signed_quote_amount_ht ?? dashboard?.chiffreAffairesBaseHt ?? 0);
  const realCostHt = Number(dashboard?.coutReelHt ?? 0) + extraExpensesHt;
  const forecastCostHt =
    Number(chantier?.budget_labor_planned_ht ?? 0) +
    Number(chantier?.budget_materials_planned_ht ?? 0) +
    Number(chantier?.budget_subcontracting_planned_ht ?? 0);
  const expectedRevenueHt = signedQuoteHt + Number(dashboard?.avenantsValidesHt ?? 0) + acceptedChangeOrdersHt;
  const forecastMarginHt = expectedRevenueHt - (forecastCostHt || Number(dashboard?.coutPrevuHt ?? 0));
  const realMarginHt = expectedRevenueHt - realCostHt;
  const remainingToInvoice = Math.max(0, Number(chantier?.signed_quote_amount_ttc ?? expectedRevenueHt) - billedTtc);
  const remainingToCollect = Math.max(0, billedTtc - paidTtc);

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
      {finance && !finance.schemaReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Migration financier chantier non appliquee sur Supabase.
        </div>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {[
          ["Devis signé", formatMoney(signedQuoteHt), "Montant CRM / devis d'origine"],
          ["Coût réel", formatMoney(realCostHt), `Dont dépenses directes ${formatMoney(extraExpensesHt)}`],
          ["Marge prévisionnelle", formatMoney(forecastMarginHt), `${formatPercent((forecastMarginHt / Math.max(1, expectedRevenueHt)) * 100)}`],
          ["Marge réelle", formatMoney(realMarginHt), `${formatPercent((realMarginHt / Math.max(1, expectedRevenueHt)) * 100)}`],
          ["Facturé", formatMoney(billedTtc), "TTC client"],
          ["Encaissé", formatMoney(paidTtc), "TTC reçu"],
          ["Reste à encaisser", formatMoney(remainingToCollect), `Reste à facturer ${formatMoney(remainingToInvoice)}`],
        ].map(([label, value, hint]) => (
          <div key={String(label)} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
            <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{hint}</div>
          </div>
        ))}
      </section>

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

      <section className="grid gap-6 xl:grid-cols-3">
        <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={(event) => void addExpense(event)}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Coûts réels</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Ajouter une dépense</h2>
          <div className="mt-4 space-y-3">
            <input className="w-full rounded-xl border px-3 py-2 text-sm" value={expenseForm.supplier_name} onChange={(e) => setExpenseForm((p) => ({ ...p, supplier_name: e.target.value }))} placeholder="Fournisseur" />
            <select className="w-full rounded-xl border px-3 py-2 text-sm" value={expenseForm.category} onChange={(e) => setExpenseForm((p) => ({ ...p, category: e.target.value }))}>
              {["materiaux", "fournisseur", "sous_traitance", "main_oeuvre", "deplacement", "location_materiel", "imprevu", "autre"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <input className="w-full rounded-xl border px-3 py-2 text-sm" value={expenseForm.description} onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" required />
            <div className="grid grid-cols-2 gap-2">
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={expenseForm.amount_ht} onChange={(e) => setExpenseForm((p) => ({ ...p, amount_ht: e.target.value }))} placeholder="Montant HT" inputMode="decimal" required />
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={expenseForm.tva} onChange={(e) => setExpenseForm((p) => ({ ...p, tva: e.target.value }))} placeholder="TVA" inputMode="decimal" />
            </div>
            <select className="w-full rounded-xl border px-3 py-2 text-sm" value={expenseForm.status} onChange={(e) => setExpenseForm((p) => ({ ...p, status: e.target.value }))}>
              {["prevu", "commande", "recu", "paye"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <button disabled={saving || !finance?.schemaReady} className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">Ajouter dépense</button>
          </div>
        </form>

        <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={(event) => void addBilling(event)}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Facturation client</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Acompte / situation</h2>
          <div className="mt-4 space-y-3">
            <select className="w-full rounded-xl border px-3 py-2 text-sm" value={billingForm.type} onChange={(e) => setBillingForm((p) => ({ ...p, type: e.target.value }))}>
              {["acompte", "situation", "facture_finale", "avoir", "autre"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <input className="w-full rounded-xl border px-3 py-2 text-sm" value={billingForm.label} onChange={(e) => setBillingForm((p) => ({ ...p, label: e.target.value }))} placeholder="Libellé" required />
            <div className="grid grid-cols-2 gap-2">
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={billingForm.amount_ht} onChange={(e) => setBillingForm((p) => ({ ...p, amount_ht: e.target.value }))} placeholder="Montant HT" inputMode="decimal" required />
              <input className="w-full rounded-xl border px-3 py-2 text-sm" value={billingForm.amount_ttc} onChange={(e) => setBillingForm((p) => ({ ...p, amount_ttc: e.target.value }))} placeholder="Montant TTC" inputMode="decimal" />
            </div>
            <select className="w-full rounded-xl border px-3 py-2 text-sm" value={billingForm.payment_status} onChange={(e) => setBillingForm((p) => ({ ...p, payment_status: e.target.value }))}>
              {["a_facturer", "facture", "partiel", "paye", "impaye"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <button disabled={saving || !finance?.schemaReady} className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">Ajouter facturation</button>
          </div>
        </form>

        <form className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={(event) => void addChangeOrder(event)}>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Avenants</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Travaux supplémentaires</h2>
          <div className="mt-4 space-y-3">
            <input className="w-full rounded-xl border px-3 py-2 text-sm" value={changeOrderForm.description} onChange={(e) => setChangeOrderForm((p) => ({ ...p, description: e.target.value }))} placeholder="Description" required />
            <input className="w-full rounded-xl border px-3 py-2 text-sm" value={changeOrderForm.amount_ht} onChange={(e) => setChangeOrderForm((p) => ({ ...p, amount_ht: e.target.value }))} placeholder="Montant HT" inputMode="decimal" required />
            <select className="w-full rounded-xl border px-3 py-2 text-sm" value={changeOrderForm.status} onChange={(e) => setChangeOrderForm((p) => ({ ...p, status: e.target.value }))}>
              {["propose", "accepte", "refuse"].map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <button disabled={saving || !finance?.schemaReady} className="w-full rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50">Ajouter avenant</button>
          </div>
        </form>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <FinanceList title="Achats / dépenses" rows={expenses.map((row) => `${row.description} · ${row.supplier_name ?? "—"} · ${formatMoney(row.amount_ht)} HT · ${row.status}`)} />
        <FinanceList title="Situations / facturation" rows={billings.map((row) => `${row.label} · ${formatMoney(row.amount_ttc)} TTC · encaissé ${formatMoney(row.paid_amount_ttc)} · ${row.payment_status}`)} />
        <FinanceList title="Avenants financiers" rows={financeChangeOrders.map((row) => `${row.description} · ${formatMoney(row.amount_ht)} HT · ${row.status}`)} />
      </section>
    </div>
  );
}

function FinanceList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</div>
      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">Aucune donnée.</div>
        ) : (
          rows.map((row) => (
            <div key={row} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{row}</div>
          ))
        )}
      </div>
    </div>
  );
}
