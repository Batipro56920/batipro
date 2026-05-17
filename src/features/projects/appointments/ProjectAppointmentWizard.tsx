import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { createCrmAppointment, type CrmAppointmentRow } from "../../../services/crm.service";
import type { ProjectRecord } from "../types";
import { ProjectAppointmentChecklist } from "./ProjectAppointmentChecklist";
import { ProjectAppointmentSummary, buildAppointmentSummary } from "./ProjectAppointmentSummary";

export type ProjectAppointmentDraft = {
  contactName: string;
  phone: string;
  email: string;
  address: string;
  salesperson: string;
  date: string;
  time: string;
  durationMinutes: number;
  projectType: string;
  needDescription: string;
  zones: string;
  clientGoal: string;
  urgency: string;
  desiredDeadline: string;
  checklist: string[];
  access: string;
  parking: string;
  floor: string;
  condominium: string;
  scheduleConstraints: string;
  noise: string;
  neighborhood: string;
  security: string;
  utilities: string;
  waste: string;
  constraints: string;
  photosNotes: string;
  plansNotes: string;
  clientDocsNotes: string;
  competitorQuoteNotes: string;
  missingDocsNotes: string;
  budgetKnown: boolean;
  budgetRange: string;
  clientPriority: string;
  decision: string;
  options: string;
  nextActions: string;
  followUpDate: string;
  status: "brouillon" | "planifie" | "realise";
};

