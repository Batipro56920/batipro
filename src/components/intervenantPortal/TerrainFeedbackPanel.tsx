import type { FormEvent } from "react";
import {
  PortalBadge,
  PortalCard,
  PortalEmptyState,
  PortalField,
  PortalPrimaryButton,
  PortalSectionHeading,
  portalInputClass,
} from "./PortalUi";
import type { IntervenantChantier, IntervenantTerrainFeedback } from "../../services/intervenantPortal.service";

type FeedbackFormState = {
  chantier_id: string;
  category: string;
  urgency: string;
  title: string;
  description: string;
};

type FeedbackStatusTone = "blue" | "amber" | "green" | "red";

const CATEGORIES = [
  "observation_chantier",
  "anomalie",
  "blocage",
  "suggestion",
  "qualite",
  "securite",
  "client",
  "organisation",
] as const;

const URGENCIES = ["faible", "normale", "urgente", "critique"] as const;

function statusTone(status: IntervenantTerrainFeedback["status"]): FeedbackStatusTone {
  if (status === "traite") return "green";
  if (status === "classe_sans_suite") return "red";
  if (status === "en_cours") return "amber";
  return "blue";
}

function urgencyTone(urgency: string): FeedbackStatusTone {
  if (urgency === "critique") return "red";
  if (urgency === "urgente") return "amber";
  if (urgency === "faible") return "green";
  return "blue";
}

