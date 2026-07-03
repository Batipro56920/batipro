import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3, RefreshCw } from "lucide-react";

import { listChantiers, type ChantierRow } from "../services/chantiers.service";
import { listChantierTimeEntriesByChantierId, type ChantierTimeEntryRow } from "../services/chantierTimeEntries.service";

function formatHours(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return `${Math.round(n * 100) / 100} h`;
}

function getTotal(entries: ChantierTimeEntryRow[]) {
  return entries.reduce((sum, entry) => sum + Number(entry.duration_hours ?? 0), 0);
}

export default function ChantiersTimePage() {
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [entriesByChantier, setEntriesByChantier] = useState<Record<string, ChantierTimeEntryRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const planned = chantiers.reduce((sum, chantier) => sum + Number(chantier.heures_prevues ?? 0), 0);
    const logged = Object.values(entriesByChantier).reduce((sum, entries) => sum + getTotal(entries), 0);
    const missingRecentTime = chantiers.filter((chantier) => (entriesByChantier[chantier.id] ?? []).length === 0).length;
    return { planned, logged, missingRecentTime };
  }, [chantiers, entriesByChantier]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const rows = await listChantiers({ scope: "actifs" });
      const pairs = await Promise.all(
        rows.map(async (chantier) => {
          try {
            return [chantier.id, await listChantierTimeEntriesByChantierId(chantier.id)] as const;
          } catch {
            return [chantier.id, [] as ChantierTimeEntryRow[]] as const;
          }
        }),
      );
      setChantiers(rows);
      setEntriesByChantier(Object.fromEntries(pairs));
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger le suivi des temps.");
      setChantiers([]);
      setEntriesByChantier({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Pilotage</div>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Suivi des temps chantier</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Vue globale des heures prévues et saisies, reliée aux dossiers chantier, tâches et intervenants.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Prévu actif</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatHours(totals.planned)}</div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Saisi actif</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatHours(totals.logged)}</div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Sans saisie</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{totals.missingRecentTime}</div>
        </article>
      </section>

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Chantiers actifs</h2>
            <p className="text-sm text-slate-500">Ouvrez un chantier pour saisir ou contrôler les temps liés aux tâches.</p>
          </div>
          <span className="text-xs font-semibold uppercase text-slate-400">{chantiers.length} chantier{chantiers.length > 1 ? "s" : ""}</span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 lg:col-span-2">Chargement des temps...</div>
          ) : chantiers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 lg:col-span-2">Aucun chantier actif à suivre.</div>
          ) : chantiers.map((chantier) => {
            const entries = entriesByChantier[chantier.id] ?? [];
            const logged = getTotal(entries);
            const planned = Number(chantier.heures_prevues ?? 0);
            const isOver = planned > 0 && logged > planned;
            return (
              <article key={chantier.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-slate-950">{chantier.nom}</div>
                    <div className="mt-1 truncate text-sm text-slate-500">{chantier.client ?? "Client non renseigné"}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">Prévu {formatHours(planned)}</span>
                      <span className={`rounded-full border px-3 py-1 ${isOver ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>Saisi {formatHours(logged)}</span>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">{entries.length} saisie{entries.length > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <Link to={`/chantiers/${encodeURIComponent(chantier.id)}/temps`} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                    <Clock3 className="h-4 w-4" /> Suivre <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
