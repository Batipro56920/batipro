import { useEffect, useMemo, useState } from "react";
import { getChantiers, type ChantierRow } from "../services/chantiers.service";
import { listIntervenants, type IntervenantRow } from "../services/intervenants.service";
import {
  listTerrainFeedbackResponsibles,
  listTerrainFeedbacks,
  updateTerrainFeedback,
  type TerrainFeedbackCategory,
  type TerrainFeedbackResponsible,
  type TerrainFeedbackRow,
  type TerrainFeedbackStatus,
} from "../services/terrainFeedback.service";
import { useI18n } from "../i18n";

const CATEGORY_OPTIONS: TerrainFeedbackCategory[] = [
  "observation_chantier",
  "anomalie",
  "blocage",
  "suggestion",
  "qualite",
  "securite",
  "client",
  "organisation",
];

const STATUS_OPTIONS: TerrainFeedbackStatus[] = [
  "nouveau",
  "en_cours",
  "traite",
  "classe_sans_suite",
];

type DraftState = {
  status: TerrainFeedbackStatus;
  assigned_to: string;
  assigned_to_name: string;
  treatment_comment: string;
};

function badgeClass(tone: "blue" | "amber" | "green" | "red" | "slate") {
  if (tone === "green") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-700";
  if (tone === "red") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "blue") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function statusTone(status: TerrainFeedbackStatus) {
  if (status === "traite") return "green" as const;
  if (status === "classe_sans_suite") return "red" as const;
  if (status === "en_cours") return "amber" as const;
  return "blue" as const;
}

function urgencyTone(urgency: string) {
  if (urgency === "critique") return "red" as const;
  if (urgency === "urgente") return "amber" as const;
  if (urgency === "faible") return "green" as const;
  return "slate" as const;
}

