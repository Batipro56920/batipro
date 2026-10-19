import { useEffect, useState } from "react";
import { getCompanySettings, normalizeIndirectCosts, upsertCompanySettings, consumableUnitCost, cheapestConsumableSupplier, type CompanyConsumable, type CompanyIndirectCostsSettings } from "../services/companySettings.service";
import { listSuppliers, type SupplierRow } from "../services/suppliers.service";

const euro = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
const field = "w-full rounded-lg border px-3 py-2 text-sm";
const empty = (): CompanyConsumable => ({ id: "", name: "", category: "", unit: "u", mode: "quantity", usageCapacity: 1, suppliers: [], active: true });
export default function ConsumablesPage() {
  const [settings, setSettings] = useState<CompanyIndirectCostsSettings | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [draft, setDraft] = useState<CompanyConsumable | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    Promise.all([getCompanySettings(), listSuppliers()])
      .then(([company, rows]) => { setSettings(normalizeIndirectCosts(company.indirect_costs)); setSuppliers(rows); })
      .catch((err: Error) => setError(err.message));
  }, []);
  const records = settings?.consumables ?? [];
  async function persist(next: CompanyConsumable[]) {
    setBusy(true); setError("");
    try {
      const latest = normalizeIndirectCosts((await getCompanySettings()).indirect_costs);
      const result = await upsertCompanySettings({ indirect_costs: { ...latest, consumables: next } });
      setSettings(normalizeIndirectCosts(result.indirect_costs)); setDraft(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Enregistrement impossible"); }
    finally { setBusy(false); }
  }
  function save() {
    if (!draft?.name.trim()) return setError("Désignation obligatoire.");
    if (!draft.suppliers.length || draft.suppliers.some(p => !p.supplierId || p.packageQuantity <= 0 || p.packagePriceHt < 0)) return setError("Renseigner au moins un fournisseur avec un prix et un conditionnement valides.");
    if (draft.usageCapacity <= 0) return setError("Durée de vie invalide.");
    const item = { ...draft, id: draft.id || crypto.randomUUID(), name: draft.name.trim() };
    void persist(draft.id ? records.map(r => r.id === draft.id ? item : r) : [...records, item]);
  }
  return <div className="space-y-5">
    <header className="rounded-3xl bg-slate-950 p-6 text-white"><h1 className="text-2xl font-bold">Consommables</h1><p className="mt-1 text-sm text-slate-300">Comparer les fournisseurs et calculer le coût de consommation sans revente directe.</p></header>
    {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    <button className="rounded-xl bg-blue-600 px-4 py-2 text-white" onClick={() => setDraft(empty())}>Ajouter un consommable</button>
    <div className="divide-y rounded-2xl border bg-white">{records.map(item => {
      const lowest = cheapestConsumableSupplier(item);
      return <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div><strong>{item.name}</strong><p className="text-xs text-slate-500">{item.category} · {item.mode} · {item.suppliers.length} fournisseur(s)</p></div>
        <div>{lowest ? euro(consumableUnitCost(item, lowest)) : "—"} / {item.mode === "quantity" ? item.unit : item.mode}</div>
        <button className="rounded-lg border px-3 py-1" onClick={() => setDraft(item)}>Modifier</button>
        <button className="rounded-lg border px-3 py-1 text-red-700" onClick={() => { if (window.confirm("Supprimer ?")) void persist(records.filter(r => r.id !== item.id)); }}>Supprimer</button>
      </div>;
    })}</div>
    {draft && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4"><div className="mx-auto max-w-2xl space-y-4 rounded-2xl bg-white p-6">
      <div className="flex justify-between"><h2 className="text-xl font-bold">Fiche consommable</h2><button onClick={() => setDraft(null)}>Fermer</button></div>
      <label className="block text-sm">Désignation<input className={field} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
      <label className="block text-sm">Catégorie<input className={field} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}/></label>
      <label className="block text-sm">Mode<select className={field} value={draft.mode} onChange={e => setDraft({ ...draft, mode: e.target.value as CompanyConsumable["mode"] })}><option value="quantity">Quantité consommée</option><option value="use">Utilisation</option><option value="hour">Heure</option><option value="day">Journée</option></select></label>
      <label className="block text-sm">Unité de base<input className={field} value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}/></label>
      {draft.mode !== "quantity" && <label className="block text-sm">Capacité par unité (utilisations, h ou jours)<input className={field} type="number" min="1" value={draft.usageCapacity} onChange={e => setDraft({ ...draft, usageCapacity: Number(e.target.value) })}/></label>}
      <div className="flex justify-between"><h3 className="font-semibold">Comparaison fournisseurs</h3><button className="rounded-lg border px-3" onClick={() => setDraft({ ...draft, suppliers: [...draft.suppliers, { id: crypto.randomUUID(), supplierId: "", packagePriceHt: 0, packageQuantity: 1, reference: "" }] })}>Ajouter un tarif</button></div>
      {draft.suppliers.map(price => <div key={price.id} className="space-y-2 rounded-xl border p-3">
        <select className={field} value={price.supplierId} onChange={e => setDraft({ ...draft, suppliers: draft.suppliers.map(p => p.id === price.id ? { ...p, supplierId: e.target.value } : p) })}><option value="">Fournisseur</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input className={field} placeholder="Référence fournisseur" value={price.reference} onChange={e => setDraft({ ...draft, suppliers: draft.suppliers.map(p => p.id === price.id ? { ...p, reference: e.target.value } : p) })}/>
        <label className="block text-sm">Prix du lot HT<input className={field} type="number" min="0" step="0.01" value={price.packagePriceHt} onChange={e => setDraft({ ...draft, suppliers: draft.suppliers.map(p => p.id === price.id ? { ...p, packagePriceHt: Number(e.target.value) } : p) })}/></label>
        <label className="block text-sm">Unités dans le lot<input className={field} type="number" min="0.01" step="0.01" value={price.packageQuantity} onChange={e => setDraft({ ...draft, suppliers: draft.suppliers.map(p => p.id === price.id ? { ...p, packageQuantity: Number(e.target.value) } : p) })}/></label>
        <p className="font-semibold text-blue-700">Coût d'utilisation : {euro(consumableUnitCost(draft, price))}</p>
        <button className="text-sm text-red-700" onClick={() => setDraft({ ...draft, suppliers: draft.suppliers.filter(p => p.id !== price.id) })}>Supprimer ce tarif</button>
      </div>)}
      <button disabled={busy} className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white disabled:opacity-50" onClick={save}>Enregistrer</button>
    </div></div>}
  </div>;
}