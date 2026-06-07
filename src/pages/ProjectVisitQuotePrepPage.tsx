import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, FileText, Pencil, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadCrmVisitReportDraft, type CrmVisitReportDraft } from "../services/crmVisitReports.service";
import { VISIT_DRAFT_MARKER } from "../features/crm/utils/appointmentDraftStorage";
import { useProjectsData } from "../features/projects/hooks/useProjectsData";

function parseFallbackDraft(notes: string | null | undefined): CrmVisitReportDraft | null {
  if (!notes?.includes(VISIT_DRAFT_MARKER)) return null;
  try {
    return JSON.parse(notes.slice(notes.lastIndexOf(VISIT_DRAFT_MARKER) + VISIT_DRAFT_MARKER.length)) as CrmVisitReportDraft;
  } catch {
    return null;
  }
}

function lineQuantity(line: NonNullable<CrmVisitReportDraft["lines"]>[number]) {
  return `${Number(line.quantity ?? 0).toLocaleString("fr-FR")} ${line.unit ?? "u"}`;
}

export default function ProjectVisitQuotePrepPage() {
  const { id, visitId } = useParams();
  const navigate = useNavigate();
  const { projectsById, loading, error } = useProjectsData();
  const project = id ? projectsById.get(id) ?? null : null;
  const appointment = project?.appointments.find((item) => item.id === visitId) ?? null;
  const [draft, setDraft] = useState<CrmVisitReportDraft | null>(null);
  const [draftLoading, setDraftLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!visitId || !appointment) {
      setDraftLoading(false);
      return;
    }
    setDraftLoading(true);
    loadCrmVisitReportDraft(visitId)
      .then((stored) => {
        if (!alive) return;
        setDraft(stored ?? parseFallbackDraft(appointment.notes));
      })
      .catch(() => {
        if (alive) setDraft(parseFallbackDraft(appointment.notes));
      })
      .finally(() => {
        if (alive) setDraftLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [appointment, visitId]);

  const sections = useMemo(() => (draft?.lines ?? []).filter((line) => line.type === "section"), [draft?.lines]);
  const tasks = useMemo(() => (draft?.lines ?? []).filter((line) => line.type === "task"), [draft?.lines]);
  const attachments = draft?.attachments ?? [];
  const missingPrices = tasks.filter((line) => !Number(line.priceHintHt ?? 0)).length;
  const readyForQuote = tasks.length > 0;

  if (loading || draftLoading) {
    return <div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement de la preparation devis...</div>;
  }

  if (error || !project || !appointment) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? "Visite introuvable."}</div>;
  }

  return (
    <div className="space-y-5 pb-10">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <Link to={`/projets/${project.id}?tab=visits`} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900">
          <ArrowLeft className="h-4 w-4" />
          Retour projet
        </Link>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Visite terminee / preparation devis</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{project.name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Revue rapide du releve terrain avant creation du devis. Corrige seulement ce qui est utile au chiffrage.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={`/projets/${project.id}/visites/${appointment.id}`} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
              <Pencil className="h-4 w-4" />
              Reprendre
            </Link>
            <button
              type="button"
              disabled={!readyForQuote}
              onClick={() => navigate(`/projets/${project.id}/devis/nouveau`)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300"
            >
              <FileText className="h-4 w-4" />
              Creer le devis
            </button>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["Lignes a chiffrer", tasks.length],
          ["Sections", sections.length],
          ["Pieces jointes", attachments.length],
          ["Prix a completer", missingPrices],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-950">{value}</div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-blue-50 p-2 text-blue-700"><ClipboardCheck className="h-5 w-5" /></div>
          <div>
            <h2 className="font-semibold text-slate-950">Synthese utile au devis</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{draft?.needDescription || appointment.compte_rendu || "Aucune synthese renseignee."}</p>
            <div className="mt-3 grid gap-2 text-sm text-slate-500 md:grid-cols-3">
              <span>Client: {draft?.client || project.clientName}</span>
              <span>Adresse: {draft?.address || project.address || "Non renseignee"}</span>
              <span>Prochaine action: {draft?.nextAction || project.nextAction || "Creer le devis"}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-950">Lignes reprises dans le devis</h2>
            <p className="mt-1 text-sm text-slate-500">Le devis sera pre-rempli avec ces lignes. Les prix et marges restent finalisables a la main.</p>
          </div>
          <Link to={`/projets/${project.id}/visites/${appointment.id}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50">
            <Plus className="h-4 w-4" />
            Ajuster
          </Link>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          {tasks.length ? (
            <div className="divide-y divide-slate-100">
              {tasks.map((line) => (
                <div key={line.id ?? line.title} className="grid gap-2 p-4 text-sm md:grid-cols-[minmax(0,1fr)_120px_140px] md:items-center">
                  <div>
                    <div className="font-semibold text-slate-950">{line.title || "Prestation relevee"}</div>
                    {line.technicalNotes || line.constraints ? <div className="mt-1 line-clamp-2 text-xs text-slate-500">{[line.technicalNotes, line.constraints].filter(Boolean).join(" - ")}</div> : null}
                  </div>
                  <div className="text-slate-600">{lineQuantity(line)}</div>
                  <div className={Number(line.priceHintHt ?? 0) ? "font-semibold text-slate-900" : "font-semibold text-amber-700"}>
                    {Number(line.priceHintHt ?? 0) ? `${Number(line.priceHintHt).toLocaleString("fr-FR")} EUR HT` : "Prix a completer"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 text-sm text-slate-500">Aucune ligne relevee. Reprends la visite pour ajouter les taches a chiffrer.</div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-950">Photos et documents utiles</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {attachments.length ? attachments.map((item) => (
            <div key={item.id ?? item.name} className="rounded-2xl border border-slate-200 p-3 text-sm">
              {item.previewUrl ? <img src={item.previewUrl} alt={item.name} className="mb-3 aspect-video w-full rounded-xl object-cover" /> : null}
              <div className="font-semibold text-slate-950">{item.name}</div>
              <div className="mt-1 text-xs text-slate-500">{item.kind}{item.comment ? ` - ${item.comment}` : ""}</div>
            </div>
          )) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Aucune piece jointe utile au devis.</div>}
        </div>
      </section>
    </div>
  );
}
