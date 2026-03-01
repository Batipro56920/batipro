import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { CHANTIER_EN_COURS_STATUSES } from "../lib/chantierRules";
import { listChantiers, type ChantierRow } from "../services/chantiers.service";

type DashboardView = "chantiers" | "avancement" | "heures" | "materiel" | null;

type TaskSnapshot = {
  id: string;
  chantier_id: string;
  titre: string;
  status: string | null;
  date_fin: string | null;
  temps_prevu_h: number | null;
  temps_reel_h: number | null;
  updated_at: string | null;
  created_at: string | null;
};

type ReserveSnapshot = {
  id: string;
  chantier_id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
};

type MaterielSnapshot = {
  id: string;
  chantier_id: string;
  titre: string | null;
  designation: string | null;
  statut: string | null;
  status: string | null;
  quantite: number | null;
  unite: string | null;
  created_at: string | null;
};

type TimeSnapshot = {
  id: string;
  chantier_id: string;
  task_id: string | null;
  duration_hours: number | null;
  quantite_realisee: number | null;
  work_date: string | null;
  created_at: string | null;
};

type RecentEvent = {
  id: string;
  kind: "time" | "materiel" | "reserve";
  chantierId: string;
  title: string;
  meta: string;
  createdAt: string | null;
};

function parseDateValue(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatDateTimeFr(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("fr-FR");
}

function formatHours(value: number): string {
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} h`;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function isMissingRelationError(message: string | undefined): boolean {
  const msg = String(message ?? "").toLowerCase();
  return msg.includes("does not exist") || msg.includes("relation") || msg.includes("schema cache");
}

function normalizeMaterialStatus(row: Pick<MaterielSnapshot, "statut" | "status">): string {
  const value = String(row.statut ?? row.status ?? "").trim().toLowerCase();
  if (value === "validee") return "validee";
  if (value === "refusee") return "refusee";
  if (value === "livree") return "livree";
  return "en_attente";
}

function materialStatusLabel(value: string): string {
  if (value === "validee") return "Validee";
  if (value === "refusee") return "Refusee";
  if (value === "livree") return "Livree";
  return "En attente";
}

function statusToneClass(tone: "normal" | "warning" | "danger") {
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-900";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-white text-slate-900";
}

function cardToneClass(tone: "normal" | "warning" | "danger", active: boolean) {
  const base = statusToneClass(tone);
  return active ? `${base} ring-2 ring-blue-500` : `${base} hover:border-blue-200 hover:bg-blue-50/40`;
}

export default function DashboardPage() {
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [tasks, setTasks] = useState<TaskSnapshot[]>([]);
  const [reserves, setReserves] = useState<ReserveSnapshot[]>([]);
  const [materiel, setMateriel] = useState<MaterielSnapshot[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeSnapshot[]>([]);
  const [activeView, setActiveView] = useState<DashboardView>("chantiers");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const [chantiersResult, tasksResult, reservesResult, materielResult, timeResult] = await Promise.all([
          listChantiers({ scope: "all" }),
          supabase
            .from("chantier_tasks")
            .select("id, chantier_id, titre, status, date_fin, temps_prevu_h, temps_reel_h, updated_at, created_at")
            .order("updated_at", { ascending: false }),
          supabase
            .from("chantier_reserves")
            .select("id, chantier_id, title, status, priority, created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("materiel_demandes")
            .select("id, chantier_id, titre, designation, statut, status, quantite, unite, created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("chantier_time_entries")
            .select("id, chantier_id, task_id, duration_hours, quantite_realisee, work_date, created_at")
            .order("created_at", { ascending: false }),
        ]);

        if (!alive) return;

        setChantiers(chantiersResult);

        if (tasksResult.error && !isMissingRelationError(tasksResult.error.message)) throw tasksResult.error;
        if (reservesResult.error && !isMissingRelationError(reservesResult.error.message)) throw reservesResult.error;
        if (materielResult.error && !isMissingRelationError(materielResult.error.message)) throw materielResult.error;
        if (timeResult.error && !isMissingRelationError(timeResult.error.message)) throw timeResult.error;

        setTasks((tasksResult.data ?? []) as TaskSnapshot[]);
        setReserves((reservesResult.data ?? []) as ReserveSnapshot[]);
        setMateriel((materielResult.data ?? []) as MaterielSnapshot[]);
        setTimeEntries((timeResult.data ?? []) as TimeSnapshot[]);
      } catch {
        if (!alive) return;
        setChantiers([]);
        setTasks([]);
        setReserves([]);
        setMateriel([]);
        setTimeEntries([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const chantierById = useMemo(() => {
    const map = new Map<string, ChantierRow>();
    chantiers.forEach((chantier) => map.set(chantier.id, chantier));
    return map;
  }, [chantiers]);

  const chantiersEnCours = useMemo(
    () => chantiers.filter((chantier) => CHANTIER_EN_COURS_STATUSES.some((status) => status === chantier.status)),
    [chantiers],
  );

  const avgAvancement = useMemo(() => {
    if (chantiersEnCours.length === 0) return 0;
    const total = chantiersEnCours.reduce((sum, chantier) => sum + Number(chantier.avancement ?? 0), 0);
    return total / chantiersEnCours.length;
  }, [chantiersEnCours]);

  const totalHeuresPrevues = useMemo(
    () => chantiers.reduce((sum, chantier) => sum + Number(chantier.heures_prevues ?? 0), 0),
    [chantiers],
  );

  const totalHeuresPassees = useMemo(
    () => chantiers.reduce((sum, chantier) => sum + Number(chantier.heures_passees ?? 0), 0),
    [chantiers],
  );

  const pendingMateriel = useMemo(
    () => materiel.filter((row) => !["livree", "refusee"].includes(normalizeMaterialStatus(row))),
    [materiel],
  );

  const openReserves = useMemo(
    () => reserves.filter((row) => String(row.status ?? "").toUpperCase() !== "LEVEE"),
    [reserves],
  );

  const overdueTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter((task) => {
      if (!task.date_fin) return false;
      if (String(task.status ?? "").toUpperCase() === "FAIT") return false;
      return parseDateValue(`${task.date_fin}T00:00:00`) < today.getTime();
    });
  }, [tasks]);

  const overrunChantiers = useMemo(
    () =>
      chantiers.filter(
        (chantier) =>
          Number(chantier.heures_prevues ?? 0) > 0 && Number(chantier.heures_passees ?? 0) > Number(chantier.heures_prevues ?? 0),
      ),
    [chantiers],
  );

  const recentEvents = useMemo(() => {
    const timeEvents: RecentEvent[] = timeEntries.slice(0, 6).map((row) => ({
      id: `time-${row.id}`,
      kind: "time",
      chantierId: row.chantier_id,
      title: "Temps saisi",
      meta: `${formatHours(Number(row.duration_hours ?? 0))}${
        row.quantite_realisee ? ` | Qte ${Number(row.quantite_realisee).toLocaleString("fr-FR")}` : ""
      }`,
      createdAt: row.created_at ?? row.work_date,
    }));

    const materielEvents: RecentEvent[] = materiel.slice(0, 6).map((row) => ({
      id: `materiel-${row.id}`,
      kind: "materiel",
      chantierId: row.chantier_id,
      title: row.titre || row.designation || "Demande materiel",
      meta: materialStatusLabel(normalizeMaterialStatus(row)),
      createdAt: row.created_at,
    }));

    const reserveEvents: RecentEvent[] = reserves.slice(0, 6).map((row) => ({
      id: `reserve-${row.id}`,
      kind: "reserve",
      chantierId: row.chantier_id,
      title: row.title || "Reserve",
      meta: String(row.status ?? "OUVERTE"),
      createdAt: row.created_at,
    }));

    return [...timeEvents, ...materielEvents, ...reserveEvents]
      .sort((a, b) => parseDateValue(b.createdAt) - parseDateValue(a.createdAt))
      .slice(0, 10);
  }, [materiel, reserves, timeEntries]);

  const focusRows = useMemo(() => {
    if (activeView === "materiel") {
      return pendingMateriel.slice(0, 8).map((row) => ({
        key: row.id,
        href: `/chantiers/${row.chantier_id}`,
        title: row.titre || row.designation || "Demande materiel",
        subtitle: chantierById.get(row.chantier_id)?.nom || "Chantier",
        meta: `${materialStatusLabel(normalizeMaterialStatus(row))} | ${Number(row.quantite ?? 0).toLocaleString("fr-FR")} ${row.unite ?? ""}`.trim(),
      }));
    }

    if (activeView === "avancement") {
      return [...chantiersEnCours]
        .sort((a, b) => Number(a.avancement ?? 0) - Number(b.avancement ?? 0))
        .slice(0, 8)
        .map((chantier) => ({
          key: chantier.id,
          href: `/chantiers/${chantier.id}`,
          title: chantier.nom,
          subtitle: chantier.client || "Client non renseigne",
          meta: `Avancement ${formatPercent(Number(chantier.avancement ?? 0))}`,
        }));
    }

    if (activeView === "heures") {
      return [...chantiers]
        .filter((chantier) => Number(chantier.heures_prevues ?? 0) > 0)
        .sort((a, b) => {
          const aGap = Number(a.heures_passees ?? 0) - Number(a.heures_prevues ?? 0);
          const bGap = Number(b.heures_passees ?? 0) - Number(b.heures_prevues ?? 0);
          return bGap - aGap;
        })
        .slice(0, 8)
        .map((chantier) => ({
          key: chantier.id,
          href: `/chantiers/${chantier.id}`,
          title: chantier.nom,
          subtitle: chantier.client || "Client non renseigne",
          meta: `${formatHours(Number(chantier.heures_passees ?? 0))} / ${formatHours(Number(chantier.heures_prevues ?? 0))}`,
        }));
    }

    return chantiersEnCours.slice(0, 8).map((chantier) => ({
      key: chantier.id,
      href: `/chantiers/${chantier.id}`,
      title: chantier.nom,
      subtitle: chantier.client || "Client non renseigne",
      meta: `Fin prevue ${chantier.date_fin_prevue || "non planifiee"}`,
    }));
  }, [activeView, chantierById, chantiers, chantiersEnCours, pendingMateriel]);

  const pointsAttention = useMemo(() => {
    const items: Array<{ key: string; label: string; value: string; tone: "warning" | "danger" }> = [];
    if (overdueTasks.length > 0) {
      items.push({
        key: "retard",
        label: "Taches en retard",
        value: `${overdueTasks.length}`,
        tone: overdueTasks.length > 5 ? "danger" : "warning",
      });
    }
    if (overrunChantiers.length > 0) {
      items.push({
        key: "heures",
        label: "Depassement d'heures",
        value: `${overrunChantiers.length} chantier${overrunChantiers.length > 1 ? "s" : ""}`,
        tone: "danger",
      });
    }
    if (pendingMateriel.length > 0) {
      items.push({
        key: "materiel",
        label: "Demandes materiel non traitees",
        value: `${pendingMateriel.length}`,
        tone: pendingMateriel.length > 5 ? "danger" : "warning",
      });
    }
    if (openReserves.length > 0) {
      items.push({
        key: "reserves",
        label: "Reserves ouvertes",
        value: `${openReserves.length}`,
        tone: openReserves.length > 5 ? "danger" : "warning",
      });
    }
    return items;
  }, [openReserves.length, overdueTasks.length, overrunChantiers.length, pendingMateriel.length]);

  const kpis: Array<{
    key: Exclude<DashboardView, null>;
    label: string;
    value: string;
    hint: string;
    tone: "normal" | "warning" | "danger";
  }> = [
    {
      key: "chantiers",
      label: "Chantiers en cours",
      value: loading ? "..." : String(chantiersEnCours.length),
      hint: "Vue operationnelle",
      tone: chantiersEnCours.length === 0 ? "warning" : "normal",
    },
    {
      key: "avancement",
      label: "Avancement moyen global",
      value: loading ? "..." : formatPercent(avgAvancement),
      hint: avgAvancement < 40 ? "A relancer" : "Suivi global",
      tone: avgAvancement < 40 ? "danger" : avgAvancement < 70 ? "warning" : "normal",
    },
    {
      key: "heures",
      label: "Heures consommees vs prevues",
      value: loading ? "..." : `${formatHours(totalHeuresPassees)} / ${formatHours(totalHeuresPrevues)}`,
      hint: totalHeuresPrevues > 0 && totalHeuresPassees > totalHeuresPrevues ? "Derive a corriger" : "Sous controle",
      tone:
        totalHeuresPrevues > 0 && totalHeuresPassees > totalHeuresPrevues
          ? "danger"
          : totalHeuresPrevues > 0 && totalHeuresPassees > totalHeuresPrevues * 0.85
            ? "warning"
            : "normal",
    },
    {
      key: "materiel",
      label: "Demandes materiel en attente",
      value: loading ? "..." : String(pendingMateriel.length),
      hint: pendingMateriel.length > 0 ? "Action attendue" : "Flux propre",
      tone: pendingMateriel.length > 4 ? "danger" : pendingMateriel.length > 0 ? "warning" : "normal",
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Pilotage global</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950">Cockpit chantiers</h1>
            <p className="mt-1 text-sm text-slate-500">Lecture rapide des tensions, des derives et des actions a traiter.</p>
          </div>
          <Link
            to="/chantiers"
            className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Voir tous les chantiers
          </Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <button
            key={kpi.key}
            type="button"
            onClick={() => setActiveView((current) => (current === kpi.key ? null : kpi.key))}
            className={[
              "rounded-3xl border p-5 text-left shadow-sm transition",
              cardToneClass(kpi.tone, activeView === kpi.key),
            ].join(" ")}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{kpi.label}</div>
            <div className="mt-3 text-3xl font-semibold text-slate-950">{kpi.value}</div>
            <div className="mt-2 text-sm text-slate-600">{kpi.hint}</div>
          </button>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Points d'attention</div>
            <div className="mt-1 text-lg font-semibold text-slate-950">A traiter en priorite</div>
          </div>
          {activeView ? (
            <button
              type="button"
              onClick={() => setActiveView(null)}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              Reinitialiser
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          {pointsAttention.length === 0 ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 lg:col-span-4">
              Aucun point critique.
            </div>
          ) : (
            pointsAttention.map((item) => (
              <div key={item.key} className={["rounded-2xl border p-4", statusToneClass(item.tone)].join(" ")}>
                <div className="text-xs font-semibold uppercase tracking-[0.18em]">{item.label}</div>
                <div className="mt-2 text-2xl font-semibold">{item.value}</div>
              </div>
            ))
          )}
        </div>
        <div className="mt-5 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            {activeView === "avancement"
              ? "Chantiers a relancer"
              : activeView === "heures"
                ? "Derives heures"
                : activeView === "materiel"
                  ? "Demandes a traiter"
                  : "Focus en cours"}
          </div>
          {focusRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucune donnee a afficher.</div>
          ) : (
            focusRows.slice(0, 4).map((row) => (
              <Link key={row.key} to={row.href} className="block rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-950">{row.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{row.subtitle}</div>
                  </div>
                  <div className="text-right text-xs font-medium text-slate-600">{row.meta}</div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Activite recente</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">Derniers mouvements terrain</div>
        </div>
        <div className="mt-4 space-y-3">
          {recentEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucune activite recente.</div>
          ) : (
            recentEvents.map((event) => (
              <Link key={event.id} to={`/chantiers/${event.chantierId}`} className="block rounded-2xl border border-slate-200 p-4 transition hover:border-blue-200 hover:bg-blue-50/40">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                        {event.kind === "time" ? "Temps" : event.kind === "materiel" ? "Materiel" : "Reserve"}
                      </span>
                      <span className="text-sm font-semibold text-slate-950">{event.title}</span>
                    </div>
                    <div className="mt-1 text-sm text-slate-500">{chantierById.get(event.chantierId)?.nom || "Chantier"}</div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{event.meta}</div>
                    <div className="mt-1">{formatDateTimeFr(event.createdAt)}</div>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
