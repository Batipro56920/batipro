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
    if (log.entity_type !== "terrain_feedback") return null;
    const targetChantierId = log.chantier_id || chantierId;
    if (!targetChantierId || !log.entity_id) return null;
    return `/retours-terrain?chantierId=${encodeURIComponent(targetChantierId)}&feedbackId=${encodeURIComponent(log.entity_id)}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="font-semibold section-title">Journal chantier</div>
          <div className="text-sm text-slate-500">
            Historique des actions, validations, consignes, réserves, retours terrain et temps saisis.
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
          Migration journal non appliquée : le tableau reste vide tant que
          `20260402100000_batipro_v2_foundation_prepare_control_pilot.sql` n’est pas poussée sur Supabase.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Chargement du journal...
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
            Aucun événement journalisé pour ce chantier.
          </div>
        ) : (
          logs.map((log) => {
            const feedbackHref = getFeedbackHref(log);
            const changeItems = formatJournalChanges(log);

            return (
              <article key={log.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
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

                  {feedbackHref ? (
                    <Link
                      to={feedbackHref}
                      className="shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100"
                    >
                      Ouvrir retour
                    </Link>
                  ) : null}
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
            );
          })
        )}
      </div>
    </div>
  );
}
