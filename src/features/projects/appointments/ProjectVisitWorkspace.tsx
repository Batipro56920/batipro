import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, FileText, MapPin, Phone, Save, Send, Wrench } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { createCrmAppointment, type CrmAppointmentRow } from "../../../services/crm.service";
import type { ProjectRecord } from "../types";

type VisitStatus = "brouillon" | "planifiee" | "en_cours" | "realisee" | "devis_a_faire" | "attente_client" | "abandonnee";
type VisitTab = "info" | "need" | "field" | "photos" | "documents" | "decision" | "report";

type VisitDraft = {
  status: VisitStatus;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  salesperson: string;
  date: string;
  time: string;
  durationMinutes: number;
  needDescription: string;
  clientGoal: string;
  priority: string;
  finishLevel: string;
  urgency: string;
  decisionMakerPresent: boolean;
  zones: string;
  technicalState: string;
  constraints: string;
  measurements: string;
  access: string;
  parking: string;
  floor: string;
  neighborhood: string;
  schedule: string;
  security: string;
  waterPower: string;
  waste: string;
  condominium: string;
  photoFiles: string[];
  photoNotes: string;
  documentFiles: string[];
  documentNotes: string;
  budget: string;
  objections: string;
  options: string;
  nextActions: string;
  followUpDate: string;
  needsStudy: boolean;
};

const TABS: Array<{ id: VisitTab; label: string; icon: ReactNode }> = [
  { id: "info", label: "Informations", icon: <Phone className="h-4 w-4" /> },
  { id: "need", label: "Besoin client", icon: <FileText className="h-4 w-4" /> },
  { id: "field", label: "Visite terrain", icon: <Wrench className="h-4 w-4" /> },
  { id: "photos", label: "Photos", icon: <Camera className="h-4 w-4" /> },
  { id: "documents", label: "Documents", icon: <FileText className="h-4 w-4" /> },
  { id: "decision", label: "Decision / suite", icon: <CheckCircle2 className="h-4 w-4" /> },
  { id: "report", label: "Compte-rendu", icon: <Send className="h-4 w-4" /> },
];

