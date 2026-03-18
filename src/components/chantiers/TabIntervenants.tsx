import React from "react";
import type { IntervenantRow } from "../../services/intervenants.service";
import { useI18n } from "../../i18n";

type Props = {
  intervenants: IntervenantRow[];
  intervenantsLoading: boolean;
  intervenantsError: string | null;

  refreshIntervenants: () => Promise<void>;

  creatingIntervenant: boolean;
  newIntervenantNom: string;
  newIntervenantEmail: string;
  newIntervenantTel: string;
  setNewIntervenantNom: (v: string) => void;
  setNewIntervenantEmail: (v: string) => void;
  setNewIntervenantTel: (v: string) => void;
  onCreateIntervenantFromTab: (e: React.FormEvent) => Promise<void>;

  sendingAccessId: string | null;
  onSendAccess: (i: IntervenantRow) => Promise<void>;

  accessUrlByIntervenant: Record<string, string>;
  copyToClipboard: (text: string) => Promise<void>;

  startEditIntervenant: (i: IntervenantRow) => void;
  onDeleteIntervenant: (i: IntervenantRow) => Promise<void>;
};

export default function TabIntervenants(props: Props) {
  const { t } = useI18n();
  const {
    intervenants,
    intervenantsLoading,
    intervenantsError,
    refreshIntervenants,

    creatingIntervenant,
    newIntervenantNom,
    newIntervenantEmail,
    newIntervenantTel,
    setNewIntervenantNom,
    setNewIntervenantEmail,
    setNewIntervenantTel,
    onCreateIntervenantFromTab,

    sendingAccessId,
    onSendAccess,
    accessUrlByIntervenant,
    copyToClipboard,

    startEditIntervenant,
    onDeleteIntervenant,
  } = props;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{t("intervenantsTab.title")}</div>
          <div className="text-sm text-slate-500">
            {t("intervenantsTab.subtitle")}
          </div>
        </div>
        <button
          type="button"
          onClick={refreshIntervenants}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
          disabled={intervenantsLoading}
        >
          {intervenantsLoading ? t("intervenantsTab.loading") : t("common.actions.refresh")}
        </button>
      </div>

      {intervenantsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {intervenantsError}
        </div>
      )}

      <form onSubmit={onCreateIntervenantFromTab} className="rounded-xl border bg-slate-50 p-4 space-y-3">
        <div className="font-semibold text-sm">{t("intervenantsTab.addTitle")}</div>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder={t("intervenantsTab.namePlaceholder")}
            value={newIntervenantNom}
            onChange={(e) => setNewIntervenantNom(e.target.value)}
          />
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder={t("intervenantsTab.emailPlaceholder")}
            value={newIntervenantEmail}
            onChange={(e) => setNewIntervenantEmail(e.target.value)}
          />
          <input
            className="rounded-xl border px-3 py-2 text-sm"
            placeholder={t("intervenantsTab.phonePlaceholder")}
            value={newIntervenantTel}
            onChange={(e) => setNewIntervenantTel(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={creatingIntervenant}
            className={[
              "rounded-xl px-4 py-2 text-sm",
              creatingIntervenant ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
            ].join(" ")}
          >
            {creatingIntervenant ? t("intervenantsTab.creating") : `+ ${t("common.actions.add")}`}
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {intervenantsLoading ? (
          <div className="text-sm text-slate-500">{t("intervenantsTab.loading")}</div>
        ) : intervenants.length === 0 ? (
          <div className="text-sm text-slate-500">{t("intervenantsTab.empty")}</div>
        ) : (
          intervenants.map((i) => {
            const accessUrl = accessUrlByIntervenant[i.id] ?? "";
            return (
              <div key={i.id} className="rounded-xl border p-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{i.nom}</div>
                    <div className="text-xs text-slate-500">
                      {(i.email ?? "—")} • {(i.telephone ?? "—")}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSendAccess(i)}
                      disabled={sendingAccessId === i.id}
                      className={[
                        "text-sm rounded-xl border px-3 py-2",
                        sendingAccessId === i.id ? "bg-slate-100 text-slate-500" : "hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {sendingAccessId === i.id ? t("intervenantsTab.sending") : t("intervenantsTab.sendAccess")}
                    </button>

                    <button
                      type="button"
                      onClick={() => startEditIntervenant(i)}
                      className="text-sm rounded-xl border px-3 py-2 hover:bg-slate-50"
                    >
                      {t("common.actions.edit")}
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteIntervenant(i)}
                      className="text-sm rounded-xl border border-red-200 text-red-700 px-3 py-2 hover:bg-red-50"
                    >
                      {t("common.actions.delete")}
                    </button>
                  </div>
                </div>

                {accessUrl ? (
                  <div className="rounded-xl border bg-slate-50 p-3">
                    <div className="text-xs text-slate-600 mb-2">{t("intervenantsTab.accessLink")}</div>
                    <div className="text-xs font-mono break-all">{accessUrl}</div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        className="text-sm rounded-xl border px-3 py-2 hover:bg-white"
                        onClick={() => copyToClipboard(accessUrl)}
                      >
                        {t("intervenantsTab.copyLink")}
                      </button>
                      <a href={accessUrl} target="_blank" rel="noreferrer">
                        <button type="button" className="text-sm rounded-xl border px-3 py-2 hover:bg-white">
                          {t("common.actions.open")}
                        </button>
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}



