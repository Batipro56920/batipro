import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, FileText, Library, Plus, Save, Search, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { createCrmAppointment, type CrmAppointmentRow } from "../../../services/crm.service";
import { loadCrmVisitReportDraft, saveCrmVisitReport } from "../../../services/crmVisitReports.service";
import { createOpportunityForProspect, updateCrmAppointment, updateCrmOpportunityStageByKey } from "../../../services/crmWorkflow.service";
import { list as listTaskTemplates, type TaskTemplateRow } from "../../../services/taskLibrary.service";
import { VISIT_DRAFT_MARKER } from "../../crm/utils/appointmentDraftStorage";
import type { ProjectRecord } from "../types";

type StepKey = "info" | "description" | "estimating" | "constraints" | "budget" | "summary";
type VisitStatus = "brouillon" | "planifiee" | "realisee" | "pre_devis";
type Unit = "u" | "ml" | "m2" | "m3" | "h";
type LineType = "section" | "task";

type EstimateLine = {
  id: string;
  type: LineType;
  parentId: string | null;
  title: string;
  unit: Unit;
  quantity: number;
  manualQuantity: boolean;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  estimatedHours?: number | null;
  priceHintHt?: number | null;
  family?: string | null;
  libraryId?: string | null;
  technicalNotes: string;
  constraints: string;
  variants: string;
  attentionPoints: string;
};

type VisitAttachment = {
  id: string;
  kind: "photo" | "document";
  name: string;
  targetLineId: string | null;
  comment: string;
  previewUrl?: string | null;
  file?: File | null;
  storagePath?: string | null;
  url?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

type VisitDraft = {
  status: VisitStatus;
  client: string;
  phone: string;
  email: string;
  address: string;
  contactOnSite: string;
  date: string;
  time: string;
  durationMinutes: number;
  salesperson: string;
  projectType: string;
  clientObjective: string;
  needDescription: string;
  urgency: string;
  desiredDeadline: string;
  zones: string;
  access: string;
  parking: string;
  floor: string;
  condominium: string;
  schedule: string;
  nuisance: string;
  safety: string;
  waste: string;
  water: string;
  electricity: string;
  authorizations: string;
  constraintNotes: string;
  budgetKnown: string;
  budgetRange: string;
  priceSensitivity: string;
  decisionMaker: string;
  decisionOnSite: string;
  objections: string;
  nextAction: string;
  followUpDate: string;
  lines: EstimateLine[];
  attachments: VisitAttachment[];
};

const steps: Array<{ key: StepKey; label: string }> = [
  { key: "info", label: "Infos" },
  { key: "description", label: "Projet" },
  { key: "estimating", label: "Terrain / pre-devis" },
  { key: "constraints", label: "Contraintes" },
  { key: "budget", label: "Budget" },
  { key: "summary", label: "Synthese" },
];

const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const textareaClass = "min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw || raw === "," || raw === ".") return null;
  const compact = raw.replace(/[\s\u202f]/g, "");
  const normalized = compact.includes(",") && compact.includes(".")
    ? compact.replace(/\./g, "").replace(",", ".")
    : compact.replace(",", ".");
  const next = Number(normalized);
  return Number.isFinite(next) ? next : null;
}

function numberText(value: number | null | undefined) {
  return value === null || value === undefined || Number.isNaN(Number(value)) ? "" : String(value).replace(".", ",");
}

function normalizeUnit(value: string | null | undefined): Unit {
  const unit = String(value ?? "").toLowerCase().replace("²", "2").replace("³", "3").trim();
  if (unit.includes("m3")) return "m3";
  if (unit.includes("m2")) return "m2";
  if (unit === "ml") return "ml";
  if (unit === "h" || unit.includes("heure")) return "h";
  return "u";
}

function quantity(line: EstimateLine) {
  if (line.manualQuantity) return Number(line.quantity || 0);
  const length = Number(line.length || 0);
  const width = Number(line.width || 0);
  const height = Number(line.height || 0);
  if (line.unit === "ml") return Math.round(length * 100) / 100;
  if (line.unit === "m2") return Math.round(length * width * 100) / 100;
  if (line.unit === "m3") return Math.round(length * width * height * 100) / 100;
  return Number(line.quantity || 0);
}

function parseStoredDraft(value: string | null | undefined): Partial<VisitDraft> | null {
  if (!value) return null;
  const markerIndex = value.lastIndexOf(VISIT_DRAFT_MARKER);
  const jsonText = markerIndex >= 0 ? value.slice(markerIndex + VISIT_DRAFT_MARKER.length) : value.trim().startsWith("{") ? value : "";
  if (!jsonText) return null;
  try {
    return JSON.parse(jsonText) as Partial<VisitDraft>;
  } catch {
    return null;
  }
}

