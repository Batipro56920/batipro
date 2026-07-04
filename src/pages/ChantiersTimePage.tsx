import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarDays, Clock3, ClipboardList, RefreshCw, Search, Users } from "lucide-react";

import { listChantiers, type ChantierRow } from "../services/chantiers.service";
import { listChantierTimeEntriesByChantierId, type ChantierTimeEntryRow } from "../services/chantierTimeEntries.service";

type TimeTone = "over" | "missing" | "ok";
type TimePriorityFilter = "all" | TimeTone;

type TimeRow = {
  chantier: ChantierRow;
  entries: ChantierTimeEntryRow[];
  planned: number;
  logged: number;
  delta: number;
  tone: TimeTone;
  searchable: string;
};

const FILTER_LABELS: Record<TimePriorityFilter, string> = {
  all: "Tous les chantiers actifs",
  over: "Chantiers en dépassement",
  missing: "Chantiers sans saisie temps",
  ok: "Chantiers sous contrôle",
};

function formatHours(value: number | null | undefined) {
  const n = Number(value ?? 0);
  return `${Math.round(n * 100) / 100} h`;
}

function getTotal(entries: ChantierTimeEntryRow[]) {
  return entries.reduce((sum, entry) => sum + Number(entry.duration_hours ?? 0), 0);
}

