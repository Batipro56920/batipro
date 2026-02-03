import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getChantiers, deleteChantier } from "../services/chantiers.service";

type ChantierStatus = "PREPARATION" | "EN_COURS" | "TERMINE" | string;

type ChantierRow = {
  id: string;
  nom: string;
  client: string | null;
  adresse: string | null;
  status: ChantierStatus | null;
  created_at?: string | null;
};

function statusLabel(status: ChantierStatus) {
  switch (status) {
    case "PREPARATION":
      return "Préparation";
    case "EN_COURS":
      return "En cours";
    case "TERMINE":
      return "Terminé";
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

  const [items, setItems] = useState<ChantierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getChantiers();
      setItems(data as ChantierRow[]);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Erreur lors du chargement des chantiers.");
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
          <h1 className="text-2xl font-bold">Chantiers</h1>
          <p className="text-slate-500">Liste et suivi</p>
        </div>

        <button
          className="rounded-xl bg-slate-900 text-white px-4 py-2 hover:bg-slate-800 transition"
          onClick={() => navigate("/chantiers/nouveau")}
        >
          + Nouveau chantier
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
          <div className="font-semibold">Chargement…</div>
          <div className="text-slate-500 text-sm mt-1">
            Récupération des chantiers depuis la base.
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="font-semibold">Aucun chantier</div>
          <div className="text-slate-500 text-sm mt-1">
            Clique sur “Nouveau chantier” pour démarrer.
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((c) => {
            const status: ChantierStatus = c.status ?? "PREPARATION";
            const avancement = 0;

            return (
              <div
                key={c.id}
                className="rounded-2xl border bg-white p-4 flex items-center justify-between gap-4"
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
                      {statusLabel(status)}
                    </span>
                  </div>

                  <div className="text-sm text-slate-500 mt-1 truncate">
                    {c.client ?? "—"} • {c.adresse ?? "—"}
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Avancement</span>
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

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    to={`/chantiers/${c.id}`}
                    className="rounded-xl border px-3 py-2 hover:bg-slate-50 transition"
                  >
                    Ouvrir
                  </Link>

                  <button
                    className="rounded-xl border px-3 py-2 hover:bg-slate-50 transition"
                    onClick={async () => {
                      if (!window.confirm(`Supprimer "${c.nom}" ?`)) return;
                      await deleteChantier(c.id);
                      await refresh();
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && (
        <div className="text-xs text-slate-400">
          <button className="underline hover:text-slate-600" onClick={refresh}>
            Rafraîchir la liste
          </button>
        </div>
      )}
    </div>
  );
}
