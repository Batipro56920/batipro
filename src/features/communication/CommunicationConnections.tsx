import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "../../components/ui/button";
import { listSocialAccounts } from "./communicationRepository";
import type { SocialAccount, SocialNetwork } from "./types";

const PROVIDERS: Array<{id:SocialNetwork;label:string;use:string;priority:string}>=[
  {id:"facebook",label:"Facebook Pages",use:"Publier, programmer et traiter commentaires/messages.",priority:"Prioritaire"},
  {id:"instagram",label:"Instagram professionnel",use:"Publications, médias, commentaires et statistiques.",priority:"Prioritaire"},
  {id:"linkedin",label:"LinkedIn Page",use:"Actualités entreprise, expertise et recrutement.",priority:"Prioritaire"},
  {id:"google_business",label:"Google Business Profile",use:"Actualités locales et avis clients.",priority:"Prioritaire"},
  {id:"tiktok",label:"TikTok",use:"Vidéos courtes et performances.",priority:"Phase 2"},
  {id:"youtube",label:"YouTube",use:"Vidéos chantier et statistiques.",priority:"Phase 2"},
];

export function CommunicationConnections(){
  const [accounts,setAccounts]=useState<SocialAccount[]>([]);const [loading,setLoading]=useState(true);
  useEffect(()=>{void listSocialAccounts().then(setAccounts).catch(()=>setAccounts([])).finally(()=>setLoading(false));},[]);
  return <div className="space-y-5"><section className="rounded-2xl border border-primary/30 bg-primary-soft p-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-6 w-6 text-primary"/><div><h2 className="font-semibold text-ink">Connexions sécurisées par OAuth</h2><p className="mt-1 text-sm text-muted">Batipro ne demandera jamais les mots de passe des réseaux. Les autorisations et jetons seront gérés côté serveur après création des applications officielles Meta, LinkedIn et Google.</p></div></div></section><section className="grid gap-3 lg:grid-cols-2">{PROVIDERS.map((provider)=>{const account=accounts.find((entry)=>entry.provider===provider.id);return <article key={provider.id} className="rounded-2xl border border-subtle bg-surface p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-interactive"><Link2 className="h-5 w-5 text-primary"/></div><div><h3 className="font-semibold text-ink">{provider.label}</h3><p className="mt-1 text-sm text-muted">{provider.use}</p></div></div><span className="rounded-full bg-interactive px-2 py-1 text-xs text-muted">{provider.priority}</span></div><div className="mt-5 flex items-center justify-between border-t border-subtle pt-4">{account?<span className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="h-4 w-4"/>{account.display_name}</span>:<span className="flex items-center gap-2 text-sm text-muted"><AlertCircle className="h-4 w-4"/>Non connecté</span>}<Button variant="secondary" disabled title="Disponible après configuration des identifiants OAuth">{account?<><RefreshCw className="h-4 w-4"/>Reconnecter</>:<>Configurer <ExternalLink className="h-4 w-4"/></>}</Button></div></article>})}</section>{loading?<p className="text-sm text-muted">Vérification des connexions…</p>:null}<p className="text-sm text-muted">Étape technique suivante : créer les applications développeur chez chaque réseau, faire valider leurs permissions, puis activer les fonctions serveur de connexion, synchronisation et publication.</p></div>;
}
