import { useEffect, useMemo, useState } from "react";
import { MessageCircle, RefreshCw, Send, Search, AlertTriangle, FileText } from "lucide-react";
import { listChantiers, type ChantierRow } from "../services/chantiers.service";
import { createChantierFeedPost, listAllChantierFeedPosts, type ChantierFeedPostRow } from "../services/chantierFeed.service";

function formatDate(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

type Thread = {
  chantierId: string;
  chantierName: string;
  client: string | null;
  rows: ChantierFeedPostRow[];
  lastAt: string | null;
  pending: number;
};

export default function FilChantierPage() {
  const [rows, setRows] = useState<ChantierFeedPostRow[]>([]);
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [feedResult, chantierRows] = await Promise.all([
        listAllChantierFeedPosts(),
        listChantiers({ scope: "all" }),
      ]);
      if (!feedResult.schemaReady) throw new Error("Le SQL du fil chantier n'est pas encore appliqué sur Supabase.");
      setRows(feedResult.posts);
      setChantiers(chantierRows);
      setSelectedId((current) => current || feedResult.posts[0]?.chantier_id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement du fil chantier impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const threads = useMemo<Thread[]>(() => {
    const map = new Map<string, ChantierFeedPostRow[]>();
    for (const row of rows) {
      const current = map.get(row.chantier_id) ?? [];
      current.push(row);
      map.set(row.chantier_id, current);
    }
    return Array.from(map.entries()).map(([chantierId, items]) => {
      const sorted = [...items].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      const last = sorted.at(-1) ?? items[0];
      const chantier = chantiers.find((item) => item.id === chantierId);
      const repliedPostIds = new Set(sorted.map((row) => row.parent_post_id).filter(Boolean));
      return {
        chantierId,
        chantierName: chantier?.nom ?? "Chantier",
        client: chantier?.client ?? null,
        rows: sorted,
        lastAt: last?.created_at ?? null,
        pending: sorted.filter((row) => row.author_intervenant_id && !repliedPostIds.has(row.id)).length,
      };
    }).sort((a, b) => String(b.lastAt).localeCompare(String(a.lastAt)));
  }, [chantiers, rows]);

  const visibleThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((thread) => `${thread.chantierName} ${thread.client ?? ""}`.toLowerCase().includes(q));
  }, [query, threads]);

  const selected = visibleThreads.find((thread) => thread.chantierId === selectedId) ?? visibleThreads[0] ?? null;
  useEffect(() => { setReply(""); }, [selected?.chantierId]);
  const lastUnanswered = selected ? (() => {
    const repliedPostIds = new Set(selected.rows.map((row) => row.parent_post_id).filter(Boolean));
    return [...selected.rows].reverse().find((row) => row.author_intervenant_id && !repliedPostIds.has(row.id)) ?? null;
  })() : null;

  async function sendReply() {
    if (!lastUnanswered || !reply.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createChantierFeedPost({
        chantierId: lastUnanswered.chantier_id,
        body: reply.trim(),
        visibility: "equipe",
        parentPostId: lastUnanswered.id,
      });
      setReply("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Réponse impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">Communication terrain</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-950">Fil chantier</h1>
          <p className="mt-1 text-sm text-slate-500">Tous les fils chantier regroupés par chantier pour l'administration et la conduite de travaux.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </button>
      </div>

      {error ? <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4" />{error}</div> : null}

      <div className="grid min-h-[68vh] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:grid-cols-[340px_1fr]">
        <aside className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="border-b border-slate-200 p-3">
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
              <Search className="h-4 w-4 text-slate-400" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un chantier..." className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </div>
          </div>
          <div className="max-h-[68vh] overflow-y-auto">
            {visibleThreads.length ? visibleThreads.map((thread) => {
              const active = selected?.chantierId === thread.chantierId;
              const last = thread.rows.at(-1);
              return <button key={thread.chantierId} type="button" onClick={() => setSelectedId(thread.chantierId)} className={`w-full border-b border-slate-100 px-4 py-3 text-left transition ${active ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{thread.chantierName}</div><div className="truncate text-xs text-slate-500">{thread.client || last?.author_name || "Fil chantier"}</div></div>{thread.pending ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">{thread.pending}</span> : null}</div>
                <div className="mt-2 flex items-center justify-between gap-2"><div className="truncate text-xs text-slate-500">{last?.body || "Aucun message"}</div><div className="shrink-0 text-[10px] text-slate-400">{formatDate(thread.lastAt)}</div></div>
              </button>;
            }) : <div className="p-6 text-center text-sm text-slate-500">{loading ? "Chargement..." : "Aucun fil chantier pour le moment."}</div>}
          </div>
        </aside>

        <section className="flex min-h-[68vh] flex-col">
          {selected ? <>
            <div className="border-b border-slate-200 px-4 py-3"><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700"><MessageCircle className="h-5 w-5" /></div><div><div className="font-bold text-slate-950">{selected.chantierName}</div><div className="text-xs text-slate-500">{selected.client || "Fil chantier interne"}</div></div></div></div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {selected.rows.map((row) => {
                const fromTerrain = Boolean(row.author_intervenant_id);
                return <div key={row.id} className={`flex ${fromTerrain ? "justify-start" : "justify-end"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm ${fromTerrain ? "rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-200" : "rounded-br-md bg-blue-600 text-white"}`}><div className={`mb-1 text-[11px] font-bold ${fromTerrain ? "text-slate-500" : "text-blue-100"}`}>{fromTerrain ? row.author_name || "Intervenant" : row.author_name || "Équipe Batipro"}</div><div className="whitespace-pre-wrap">{row.body}</div>{row.attachments.map((attachment) => attachment.mime_type?.startsWith("image/") && attachment.signed_url ? <a key={attachment.id} href={attachment.signed_url} target="_blank" rel="noreferrer" className="mt-2 block overflow-hidden rounded-xl border border-white/20"><img src={attachment.signed_url} alt={attachment.file_name} className="max-h-72 w-full object-cover" /></a> : attachment.signed_url ? <a key={attachment.id} href={attachment.signed_url} target="_blank" rel="noreferrer" className={`mt-2 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${fromTerrain ? "border-slate-200" : "border-white/30"}`}><FileText className="h-4 w-4" /><span className="truncate">{attachment.file_name}</span></a> : null)}<div className={`mt-1 text-[10px] ${fromTerrain ? "text-slate-400" : "text-blue-100"}`}>{formatDate(row.created_at)}</div></div></div>;
              })}
            </div>
            <div className="border-t border-slate-200 bg-white p-3">
              {lastUnanswered ? <div className="flex items-end gap-2"><textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder={`Répondre à ${lastUnanswered.author_name || "l'intervenant"}...`} className="min-h-[52px] flex-1 resize-none rounded-xl bg-slate-50 px-3 py-2.5 text-sm outline-none ring-1 ring-slate-200 focus:ring-blue-300" /><button type="button" onClick={() => void sendReply()} disabled={!reply.trim() || saving} className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white disabled:opacity-40"><Send className="h-5 w-5" /></button></div> : <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">Tous les messages de ce chantier ont une réponse.</div>}
            </div>
          </> : <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">Sélectionne un fil chantier.</div>}
        </section>
      </div>
    </div>
  );
}
