import { useEffect, useMemo, useState } from "react";
import TaskTemplateDrawer from "../components/TaskTemplateDrawer";
import Toast, { type ToastState } from "../components/chantiers/Toast";
import {
  getCurrentProfileFeaturePermissions,
  hasProfileFeaturePermission,
} from "../services/profileFeaturePermissions.service";
import {
  create,
  duplicate,
  list,
  remove,
  update,
  type TaskTemplateInput,
  type TaskTemplateRow,
} from "../services/taskLibrary.service";
import { replaceTaskTemplatePreparation } from "../services/taskTemplatePreparation.service";
import { useI18n } from "../i18n";

export default function BibliothequeTasksPage() {
  const { locale, t } = useI18n();
  const [rows, setRows] = useState<TaskTemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<TaskTemplateRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [advancedPreparationEnabled, setAdvancedPreparationEnabled] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      return (row.titre ?? "").toLowerCase().includes(q) || (row.lot ?? "").toLowerCase().includes(q);
    });
  }, [rows, query]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const data = await list();
      setRows(data);
    } catch (err: any) {
      setError(err?.message ?? t("bibliothequeTasks.loadError"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadPermissions() {
      try {
        const result = await getCurrentProfileFeaturePermissions();
        if (!alive) return;
        setAdvancedPreparationEnabled(
          hasProfileFeaturePermission(result.permissions, "task_library_preparation"),
        );
      } catch {
        if (!alive) return;
        setAdvancedPreparationEnabled(false);
      }
    }

    void loadPermissions();

    return () => {
      alive = false;
    };
  }, []);

  function openCreateDrawer() {
    setActiveTemplate(null);
    setDrawerError(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(template: TaskTemplateRow) {
    setActiveTemplate(template);
    setDrawerError(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (saving || deleting) return;
    setDrawerOpen(false);
    setActiveTemplate(null);
    setDrawerError(null);
  }

  async function onSaveDrawer(payload: TaskTemplateInput) {
    setSaving(true);
    setDrawerError(null);
    try {
      const { preparation_materials = [], preparation_equipment = [], ...basePayload } = payload;

      if (!activeTemplate) {
        const created = await create(basePayload);
        if (advancedPreparationEnabled) {
          await replaceTaskTemplatePreparation(created.id, {
            materials: preparation_materials,
            equipment: preparation_equipment,
          });
        }
        setRows((prev) => [created, ...prev]);
        setToast({ type: "ok", msg: t("bibliothequeTasks.created") });
      } else {
        const updated = await update(activeTemplate.id, basePayload);
        if (advancedPreparationEnabled) {
          await replaceTaskTemplatePreparation(updated.id, {
            materials: preparation_materials,
            equipment: preparation_equipment,
          });
        }
        setRows((prev) => prev.map((row) => (row.id === activeTemplate.id ? updated : row)));
        setToast({ type: "ok", msg: t("bibliothequeTasks.updated") });
      }
      closeDrawer();
    } catch (err: any) {
      setDrawerError(err?.message ?? t("bibliothequeTasks.saveError"));
      setToast({ type: "error", msg: err?.message ?? t("bibliothequeTasks.saveError") });
    } finally {
      setSaving(false);
    }
  }

  async function onDeleteDrawer(id: string) {
    setDeleting(true);
    setDrawerError(null);
    try {
      await remove(id);
      setRows((prev) => prev.filter((row) => row.id !== id));
      setToast({ type: "ok", msg: t("bibliothequeTasks.deleted") });
      closeDrawer();
    } catch (err: any) {
      setDrawerError(err?.message ?? t("bibliothequeTasks.deleteError"));
      setToast({ type: "error", msg: err?.message ?? t("bibliothequeTasks.deleteError") });
    } finally {
      setDeleting(false);
    }
  }

  async function onDuplicate(templateId: string) {
    setDuplicateId(templateId);
    try {
      const duplicated = await duplicate(templateId);
      setRows((prev) => [duplicated, ...prev]);
      setToast({ type: "ok", msg: t("bibliothequeTasks.duplicated") });
    } catch (err: any) {
      setToast({ type: "error", msg: err?.message ?? t("bibliothequeTasks.duplicateError") });
    } finally {
      setDuplicateId(null);
    }
  }

  async function onDeleteRow(template: TaskTemplateRow) {
    const ok = window.confirm(t("bibliothequeTasks.deleteConfirm", { name: template.titre }));
    if (!ok) return;
    setDeleteId(template.id);
    try {
      await remove(template.id);
      setRows((prev) => prev.filter((row) => row.id !== template.id));
      setToast({ type: "ok", msg: t("bibliothequeTasks.deleted") });
    } catch (err: any) {
      setToast({ type: "error", msg: err?.message ?? t("bibliothequeTasks.deleteError") });
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("bibliothequeTasks.title")}</h1>
          <p className="text-slate-500">{t("bibliothequeTasks.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={openCreateDrawer}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
        >
          + {t("bibliothequeTasks.new")}
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <input
          className="w-full rounded-xl border px-3 py-2 text-sm"
          placeholder={t("bibliothequeTasks.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("common.states.loading")}</div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("bibliothequeTasks.empty")}</div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("bibliothequeTasks.headers.title")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("bibliothequeTasks.headers.lot")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("bibliothequeTasks.headers.unit")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("bibliothequeTasks.headers.defaultQuantity")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("bibliothequeTasks.headers.timePerUnit")}</th>
                <th className="px-4 py-3 text-left font-medium">Coût ref.</th>
                <th className="px-4 py-3 text-left font-medium">{t("bibliothequeTasks.headers.updatedAt")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.actions.edit")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.titre}</div>
                    {row.description_technique ? (
                      <div className="text-xs text-slate-500 line-clamp-2">{row.description_technique}</div>
                    ) : null}
                    {row.caracteristiques.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.caracteristiques.slice(0, 3).map((item) => (
                          <span
                            key={`${row.id}-${item}`}
                            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {row.remarques ? <div className="text-xs text-slate-500 truncate">{row.remarques}</div> : null}
                  </td>
                  <td className="px-4 py-3">{row.lot ?? "-"}</td>
                  <td className="px-4 py-3">{row.unite ?? "-"}</td>
                  <td className="px-4 py-3">{row.quantite_defaut ?? "-"}</td>
                  <td className="px-4 py-3">{row.temps_prevu_par_unite_h ?? "-"}</td>
                  <td className="px-4 py-3">
                    {row.cout_reference_unitaire_ht !== null
                      ? `${Math.round(Number(row.cout_reference_unitaire_ht) * 100) / 100} €`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    {row.updated_at ? new Date(row.updated_at).toLocaleDateString(locale) : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditDrawer(row)}
                        className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        {t("common.actions.edit")}
                      </button>
                      <button
                        type="button"
                        disabled={duplicateId === row.id}
                        onClick={() => onDuplicate(row.id)}
                        className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                      >
                        {duplicateId === row.id ? "Duplication..." : t("common.actions.duplicate")}
                      </button>
                      <button
                        type="button"
                        disabled={deleteId === row.id}
                        onClick={() => onDeleteRow(row)}
                        className="rounded-lg border border-red-200 text-red-700 px-2 py-1 text-xs hover:bg-red-50 disabled:opacity-50"
                      >
                        {deleteId === row.id ? t("common.states.deleting") : t("common.actions.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TaskTemplateDrawer
        open={drawerOpen}
        template={activeTemplate}
        saving={saving}
        deleting={deleting}
        error={drawerError}
        advancedPreparationEnabled={advancedPreparationEnabled}
        onClose={closeDrawer}
        onSave={onSaveDrawer}
        onDelete={onDeleteDrawer}
      />

      <Toast toast={toast} />
    </div>
  );
}
