import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getChantiers, type ChantierRow } from "../services/chantiers.service";
import { listIntervenants, type IntervenantRow } from "../services/intervenants.service";
import { useI18n } from "../i18n";

type IntervenantLinkRow = {
  intervenant_id: string;
  chantier_id: string;
};

export default function IntervenantsPage() {
  const { locale, t } = useI18n();
  const [rows, setRows] = useState<Array<IntervenantRow & { chantier_ids: string[] }>>([]);
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const chantierNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const chantier of chantiers) map.set(chantier.id, chantier.nom);
    return map;
  }, [chantiers]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [intervenantsRows, chantierRows, chantierLinksRes, intervenantLinksRes] = await Promise.all([
        listIntervenants(),
        getChantiers(),
        (supabase as any).from("chantier_intervenants").select("intervenant_id, chantier_id"),
        (supabase as any).from("intervenant_chantiers").select("intervenant_id, chantier_id"),
      ]);

      if (chantierLinksRes.error) throw chantierLinksRes.error;
      if (intervenantLinksRes.error) throw intervenantLinksRes.error;

      const chantierIdsByIntervenant = new Map<string, Set<string>>();
      const appendLink = (row: IntervenantLinkRow) => {
        if (!row?.intervenant_id || !row?.chantier_id) return;
        if (!chantierIdsByIntervenant.has(row.intervenant_id)) {
          chantierIdsByIntervenant.set(row.intervenant_id, new Set<string>());
        }
        chantierIdsByIntervenant.get(row.intervenant_id)?.add(row.chantier_id);
      };

      for (const row of (chantierLinksRes.data ?? []) as IntervenantLinkRow[]) appendLink(row);
      for (const row of (intervenantLinksRes.data ?? []) as IntervenantLinkRow[]) appendLink(row);
      for (const row of intervenantsRows) {
        if (row.chantier_id) appendLink({ intervenant_id: row.id, chantier_id: row.chantier_id });
      }

      setRows(
        intervenantsRows.map((row) => ({
          ...row,
          chantier_ids: Array.from(chantierIdsByIntervenant.get(row.id) ?? []),
        })),
      );
      setChantiers(chantierRows);
    } catch (err: any) {
      setError(err?.message ?? t("intervenantsPage.loadError"));
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
          <h1 className="text-2xl font-bold">{t("intervenantsPage.title")}</h1>
          <p className="text-slate-500">{t("intervenantsPage.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
        >
          {t("common.actions.refresh")}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("intervenantsPage.loading")}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("intervenantsPage.empty")}</div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.name")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.email")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.phone")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("sidebar.chantiers")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.date")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{row.nom}</td>
                  <td className="px-4 py-3">{row.email ?? "-"}</td>
                  <td className="px-4 py-3">{row.telephone ?? "-"}</td>
                  <td className="px-4 py-3">
                    {row.chantier_ids.length === 0
                      ? "-"
                      : row.chantier_ids
                          .map((chantierId) => chantierNameById.get(chantierId) ?? chantierId)
                          .join(", ")}
                  </td>
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
