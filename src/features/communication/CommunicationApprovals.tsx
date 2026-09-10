import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Image, MessageSquareWarning, RefreshCw, Save, Send } from "lucide-react";
import { Button } from "../../components/ui/button";
import { decidePublication, listReviewPublications, updateReviewPublication } from "./communicationRepository";
import type { ReviewPublication, SocialNetwork } from "./types";

const labels: Record<SocialNetwork, string> = { facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", google_business: "Google Business", tiktok: "TikTok", youtube: "YouTube" };
const inputClass = "w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary";

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export function CommunicationApprovals() {
  const [items, setItems] = useState<ReviewPublication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [scheduledAt, setScheduledAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    try {
      const rows = await listReviewPublications();
      setItems(rows);
      setSelectedId((current) => rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null);
    } catch { setItems([]); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const item = useMemo(() => items.find((row) => row.id === selectedId) ?? null, [items, selectedId]);
  useEffect(() => {
    if (!item) return;
    setSelectedVariants(item.variants.filter((variant) => variant.approval_status !== "approved").map((variant) => variant.id));
    setDrafts(Object.fromEntries(item.variants.map((variant) => [variant.id, variant.body ?? ""])));
    setScheduledAt(localDateTime(item.scheduled_at)); setNote(""); setMessage("");
  }, [item]);

  function toggleVariant(id: string) { setSelectedVariants((current) => current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]); }
  async function save() {
    if (!item) return; setBusy(true); setMessage("");
    try { await updateReviewPublication(item.id, scheduledAt || null, item.variants.map((variant) => ({ id: variant.id, body: drafts[variant.id] ?? "" }))); setMessage("Modifications enregistrées."); await reload(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }
  async function decide(decision: "approved" | "changes_requested") {
    if (!item || !selectedVariants.length) { setMessage("Sélectionne au moins une version réseau."); return; }
    setBusy(true); setMessage("");
    try {
      await updateReviewPublication(item.id, scheduledAt || null, item.variants.map((variant) => ({ id: variant.id, body: drafts[variant.id] ?? "" })));
      await decidePublication(item.id, selectedVariants, decision, scheduledAt || null, note);
      setMessage(decision === "approved" ? "Versions sélectionnées validées." : "Corrections demandées à Marie."); await reload();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action impossible."); }
    finally { setBusy(false); }
  }

  return <section className="grid overflow-hidden rounded-2xl border border-subtle bg-surface shadow-sm lg:grid-cols-[320px_1fr]">
    <aside className="border-b border-subtle lg:border-b-0 lg:border-r"><header className="flex items-center justify-between p-4"><div><h2 className="font-semibold text-ink">À valider</h2><p className="text-xs text-muted">{items.length} publication(s)</p></div><button onClick={() => void reload()} className="rounded-lg p-2 text-muted hover:bg-interactive" aria-label="Actualiser"><RefreshCw className="h-4 w-4" /></button></header><div className="divide-y divide-subtle">{items.map((row) => <button key={row.id} onClick={() => setSelectedId(row.id)} className={`w-full p-4 text-left ${selectedId === row.id ? "bg-primary-soft" : "hover:bg-interactive"}`}><p className="text-xs font-semibold text-primary">{row.campaign_title}</p><h3 className="mt-1 font-medium text-ink">{row.title}</h3><p className="mt-2 flex items-center gap-1 text-xs text-muted"><Clock3 className="h-3 w-3" />{row.scheduled_at ? new Date(row.scheduled_at).toLocaleString("fr-FR") : "Date à définir"}</p></button>)}{!items.length ? <div className="p-8 text-center text-sm text-muted"><CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />Aucune publication en attente.</div> : null}</div></aside>
    <main className="min-h-96 p-5">{item ? <><header><p className="text-xs font-semibold uppercase tracking-wide text-primary">{item.campaign_title}</p><h2 className="mt-1 text-xl font-semibold text-ink">{item.title}</h2><p className="mt-2 whitespace-pre-wrap text-sm text-muted">{item.content}</p></header>
      {item.assets.length ? <div className="mt-5 flex gap-3 overflow-x-auto">{item.assets.map((asset) => <a key={asset.id} href={asset.signed_url} target="_blank" rel="noreferrer" className="min-w-36 overflow-hidden rounded-xl border border-subtle bg-interactive">{asset.mime_type?.startsWith("image/") && asset.signed_url ? <img src={asset.signed_url} alt={asset.file_name} className="h-24 w-40 object-cover" /> : <div className="flex h-24 w-40 items-center justify-center"><Image className="h-6 w-6 text-primary" /></div>}<p className="w-40 truncate px-2 py-1.5 text-xs text-muted">{asset.file_name}</p></a>)}</div> : null}
      <label className="mt-5 block max-w-sm text-sm font-medium text-ink">Date et heure de publication<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className={`${inputClass} mt-1`} /></label>
      <div className="mt-5 grid gap-3 md:grid-cols-2">{item.variants.map((variant) => { const checked = selectedVariants.includes(variant.id); const approved = variant.approval_status === "approved"; return <article key={variant.id} className={`rounded-xl border p-4 ${checked ? "border-primary" : "border-subtle"}`}><div className="flex items-center justify-between gap-3"><label className="flex items-center gap-2 font-semibold text-ink"><input type="checkbox" checked={checked} disabled={approved} onChange={() => toggleVariant(variant.id)} />{labels[variant.network]}</label><span className={`rounded-full px-2 py-1 text-xs ${approved ? "bg-success-soft text-success" : "bg-warning-soft text-warning-on"}`}>{approved ? "Validée" : "À valider"}</span></div><textarea rows={6} value={drafts[variant.id] ?? ""} onChange={(event) => setDrafts((current) => ({ ...current, [variant.id]: event.target.value }))} className={`${inputClass} mt-3`} /></article>; })}</div>
      <label className="mt-5 block text-sm font-medium text-ink">Commentaire pour Marie<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className={`${inputClass} mt-1`} placeholder="Préciser ce qu’il faut modifier…" /></label>{message ? <p className="mt-3 rounded-xl bg-interactive p-3 text-sm text-ink">{message}</p> : null}
      <footer className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="secondary" disabled={busy} onClick={() => void save()}><Save className="h-4 w-4" />Enregistrer</Button><Button variant="secondary" disabled={busy || !selectedVariants.length} onClick={() => void decide("changes_requested")}><MessageSquareWarning className="h-4 w-4" />Demander des modifications</Button><Button variant="success" disabled={busy || !selectedVariants.length} onClick={() => void decide("approved")}><Send className="h-4 w-4" />Valider la sélection</Button></footer>
    </> : <div className="flex h-full min-h-80 flex-col items-center justify-center text-center"><CheckCircle2 className="h-10 w-10 text-success" /><h2 className="mt-3 font-semibold text-ink">Tout est validé</h2><p className="mt-1 text-sm text-muted">Les nouvelles demandes de Marie apparaîtront ici.</p></div>}</main>
  </section>;
}
