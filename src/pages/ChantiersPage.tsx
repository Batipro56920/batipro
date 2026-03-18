import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import type { ChantierStatus } from "../types/chantier";
import { getChantiers, deleteChantier, countChantiers } from "../services/chantiers.service";
import { useI18n } from "../i18n";

type ChantierRow = {
  id: string;
  nom: string;
  client: string | null;
  adresse: string | null;
  status: ChantierStatus | null;
  created_at?: string | null;
};

function statusLabel(status: ChantierStatus, t: (key: string) => string) {
  switch (status) {
    case "PREPARATION":
      return t("common.chantierStatus.PREPARATION");
    case "EN_COURS":
      return t("common.chantierStatus.EN_COURS");
    case "TERMINE":
      return t("common.chantierStatus.TERMINE");
    default:
      return status || "—";
  }
}

function statusClasses(status: ChantierStatus) {
  switch (status) {
    case "PREPARATION":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "EN_COURS":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "TERMINE":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
}

export default function ChantiersPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [items, setItems] = useState<ChantierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [debugCount, setDebugCount] = useState<number | null>(null);

  async function refresh() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getChantiers();
      setItems(data as ChantierRow[]);
      if (import.meta.env.DEV) {
        const count = await countChantiers({ scope: "all" });
        setDebugCount(count);
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? t("chantiers.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("chantiers.title")}</h1>
          <p className="text-slate-500">{t("chantiers.subtitle")}</p>
        </div>

        <button
          className="rounded-xl bg-slate-900 text-white px-4 py-2 hover:bg-slate-800 transition"
          onClick={() => navigate("/chantiers/nouveau")}
        >
          + {t("chantiers.new")}
        </button>
      </div>

      {/* Errors */}
      {errorMsg && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Loading / Empty / List */}
      {loading ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="font-semibold">{t("chantiers.loadingTitle")}</div>
          <div className="text-slate-500 text-sm mt-1">{t("chantiers.loadingMessage")}</div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="font-semibold">{t("chantiers.emptyTitle")}</div>
          <div className="text-slate-500 text-sm mt-1">{t("chantiers.emptyMessage")}</div>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((c) => {
            const status: ChantierStatus = c.status ?? "PREPARATION";
            const avancement = 0;

            return (
              <div
                key={c.id}
                className="rounded-2xl border bg-white p-4 flex flex-col gap-3 overflow-hidden sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold truncate">{c.nom}</div>
                    <span
                      className={[
                        "text-xs px-2 py-1 rounded-full border",
                        statusClasses(status),
                      ].join(" ")}
                    >
                      {statusLabel(status, t)}
                    </span>
                  </div>

                  <div className="text-sm text-slate-500 mt-1 truncate">
                    {c.client ?? "—"} • {c.adresse ?? "—"}
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{t("chantiers.progress")}</span>
                      <span className="font-medium text-slate-700">
                        {avancement}%
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 mt-1 overflow-hidden">
                      <div
                        className="h-full bg-slate-900"
                        style={{
                          width: `${Math.min(100, Math.max(0, avancement))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">
                  <Link
                    to={`/chantiers/${c.id}`}
                    className="rounded-xl border px-3 py-2 hover:bg-slate-50 transition whitespace-nowrap"
                  >
                    {t("chantiers.open")}
                  </Link>

                  <button
                    className="rounded-xl border px-3 py-2 hover:bg-slate-50 transition whitespace-nowrap"
                    onClick={async () => {
                      if (!window.confirm(t("chantiers.deleteConfirm", { name: c.nom }))) return;
                      await deleteChantier(c.id);
                      await refresh();
                    }}
                  >
                    {t("common.actions.delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-3">
          <button className="underline hover:text-slate-600" onClick={refresh}>
            {t("chantiers.refresh")}
          </button>
          {import.meta.env.DEV && debugCount !== null && (
            <span>DEBUG: count={debugCount} list={items.length}</span>
          )}
        </div>
      )}
    </div>
  );
}



