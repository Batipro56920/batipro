import type { CrmClientRow, CrmDataset, CrmProspectRow, CrmQuoteRow } from "../../../services/crm.service";
import { CrmActionCenter, type CrmActionItem } from "../components/CrmActionCenter";
import { CrmAlertCenter, type CrmAlertItem } from "../components/CrmAlertCenter";
import { CrmKpiGrid, type CrmKpiItem } from "../components/CrmKpiGrid";
import { CrmPipelinePreview } from "../components/CrmPipelinePreview";
import { CrmRecentActivity } from "../components/CrmRecentActivity";
import { dateOnly, entityLabel, eur } from "../components/crmFormat";

export default function CrmDashboardSection({
  data,
  kpis,
  transformationRate,
  prospectById,
  clientById,
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
  const todayTasks = data.tasks.filter((row) => row.statut !== "terminee" && row.due_at?.slice(0, 10) === today);
  const todayAppointments = data.appointments.filter((row) => row.starts_at.slice(0, 10) === today);
  const quotesToSend = data.quotes.filter((row) => ["brouillon", "en_preparation"].includes(row.statut));
  const quotesToRelaunch = data.quotes.filter((row) => ["envoye", "relance_1", "relance_2"].includes(row.statut));
  const refusedQuotes = data.quotes.filter((row) => row.statut === "refuse");
  const openSav = data.sav.filter((row) => row.statut !== "clos");
  const inactiveOpportunities = data.opportunities.filter((row) => row.status === "ouverte" && (!row.prochaine_action_date || row.prochaine_action_date < today));

  const kpiItems: CrmKpiItem[] = [
    {
      key: "prospects",
      label: "Prospects actifs",
      value: String(kpis.activeProspects),
      hint: "À qualifier, relancer ou convertir",
      href: "/crm/prospects",
      tone: kpis.activeProspects > 0 ? "info" : "normal",
    },
    {
      key: "quotes",
      label: "Devis en attente",
      value: String(kpis.quotesPending),
      hint: "Brouillons, envoyés ou en négociation",
      href: "/crm/devis",
      tone: kpis.quotesPending > 0 ? "warning" : "success",
    },
    {
      key: "revenue",
      label: "CA signé",
      value: eur(kpis.signedRevenue),
      hint: "Total HT des devis acceptés",
      href: "/crm/devis",
      tone: kpis.signedRevenue > 0 ? "success" : "normal",
    },
    {
      key: "transform",
      label: "Taux transformation",
      value: `${transformationRate}%`,
      hint: "Devis acceptés / devis totaux",
      href: "/statistiques",
      tone: transformationRate >= 50 ? "success" : transformationRate > 0 ? "info" : "normal",
    },
    {
      key: "overdue",
      label: "Relances en retard",
      value: String(kpis.overdueTasks),
      hint: "Actions commerciales dépassées",
      href: "/crm/agenda",
      tone: kpis.overdueTasks > 0 ? "danger" : "success",
    },
    {
      key: "sav",
      label: "SAV ouverts",
      value: String(kpis.openSav),
      hint: "Tickets après chantier à suivre",
      href: "/crm/sav",
      tone: kpis.openSav > 0 ? "warning" : "success",
    },
  ];

  const actionItems: CrmActionItem[] = [
    ...overdueTasks.slice(0, 4).map((task) => ({
      id: `task-overdue-${task.id}`,
      title: task.titre,
      meta: `${task.type} · échéance ${dateOnly(task.due_at)}`,
      description: task.description ?? undefined,
      tone: "danger" as const,
    })),
    ...todayTasks.slice(0, 3).map((task) => ({
      id: `task-today-${task.id}`,
      title: task.titre,
      meta: `${task.type} · aujourd’hui`,
      description: task.description ?? undefined,
      tone: task.priorite === "haute" ? "warning" as const : "normal" as const,
    })),
    ...todayAppointments.slice(0, 3).map((appointment) => ({
      id: `appointment-${appointment.id}`,
      title: appointment.titre,
      meta: `${appointment.type} · ${new Date(appointment.starts_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`,
      description: appointment.notes ?? undefined,
      tone: "info" as const,
    })),
    ...quotesToSend.slice(0, 2).map((quote) => ({
      id: `quote-send-${quote.id}`,
      title: `Devis à envoyer ${quote.quote_number}`,
      meta: entityLabel(clientById.get(quote.client_id ?? "") ?? prospectById.get(quote.prospect_id ?? "")),
      description: quote.description ?? undefined,
      href: `/crm/devis/${quote.id}/edit`,
      tone: "warning" as const,
    })),
    ...quotesToRelaunch.slice(0, 2).map((quote) => ({
      id: `quote-relaunch-${quote.id}`,
      title: `Devis à relancer ${quote.quote_number}`,
      meta: entityLabel(clientById.get(quote.client_id ?? "") ?? prospectById.get(quote.prospect_id ?? "")),
      description: quote.valid_until ? `Valide jusqu’au ${dateOnly(quote.valid_until)}` : undefined,
      href: `/crm/devis/${quote.id}/edit`,
      tone: "warning" as const,
    })),
  ].slice(0, 8);

  const alertItems: CrmAlertItem[] = [
    {
      key: "overdue",
      label: "Relances en retard",
      value: overdueTasks.length,
      description: "Tâches commerciales dépassées",
      href: "/crm/agenda",
      tone: overdueTasks.length > 0 ? "danger" : "normal",
    },
    {
      key: "refused",
      label: "Devis refusés",
      value: refusedQuotes.length,
      description: "À analyser pour améliorer le taux de signature",
      href: "/crm/devis",
      tone: refusedQuotes.length > 0 ? "warning" : "normal",
    },
    {
      key: "sav",
      label: "SAV ouverts",
      value: openSav.length,
      description: "Tickets client encore ouverts",
      href: "/crm/sav",
      tone: openSav.length > 0 ? "warning" : "normal",
    },
    {
      key: "inactive",
      label: "Opportunités sans activité",
      value: inactiveOpportunities.length,
      description: "Affaires ouvertes sans prochaine action",
      href: "/crm/opportunites",
      tone: inactiveOpportunities.length > 0 ? "warning" : "normal",
    },
  ];

  const recentItems: CrmActionItem[] = [
    ...data.quotes.slice(0, 5).map((quote) => ({
      id: `recent-quote-${quote.id}`,
      title: `Devis créé ${quote.quote_number}`,
      meta: dateOnly(quote.created_at),
      description: `${entityLabel(clientById.get(quote.client_id ?? "") ?? prospectById.get(quote.prospect_id ?? ""))} · ${eur(quote.montant_ht)}`,
      tone: "info" as const,
    })),
    ...data.prospects.slice(0, 5).map((prospect) => ({
      id: `recent-prospect-${prospect.id}`,
      title: `Prospect ajouté : ${entityLabel(prospect)}`,
      meta: dateOnly(prospect.created_at),
      description: prospect.type_projet ?? prospect.email ?? undefined,
      tone: "normal" as const,
    })),
    ...data.appointments.slice(0, 4).map((appointment) => ({
      id: `recent-appointment-${appointment.id}`,
      title: `RDV : ${appointment.titre}`,
      meta: dateOnly(appointment.starts_at),
      description: appointment.type,
      tone: "info" as const,
    })),
    ...data.sav.slice(0, 4).map((sav) => ({
      id: `recent-sav-${sav.id}`,
      title: `SAV : ${sav.titre}`,
      meta: dateOnly(sav.created_at),
      description: sav.statut,
      tone: "warning" as const,
    })),
  ]
    .sort((a, b) => String(b.meta).localeCompare(String(a.meta), "fr"))
    .slice(0, 8);

  return (
    <div className="space-y-5">
      <CrmKpiGrid items={kpiItems} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <CrmActionCenter items={actionItems} onTask={() => setModal("task")} onAppointment={() => setModal("appointment")} />
        <CrmAlertCenter items={alertItems} />
      </div>

      <CrmPipelinePreview data={data} />
      <CrmRecentActivity items={recentItems} />
    </div>
  );
}