export default function TerrainFeedbackPanel({
  t,
  chantiers,
  activeChantierId,
  form,
  onChange,
  onSubmit,
  saving,
  feedback,
  files,
  onFilesChange,
  listLoading,
  listError,
  rows,
  formatDate,
  formatDateTime,
}: {
  t: (key: string, params?: Record<string, string | number>) => string;
  chantiers: IntervenantChantier[];
  activeChantierId: string;
  form: FeedbackFormState;
  onChange: (patch: Partial<FeedbackFormState>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
  files: File[];
  onFilesChange: (files: File[]) => void;
  listLoading: boolean;
  listError: string | null;
  rows: IntervenantTerrainFeedback[];
  formatDate: (value: string | null) => string;
  formatDateTime: (value: string | null) => string;
}) {
  return (
    <div className="space-y-4">
      <PortalCard tone="default">
        <PortalSectionHeading
          eyebrow={t("intervenantPortal.terrainFeedback.new")}
          title={t("intervenantPortal.terrainFeedback.title")}
          subtitle={t("intervenantPortal.terrainFeedback.subtitle")}
        />
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <PortalField label={t("intervenantPortal.terrainFeedback.site")}>
              <select
                className={portalInputClass()}
                value={form.chantier_id}
                onChange={(e) => onChange({ chantier_id: e.target.value })}
              >
                {chantiers.map((chantier) => (
                  <option key={chantier.id} value={chantier.id}>
                    {chantier.nom}
                  </option>
                ))}
              </select>
            </PortalField>

            <PortalField label={t("intervenantPortal.terrainFeedback.category")}>
              <select
                className={portalInputClass()}
                value={form.category}
                onChange={(e) => onChange({ category: e.target.value })}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`terrainFeedback.categories.${category}`)}
                  </option>
                ))}
              </select>
            </PortalField>

            <PortalField label={t("intervenantPortal.terrainFeedback.urgency")}>
              <select
                className={portalInputClass()}
                value={form.urgency}
                onChange={(e) => onChange({ urgency: e.target.value })}
              >
                {URGENCIES.map((urgency) => (
                  <option key={urgency} value={urgency}>
                    {t(`terrainFeedback.urgencies.${urgency}`)}
                  </option>
                ))}
              </select>
            </PortalField>

            <PortalField label={t("intervenantPortal.terrainFeedback.dateAuto")}>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {formatDate(new Date().toISOString().slice(0, 10))}
              </div>
            </PortalField>
          </div>

          <PortalField label={t("intervenantPortal.terrainFeedback.shortTitle")}>
            <input
              className={portalInputClass()}
              value={form.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder={t("intervenantPortal.terrainFeedback.shortTitlePlaceholder")}
            />
          </PortalField>

          <PortalField label={t("intervenantPortal.terrainFeedback.description")}>
            <textarea
              className={[portalInputClass(), "min-h-32 resize-y"].join(" ")}
              value={form.description}
              onChange={(e) => onChange({ description: e.target.value })}
              placeholder={t("intervenantPortal.terrainFeedback.descriptionPlaceholder")}
            />
          </PortalField>

          <PortalField label={t("intervenantPortal.terrainFeedback.photos")}>
            <input
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-2xl file:border-0 file:bg-blue-700 file:px-4 file:py-3 file:text-sm file:font-semibold file:text-white"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              onChange={(e) => onFilesChange(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 ? (
              <div className="space-y-2 rounded-[1rem] border border-slate-200 bg-slate-50/80 p-3">
                {files.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="text-sm text-slate-600">
                    {file.name}
                  </div>
                ))}
              </div>
            ) : null}
          </PortalField>

          {feedback ? (
            <div
              className={[
                "rounded-[1rem] border px-4 py-3 text-sm",
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700",
              ].join(" ")}
            >
              {feedback.message}
            </div>
          ) : null}

          <div className="flex justify-end">
            <PortalPrimaryButton type="submit" disabled={saving} className="w-full sm:w-auto">
              {saving ? t("intervenantPortal.terrainFeedback.sending") : t("intervenantPortal.terrainFeedback.send")}
            </PortalPrimaryButton>
          </div>
        </form>
      </PortalCard>

      <PortalCard tone="default">
        <PortalSectionHeading
          eyebrow={t("intervenantPortal.terrainFeedback.myReports")}
          title={t("intervenantPortal.terrainFeedback.myReports")}
          subtitle={
            activeChantierId
              ? t("intervenantPortal.terrainFeedback.filteredBySite")
              : t("intervenantPortal.terrainFeedback.allSites")
          }
        />
        {listLoading ? (
          <div className="mt-4">
            <PortalEmptyState>{t("intervenantPortal.terrainFeedback.loading")}</PortalEmptyState>
          </div>
        ) : listError ? (
          <div className="mt-4 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {listError}
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-4">
            <PortalEmptyState>{t("intervenantPortal.terrainFeedback.empty")}</PortalEmptyState>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((row) => (
              <article key={row.id} className="rounded-[1rem] border border-slate-200 bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-900">{row.title}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {row.chantier_nom || chantiers.find((chantier) => chantier.id === row.chantier_id)?.nom || "-"} •{" "}
                      {formatDateTime(row.created_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <PortalBadge tone={urgencyTone(row.urgency)}>
                      {t(`terrainFeedback.urgencies.${row.urgency}`)}
                    </PortalBadge>
                    <PortalBadge tone={statusTone(row.status)}>
                      {t(`terrainFeedback.statuses.${row.status}`)}
                    </PortalBadge>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <PortalBadge>{t(`terrainFeedback.categories.${row.category}`)}</PortalBadge>
                  {row.assigned_to_name ? (
                    <PortalBadge tone="blue">
                      {t("intervenantPortal.terrainFeedback.assignedTo", { value: row.assigned_to_name })}
                    </PortalBadge>
                  ) : null}
                </div>

                <div className="mt-3 text-sm text-slate-600 whitespace-pre-wrap">{row.description}</div>
                {row.treatment_comment ? (
                  <div className="mt-3 rounded-[1rem] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
                      {t("intervenantPortal.terrainFeedback.processingComment")}
                    </div>
                    <div className="mt-1 whitespace-pre-wrap">{row.treatment_comment}</div>
                    {row.treated_at ? (
                      <div className="mt-2 text-xs text-slate-500">
                        {t("intervenantPortal.terrainFeedback.processedOn", { value: formatDateTime(row.treated_at) })}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {row.attachments.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {row.attachments.map((attachment) => (
                      <a
                        key={attachment.id}
                        href={attachment.public_url}
                        target="_blank"
                        rel="noreferrer"
                        className="overflow-hidden rounded-[1rem] border border-slate-200 bg-white"
                      >
                        <img
                          src={attachment.public_url}
                          alt={attachment.file_name}
                          className="h-28 w-full object-cover"
                          loading="lazy"
                        />
                        <div className="px-3 py-2 text-xs text-slate-500">{attachment.file_name}</div>
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </PortalCard>
    </div>
  );
}
