import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { listChantiers } from "../services/chantiers.service";
import { getCurrentUserProfile } from "../services/currentUserProfile.service";
import { getCompanySettings, normalizeIndirectCosts } from "../services/companySettings.service";
type Row = {id:string; name:string};
type Assignment = {id:string;chantier_id:string;intervenant_id:string|null;start_at:string|null;end_at:string|null;start_date:string|null;duration_days:number|null};
type Booking = {id:string;chantier_id:string;resource_id:string;resource_name:string;quantity:number;planned_for:string;status:string;resource_type:string};
type View = "users"|"sites"|"equipment";
const iso=(d:Date)=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),String(d.getDate()).padStart(2,"0")].join("-");
const shifted=(d:Date,n:number)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const monday=(d:Date)=>shifted(new Date(d.getFullYear(),d.getMonth(),d.getDate()),-(d.getDay()+6)%7);
export default function CentralPlanningPage(){
 const [view,setView]=useState<View>("users"),[week,setWeek]=useState(()=>monday(new Date()));
 const [sites,setSites]=useState<Row[]>([]),[users,setUsers]=useState<Row[]>([]),[equipment,setEquipment]=useState<Row[]>([]);
 const [assignments,setAssignments]=useState<Assignment[]>([]),[bookings,setBookings]=useState<Booking[]>([]);
 const [loading,setLoading]=useState(true),[error,setError]=useState("");
 const days=useMemo(()=>Array.from({length:5},(_,i)=>iso(shifted(week,i))),[week]);
 useEffect(()=>{let active=true;async function run(){setLoading(true);setError("");
  try{
   const profile = await getCurrentUserProfile();
   const role = String(profile?.role ?? "").toUpperCase();
   if (!profile || !role || ["INTERVENANT","OUVRIER","SOUS_TRAITANT","SUBCONTRACTOR"].includes(role)) throw new Error("Planning réservé aux profils bureau.");
   const [siteRows,people,alloc,book,settings]=await Promise.all([
    listChantiers(),
    supabase.from("intervenants").select("id,nom").eq("is_active",true),
    supabase.from("chantier_task_planning_segments").select("id,chantier_id,intervenant_id,start_at,end_at,start_date,duration_days").limit(3000),
    supabase.from("portal_resource_preparations").select("id,chantier_id,resource_id,resource_name,quantity,planned_for,status,resource_type").gte("planned_for",iso(week)).lte("planned_for",iso(shifted(week,6))).neq("status","cancelled").limit(3000),
    getCompanySettings()]);
   if(people.error)throw people.error;if(alloc.error)throw alloc.error;if(book.error)throw book.error;
   if(active){setSites(siteRows.map(s=>({id:s.id,name:s.nom})));setUsers((people.data??[]).map(p=>({id:p.id,name:p.nom})));setAssignments((alloc.data??[]) as Assignment[]);setBookings((book.data??[]) as Booking[]);setEquipment(normalizeIndirectCosts(settings.indirect_costs).equipmentAssets.map(e=>({id:e.id,name:e.name})));}
  }catch(e){if(active)setError(e instanceof Error?e.message:"Planning indisponible");}finally{if(active)setLoading(false);}}
 void run();return()=>{active=false};},[week]);
 const siteNames=new Map(sites.map(s=>[s.id,s.name])),userNames=new Map(users.map(u=>[u.id,u.name]));
 const rows=view==="sites"?sites:view==="users"?users:equipment;
 function forDay(rowId:string,day:string){
  if(view==="equipment")return bookings.filter(b=>b.resource_type==="equipment"&&b.resource_id===rowId&&b.planned_for===day).map(b=>({id:b.id,site:b.chantier_id,label:(siteNames.get(b.chantier_id)??"Chantier")+" · "+b.quantity+" unité(s)",status:b.status==="issued"?"Sorti":"Réservé"}));
  return assignments.filter(a=>{const start=(a.start_at??a.start_date??"").slice(0,10);const end=(a.end_at??"").slice(0,10)||(start?iso(shifted(new Date(start+"T12:00:00"),Math.max(a.duration_days??1,1)-1)):"");return start<=day&&day<=end&&(view==="sites"?a.chantier_id===rowId:a.intervenant_id===rowId);}).map(a=>({id:a.id,site:a.chantier_id,label:view==="sites"?(userNames.get(a.intervenant_id??"")??"Équipe"):(siteNames.get(a.chantier_id)??"Chantier"),status:"Prévu"}));
 }
 return <div className="space-y-5"><header className="rounded-3xl bg-slate-950 p-6 text-white"><p className="text-xs font-semibold uppercase tracking-wider text-blue-300">Production · Bureau</p><h1 className="mt-2 text-2xl font-bold">Planning général</h1><p className="mt-1 text-sm text-slate-300">Utilisateurs, chantiers et réservations de matériel.</p></header>
 <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-xl border bg-white p-1">{([["users","Utilisateurs"],["sites","Chantiers"],["equipment","Matériels"]] as const).map(([key,label])=><button key={key} onClick={()=>setView(key)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${view===key?"bg-blue-100 text-blue-900":"text-slate-500"}`}>{label}</button>)}</div><div className="flex items-center gap-2"><button className="rounded-lg border bg-white p-2" onClick={()=>setWeek(d=>shifted(d,-7))}>←</button><strong className="text-sm">{week.toLocaleDateString("fr-FR",{month:"long",year:"numeric"})}</strong><button className="rounded-lg border bg-white p-2" onClick={()=>setWeek(d=>shifted(d,7))}>→</button><button className="rounded-lg border bg-white px-3 py-2 text-sm" onClick={()=>setWeek(monday(new Date()))}>Aujourd'hui</button></div></div>
 {error&&<p className="rounded-xl bg-red-50 p-3 text-red-700">{error}</p>}
 {loading?<p>Chargement…</p>:<div className="overflow-x-auto rounded-2xl border bg-white"><table className="w-full min-w-[760px] text-sm"><thead><tr className="bg-slate-50"><th className="p-3 text-left">Ressource</th>{days.map(d=><th key={d} className="p-3">{new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"})}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t"><th className="p-3 text-left">{row.name}</th>{days.map(day=><td key={day} className="border-l p-2 align-top">{forDay(row.id,day).map(event=><Link key={event.id} to={`/chantiers/${event.site}/planning`} className="mb-1 block rounded-lg bg-blue-50 p-2 text-xs text-blue-900"><strong>{event.label}</strong><span className="block text-blue-600">{event.status}</span></Link>)}</td>)}</tr>)}</tbody></table>{rows.length===0&&<p className="p-8 text-center text-slate-500">Aucune donnée disponible.</p>}</div>}
 <p className="text-xs text-slate-500">Les affectations proviennent du planning chantier existant ; le matériel provient des réservations du portail ouvrier.</p></div>;
}
