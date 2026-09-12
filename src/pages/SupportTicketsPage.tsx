import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, ArrowLeft, Bug, CheckCircle2, Clock3, FileQuestion, FileText, Lightbulb, Loader2, MessageSquare, Paperclip, Plus, RefreshCw, Search, Send, ShieldCheck, X } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/layout/PageHeader";
import { Button } from "../components/ui/button";
import {
  addSupportTicketMessage,
  createSupportTicket,
  getSupportIdentity,
  listSupportTickets,
  loadSupportTicket,
  updateSupportTicket,
  type SupportTicket,
  type SupportTicketAttachment,
  type SupportTicketCategory,
  type SupportTicketDetail,
  type SupportTicketPriority,
  type SupportTicketStatus,
} from "../services/supportTickets.service";

const inputClass = "w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const categoryLabels: Record<SupportTicketCategory, string> = { bug: "Bug", problem: "Problème", improvement: "Amélioration" };
const statusLabels: Record<SupportTicketStatus, string> = { new: "Nouveau", in_progress: "En cours", waiting_user: "Réponse attendue", resolved: "Résolu", closed: "Fermé" };
const priorityLabels: Record<SupportTicketPriority, string> = { low: "Faible", normal: "Normale", high: "Haute", urgent: "Urgente" };

function categoryIcon(category: SupportTicketCategory) {
  if (category === "bug") return Bug;
  if (category === "improvement") return Lightbulb;
  return FileQuestion;
}

function statusTone(status: SupportTicketStatus) {
  if (status === "resolved" || status === "closed") return "bg-success-soft text-success";
  if (status === "new") return "bg-danger-soft text-danger-on";
  if (status === "waiting_user") return "bg-warning-soft text-warning-on";
  return "bg-primary-soft text-primary-on";
}

function shortId(id: string) { return id.slice(0, 8).toUpperCase(); }
function formatDate(value: string) { return new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }); }

function AttachmentTile({ attachment }: { attachment: SupportTicketAttachment }) {
  const image = attachment.mime_type?.startsWith("image/");
  return <a href={attachment.signed_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-subtle bg-surface hover:border-primary">{image && attachment.signed_url ? <img src={attachment.signed_url} alt={attachment.file_name} className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center bg-interactive"><FileText className="h-7 w-7 text-primary" /></div>}<p className="truncate px-3 py-2 text-xs font-medium text-ink">{attachment.file_name}</p></a>;
}

