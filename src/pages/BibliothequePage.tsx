import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getChantiers, type ChantierRow } from "../services/chantiers.service";
import { useI18n } from "../i18n";

type BibliothequeDocRow = {
  id: string;
  chantier_id: string;
  title: string;
  file_name: string;
  category: string;
  document_type: string;
  created_at: string;
};

export default function BibliothequePage() {
  const { locale, t } = useI18n();
  const [rows, setRows] = useState<BibliothequeDocRow[]>([]);
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__ALL__");

  const chantierNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const chantier of chantiers) map.set(chantier.id, chantier.nom);
    return map;
  }, [chantiers]);

  const categories = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.category || t("common.documentCategories.other")))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [rows, t]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (categoryFilter !== "__ALL__" && (row.category || "") !== categoryFilter) return false;
      if (!q) return true;
      return (
        (row.title ?? "").toLowerCase().includes(q) ||
        (row.file_name ?? "").toLowerCase().includes(q) ||
        (chantierNameById.get(row.chantier_id) ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, query, categoryFilter, chantierNameById]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [docsRes, chantierRows] = await Promise.all([
        supabase
          .from("chantier_documents")
          .select("id, chantier_id, title, file_name, category, document_type, created_at")
          .order("created_at", { ascending: false })
          .limit(400),
        getChantiers(),
      ]);
      if (docsRes.error) throw docsRes.error;
      setRows((docsRes.data ?? []) as BibliothequeDocRow[]);
      setChantiers(chantierRows);
    } catch (err: any) {
      setError(err?.message ?? t("bibliotheque.loadError"));
      setRows([]);
      setChantiers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("bibliotheque.title")}</h1>
          <p className="text-slate-500">{t("bibliotheque.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
        >
          {t("common.actions.refresh")}
        </button>
      </div>

      <div className="rounded-2xl border bg-white p-4 grid gap-3 md:grid-cols-3">
        <input
          className="rounded-xl border px-3 py-2 text-sm md:col-span-2"
          placeholder={t("bibliotheque.searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="rounded-xl border px-3 py-2 text-sm"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="__ALL__">{t("bibliotheque.allCategories")}</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("bibliotheque.loading")}</div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("bibliotheque.empty")}</div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.title")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("sidebar.chantiers")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.category")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.type")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.date")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{row.title}</div>
                    <div className="text-xs text-slate-500">{row.file_name}</div>
                  </td>
                  <td className="px-4 py-3">{chantierNameById.get(row.chantier_id) ?? row.chantier_id}</td>
                  <td className="px-4 py-3">{row.category || "-"}</td>
                  <td className="px-4 py-3">{row.document_type || "-"}</td>
                  <td className="px-4 py-3">
                    {row.created_at ? new Date(row.created_at).toLocaleDateString(locale) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
