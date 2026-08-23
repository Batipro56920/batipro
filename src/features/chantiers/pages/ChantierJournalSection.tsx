import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ChantierActivityLogRow } from "../../../services/chantierActivityLog.service";
import {
  createChantierFeedPost,
  listChantierFeedPosts,
  type ChantierFeedPostRow,
  type ChantierFeedVisibility,
} from "../../../services/chantierFeed.service";

type JournalChangeItem = {
  label: string;
  value: string;
  tone?: "neutral" | "blue" | "green" | "amber" | "red";
};

function stringifyJournalValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (Array.isArray(value)) return value.length ? value.map(stringifyJournalValue).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatStatusValue(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (raw === "nouveau") return "Nouveau";
  if (raw === "en_cours") return "En cours";
  if (raw === "traite") return "Traité";
  if (raw === "classe_sans_suite") return "Classé sans suite";
  if (raw === "OUVERTE") return "Ouverte";
  if (raw === "EN_COURS") return "En cours";
  if (raw === "LEVEE") return "Levée";
  if (raw === "FAIT") return "Fait";
  if (raw === "A_FAIRE") return "À faire";
  return stringifyJournalValue(value);
}

function formatJournalChanges(log: ChantierActivityLogRow): JournalChangeItem[] {
  const changes = (log.changes ?? {}) as Record<string, unknown>;

  if (log.entity_type === "feed_post") {
    const items: JournalChangeItem[] = [
      {
        label: "Audience",
        value: changes.visibility === "backoffice" ? "Back-office" : "Équipe chantier",
        tone: changes.visibility === "backoffice" ? "neutral" : "blue",
      },
    ];
    const attachmentNames = Array.isArray(changes.attachment_names)
      ? changes.attachment_names.map((value) => String(value)).filter(Boolean)
      : [];
    if (attachmentNames.length > 0) {
      items.push({
        label: attachmentNames.length > 1 ? "Pièces jointes" : "Pièce jointe",
        value: attachmentNames.join(", "),
        tone: "green",
      });
    }
    return items;
  }

  if (log.entity_type === "terrain_feedback") {
    const items: JournalChangeItem[] = [];
    if (changes.title) items.push({ label: "Retour", value: stringifyJournalValue(changes.title), tone: "blue" });
    if (changes.category) items.push({ label: "Catégorie", value: stringifyJournalValue(changes.category) });
    if (changes.urgency) items.push({ label: "Urgence", value: stringifyJournalValue(changes.urgency), tone: "amber" });
    if (changes.status_from || changes.status_to) {
      items.push({
        label: "Statut",
        value: `${formatStatusValue(changes.status_from)} → ${formatStatusValue(changes.status_to)}`,
        tone: changes.status_to === "traite" ? "green" : changes.status_to === "en_cours" ? "amber" : "blue",
      });
    }
    if (changes.assigned_to_name_from || changes.assigned_to_name_to) {
      items.push({
        label: "Responsable",
        value: `${stringifyJournalValue(changes.assigned_to_name_from)} → ${stringifyJournalValue(changes.assigned_to_name_to)}`,
      });
    }
    if (changes.treatment_comment_updated) {
      items.push({ label: "Traitement", value: "Commentaire mis à jour", tone: "green" });
    }
    return items;
  }

  if (log.entity_type === "reserve" && changes.source === "terrain_feedback") {
    const items: JournalChangeItem[] = [];
    items.push({ label: "Origine", value: "Retour terrain", tone: "blue" });
    if (changes.title) items.push({ label: "Réserve", value: stringifyJournalValue(changes.title), tone: "red" });
    if (changes.priority) items.push({ label: "Priorité", value: formatStatusValue(changes.priority), tone: "amber" });
    if (changes.urgency) items.push({ label: "Urgence terrain", value: stringifyJournalValue(changes.urgency), tone: "amber" });
    return items;
  }

  const knownLabels: Record<string, string> = {
    title: "Titre",
    titre: "Titre",
    status: "Statut",
    statut: "Statut",
    from_status: "Ancien statut",
    to_status: "Nouveau statut",
    priority: "Priorité",
    priorite: "Priorité",
    task_id: "Tâche liée",
    zone_id: "Zone liée",
    intervenant_id: "Intervenant",
    date_debut: "Début",
    date_fin: "Fin",
    duration_hours: "Durée",
    quantite_realisee: "Quantité réalisée",
    temps_prevu_h: "Temps prévu",
    cout_estime_ht: "Coût estimé HT",
  };

  return Object.entries(changes)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 8)
    .map(([key, value]) => ({
      label: knownLabels[key] ?? key.replaceAll("_", " "),
      value: key.toLowerCase().includes("status") || key.toLowerCase().includes("statut")
        ? formatStatusValue(value)
        : stringifyJournalValue(value),
    }));
}

