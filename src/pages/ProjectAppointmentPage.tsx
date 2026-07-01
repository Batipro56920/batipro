import { Link, useParams, useSearchParams } from "react-router-dom";
import { ProjectVisitWorkspaceStable } from "../features/projects/appointments/ProjectVisitWorkspaceStable";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";
import type { ProjectRecord } from "../features/projects/types";
import { VisitQuotePrepDailyCleaningControl } from "../features/quotes/builder/VisitQuotePrepDailyCleaningControl";
import type { CrmAppointmentRow } from "../services/crm.service";
import ProjectVisitQuotePrepPage from "./ProjectVisitQuotePrepPage";

function isProjectVisitAppointment(appointment: CrmAppointmentRow) {
  return appointment.type === "visite_chiffrage" || appointment.type === "visite_chiffrage_pre_devis";
}

function appointmentTypeLabel(type: string | null | undefined) {
  if (type === "appel") return "Appel";
  if (type === "rdv_client") return "RDV client";
  if (type === "relance") return "Relance";
  if (type === "visite_chiffrage") return "Visite de chiffrage";
  if (type === "visite_chiffrage_pre_devis") return "Préparation devis";
  return type || "Rendez-vous";
}

function appointmentStatusLabel(status: string | null | undefined) {
  if (status === "planifie") return "Planifié";
  if (status === "realise") return "Réalisé";
  if (status === "annule") return "Annulé";
  if (status === "reporte") return "Reporté";
  return status || "Statut non renseigné";
}

function formatAppointmentDate(value: string | null | undefined) {
  if (!value) return "Date non renseignée";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
}

function resolveProjectVisitAppointment(project: ProjectRecord, appointmentId?: string) {
  if (appointmentId) {
    return project.appointments.find((item) => item.id === appointmentId) ?? null;
  }

  return (
    project.appointments
      .filter(isProjectVisitAppointment)
      .sort((a, b) => String(a.created_at ?? a.starts_at).localeCompare(String(b.created_at ?? b.starts_at)))[0] ?? null
  );
}

function ProjectRdvSummary({ project, appointment }: { project: ProjectRecord; appointment: CrmAppointmentRow }) {
  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-950 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Rendez-vous ciblé</div>
        <h1 className="mt-2 text-2xl font-bold text-blue-950">{appointment.titre || appointmentTypeLabel(appointment.type)}</h1>
        <p className="mt-2 text-blue-800">
          Ce résultat vient de la recherche globale. Il est affiché comme rendez-vous commercial, sans ouvrir l'outil de visite de chiffrage.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Projet</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{project.name}</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Type</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{appointmentTypeLabel(appointment.type)}</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Statut</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{appointmentStatusLabel(appointment.statut)}</div>
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Date</div>
            <div className="mt-2 text-sm font-semibold text-slate-900">{formatAppointmentDate(appointment.starts_at)}</div>
          </div>
        </div>

        {appointment.notes || appointment.compte_rendu ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {appointment.notes ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Notes</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{appointment.notes}</div>
              </div>
            ) : null}
            {appointment.compte_rendu ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Compte rendu</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{appointment.compte_rendu}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          <Link to={`/projets/${project.id}?tab=visits`} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
            Voir tous les RDV du projet
          </Link>
          <Link to="/crm/agenda" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Agenda CRM
          </Link>
        </div>
      </section>
    </div>
  );
}

function ProjectAppointmentNotFound({ project, mode }: { project: ProjectRecord; mode: "rdv" | "visit" }) {
  const label = mode === "rdv" ? "rendez-vous" : "visite de chiffrage";

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Élément introuvable</div>
      <h1 className="mt-2 text-xl font-bold text-amber-950">Ce {label} n'est plus accessible</h1>
      <p className="mt-2 text-amber-800">
        Le lien pointe vers un élément supprimé, déplacé ou non visible avec les droits actuels. Le projet reste accessible pour contrôler ses RDV, visites et devis.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link to={`/projets/${project.id}?tab=visits`} className="rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">
          Voir les RDV / visites du projet
        </Link>
        <Link to="/crm/agenda" className="rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
          Agenda CRM
        </Link>
      </div>
    </div>
  );
}

export default function ProjectAppointmentPage() {
  const { id, rdvId, visitId } = useParams();
  const [searchParams] = useSearchParams();
  const { projectsById, loading, error } = useProjectsData();
  const project = id ? projectsById.get(id) : null;
  const appointmentId = rdvId ?? visitId;
  const appointment = project ? resolveProjectVisitAppointment(project, appointmentId) : null;
  const shouldPrepareQuote = searchParams.get("preparation") === "devis" || (visitId && appointment?.statut === "realise" && searchParams.get("edit") !== "1");

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Chargement de la visite de chiffrage...
      </div>
    );
  }

  if (error) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>;
  }

  if (!project) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="text-lg font-semibold text-slate-950">Projet introuvable</div>
        <p className="mt-2 text-sm text-slate-500">Impossible de creer une visite de chiffrage sans projet lie.</p>
        <Link to="/projets" className="mt-5 inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
          Retour aux projets
        </Link>
      </div>
    );
  }

  if (appointmentId && !appointment) {
    return <ProjectAppointmentNotFound project={project} mode={rdvId ? "rdv" : "visit"} />;
  }

  if (rdvId && appointment && !isProjectVisitAppointment(appointment)) {
    return <ProjectRdvSummary project={project} appointment={appointment} />;
  }

  if (shouldPrepareQuote) {
    return (
      <>
        <ProjectVisitQuotePrepPage />
        <VisitQuotePrepDailyCleaningControl projectId={project.id} />
      </>
    );
  }

  return <ProjectVisitWorkspaceStable project={project} existingAppointment={appointment} />;
}
