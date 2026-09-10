import { BarChart3, Bell, CheckCircle2, Inbox, Link2, MessageSquareText, Radio, Send, Sparkles } from "lucide-react";
import type { Campaign, CampaignItem } from "./types";

type Props={campaigns:Campaign[];items:(CampaignItem&{campaign_title?:string})[];onNavigate:(view:string)=>void};
const modules=[
  ["Créer","Rédiger et décliner une publication pour chaque réseau.",Sparkles,"composer"],
  ["Validations","Relire avec Marie, corriger puis approuver.",CheckCircle2,"validations"],
  ["Planning","Programmer et déplacer les publications.",Send,"calendrier"],
  ["Boîte de réception","Messages, commentaires, mentions et avis.",Inbox,"inbox"],
  ["Statistiques","Portée, engagement, clics et leads.",BarChart3,"statistiques"],
  ["Veille","Marque, concurrents, tendances et réputation.",Radio,"veille"],
  ["Connexions","Facebook, Instagram, LinkedIn et Google.",Link2,"connexions"],
] as const;
export function CommunicationOverview({campaigns,items,onNavigate}:Props){
 const planned=items.filter(item=>item.status==="scheduled").length;
 return <div className="space-y-5"><section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Campagnes actives",campaigns.filter(c=>c.status==="active").length],["À valider",items.filter(i=>i.status==="to_review").length],["Planifiées",planned],["Alertes",0]].map(([label,value],index)=><div key={String(label)} className="rounded-2xl border border-subtle bg-surface p-4"><div className="flex items-center justify-between"><p className="text-sm text-muted">{label}</p>{index===3?<Bell className="h-4 w-4 text-muted"/>:null}</div><strong className="mt-2 block text-3xl text-ink">{value}</strong></div>)}</section><section><h2 className="text-lg font-semibold text-ink">Piloter la communication</h2><div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{modules.map(([title,description,Icon,view])=><button key={title} onClick={()=>onNavigate(view)} className="group rounded-2xl border border-subtle bg-surface p-5 text-left shadow-sm transition hover:border-primary"><Icon className="h-6 w-6 text-primary"/><h3 className="mt-4 font-semibold text-ink">{title}</h3><p className="mt-1 text-sm text-muted">{description}</p></button>)}</div></section><section className="rounded-2xl border border-subtle bg-surface p-5"><div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-primary"/><h2 className="font-semibold text-ink">Travail avec Marie</h2></div><p className="mt-2 text-sm text-muted">Les demandes de validation, commentaires et corrections seront centralisés ici, sans mélanger les échanges avec le fil chantier.</p></section></div>;
}
