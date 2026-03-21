import { useMemo } from "react";
import { useI18n } from "../i18n";
import { PortalBadge, PortalPrimaryButton, PortalSecondaryButton, PortalSectionHeading, portalCardClass } from "./intervenantPortal/PortalUi";

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
    status === "validated" ? "green" : status === "in_progress" ? "amber" : "neutral";

  const showMaterialButton = status !== "pending" && values.has_equipment !== true;
  const showMaterialsButton = status !== "pending" && values.has_materials !== true;
  const showInformationButton = status !== "pending" && values.has_information !== true;

  return (
    <section className={portalCardClass("accent")}>
      <PortalSectionHeading
        eyebrow={t("intervenantPortal.checklistFocusTitle")}
        title={t("intervenantPortal.dailyChecklist.title")}
        subtitle={
          <>
            {t("intervenantPortal.dailyChecklist.subtitle", { date: checklistDateLabel })}
            {validatedAtLabel ? (
              <span className="mt-1 block text-emerald-700">
                {t("intervenantPortal.dailyChecklist.validatedAt", { date: validatedAtLabel })}
              </span>
            ) : null}
          </>
        }
        aside={<PortalBadge tone={statusClass as "neutral" | "green" | "amber"}>{statusLabel}</PortalBadge>}
      />

      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <label
            key={item.key}
            className={[
              "flex items-start gap-3 rounded-[1rem] border px-4 py-4 transition",
              item.checked ? "border-blue-200 bg-blue-50/90 shadow-[0_8px_18px_rgba(30,64,175,0.08)]" : "border-slate-200 bg-white",
              status === "validated" ? "opacity-85" : "cursor-pointer hover:border-blue-200 hover:bg-blue-50/40",
            ].join(" ")}
          >
            <input
              type="checkbox"
              className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-700"
              checked={item.checked}
              disabled={saving || status === "validated"}
              onChange={() => onToggle(item.key)}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold leading-5 text-slate-900">{item.label}</div>
              {item.conditional && !item.checked && status !== "pending" ? (
                <div className="mt-1 text-xs text-amber-700">{t("intervenantPortal.dailyChecklist.missingHint")}</div>
              ) : null}
            </div>
            <div className={["mt-0.5 h-6 w-6 rounded-full border", item.checked ? "border-blue-700 bg-blue-700" : "border-slate-200 bg-slate-50"].join(" ")} />
          </label>
        ))}
      </div>

      {showMaterialButton || showMaterialsButton || showInformationButton ? (
        <div className="mt-5 rounded-[1rem] border border-amber-200 bg-white/90 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            {t("intervenantPortal.dailyChecklist.requestsTitle")}
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {showMaterialButton ? (
              <PortalSecondaryButton type="button" onClick={onRequestMaterial} className="w-full justify-center text-left">
                {t("intervenantPortal.dailyChecklist.actions.requestMaterial")}
              </PortalSecondaryButton>
            ) : null}
            {showMaterialsButton ? (
              <PortalSecondaryButton type="button" onClick={onRequestMaterials} className="w-full justify-center text-left">
                {t("intervenantPortal.dailyChecklist.actions.requestMaterials")}
              </PortalSecondaryButton>
            ) : null}
            {showInformationButton ? (
              <PortalSecondaryButton type="button" onClick={onRequestInformation} className="w-full justify-center text-left">
                {t("intervenantPortal.dailyChecklist.actions.requestInformation")}
              </PortalSecondaryButton>
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

      <div className="mt-5">
        <PortalPrimaryButton
          type="button"
          onClick={onValidate}
          disabled={saving || status === "validated"}
          className={["w-full", saving || status === "validated" ? "bg-slate-300 shadow-none hover:bg-slate-300" : ""].join(" ")}
        >
          {status === "validated"
            ? t("intervenantPortal.dailyChecklist.actions.validated")
            : saving
              ? t("intervenantPortal.dailyChecklist.actions.saving")
              : t("intervenantPortal.dailyChecklist.actions.validate")}
        </PortalPrimaryButton>
      </div>
    </section>
  );
}
