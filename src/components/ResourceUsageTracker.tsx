import { useState } from "react";
import { yearlyUsage, type ResourceUsageEntry } from "../services/companySettings.service";
export function ResourceUsageTracker({ entries, planned, unit, onSave }: {entries?: ResourceUsageEntry[]; planned?: number; unit: string; onSave: (items: ResourceUsageEntry[]) => Promise<void>}) {
 const [year,setYear]=useState(new Date().getFullYear());
 const [date,setDate]=useState(new Date().toLocaleDateString("sv-SE"));
 const [quantity,setQuantity]=useState("");
 const [chantier,setChantier]=useState("");
 const [task,setTask]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const actual=yearlyUsage(entries,year);
 const list=(entries??[]).filter(row=>row.date.startsWith(String(year))).sort((a,b)=>b.date.localeCompare(a.date));
 async function save(next: ResourceUsageEntry[]) {setBusy(true);setError("");try{await onSave(next);}catch(err){setError(err instanceof Error?err.message:"Enregistrement impossible.");}finally{setBusy(false);}}
 const numeric=Number(quantity.replace(",","."));
 return <section className="space-y-3 rounded-2xl border border-blue-100 bg-blue-50/40 p-4">
 <div className="flex flex-wrap items-center justify-between"><h3 className="font-semibold">Suivi d'utilisation annuel</h3><select className="rounded-lg border bg-white p-2" value={year} onChange={e=>setYear(Number(e.target.value))}>{[year-1,year,year+1].map(y=><option key={y} value={y}>{y}</option>)}</select></div>
 <div className="grid grid-cols-2 gap-2"><div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Utilisation réelle</p><strong>{actual.toLocaleString("fr-FR")} {unit}</strong></div><div className="rounded-xl bg-white p-3"><p className="text-xs text-slate-500">Prévision annuelle</p><strong>{planned?.toLocaleString("fr-FR")??"—"} {unit}</strong></div></div>
 {planned&&planned>0?<div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-blue-600" style={{width:Math.min(100,actual/planned*100)+"%"}}/></div>:null}
 <div className="grid grid-cols-2 gap-2"><label className="text-xs">Date<input className="mt-1 w-full rounded-lg border p-2 text-sm" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="text-xs">Quantité ({unit})<input className="mt-1 w-full rounded-lg border p-2 text-sm" type="text" inputMode="decimal" placeholder="3,5" value={quantity} onChange={e=>setQuantity(e.target.value.replace(".",","))}/></label><label className="text-xs">Chantier<input className="mt-1 w-full rounded-lg border p-2 text-sm" value={chantier} onChange={e=>setChantier(e.target.value)}/></label><label className="text-xs">Tâche<input className="mt-1 w-full rounded-lg border p-2 text-sm" value={task} onChange={e=>setTask(e.target.value)}/></label></div>
 <button type="button" disabled={busy||!Number.isFinite(numeric)||numeric<=0} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" onClick={()=>{void save([...(entries??[]),{id:crypto.randomUUID(),date,quantity:numeric,chantier,task}]).then(()=>setQuantity(""));}}>Ajouter un relevé</button>
 {error?<p className="text-sm text-red-700">{error}</p>:null}
 <div className="max-h-44 space-y-1 overflow-auto">{list.map(row=><div className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-xs" key={row.id}><span>{row.date} · {row.quantity.toLocaleString("fr-FR")} {unit} · {row.chantier||"Sans chantier"} {row.task?"· "+row.task:""}</span><button type="button" disabled={busy} className="text-red-700" onClick={()=>{if(window.confirm("Supprimer ce relevé ?"))void save((entries??[]).filter(item=>item.id!==row.id));}}>Supprimer</button></div>)}</div>
 <p className="text-xs text-slate-500">Les relevés ne modifient pas automatiquement les devis existants. Ajustez la prévision après analyse d'une année complète.</p>
 </section>;
}