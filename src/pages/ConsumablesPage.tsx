import { ResourceStockCard } from "../components/ResourceStockCard";
import { ResourceUsageTracker } from "../components/ResourceUsageTracker";
import { useEffect, useState } from "react";
import { getCompanySettings, normalizeIndirectCosts, upsertCompanySettings, consumableUnitCost, cheapestConsumableSupplier, type CompanyConsumable, type CompanyIndirectCostsSettings } from "../services/companySettings.service";
import { listSuppliers, type SupplierRow } from "../services/suppliers.service";

const euro = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const modes: Record<CompanyConsumable["mode"], string> = { quantity: "À la quantité", use: "À l’utilisation", hour: "À l’heure", day: "À la journée" };
const usageUnit = (item: CompanyConsumable) => item.mode === "quantity" ? item.unit : item.mode === "use" ? "utilisation" : item.mode === "hour" ? "heure" : "jour";
function DecimalInput({ value, onChange, label, min = 0 }: { value: number; onChange: (n: number) => void; label: string; min?: number }) {
  const [text, setText] = useState(String(value).replace(".", ","));
  useEffect(() => { setText(String(value).replace(".", ",")); }, [value]);
  return <label className="block text-sm font-medium text-slate-700">{label}
    <input className={field} type="text" inputMode="decimal" autoComplete="off" value={text}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const next = event.target.value.replace(/\./g, ",").replace(/[^0-9,]/g, "");
        if (!/^\d*(,\d*)?$/.test(next)) return;
        setText(next);
        if (next && next !== ",") onChange(Math.max(min, Number(next.replace(",", "."))));
      }}
      onBlur={() => { if (!text || text === ",") { onChange(min); setText(String(min).replace(".", ",")); } }}
    />
  </label>;
}
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
  async function saveUsage(entries: NonNullable<CompanyConsumable["usageEntries"]>) {
    if (!draft?.id) return;
    const latest = normalizeIndirectCosts((await getCompanySettings()).indirect_costs);
    const result = await upsertCompanySettings({ indirect_costs: { ...latest, consumables: latest.consumables.map(item => item.id === draft.id ? { ...item, usageEntries: entries } : item) } });
    setSettings(normalizeIndirectCosts(result.indirect_costs));
    setDraft(current => current ? { ...current, usageEntries: entries } : null);
  }
  function save() {
    if (!draft?.name.trim()) return setError("Désignation obligatoire.");
    if (!draft.suppliers.length || draft.suppliers.some(p => !p.supplierId || p.packageQuantity <= 0 || p.packagePriceHt < 0)) return setError("Renseigner au moins un fournisseur avec un prix et un conditionnement valides.");
    if (draft.usageCapacity <= 0) return setError("Durée de vie invalide.");
    const item = { ...draft, id: draft.id || crypto.randomUUID(), name: draft.name.trim() };
    void persist(draft.id ? records.map(r => r.id === draft.id ? item : r) : [...records, item]);
  }
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div><div className="text-xs font-semibold uppercase tracking-widest text-blue-600">Ressources · Coûts de chantier</div><h1 className="mt-2 text-2xl font-bold text-slate-950">Consommables</h1><p className="mt-1 text-sm text-slate-500">Usure, durée de vie et prix fournisseurs, sans revente directe.</p></div>
      <button className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700" onClick={() => { setDraft(empty()); setError(""); }}>+ Nouveau consommable</button>
    </header>
    {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}

    <div className="divide-y overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{records.map(item => {
      const lowest = cheapestConsumableSupplier(item);
      return <div key={item.id} className="grid gap-4 p-5 md:grid-cols-[minmax(0,1fr)_190px_auto] md:items-center">
        <div><strong className="text-base text-slate-900">{item.name}</strong><p className="mt-1 text-xs text-slate-500">{item.category || "Sans catégorie"} · {modes[item.mode]} · {item.suppliers.length} fournisseur{item.suppliers.length > 1 ? "s" : ""}</p></div>
        <div className="text-sm"><p className="font-bold text-blue-700">{lowest ? euro(consumableUnitCost(item, lowest)) : "—"} / {usageUnit(item)}</p><p className="mt-1 text-xs text-slate-500">{lowest ? suppliers.find(s => s.id === lowest.supplierId)?.name ?? "Fournisseur" : "Tarif indisponible"}</p></div>
        <div className="flex gap-2"><button className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium" onClick={() => setDraft({ ...item, suppliers: item.suppliers.map(p => ({ ...p })) })}>Modifier</button>
        <button className="rounded-lg border px-3 py-1 text-red-700" onClick={() => { if (window.confirm("Supprimer ?")) void persist(records.filter(r => r.id !== item.id)); }}>Supprimer</button></div>
      </div>;
    })}{records.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Aucun consommable enregistré.</p>}</div>
    {draft && <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 p-4"><div className="mx-auto max-w-2xl space-y-5 rounded-3xl bg-white p-6 shadow-2xl md:p-8">
      <div className="flex items-center justify-between border-b pb-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">Ressources</p><h2 className="mt-1 text-xl font-bold">Fiche consommable</h2></div><button className="rounded-lg px-3 py-2 text-sm hover:bg-slate-100" onClick={() => setDraft(null)}>Fermer</button></div>
      <label className="block text-sm">Désignation<input className={field} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })}/></label>
      <label className="block text-sm">Catégorie<input className={field} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })}/></label>
      <label className="block text-sm">Mode de consommation<select className={field} value={draft.mode} onChange={e => setDraft({ ...draft, mode: e.target.value as CompanyConsumable["mode"] })}><option value="quantity">Quantité consommée</option><option value="use">Utilisation</option><option value="hour">Heure</option><option value="day">Journée</option></select></label>
      <label className="block text-sm">Unité de base<input className={field} value={draft.unit} onChange={e => setDraft({ ...draft, unit: e.target.value })}/></label>
      {draft.mode !== "quantity" && <DecimalInput label={draft.mode === "use" ? "Nombre d’utilisations par unité" : draft.mode === "hour" ? "Heures d’utilisation par unité" : "Journées d’utilisation par unité"} min={0.01} value={draft.usageCapacity} onChange={value => setDraft(current => current ? { ...current, usageCapacity: value } : current)}/>}
      <div className="flex justify-between gap-3"><h3 className="font-semibold">Comparaison des fournisseurs</h3><button className="rounded-lg border px-3" onClick={() => setDraft({ ...draft, suppliers: [...draft.suppliers, { id: crypto.randomUUID(), supplierId: "", packagePriceHt: 0, packageQuantity: 1, reference: "" }] })}>Ajouter un tarif</button></div>
      {draft.suppliers.map(price => <div key={price.id} className="space-y-2 rounded-xl border p-3">
        <select className={field} value={price.supplierId} onChange={e => setDraft({ ...draft, suppliers: draft.suppliers.map(p => p.id === price.id ? { ...p, supplierId: e.target.value } : p) })}><option value="">Fournisseur</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <input className={field} placeholder="Référence fournisseur" value={price.reference} onChange={e => setDraft({ ...draft, suppliers: draft.suppliers.map(p => p.id === price.id ? { ...p, reference: e.target.value } : p) })}/>
        <DecimalInput label="Prix du lot HT (€)" value={price.packagePriceHt} onChange={value => setDraft(current => current ? { ...current, suppliers: current.suppliers.map(p => p.id === price.id ? { ...p, packagePriceHt: value } : p) } : current)}/>
        <DecimalInput label="Quantité contenue dans le lot" min={0.01} value={price.packageQuantity} onChange={value => setDraft(current => current ? { ...current, suppliers: current.suppliers.map(p => p.id === price.id ? { ...p, packageQuantity: value } : p) } : current)}/>
        <p className="font-semibold text-blue-700">Coût d'utilisation : {euro(consumableUnitCost(draft, price))}</p>
        <button className="text-sm text-red-700" onClick={() => setDraft({ ...draft, suppliers: draft.suppliers.filter(p => p.id !== price.id) })}>Supprimer ce tarif</button>
      </div>)}
      {draft.id && <ResourceStockCard resourceId={draft.id} kind="consumable" />}
      {draft.id && <ResourceUsageTracker entries={draft.usageEntries} unit={usageUnit(draft)} onSave={saveUsage} />}
      <button disabled={busy} className="w-full rounded-xl bg-blue-600 p-3 font-bold text-white disabled:opacity-50" onClick={save}>Enregistrer</button>
    </div></div>}
  </div>;
}