function normalizeSearch(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getTimeTone(params: { planned: number; logged: number; entriesCount: number }) {
  if (params.planned > 0 && params.logged > params.planned) return "over" as const;
  if (params.entriesCount === 0) return "missing" as const;
  return "ok" as const;
}

function TimeFilterCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  tone: "slate" | "red" | "amber" | "green";
  active: boolean;
  onClick: () => void;
}) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-700"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "green"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-950";
  const activeClass = active ? "ring-2 ring-blue-300 ring-offset-2" : "hover:bg-slate-50";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left shadow-sm transition ${toneClass} ${activeClass}`}
      aria-pressed={active}
    >
      <div className="text-xs font-semibold uppercase opacity-75">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </button>
  );
}

export default function ChantiersTimePage() {
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [entriesByChantier, setEntriesByChantier] = useState<Record<string, ChantierTimeEntryRow[]>>({});
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TimePriorityFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allRows = useMemo<TimeRow[]>(() => {
    return chantiers
      .map((chantier) => {
        const entries = entriesByChantier[chantier.id] ?? [];
        const planned = Number(chantier.heures_prevues ?? 0);
        const logged = getTotal(entries);
        const delta = logged - planned;
        const tone = getTimeTone({ planned, logged, entriesCount: entries.length });

        return {
          chantier,
          entries,
          planned,
          logged,
          delta,
          tone,
          searchable: normalizeSearch(`${chantier.nom} ${chantier.client ?? ""} ${chantier.adresse ?? ""}`),
        };
      })
      .sort((a, b) => {
        const weight = { over: 0, missing: 1, ok: 2 } as const;
        const byTone = weight[a.tone] - weight[b.tone];
        if (byTone !== 0) return byTone;
        if (a.tone === "over" || b.tone === "over") return b.delta - a.delta;
        return a.chantier.nom.localeCompare(b.chantier.nom, "fr");
      });
  }, [chantiers, entriesByChantier]);

  const rows = useMemo(() => {
    const search = normalizeSearch(query);
    return allRows.filter((row) => {
      const matchesFilter = activeFilter === "all" || row.tone === activeFilter;
      const matchesSearch = !search || row.searchable.includes(search);
      return matchesFilter && matchesSearch;
    });
  }, [activeFilter, allRows, query]);

  const totals = useMemo(() => {
    const planned = chantiers.reduce((sum, chantier) => sum + Number(chantier.heures_prevues ?? 0), 0);
    const logged = Object.values(entriesByChantier).reduce((sum, entries) => sum + getTotal(entries), 0);
    const missingTime = allRows.filter((row) => row.tone === "missing").length;
    const overBudget = allRows.filter((row) => row.tone === "over").length;
    const underControl = allRows.filter((row) => row.tone === "ok").length;
    return { planned, logged, missingTime, overBudget, underControl };
  }, [allRows, chantiers, entriesByChantier]);

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
              Priorisez les chantiers actifs en dépassement, sans saisie ou à contrôler, puis ouvrez directement le suivi temps, les tâches, le planning ou l'équipe.
            </p>
          </div>
          <button type="button" onClick={() => void refresh()} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            <RefreshCw className="h-4 w-4" /> Actualiser
          </button>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
        <TimeFilterCard
          label="Chantiers actifs"
          value={chantiers.length}
          tone="slate"
          active={activeFilter === "all"}
          onClick={() => setActiveFilter("all")}
        />
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Prévu actif</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatHours(totals.planned)}</div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs font-semibold uppercase text-slate-400">Saisi actif</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{formatHours(totals.logged)}</div>
        </article>
        <TimeFilterCard
          label="Dépassements"
          value={totals.overBudget}
          tone={totals.overBudget > 0 ? "red" : "slate"}
          active={activeFilter === "over"}
          onClick={() => setActiveFilter("over")}
        />
        <TimeFilterCard
          label="Sans saisie"
          value={totals.missingTime}
          tone={totals.missingTime > 0 ? "amber" : "green"}
          active={activeFilter === "missing"}
          onClick={() => setActiveFilter("missing")}
        />
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-sm shadow-emerald-950/[0.02]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-emerald-950">Chantiers sous contrôle</h2>
            <p className="mt-1">{totals.underControl} chantier{totals.underControl > 1 ? "s" : ""} avec temps saisi sans dépassement du prévu.</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveFilter("ok")}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-emerald-200 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
            aria-pressed={activeFilter === "ok"}
          >
            Afficher sous contrôle
          </button>
        </div>
      </section>

      {activeFilter !== "all" ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Filtre actif : <strong>{FILTER_LABELS[activeFilter]}</strong> · {rows.length} chantier{rows.length > 1 ? "s" : ""} affiché{rows.length > 1 ? "s" : ""}.
          </span>
          <button
            type="button"
            onClick={() => setActiveFilter("all")}
            className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100"
          >
            Réinitialiser
          </button>
        </div>
      ) : null}

      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div> : null}

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Chantiers actifs</h2>
            <p className="text-sm text-slate-500">Les écarts et chantiers sans saisie remontent en premier pour accélérer le contrôle conducteur.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-500 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 sm:w-72">
              <Search className="h-4 w-4 shrink-0" />
              <input
                className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
                placeholder="Rechercher chantier, client..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <span className="text-xs font-semibold uppercase text-slate-400">{rows.length} / {allRows.length} chantier{allRows.length > 1 ? "s" : ""}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 lg:col-span-2">Chargement des temps...</div>
          ) : chantiers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 lg:col-span-2">Aucun chantier actif à suivre.</div>
          ) : rows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500 lg:col-span-2">Aucun chantier ne correspond à ce filtre ou cette recherche.</div>
          ) : rows.map(({ chantier, entries, planned, logged, delta, tone }) => {
            const isOver = tone === "over";
            const isMissing = tone === "missing";
            const statusLabel = isOver ? `Dépassement ${formatHours(delta)}` : isMissing ? "Aucune saisie temps" : "Temps sous contrôle";
            const statusClass = isOver
              ? "border-red-200 bg-red-50 text-red-700"
              : isMissing
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700";

            return (
              <article key={chantier.id} className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:border-blue-200 ${isOver ? "border-red-200" : "border-slate-200"}`}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate font-semibold text-slate-950">{chantier.nom}</div>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${statusClass}`}>
                        {isOver ? <AlertTriangle className="h-3 w-3" /> : null}
                        {statusLabel}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-sm text-slate-500">{chantier.client ?? "Client non renseigné"}</div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">Prévu {formatHours(planned)}</span>
                      <span className={`rounded-full border px-3 py-1 ${isOver ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>Saisi {formatHours(logged)}</span>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-blue-700">{entries.length} saisie{entries.length > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <Link to={`/chantiers/${encodeURIComponent(chantier.id)}/temps`} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800">
                    <Clock3 className="h-4 w-4" /> Suivre <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                  <Link to={`/chantiers/${encodeURIComponent(chantier.id)}/execution`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <ClipboardList className="h-4 w-4" /> Tâches
                  </Link>
                  <Link to={`/chantiers/${encodeURIComponent(chantier.id)}/planning`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <CalendarDays className="h-4 w-4" /> Planning
                  </Link>
                  <Link to={`/chantiers/${encodeURIComponent(chantier.id)}/equipe`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <Users className="h-4 w-4" /> Équipe
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
