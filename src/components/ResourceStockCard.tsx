import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getCurrentOrganizationId } from "../services/currentUserProfile.service";
export type ResourceStock = { id: string; kind: "equipment"|"consumable"; available: number; issued: number; returned: number; used: number };
export async function loadResourceStock(): Promise<ResourceStock[]> {
 const {data,error}=await (supabase as any).rpc("resource_stock_summary");
 if(error) throw new Error(error.message);
 return Array.isArray(data)?data:[];
}
export function ResourceStockCard({resourceId,kind}:{resourceId:string;kind:"equipment"|"consumable"}) {
 const [stock,setStock]=useState<ResourceStock|null>(null);
 const [receiving,setReceiving]=useState("");
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 async function refresh(){const rows=await loadResourceStock();setStock(rows.find(r=>r.id===resourceId&&r.kind===kind)??null);}
 useEffect(()=>{void refresh().catch(e=>setError(e.message));},[resourceId,kind]);
 async function receive(){
  const quantity=Number(receiving.replace(",","."));
  if(!Number.isFinite(quantity)||quantity<=0)return;
  setSaving(true);setError("");
  try {
    const organization_id=await getCurrentOrganizationId();
    const {error:failure}=await (supabase as any).from("consumable_stock_receipts").insert({organization_id,resource_id:resourceId,quantity});
    if(failure)throw new Error(failure.message);
    setReceiving("");await refresh();
  }catch(e){setError(e instanceof Error?e.message:"Enregistrement impossible");}finally{setSaving(false);}
 }
 return <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
 <h3 className="font-semibold">Stock et suivi du dépôt</h3>
 <div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded-xl bg-white p-3"><span className="text-slate-500">Disponible au dépôt</span><p className="text-xl font-bold">{stock?.available.toLocaleString("fr-FR")??"—"}</p></div><div className="rounded-xl bg-white p-3"><span className="text-slate-500">Utilisé (total enregistré)</span><p className="text-xl font-bold">{stock?.used.toLocaleString("fr-FR")??"—"}</p></div></div>
 <p className="text-xs text-slate-500">Sorties : {stock?.issued??"—"} · Retours : {stock?.returned??"—"}. Les réservations ne sont pas déduites.</p>
 {kind==="consumable"&&<div className="flex gap-2"><input inputMode="decimal" value={receiving} onChange={e=>setReceiving(e.target.value.replace(".",","))} placeholder="Entrée de stock (ex. 12,5)" className="min-w-0 flex-1 rounded-lg border bg-white p-2 text-sm"/><button disabled={saving||!(Number(receiving.replace(",","."))>0)} onClick={()=>void receive()} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Réceptionner</button></div>}
 {error&&<p className="text-xs text-red-700">{error}</p>}
 </section>;
}
