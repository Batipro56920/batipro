import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, CheckCircle2, ChevronRight, Copy, ExternalLink, Eye, Link2, Paperclip, Send, Sparkles, Video } from "lucide-react";
import { Button } from "../../components/ui/button";
import { createPublicationDraft, listSocialAccounts, uploadAssets } from "./communicationRepository";
import type { Campaign, SocialAccount, SocialNetwork } from "./types";
import { buildTrackedUrl } from "./trackingLinks";

type Props = { campaigns: Campaign[]; onSaved: () => void };
type NetworkDefinition = { id: SocialNetwork; label: string; color: string; limit: number; hint: string };

const NETWORKS: NetworkDefinition[] = [
  { id: "facebook", label: "Facebook", color: "bg-blue-600", limit: 63206, hint: "Texte clair, lien et appel à l’action" },
  { id: "instagram", label: "Instagram", color: "bg-pink-600", limit: 2200, hint: "Accroche visuelle et hashtags ciblés" },
  { id: "linkedin", label: "LinkedIn", color: "bg-sky-700", limit: 3000, hint: "Expertise, méthode et résultat métier" },
  { id: "google_business", label: "Google Business", color: "bg-amber-500", limit: 1500, hint: "Actualité locale et bénéfice client" },
];
const inputClass = "w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary";

function networkLabel(id: SocialNetwork) { return NETWORKS.find((network) => network.id === id)?.label ?? id; }

