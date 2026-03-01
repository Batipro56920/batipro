import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { CHANTIER_EN_COURS_STATUSES } from "../lib/chantierRules";
import { listChantiers, type ChantierRow } from "../services/chantiers.service";

type DashboardView = "chantiers" | "avancement" | "heures" | "materiel" | null;

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
  const [materiel, setMateriel] = useState<MaterielSnapshot[]>([]);
  const [activeView, setActiveView] = useState<DashboardView>("chantiers");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      try {
        const [chantiersResult, materielResult] = await Promise.all([
          listChantiers({ scope: "all" }),
          supabase
            .from("materiel_demandes")
            .select("id, chantier_id, titre, designation, statut, status, quantite, unite, created_at")
            .order("created_at", { ascending: false }),
        ]);

        if (!alive) return;

        setChantiers(chantiersResult);

        if (materielResult.error && !isMissingRelationError(materielResult.error.message)) throw materielResult.error;

        setMateriel((materielResult.data ?? []) as MaterielSnapshot[]);
      } catch {
        if (!alive) return;
        setChantiers([]);
        setMateriel([]);
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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-slate-950">Cockpit chantiers</h1>
        <Link to="/chantiers" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Chantiers
        </Link>
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <button
            key={kpi.key}
            type="button"
            onClick={() => setActiveView((current) => (current === kpi.key ? null : kpi.key))}
            className={[
              "rounded-2xl border px-4 py-3 text-left transition",
              cardToneClass(kpi.tone, activeView === kpi.key),
            ].join(" ")}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{kpi.label}</div>
            <div className="mt-1 text-lg font-semibold text-slate-950">{kpi.value}</div>
          </button>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-950">Chantiers</div>
          {activeView ? (
            <button type="button" onClick={() => setActiveView(null)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700">
              Reinitialiser
            </button>
          ) : null}
        </div>
        <div className="mt-4 space-y-3">
          {focusRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">Aucun chantier a afficher.</div>
          ) : (
            focusRows.map((row) => (
              <Link key={row.key} to={row.href} className="block rounded-2xl border border-slate-200 px-4 py-3 transition hover:border-blue-200 hover:bg-blue-50/40">
                <div className="flex items-center justify-between gap-3">
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
    </div>
  );
}
