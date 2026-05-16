import { StatCard } from "../../../components/ui/design-system";
import type { CrmClientRow, CrmDataset, CrmProspectRow, CrmQuoteRow } from "../../../services/crm.service";
import { dateOnly, entityLabel, eur } from "../components/crmFormat";

export default function CrmDashboardSection({
  data,
  kpis,
  transformationRate,
  prospectById,
  clientById,
  quoteById,
  setModal,
}: {
  data: CrmDataset;
  kpis: Record<string, number>;
  transformationRate: number;
  prospectById: Map<string, CrmProspectRow>;
  clientById: Map<string, CrmClientRow>;
  quoteById: Map<string, CrmQuoteRow>;
  setModal: (value: "task" | "appointment" | "quote" | "sav") => void;
  setError: (value: string | null) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const overdueTasks = data.tasks.filter((row) => row.statut !== "terminee" && row.due_at && row.due_at.slice(0, 10) < today);
  const todayAppointments = data.appointments.filter((row) => row.starts_at.slice(0, 10) === today);
  const expiredQuotes = data.quotes.filter((row) => row.valid_until && row.valid_until < today && !["accepte", "refuse"].includes(row.statut));
  const riskOpportunities = data.opportunities.filter((row) => row.status === "ouverte" && row.prochaine_action_date && row.prochaine_action_date < today);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ["Prospects actifs", kpis.activeProspects],
          ["Nouveaux semaine", kpis.newProspectsWeek],
          ["Devis attente", kpis.quotesPending],
          ["CA signé", eur(kpis.signedRevenue)],
          ["Taux transformation", `${transformationRate}%`],
          ["CA opportunité", eur(kpis.pipelineRevenue)],
          ["Relances retard", kpis.overdueTasks],
          ["RDV du jour", kpis.appointmentsToday],
          ["SAV ouverts", kpis.openSav],
          ["Devis refusés", kpis.quotesRefused],
        ].map(([label, value]) => (
          <StatCard key={String(label)} label={String(label)} value={value} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <section className="rounded-3xl border bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Mes actions aujourd’hui</div>
              <h2 className="mt-1 text-lg font-semibold">Relances, appels, RDV, devis à envoyer</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setModal("task")} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">+ Tâche</button>
              <button onClick={() => setModal("appointment")} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">+ RDV</button>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {[...overdueTasks, ...data.tasks.filter((row) => row.due_at?.slice(0, 10) === today)].slice(0, 8).map((task) => (
              <div key={task.id} className="rounded-2xl border bg-slate-50 p-3">
                <div className="font-medium">{task.titre}</div>
                <div className="mt-1 text-xs text-slate-500">{task.type} · {task.due_at ? dateOnly(task.due_at) : "Sans échéance"}</div>
              </div>
            ))}
            {todayAppointments.slice(0, 4).map((rdv) => (
              <div key={rdv.id} className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                <div className="font-medium text-blue-950">{rdv.titre}</div>
                <div className="mt-1 text-xs text-blue-700">{new Date(rdv.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-red-700">Alertes</div>
          <div className="mt-4 space-y-2">
            {expiredQuotes.map((quote) => (
              <div key={quote.id} className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                Devis expiré : {quote.quote_number} · {entityLabel(clientById.get(quote.client_id ?? "") ?? prospectById.get(quote.prospect_id ?? ""))}
              </div>
            ))}
            {riskOpportunities.map((opp) => (
              <div key={opp.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Affaire à risque : {opp.nom_affaire} · action oubliée {dateOnly(opp.prochaine_action_date)}
              </div>
            ))}
            {data.quotes.filter((quote) => quote.statut === "envoye" && quote.signature_status === "attente_signature").slice(0, 4).map((quote) => (
              <div key={quote.id} className="rounded-2xl border bg-slate-50 p-3 text-sm text-slate-700">
                Signature manquante : {quote.quote_number}
              </div>
            ))}
            {expiredQuotes.length === 0 && riskOpportunities.length === 0 ? <div className="text-sm text-slate-500">Aucune alerte critique.</div> : null}
          </div>
        </section>
      </div>

      <PipelineMini data={data} quoteById={quoteById} />
    </div>
  );
}

function PipelineMini({ data }: { data: CrmDataset; quoteById: Map<string, CrmQuoteRow> }) {
  return (
    <section className="rounded-3xl border bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-700">Pipeline commercial</div>
      <div className="mt-4 grid gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {data.stages.slice(0, 7).map((stage) => {
          const rows = data.opportunities.filter((row) => row.stage_key === stage.key);
          return (
            <div key={stage.id} className="rounded-2xl border bg-slate-50 p-3">
              <div className="font-semibold text-slate-900">{stage.label}</div>
              <div className="mt-1 text-xs text-slate-500">{rows.length} affaire(s) · {eur(rows.reduce((sum, row) => sum + row.montant_estime, 0))}</div>
              <div className="mt-3 space-y-2">
                {rows.slice(0, 3).map((row) => (
                  <div key={row.id} className="rounded-xl bg-white p-3 text-sm shadow-sm">
                    <div className="font-medium">{row.nom_affaire}</div>
                    <div className="mt-1 text-xs text-slate-500">{eur(row.montant_estime)} · {row.probabilite}%</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
