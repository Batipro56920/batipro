import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { listChantiers } from "../services/chantiers.service";
import { getCurrentUserProfile } from "../services/currentUserProfile.service";
import { getCompanySettings, normalizeIndirectCosts } from "../services/companySettings.service";
type Row = {id:string; name:string};
type Assignment = {id:string;chantier_id:string;intervenant_id:string|null;start_at:string|null;end_at:string|null;start_date:string|null;duration_days:number|null};
type Booking = {office_assignment_id?:string|null;id:string;chantier_id:string;resource_id:string;resource_name:string;quantity:number;planned_for:string;status:string;resource_type:string};
type View = "users"|"sites"|"equipment";
const iso=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const shifted=(d:Date,n:number)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const monday=(d:Date)=>shifted(new Date(d.getFullYear(),d.getMonth(),d.getDate()),-(d.getDay()+6)%7);
export default function CentralPlanningPage(){
 const [view,setView]=useState<View>("users"),[week,setWeek]=useState(()=>monday(new Date()));
 const [sites,setSites]=useState<Row[]>([]),[users,setUsers]=useState<Row[]>([]),[equipment,setEquipment]=useState<Row[]>([]);
 const [assignments,setAssignments]=useState<Assignment[]>([]),[bookings,setBookings]=useState<Booking[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const [chosenEquipment,setChosenEquipment]=useState<string[]>([]);
 const [editingId,setEditingId]=useState<string|null>(null);
 const [office,setOffice]=useState<{id:string;chantier_id:string;intervenant_id:string;date_start:string;date_end:string}[]>([]);
 const [formOpen,setFormOpen]=useState(false),[siteId,setSiteId]=useState(""),[workerId,setWorkerId]=useState(""),[start,setStart]=useState(iso(new Date())),[end,setEnd]=useState(iso(new Date())),[saving,setSaving]=useState(false);
 const days=useMemo(()=>Array.from({length:5},(_,i)=>iso(shifted(week,i))),[week]);
 useEffect(()=>{let active=true;async function run(){setLoading(true);setError("");
  try{
   const profile = await getCurrentUserProfile();
   const role = String(profile?.role ?? "").toUpperCase();
   if (!profile || !role || ["INTERVENANT","OUVRIER","SOUS_TRAITANT","SUBCONTRACTOR"].includes(role)) throw new Error("Planning réservé aux profils bureau.");
   // Chaque section se charge séparément : un module indisponible ne vide plus le planning entier.
   const results=await Promise.allSettled([
    listChantiers(),
    supabase.from("intervenants").select("id,nom").eq("is_active",true).is("archived_at",null),
    supabase.from("chantier_task_planning_segments").select("id,chantier_id,intervenant_id,start_at,end_at,start_date,duration_days").limit(3000),
    (supabase as any).from("portal_resource_preparations").select("id,chantier_id,resource_id,resource_name,quantity,planned_for,status,resource_type,office_assignment_id").gte("planned_for",iso(week)).lte("planned_for",iso(shifted(week,6))).neq("status","cancelled").limit(3000),
    getCompanySettings(),
    (supabase as any).from("office_planning_assignments").select("id,chantier_id,intervenant_id,date_start,date_end").lte("date_start",iso(shifted(week,6))).gte("date_end",iso(week)).limit(3000)
   ]);
   if(!active)return;
   const errors:string[]=[];
   function dataAt(index:number,label:string): any{
    const result=results[index];
    if(result.status==="rejected"){errors.push(label+": "+String(result.reason instanceof Error?result.reason.message:result.reason));return null;}
    const value=result.value as {data?:unknown;error?:{message?:string}};
    if(value?.error){errors.push(label+": "+(value.error.message??"Erreur de lecture"));return null;}
    return value;
   }
   const sitesResult=dataAt(0,"Chantiers");
   if(sitesResult) setSites((sitesResult as {id:string;nom:string}[]).map(site=>({id:site.id,name:site.nom})));
   const workersResult=dataAt(1,"Intervenants");
   if(workersResult) setUsers((workersResult.data??[]).map((person:{id:string;nom:string})=>({id:person.id,name:person.nom})));
   const allocResult=dataAt(2,"Tâches planifiées");
   if(allocResult)setAssignments((allocResult.data??[]) as Assignment[]);
   const bookingsResult=dataAt(3,"Réservations de matériel");
   if(bookingsResult)setBookings((bookingsResult.data??[]) as Booking[]);
   const settingsResult=dataAt(4,"Catalogue matériels");
   if(settingsResult)setEquipment(normalizeIndirectCosts(settingsResult.indirect_costs).equipmentAssets.map((item:{id:string;name:string})=>({id:item.id,name:item.name})));
   const officeResult=dataAt(5,"Affectations du bureau");
   if(officeResult)setOffice(officeResult.data??[]);
   if(errors.length)setError("Chargement partiel : "+errors.join(" · "));
  }catch(e){if(active)setError(e instanceof Error?e.message:"Planning indisponible");}finally{if(active)setLoading(false);}}
 void run();return()=>{active=false};},[week]);
 async function assign(){if(!siteId||!workerId||end<start)return;setSaving(true);setError("");try{const {data,error}=await (supabase as any).rpc("office_planning_save",{p_id:editingId,p_chantier:siteId,p_worker:workerId,p_start:start,p_end:end,p_equipment:chosenEquipment});if(error)throw error;setOffice(x=>[...x.filter(item=>item.id!==data),{id:data,chantier_id:siteId,intervenant_id:workerId,date_start:start,date_end:end}]);setFormOpen(false);setChosenEquipment([]);setEditingId(null);setWeek(monday(new Date(start+"T12:00:00")));}catch(e){setError(e instanceof Error?e.message:"Affectation impossible");}finally{setSaving(false);}}
 async function edit(item:{id:string;chantier_id:string;intervenant_id:string;date_start:string;date_end:string}){setEditingId(item.id);setSiteId(item.chantier_id);setWorkerId(item.intervenant_id);setStart(item.date_start);setEnd(item.date_end);setChosenEquipment(bookings.filter(b=>(b as Booking & {office_assignment_id?:string}).office_assignment_id===item.id).map(b=>b.resource_id));setFormOpen(true);}

 const siteNames=new Map(sites.map(s=>[s.id,s.name])),userNames=new Map(users.map(u=>[u.id,u.name]));
 const rows=view==="sites"?sites:view==="users"?users:equipment;
 function forDay(rowId:string,day:string){
  if(view==="equipment")return bookings.filter(b=>{const a=office.find(x=>x.id===b.office_assignment_id);return b.resource_type==="equipment"&&b.resource_id===rowId&&(a?a.date_start<=day&&a.date_end>=day:b.planned_for===day);}).map(b=>({id:b.id,site:b.chantier_id,label:(siteNames.get(b.chantier_id)??"Chantier")+" · "+b.quantity+" unité(s)",status:b.status==="issued"?"Sorti":"Réservé"}));
  const added=office.filter(a=>a.date_start<=day&&a.date_end>=day&&(view==="sites"?a.chantier_id===rowId:a.intervenant_id===rowId)).map(a=>({id:a.id,site:a.chantier_id,label:view==="sites"?(userNames.get(a.intervenant_id)??"Ouvrier"):(siteNames.get(a.chantier_id)??"Chantier"),status:"Affecté"}));
  return added.concat(assignments.filter(a=>{const start=(a.start_at??a.start_date??"").slice(0,10);const end=(a.end_at??"").slice(0,10)||(start?iso(shifted(new Date(start+"T12:00:00"),Math.max(a.duration_days??1,1)-1)):"");return start<=day&&day<=end&&(view==="sites"?a.chantier_id===rowId:a.intervenant_id===rowId);}).map(a=>({id:a.id,site:a.chantier_id,label:view==="sites"?(userNames.get(a.intervenant_id??"")??"Équipe"):(siteNames.get(a.chantier_id)??"Chantier"),status:"Prévu"})));
 }
 return <div className="space-y-5"><header className="rounded-3xl bg-slate-950 p-6 text-white"><p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Production · Bureau</p><h1 className="mt-2 text-2xl font-bold">Planning général</h1><p className="mt-1 text-sm text-slate-300">Utilisateurs, chantiers et réservations de matériel.</p></header>
 <button onClick={()=>{setEditingId(null);setChosenEquipment([]);setFormOpen(x=>!x)}} className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">+ Nouvelle affectation</button>
 {formOpen&&<section className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2"><label>Chantier<select className="mt-1 w-full rounded-lg border p-2" value={siteId} onChange={e=>setSiteId(e.target.value)}><option value="">Choisir</option>{sites.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Ouvrier<select className="mt-1 w-full rounded-lg border p-2" value={workerId} onChange={e=>setWorkerId(e.target.value)}><option value="">Choisir</option>{users.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Du<input className="mt-1 w-full rounded-lg border p-2" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label>Au<input className="mt-1 w-full rounded-lg border p-2" type="date" min={start} value={end} onChange={e=>setEnd(e.target.value)}/></label><div className="sm:col-span-2"><p className="mb-2 text-sm font-semibold">Matériel à réserver</p><div className="grid max-h-44 gap-2 overflow-y-auto sm:grid-cols-2">{equipment.map(item=><label key={item.id} className="flex gap-2 rounded-lg border p-2 text-sm"><input type="checkbox" checked={chosenEquipment.includes(item.id)} onChange={e=>setChosenEquipment(old=>e.target.checked?[...old,item.id]:old.filter(id=>id!==item.id))}/>{item.name}</label>)}</div><p className="mt-2 text-xs text-amber-700">Le matériel sélectionné est réservé avec l'affectation, sans sortie de stock avant confirmation du matin.</p></div><button disabled={saving||!workerId||!siteId||end<start} className="rounded-lg bg-blue-600 p-2 text-white disabled:opacity-50" onClick={()=>void assign()}>{editingId?"Modifier l’affectation":"Enregistrer l’affectation"}</button></section>}
 <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-xl border bg-white p-1">{([["users","Utilisateurs"],["sites","Chantiers"],["equipment","Matériels"]] as const).map(([key,label])=><button key={key} onClick={()=>setView(key)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view===key?"bg-blue-100 text-blue-900":"text-slate-500"}`}>{label}</button>)}</div><div className="flex items-center gap-2"><button className="rounded-lg border bg-white p-2" onClick={()=>setWeek(d=>shifted(d,-7))}>←</button><strong className="text-sm">{week.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</strong><button className="rounded-lg border bg-white p-2" onClick={()=>setWeek(d=>shifted(d,7))}>→</button><button className="rounded-lg border bg-white px-3 py-2 text-sm" onClick={()=>setWeek(monday(new Date()))}>Aujourd'hui</button></div></div>
 {error&&<p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
 {loading?<p>Chargement…</p>:<div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[760px] text-sm"><thead><tr className="bg-slate-50"><th className="p-3 text-left">Ressource</th>{days.map(d=><th key={d} className="p-3">{new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><th className="p-3 text-left">{row.name}</th>{days.map(day=><td key={day} className="border-l p-2 align-top">{forDay(row.id,day).map(event=><Link key={event.id} to={`/chantiers/${event.site}/planning`} className="mb-1 block rounded-lg bg-blue-50 p-2 text-xs text-blue-900"><strong>{event.label}</strong><span className="block text-blue-600">{event.status}</span></Link>)}</td>)}</tr>)}</tbody></table>{rows.length===0&&<p className="p-8 text-center text-slate-500">Aucune donnée disponible.</p>}</div>}
 <section className="rounded-2xl border bg-white p-4"><h2 className="mb-3 font-semibold">Affectations du bureau · modifier</h2><div className="space-y-2">{office.map(item=><div key={item.id} className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm"><span>{userNames.get(item.intervenant_id)??"Ouvrier"} · {siteNames.get(item.chantier_id)??"Chantier"} · {item.date_start} → {item.date_end}</span><button className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800" onClick={()=>void edit(item)}>Modifier</button></div>)}</div></section>
 <p className="text-xs text-slate-500">Les affectations proviennent du planning chantier existant ; le matériel provient des réservations du portail ouvrier.</p></div>;
}
