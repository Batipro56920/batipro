import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import type { ChantierStatus } from "../types/chantier";
import {
  bulkUpdateChantiersStatus,
  countChantiers,
  deleteChantier,
  listChantiers,
  updateChantierStatus,
  type ChantierScope,
  type ChantierRow,
} from "../services/chantiers.service";
import { chantierStatusBadge } from "../lib/chantierRules";
import { useI18n } from "../i18n";

type ChantierFilter = Exclude<ChantierScope, "en_cours">;

const FILTERS: Array<{ key: ChantierFilter; label: string }> = [
  { key: "actifs", label: "Actifs" },
  { key: "termines", label: "Terminés" },
  { key: "archives", label: "Archivés" },
  { key: "annules", label: "Annulés" },
  { key: "all", label: "Tous" },
];

function statusMeta(status: ChantierStatus) {
  return chantierStatusBadge(status);
}

export default function ChantiersPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

  const [items, setItems] = useState<ChantierRow[]>([]);
  const [filter, setFilter] = useState<ChantierFilter>("actifs");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [debugCount, setDebugCount] = useState<number | null>(null);

  const selectedRows = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  );

  async function refresh(nextFilter = filter) {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await listChantiers({ scope: nextFilter });
      setItems(data);
      setSelectedIds((current) => current.filter((id) => data.some((item) => item.id === id)));
      if (import.meta.env.DEV) {
        const count = await countChantiers({ scope: nextFilter });
        setDebugCount(count);
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? t("chantiers.loadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(filter);
  }, [filter]);

  function toggleSelection(id: string) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  async function runBulkStatus(status: ChantierStatus) {
    if (selectedIds.length === 0) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await bulkUpdateChantiersStatus(selectedIds, status);
      setSelectedIds([]);
      await refresh();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Action impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedDrafts() {
    const draftIds = selectedRows.filter((row) => row.status === "BROUILLON").map((row) => row.id);
    if (draftIds.length === 0) return;
    if (!window.confirm(`Supprimer ${draftIds.length} brouillon(s) ? Cette action sera enregistrée en suppression logique.`)) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await Promise.all(draftIds.map((id) => deleteChantier(id)));
      setSelectedIds([]);
      await refresh();
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Suppression impossible.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("chantiers.title")}</h1>
          <p className="text-slate-500">{t("chantiers.subtitle")}</p>
        </div>

        <button
          className="rounded-xl bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-800"
          onClick={() => navigate("/chantiers/nouveau")}
        >
          + {t("chantiers.new")}
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-3">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((entry) => (
            <button
              key={entry.key}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition",
                filter === entry.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 hover:bg-slate-50",
              ].join(" ")}
              onClick={() => setFilter(entry.key)}
            >
              {entry.label}
            </button>
          ))}
          <button className="ml-auto rounded-full border px-3 py-1.5 text-sm hover:bg-slate-50" onClick={() => refresh()}>
            {t("chantiers.refresh")}
          </button>
        </div>

        {selectedIds.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <span className="font-medium">{selectedIds.length} sélectionné(s)</span>
            <button
              className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-100 disabled:opacity-50"
              disabled={saving}
              onClick={() => runBulkStatus("TERMINE")}
            >
              Marquer terminés
            </button>
            <button
              className="rounded-lg border bg-white px-3 py-1.5 hover:bg-slate-100 disabled:opacity-50"
              disabled={saving}
              onClick={() => runBulkStatus("ARCHIVE")}
            >
              Archiver
            </button>
            <button
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-red-700 hover:bg-red-50 disabled:opacity-50"
              disabled={saving || selectedRows.every((row) => row.status !== "BROUILLON")}
              onClick={deleteSelectedDrafts}
            >
              Supprimer brouillons
            </button>
          </div>
        )}
      </div>

      {errorMsg && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMsg}</div>}

      {loading ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="font-semibold">{t("chantiers.loadingTitle")}</div>
          <div className="mt-1 text-sm text-slate-500">{t("chantiers.loadingMessage")}</div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="font-semibold">{t("chantiers.emptyTitle")}</div>
          <div className="mt-1 text-sm text-slate-500">{t("chantiers.emptyMessage")}</div>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((c) => {
            const status: ChantierStatus = c.status ?? "PREPARATION";
            const badge = statusMeta(status);
            const avancement = Number(c.avancement ?? 0);

            return (
              <div
                key={c.id}
                className="flex flex-col gap-3 overflow-hidden rounded-2xl border bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                    checked={selectedIds.includes(c.id)}
                    onChange={() => toggleSelection(c.id)}
                    aria-label={`Sélectionner ${c.nom}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-semibold">{c.nom}</div>
                      <span className={["rounded-full border px-2 py-1 text-xs", badge.className].join(" ")}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="mt-1 truncate text-sm text-slate-500">
                      {c.client ?? "—"} • {c.adresse ?? "—"}
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{t("chantiers.progress")}</span>
                        <span className="font-medium text-slate-700">{avancement}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full bg-slate-900" style={{ width: `${Math.min(100, Math.max(0, avancement))}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
                  {status !== "TERMINE" && (
                    <button
                      className="rounded-xl border px-3 py-2 text-sm transition hover:bg-slate-50"
                      onClick={async () => {
                        await updateChantierStatus(c.id, "TERMINE");
                        await refresh();
                      }}
                    >
                      Terminer
                    </button>
                  )}
                  {status !== "ARCHIVE" && (
                    <button
                      className="rounded-xl border px-3 py-2 text-sm transition hover:bg-slate-50"
                      onClick={async () => {
                        await updateChantierStatus(c.id, "ARCHIVE");
                        await refresh();
                      }}
                    >
                      Archiver
                    </button>
                  )}
                  {(status === "TERMINE" || status === "ARCHIVE" || status === "ANNULE") && (
                    <button
                      className="rounded-xl border px-3 py-2 text-sm transition hover:bg-slate-50"
                      onClick={async () => {
                        await updateChantierStatus(c.id, "EN_COURS");
                        await refresh();
                      }}
                    >
                      Restaurer
                    </button>
                  )}
                  <Link to={`/chantiers/${c.id}`} className="rounded-xl border px-3 py-2 transition hover:bg-slate-50">
                    {t("chantiers.open")}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && import.meta.env.DEV && debugCount !== null && (
        <div className="text-xs text-slate-400">
          DEBUG: count={debugCount} list={items.length}
        </div>
      )}
    </div>
  );
}