const STEPS = [
  "Renseignements",
  "Description projet",
  "Tâches à vérifier",
  "Contraintes",
  "Photos & documents",
  "Budget & décision",
  "Synthèse",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function initialDraft(project: ProjectRecord): ProjectAppointmentDraft {
  return {
    contactName: project.clientName,
    phone: project.contactPhone ?? "",
    email: project.contactEmail ?? "",
    address: project.address ?? "",
    salesperson: project.salesperson ?? "",
    date: today(),
    time: "09:00",
    durationMinutes: 90,
    projectType: project.projectType ?? "",
    needDescription: project.needDescription ?? "",
    zones: "",
    clientGoal: "",
    urgency: project.prospect?.urgence ?? "",
    desiredDeadline: project.desiredDeadline ?? "",
    checklist: ["Prendre photos", "Relever métrés", "Vérifier accès", "Valider budget"],
    access: "",
    parking: "",
    floor: "",
    condominium: "",
    scheduleConstraints: "",
    noise: "",
    neighborhood: "",
    security: "",
    utilities: "",
    waste: "",
    constraints: project.notes ?? "",
    photosNotes: "",
    plansNotes: "",
    clientDocsNotes: "",
    competitorQuoteNotes: "",
    missingDocsNotes: "",
    budgetKnown: Boolean(project.budgetEstimate),
    budgetRange: project.budgetEstimate ? String(project.budgetEstimate) : "",
    clientPriority: "",
    decision: "",
    options: "",
    nextActions: "",
    followUpDate: "",
    status: "brouillon",
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const textareaClass = "min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function ProjectAppointmentWizard({ project, existingAppointment }: { project: ProjectRecord; existingAppointment?: CrmAppointmentRow | null }) {
  const navigate = useNavigate();
  const storageKey = `batipro.project-appointment.${project.id}`;
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savedState, setSavedState] = useState<"idle" | "draft" | "saved" | "error">("idle");
  const [draft, setDraft] = useState<ProjectAppointmentDraft>(() => {
    const fromProject = initialDraft(project);
    const stored = localStorage.getItem(storageKey);
    if (stored && !existingAppointment) {
      try {
        return { ...fromProject, ...JSON.parse(stored) };
      } catch {
        return fromProject;
      }
    }
    if (!existingAppointment) return fromProject;
    const start = new Date(existingAppointment.starts_at);
    return {
      ...fromProject,
      date: start.toISOString().slice(0, 10),
      time: start.toTimeString().slice(0, 5),
      status: existingAppointment.statut === "realise" ? "realise" : "planifie",
      needDescription: existingAppointment.notes ?? fromProject.needDescription,
      decision: existingAppointment.compte_rendu ?? "",
    };
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(draft));
    setSavedState("draft");
  }, [draft, storageKey]);

  function patch<K extends keyof ProjectAppointmentDraft>(key: K, value: ProjectAppointmentDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const startsAt = useMemo(() => new Date(`${draft.date}T${draft.time || "09:00"}:00`), [draft.date, draft.time]);
  const endsAt = useMemo(() => addMinutes(startsAt, Number(draft.durationMinutes || 90)), [draft.durationMinutes, startsAt]);

  function saveDraft() {
    localStorage.setItem(storageKey, JSON.stringify(draft));
    setSavedState("draft");
  }

  async function submit(status: ProjectAppointmentDraft["status"] = draft.status === "brouillon" ? "planifie" : draft.status) {
    setSaving(true);
    setSavedState("idle");
    try {
      const structuredNotes = [
        `Adresse RDV : ${draft.address}`,
        `Contact sur place : ${draft.contactName}`,
        `Téléphone : ${draft.phone}`,
        `Email : ${draft.email}`,
        `Type projet : ${draft.projectType}`,
        `Besoin : ${draft.needDescription}`,
        `Zones : ${draft.zones}`,
        `Checklist : ${draft.checklist.join(", ")}`,
        `Contraintes : ${draft.constraints}`,
        `Documents : ${draft.photosNotes} ${draft.plansNotes} ${draft.clientDocsNotes} ${draft.competitorQuoteNotes} ${draft.missingDocsNotes}`,
      ].join("\n");
      await createCrmAppointment({
        prospect_id: project.prospect?.id ?? null,
        client_id: project.client?.id ?? null,
        opportunity_id: project.opportunity?.id ?? null,
        type: "rdv_technique_projet",
        titre: `RDV projet - ${project.name}`,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        statut: status === "realise" ? "realise" : "planifie",
        notes: structuredNotes,
        compte_rendu: buildAppointmentSummary({ ...draft, status }),
      });
      localStorage.removeItem(storageKey);
      setSavedState("saved");
      navigate(`/projets/${project.id}?tab=visits`);
    } catch {
      setSavedState("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link to={`/projets/${project.id}?tab=visits`} className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50" aria-label="Retour au projet">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">RDV projet</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Nouveau RDV projet</h1>
            <p className="mt-2 text-sm text-slate-500">{project.name} · {project.clientName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {savedState === "draft" ? "Brouillon local sauvegardé" : savedState === "saved" ? "RDV enregistré" : savedState === "error" ? "Erreur sauvegarde" : "Brouillon"}
            </span>
            <Button type="button" variant="secondary" onClick={saveDraft}>
              <Save className="h-4 w-4" />
              Sauvegarder brouillon
            </Button>
          </div>
        </div>
      </header>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {STEPS.map((label, index) => (
            <button
              key={label}
              type="button"
              onClick={() => setStep(index)}
              className={[
                "min-w-max rounded-2xl px-3 py-2 text-xs font-semibold transition",
                step === index ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
              ].join(" ")}
            >
              {index + 1}. {label}
            </button>
          ))}
        </div>
      </div>

      <main className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {step === 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Client / prospect lié"><input className={inputClass} value={draft.contactName} onChange={(e) => patch("contactName", e.target.value)} /></Field>
            <Field label="Commercial"><input className={inputClass} value={draft.salesperson} onChange={(e) => patch("salesperson", e.target.value)} /></Field>
            <Field label="Téléphone"><input className={inputClass} value={draft.phone} onChange={(e) => patch("phone", e.target.value)} /></Field>
            <Field label="Email"><input className={inputClass} value={draft.email} onChange={(e) => patch("email", e.target.value)} /></Field>
            <Field label="Adresse du RDV"><input className={inputClass} value={draft.address} onChange={(e) => patch("address", e.target.value)} /></Field>
            <Field label="Contact sur place"><input className={inputClass} value={draft.contactName} onChange={(e) => patch("contactName", e.target.value)} /></Field>
            <Field label="Date"><input type="date" className={inputClass} value={draft.date} onChange={(e) => patch("date", e.target.value)} /></Field>
            <Field label="Heure"><input type="time" className={inputClass} value={draft.time} onChange={(e) => patch("time", e.target.value)} /></Field>
            <Field label="Durée estimée"><input type="number" className={inputClass} value={draft.durationMinutes} onChange={(e) => patch("durationMinutes", Number(e.target.value))} /></Field>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type de projet"><input className={inputClass} value={draft.projectType} onChange={(e) => patch("projectType", e.target.value)} /></Field>
            <Field label="Urgence"><input className={inputClass} value={draft.urgency} onChange={(e) => patch("urgency", e.target.value)} /></Field>
            <Field label="Pièces / zones concernées"><input className={inputClass} value={draft.zones} onChange={(e) => patch("zones", e.target.value)} /></Field>
            <Field label="Délai souhaité"><input type="date" className={inputClass} value={draft.desiredDeadline} onChange={(e) => patch("desiredDeadline", e.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="Description besoin client"><textarea className={textareaClass} value={draft.needDescription} onChange={(e) => patch("needDescription", e.target.value)} /></Field></div>
            <div className="md:col-span-2"><Field label="Objectif client"><textarea className={textareaClass} value={draft.clientGoal} onChange={(e) => patch("clientGoal", e.target.value)} /></Field></div>
          </div>
        ) : null}

        {step === 2 ? <ProjectAppointmentChecklist values={draft.checklist} onChange={(values) => patch("checklist", values)} /> : null}

        {step === 3 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Accès"><input className={inputClass} value={draft.access} onChange={(e) => patch("access", e.target.value)} /></Field>
            <Field label="Stationnement"><input className={inputClass} value={draft.parking} onChange={(e) => patch("parking", e.target.value)} /></Field>
            <Field label="Étage"><input className={inputClass} value={draft.floor} onChange={(e) => patch("floor", e.target.value)} /></Field>
            <Field label="Copropriété"><input className={inputClass} value={draft.condominium} onChange={(e) => patch("condominium", e.target.value)} /></Field>
            <Field label="Horaires"><input className={inputClass} value={draft.scheduleConstraints} onChange={(e) => patch("scheduleConstraints", e.target.value)} /></Field>
            <Field label="Bruit / voisinage"><input className={inputClass} value={draft.noise} onChange={(e) => patch("noise", e.target.value)} /></Field>
            <Field label="Sécurité"><input className={inputClass} value={draft.security} onChange={(e) => patch("security", e.target.value)} /></Field>
            <Field label="Électricité / eau"><input className={inputClass} value={draft.utilities} onChange={(e) => patch("utilities", e.target.value)} /></Field>
            <Field label="Évacuation gravats"><input className={inputClass} value={draft.waste} onChange={(e) => patch("waste", e.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="Contraintes techniques libres"><textarea className={textareaClass} value={draft.constraints} onChange={(e) => patch("constraints", e.target.value)} /></Field></div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Photos"><textarea className={textareaClass} value={draft.photosNotes} onChange={(e) => patch("photosNotes", e.target.value)} /></Field>
            <Field label="Plans"><textarea className={textareaClass} value={draft.plansNotes} onChange={(e) => patch("plansNotes", e.target.value)} /></Field>
            <Field label="Documents client"><textarea className={textareaClass} value={draft.clientDocsNotes} onChange={(e) => patch("clientDocsNotes", e.target.value)} /></Field>
            <Field label="Devis concurrent"><textarea className={textareaClass} value={draft.competitorQuoteNotes} onChange={(e) => patch("competitorQuoteNotes", e.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="Documents manquants"><textarea className={textareaClass} value={draft.missingDocsNotes} onChange={(e) => patch("missingDocsNotes", e.target.value)} /></Field></div>
          </div>
        ) : null}

        {step === 5 ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-medium text-slate-800">
              <input type="checkbox" checked={draft.budgetKnown} onChange={(e) => patch("budgetKnown", e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
              Budget client connu
            </label>
            <Field label="Fourchette budget"><input className={inputClass} value={draft.budgetRange} onChange={(e) => patch("budgetRange", e.target.value)} /></Field>
            <Field label="Priorité client"><input className={inputClass} value={draft.clientPriority} onChange={(e) => patch("clientPriority", e.target.value)} /></Field>
            <Field label="Relance prévue"><input type="date" className={inputClass} value={draft.followUpDate} onChange={(e) => patch("followUpDate", e.target.value)} /></Field>
            <Field label="Décision prise sur place"><textarea className={textareaClass} value={draft.decision} onChange={(e) => patch("decision", e.target.value)} /></Field>
            <Field label="Options envisagées"><textarea className={textareaClass} value={draft.options} onChange={(e) => patch("options", e.target.value)} /></Field>
            <div className="md:col-span-2"><Field label="Prochaines actions"><textarea className={textareaClass} value={draft.nextActions} onChange={(e) => patch("nextActions", e.target.value)} /></Field></div>
          </div>
        ) : null}

        {step === 6 ? <ProjectAppointmentSummary draft={draft} /> : null}
      </main>

      <footer className="sticky bottom-4 z-10 rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="text-sm text-slate-500">Étape {step + 1} sur {STEPS.length} · état {draft.status}</div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" disabled={step === 0} onClick={() => setStep((current) => Math.max(0, current - 1))}>
              <ChevronLeft className="h-4 w-4" />
              Précédent
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" variant="primary" onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))}>
                Suivant
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" disabled={saving} onClick={() => submit("planifie")}>
                  <Check className="h-4 w-4" />
                  Marquer planifié
                </Button>
                <Button type="button" variant="primary" disabled={saving} onClick={() => submit("realise")}>
                  <Check className="h-4 w-4" />
                  Enregistrer RDV
                </Button>
                <Link to="/crm/devis" title="Créer un pré-devis après enregistrement du RDV" className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50">
                  Créer pré-devis
                </Link>
              </>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