const inputClass = "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const textareaClass = "min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function initialDraft(project: ProjectRecord, appointment?: CrmAppointmentRow | null): VisitDraft {
  const start = appointment ? new Date(appointment.starts_at) : null;
  return {
    status: appointment?.statut === "realise" ? "realisee" : appointment ? "planifiee" : "brouillon",
    contactName: project.clientName,
    phone: project.contactPhone ?? "",
    email: project.contactEmail ?? "",
    address: project.address ?? "",
    salesperson: project.salesperson ?? "",
    date: start ? start.toISOString().slice(0, 10) : today(),
    time: start ? start.toTimeString().slice(0, 5) : "09:00",
    durationMinutes: 90,
    needDescription: appointment?.notes ?? project.needDescription ?? "",
    clientGoal: "",
    priority: "",
    finishLevel: "",
    urgency: project.prospect?.urgence ?? "",
    decisionMakerPresent: false,
    zones: "",
    technicalState: "",
    constraints: project.notes ?? "",
    measurements: "",
    access: "",
    parking: "",
    floor: "",
    neighborhood: "",
    schedule: "",
    security: "",
    waterPower: "",
    waste: "",
    condominium: "",
    photoFiles: [],
    photoNotes: "",
    documentFiles: [],
    documentNotes: "",
    budget: project.budgetEstimate ? String(project.budgetEstimate) : "",
    objections: "",
    options: "",
    nextActions: appointment?.compte_rendu ?? "",
    followUpDate: "",
    needsStudy: false,
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

function buildReport(project: ProjectRecord, draft: VisitDraft) {
  return [
    `Projet : ${project.name}`,
    `Client : ${project.clientName}`,
    "",
    "Besoin client",
    draft.needDescription || "A completer",
    "",
    "Objectif / priorite",
    draft.clientGoal || "A completer",
    "",
    "Zones concernees",
    draft.zones || "A completer",
    "",
    "Constat technique",
    draft.technicalState || "A completer",
    "",
    "Contraintes chantier",
    draft.constraints || "A completer",
    "",
    "Releves / metrees",
    draft.measurements || "A completer",
    "",
    "Budget / decision",
    `${draft.budget || "Budget non precise"} - ${draft.options || "Options a definir"}`,
    "",
    "Prochaines actions",
    draft.nextActions || "A definir",
  ].join("\n");
}

function fileNames(files: FileList | null) {
  return files ? Array.from(files).map((file) => file.name) : [];
}

export function ProjectVisitWorkspace({ project, existingAppointment }: { project: ProjectRecord; existingAppointment?: CrmAppointmentRow | null }) {
  const navigate = useNavigate();
  const storageKey = `batipro.project-visit.${existingAppointment?.id ?? project.id}`;
  const [activeTab, setActiveTab] = useState<VisitTab>("info");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "draft" | "saved" | "error">("idle");
  const [draft, setDraft] = useState<VisitDraft>(() => {
    const base = initialDraft(project, existingAppointment);
    const stored = localStorage.getItem(storageKey);
    if (!stored || existingAppointment) return base;
    try {
      return { ...base, ...JSON.parse(stored) };
    } catch {
      return base;
    }
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(draft));
    setSaveState("draft");
  }, [draft, storageKey]);

  function patch<K extends keyof VisitDraft>(key: K, value: VisitDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const startsAt = useMemo(() => new Date(`${draft.date}T${draft.time || "09:00"}:00`), [draft.date, draft.time]);
  const endsAt = useMemo(() => addMinutes(startsAt, Number(draft.durationMinutes || 90)), [draft.durationMinutes, startsAt]);
  const report = useMemo(() => buildReport(project, draft), [draft, project]);

  function saveDraft() {
    localStorage.setItem(storageKey, JSON.stringify(draft));
    setSaveState("draft");
  }

  async function saveVisit(status: VisitStatus) {
    setSaving(true);
    setSaveState("idle");
    try {
      const notes = [
        `Adresse : ${draft.address}`,
        `Contact : ${draft.contactName}`,
        `Telephone : ${draft.phone}`,
        `Email : ${draft.email}`,
        `Statut visite : ${status}`,
        `Zones : ${draft.zones}`,
        `Photos : ${draft.photoFiles.join(", ") || "aucune"}`,
        `Documents : ${draft.documentFiles.join(", ") || "aucun"}`,
        "",
        report,
      ].join("\n");

      await createCrmAppointment({
        prospect_id: project.prospect?.id ?? null,
        client_id: project.client?.id ?? null,
        opportunity_id: project.opportunity?.id ?? null,
        type: "visite_technique_projet",
        titre: `Visite projet - ${project.name}`,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        statut: status === "realisee" ? "realise" : "planifie",
        notes,
        compte_rendu: report,
      });
      localStorage.removeItem(storageKey);
      setSaveState("saved");
      navigate(`/projets/${project.id}?tab=visits`);
    } catch {
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Link to={`/projets/${project.id}?tab=visits`} className="mb-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50" aria-label="Retour au projet">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Visite terrain projet</div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{existingAppointment ? "Fiche visite" : "Nouvelle visite"}</h1>
            <p className="mt-2 text-sm text-slate-500">{project.name} - {project.clientName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {saveState === "draft" ? "Brouillon local sauvegarde" : saveState === "saved" ? "Visite enregistree" : saveState === "error" ? "Erreur sauvegarde" : draft.status}
            </span>
            <Button type="button" variant="secondary" onClick={saveDraft}>
              <Save className="h-4 w-4" />
              Sauvegarder
            </Button>
            <Button type="button" variant="primary" disabled={saving} onClick={() => saveVisit("planifiee")}>
              Planifier
            </Button>
            <Button type="button" variant="success" disabled={saving} onClick={() => saveVisit("realisee")}>
              Marquer realisee
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <aside className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-4 xl:self-start">
          <div className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-semibold transition",
                  activeTab === tab.id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                ].join(" ")}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </aside>

        <main className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          {activeTab === "info" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Client / prospect"><input className={inputClass} value={draft.contactName} onChange={(event) => patch("contactName", event.target.value)} /></Field>
              <Field label="Commercial"><input className={inputClass} value={draft.salesperson} onChange={(event) => patch("salesperson", event.target.value)} /></Field>
              <Field label="Telephone"><input className={inputClass} value={draft.phone} onChange={(event) => patch("phone", event.target.value)} /></Field>
              <Field label="Email"><input className={inputClass} value={draft.email} onChange={(event) => patch("email", event.target.value)} /></Field>
              <Field label="Adresse"><input className={inputClass} value={draft.address} onChange={(event) => patch("address", event.target.value)} /></Field>
              <Field label="Date"><input type="date" className={inputClass} value={draft.date} onChange={(event) => patch("date", event.target.value)} /></Field>
              <Field label="Heure"><input type="time" className={inputClass} value={draft.time} onChange={(event) => patch("time", event.target.value)} /></Field>
              <Field label="Duree estimee"><input type="number" className={inputClass} value={draft.durationMinutes} onChange={(event) => patch("durationMinutes", Number(event.target.value))} /></Field>
              <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
                <a href={`tel:${draft.phone}`} className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"><Phone className="h-4 w-4" />Appeler</a>
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(draft.address)}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"><MapPin className="h-4 w-4" />Itineraire</a>
              </div>
            </div>
          ) : null}

          {activeTab === "need" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Description du besoin"><textarea className={textareaClass} value={draft.needDescription} onChange={(event) => patch("needDescription", event.target.value)} /></Field>
              <Field label="Objectif client"><textarea className={textareaClass} value={draft.clientGoal} onChange={(event) => patch("clientGoal", event.target.value)} /></Field>
              <Field label="Priorite"><input className={inputClass} value={draft.priority} onChange={(event) => patch("priority", event.target.value)} /></Field>
              <Field label="Niveau de finition attendu"><input className={inputClass} value={draft.finishLevel} onChange={(event) => patch("finishLevel", event.target.value)} /></Field>
              <Field label="Urgence"><input className={inputClass} value={draft.urgency} onChange={(event) => patch("urgency", event.target.value)} /></Field>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={draft.decisionMakerPresent} onChange={(event) => patch("decisionMakerPresent", event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Decisionnaire present
              </label>
            </div>
          ) : null}

          {activeTab === "field" ? (
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Zones concernees"><textarea className={textareaClass} placeholder="Maison > RDC > Cuisine..." value={draft.zones} onChange={(event) => patch("zones", event.target.value)} /></Field>
                <Field label="Constat technique"><textarea className={textareaClass} placeholder="Support existant, etat general, anomalies..." value={draft.technicalState} onChange={(event) => patch("technicalState", event.target.value)} /></Field>
                <Field label="Contraintes chantier"><textarea className={textareaClass} value={draft.constraints} onChange={(event) => patch("constraints", event.target.value)} /></Field>
                <Field label="Releves / metrees"><textarea className={textareaClass} placeholder="Dimensions, surfaces, quantites..." value={draft.measurements} onChange={(event) => patch("measurements", event.target.value)} /></Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["Acces", "access"],
                  ["Stationnement", "parking"],
                  ["Etage", "floor"],
                  ["Voisinage", "neighborhood"],
                  ["Horaires", "schedule"],
                  ["Securite", "security"],
                  ["Eau / electricite", "waterPower"],
                  ["Evacuation gravats", "waste"],
                  ["Copropriete", "condominium"],
                ].map(([label, key]) => (
                  <Field key={key} label={label}>
                    <input className={inputClass} value={String(draft[key as keyof VisitDraft] ?? "")} onChange={(event) => patch(key as keyof VisitDraft, event.target.value as never)} />
                  </Field>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "photos" ? (
            <div className="space-y-4">
              <Field label="Ajouter photos">
                <input type="file" multiple accept="image/*" capture="environment" className={inputClass} onChange={(event) => patch("photoFiles", fileNames(event.target.files))} />
              </Field>
              <Field label="Notes photos / categories / zones"><textarea className={textareaClass} value={draft.photoNotes} onChange={(event) => patch("photoNotes", event.target.value)} /></Field>
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Fichiers selectionnes : {draft.photoFiles.length ? draft.photoFiles.join(", ") : "aucun"}
              </div>
            </div>
          ) : null}

          {activeTab === "documents" ? (
            <div className="space-y-4">
              <Field label="Ajouter plans, documents client, devis concurrents">
                <input type="file" multiple className={inputClass} onChange={(event) => patch("documentFiles", fileNames(event.target.files))} />
              </Field>
              <Field label="Notes documents"><textarea className={textareaClass} value={draft.documentNotes} onChange={(event) => patch("documentNotes", event.target.value)} /></Field>
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Fichiers selectionnes : {draft.documentFiles.length ? draft.documentFiles.join(", ") : "aucun"}
              </div>
            </div>
          ) : null}

          {activeTab === "decision" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Budget evoque / fourchette"><input className={inputClass} value={draft.budget} onChange={(event) => patch("budget", event.target.value)} /></Field>
              <Field label="Relance prevue"><input type="date" className={inputClass} value={draft.followUpDate} onChange={(event) => patch("followUpDate", event.target.value)} /></Field>
              <Field label="Objections"><textarea className={textareaClass} value={draft.objections} onChange={(event) => patch("objections", event.target.value)} /></Field>
              <Field label="Options discutees"><textarea className={textareaClass} value={draft.options} onChange={(event) => patch("options", event.target.value)} /></Field>
              <div className="md:col-span-2"><Field label="Prochaines actions"><textarea className={textareaClass} value={draft.nextActions} onChange={(event) => patch("nextActions", event.target.value)} /></Field></div>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={draft.needsStudy} onChange={(event) => patch("needsStudy", event.target.checked)} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                Besoin d'une etude complementaire
              </label>
            </div>
          ) : null}

          {activeTab === "report" ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 text-sm font-semibold text-slate-950">Compte-rendu consolide</div>
                <pre className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{report}</pre>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" disabled={saving} onClick={() => saveVisit("devis_a_faire")}>Creer pre-devis</Button>
                <Button type="button" variant="secondary" disabled>Exporter PDF</Button>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
