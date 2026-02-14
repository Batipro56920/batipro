import { useEffect, useMemo, useState } from "react";
import TaskTemplateDrawer from "../components/TaskTemplateDrawer";
import Toast, { type ToastState } from "../components/chantiers/Toast";
import {
  create,
  duplicate,
  list,
  remove,
  update,
  type TaskTemplateInput,
  type TaskTemplateRow,
} from "../services/taskTemplates.service";

export default function BibliothequeTasksPage() {
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
      setError(err?.message ?? "Erreur chargement templates.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
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
      if (!activeTemplate) {
        const created = await create(payload);
        setRows((prev) => [created, ...prev]);
        setToast({ type: "ok", msg: "Template créé." });
      } else {
        const updated = await update(activeTemplate.id, payload);
        setRows((prev) => prev.map((row) => (row.id === activeTemplate.id ? updated : row)));
        setToast({ type: "ok", msg: "Template mis à jour." });
      }
      closeDrawer();
    } catch (err: any) {
      setDrawerError(err?.message ?? "Erreur enregistrement template.");
      setToast({ type: "error", msg: err?.message ?? "Erreur enregistrement template." });
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
      setToast({ type: "ok", msg: "Template supprimé." });
      closeDrawer();
    } catch (err: any) {
      setDrawerError(err?.message ?? "Erreur suppression template.");
      setToast({ type: "error", msg: err?.message ?? "Erreur suppression template." });
    } finally {
      setDeleting(false);
    }
  }

  async function onDuplicate(templateId: string) {
    setDuplicateId(templateId);
    try {
      const duplicated = await duplicate(templateId);
      setRows((prev) => [duplicated, ...prev]);
      setToast({ type: "ok", msg: "Template dupliqué." });
    } catch (err: any) {
      setToast({ type: "error", msg: err?.message ?? "Erreur duplication template." });
    } finally {
      setDuplicateId(null);
    }
  }

  async function onDeleteRow(template: TaskTemplateRow) {
    const ok = window.confirm(`Supprimer le template "${template.titre}" ?`);
    if (!ok) return;
    setDeleteId(template.id);
    try {
      await remove(template.id);
      setRows((prev) => prev.filter((row) => row.id !== template.id));
      setToast({ type: "ok", msg: "Template supprimé." });
    } catch (err: any) {
      setToast({ type: "error", msg: err?.message ?? "Erreur suppression template." });
    } finally {
      setDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bibliothèque</h1>
          <p className="text-slate-500">Templates de tâches</p>
        </div>
        <button
          type="button"
          onClick={openCreateDrawer}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
        >
          + Nouveau template
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <input
          className="w-full rounded-xl border px-3 py-2 text-sm"
          placeholder="Rechercher (titre ou lot)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Chargement...</div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Aucun template.</div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Titre</th>
                <th className="px-4 py-3 text-left font-medium">Lot</th>
                <th className="px-4 py-3 text-left font-medium">Unité</th>
                <th className="px-4 py-3 text-left font-medium">Qté défaut</th>
                <th className="px-4 py-3 text-left font-medium">Temps/unité (h)</th>
                <th className="px-4 py-3 text-left font-medium">Modifié le</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.titre}</div>
                    {row.remarques ? <div className="text-xs text-slate-500 truncate">{row.remarques}</div> : null}
                  </td>
                  <td className="px-4 py-3">{row.lot ?? "-"}</td>
                  <td className="px-4 py-3">{row.unite ?? "-"}</td>
                  <td className="px-4 py-3">{row.quantite_defaut ?? "-"}</td>
                  <td className="px-4 py-3">{row.temps_prevu_par_unite_h ?? "-"}</td>
                  <td className="px-4 py-3">
                    {row.updated_at ? new Date(row.updated_at).toLocaleDateString("fr-FR") : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditDrawer(row)}
                        className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        disabled={duplicateId === row.id}
                        onClick={() => onDuplicate(row.id)}
                        className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                      >
                        {duplicateId === row.id ? "Duplication..." : "Dupliquer"}
                      </button>
                      <button
                        type="button"
                        disabled={deleteId === row.id}
                        onClick={() => onDeleteRow(row)}
                        className="rounded-lg border border-red-200 text-red-700 px-2 py-1 text-xs hover:bg-red-50 disabled:opacity-50"
                      >
                        {deleteId === row.id ? "Suppression..." : "Supprimer"}
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
        onClose={closeDrawer}
        onSave={onSaveDrawer}
        onDelete={onDeleteDrawer}
      />

      <Toast toast={toast} />
    </div>
  );
}
