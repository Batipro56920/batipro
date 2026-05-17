import { Link, useParams } from "react-router-dom";
import { ProjectAppointmentWizard } from "../features/projects/appointments/ProjectAppointmentWizard";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";

export default function ProjectAppointmentPage() {
  const { id, rdvId } = useParams();
  const { projectsById, loading, error } = useProjectsData();
  const project = id ? projectsById.get(id) : null;
  const appointment = rdvId && project ? project.appointments.find((item) => item.id === rdvId) ?? null : null;

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
        Chargement du RDV projet...
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
        <p className="mt-2 text-sm text-slate-500">Impossible de planifier un RDV sans projet lié.</p>
        <Link to="/projets" className="mt-5 inline-flex h-9 items-center justify-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700">
          Retour aux projets
        </Link>
      </div>
    );
  }

  return <ProjectAppointmentWizard project={project} existingAppointment={appointment} />;
}
