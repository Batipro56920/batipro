import { useMemo } from "react";
import { useI18n } from "../i18n";

export type DailyChecklistItemKey =
  | "photos_taken"
  | "tasks_reported"
  | "time_logged"
  | "has_equipment"
  | "has_materials"
  | "has_information";

export type DailyChecklistValues = Record<DailyChecklistItemKey, boolean | null>;

type Props = {
  status: "pending" | "in_progress" | "validated";
  checklistDateLabel: string;
  validatedAtLabel: string | null;
  values: DailyChecklistValues;
  saving: boolean;
  feedback: { type: "success" | "error"; message: string } | null;
  onToggle: (key: DailyChecklistItemKey) => void;
  onValidate: () => void;
  onRequestMaterial: () => void;
  onRequestMaterials: () => void;
  onRequestInformation: () => void;
};

const CONDITIONAL_KEYS = new Set<DailyChecklistItemKey>(["has_equipment", "has_materials", "has_information"]);

export default function TodayChecklistCard({
  status,
  checklistDateLabel,
  validatedAtLabel,
  values,
  saving,
  feedback,
  onToggle,
  onValidate,
  onRequestMaterial,
  onRequestMaterials,
  onRequestInformation,
}: Props) {
  const { t } = useI18n();

  const items = useMemo(
    () =>
      ([
        "photos_taken",
        "tasks_reported",
        "time_logged",
        "has_equipment",
        "has_materials",
        "has_information",
      ] as DailyChecklistItemKey[]).map((key) => ({
        key,
        label: t(`intervenantPortal.dailyChecklist.items.${key}`),
        checked: values[key] === true,
        conditional: CONDITIONAL_KEYS.has(key),
      })),
    [t, values],
  );

  const statusLabel =
    status === "validated"
      ? t("intervenantPortal.dailyChecklist.status.validated")
      : status === "in_progress"
        ? t("intervenantPortal.dailyChecklist.status.inProgress")
        : t("intervenantPortal.dailyChecklist.status.pending");
  const statusClass =
    status === "validated"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "in_progress"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  const showMaterialButton = status !== "pending" && values.has_equipment !== true;
  const showMaterialsButton = status !== "pending" && values.has_materials !== true;
  const showInformationButton = status !== "pending" && values.has_information !== true;

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{t("intervenantPortal.dailyChecklist.title")}</div>
          <div className="mt-1 text-xs text-slate-500">
            {t("intervenantPortal.dailyChecklist.subtitle", { date: checklistDateLabel })}
          </div>
          {validatedAtLabel ? (
            <div className="mt-1 text-xs text-emerald-700">
              {t("intervenantPortal.dailyChecklist.validatedAt", { date: validatedAtLabel })}
            </div>
          ) : null}
        </div>
        <span className={["inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-medium", statusClass].join(" ")}>
          {statusLabel}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {items.map((item) => (
          <label
            key={item.key}
            className={[
              "flex items-start gap-3 rounded-2xl border px-3 py-3 transition",
              item.checked ? "border-blue-200 bg-blue-50/70" : "border-slate-200 bg-white",
              status === "validated" ? "opacity-80" : "cursor-pointer hover:border-slate-300",
            ].join(" ")}
          >
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
              checked={item.checked}
              disabled={saving || status === "validated"}
              onChange={() => onToggle(item.key)}
            />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-slate-900">{item.label}</div>
              {item.conditional && !item.checked && status !== "pending" ? (
                <div className="mt-1 text-xs text-amber-700">{t("intervenantPortal.dailyChecklist.missingHint")}</div>
              ) : null}
            </div>
          </label>
        ))}
      </div>

      {showMaterialButton || showMaterialsButton || showInformationButton ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-3">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            {t("intervenantPortal.dailyChecklist.requestsTitle")}
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {showMaterialButton ? (
              <button
                type="button"
                onClick={onRequestMaterial}
                className="rounded-full border border-blue-600 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {t("intervenantPortal.dailyChecklist.actions.requestMaterial")}
              </button>
            ) : null}
            {showMaterialsButton ? (
              <button
                type="button"
                onClick={onRequestMaterials}
                className="rounded-full border border-blue-600 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
              >
                {t("intervenantPortal.dailyChecklist.actions.requestMaterials")}
              </button>
            ) : null}
            {showInformationButton ? (
              <button
                type="button"
                onClick={onRequestInformation}
                className="rounded-full border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {t("intervenantPortal.dailyChecklist.actions.requestInformation")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {feedback ? (
        <div
          className={[
            "mt-4 rounded-2xl border px-3 py-2 text-sm",
            feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700",
          ].join(" ")}
        >
          {feedback.message}
        </div>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={onValidate}
          disabled={saving || status === "validated"}
          className={[
            "rounded-full px-4 py-2 text-sm font-medium",
            saving || status === "validated"
              ? "bg-slate-200 text-slate-500"
              : "bg-slate-900 text-white hover:bg-slate-800",
          ].join(" ")}
        >
          {status === "validated"
            ? t("intervenantPortal.dailyChecklist.actions.validated")
            : saving
              ? t("intervenantPortal.dailyChecklist.actions.saving")
              : t("intervenantPortal.dailyChecklist.actions.validate")}
        </button>
      </div>
    </section>
  );
}
