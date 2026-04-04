import { useEffect, useMemo, useState } from "react";

import type { ChantierRow } from "../../services/chantiers.service";
import { appendChantierActivityLog } from "../../services/chantierActivityLog.service";
import { uploadDocument } from "../../services/chantierDocuments.service";
import { getCompanyBrandingForPdf } from "../../services/companySettings.service";
import {
  loadChantierReportDataset,
  type ChantierReportDataset,
  type ChantierReportKind,
} from "../../services/chantierReports.service";
import { generateChantierReportPdfBlob } from "../../services/chantierReportsPdf.service";

type RapportsTabProps = {
  chantier: ChantierRow;
  onDocumentsRefresh?: () => Promise<void>;
  onActivityRefresh?: () => Promise<void> | void;
};

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value.includes("T") ? value : `${value}T00:00:00`).toLocaleDateString("fr-FR");
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function taskStatusLabel(status: string) {
  if (status === "FAIT") return "Terminee";
  if (status === "EN_COURS") return "En cours";
  return "A faire";
}

function reserveStatusLabel(status: string) {
  if (status === "LEVEE") return "Levee";
  if (status === "EN_COURS") return "En cours";
  return "Ouverte";
}

function purchaseStatusLabel(status: string) {
  if (status === "livre") return "Livre";
  if (status === "commande") return "Commande";
  if (status === "annule") return "Annule";
  return "A commander";
}

