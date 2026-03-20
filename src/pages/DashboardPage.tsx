import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { listChantiers, type ChantierRow } from "../services/chantiers.service";
import { useI18n } from "../i18n";

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

function formatHours(value: number, locale: string): string {
  return `${value.toLocaleString(locale, { maximumFractionDigits: 1 })} h`;
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

function materialStatusLabel(value: string, t: (key: string) => string): string {
  if (value === "validee") return t("common.materielStatus.validee");
  if (value === "refusee") return t("common.materielStatus.refusee");
  if (value === "livree") return t("common.materielStatus.livree");
  return t("common.materielStatus.en_attente");
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
  const { locale, t } = useI18n();
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

  const orderedChantiers = useMemo(() => {
    return [...chantiers].sort((a, b) => {
      const aCreated = Date.parse(String(a.created_at ?? "")) || 0;
      const bCreated = Date.parse(String(b.created_at ?? "")) || 0;
      if (aCreated !== bCreated) return bCreated - aCreated;
      return String(a.nom ?? "").localeCompare(String(b.nom ?? ""), "fr");
    });
  }, [chantiers]);

  const avgAvancement = useMemo(() => {
    if (chantiers.length === 0) return 0;
    const total = chantiers.reduce((sum, chantier) => sum + Number(chantier.avancement ?? 0), 0);
    return total / chantiers.length;
  }, [chantiers]);

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
        title: row.titre || row.designation || t("dashboard.materialRequest"),
        subtitle: chantierById.get(row.chantier_id)?.nom || t("sidebar.chantiers"),
        meta: `${materialStatusLabel(normalizeMaterialStatus(row), t)} | ${Number(row.quantite ?? 0).toLocaleString(locale)} ${row.unite ?? ""}`.trim(),
      }));
    }

    if (activeView === "avancement") {
      return [...orderedChantiers]
        .sort((a, b) => Number(a.avancement ?? 0) - Number(b.avancement ?? 0))
        .slice(0, 8)
        .map((chantier) => ({
          key: chantier.id,
          href: `/chantiers/${chantier.id}`,
          title: chantier.nom,
          subtitle: chantier.client || t("dashboard.missingClient"),
          meta: t("dashboard.progressLabel", { value: formatPercent(Number(chantier.avancement ?? 0)) }),
        }));
    }

    if (activeView === "heures") {
      return [...orderedChantiers]
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
          subtitle: chantier.client || t("dashboard.missingClient"),
          meta: `${formatHours(Number(chantier.heures_passees ?? 0), locale)} / ${formatHours(Number(chantier.heures_prevues ?? 0), locale)}`,
        }));
    }

    return orderedChantiers.slice(0, 8).map((chantier) => ({
      key: chantier.id,
      href: `/chantiers/${chantier.id}`,
      title: chantier.nom,
      subtitle: chantier.client || t("dashboard.missingClient"),
      meta: chantier.date_fin_prevue
        ? t("dashboard.finishPlanned", { date: chantier.date_fin_prevue })
        : t("dashboard.finishNotPlanned"),
    }));
  }, [activeView, chantierById, locale, orderedChantiers, pendingMateriel, t]);

  const kpis: Array<{
    key: Exclude<DashboardView, null>;
    label: string;
    value: string;
    hint: string;
    tone: "normal" | "warning" | "danger";
  }> = [
    {
      key: "chantiers",
      label: t("dashboard.kpis.chantiers"),
      value: loading ? "..." : String(chantiers.length),
      hint: t("dashboard.sectionTitle"),
      tone: chantiers.length === 0 ? "warning" : "normal",
    },
    {
      key: "avancement",
      label: t("dashboard.kpis.averageProgress"),
      value: loading ? "..." : formatPercent(avgAvancement),
      hint: avgAvancement < 40 ? t("dashboard.relaunch") : t("dashboard.followUp"),
      tone: avgAvancement < 40 ? "danger" : avgAvancement < 70 ? "warning" : "normal",
    },
    {
      key: "heures",
      label: t("dashboard.kpis.hours"),
      value: loading ? "..." : `${formatHours(totalHeuresPassees, locale)} / ${formatHours(totalHeuresPrevues, locale)}`,
      hint: totalHeuresPrevues > 0 && totalHeuresPassees > totalHeuresPrevues ? t("dashboard.drift") : t("dashboard.underControl"),
      tone:
        totalHeuresPrevues > 0 && totalHeuresPassees > totalHeuresPrevues
          ? "danger"
          : totalHeuresPrevues > 0 && totalHeuresPassees > totalHeuresPrevues * 0.85
            ? "warning"
            : "normal",
    },
    {
      key: "materiel",
      label: t("dashboard.kpis.material"),
      value: loading ? "..." : String(pendingMateriel.length),
      hint: pendingMateriel.length > 0 ? t("dashboard.actionNeeded") : t("dashboard.cleanFlow"),
      tone: pendingMateriel.length > 4 ? "danger" : pendingMateriel.length > 0 ? "warning" : "normal",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-slate-950">{t("dashboard.title")}</h1>
        <Link to="/chantiers" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          {t("dashboard.cta")}
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
          <div className="text-sm font-semibold text-slate-950">{t("dashboard.sectionTitle")}</div>
          {activeView ? (
            <button type="button" onClick={() => setActiveView(null)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700">
              {t("common.actions.reset")}
            </button>
          ) : null}
        </div>
        <div className="mt-4 space-y-3">
          {focusRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">{t("dashboard.empty")}</div>
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
