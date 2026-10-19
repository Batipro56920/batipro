import { ResourceUsageTracker } from "../components/ResourceUsageTracker";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pencil, Plus, Save, Trash2, Wrench, X } from "lucide-react";
import {
  getCompanySettings,
  equipmentEffectiveHourlySale,
  equipmentDailyCost,
  equipmentEffectiveDailySale,
  equipmentHourlyCost,
  equipmentPaybackYears,
  equipmentSuggestedHourlySale,
  normalizeIndirectCosts,
  upsertCompanySettings,
  type CompanyEquipmentAsset,
  type CompanyIndirectCostsSettings,
} from "../services/companySettings.service";

const INPUT = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(value || 0);
}

function emptyAsset(): CompanyEquipmentAsset {
  return { id: "", name: "", quantity: 1, purchaseValueHt: 0, amortizationYears: 5, annualUsageHours: 400, annualMaintenanceHt: 0, hourlySaleRateHt: 0, billingMode: "hour", annualUsageDays: 60, dailySaleRateHt: 0, allocationMode: "task", active: true };
}

export default function EquipmentPage() {
  const [settings, setSettings] = useState<CompanyIndirectCostsSettings | null>(null);
  const [form, setForm] = useState<CompanyEquipmentAsset>(emptyAsset);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [defaultMarginRate, setDefaultMarginRate] = useState(30);

  async function refresh() {
    setLoading(true);
    try {
      const company = await getCompanySettings();
      setSettings(normalizeIndirectCosts(company.indirect_costs));
      setDefaultMarginRate(Number(company.default_margin_rate ?? 30));
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les matériels.");
    } finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  const assets = useMemo(() => settings?.equipmentAssets ?? [], [settings]);
  const totals = useMemo(() => ({
    units: assets.reduce((sum, item) => sum + item.quantity, 0),
    value: assets.reduce((sum, item) => sum + item.purchaseValueHt * item.quantity, 0),
  }), [assets]);

  function openNew() {
    setEditingId(null); setForm(emptyAsset()); setError(null); setDrawerOpen(true);
  }

  function openEdit(asset: CompanyEquipmentAsset) {
    setEditingId(asset.id); setForm({ ...asset }); setError(null); setDrawerOpen(true);
  }

  async function persist(next: CompanyEquipmentAsset[], message: string) {
    if (!settings) return;
    setSaving(true); setError(null);
    try {
      const indirect_costs = { ...settings, equipmentAssets: next };
      const saved = await upsertCompanySettings({ indirect_costs });
      setSettings(normalizeIndirectCosts(saved.indirect_costs));
      setDrawerOpen(false); setNotice(message);
    } catch (err: any) { setError(err?.message ?? "Enregistrement impossible."); }
    finally { setSaving(false); }
  }

  async function save() {
    if (!form.name.trim()) return setError("La désignation est obligatoire.");
    if (form.quantity < 1) return setError("Le nombre doit être au moins égal à 1.");
    if (form.amortizationYears <= 0) return setError("La durée d'amortissement doit être supérieure à 0.");
    if (form.annualUsageHours <= 0) return setError("Le nombre d'heures d'utilisation annuelles doit être supérieur à 0.");
    const item = { ...form, id: editingId ?? crypto.randomUUID(), name: form.name.trim(), allocationMode: "task" as const };
    await persist(editingId ? assets.map((row) => row.id === editingId ? item : row) : [...assets, item], editingId ? "Matériel mis à jour." : "Matériel ajouté.");
  }

  async function saveUsage(entries: NonNullable<CompanyEquipmentAsset["usageEntries"]>) {
    const latest = normalizeIndirectCosts((await getCompanySettings()).indirect_costs);
    const result = await upsertCompanySettings({ indirect_costs: { ...latest, equipmentAssets: latest.equipmentAssets.map(asset => asset.id === form.id ? { ...asset, usageEntries: entries } : asset) } });
    setSettings(normalizeIndirectCosts(result.indirect_costs));
    setForm(current => ({ ...current, usageEntries: entries }));
  }
  if (loading) return <div className="rounded-3xl border bg-white p-8 text-sm text-slate-500">Chargement des matériels…</div>;

  return (
    <div className="space-y-5">
      <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500"><Wrench className="h-6 w-6" /></div>
            <div><div className="text-xs font-semibold uppercase tracking-[.18em] text-blue-300">Ressources</div><h1 className="mt-1 text-2xl font-bold">Matériels</h1><p className="mt-1 text-sm text-slate-300">Une liste simple pour imputer l'usure du matériel aux tâches qui l'utilisent.</p></div>
          </div>
          <button onClick={openNew} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-950"><Plus className="h-4 w-4" /> Ajouter</button>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Summary label="Matériels enregistrés" value={`${assets.length} référence(s) · ${totals.units} unité(s)`} />
        <Summary label="Valeur d'achat totale" value={formatCurrency(totals.value)} />
      </div>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[minmax(0,2fr)_70px_115px_100px_100px_100px_90px] gap-3 border-b bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
          <span>Désignation</span><span>Nombre</span><span>Prix HT</span><span>Usage/an</span><span>Coût / unité</span><span>Vente / unité</span><span />
        </div>
        {assets.map((asset) => (
          <div key={asset.id} className="grid gap-2 border-b border-slate-100 px-5 py-4 last:border-0 md:grid-cols-[minmax(0,2fr)_70px_115px_100px_100px_100px_90px] md:items-center">
            <div><div className="font-semibold text-slate-950">{asset.name}</div><div className="text-xs text-slate-500">Amorti sur {asset.amortizationYears} an(s) · entretien {formatCurrency(asset.annualMaintenanceHt)}/an</div></div><div className="text-sm text-slate-700">{asset.quantity}</div><div className="text-sm text-slate-700">{formatCurrency(asset.purchaseValueHt)}</div><div className="text-sm text-slate-700">{asset.billingMode === "day" ? `${asset.annualUsageDays} j/an` : `${asset.annualUsageHours} h/an`}</div><div className="text-sm font-semibold text-slate-900">{formatCurrency(asset.billingMode === "day" ? equipmentDailyCost(asset) : equipmentHourlyCost(asset))}/{asset.billingMode === "day" ? "j" : "h"}</div><div className="text-sm font-semibold text-blue-700">{formatCurrency(asset.billingMode === "day" ? equipmentEffectiveDailySale(asset, defaultMarginRate) : equipmentEffectiveHourlySale(asset, defaultMarginRate))}/{asset.billingMode === "day" ? "j" : "h"}</div>
            <div className="flex gap-1"><button onClick={() => openEdit(asset)} className="rounded-lg border p-2 text-slate-600" aria-label="Modifier"><Pencil className="h-4 w-4" /></button><button onClick={() => void persist(assets.filter((row) => row.id !== asset.id), "Matériel supprimé.")} className="rounded-lg border border-red-200 p-2 text-red-600" aria-label="Supprimer"><Trash2 className="h-4 w-4" /></button></div>
          </div>
        ))}
        {!assets.length ? <div className="p-10 text-center text-sm text-slate-500">Aucun matériel. Ajoutez uniquement ce qui doit être amorti dans vos prix de vente.</div> : null}
      </section>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">Dans une tâche, sélectionnez le matériel utilisé. Batipro impute son coût réel et son tarif de vente au temps unitaire de la tâche.</div>

      {drawerOpen ? <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40"><div className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><div className="text-xs font-semibold uppercase text-blue-600">Matériel</div><h2 className="text-xl font-bold">{editingId ? "Modifier" : "Ajouter"} un matériel</h2></div><button onClick={() => setDrawerOpen(false)} className="rounded-xl border p-2"><X className="h-5 w-5" /></button></div><div className="mt-6 space-y-4">
        <Field label="Désignation"><input autoFocus className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : marteau-piqueur" /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Nombre"><input type="number" min={1} className={INPUT} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Math.max(1, Math.round(Number(e.target.value) || 1)) })} /></Field><Field label="Prix unitaire HT"><input type="number" min={0} step="0.01" className={INPUT} value={form.purchaseValueHt} onChange={(e) => setForm({ ...form, purchaseValueHt: Math.max(0, Number(e.target.value) || 0) })} /></Field></div>
        <Field label="Durée d'amortissement (années)"><input type="number" min={0.1} step="0.1" className={INPUT} value={form.amortizationYears} onChange={(e) => setForm({ ...form, amortizationYears: Math.max(0, Number(e.target.value) || 0) })} /></Field>
        <Field label="Mode de facturation"><select className={INPUT} value={form.billingMode} onChange={(e) => setForm({ ...form, billingMode: e.target.value === "day" ? "day" : "hour" })}><option value="hour">À l'heure</option><option value="day">Forfait à la journée</option></select></Field>
        {form.billingMode === "day" ? <><Field label="Journées réelles d'utilisation prévues par an"><input type="number" min={1} step={1} className={INPUT} value={form.annualUsageDays} onChange={(e) => setForm({ ...form, annualUsageDays: Math.max(0, Number(e.target.value) || 0) })} /></Field><Field label="Forfait de vente HT par journée (0 = calcul automatique)"><input type="number" min={0} step="0.01" className={INPUT} value={form.dailySaleRateHt} onChange={(e) => setForm({ ...form, dailySaleRateHt: Math.max(0, Number(e.target.value) || 0) })} /></Field><p className="text-xs text-slate-500">Le coût journalier répartit amortissement et entretien sur les journées d'utilisation prévues. Le chiffrage des tâches reste proportionnel au temps (base 7 h/j) pour éviter de facturer un jour entier sur chaque tâche.</p></> : null}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Utilisation estimée (h/an)"><input type="number" min={1} step="1" className={INPUT} value={form.annualUsageHours} onChange={(e) => setForm({ ...form, annualUsageHours: Math.max(0, Number(e.target.value) || 0) })} /></Field><Field label="Entretien + consommables HT/an"><input type="number" min={0} step="0.01" className={INPUT} value={form.annualMaintenanceHt} onChange={(e) => setForm({ ...form, annualMaintenanceHt: Math.max(0, Number(e.target.value) || 0) })} /></Field></div>
        {form.billingMode === "hour" ? <Field label="Tarif de vente HT / heure (facultatif)"><input type="number" min={0} step="0.01" className={INPUT} value={form.hourlySaleRateHt || ""} onChange={(e) => setForm({ ...form, hourlySaleRateHt: Math.max(0, Number(e.target.value) || 0) })} placeholder={`Automatique : ${formatCurrency(equipmentSuggestedHourlySale(form, defaultMarginRate))}`} /></Field> : null}
        <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-3"><Metric label="Coût réel / h" value={formatCurrency(form.billingMode === "day" ? equipmentDailyCost(form) : equipmentHourlyCost(form))} /><Metric label="Vente / h" value={formatCurrency(form.billingMode === "day" ? equipmentEffectiveDailySale(form, defaultMarginRate) : equipmentEffectiveHourlySale(form, defaultMarginRate))} /><Metric label="Rentabilisé en" value={equipmentPaybackYears(form, defaultMarginRate) ? `${equipmentPaybackYears(form, defaultMarginRate)!.toFixed(1)} an(s)` : "—"} /></div>
        {editingId && <ResourceUsageTracker entries={form.usageEntries} unit={form.billingMode === "day" ? "jours" : "heures"} planned={form.billingMode === "day" ? form.annualUsageDays : form.annualUsageHours} onSave={saveUsage} />}
        <button disabled={saving} onClick={() => void save()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" /> Enregistrer</button>
      </div></div></div> : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border bg-white p-4"><div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-xl font-bold text-slate-950">{value}</div></div>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>{children}</label>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><div className="text-xs font-medium text-slate-500">{label}</div><div className="mt-1 font-bold text-slate-950">{value}</div></div>; }