export default function TerrainFeedbacksPage() {
  const { locale, t } = useI18n();
  const [rows, setRows] = useState<TerrainFeedbackRow[]>([]);
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [intervenants, setIntervenants] = useState<IntervenantRow[]>([]);
  const [responsibles, setResponsibles] = useState<TerrainFeedbackResponsible[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [filterChantierId, setFilterChantierId] = useState("");
  const [filterIntervenantId, setFilterIntervenantId] = useState("");
  const [filterStatus, setFilterStatus] = useState<TerrainFeedbackStatus | "">("");
  const [filterCategory, setFilterCategory] = useState<TerrainFeedbackCategory | "">("");
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});

  const responsibleNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of responsibles) map.set(item.id, item.display_name);
    return map;
  }, [responsibles]);

  function syncDrafts(nextRows: TerrainFeedbackRow[]) {
    const nextDrafts: Record<string, DraftState> = {};
    nextRows.forEach((row) => {
      nextDrafts[row.id] = {
        status: row.status,
        assigned_to: row.assigned_to ?? "",
        assigned_to_name: row.assigned_to_name ?? "",
        treatment_comment: row.treatment_comment ?? "",
      };
    });
    setDrafts(nextDrafts);
  }

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [feedbackRows, chantierRows, intervenantRows, responsibleRows] = await Promise.all([
        listTerrainFeedbacks({
          chantierId: filterChantierId || undefined,
          intervenantId: filterIntervenantId || undefined,
          status: filterStatus || undefined,
          category: filterCategory || undefined,
        }),
        getChantiers(),
        listIntervenants(),
        listTerrainFeedbackResponsibles().catch(() => []),
      ]);
      setRows(feedbackRows);
      setChantiers(chantierRows);
      setIntervenants(intervenantRows);
      setResponsibles(responsibleRows);
      syncDrafts(feedbackRows);
    } catch (err: any) {
      setError(err?.message ?? t("terrainFeedback.admin.loadError"));
      setRows([]);
      syncDrafts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [filterCategory, filterChantierId, filterIntervenantId, filterStatus]);

  function updateDraft(id: string, patch: Partial<DraftState>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  async function saveRow(row: TerrainFeedbackRow) {
    const draft = drafts[row.id];
    if (!draft) return;
    setSavingId(row.id);
    setError(null);
    try {
      await updateTerrainFeedback(row.id, {
        status: draft.status,
        assigned_to: draft.assigned_to || null,
        assigned_to_name:
          draft.assigned_to_name || responsibleNameById.get(draft.assigned_to) || null,
        treatment_comment: draft.treatment_comment || null,
      });
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? t("terrainFeedback.admin.saveError"));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">{t("terrainFeedback.admin.title")}</h1>
          <p className="text-slate-500">{t("terrainFeedback.admin.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {t("common.actions.refresh")}
        </button>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {t("terrainFeedback.admin.filters")}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1 text-sm">
            <div className="text-xs font-medium text-slate-500">{t("terrainFeedback.admin.siteFilter")}</div>
            <select
              className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm"
              value={filterChantierId}
              onChange={(e) => setFilterChantierId(e.target.value)}
            >
              <option value="">{t("terrainFeedback.admin.allSites")}</option>
              {chantiers.map((chantier) => (
                <option key={chantier.id} value={chantier.id}>
                  {chantier.nom}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <div className="text-xs font-medium text-slate-500">{t("terrainFeedback.admin.authorFilter")}</div>
            <select
              className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm"
              value={filterIntervenantId}
              onChange={(e) => setFilterIntervenantId(e.target.value)}
            >
              <option value="">{t("terrainFeedback.admin.allIntervenants")}</option>
              {intervenants.map((intervenant) => (
                <option key={intervenant.id} value={intervenant.id}>
                  {intervenant.nom}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <div className="text-xs font-medium text-slate-500">{t("common.labels.status")}</div>
            <select
              className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as TerrainFeedbackStatus | "")}
            >
              <option value="">{t("terrainFeedback.admin.allStatuses")}</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {t(`terrainFeedback.statuses.${status}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 text-sm">
            <div className="text-xs font-medium text-slate-500">{t("common.labels.category")}</div>
            <select
              className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as TerrainFeedbackCategory | "")}
            >
              <option value="">{t("terrainFeedback.admin.allCategories")}</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {t(`terrainFeedback.categories.${category}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          {t("common.states.loading")}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500 shadow-sm">
          {t("terrainFeedback.admin.empty")}
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const draft = drafts[row.id];
            return (
              <article key={row.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-950">{row.title}</h2>
                      <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass(statusTone(row.status))].join(" ")}>
                        {t(`terrainFeedback.statuses.${row.status}`)}
                      </span>
                      <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass(urgencyTone(row.urgency))].join(" ")}>
                        {t(`terrainFeedback.urgencies.${row.urgency}`)}
                      </span>
                      <span className={["inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold", badgeClass("slate")].join(" ")}>
                        {t(`terrainFeedback.categories.${row.category}`)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {(row.chantier?.nom ?? t("common.states.unavailable"))} • {(row.author?.nom ?? t("common.states.unavailable"))} •{" "}
                      {row.created_at ? new Date(row.created_at).toLocaleString(locale) : t("common.states.unavailable")}
                    </div>
                    <div className="mt-4 whitespace-pre-wrap text-sm text-slate-700">{row.description}</div>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("terrainFeedback.admin.context")}
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div>
                          <div className="text-xs text-slate-500">{t("terrainFeedback.admin.site")}</div>
                          <div className="mt-1 text-sm font-medium text-slate-900">{row.chantier?.nom ?? "-"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">{t("terrainFeedback.admin.author")}</div>
                          <div className="mt-1 text-sm font-medium text-slate-900">{row.author?.nom ?? "-"}</div>
                          <div className="mt-1 text-xs text-slate-500">
                            {[row.author?.email, row.author?.telephone].filter(Boolean).join(" • ") || "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">{t("terrainFeedback.admin.createdAt")}</div>
                          <div className="mt-1 text-sm font-medium text-slate-900">
                            {row.created_at ? new Date(row.created_at).toLocaleString(locale) : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-slate-500">{t("terrainFeedback.admin.treatedAt")}</div>
                          <div className="mt-1 text-sm font-medium text-slate-900">
                            {row.treated_at ? new Date(row.treated_at).toLocaleString(locale) : t("terrainFeedback.admin.notProcessed")}
                          </div>
                        </div>
                      </div>
                    </div>

                    {row.attachments.length > 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                          {t("terrainFeedback.admin.photos")}
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
                          {row.attachments.map((attachment) => (
                            <a
                              key={attachment.id}
                              href={attachment.public_url}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                            >
                              <img
                                src={attachment.public_url}
                                alt={attachment.file_name}
                                className="h-32 w-full object-cover"
                                loading="lazy"
                              />
                              <div className="px-3 py-2 text-xs text-slate-500">{attachment.file_name}</div>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {t("terrainFeedback.admin.history")}
                      </div>
                      <div className="mt-3 space-y-3">
                        {row.history.length === 0 ? (
                          <div className="text-sm text-slate-500">{t("terrainFeedback.admin.noHistory")}</div>
                        ) : (
                          row.history.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <div className="text-sm font-medium text-slate-900">
                                {item.changed_by_name || t("terrainFeedback.admin.system")}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {item.created_at ? new Date(item.created_at).toLocaleString(locale) : "-"} • {item.action}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                      {t("terrainFeedback.admin.processing")}
                    </div>
                    <div className="mt-4 space-y-4">
                      <label className="space-y-1 text-sm">
                        <div className="text-xs font-medium text-slate-500">{t("common.labels.status")}</div>
                        <select
                          className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm"
                          value={draft?.status ?? row.status}
                          onChange={(e) => updateDraft(row.id, { status: e.target.value as TerrainFeedbackStatus })}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {t(`terrainFeedback.statuses.${status}`)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1 text-sm">
                        <div className="text-xs font-medium text-slate-500">{t("terrainFeedback.admin.assignedTo")}</div>
                        <select
                          className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm"
                          value={draft?.assigned_to ?? row.assigned_to ?? ""}
                          onChange={(e) =>
                            updateDraft(row.id, {
                              assigned_to: e.target.value,
                              assigned_to_name: responsibleNameById.get(e.target.value) ?? "",
                            })
                          }
                        >
                          <option value="">{t("terrainFeedback.admin.unassigned")}</option>
                          {responsibles.map((responsible) => (
                            <option key={responsible.id} value={responsible.id}>
                              {responsible.display_name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1 text-sm">
                        <div className="text-xs font-medium text-slate-500">{t("terrainFeedback.admin.processingComment")}</div>
                        <textarea
                          className="min-h-36 w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm"
                          value={draft?.treatment_comment ?? row.treatment_comment ?? ""}
                          onChange={(e) => updateDraft(row.id, { treatment_comment: e.target.value })}
                          placeholder={t("terrainFeedback.admin.processingCommentPlaceholder")}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => void saveRow(row)}
                        disabled={savingId === row.id}
                        className="w-full rounded-2xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(30,64,175,0.22)] hover:bg-blue-800 disabled:opacity-60"
                      >
                        {savingId === row.id ? t("common.states.saving") : t("common.actions.save")}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
