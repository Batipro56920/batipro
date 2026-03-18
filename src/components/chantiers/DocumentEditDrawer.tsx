import { useEffect } from "react";
import type { DocumentVisibilityOption } from "../../services/chantierDocuments.service";
import type { IntervenantRow } from "../../services/intervenants.service";
import { useI18n } from "../../i18n";

const DOCUMENT_CATEGORIES = [
  "Administratif",
  "Plans",
  "Fiches techniques",
  "Photos",
  "PV",
  "VISITE",
  "DOE",
  "Divers",
] as const;

const DOCUMENT_TYPES = [
  "PLAN",
  "FICHE_TECHNIQUE",
  "PHOTO",
  "MAIL",
  "PV",
  "VISITE",
  "DOE",
  "PDF",
  "AUTRE",
] as const;

type Props = {
  open: boolean;
  documentTitle: string;
  title: string;
  category: string;
  documentType: string;
  visibilityMode: DocumentVisibilityOption;
  accessIds: string[];
  intervenants: IntervenantRow[];
  onTitleChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onDocumentTypeChange: (value: string) => void;
  onVisibilityModeChange: (value: DocumentVisibilityOption) => void;
  onAccessIdsChange: (value: string[]) => void;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
  loadingAccess?: boolean;
  error?: string | null;
  infoMessage?: string | null;
  canSave?: boolean;
};

export default function DocumentEditDrawer({
  open,
  documentTitle,
  title,
  category,
  documentType,
  visibilityMode,
  accessIds,
  intervenants,
  onTitleChange,
  onCategoryChange,
  onDocumentTypeChange,
  onVisibilityModeChange,
  onAccessIdsChange,
  onClose,
  onSave,
  onDelete,
  saving,
  deleting,
  loadingAccess,
  error,
  infoMessage,
  canSave = true,
}: Props) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const canSelectIntervenants = visibilityMode === "RESTRICTED";
  const busy = saving || deleting;
  const disableSave = busy || !canSave;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-screen w-[50vw] max-w-[900px] min-w-[360px] bg-white border-l shadow-xl flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold truncate">{t("documentEdit.title")} — {documentTitle}</div>
          <button
            type="button"
            className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
            onClick={onClose}
            disabled={busy}
          >
            {t("common.actions.close")}
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 space-y-4">
          <div className="space-y-1">
            <div className="text-xs text-slate-600">{t("documentEdit.documentName")}</div>
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={t("documentEdit.documentName")}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs text-slate-600">{t("common.labels.category")}</div>
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={category}
                onChange={(e) => onCategoryChange(e.target.value)}
              >
                {DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-600">{t("common.labels.type")}</div>
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={documentType}
                onChange={(e) => onDocumentTypeChange(e.target.value)}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1 md:col-span-2">
              <div className="text-xs text-slate-600">{t("documentEdit.visibilityMode")}</div>
              <select
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={visibilityMode}
                onChange={(e) => onVisibilityModeChange(e.target.value as DocumentVisibilityOption)}
              >
                <option value="GLOBAL">{t("common.visibility.global")}</option>
                <option value="RESTRICTED">{t("common.visibility.restricted")}</option>
                <option value="ADMIN_ONLY">{t("common.visibility.adminOnly")}</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-slate-600">{t("documentEdit.allowedIntervenants")}</div>
            <div
              className={[
                "rounded-xl border p-3 space-y-2 max-h-48 overflow-auto",
                canSelectIntervenants ? "bg-white" : "bg-slate-50 text-slate-400",
              ].join(" ")}
            >
              {loadingAccess ? (
                <div className="text-xs text-slate-500">{t("common.states.loading")}</div>
              ) : intervenants.length === 0 ? (
                <div className="text-xs text-slate-500">{t("documentEdit.noIntervenant")}</div>
              ) : (
                intervenants.map((i) => {
                  const checked = accessIds.includes(i.id);
                  return (
                    <label key={i.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canSelectIntervenants}
                        onChange={() =>
                          onAccessIdsChange(
                            checked ? accessIds.filter((id) => id !== i.id) : [...accessIds, i.id],
                          )
                        }
                      />
                      <span>{i.nom}</span>
                    </label>
                  );
                })
              )}
            </div>
            {!canSelectIntervenants && (
              <div className="text-xs text-slate-500">{t("documentEdit.selectionDisabled")}</div>
            )}
          </div>

          {infoMessage && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {infoMessage}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="border-t p-4 flex justify-between gap-2">
          <button
            type="button"
            className="rounded-xl border border-red-200 text-red-700 px-3 py-2 text-sm hover:bg-red-50"
            onClick={onDelete}
            disabled={busy}
          >
            {deleting ? t("common.states.deleting") : t("common.actions.delete")}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
              onClick={onClose}
              disabled={busy}
            >
              {t("common.actions.cancel")}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={disableSave}
              className={[
                "rounded-xl px-4 py-2 text-sm",
                disableSave ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
              ].join(" ")}
            >
              {saving ? t("common.states.saving") : t("common.actions.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}













