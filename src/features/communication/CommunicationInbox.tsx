import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, Inbox, RefreshCw, Search, Send } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  listInboxThreads,
  loadInboxMessages,
  markInboxThreadRead,
  replyToInboxThread,
  updateInboxThreadStatus,
} from "./communicationRepository";
import { channelLabel } from "./networks";
import type { InboxMessage, InboxThread } from "./types";

const KIND_LABELS: Record<string, string> = { message: "Message", comment: "Commentaire", mention: "Mention", review: "Avis" };
const STATUS_LABELS: Record<string, string> = { open: "À traiter", pending: "En cours", closed: "Traitée" };

export function CommunicationInbox() {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listInboxThreads();
      setThreads(rows);
      setSelectedId((current) => (rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null));
      setError("");
    } catch (err) {
      setThreads([]);
      setError(err instanceof Error ? err.message : "Lecture des conversations impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!selectedId) { setMessages([]); return; }
    let cancelled = false;
    void loadInboxMessages(selectedId)
      .then((rows) => { if (!cancelled) setMessages(rows); })
      .catch(() => { if (!cancelled) setMessages([]); });
    void markInboxThreadRead(selectedId).catch(() => undefined);
    setDraft("");
    return () => { cancelled = true; };
  }, [selectedId]);

  const visible = useMemo(
    () => threads.filter((thread) =>
      (filter === "all" || thread.kind === filter)
      && `${thread.contact_name ?? ""} ${thread.subject ?? ""}`.toLowerCase().includes(query.toLowerCase())),
    [filter, query, threads],
  );
  const thread = useMemo(() => threads.find((row) => row.id === selectedId) ?? null, [threads, selectedId]);

  async function send() {
    if (!thread || !draft.trim()) return;
    setBusy(true); setError("");
    try {
      await replyToInboxThread(thread.id, draft.trim());
      setDraft("");
      setMessages(await loadInboxMessages(thread.id));
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Réponse impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function close(status: "closed" | "open") {
    if (!thread) return;
    setBusy(true); setError("");
    try {
      await updateInboxThreadStatus(thread.id, status);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mise à jour impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !threads.length) {
    return (
      <section className="rounded-2xl border border-subtle bg-surface shadow-sm">
        <div className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <Inbox className="h-10 w-10 text-primary" />
          <h2 className="mt-3 font-semibold text-ink">Boîte de réception unifiée</h2>
          <p className="mt-1 max-w-lg text-sm text-muted">
            Messages privés, commentaires et avis Google arriveront ici dès qu'un compte sera connecté et que la
            synchronisation tournera.
          </p>
          {error ? <p className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger-on">{error}</p> : null}
        </div>
      </section>
    );
  }

  return (
    <section className="grid overflow-hidden rounded-2xl border border-subtle bg-surface shadow-sm lg:grid-cols-[340px_1fr]">
      <aside className="border-b border-subtle lg:border-b-0 lg:border-r">
        <header className="flex flex-col gap-3 border-b border-subtle p-4">
          <div className="flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-subtle px-3">
              <Search className="h-4 w-4 text-muted" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent py-2.5 text-sm outline-none" placeholder="Rechercher…" />
            </label>
            <button onClick={() => void reload()} className="rounded-lg p-2 text-muted hover:bg-interactive" aria-label="Actualiser"><RefreshCw className="h-4 w-4" /></button>
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-subtle bg-surface px-3 py-2 text-sm text-ink">
            <option value="all">Toutes les conversations</option>
            <option value="message">Messages</option>
            <option value="comment">Commentaires</option>
            <option value="mention">Mentions</option>
            <option value="review">Avis</option>
          </select>
        </header>
        <div className="max-h-[32rem] divide-y divide-subtle overflow-y-auto">
          {visible.map((row) => (
            <button
              key={row.id}
              onClick={() => setSelectedId(row.id)}
              className={`w-full p-4 text-left ${selectedId === row.id ? "bg-primary-soft" : "hover:bg-interactive"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={`truncate ${row.unread ? "font-semibold text-ink" : "text-ink"}`}>{row.contact_name || "Contact"}</p>
                <time className="shrink-0 text-[11px] text-muted">{new Date(row.last_message_at).toLocaleDateString("fr-FR")}</time>
              </div>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                <span className="rounded-full bg-interactive px-1.5 py-0.5">{KIND_LABELS[row.kind] ?? row.kind}</span>
                <span className="truncate">{row.account_name}</span>
              </p>
              <p className="mt-1 truncate text-sm text-muted">{row.subject || "Nouvelle interaction"}</p>
            </button>
          ))}
          {!visible.length ? <p className="p-6 text-center text-sm text-muted">Aucune conversation.</p> : null}
        </div>
      </aside>

      <main className="flex min-h-96 flex-col p-5">
        {thread ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3 border-b border-subtle pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {KIND_LABELS[thread.kind] ?? thread.kind} · {channelLabel(thread.provider)}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-ink">{thread.contact_name || "Contact"}</h2>
                <p className="text-sm text-muted">{thread.subject}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-interactive px-2 py-1 text-xs text-muted">{STATUS_LABELS[thread.status] ?? thread.status}</span>
                {thread.permalink ? (
                  <a href={thread.permalink} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary">
                    Voir la publication <ExternalLink className="inline h-3 w-3" />
                  </a>
                ) : null}
              </div>
            </header>

            <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${message.direction === "outbound" ? "ml-auto bg-primary-soft text-ink" : "bg-interactive text-ink"}`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {message.author_name || (message.direction === "outbound" ? "CB Rénovation" : "Contact")} · {new Date(message.sent_at).toLocaleString("fr-FR")}
                  </p>
                </article>
              ))}
              {!messages.length ? <p className="text-sm text-muted">Aucun message dans cette conversation.</p> : null}
            </div>

            {error ? <p className="mt-3 rounded-xl bg-danger-soft p-3 text-sm text-danger-on">{error}</p> : null}

            <footer className="mt-4 border-t border-subtle pt-4">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={3}
                placeholder="Répondre publiquement sous le nom de l'entreprise…"
                className="w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
              />
              <div className="mt-2 flex flex-wrap justify-end gap-2">
                <Button variant="secondary" disabled={busy} onClick={() => void close(thread.status === "closed" ? "open" : "closed")}>
                  <CheckCircle2 className="h-4 w-4" />
                  {thread.status === "closed" ? "Rouvrir" : "Marquer traitée"}
                </Button>
                <Button variant="primary" disabled={busy || !draft.trim()} onClick={() => void send()}>
                  <Send className="h-4 w-4" />{busy ? "Envoi…" : "Répondre"}
                </Button>
              </div>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted">
            {loading ? "Chargement…" : "Choisis une conversation."}
          </div>
        )}
      </main>
    </section>
  );
}
