import { Link, useParams, useSearchParams } from "react-router-dom";
import { ProjectVisitWorkspaceStable } from "../features/projects/appointments/ProjectVisitWorkspaceStable";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";
import type { ProjectRecord } from "../features/projects/types";
import type { CrmAppointmentRow } from "../services/crm.service";
import ProjectVisitQuotePrepPage from "./ProjectVisitQuotePrepPage";

function isProjectVisitAppointment(appointment: CrmAppointmentRow) {
  return appointment.type === "visite_chiffrage" || appointment.type === "visite_chiffrage_pre_devis";
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

  if (shouldPrepareQuote) {
    return <ProjectVisitQuotePrepPage />;
  }

  return <ProjectVisitWorkspaceStable project={project} existingAppointment={appointment} />;
}