function appointmentVisitStatus(appointment?: CrmAppointmentRow | null): VisitStatus {
  if (!appointment) return "brouillon";
  if (String(appointment.type ?? "").includes("pre_devis")) return "pre_devis";
  if (appointment.statut === "realise") return "realisee";
  return "planifiee";
}

function normalizeVisitStatus(status: string | null | undefined): VisitStatus {
  if (status === "brouillon" || status === "planifiee" || status === "realisee" || status === "pre_devis") return status;
  return "planifiee";
}

function appointmentDurationMinutes(appointment?: CrmAppointmentRow | null) {
  if (!appointment?.ends_at) return 90;
  const start = new Date(appointment.starts_at).getTime();
  const end = new Date(appointment.ends_at).getTime();
  const minutes = Math.round((end - start) / 60_000);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 90;
}

function initialDraft(project: ProjectRecord, appointment?: CrmAppointmentRow | null): VisitDraft {
  const start = appointment ? new Date(appointment.starts_at) : null;
  const base: VisitDraft = {
    status: appointmentVisitStatus(appointment),
    client: project.clientName,
    phone: project.contactPhone ?? "",
    email: project.contactEmail ?? "",
    address: project.address ?? "",
    contactOnSite: project.clientName,
    date: start ? start.toISOString().slice(0, 10) : today(),
    time: start ? start.toTimeString().slice(0, 5) : "09:00",
    durationMinutes: appointmentDurationMinutes(appointment),
    salesperson: project.salesperson ?? "",
    projectType: project.projectType ?? "",
    clientObjective: "",
    needDescription: project.needDescription ?? "",
    urgency: project.prospect?.urgence ?? "",
    desiredDeadline: project.desiredDeadline ?? "",
    zones: "",
    access: "",
    parking: "",
    floor: "",
    condominium: "",
    schedule: "",
    nuisance: "",
    safety: "",
    waste: "",
    water: "",
    electricity: "",
    authorizations: "",
    constraintNotes: project.notes ?? "",
    budgetKnown: project.budgetEstimate ? String(project.budgetEstimate) : "",
    budgetRange: "",
    priceSensitivity: "",
    decisionMaker: "",
    decisionOnSite: "",
    objections: "",
    nextAction: "",
    followUpDate: "",
    lines: [],
    attachments: [],
  };
  const stored = parseStoredDraft(appointment?.notes) ?? parseStoredDraft(appointment?.compte_rendu);
  if (!stored) return base;
  return {
    ...base,
    ...stored,
    status: normalizeVisitStatus(stored.status),
    lines: Array.isArray(stored.lines) ? (stored.lines as EstimateLine[]) : base.lines,
    attachments: Array.isArray(stored.attachments) ? (stored.attachments as VisitAttachment[]) : base.attachments,
  };
}

function serializeDraft(draft: VisitDraft) {
  return {
    ...draft,
    attachments: draft.attachments.map(({ previewUrl: _previewUrl, file: _file, ...attachment }) => attachment),
  };
}

function buildReport(project: ProjectRecord, draft: VisitDraft) {
  const sections = draft.lines.filter((line) => line.type === "section");
  const tasks = draft.lines.filter((line) => line.type === "task");
  const taskLines = sections
    .map((section) => {
      const children = tasks.filter((task) => task.parentId === section.id);
      return [`# ${section.title}`, ...children.map((task) => `- ${task.title}: ${quantity(task)} ${task.unit}${task.technicalNotes ? ` | ${task.technicalNotes}` : ""}`)].join("\n");
    })
    .join("\n\n");

  return [
    `Projet: ${project.name}`,
    `Client: ${draft.client}`,
    `Adresse RDV: ${draft.address}`,
    "",
    "Description projet",
    draft.needDescription || "A completer",
    "",
    "Terrain / pre-devis",
    taskLines || "Aucune ligne de pre-devis.",
    "",
    "Contraintes chantier",
    [
      draft.access && `Acces: ${draft.access}`,
      draft.parking && `Stationnement: ${draft.parking}`,
      draft.floor && `Etage: ${draft.floor}`,
      draft.condominium && `Copropriete: ${draft.condominium}`,
      draft.waste && `Evacuation gravats: ${draft.waste}`,
      draft.water && `Eau: ${draft.water}`,
      draft.electricity && `Electricite: ${draft.electricity}`,
      draft.constraintNotes,
    ].filter(Boolean).join("\n") || "Aucune contrainte renseignee.",
    "",
    "Budget / decision",
    `Budget connu: ${draft.budgetKnown || "non renseigne"}`,
    `Fourchette: ${draft.budgetRange || "non renseignee"}`,
    `Decisionnaire: ${draft.decisionMaker || "non renseigne"}`,
    `Prochaine action: ${draft.nextAction || "non renseignee"}`,
    "",
    `Photos: ${draft.attachments.filter((item) => item.kind === "photo").length}`,
    `Documents: ${draft.attachments.filter((item) => item.kind === "document").length}`,
  ].join("\n");
}

