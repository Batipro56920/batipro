import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { getChantiers, type ChantierRow } from "../services/chantiers.service";

type IntervenantListRow = {
  id: string;
  chantier_id: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  created_at: string | null;
};

export default function IntervenantsPage() {
  const [rows, setRows] = useState<IntervenantListRow[]>([]);
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
      const [intervenantsRes, chantierRows] = await Promise.all([
        supabase
          .from("intervenants")
          .select("id, chantier_id, nom, email, telephone, created_at")
          .order("created_at", { ascending: false }),
        getChantiers(),
      ]);

      if (intervenantsRes.error) throw intervenantsRes.error;
      setRows((intervenantsRes.data ?? []) as IntervenantListRow[]);
      setChantiers(chantierRows);
    } catch (err: any) {
      setError(err?.message ?? "Erreur chargement intervenants.");
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
          <h1 className="text-2xl font-bold">Intervenants</h1>
          <p className="text-slate-500">Vue globale des intervenants sur tous les chantiers.</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
        >
          Rafraichir
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Chargement...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Aucun intervenant.</div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nom</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Telephone</th>
                <th className="px-4 py-3 text-left font-medium">Chantier</th>
                <th className="px-4 py-3 text-left font-medium">Ajoute le</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{row.nom}</td>
                  <td className="px-4 py-3">{row.email ?? "-"}</td>
                  <td className="px-4 py-3">{row.telephone ?? "-"}</td>
                  <td className="px-4 py-3">{chantierNameById.get(row.chantier_id) ?? row.chantier_id}</td>
                  <td className="px-4 py-3">
                    {row.created_at ? new Date(row.created_at).toLocaleDateString("fr-FR") : "-"}
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