export function CommunicationComposer({ campaigns, onSaved }: Props) {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [baseContent, setBaseContent] = useState("");
  const [selectedNetworks, setSelectedNetworks] = useState<SocialNetwork[]>(["facebook", "instagram"]);
  const [variants, setVariants] = useState<Partial<Record<SocialNetwork, string>>>({});
  const [scheduledAt, setScheduledAt] = useState("");
  const [activePreview, setActivePreview] = useState<SocialNetwork>("facebook");
  const [saving, setSaving] = useState<"draft" | "review" | null>(null);
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [destinationUrl, setDestinationUrl] = useState("");
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [copiedNetwork, setCopiedNetwork] = useState<SocialNetwork | null>(null);

  useEffect(() => { void listSocialAccounts().then(setAccounts).catch(() => setAccounts([])); }, []);
  useEffect(() => { if (!campaignId && campaigns[0]) setCampaignId(campaigns[0].id); }, [campaignId, campaigns]);

  const connected = useMemo(() => new Set(accounts.filter((account) => account.status === "connected").map((account) => account.provider)), [accounts]);
  const currentText = variants[activePreview] ?? baseContent;
  const selectedCampaign = campaigns.find((campaign) => campaign.id === campaignId);
  const trackedLinks = useMemo(() => Object.fromEntries(selectedNetworks.map((network) => [network, trackingEnabled ? buildTrackedUrl({ destinationUrl, network, campaignName: selectedCampaign?.title ?? "campagne", contentName: title }) : destinationUrl.trim()])), [destinationUrl, selectedNetworks, selectedCampaign?.title, title, trackingEnabled]) as Partial<Record<SocialNetwork, string>>;
  const destinationIsValid = !destinationUrl.trim() || Boolean(buildTrackedUrl({ destinationUrl, network: activePreview, campaignName: selectedCampaign?.title ?? "campagne", contentName: title }));

  function toggleNetwork(network: SocialNetwork) {
    setSelectedNetworks((current) => current.includes(network) ? current.filter((entry) => entry !== network) : [...current, network]);
    setActivePreview(network);
  }

  function prepareVariants() {
    const prepared: Partial<Record<SocialNetwork, string>> = {};
    for (const network of selectedNetworks) prepared[network] = variants[network] || baseContent;
    setVariants((current) => ({ ...current, ...prepared }));
    setMessage("Variantes préparées. Tu peux maintenant adapter chaque réseau.");
  }

  async function save(submitForReview: boolean) {
    if (!campaignId || !title.trim() || !baseContent.trim() || !selectedNetworks.length) {
      setMessage("Choisis une campagne, un titre, un texte et au moins un réseau.");
      return;
    }
    if (!destinationIsValid) {
      setMessage("Corrige l’adresse de destination avant d’enregistrer.");
      return;
    }
    setSaving(submitForReview ? "review" : "draft"); setMessage("");
    try {
      const item = await createPublicationDraft({
        campaignId, title: title.trim(), baseContent: baseContent.trim(), scheduledAt,
        variants: selectedNetworks.map((network) => ({
          network,
          socialAccountId: accounts.find((account) => account.provider === network && account.status === "connected")?.id,
          body: (variants[network] || baseContent).trim(),
          linkUrl: trackedLinks[network] || undefined,
        })),
        submitForReview,
      });
      if (files.length) await uploadAssets(campaignId, item.id, files);
      setMessage(submitForReview ? "Publication envoyée à Marie pour validation." : "Brouillon enregistré dans la campagne.");
      setTitle(""); setBaseContent(""); setVariants({}); setScheduledAt(""); setFiles([]); setDestinationUrl(""); onSaved();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setSaving(null); }
  }

  if (!campaigns.length) return <section className="rounded-2xl border border-dashed border-strong bg-surface p-10 text-center"><Sparkles className="mx-auto h-9 w-9 text-primary"/><h2 className="mt-3 font-semibold text-ink">Crée d’abord une campagne</h2><p className="mt-1 text-sm text-muted">Le compositeur rattache chaque publication à une campagne partagée avec Marie.</p></section>;

  return <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px]">
    <section className="space-y-5 rounded-2xl border border-subtle bg-surface p-5 shadow-sm">
      <header><p className="text-xs font-semibold uppercase tracking-wider text-primary">Nouvelle publication</p><h2 className="mt-1 text-xl font-semibold text-ink">Créer une fois, adapter par réseau</h2><p className="mt-1 text-sm text-muted">Le texte commun sert de base. Chaque variante reste modifiable avant validation.</p></header>
      <div className="flex flex-wrap gap-2 rounded-xl bg-interactive p-3"><a href="https://www.canva.com/create/social-media/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-subtle bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-primary"><Sparkles className="h-4 w-4 text-primary"/>Créer un visuel dans Canva<ExternalLink className="h-3 w-3 text-muted"/></a><a href="https://www.capcut.com/editor" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-subtle bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-primary"><Video className="h-4 w-4 text-primary"/>Monter une vidéo dans CapCut<ExternalLink className="h-3 w-3 text-muted"/></a><span className="self-center text-xs text-muted">Exporte puis ajoute plusieurs fichiers ci-dessous. La synchronisation Canva automatique arrive avec OAuth.</span></div>
      <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-ink">Campagne<select className={`${inputClass} mt-1`} value={campaignId} onChange={(event)=>setCampaignId(event.target.value)}>{campaigns.map((campaign)=><option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select></label><label className="text-sm font-medium text-ink">Titre interne<input className={`${inputClass} mt-1`} value={title} onChange={(event)=>setTitle(event.target.value)} placeholder="Ex. Avant / après dallage parking"/></label></div>
      <fieldset><legend className="text-sm font-medium text-ink">Réseaux ciblés</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{NETWORKS.map((network)=>{const selected=selectedNetworks.includes(network.id);return <button type="button" key={network.id} onClick={()=>toggleNetwork(network.id)} className={`flex items-center justify-between rounded-xl border p-3 text-left ${selected?"border-primary bg-primary-soft":"border-subtle"}`}><span className="flex items-center gap-2"><span className={`h-3 w-3 rounded-full ${network.color}`}/><span><strong className="block text-sm text-ink">{network.label}</strong><small className="text-muted">{connected.has(network.id)?"Compte connecté":"Connexion à configurer"}</small></span></span>{selected?<Check className="h-4 w-4 text-primary"/>:null}</button>})}</div></fieldset>
      <label className="block text-sm font-medium text-ink">Message principal<textarea rows={6} className={`${inputClass} mt-1`} value={baseContent} onChange={(event)=>setBaseContent(event.target.value)} placeholder="L’idée, l’histoire du chantier, le résultat obtenu et l’appel à l’action…"/></label>
      <div className="flex flex-wrap items-center gap-2"><Button variant="secondary" onClick={prepareVariants}><Sparkles className="h-4 w-4"/>Décliner sur les réseaux</Button><span className="text-xs text-muted">Pré-remplit les variantes sans écraser tes adaptations.</span></div>
      {selectedNetworks.length>0?<section className="rounded-2xl border border-subtle"><div className="flex overflow-x-auto border-b border-subtle p-1">{selectedNetworks.map((network)=><button key={network} onClick={()=>setActivePreview(network)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${activePreview===network?"bg-primary text-primary-contrast":"text-muted"}`}>{networkLabel(network)}</button>)}</div><div className="p-4"><label className="text-sm font-medium text-ink">Version {networkLabel(activePreview)}<textarea rows={5} className={`${inputClass} mt-1`} value={currentText} maxLength={NETWORKS.find((network)=>network.id===activePreview)?.limit} onChange={(event)=>setVariants((current)=>({...current,[activePreview]:event.target.value}))}/></label><div className="mt-1 flex justify-between text-xs text-muted"><span>{NETWORKS.find((network)=>network.id===activePreview)?.hint}</span><span>{currentText.length} caractères</span></div></div></section>:null}
      <section className="rounded-2xl border border-subtle bg-interactive/40 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 font-semibold text-ink"><Link2 className="h-4 w-4 text-primary"/>Lien de campagne traçable</h3><p className="mt-1 text-sm text-muted">Batipro crée un lien différent par réseau pour savoir lequel apporte des visites et des demandes de devis.</p></div><label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink"><input type="checkbox" checked={trackingEnabled} onChange={(event)=>setTrackingEnabled(event.target.checked)} className="h-4 w-4 accent-[var(--color-primary)]"/>Activer le suivi UTM</label></div><label className="mt-4 block text-sm font-medium text-ink">Page de destination<input type="url" className={`${inputClass} mt-1 ${destinationIsValid?"":"border-danger"}`} value={destinationUrl} onChange={(event)=>setDestinationUrl(event.target.value)} placeholder="https://cb-renovation.fr/nos-realisations/dallage-parking"/></label>{!destinationIsValid?<p className="mt-1 text-xs text-danger">Saisis une adresse complète commençant par https://</p>:null}{destinationUrl.trim()&&destinationIsValid?<div className="mt-3 grid gap-2 sm:grid-cols-2">{selectedNetworks.map((network)=><div key={network} className="flex min-w-0 items-center gap-2 rounded-xl border border-subtle bg-surface p-3"><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-ink">{networkLabel(network)}</p><p className="truncate text-xs text-muted">{trackedLinks[network]}</p></div><button type="button" title="Copier le lien" className="rounded-lg p-2 text-primary hover:bg-primary-soft" onClick={async()=>{await navigator.clipboard.writeText(trackedLinks[network]||"");setCopiedNetwork(network);window.setTimeout(()=>setCopiedNetwork(null),1600);}}>{copiedNetwork===network?<CheckCircle2 className="h-4 w-4"/>:<Copy className="h-4 w-4"/>}</button></div>)}</div>:null}</section>
      <label className="block text-sm font-medium text-ink"><span className="flex items-center gap-2"><CalendarClock className="h-4 w-4"/>Date souhaitée</span><input type="datetime-local" className={`${inputClass} mt-1`} value={scheduledAt} onChange={(event)=>setScheduledAt(event.target.value)}/></label>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-strong p-4 text-sm text-muted"><Paperclip className="h-5 w-5 text-primary"/><span className="flex-1">{files.length?`${files.length} média(s) sélectionné(s) — ${files.map(file=>file.name).join(", ")}`:"Ajouter plusieurs photos, vidéos, PDF ou maquettes"}</span><input type="file" multiple accept="image/*,video/*,application/pdf" className="sr-only" onChange={event=>setFiles(Array.from(event.target.files??[]))}/></label>
      {message?<p className="rounded-xl bg-interactive p-3 text-sm text-ink">{message}</p>:null}
      <footer className="flex flex-wrap justify-end gap-2 border-t border-subtle pt-4"><Button variant="secondary" disabled={saving!==null} onClick={()=>void save(false)}>{saving==="draft"?"Enregistrement…":"Enregistrer le brouillon"}</Button><Button variant="primary" disabled={saving!==null} onClick={()=>void save(true)}><Send className="h-4 w-4"/>{saving==="review"?"Envoi…":"Demander la validation"}</Button></footer>
    </section>
    <aside className="h-fit rounded-2xl border border-subtle bg-interactive/50 p-5 xl:sticky xl:top-4"><div className="flex items-center gap-2 text-sm font-semibold text-primary"><Eye className="h-4 w-4"/>Aperçu {networkLabel(activePreview)}</div><div className="mt-4 rounded-2xl border border-subtle bg-surface p-4 shadow-sm"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-contrast">CB</div><div><strong className="text-sm text-ink">CB Rénovation</strong><p className="text-xs text-muted">Publication en préparation</p></div></div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-ink">{currentText||"Ton contenu apparaîtra ici au fur et à mesure de la rédaction."}</p><div className="mt-4 aspect-video rounded-xl bg-interactive flex items-center justify-center text-sm text-muted">Média de la publication</div></div><div className="mt-4 rounded-xl border border-subtle bg-surface p-3 text-xs text-muted"><Link2 className="mr-2 inline h-4 w-4"/>La publication ne sera réellement diffusée qu’après connexion du réseau et validation.<ChevronRight className="ml-1 inline h-3 w-3"/></div></aside>
  </div>;
}
