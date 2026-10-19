import { useEffect, useState } from "react";
import { portalResourceCatalog, portalResourcePreparations, portalResourcePrepare, portalResourceIssue, type PortalResource, type PortalResourcePreparation } from "../services/intervenantPortal.service";

export default function ResourcePreparationPanel({ token, chantierId, phase }: { token: string; chantierId: string; phase: "matin" | "soir" }) {
  const today = new Date().toLocaleDateString("sv-SE");
  const tomorrow = new Date(Date.now() + 86400000).toLocaleDateString("sv-SE");
  const [date, setDate] = useState(phase === "soir" ? tomorrow : today);
  const [catalog, setCatalog] = useState<PortalResource[]>([]);
  const [items, setItems] = useState<PortalResourcePreparation[]>([]);
  const [resourceKey, setResourceKey] = useState("");
  const [quantity, setQuantity] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  async function refresh() {
    const [choices, prepared] = await Promise.all([portalResourceCatalog(token, chantierId), portalResourcePreparations(token, chantierId, date)]);
    setCatalog(choices); setItems(prepared);
  }
  useEffect(() => { let live = true; Promise.all([portalResourceCatalog(token, chantierId), portalResourcePreparations(token, chantierId, date)])
    .then(([choices, prepared]) => { if (live) { setCatalog(choices); setItems(prepared); } })
    .catch(err => { if (live) setError(err instanceof Error ? err.message : "Chargement impossible"); });
    return () => { live = false; };
  }, [token, chantierId, date]);
  const filtered = catalog.filter(x => x.name.toLocaleLowerCase("fr").includes(query.toLocaleLowerCase("fr")));
  async function add() {
    const found = catalog.find(item => item.kind + ":" + item.id === resourceKey);
    const qty = Number(quantity.replace(",", "."));
    if (!found || !Number.isFinite(qty) || qty <= 0) return;
    setBusy(true); setError("");
    try { await portalResourcePrepare(token, chantierId, date, found, qty); await refresh(); setQuantity(""); setResourceKey(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Enregistrement impossible"); }
    finally { setBusy(false); }
  }
  async function issue(id: string) {
    setBusy(true);setError("");
    try { await portalResourceIssue(token, chantierId, id); await refresh(); }
    catch(err){setError(err instanceof Error ? err.message : "Confirmation impossible");}
    finally { setBusy(false); }
  }
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
    <h3 className="font-bold text-slate-900">{phase === "soir" ? "Prévoir les ressources" : "Départ du dépôt et imprévus"}</h3>
    <p className="text-xs text-slate-500">{phase === "soir" ? "Réserve pour une date sans sortie de stock." : "Retrouve les réservations et confirme ce qui part. Ajoute seulement les imprévus."}</p>
    <label className="block text-xs font-medium">Date prévue<input type="date" min={today} value={date} onChange={event => setDate(event.target.value)} className="mt-1 w-full rounded-xl border p-2.5 text-sm"/></label>
    <div className="space-y-2">{items.map(item => <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
      <div><p className="text-sm font-semibold">{item.resource_name}</p><p className="text-xs text-slate-500">{item.quantity.toLocaleString("fr-FR")} {item.unit} · {item.resource_type === "equipment" ? "Matériel" : "Consommable"}</p></div>
      {item.status === "issued" ? <span className="text-xs font-semibold text-emerald-700">Pris au dépôt</span> : phase === "matin" ? <button disabled={busy} onClick={() => void issue(item.id)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Confirmer la prise</button> : <span className="text-xs font-semibold text-blue-700">Réservé</span>}
    </div>)}{!items.length && <p className="text-xs text-slate-500">Aucune préparation pour cette date.</p>}</div>
    <div className="space-y-2 rounded-xl border border-dashed p-3">
      <p className="text-sm font-semibold">{phase === "soir" ? "Ajouter à la préparation" : "Ajouter un imprévu"}</p>
      <input placeholder="Rechercher dans les matériels et consommables" className="w-full rounded-lg border p-2.5 text-sm" value={query} onChange={e => setQuery(e.target.value)}/>
      <select className="w-full rounded-lg border p-2.5 text-sm" value={resourceKey} onChange={e => setResourceKey(e.target.value)}><option value="">Choisir une référence</option>{filtered.map(item => <option key={item.kind+item.id} value={item.kind+":"+item.id}>{item.name} ({item.kind==="equipment"?"Matériel":"Consommable"})</option>)}</select>
      <input className="w-full rounded-lg border p-2.5 text-sm" placeholder="Quantité (ex. 2,5)" inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value.replace(".",","))}/>
      <button disabled={busy || !resourceKey || !(Number(quantity.replace(",","."))>0)} onClick={() => void add()} className="w-full rounded-xl bg-slate-900 p-3 text-sm font-semibold text-white disabled:opacity-40">{phase === "soir" ? "Réserver" : "Ajouter à la liste de départ"}</button>
    </div>
    {error && <p className="text-sm text-red-700">{error}</p>}
  </section>;
}