function changeToneClass(tone: JournalChangeItem["tone"] = "neutral") {
  if (tone === "blue") return "border-blue-200 bg-blue-50 text-blue-800";
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-800";
  if (tone === "red") return "border-red-200 bg-red-50 text-red-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function journalDayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date-inconnue";
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function journalDayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const key = journalDayKey(value);
  if (key === journalDayKey(today.toISOString())) return "Aujourd'hui";
  if (key === journalDayKey(yesterday.toISOString())) return "Hier";
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function normalizeJournalSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export default function ChantierJournalSection({
  logs,
  loading,
  error,
  schemaReady,
  onRefresh,
  entityLabel,
  actionLabel,
  tone,
}: {
  logs: ChantierActivityLogRow[];
  loading: boolean;
  error: string | null;
  schemaReady: boolean;
  onRefresh: () => void | Promise<void>;
  entityLabel: (entityType: string) => string;
  actionLabel: (actionType: string) => string;
  tone: (entityType: string) => string;
}) {
  const { id: routeChantierId } = useParams<{ id: string }>();
  const chantierId = logs.find((log) => log.chantier_id)?.chantier_id ?? routeChantierId ?? null;
  const terrainFeedbackHref = chantierId
    ? `/retours-terrain?chantierId=${encodeURIComponent(chantierId)}`
    : null;
  const [posts, setPosts] = useState<ChantierFeedPostRow[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [postsSchemaReady, setPostsSchemaReady] = useState(true);
  const [attachmentsSchemaReady, setAttachmentsSchemaReady] = useState(true);
  const [draft, setDraft] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [visibility, setVisibility] = useState<ChantierFeedVisibility>("equipe");
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  async function refreshPosts() {
    if (!chantierId) return;
    setPostsLoading(true);
    setPostsError(null);
    try {
      const result = await listChantierFeedPosts(chantierId);
      setPosts(result.posts);
      setPostsSchemaReady(result.schemaReady);
      setAttachmentsSchemaReady(result.attachmentsSchemaReady);
    } catch (postError: any) {
      setPosts([]);
      setPostsError(postError?.message ?? "Erreur chargement publications.");
    } finally {
      setPostsLoading(false);
    }
  }

  useEffect(() => {
    void refreshPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantierId]);

  async function publishPost() {
    const body = draft.trim();
    if (!chantierId || !body || publishing) return;
    setPublishing(true);
    setPostsError(null);
    try {
      const created = await createChantierFeedPost({
        chantierId,
        body,
        visibility,
        parentPostId: replyingToId,
        files: selectedFiles,
      });
      setPosts((current) => [created, ...current]);
      setDraft("");
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setReplyingToId(null);
      setPostsSchemaReady(true);
    } catch (postError: any) {
      const message = postError?.message ?? "Impossible de publier dans le fil chantier.";
      await refreshPosts();
      setPostsError(message);
    } finally {
      setPublishing(false);
    }
  }

  function selectFiles(files: FileList | null) {
    if (!files) return;
    const incoming = Array.from(files);
    const invalid = incoming.find((file) => {
      const type = String(file.type ?? "").toLowerCase();
      const name = String(file.name ?? "").toLowerCase();
      const allowedType = type.startsWith("image/") || type === "application/pdf" || name.endsWith(".pdf");
      return !allowedType || file.size <= 0 || file.size > 20 * 1024 * 1024;
    });
    if (invalid) {
      setPostsError("Seules les images et les PDF de 20 Mo maximum sont acceptés.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setPostsError(null);
    setSelectedFiles((current) => {
      const merged = [...current, ...incoming];
      const unique = merged.filter(
        (file, index) =>
          merged.findIndex((candidate) => candidate.name === file.name && candidate.size === file.size) === index,
      );
      return unique.slice(0, 4);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  }

  const postById = useMemo(
    () => new Map(posts.map((post) => [post.id, post])),
    [posts],
  );

  const feedLogs = useMemo<ChantierActivityLogRow[]>(() => {
    const publicationLogs = posts.map<ChantierActivityLogRow>((post) => ({
      id: `feed-post-${post.id}`,
      chantier_id: post.chantier_id,
      actor_id: post.author_id,
      actor_name: post.author_name,
      actor_role: post.author_role,
      action_type: "published",
      entity_type: "feed_post",
      entity_id: post.id,
      reason: post.body,
      changes: {
        visibility: post.visibility,
        parent_post_id: post.parent_post_id,
        attachment_names: post.attachments.map((attachment) => attachment.file_name),
      },
      created_at: post.created_at,
    }));

    return [...logs, ...publicationLogs].sort(
      (left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
    );
  }, [logs, posts]);

  const availableEntityTypes = useMemo(
    () =>
      Array.from(new Set(feedLogs.map((log) => log.entity_type)))
        .filter(Boolean)
        .sort((left, right) => {
          const leftLabel = left === "terrain_feedback" ? "Retour terrain" : entityLabel(left);
          const rightLabel = right === "terrain_feedback" ? "Retour terrain" : entityLabel(right);
          return leftLabel.localeCompare(rightLabel, "fr");
        }),
    [entityLabel, feedLogs],
  );

  const filteredLogs = useMemo(() => {
    const query = normalizeJournalSearch(searchQuery.trim());
    return feedLogs.filter((log) => {
      if (entityFilter !== "all" && log.entity_type !== entityFilter) return false;
      if (!query) return true;

      const displayEntity = log.entity_type === "terrain_feedback" ? "Retour terrain" : entityLabel(log.entity_type);
      const displayAction =
        log.entity_type === "terrain_feedback" && log.action_type === "started"
          ? "Prise en charge"
          : actionLabel(log.action_type);
      const changeText = formatJournalChanges(log)
        .map((item) => `${item.label} ${item.value}`)
        .join(" ");

      return normalizeJournalSearch(
        [
          displayEntity,
          displayAction,
          log.reason,
          log.actor_name,
          log.actor_role,
          changeText,
        ].join(" "),
      ).includes(query);
    });
  }, [actionLabel, entityFilter, entityLabel, feedLogs, searchQuery]);

  function getJournalEntityLabel(entityType: string) {
    if (entityType === "feed_post") return "Publication";
    if (entityType === "terrain_feedback") return "Retour terrain";
    return entityLabel(entityType);
  }

  function getJournalActionLabel(log: ChantierActivityLogRow) {
    if (log.entity_type === "feed_post") return "Message";
    if (log.entity_type === "terrain_feedback" && log.action_type === "started") {
      return "Prise en charge";
    }
    return actionLabel(log.action_type);
  }

  function getJournalEntityTone(entityType: string) {
    if (entityType === "feed_post") return "border-emerald-200 bg-emerald-50 text-emerald-700";
    if (entityType === "terrain_feedback") return "border-blue-200 bg-blue-50 text-blue-700";
    return tone(entityType);
  }

  function getFeedbackHref(log: ChantierActivityLogRow) {
    const targetChantierId = log.chantier_id || chantierId;
    if (!targetChantierId) return null;

    if (log.entity_type === "terrain_feedback" && log.entity_id) {
      return `/retours-terrain?chantierId=${encodeURIComponent(targetChantierId)}&feedbackId=${encodeURIComponent(log.entity_id)}`;
    }

    const changes = (log.changes ?? {}) as Record<string, unknown>;
    const sourceFeedbackId = String(changes.terrain_feedback_id ?? "").trim();
    if (log.entity_type === "reserve" && changes.source === "terrain_feedback" && sourceFeedbackId) {
      return `/retours-terrain?chantierId=${encodeURIComponent(targetChantierId)}&feedbackId=${encodeURIComponent(sourceFeedbackId)}`;
    }

    return null;
  }

  function getReserveHref(log: ChantierActivityLogRow) {
    if (log.entity_type !== "reserve") return null;
    const targetChantierId = log.chantier_id || chantierId;
    if (!targetChantierId || !log.entity_id) return null;

    const changes = (log.changes ?? {}) as Record<string, unknown>;
    const sourceFeedbackId =
      changes.source === "terrain_feedback"
        ? String(changes.terrain_feedback_id ?? "").trim()
        : "";
    const feedbackParam = sourceFeedbackId ? `&feedbackId=${encodeURIComponent(sourceFeedbackId)}` : "";

    return `/chantiers/${encodeURIComponent(targetChantierId)}/qualite?reserveId=${encodeURIComponent(log.entity_id)}${feedbackParam}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold section-title">Fil chantier</div>
          <div className="text-sm text-slate-500">
            Échanges d'équipe et événements métier réunis dans une seule chronologie chantier.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {terrainFeedbackHref ? (
            <Link
              to={terrainFeedbackHref}
              className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
            >
              Voir retours terrain
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => void Promise.all([onRefresh(), refreshPosts()])}
            disabled={loading || postsLoading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading || postsLoading ? "Chargement..." : "Rafraîchir"}
          </button>
        </div>
      </div>

      {!schemaReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Les événements automatiques ne sont pas disponibles tant que la migration
          `20260402100000_batipro_v2_foundation_prepare_control_pilot.sql` n'est pas appliquée sur Supabase.
        </div>
      )}

      {!postsSchemaReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Les publications collaboratives seront disponibles après application du SQL du fil chantier dans Supabase.
        </div>
      ) : null}

      {postsSchemaReady && !attachmentsSchemaReady ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Les messages texte fonctionnent. Applique le SQL complémentaire pour joindre des photos et PDF.
        </div>
      ) : null}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {postsError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {postsError}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {replyingToId && postById.get(replyingToId) ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.12em]">Réponse à</div>
              <div className="mt-1 truncate">{postById.get(replyingToId)?.body}</div>
            </div>
            <button
              type="button"
              onClick={() => setReplyingToId(null)}
              className="shrink-0 rounded-lg border border-blue-200 bg-white px-2 py-1 text-xs font-medium hover:bg-blue-100"
            >
              Annuler
            </button>
          </div>
        ) : null}

        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Écrire une information utile à l'équipe chantier..."
          rows={3}
          disabled={!postsSchemaReady || publishing}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
        />
        {selectedFiles.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${file.size}`}
                className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-800">{file.name}</div>
                  <div className="text-xs text-slate-500">{(file.size / (1024 * 1024)).toFixed(1)} Mo</div>
                </div>
                <button
                  type="button"
                  onClick={() => removeSelectedFile(index)}
                  disabled={publishing}
                  className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
                >
                  Retirer
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
              multiple
              hidden
              onChange={(event) => selectFiles(event.target.files)}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!postsSchemaReady || !attachmentsSchemaReady || publishing || selectedFiles.length >= 4}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ajouter photo ou PDF
            </button>
            <span className="text-xs text-slate-500">4 fichiers maximum · 20 Mo chacun</span>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span>Visible par</span>
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as ChantierFeedVisibility)}
              disabled={!postsSchemaReady || publishing}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 disabled:bg-slate-100"
            >
              <option value="equipe">Équipe chantier</option>
              <option value="backoffice">Back-office uniquement</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void publishPost()}
            disabled={!postsSchemaReady || publishing || !draft.trim()}
            className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {publishing ? "Publication..." : replyingToId ? "Publier la réponse" : "Publier"}
          </button>
        </div>
      </section>

      {feedLogs.length > 0 ? (
        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(220px,auto)_auto] md:items-center">
          <label className="min-w-0">
            <span className="sr-only">Rechercher dans le fil chantier</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Rechercher une action, une personne, une réserve..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label>
            <span className="sr-only">Filtrer par type d'événement</span>
            <select
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">Tous les événements</option>
              {availableEntityTypes.map((entityType) => (
                <option key={entityType} value={entityType}>
                  {getJournalEntityLabel(entityType)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center justify-between gap-3 md:justify-end">
            <span className="whitespace-nowrap text-xs font-medium text-slate-500">
              {filteredLogs.length} sur {feedLogs.length}
            </span>
            {searchQuery || entityFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setEntityFilter("all");
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                Réinitialiser
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {loading || postsLoading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Chargement du journal...
          </div>
        ) : feedLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Aucun événement journalisé pour ce chantier.
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Aucun événement ne correspond à cette recherche.
          </div>
        ) : (
          filteredLogs.map((log, index) => {
            const feedbackHref = getFeedbackHref(log);
            const reserveHref = getReserveHref(log);
            const changeItems = formatJournalChanges(log);
            const feedPost = log.entity_type === "feed_post" && log.entity_id
              ? postById.get(log.entity_id) ?? null
              : null;
            const parentPost = feedPost?.parent_post_id
              ? postById.get(feedPost.parent_post_id) ?? null
              : null;
            const dayKey = journalDayKey(log.created_at);
            const previousDayKey = index > 0 ? journalDayKey(filteredLogs[index - 1].created_at) : null;

            return (
              <div key={log.id} className="space-y-3">
                {dayKey !== previousDayKey ? (
                  <div className="sticky top-0 z-10 flex items-center gap-3 bg-white/95 py-2 backdrop-blur">
                    <div className="h-px flex-1 bg-slate-200" />
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {journalDayLabel(log.created_at)}
                    </div>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                ) : null}
                <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap gap-2">
                      <span className={["rounded-full border px-3 py-1 text-xs font-semibold", getJournalEntityTone(log.entity_type)].join(" ")}>
                        {getJournalEntityLabel(log.entity_type)}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                        {getJournalActionLabel(log)}
                      </span>
                    </div>
                    {parentPost ? (
                      <div className="mt-3 rounded-xl border-l-4 border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                        <div className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">
                          En réponse à {parentPost.author_name || "un membre de l'équipe"}
                        </div>
                        <div className="mt-1 line-clamp-2">{parentPost.body}</div>
                      </div>
                    ) : null}
                    <div
                      className={[
                        "mt-3 text-base text-slate-900",
                        log.entity_type === "feed_post" ? "whitespace-pre-wrap font-medium" : "font-semibold",
                      ].join(" ")}
                    >
                      {log.reason || "Action chantier"}
                    </div>
                    {feedPost?.attachments.length ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {feedPost.attachments.map((attachment) => {
                          const isImage = String(attachment.mime_type ?? "").startsWith("image/");
                          const content = isImage && attachment.signed_url ? (
                            <img
                              src={attachment.signed_url}
                              alt={attachment.file_name}
                              className="h-40 w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <div className="flex h-24 items-center justify-center bg-slate-50 px-4 text-center text-sm font-medium text-slate-700">
                              {attachment.file_name}
                            </div>
                          );

                          return attachment.signed_url ? (
                            <a
                              key={attachment.id}
                              href={attachment.signed_url}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-blue-300"
                            >
                              {content}
                              {isImage ? (
                                <div className="truncate px-3 py-2 text-xs font-medium text-slate-600">
                                  {attachment.file_name}
                                </div>
                              ) : null}
                            </a>
                          ) : (
                            <div key={attachment.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                              {content}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span>{log.actor_name || "Utilisateur"}</span>
                      {log.actor_role ? <span>{log.actor_role}</span> : null}
                      <span>{new Date(log.created_at).toLocaleString("fr-FR")}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {feedPost ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingToId(feedPost.id);
                          setDraft("");
                          window.requestAnimationFrame(() => {
                            document.querySelector<HTMLTextAreaElement>('textarea[placeholder^="Écrire une information"]')?.focus();
                          });
                        }}
                        className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
                      >
                        Répondre
                      </button>
                    ) : null}
                    {feedbackHref ? (
                      <Link
                        to={feedbackHref}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
                      >
                        Ouvrir retour
                      </Link>
                    ) : null}
                    {reserveHref ? (
                      <Link
                        to={reserveHref}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-100"
                      >
                        Ouvrir réserve
                      </Link>
                    ) : null}
                  </div>
                </div>

                {changeItems.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {changeItems.map((item) => (
                      <div
                        key={`${log.id}-${item.label}-${item.value}`}
                        className={["rounded-2xl border px-3 py-2 text-xs", changeToneClass(item.tone)].join(" ")}
                      >
                        <div className="font-semibold uppercase tracking-[0.12em] opacity-70">{item.label}</div>
                        <div className="mt-1 max-w-xs truncate font-medium">{item.value}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
                </article>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
