import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ChantierActivityLogRow } from "../../../services/chantierActivityLog.service";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  const availableEntityTypes = useMemo(
    () =>
      Array.from(new Set(logs.map((log) => log.entity_type)))
        .filter(Boolean)
        .sort((left, right) => {
          const leftLabel = left === "terrain_feedback" ? "Retour terrain" : entityLabel(left);
          const rightLabel = right === "terrain_feedback" ? "Retour terrain" : entityLabel(right);
          return leftLabel.localeCompare(rightLabel, "fr");
        }),
    [entityLabel, logs],
  );

  const filteredLogs = useMemo(() => {
    const query = normalizeJournalSearch(searchQuery.trim());
    return logs.filter((log) => {
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
  }, [actionLabel, entityFilter, entityLabel, logs, searchQuery]);

  function getJournalEntityLabel(entityType: string) {
    if (entityType === "terrain_feedback") return "Retour terrain";
    return entityLabel(entityType);
  }

  function getJournalActionLabel(log: ChantierActivityLogRow) {
    if (log.entity_type === "terrain_feedback" && log.action_type === "started") {
      return "Prise en charge";
    }
    return actionLabel(log.action_type);
  }

  function getJournalEntityTone(entityType: string) {
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
            Toute l'activité utile du chantier, dans l'ordre chronologique et reliée aux objets métier.
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
            onClick={() => void onRefresh()}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Chargement..." : "Rafraîchir"}
          </button>
        </div>
      </div>

      {!schemaReady && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Le fil chantier n'est pas disponible tant que la migration
          `20260402100000_batipro_v2_foundation_prepare_control_pilot.sql` n'est pas appliquée sur Supabase.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {logs.length > 0 ? (
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
              {filteredLogs.length} sur {logs.length}
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
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Chargement du journal...
          </div>
        ) : logs.length === 0 ? (
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
                    <div className="mt-3 text-base font-semibold text-slate-900">
                      {log.reason || "Action chantier"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                      <span>{log.actor_name || "Utilisateur"}</span>
                      {log.actor_role ? <span>{log.actor_role}</span> : null}
                      <span>{new Date(log.created_at).toLocaleString("fr-FR")}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
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