function NewTicketForm({ onClose, onCreated, sourceUrl }: { onClose: () => void; onCreated: (ticket: SupportTicket) => void; sourceUrl: string }) {
  const [category, setCategory] = useState<SupportTicketCategory>("bug");
  const [priority, setPriority] = useState<SupportTicketPriority>("normal");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true); setError("");
    try {
      const ticket = await createSupportTicket({
        category,
        priority,
        title: String(form.get("title") ?? ""),
        description: String(form.get("description") ?? ""),
        stepsToReproduce: String(form.get("steps") ?? ""),
        expectedResult: String(form.get("expected") ?? ""),
        pageUrl: String(form.get("page_url") ?? ""),
        userAgent: navigator.userAgent,
        files,
      });
      onCreated(ticket);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Création impossible."); }
    finally { setSaving(false); }
  }

  const choices: Array<{ id: SupportTicketCategory; title: string; description: string }> = [
    { id: "bug", title: "Bug", description: "Une fonction ne marche pas ou affiche une erreur." },
    { id: "problem", title: "Problème", description: "Quelque chose bloque ou rend le travail difficile." },
    { id: "improvement", title: "Amélioration", description: "Une idée pour rendre Batipro plus simple ou plus complet." },
  ];
  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/45 p-3 sm:p-6"><div role="dialog" aria-modal="true" aria-labelledby="new-ticket-title" className="mx-auto max-w-3xl rounded-2xl border border-subtle bg-surface shadow-elevated"><header className="flex items-start justify-between border-b border-subtle p-5"><div><h2 id="new-ticket-title" className="text-xl font-semibold text-ink">Créer un ticket</h2><p className="mt-1 text-sm text-muted">Décris ce qui se passe. La page et l’appareil utilisés seront enregistrés automatiquement.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-interactive" aria-label="Fermer"><X className="h-5 w-5" /></button></header><form onSubmit={submit} className="space-y-5 p-5">{error ? <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger-on">{error}</p> : null}<fieldset><legend className="text-sm font-semibold text-ink">Type de demande</legend><div className="mt-2 grid gap-2 md:grid-cols-3">{choices.map((choice) => { const Icon = categoryIcon(choice.id); return <button key={choice.id} type="button" onClick={() => setCategory(choice.id)} className={`rounded-xl border p-4 text-left ${category === choice.id ? "border-primary bg-primary-soft" : "border-subtle"}`}><Icon className="h-5 w-5 text-primary" /><strong className="mt-2 block text-sm text-ink">{choice.title}</strong><span className="mt-1 block text-xs text-muted">{choice.description}</span></button>; })}</div></fieldset><label className="block text-sm font-medium text-ink">Titre<input required minLength={3} maxLength={160} name="title" className={`${inputClass} mt-1`} placeholder="Ex. Impossible d’ajouter plusieurs photos" /></label><label className="block text-sm font-medium text-ink">Description<textarea required minLength={5} maxLength={10000} rows={5} name="description" className={`${inputClass} mt-1`} placeholder="Explique ce que tu faisais et ce qui s’est passé…" /></label>{category !== "improvement" ? <div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-ink">Étapes pour reproduire<textarea rows={4} name="steps" className={`${inputClass} mt-1`} placeholder={'1. J’ouvre…\n2. Je clique…\n3. Le problème apparaît…'} /></label><label className="text-sm font-medium text-ink">Résultat attendu<textarea rows={4} name="expected" className={`${inputClass} mt-1`} placeholder="Ce qui devrait normalement se passer…" /></label></div> : null}<div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-medium text-ink">Priorité<select className={`${inputClass} mt-1`} value={priority} onChange={(event) => setPriority(event.target.value as SupportTicketPriority)}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-medium text-ink">Page concernée<input name="page_url" className={`${inputClass} mt-1`} defaultValue={sourceUrl} /></label></div><label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-strong p-4 text-sm text-muted"><Paperclip className="h-5 w-5 text-primary" /><span className="flex-1">{files.length ? `${files.length} fichier(s) : ${files.map((file) => file.name).join(", ")}` : "Ajouter plusieurs captures, photos, PDF ou une courte vidéo"}</span><input type="file" multiple accept="image/*,application/pdf,video/mp4" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label><footer className="flex justify-end gap-2 border-t border-subtle pt-4"><Button type="button" variant="secondary" onClick={onClose}>Annuler</Button><Button variant="primary" disabled={saving}>{saving ? <><Loader2 className="h-4 w-4 animate-spin" />Envoi…</> : <><Send className="h-4 w-4" />Envoyer le ticket</>}</Button></footer></form></div></div>;
}

function TicketDetail({ ticketId, isAdmin, onBack, onChanged }: { ticketId: string; isAdmin: boolean; onBack: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<SupportTicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [resolution, setResolution] = useState("");
  const load = useCallback(async () => { setLoading(true); setError(""); try { const next = await loadSupportTicket(ticketId); setDetail(next); setResolution(next.ticket.resolution_summary ?? ""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Chargement impossible."); } finally { setLoading(false); } }, [ticketId]);
  useEffect(() => { void load(); }, [load]);

  async function update(patch: Parameters<typeof updateSupportTicket>[1]) { setSaving(true); setError(""); try { await updateSupportTicket(ticketId, patch); await load(); onChanged(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Modification impossible."); } finally { setSaving(false); } }
  async function sendReply() { if (!reply.trim()) return; setSaving(true); setError(""); try { await addSupportTicketMessage(ticketId, reply, { internal, files }); setReply(""); setFiles([]); setInternal(false); await load(); onChanged(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Réponse impossible."); } finally { setSaving(false); } }
  if (loading && !detail) return <div className="rounded-2xl border border-subtle bg-surface p-10 text-center text-muted"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Chargement du ticket…</div>;
  if (!detail) return <div className="space-y-3"><Button variant="secondary" onClick={onBack}><ArrowLeft className="h-4 w-4" />Retour</Button><p className="rounded-xl bg-danger-soft p-4 text-danger-on">{error || "Ticket introuvable."}</p></div>;
  const { ticket, messages, attachments } = detail;
  return <div className="space-y-5"><button type="button" onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="h-4 w-4" />Tous les tickets</button>{error ? <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger-on">{error}</p> : null}<section className="rounded-2xl border border-subtle bg-surface p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-muted">#{shortId(ticket.id)}</span><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusTone(ticket.status)}`}>{statusLabels[ticket.status]}</span><span className="rounded-full bg-interactive px-2 py-1 text-xs font-semibold text-ink-secondary">{categoryLabels[ticket.category]}</span></div><h1 className="mt-3 text-2xl font-semibold text-ink">{ticket.title}</h1><p className="mt-1 text-sm text-muted">Par {ticket.reporter_name || ticket.reporter_email || "Utilisateur"} · {formatDate(ticket.created_at)}</p></div>{isAdmin ? <div className="grid min-w-52 gap-2 sm:grid-cols-2"><label className="text-xs font-medium text-muted">Statut<select className={`${inputClass} mt-1`} value={ticket.status} disabled={saving} onChange={(event) => void update({ status: event.target.value as SupportTicketStatus })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs font-medium text-muted">Priorité<select className={`${inputClass} mt-1`} value={ticket.priority} disabled={saving} onChange={(event) => void update({ priority: event.target.value as SupportTicketPriority })}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div> : <span className="rounded-full bg-interactive px-3 py-1.5 text-xs font-semibold text-ink-secondary">Priorité {priorityLabels[ticket.priority].toLowerCase()}</span>}</div><div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]"><div className="space-y-4"><div><h2 className="text-sm font-semibold text-ink">Description</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-secondary">{ticket.description}</p></div>{ticket.steps_to_reproduce ? <div><h2 className="text-sm font-semibold text-ink">Étapes pour reproduire</h2><p className="mt-2 whitespace-pre-wrap text-sm text-ink-secondary">{ticket.steps_to_reproduce}</p></div> : null}{ticket.expected_result ? <div><h2 className="text-sm font-semibold text-ink">Résultat attendu</h2><p className="mt-2 whitespace-pre-wrap text-sm text-ink-secondary">{ticket.expected_result}</p></div> : null}</div><aside className="rounded-xl bg-interactive p-4 text-xs text-muted"><strong className="text-ink">Contexte technique</strong><p className="mt-3 break-all">{ticket.page_url || "Page non renseignée"}</p><p className="mt-3 line-clamp-5">{ticket.user_agent || "Appareil non renseigné"}</p></aside></div>{attachments.filter((file) => !file.message_id).length ? <div className="mt-5 grid gap-3 border-t border-subtle pt-5 sm:grid-cols-2 lg:grid-cols-4">{attachments.filter((file) => !file.message_id).map((file) => <AttachmentTile key={file.id} attachment={file} />)}</div> : null}</section><section className="rounded-2xl border border-subtle bg-surface p-5"><h2 className="flex items-center gap-2 font-semibold text-ink"><MessageSquare className="h-5 w-5 text-primary" />Échanges</h2><div className="mt-4 space-y-3">{messages.length ? messages.map((message) => <article key={message.id} className={`rounded-xl p-4 ${message.is_internal ? "border border-warning bg-warning-soft" : "bg-interactive"}`}><div className="flex items-center justify-between gap-2"><strong className="text-sm text-ink">{message.author_name || "Utilisateur"}{message.is_internal ? " · note interne" : ""}</strong><span className="text-xs text-muted">{formatDate(message.created_at)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-ink-secondary">{message.body}</p>{attachments.filter((file) => file.message_id === message.id).length ? <div className="mt-3 grid gap-2 sm:grid-cols-3">{attachments.filter((file) => file.message_id === message.id).map((file) => <AttachmentTile key={file.id} attachment={file} />)}</div> : null}</article>) : <p className="rounded-xl border border-dashed border-strong p-5 text-sm text-muted">Aucune réponse pour le moment.</p>}</div><div className="mt-5 space-y-3 border-t border-subtle pt-5"><textarea className={inputClass} rows={4} value={reply} onChange={(event) => setReply(event.target.value)} placeholder={isAdmin ? "Répondre à l’utilisateur ou ajouter une note interne…" : "Ajouter une précision ou répondre à l’administrateur…"} />{isAdmin ? <label className="flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />Note interne invisible pour l’utilisateur</label> : null}<div className="flex flex-wrap items-center justify-between gap-3"><label className="flex cursor-pointer items-center gap-2 text-sm text-primary"><Paperclip className="h-4 w-4" />{files.length ? `${files.length} fichier(s)` : "Joindre des fichiers"}<input type="file" multiple accept="image/*,application/pdf,video/mp4" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label><Button variant="primary" disabled={saving || !reply.trim()} onClick={() => void sendReply()}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Envoyer</Button></div></div></section>{isAdmin ? <section className="rounded-2xl border border-subtle bg-surface p-5"><h2 className="flex items-center gap-2 font-semibold text-ink"><ShieldCheck className="h-5 w-5 text-primary" />Conclusion administrateur</h2><textarea value={resolution} onChange={(event) => setResolution(event.target.value)} rows={3} className={`${inputClass} mt-3`} placeholder="Correction réalisée, solution apportée ou raison de la clôture…" /><div className="mt-3 flex justify-end"><Button variant="secondary" disabled={saving} onClick={() => void update({ resolutionSummary: resolution })}><CheckCircle2 className="h-4 w-4" />Enregistrer la conclusion</Button></div></section> : ticket.resolution_summary ? <section className="rounded-2xl border border-success bg-success-soft p-5"><h2 className="font-semibold text-success">Solution apportée</h2><p className="mt-2 whitespace-pre-wrap text-sm text-ink-secondary">{ticket.resolution_summary}</p></section> : null}</div>;
}

export default function SupportTicketsPage({ portal = false }: { portal?: boolean }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<SupportTicketStatus | "all">("all");
  const [category, setCategory] = useState<SupportTicketCategory | "all">("all");
  const reload = useCallback(async () => { setLoading(true); setError(""); try { const [rows, identity] = await Promise.all([listSupportTickets(), getSupportIdentity()]); setTickets(rows); setIsAdmin(identity.isAdmin); } catch (reason) { setError(reason instanceof Error ? reason.message : "Chargement impossible."); } finally { setLoading(false); } }, []);
  useEffect(() => { void reload(); }, [reload]);
  const filtered = useMemo(() => tickets.filter((ticket) => (status === "all" || ticket.status === status) && (category === "all" || ticket.category === category) && (!query.trim() || `${ticket.title} ${ticket.description} ${ticket.reporter_name ?? ""} ${ticket.reporter_email ?? ""}`.toLowerCase().includes(query.toLowerCase().trim()))), [tickets, status, category, query]);
  if (selectedId) return <div className={portal ? "min-h-dvh bg-app p-4 sm:p-6" : ""}><div className="mx-auto max-w-6xl"><TicketDetail ticketId={selectedId} isAdmin={isAdmin} onBack={() => setSelectedId(null)} onChanged={() => void reload()} /></div></div>;
  const openCount = tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length;
  const sourcePath = searchParams.get("from");
  const sourceUrl = sourcePath?.startsWith("/") ? `${window.location.origin}${sourcePath}` : window.location.href;
  return <div className={portal ? "min-h-dvh bg-app p-4 sm:p-6" : "space-y-5"}><div className={portal ? "mx-auto max-w-6xl space-y-5" : "space-y-5"}>{portal ? <button type="button" onClick={() => navigate("/portail/employe")} className="flex items-center gap-2 text-sm font-medium text-primary"><ArrowLeft className="h-4 w-4" />Retour au portail terrain</button> : null}<PageHeader eyebrow="Support Batipro" title={isAdmin ? "Tous les tickets" : "Mes tickets"} description={isAdmin ? "Centraliser les bugs, problèmes et idées d’amélioration remontés par les utilisateurs." : "Signaler un problème et suivre sa prise en charge par l’administrateur."} actions={<><Button variant="secondary" onClick={() => void reload()}><RefreshCw className="h-4 w-4" />Actualiser</Button><Button variant="primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />Nouveau ticket</Button></>} />{error ? <p className="rounded-xl bg-danger-soft p-3 text-danger-on">{error}</p> : null}<section className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-subtle bg-surface p-4"><p className="text-sm text-muted">{isAdmin ? "Tickets reçus" : "Mes demandes"}</p><strong className="mt-1 block text-2xl text-ink">{tickets.length}</strong></div><div className="rounded-2xl border border-subtle bg-surface p-4"><p className="text-sm text-muted">À traiter</p><strong className="mt-1 block text-2xl text-danger-on">{openCount}</strong></div><div className="rounded-2xl border border-subtle bg-surface p-4"><p className="text-sm text-muted">Résolus</p><strong className="mt-1 block text-2xl text-success">{tickets.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed").length}</strong></div></section><section className="rounded-2xl border border-subtle bg-surface p-4"><div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_190px]"><label className="flex items-center gap-2 rounded-xl border border-subtle bg-app px-3"><Search className="h-4 w-4 text-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none" placeholder="Rechercher un ticket…" /></label><select value={status} onChange={(event) => setStatus(event.target.value as SupportTicketStatus | "all")} className={inputClass}><option value="all">Tous les statuts</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={category} onChange={(event) => setCategory(event.target.value as SupportTicketCategory | "all")} className={inputClass}><option value="all">Toutes les catégories</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="mt-4 divide-y divide-subtle">{loading ? <div className="py-10 text-center text-muted"><Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />Chargement…</div> : filtered.length ? filtered.map((ticket) => { const Icon = categoryIcon(ticket.category); return <button key={ticket.id} type="button" onClick={() => setSelectedId(ticket.id)} className="grid w-full gap-3 py-4 text-left transition hover:bg-interactive/60 sm:grid-cols-[40px_minmax(0,1fr)_auto] sm:px-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft"><Icon className="h-5 w-5 text-primary" /></span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm text-ink">{ticket.title}</strong><span className="text-xs text-muted">#{shortId(ticket.id)}</span></span><span className="mt-1 line-clamp-1 text-sm text-muted">{ticket.description}</span><span className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">{isAdmin ? <span>{ticket.reporter_name || ticket.reporter_email || "Utilisateur"}</span> : null}<span className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{formatDate(ticket.updated_at)}</span><span>Priorité {priorityLabels[ticket.priority].toLowerCase()}</span></span></span><span className={`h-fit rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(ticket.status)}`}>{statusLabels[ticket.status]}</span></button>; }) : <div className="py-12 text-center"><AlertCircle className="mx-auto h-8 w-8 text-muted" /><p className="mt-2 font-medium text-ink">Aucun ticket trouvé</p><p className="mt-1 text-sm text-muted">Crée une demande dès qu’un problème ou une idée apparaît.</p></div>}</div></section>{creating ? <NewTicketForm sourceUrl={sourceUrl} onClose={() => setCreating(false)} onCreated={(ticket) => { setCreating(false); setSelectedId(ticket.id); void reload(); }} /> : null}</div></div>;
}
