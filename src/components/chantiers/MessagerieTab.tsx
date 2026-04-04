import { useEffect, useMemo, useState } from "react";

import type { IntervenantRow } from "../../services/intervenants.service";
import { appendChantierActivityLog } from "../../services/chantierActivityLog.service";
import {
  listChantierMessagesByChantierId,
  updateChantierMessage,
  type ChantierMessageRow,
  type ChantierMessageStatus,
} from "../../services/chantierMessages.service";

type MessagerieTabProps = {
  chantierId: string;
  intervenants: IntervenantRow[];
  onActivityRefresh?: () => void | Promise<void>;
};

function messageStatusLabel(status: ChantierMessageStatus) {
  return status === "traitee" ? "Traitée" : "Envoyée";
}

function messageStatusBadgeClass(status: ChantierMessageStatus) {
  return status === "traitee"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-blue-200 bg-blue-50 text-blue-700";
}

function formatMessageDate(value: string | null | undefined) {
  if (!value) return "Date non renseignée";
  return new Date(value.includes("T") ? value : `${value}T00:00:00`).toLocaleDateString("fr-FR");
}

function formatMessageDateTime(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleString("fr-FR");
}

export default function MessagerieTab({
  chantierId,
  intervenants,
  onActivityRefresh,
}: MessagerieTabProps) {
  const [messages, setMessages] = useState<ChantierMessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"__ALL__" | ChantierMessageStatus>("__ALL__");
  const [savingId, setSavingId] = useState<string | null>(null);

  const intervenantNameById = useMemo(
    () => new Map(intervenants.map((intervenant) => [intervenant.id, intervenant.nom])),
    [intervenants],
  );

  const filteredMessages = useMemo(
    () => (filter === "__ALL__" ? messages : messages.filter((message) => message.status === filter)),
    [messages, filter],
  );

  const openCount = useMemo(
    () => messages.filter((message) => message.status === "envoyee").length,
    [messages],
  );

  async function refreshMessages() {
    if (!chantierId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await listChantierMessagesByChantierId(chantierId);
      setMessages(result.messages);
      setSchemaReady(result.schemaReady);

      const nextDrafts: Record<string, string> = {};
      for (const message of result.messages) {
        nextDrafts[message.id] = message.admin_reply ?? "";
      }
      setReplyDrafts(nextDrafts);
    } catch (err: any) {
      setMessages([]);
      setError(err?.message ?? "Erreur chargement messagerie.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantierId]);

  async function saveMessageReply(message: ChantierMessageRow, nextStatus: ChantierMessageStatus) {
    const reply = String(replyDrafts[message.id] ?? "").trim();
    setSavingId(message.id);
    setError(null);

    try {
      await updateChantierMessage({
        id: message.id,
        chantier_id: chantierId,
        status: nextStatus,
        admin_reply: reply,
      });

      await appendChantierActivityLog({
        chantierId,
        actionType: nextStatus === message.status ? "updated" : "status_changed",
        entityType: "message",
        entityId: message.id,
        reason: nextStatus === "traitee"
          ? `Réponse envoyée à ${message.intervenant_nom ?? intervenantNameById.get(message.intervenant_id) ?? "intervenant"}`
          : `Message mis à jour pour ${message.intervenant_nom ?? intervenantNameById.get(message.intervenant_id) ?? "intervenant"}`,
        changes: {
          subject: message.subject,
          status: { from: message.status, to: nextStatus },
          admin_reply: reply || null,
        },
      });

      await refreshMessages();
      await onActivityRefresh?.();
    } catch (err: any) {
      setError(err?.message ?? "Erreur mise à jour message.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold section-title">Messagerie chantier</div>
          <div className="text-sm text-slate-500">
            Demandes d’information terrain, réponses admin et suivi de traitement.
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {openCount} à traiter
          </span>
          <select
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            value={filter}
            onChange={(event) => setFilter(event.target.value as "__ALL__" | ChantierMessageStatus)}
          >
            <option value="__ALL__">Tous les messages</option>
            <option value="envoyee">À traiter</option>
            <option value="traitee">Traités</option>
          </select>
          <button
            type="button"
            onClick={() => void refreshMessages()}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Chargement..." : "Rafraîchir"}
          </button>
        </div>
      </div>

      {!schemaReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Migration messagerie non appliquée : pousser `20260402210000_chantier_messagerie_v1.sql`
          dans Supabase pour activer les réponses admin.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          Chargement des messages...
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          Aucun message pour ce filtre.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredMessages.map((message) => {
            const reply = replyDrafts[message.id] ?? "";
            const intervenantLabel =
              message.intervenant_nom ?? intervenantNameById.get(message.intervenant_id) ?? "Intervenant";

            return (
              <article
                key={message.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{message.subject}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {intervenantLabel} · {formatMessageDate(message.request_date)}
                    </div>
                  </div>
                  <span
                    className={[
                      "rounded-full border px-3 py-1 text-xs font-semibold",
                      messageStatusBadgeClass(message.status),
                    ].join(" ")}
                  >
                    {messageStatusLabel(message.status)}
                  </span>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {message.message}
                </div>

                <div className="mt-4 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Réponse admin
                  </div>
                  <textarea
                    className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400"
                    value={reply}
                    onChange={(event) =>
                      setReplyDrafts((prev) => ({ ...prev, [message.id]: event.target.value }))
                    }
                    placeholder="Écrire une réponse visible côté intervenant..."
                  />
                  {message.admin_reply && message.admin_replied_at ? (
                    <div className="text-xs text-slate-500">
                      Dernière réponse envoyée le {formatMessageDateTime(message.admin_replied_at)}
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void saveMessageReply(message, "envoyee")}
                    disabled={savingId === message.id}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    Enregistrer
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveMessageReply(message, "traitee")}
                    disabled={savingId === message.id}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    {savingId === message.id ? "Envoi..." : "Répondre et clôturer"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