function metricCard(label: string, value: string, tone: string) {
  return (
    <div className={`rounded-3xl border px-5 py-4 ${tone}`}>
      <div className="text-xs font-semibold uppercase tracking-[0.16em] opacity-80">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default function RapportsTab({ chantier, onDocumentsRefresh, onActivityRefresh }: RapportsTabProps) {
  const today = useMemo(() => new Date(), []);
  const monthStart = useMemo(() => new Date(today.getFullYear(), today.getMonth(), 1), [today]);

  const [periodStart, setPeriodStart] = useState(() => toIsoDate(monthStart));
  const [periodEnd, setPeriodEnd] = useState(() => toIsoDate(today));
  const [dataset, setDataset] = useState<ChantierReportDataset | null>(null);
  const [loading, setLoading] = useState(false);
  const [generatingKind, setGeneratingKind] = useState<ChantierReportKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refreshReport() {
    if (!chantier.id) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const report = await loadChantierReportDataset({
        chantier,
        periodStart,
        periodEnd,
      });
      setDataset(report);
    } catch (err: any) {
      setDataset(null);
      setError(err?.message ?? "Erreur chargement rapport.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantier.id]);

  async function generateReport(kind: ChantierReportKind) {
    if (!chantier.id) return;
    setGeneratingKind(kind);
    setError(null);
    setMessage(null);
    try {
      const report =
        dataset ??
        (await loadChantierReportDataset({
          chantier,
          periodStart,
          periodEnd,
        }));
      const company = await getCompanyBrandingForPdf();
      const blob = await generateChantierReportPdfBlob({ dataset: report, kind, company });
      const label = kind === "client" ? "client" : "interne";
      const file = new File(
        [blob],
        `rapport-chantier-${label}-${periodStart}-${periodEnd}.pdf`,
        { type: "application/pdf" },
      );

      await uploadDocument({
        chantierId: chantier.id,
        file,
        title: `Rapport chantier ${label} - ${periodStart} / ${periodEnd}`,
        category: "Rapports",
        documentType: kind === "client" ? "RAPPORT_CLIENT" : "PDF",
        visibility_mode: "GLOBAL",
      });

      await appendChantierActivityLog({
        chantierId: chantier.id,
        actionType: "created",
        entityType: "document",
        reason: `Rapport chantier ${label} genere`,
        changes: {
          period_start: periodStart,
          period_end: periodEnd,
          kind,
        },
      });

      await onDocumentsRefresh?.();
      await onActivityRefresh?.();
      setDataset(report);
      setMessage(`Rapport ${label} genere et archive dans Documents.`);
    } catch (err: any) {
      setError(err?.message ?? "Erreur generation rapport PDF.");
    } finally {
      setGeneratingKind(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="font-semibold section-title">Rapports chantier</div>
          <div className="text-sm text-slate-500">
            Export client et interne avec synthese des taches, reserves, temps, achats et budget.
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-[auto_auto_auto_auto]">
          <label className="space-y-1 text-xs text-slate-600">
            Debut
            <input
              type="date"
              value={periodStart}
              onChange={(event) => setPeriodStart(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="space-y-1 text-xs text-slate-600">
            Fin
            <input
              type="date"
              value={periodEnd}
              onChange={(event) => setPeriodEnd(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <button
            type="button"
            onClick={() => void refreshReport()}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {loading ? "Chargement..." : "Actualiser"}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void generateReport("client")}
              disabled={Boolean(generatingKind)}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {generatingKind === "client" ? "Export..." : "PDF client"}
            </button>
            <button
              type="button"
              onClick={() => void generateReport("interne")}
              disabled={Boolean(generatingKind)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {generatingKind === "interne" ? "Export..." : "PDF interne"}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      ) : null}

      {loading && !dataset ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          Chargement de la synthese...
        </div>
      ) : dataset ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metricCard("Avancement", `${dataset.summary.avancement_pct}%`, "border-blue-200 bg-blue-50 text-blue-900")}
            {metricCard("Heures periode", `${dataset.summary.heures_periode_h.toFixed(1).replace(".", ",")} h`, "border-slate-200 bg-white text-slate-900")}
            {metricCard("Reserves ouvertes", `${dataset.summary.reserves_ouvertes}`, "border-amber-200 bg-amber-50 text-amber-900")}
            {metricCard("Marge reelle", `${dataset.summary.marge_reelle_pct.toFixed(1).replace(".", ",")}%`, "border-emerald-200 bg-emerald-50 text-emerald-900")}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Taches sur la periode</div>
              <div className="mt-1 text-xs text-slate-500">
                {formatDate(dataset.periodStart)} - {formatDate(dataset.periodEnd)}
              </div>
              <div className="mt-4 space-y-3">
                {dataset.tasks.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Aucune tache datee sur la periode.
                  </div>
                ) : (
                  dataset.tasks.slice(0, 12).map((task) => (
                    <article key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="text-sm font-semibold text-slate-900">{task.titre}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {task.lot} - {taskStatusLabel(task.status)} - {formatDate(task.date_debut)} / {formatDate(task.date_fin)}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Reserves chantier</div>
              <div className="mt-1 text-xs text-slate-500">
                {dataset.summary.reserves_urgentes} urgentes / {dataset.summary.reserves_ouvertes} ouvertes
              </div>
              <div className="mt-4 space-y-3">
                {dataset.reserves.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Aucune reserve a afficher.
                  </div>
                ) : (
                  dataset.reserves.slice(0, 12).map((reserve) => (
                    <article key={reserve.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex flex-wrap justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">{reserve.title}</div>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                          {reserveStatusLabel(reserve.status)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {reserve.priority} - {reserve.zone_nom ?? "Sans zone"} - {reserve.intervenant_nom ?? "Non assigne"}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Temps terrain</div>
              <div className="mt-1 text-xs text-slate-500">
                {dataset.timeEntries.length} saisies sur la periode
              </div>
              <div className="mt-4 space-y-3">
                {dataset.timeEntries.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Aucun temps saisi sur la periode.
                  </div>
                ) : (
                  dataset.timeEntries.slice(0, 12).map((entry) => (
                    <article key={entry.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="text-sm font-semibold text-slate-900">{entry.task_titre}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatDate(entry.work_date)} - {entry.intervenant_nom} - {entry.duration_hours
                          .toFixed(1)
                          .replace(".", ",")} h
                      </div>
                      {entry.note ? <div className="mt-2 text-sm text-slate-700">{entry.note}</div> : null}
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-900">Budget / achats</div>
              <div className="mt-1 text-xs text-slate-500">
                Depassement budget : {formatMoney(dataset.summary.budget_depassement_ht)}
              </div>
              <div className="mt-4 space-y-3">
                {dataset.purchases.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                    Aucun achat a afficher.
                  </div>
                ) : (
                  dataset.purchases.slice(0, 12).map((purchase) => (
                    <article key={purchase.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="flex flex-wrap justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900">{purchase.titre}</div>
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                          {purchaseStatusLabel(purchase.statut_commande)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {purchase.supplier_name ?? "Fournisseur non renseigne"} - {formatMoney(purchase.cout_reel_ht)}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