function appointmentTypeFor(status: VisitStatus) {
  return status === "pre_devis" ? "visite_chiffrage_pre_devis" : "visite_chiffrage";
}

function appointmentStatusFor(status: VisitStatus) {
  return status === "realisee" || status === "pre_devis" ? "realise" : "planifie";
}

function opportunityStageForVisitStatus(status: VisitStatus) {
  return status === "realisee" || status === "pre_devis" ? "chiffrage" : "visite";
}

function opportunityNextActionFor(status: VisitStatus) {
  if (status === "pre_devis") return "Finaliser le pre-devis";
  if (status === "realisee") return "Preparer le devis";
  return "Realiser la visite terrain";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function FileCapture({ onFiles }: { onFiles: (files: FileList | null, kind: "photo" | "document") => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-800">
        <Camera className="h-4 w-4" />
        Prendre photo
        <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => onFiles(event.target.files, "photo")} />
      </label>
      <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
        <FileText className="h-4 w-4" />
        Importer document
        <input className="hidden" type="file" multiple accept="image/*,.pdf" onChange={(event) => onFiles(event.target.files, "document")} />
      </label>
    </div>
  );
}

export function ProjectVisitWorkspace({ project, existingAppointment }: { project: ProjectRecord; existingAppointment?: CrmAppointmentRow | null }) {
  const navigate = useNavigate();
  const [currentAppointment, setCurrentAppointment] = useState<CrmAppointmentRow | null>(existingAppointment ?? null);
  const storageKey = `batipro.project-visit-estimate.${currentAppointment?.id ?? existingAppointment?.id ?? project.id}`;
  const [step, setStep] = useState<StepKey>("info");
  const [draft, setDraft] = useState<VisitDraft>(() => {
    const base = initialDraft(project, existingAppointment);
    const stored = localStorage.getItem(`batipro.project-visit-estimate.${existingAppointment?.id ?? project.id}`);
    if (!stored || existingAppointment) return base;
    try {
      const parsed = JSON.parse(stored) as Partial<VisitDraft>;
      return { ...base, ...parsed, lines: parsed.lines ?? base.lines, attachments: parsed.attachments ?? base.attachments };
    } catch {
      return base;
    }
  });
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [library, setLibrary] = useState<TaskTemplateRow[]>([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryFamily, setLibraryFamily] = useState("__ALL__");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"draft" | "saved" | "error">("draft");
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(serializeDraft(draft)));
      setSaveState("draft");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, storageKey]);

  useEffect(() => {
    let alive = true;
    listTaskTemplates().then((rows) => alive && setLibrary(rows)).catch(() => alive && setLibrary([]));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const appointmentId = currentAppointment?.id ?? existingAppointment?.id;
    if (!appointmentId) return () => { alive = false; };
    loadCrmVisitReportDraft(appointmentId)
      .then((stored) => {
        if (!alive || !stored) return;
        setDraft((current) => ({
          ...current,
          ...stored,
          status: normalizeVisitStatus(stored.status),
          lines: stored.lines?.length ? stored.lines as EstimateLine[] : current.lines,
          attachments: stored.attachments?.length ? stored.attachments as VisitAttachment[] : current.attachments,
        }));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [currentAppointment?.id, existingAppointment?.id]);

  const sections = useMemo(() => draft.lines.filter((line) => line.type === "section"), [draft.lines]);
  const tasks = useMemo(() => draft.lines.filter((line) => line.type === "task"), [draft.lines]);
  const selectedLine = useMemo(() => draft.lines.find((line) => line.id === selectedLineId) ?? null, [draft.lines, selectedLineId]);
  const activeSectionId = selectedLine?.type === "section" ? selectedLine.id : selectedLine?.parentId ?? sections[0]?.id ?? null;
  const report = useMemo(() => buildReport(project, draft), [project, draft]);
  const families = useMemo(() => Array.from(new Set(library.map((item) => item.lot).filter(Boolean) as string[])).sort(), [library]);
  const filteredLibrary = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return library
      .filter((item) => libraryFamily === "__ALL__" || item.lot === libraryFamily)
      .filter((item) => !query || `${item.titre} ${item.lot ?? ""}`.toLowerCase().includes(query))
      .slice(0, 20);
  }, [library, libraryFamily, libraryQuery]);

  function patch<K extends keyof VisitDraft>(key: K, value: VisitDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function patchLine(id: string, patch: Partial<EstimateLine>) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => {
        if (line.id !== id) return line;
        const next = { ...line, ...patch };
        if (!next.manualQuantity) next.quantity = quantity(next);
        return next;
      }),
    }));
  }

  function numericKey(lineId: string, field: keyof EstimateLine) {
    return `${lineId}:${String(field)}`;
  }

  function numericValue(line: EstimateLine, field: keyof EstimateLine, value: number | null | undefined) {
    return numericDrafts[numericKey(line.id, field)] ?? numberText(value);
  }

  function patchNumericLine(id: string, field: keyof EstimateLine, raw: string, extra: Partial<EstimateLine> = {}) {
    setNumericDrafts((current) => ({ ...current, [numericKey(id, field)]: raw }));
    const parsed = toNumber(raw);
    if (raw.trim() === "") {
      patchLine(id, { ...extra, [field]: field === "quantity" ? 0 : null } as Partial<EstimateLine>);
      return;
    }
    if (parsed !== null) patchLine(id, { ...extra, [field]: parsed } as Partial<EstimateLine>);
  }

  function commitNumericLine(id: string, field: keyof EstimateLine) {
    setNumericDrafts((current) => {
      const next = { ...current };
      delete next[numericKey(id, field)];
      return next;
    });
  }

  function addSection(title = "Nouvelle section") {
    const line: EstimateLine = {
      id: uid("section"),
      type: "section",
      parentId: null,
      title,
      unit: "u",
      quantity: 0,
      manualQuantity: false,
      technicalNotes: "",
      constraints: "",
      variants: "",
      attentionPoints: "",
    };
    setDraft((current) => ({ ...current, lines: [...current.lines, line] }));
    setSelectedLineId(line.id);
    setStep("estimating");
    return line.id;
  }

  function addTask(source?: Partial<EstimateLine>) {
    const sectionId = activeSectionId ?? uid("section");
    const shouldCreateSection = !activeSectionId;
    const line: EstimateLine = {
      id: uid("task"),
      type: "task",
      parentId: sectionId,
      title: source?.title ?? "Nouvelle tache / prestation",
      unit: source?.unit ?? "m2",
      quantity: source?.quantity ?? 0,
      manualQuantity: Boolean(source?.manualQuantity),
      length: null,
      width: null,
      height: null,
      estimatedHours: source?.estimatedHours ?? null,
      priceHintHt: source?.priceHintHt ?? null,
      family: source?.family ?? null,
      libraryId: source?.libraryId ?? null,
      technicalNotes: source?.technicalNotes ?? "",
      constraints: "",
      variants: "",
      attentionPoints: "",
    };
    setDraft((current) => ({
      ...current,
      lines: [
        ...current.lines,
        ...(shouldCreateSection ? [{ id: sectionId, type: "section" as const, parentId: null, title: "Nouvelle section", unit: "u" as const, quantity: 0, manualQuantity: false, technicalNotes: "", constraints: "", variants: "", attentionPoints: "" }] : []),
        line,
      ],
    }));
    setSelectedLineId(line.id);
    setStep("estimating");
  }

  function addFromLibrary(template: TaskTemplateRow) {
    addTask({
      title: template.titre,
      unit: normalizeUnit(template.unite),
      quantity: template.quantite_defaut ?? 0,
      manualQuantity: Boolean(template.quantite_defaut),
      estimatedHours: template.temps_prevu_par_unite_h,
      priceHintHt: template.cout_reference_unitaire_ht,
      family: template.lot,
      libraryId: template.id,
      technicalNotes: template.description_technique ?? template.remarques ?? "",
    });
  }

  function removeLine(id: string) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.filter((line) => line.id !== id && line.parentId !== id),
      attachments: current.attachments.filter((attachment) => attachment.targetLineId !== id),
    }));
    setSelectedLineId(null);
  }

  function addFiles(files: FileList | null, kind: "photo" | "document") {
    if (!files?.length) return;
    const attachments = Array.from(files).map((file) => ({
      id: uid(kind),
      kind,
      name: file.name,
      targetLineId: selectedLineId,
      comment: "",
      previewUrl: kind === "photo" ? URL.createObjectURL(file) : undefined,
      file,
      mimeType: file.type || null,
      sizeBytes: file.size,
    }));
    setDraft((current) => ({ ...current, attachments: [...current.attachments, ...attachments] }));
  }

  async function saveVisit(status: VisitStatus) {
    setSaving(true);
    try {
      const startsAt = new Date(`${draft.date}T${draft.time || "09:00"}:00`);
      const endsAt = new Date(startsAt.getTime() + Number(draft.durationMinutes || 90) * 60_000);
      const nextDraft = { ...draft, status };
      const serializedDraft = serializeDraft(nextDraft);
      const quoteSource = { needDescription: serializedDraft.needDescription, lines: serializedDraft.lines };
      const opportunity = project.opportunity ?? (project.prospect ? await createOpportunityForProspect(project.prospect, { stage_key: "visite", probabilite: 40, prochaine_action: "Finaliser le compte rendu de visite" }) : null);
      const targetProjectId = opportunity ? `opportunity-${opportunity.id}` : project.id;
      if (status === "pre_devis") {
        localStorage.setItem(`batipro.project-quote-source.${targetProjectId}`, JSON.stringify(quoteSource));
      }
      const payload = {
        prospect_id: project.prospect?.id ?? null,
        client_id: project.client?.id ?? null,
        opportunity_id: opportunity?.id ?? null,
        type: appointmentTypeFor(status),
        titre: `Visite chiffrage - ${project.name}`,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        statut: appointmentStatusFor(status),
        notes: `Visite terrain Batipro${VISIT_DRAFT_MARKER}${JSON.stringify(serializedDraft)}`,
        compte_rendu: buildReport(project, nextDraft),
      };
      const appointmentToUpdate = currentAppointment ?? existingAppointment ?? null;
      const savedAppointment = appointmentToUpdate ? await updateCrmAppointment(appointmentToUpdate.id, payload) : await createCrmAppointment(payload);
      setCurrentAppointment(savedAppointment);
      try {
        await saveCrmVisitReport({
          appointment_id: savedAppointment.id,
          prospect_id: project.prospect?.id ?? null,
          client_id: project.client?.id ?? null,
          opportunity_id: opportunity?.id ?? null,
          status,
          client_name: nextDraft.client,
          phone: nextDraft.phone,
          email: nextDraft.email,
          address: nextDraft.address,
          contact_on_site: nextDraft.contactOnSite,
          visit_date: nextDraft.date,
          visit_time: nextDraft.time,
          duration_minutes: nextDraft.durationMinutes,
          salesperson: nextDraft.salesperson,
          project_type: nextDraft.projectType,
          client_objective: nextDraft.clientObjective,
          need_description: nextDraft.needDescription,
          urgency: nextDraft.urgency,
          desired_deadline: nextDraft.desiredDeadline,
          zones: nextDraft.zones,
          constraints: { access: nextDraft.access, parking: nextDraft.parking, floor: nextDraft.floor, condominium: nextDraft.condominium, schedule: nextDraft.schedule, nuisance: nextDraft.nuisance, safety: nextDraft.safety, waste: nextDraft.waste, water: nextDraft.water, electricity: nextDraft.electricity, authorizations: nextDraft.authorizations, notes: nextDraft.constraintNotes },
          budget: { known: nextDraft.budgetKnown, range: nextDraft.budgetRange, priceSensitivity: nextDraft.priceSensitivity, decisionMaker: nextDraft.decisionMaker, decisionOnSite: nextDraft.decisionOnSite, objections: nextDraft.objections },
          next_action: nextDraft.nextAction,
          follow_up_date: nextDraft.followUpDate,
          report_text: buildReport(project, nextDraft),
          quote_source: quoteSource,
          lines: nextDraft.lines,
          attachments: nextDraft.attachments,
        });
      } catch (error) {
        console.warn("Sauvegarde visite structuree indisponible, fallback rendez-vous conserve", error);
      }
      if (opportunity) {
        await updateCrmOpportunityStageByKey(opportunity.id, opportunityStageForVisitStatus(status), {
          prochaine_action: opportunityNextActionFor(status),
          prochaine_action_date: status === "realisee" || status === "pre_devis" ? nextDraft.followUpDate || null : nextDraft.date,
        });
      }
      setDraft(nextDraft);
      setSaveState("saved");
      if (status === "brouillon") return;
      localStorage.removeItem(storageKey);
      navigate(status === "pre_devis" ? `/projets/${targetProjectId}/devis/nouveau` : `/projets/${targetProjectId}/visites/${savedAppointment.id}/preparation-devis`);
    } catch (error) {
      console.error("Erreur sauvegarde visite terrain", error);
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  function renderMeasurements(line: EstimateLine) {
    if (line.type !== "task") return null;
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Unite">
          <select className={inputClass} value={line.unit} onChange={(event) => patchLine(line.id, { unit: event.target.value as Unit, manualQuantity: false })}>
            <option value="u">U</option>
            <option value="ml">ml</option>
            <option value="m2">m2</option>
            <option value="m3">m3</option>
            <option value="h">h</option>
          </select>
        </Field>
        {line.unit === "u" || line.unit === "h" ? (
          <Field label={line.unit === "h" ? "Heures" : "Quantite"}>
            <input className={inputClass} inputMode="decimal" value={numericValue(line, "quantity", line.quantity)} onChange={(event) => patchNumericLine(line.id, "quantity", event.target.value, { manualQuantity: true })} onBlur={() => commitNumericLine(line.id, "quantity")} />
          </Field>
        ) : null}
        {["ml", "m2", "m3"].includes(line.unit) ? (
          <Field label="Longueur">
            <input className={inputClass} inputMode="decimal" value={numericValue(line, "length", line.length)} onChange={(event) => patchNumericLine(line.id, "length", event.target.value, { manualQuantity: false })} onBlur={() => commitNumericLine(line.id, "length")} />
          </Field>
        ) : null}
        {["m2", "m3"].includes(line.unit) ? (
          <Field label="Largeur">
            <input className={inputClass} inputMode="decimal" value={numericValue(line, "width", line.width)} onChange={(event) => patchNumericLine(line.id, "width", event.target.value, { manualQuantity: false })} onBlur={() => commitNumericLine(line.id, "width")} />
          </Field>
        ) : null}
        {line.unit === "m3" ? (
          <Field label="Hauteur">
            <input className={inputClass} inputMode="decimal" value={numericValue(line, "height", line.height)} onChange={(event) => patchNumericLine(line.id, "height", event.target.value, { manualQuantity: false })} onBlur={() => commitNumericLine(line.id, "height")} />
          </Field>
        ) : null}
        {["ml", "m2", "m3"].includes(line.unit) ? (
          <Field label="Quantite calculee / forcee">
            <input className={inputClass} inputMode="decimal" value={numericValue(line, "quantity", line.quantity)} onChange={(event) => patchNumericLine(line.id, "quantity", event.target.value, { manualQuantity: true })} onBlur={() => commitNumericLine(line.id, "quantity")} />
          </Field>
        ) : null}
      </div>
    );
  }

  function ActionButtons() {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={saving} onClick={() => saveVisit("brouillon")}><Save className="h-4 w-4" />Enregistrer</Button>
        <Button variant="success" disabled={saving} onClick={() => saveVisit("realisee")}><CheckCircle2 className="h-4 w-4" />Terminer visite</Button>
        <Button variant="primary" disabled={saving} onClick={() => saveVisit("pre_devis")}><FileText className="h-4 w-4" />Creer pre-devis</Button>
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-0">
      <header className="sticky top-0 z-30 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:mb-5 md:rounded-3xl md:border md:p-5 md:shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/projets/${project.id}?tab=visits`} className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              Retour projet
            </Link>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Visite terrain / chiffrage</div>
            <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-950 md:text-3xl">{project.name}</h1>
            <p className="mt-1 truncate text-sm text-slate-500">{draft.client} - {draft.address || "Adresse a renseigner"}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{saveState === "saved" ? "enregistre" : saveState === "error" ? "erreur" : draft.status}</span>
            <div className="hidden lg:block"><ActionButtons /></div>
            <div className="lg:hidden"><Button size="sm" variant="secondary" disabled={saving} onClick={() => saveVisit("brouillon")}><Save className="h-4 w-4" />Enregistrer</Button></div>
          </div>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {steps.map((item) => (
            <button key={item.key} type="button" onClick={() => setStep(item.key)} className={["shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition", step === item.key ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"].join(" ")}>{item.label}</button>
          ))}
        </nav>
      </header>

      <main className="space-y-4">
        {step === "info" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Client"><input className={inputClass} value={draft.client} onChange={(event) => patch("client", event.target.value)} /></Field>
              <Field label="Telephone"><input className={inputClass} value={draft.phone} onChange={(event) => patch("phone", event.target.value)} /></Field>
              <Field label="Email"><input className={inputClass} value={draft.email} onChange={(event) => patch("email", event.target.value)} /></Field>
              <Field label="Adresse RDV"><input className={inputClass} value={draft.address} onChange={(event) => patch("address", event.target.value)} /></Field>
              <Field label="Contact sur place"><input className={inputClass} value={draft.contactOnSite} onChange={(event) => patch("contactOnSite", event.target.value)} /></Field>
              <Field label="Date"><input type="date" className={inputClass} value={draft.date} onChange={(event) => patch("date", event.target.value)} /></Field>
              <Field label="Heure"><input type="time" className={inputClass} value={draft.time} onChange={(event) => patch("time", event.target.value)} /></Field>
              <Field label="Duree minutes"><input className={inputClass} inputMode="numeric" value={draft.durationMinutes} onChange={(event) => patch("durationMinutes", Number(event.target.value) || 90)} /></Field>
              <Field label="Commercial"><input className={inputClass} value={draft.salesperson} onChange={(event) => patch("salesperson", event.target.value)} /></Field>
            </div>
          </section>
        ) : null}

        {step === "description" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Type projet"><input className={inputClass} value={draft.projectType} onChange={(event) => patch("projectType", event.target.value)} /></Field>
              <Field label="Urgence"><input className={inputClass} value={draft.urgency} onChange={(event) => patch("urgency", event.target.value)} /></Field>
              <Field label="Delai souhaite"><input type="date" className={inputClass} value={draft.desiredDeadline} onChange={(event) => patch("desiredDeadline", event.target.value)} /></Field>
              <Field label="Zones concernees"><input className={inputClass} value={draft.zones} onChange={(event) => patch("zones", event.target.value)} /></Field>
              <Field label="Objectif client"><textarea className={textareaClass} value={draft.clientObjective} onChange={(event) => patch("clientObjective", event.target.value)} /></Field>
              <Field label="Description besoin"><textarea className={textareaClass} value={draft.needDescription} onChange={(event) => patch("needDescription", event.target.value)} /></Field>
            </div>
          </section>
        ) : null}

        {step === "estimating" ? (
          <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
            <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:self-start">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950"><Library className="h-4 w-4" />Bibliotheque metier</div>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
                  <input className={`${inputClass} pl-9`} placeholder="Famille, metier, mot-cle" value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} />
                </div>
                <select className={inputClass} value={libraryFamily} onChange={(event) => setLibraryFamily(event.target.value)}>
                  <option value="__ALL__">Toutes familles</option>
                  {families.map((family) => <option key={family} value={family}>{family}</option>)}
                </select>
              </div>
              <div className="mt-3 space-y-2">
                {filteredLibrary.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Aucune tache.</div> : filteredLibrary.map((item) => (
                  <button key={item.id} type="button" onClick={() => addFromLibrary(item)} className="w-full rounded-2xl border border-slate-200 p-3 text-left text-sm hover:border-blue-200 hover:bg-blue-50">
                    <div className="font-semibold text-slate-950">{item.titre}</div>
                    <div className="text-xs text-slate-500">{item.lot ?? "Sans famille"} - {item.unite ?? "u"}</div>
                  </button>
                ))}
              </div>
            </aside>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Terrain / pre-devis</div>
                  <h2 className="mt-1 text-lg font-semibold text-slate-950">Sections et taches</h2>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => addSection()}><Plus className="h-4 w-4" />Section</Button>
                  <Button variant="secondary" onClick={() => addTask()}><Plus className="h-4 w-4" />Tache</Button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {sections.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Creez une section ou ajoutez directement une tache.</div>
                ) : sections.map((section) => {
                  const children = tasks.filter((task) => task.parentId === section.id);
                  return (
                    <article key={section.id} className="overflow-hidden rounded-2xl border border-slate-200">
                      <button type="button" onClick={() => setSelectedLineId(section.id)} className={["flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left", selectedLineId === section.id ? "ring-2 ring-blue-200" : ""].join(" ")}>
                        <span className="font-semibold text-slate-950">{section.title}</span>
                        <span className="text-xs text-slate-500">{children.length} tache(s)</span>
                      </button>
                      <div className="divide-y divide-slate-100">
                        {children.map((task) => (
                          <button key={task.id} type="button" onClick={() => setSelectedLineId(task.id)} className={["block w-full p-4 text-left hover:bg-slate-50", selectedLineId === task.id ? "bg-blue-50" : "bg-white"].join(" ")}>
                            <div className="font-semibold text-slate-950">{task.title}</div>
                            <div className="mt-1 text-sm text-slate-500">{quantity(task)} {task.unit} {task.family ? `- ${task.family}` : ""}</div>
                            {task.technicalNotes ? <div className="mt-1 line-clamp-2 text-xs text-slate-500">{task.technicalNotes}</div> : null}
                          </button>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:self-start">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-950">Detail</div>
                {selectedLine ? <button type="button" onClick={() => removeLine(selectedLine.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button> : null}
              </div>
              {selectedLine ? (
                <div className="space-y-3">
                  <Field label="Designation"><input className={inputClass} value={selectedLine.title} onChange={(event) => patchLine(selectedLine.id, { title: event.target.value })} /></Field>
                  {selectedLine.type === "task" ? (
                    <>
                      {renderMeasurements(selectedLine)}
                      <Field label="Temps estime / prix indicatif">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input className={inputClass} inputMode="decimal" placeholder="h" value={numericValue(selectedLine, "estimatedHours", selectedLine.estimatedHours)} onChange={(event) => patchNumericLine(selectedLine.id, "estimatedHours", event.target.value)} onBlur={() => commitNumericLine(selectedLine.id, "estimatedHours")} />
                          <input className={inputClass} inputMode="decimal" placeholder="EUR HT" value={numericValue(selectedLine, "priceHintHt", selectedLine.priceHintHt)} onChange={(event) => patchNumericLine(selectedLine.id, "priceHintHt", event.target.value)} onBlur={() => commitNumericLine(selectedLine.id, "priceHintHt")} />
                        </div>
                      </Field>
                      <Field label="Notes techniques"><textarea className={textareaClass} value={selectedLine.technicalNotes} onChange={(event) => patchLine(selectedLine.id, { technicalNotes: event.target.value })} /></Field>
                      <Field label="Contraintes / observations"><textarea className={textareaClass} value={selectedLine.constraints} onChange={(event) => patchLine(selectedLine.id, { constraints: event.target.value })} /></Field>
                      <Field label="Variantes / points d'attention"><textarea className={textareaClass} value={selectedLine.variants || selectedLine.attentionPoints} onChange={(event) => patchLine(selectedLine.id, { variants: event.target.value })} /></Field>
                    </>
                  ) : null}
                  <FileCapture onFiles={addFiles} />
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Selectionnez une section ou une tache.</div>
              )}
            </aside>
          </section>
        ) : null}

        {step === "constraints" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[["Acces", "access"], ["Stationnement", "parking"], ["Etage", "floor"], ["Copropriete", "condominium"], ["Horaires", "schedule"], ["Nuisances", "nuisance"], ["Securite", "safety"], ["Evacuation gravats", "waste"], ["Alimentation eau", "water"], ["Alimentation electrique", "electricity"], ["Autorisations", "authorizations"]].map(([label, key]) => (
                <Field key={key} label={label}>
                  <input className={inputClass} value={String(draft[key as keyof VisitDraft] ?? "")} onChange={(event) => patch(key as keyof VisitDraft, event.target.value as never)} />
                </Field>
              ))}
              <div className="xl:col-span-3"><Field label="Remarques contraintes"><textarea className={textareaClass} value={draft.constraintNotes} onChange={(event) => patch("constraintNotes", event.target.value)} /></Field></div>
            </div>
          </section>
        ) : null}

        {step === "budget" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Budget client connu"><input className={inputClass} value={draft.budgetKnown} onChange={(event) => patch("budgetKnown", event.target.value)} /></Field>
              <Field label="Fourchette budget"><input className={inputClass} value={draft.budgetRange} onChange={(event) => patch("budgetRange", event.target.value)} /></Field>
              <Field label="Sensibilite prix"><input className={inputClass} value={draft.priceSensitivity} onChange={(event) => patch("priceSensitivity", event.target.value)} /></Field>
              <Field label="Decisionnaire"><input className={inputClass} value={draft.decisionMaker} onChange={(event) => patch("decisionMaker", event.target.value)} /></Field>
              <Field label="Decision prise sur place ?"><input className={inputClass} value={draft.decisionOnSite} onChange={(event) => patch("decisionOnSite", event.target.value)} /></Field>
              <Field label="Date relance"><input type="date" className={inputClass} value={draft.followUpDate} onChange={(event) => patch("followUpDate", event.target.value)} /></Field>
              <Field label="Objections"><textarea className={textareaClass} value={draft.objections} onChange={(event) => patch("objections", event.target.value)} /></Field>
              <Field label="Prochaine action"><textarea className={textareaClass} value={draft.nextAction} onChange={(event) => patch("nextAction", event.target.value)} /></Field>
            </div>
          </section>
        ) : null}

        {step === "summary" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Sections</div><div className="text-2xl font-bold">{sections.length}</div></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Taches</div><div className="text-2xl font-bold">{tasks.length}</div></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Photos</div><div className="text-2xl font-bold">{draft.attachments.filter((item) => item.kind === "photo").length}</div></div>
              <div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Documents</div><div className="text-2xl font-bold">{draft.attachments.filter((item) => item.kind === "document").length}</div></div>
            </div>
            <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{report}</pre>
            <div className="mt-4"><ActionButtons /></div>
          </section>
        ) : null}
      </main>

      {step === "estimating" ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:hidden">
          <div className="grid grid-cols-4 gap-2">
            <button type="button" onClick={() => addSection()} className="rounded-xl bg-slate-950 px-2 py-3 text-xs font-semibold text-white">+ Section</button>
            <button type="button" onClick={() => addTask()} className="rounded-xl bg-blue-600 px-2 py-3 text-xs font-semibold text-white">+ Tache</button>
            <label className="rounded-xl border border-slate-200 px-2 py-3 text-center text-xs font-semibold text-slate-900">
              + Photo
              <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event: ChangeEvent<HTMLInputElement>) => addFiles(event.target.files, "photo")} />
            </label>
            <button type="button" onClick={() => setStep("summary")} className="rounded-xl border border-slate-200 px-2 py-3 text-xs font-semibold text-slate-900">Synthese</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
