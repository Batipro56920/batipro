import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera, CheckCircle2, FileText, Mic, Plus, Save, Trash2, Upload } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { createCrmAppointment, type CrmAppointmentRow } from "../../../services/crm.service";
import { loadCrmVisitReportDraft, saveCrmVisitReport } from "../../../services/crmVisitReports.service";
import { createOpportunityForProspect, updateCrmAppointment, updateCrmOpportunityStageByKey } from "../../../services/crmWorkflow.service";
import { list as listTaskTemplates, type TaskTemplateRow } from "../../../services/taskLibrary.service";
import { loadTaskTemplateUnitCosts } from "../../../services/taskTemplateComputedCost";
import VisitTaskPickerDialog from "./VisitTaskPickerDialog";
import SubcontractorQuoteImportDialog, { type SubcontractedTaskDraft } from "./SubcontractorQuoteImportDialog";
import { listIntervenants, type IntervenantRow } from "../../../services/intervenants.service";
import { listTaskTemplatePreparationByTemplateIds, type TaskTemplateEquipmentItemRow, type TaskTemplateMaterialRatioRow } from "../../../services/taskTemplatePreparation.service";
import { getCompanyHourlyRates, type CompanyHourlyRates } from "../../../services/indirectCosts.service";
import { taskTemplateUnitCost, taskTemplateUnitSale } from "../../../services/taskCostBasis";
import { VISIT_DRAFT_MARKER } from "../../crm/utils/appointmentDraftStorage";
import type { ProjectRecord } from "../types";
import { VisitReportImportDrawer, type VisitImportSelection } from "./VisitReportImportDrawer";
import { applyImportedFields, buildLinesFromImport } from "./applyVisitImport";

type StepKey = "info" | "description" | "architecture" | "estimating" | "photos" | "constraints" | "budget" | "summary";
type VisitStatus = "brouillon" | "planifiee" | "realisee" | "pre_devis";
type Unit = "u" | "ml" | "m2" | "m3" | "h";
type LineType = "section" | "task";

/** Mesure d'une piece retenue pour une ligne : ce qui est reellement concerne. */
export type ZoneMeasure = "sol" | "plafond" | "murs" | "plinthes" | "volume" | "unite";

export type ZoneLink = {
  roomId: string;
  roomName: string;
  measure: ZoneMeasure;
  /** Quantite retenue : la mesure calculee, ou celle ajustee au reel. */
  value: number;
};

/**
 * Section confiee a un sous-traitant. Son devis (ou son prix) est le debourse ;
 * la marge choisie fait le prix de vente. Chaque tache de la section porte le
 * prix du sous-traitant par unite, et c'est tout : pas de main d'oeuvre a nous,
 * pas de materiaux, pas de frais generaux a recompter.
 */
export type SubcontractingSection = {
  intervenantId: string | null;
  name: string;
  marginRate: number;
  /** Montant HT du devis du sous-traitant, pour controler que les taches le couvrent. */
  quoteTotalHt: number | null;
};

type EstimateLine = {
  id: string;
  type: LineType;
  parentId: string | null;
  title: string;
  /** Section sous-traitee : qui, a quelle marge. Null = travaux a nous. */
  subcontracting?: SubcontractingSection | null;
  /** Tache d'une section sous-traitee : prix du sous-traitant HT par unite. */
  subcontractorUnitCostHt?: number | null;
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
  /**
   * Modèle de tâche rattaché. La désignation reste l'intitulé précis annoncé au
   * client ; la tâche liée porte le geste technique et transporte main d'oeuvre,
   * matériaux, matériel, pertes et temps jusqu'au devis puis au chantier.
   */
  taskTemplateId?: string | null;
  taskTemplateLabel?: string | null;
  /**
   * Toutes les taches liees a la ligne. taskTemplateId reste la premiere :
   * le devis puis le chantier la lisent deja sous ce nom.
   */
  zoneLinks?: ZoneLink[] | null;
  taskTemplateIds?: string[] | null;
  taskTemplateLabels?: string[] | null;
  /**
   * Quantite propre a chaque tache liee, alignee sur taskTemplateIds.
   * null = la tache suit la quantite de la ligne.
   */
  taskTemplateQuantities?: Array<number | null> | null;
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
  architecture: ArchitectureRoom[];
  lines: EstimateLine[];
  attachments: VisitAttachment[];
};

/**
 * Une piece relevee sur place. Les surfaces ne sont jamais saisies : elles se
 * deduisent des trois dimensions, avec ce qu'il faut retirer pour les
 * ouvertures (murs) et les passages de porte (plinthes).
 */
export type ArchitectureRoom = {
  id: string;
  name: string;
  length: number | null;
  width: number | null;
  height: number | null;
  openingsM2: number | null;
  skirtingDeductionMl: number | null;
};

function positive(value: number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export const ZONE_MEASURES: Array<{ key: ZoneMeasure; label: string; unit: Unit }> = [
  { key: "sol", label: "Sol", unit: "m2" },
  { key: "plafond", label: "Plafond", unit: "m2" },
  { key: "murs", label: "Murs", unit: "m2" },
  { key: "plinthes", label: "Plinthes", unit: "ml" },
  { key: "volume", label: "Volume", unit: "m3" },
  { key: "unite", label: "A l'unite", unit: "u" },
];

export function roomMetrics(room: ArchitectureRoom) {
  const length = positive(room.length);
  const width = positive(room.width);
  const height = positive(room.height);
  const floor = length * width;
  const perimeter = 2 * (length + width);
  return {
    floor,
    ceiling: floor,
    perimeter,
    walls: Math.max(0, perimeter * height - positive(room.openingsM2)),
    skirting: Math.max(0, perimeter - positive(room.skirtingDeductionMl)),
    volume: floor * height,
  };
}

export function measureValue(room: ArchitectureRoom, measure: ZoneMeasure): number {
  const metrics = roomMetrics(room);
  if (measure === "sol") return metrics.floor;
  if (measure === "plafond") return metrics.ceiling;
  if (measure === "murs") return metrics.walls;
  if (measure === "plinthes") return metrics.skirting;
  if (measure === "volume") return metrics.volume;
  return 1;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

const steps: Array<{ key: StepKey; label: string }> = [
  { key: "info", label: "Infos" },
  { key: "description", label: "Projet" },
  { key: "architecture", label: "Architecture" },
  { key: "estimating", label: "Terrain / pre-devis" },
  { key: "photos", label: "Photos" },
  { key: "constraints", label: "Contraintes" },
  { key: "budget", label: "Budget" },
  { key: "summary", label: "Synthese" },
];

const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const textareaClass = "min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function uid(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function decimal(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const compact = raw.replace(/\s/g, "");
  const normalized = compact.includes(",") ? compact.replace(/\./g, "").replace(",", ".") : compact;
  const next = Number(normalized);
  return Number.isFinite(next) ? next : null;
}

function DecimalInput({ value, onValue, placeholder, className }: { value: number | null | undefined; onValue: (value: number | null) => void; placeholder?: string; className?: string }) {
  const [focused, setFocused] = useState(false);
  const [display, setDisplay] = useState(value === null || value === undefined ? "" : String(value));

  useEffect(() => {
    if (!focused) setDisplay(value === null || value === undefined ? "" : String(value));
  }, [focused, value]);

  return (
    <input
      className={className ?? inputClass}
      inputMode="decimal"
      pattern={"[0-9\\s,.]*"}
      placeholder={placeholder}
      value={display}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const next = decimal(display);
        setDisplay(next === null ? "" : String(next));
        onValue(next);
      }}
      onChange={(event) => {
        const raw = event.target.value;
        setDisplay(raw);
        if (!raw.trim()) {
          onValue(null);
          return;
        }
        const next = decimal(raw);
        if (next !== null) onValue(next);
      }}
    />
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
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

function euro(value: number) {
  return `${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

/**
 * Toutes les taches liees a une ligne, l'ancien champ unique compris : un
 * releve enregistre avant le multi-lien doit continuer a s'ouvrir tel quel.
 */
function lineTemplateIds(line: Pick<EstimateLine, "taskTemplateIds" | "taskTemplateId">): string[] {
  const list = Array.isArray(line.taskTemplateIds) ? line.taskTemplateIds : [];
  const clean = list.map((value) => String(value ?? "").trim()).filter(Boolean);
  if (clean.length) return Array.from(new Set(clean));
  const single = String(line.taskTemplateId ?? "").trim();
  return single ? [single] : [];
}

/**
 * Quantites des taches liees, alignees sur les identifiants fournis. Une
 * position sans valeur reste nulle : la tache suit alors la ligne.
 */
function lineTemplateQuantities(
  line: Pick<EstimateLine, "taskTemplateQuantities">,
  ids: string[],
): Array<number | null> {
  const list = Array.isArray(line.taskTemplateQuantities) ? line.taskTemplateQuantities : [];
  return ids.map((_, index) => {
    const value = Number(list[index] ?? NaN);
    return Number.isFinite(value) ? value : null;
  });
}

/**
 * Une estimation suit encore le calcul automatique tant qu'elle est vide ou
 * qu'elle vaut exactement ce que le calcul avait pose la derniere fois. Des
 * que le commercial ecrit son propre chiffre, on ne le touche plus.
 */
function followsAutoValue(current: number | null | undefined, lastAutomatic: number | null): boolean {
  const value = Number(current ?? 0);
  if (!value) return true;
  if (lastAutomatic === null) return false;
  return Math.abs(value - lastAutomatic) < 0.005;
}

function sameEstimate(current: number | null | undefined, next: number): boolean {
  return Math.abs(Number(current ?? 0) - next) < 0.005;
}

/** La sous-traitance d'une ligne : la sienne (section) ou celle de sa section (tache). */
function subcontractingFor(line: EstimateLine, lines: EstimateLine[]): SubcontractingSection | null {
  if (line.type === "section") return line.subcontracting ?? null;
  const parent = line.parentId ? lines.find((entry) => entry.id === line.parentId) ?? null : null;
  return parent?.subcontracting ?? null;
}

/** Prix de vente d'une unite sous-traitee : le prix du sous-traitant majore de la marge. */
function subcontractedSalePrice(unitCost: number | null | undefined, marginRate: number): number | null {
  const cost = Number(unitCost ?? 0);
  if (!(cost > 0)) return null;
  return round2(cost * (1 + Math.max(0, Number(marginRate) || 0) / 100));
}

function subcontractorLabel(row: IntervenantRow): string {
  const company = String(row.subcontractor_company ?? row.entreprise ?? "").trim();
  return company && company !== row.nom ? `${row.nom} — ${company}` : row.nom;
}
type LinkedTaskEntry = {
  template: TaskTemplateRow;
  materials: TaskTemplateMaterialRatioRow[];
  equipment: TaskTemplateEquipmentItemRow[];
  /** Quantite retenue pour cette tache : celle saisie, sinon celle de la ligne. */
  quantity: number;
};

/** Cout par unite d'une tache liee, avec la base de chiffrage commune. */
function linkedTaskCost(entry: LinkedTaskEntry, rates: CompanyHourlyRates | null) {
  const basis = taskTemplateUnitCost(entry.template, entry.materials, rates);
  return {
    hoursPerUnit: basis.hours,
    laborPerUnit: basis.laborHt,
    materialsPerUnit: basis.materialsHt,
    indirectPerUnit: basis.indirectHt,
    costPerUnit: basis.costHt,
  };
}

/**
 * Ce que les taches liees apportent a la ligne. Un intitule annonce au client
 * ("remplacement complet du TGBT") demande souvent plusieurs gestes de la
 * bibliotheque, et pas forcement dans la meme quantite : chaque tache est
 * comptee avec la sienne, puis le total est ramene a l'unite de la ligne.
 */
function LinkedTaskSummary({
  entries,
  rates,
  unit,
  quantity: measuredQuantity,
}: {
  entries: LinkedTaskEntry[];
  rates: CompanyHourlyRates | null;
  unit: string;
  quantity: number;
}) {
  if (!entries.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        Sans tache liee, cette ligne partira au devis en texte libre : ni main d'oeuvre, ni materiaux, ni mode operatoire ne suivront jusqu'au chantier.
      </p>
    );
  }

  const perTask = entries.map((entry) => {
    const unitCost = linkedTaskCost(entry, rates);
    const count = entry.quantity > 0 ? entry.quantity : 0;
    return {
      entry,
      count,
      hours: unitCost.hoursPerUnit * count,
      labor: unitCost.laborPerUnit * count,
      materials: unitCost.materialsPerUnit * count,
      indirect: unitCost.indirectPerUnit * count,
      cost: unitCost.costPerUnit * count,
    };
  });
  const totalHours = perTask.reduce((total, row) => total + row.hours, 0);
  const totalLabor = perTask.reduce((total, row) => total + row.labor, 0);
  const totalMaterials = perTask.reduce((total, row) => total + row.materials, 0);
  const totalIndirect = perTask.reduce((total, row) => total + row.indirect, 0);
  // Les frais generaux sont deja dans la main d'oeuvre : les additionner ici
  // les compterait deux fois.
  const totalCost = totalLabor + totalMaterials;
  const materialLines = entries.reduce((total, entry) => total + entry.materials.length, 0);
  const equipmentNames = Array.from(
    new Set(entries.flatMap((entry) => entry.equipment.map((item) => item.equipment_name).filter(Boolean))),
  );

  const rows: Array<[string, string]> = [
    ["Main d'oeuvre (frais generaux inclus)", `${totalHours.toLocaleString("fr-FR")} h = ${euro(totalLabor)}`],
    ["Materiaux (pertes incluses)", `${materialLines} ligne(s) = ${euro(totalMaterials)}`],
    ["Materiel", equipmentNames.length ? equipmentNames.join(", ") : "aucun"],
    ["dont frais generaux", `${euro(totalIndirect)} (compris dans la main d'oeuvre)`],
  ];

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-700">
        {entries.length > 1 ? `Ce que les ${entries.length} taches apportent` : "Ce que la tache apporte"}
      </div>
      <dl className="mt-2 space-y-1 text-xs text-slate-700">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="shrink-0 text-slate-500">{label}</dt>
            <dd className="text-right font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {entries.length > 1 ? (
        <div className="mt-2 space-y-1 border-t border-blue-200 pt-2 text-[11px] text-slate-600">
          {perTask.map((row) => (
            <div key={row.entry.template.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate" title={row.entry.template.titre}>{row.entry.template.titre}</span>
              <span className="shrink-0 font-medium">
                {row.count.toLocaleString("fr-FR")} {normalizeVisitUnit(row.entry.template.unite) ?? (unit || "u")} · {euro(row.cost)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-2 flex justify-between border-t border-blue-200 pt-2 text-xs font-semibold text-slate-900">
        <span>Cout total des taches liees</span>
        <span>{euro(totalCost)}</span>
      </div>
      {measuredQuantity > 0 ? (
        <div className="flex justify-between text-xs font-semibold text-blue-800">
          <span>Prix de revient / {unit || "u"}</span>
          <span>{euro(totalCost / measuredQuantity)}</span>
        </div>
      ) : null}
      {!rates?.productiveEmployeeCount ? (
        <p className="mt-2 text-[11px] text-amber-700">Aucun salarie avec un cout horaire renseigne : le cout de main d'oeuvre ressort a 0.</p>
      ) : null}
    </div>
  );
}

/**
 * Postgres renvoie l'heure en "HH:MM:SS" alors que le formulaire écrit "HH:MM" :
 * recoller les deux naïvement donnait "2026-09-08T09:00:00:00", une date
 * invalide qui faisait échouer tout ré-enregistrement d'une visite déjà en base.
 */
function visitStartDate(date: string, time: string): Date {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(date ?? "").trim()) ? date.trim() : today();
  const match = String(time ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  const hour = match ? String(match[1]).padStart(2, "0") : "09";
  const minute = match ? match[2] : "00";
  const parsed = new Date(`${day}T${hour}:${minute}:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

/**
 * Empreinte du brouillon, pièces jointes non montées comprises. Elle sert à ne
 * déclencher un auto-enregistrement que si quelque chose a réellement changé :
 * sans elle, chaque sauvegarde relançait la suivante en boucle.
 */
function draftSignature(draft: VisitDraft): string {
  const attachments = draft.attachments.map((item) => {
    const state = item.storagePath || (item.file ? "local" : "");
    return [item.id, state, item.comment, item.targetLineId || ""].join("|");
  });
  return JSON.stringify({ ...serializeDraft(draft), attachments });
}

function readErrorMessage(error: unknown): string {
  const raw = (error as { message?: unknown } | null)?.message ?? error;
  const message = String(raw ?? "").trim();
  if (!message || message === "[object Object]") return "Enregistrement refusé par le serveur.";
  if (message.toLowerCase().includes("bucket not found")) return "Stockage des photos indisponible : prévenez l'administrateur.";
  return message;
}

/**
 * Les unités de la bibliothèque sont plus larges que celles du relevé terrain,
 * et rarement écrites à l'identique : un modèle dit "unité" là où le relevé
 * attend "u". Sans cette traduction, l'unité du modèle était perdue.
 */
function normalizeVisitUnit(unit: string | null | undefined): Unit | null {
  const value = String(unit ?? "")
    .replace("²", "2")
    .replace("³", "3")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

  if (["u", "unite", "unites", "pce", "piece", "pieces", "ens", "ensemble", "forfait"].includes(value)) return "u";
  if (["ml", "m", "metre lineaire", "metres lineaires", "metre", "metres"].includes(value)) return "ml";
  if (["m2", "m 2"].includes(value)) return "m2";
  if (["m3", "m 3"].includes(value)) return "m3";
  if (["h", "heure", "heures"].includes(value)) return "h";
  return null;
}

function appointmentVisitStatus(appointment?: CrmAppointmentRow | null): VisitStatus {
  if (!appointment) return "planifiee";
  if (appointment.type.includes("pre_devis")) return "pre_devis";
  if (appointment.statut === "realise") return "realisee";
  return "planifiee";
}

function normalizeVisitStatus(status: string | null | undefined): VisitStatus {
  if (status === "planifiee" || status === "realisee" || status === "pre_devis" || status === "brouillon") return status;
  return "planifiee";
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

function initialDraft(project: ProjectRecord, appointment?: CrmAppointmentRow | null): VisitDraft {
  const start = appointment ? new Date(appointment.starts_at) : null;
  const stored = parseStoredDraft(appointment?.notes) ?? parseStoredDraft(appointment?.compte_rendu);
  const base: VisitDraft = {
    status: appointmentVisitStatus(appointment),
    client: project.clientName,
    phone: project.contactPhone ?? "",
    email: project.contactEmail ?? "",
    address: project.address ?? "",
    contactOnSite: project.clientName,
    date: start ? start.toISOString().slice(0, 10) : today(),
    time: start ? start.toTimeString().slice(0, 5) : "09:00",
    durationMinutes: appointment?.ends_at ? Math.max(30, Math.round((new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60000)) : 90,
    salesperson: project.salesperson ?? "",
    projectType: project.projectType ?? "",
    clientObjective: "",
    needDescription: project.needDescription ?? "",
    urgency: project.prospect?.urgence ?? "",
    desiredDeadline: project.desiredDeadline ?? "",
    zones: "",
    architecture: [],
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
  return stored ? { ...base, ...stored, lines: stored.lines ?? base.lines, attachments: stored.attachments ?? base.attachments } : base;
}

function serializeDraft(draft: VisitDraft) {
  return { ...draft, attachments: draft.attachments.map(({ previewUrl: _previewUrl, file: _file, ...attachment }) => attachment) };
}

function quoteSource(draft: VisitDraft) {
  const serialized = serializeDraft(draft);
  return { needDescription: serialized.needDescription, lines: serialized.lines };
}

/** Libelles des taches liees, pour le compte rendu texte. */
function taskLinkedLabels(line: EstimateLine): string {
  const labels = (line.taskTemplateLabels ?? []).map((label) => String(label ?? "").trim()).filter(Boolean);
  if (labels.length) return labels.join(", ");
  return String(line.taskTemplateLabel ?? "").trim();
}

function reportText(project: ProjectRecord, draft: VisitDraft) {
  const sections = draft.lines.filter((line) => line.type === "section");
  const tasks = draft.lines.filter((line) => line.type === "task");
  const taskLines = sections.map((section) => {
    const children = tasks.filter((task) => task.parentId === section.id);
    const sub = section.subcontracting ?? null;
    return [
      sub ? `# ${section.title} (sous-traite : ${sub.name || "a designer"}, marge ${sub.marginRate} %)` : `# ${section.title}`,
      ...children.map((task) => `- ${task.title}: ${quantity(task)} ${task.unit}${taskLinkedLabels(task) ? ` | taches liees: ${taskLinkedLabels(task)}` : ""}${task.technicalNotes ? ` | ${task.technicalNotes}` : ""}`),
    ].join("\n");
  }).join("\n\n");

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
    [draft.access && `Acces: ${draft.access}`, draft.parking && `Stationnement: ${draft.parking}`, draft.floor && `Etage: ${draft.floor}`, draft.condominium && `Copropriete: ${draft.condominium}`, draft.waste && `Evacuation gravats: ${draft.waste}`, draft.constraintNotes].filter(Boolean).join("\n") || "Aucune contrainte renseignee.",
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

function appointmentType(status: VisitStatus) {
  return status === "pre_devis" ? "visite_chiffrage_pre_devis" : "visite_chiffrage";
}

function appointmentStatus(status: VisitStatus) {
  return status === "realisee" || status === "pre_devis" ? "realise" : "planifie";
}

function stageFor(status: VisitStatus) {
  return status === "realisee" || status === "pre_devis" ? "chiffrage" : "visite";
}

function nextActionFor(status: VisitStatus) {
  if (status === "pre_devis") return "Finaliser le pre-devis";
  if (status === "realisee") return "Preparer le devis";
  return "Realiser la visite terrain";
}

export function ProjectVisitWorkspaceStable({ project, existingAppointment }: { project: ProjectRecord; existingAppointment?: CrmAppointmentRow | null }) {
  const navigate = useNavigate();
  const [currentAppointment, setCurrentAppointment] = useState<CrmAppointmentRow | null>(existingAppointment ?? null);
  const appointmentId = currentAppointment?.id ?? existingAppointment?.id ?? null;
  const storageKey = `batipro.project-visit-estimate.${appointmentId ?? project.id}`;
  const [step, setStep] = useState<StepKey>("estimating");
  const [draft, setDraft] = useState<VisitDraft>(() => {
    const base = initialDraft(project, currentAppointment ?? existingAppointment);
    const stored = localStorage.getItem(storageKey);
    if (!stored || currentAppointment || existingAppointment) return base;
    try {
      return { ...base, ...JSON.parse(stored) };
    } catch {
      return base;
    }
  });
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"draft" | "saved" | "error">("draft");
  // Un badge "erreur" muet ne dit pas quoi corriger : on garde le message réel.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [taskTemplates, setTaskTemplates] = useState<TaskTemplateRow[]>([]);
  const [templateUnitCosts, setTemplateUnitCosts] = useState<Map<string, number>>(new Map());
  const [pickerSectionId, setPickerSectionId] = useState<string | null>(null);
  const [linkedPreparation, setLinkedPreparation] = useState<{
    materialsByTemplateId: Record<string, TaskTemplateMaterialRatioRow[]>;
    equipmentByTemplateId: Record<string, TaskTemplateEquipmentItemRow[]>;
  }>({ materialsByTemplateId: {}, equipmentByTemplateId: {} });
  const [hourlyRates, setHourlyRates] = useState<CompanyHourlyRates | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const lastSavedSignatureRef = useRef("");
  const firstDraftRender = useRef(true);
  const [importOpen, setImportOpen] = useState(false);
  const [subcontractors, setSubcontractors] = useState<IntervenantRow[]>([]);
  const [subQuoteImport, setSubQuoteImport] = useState<{ sectionId: string; file: File } | null>(null);

  useEffect(() => {
    let alive = true;
    void listTaskTemplates()
      .then(async (rows) => {
        if (!alive) return;
        setTaskTemplates(rows);
        const costs = await loadTaskTemplateUnitCosts(rows).catch(() => new Map<string, number>());
        if (alive) setTemplateUnitCosts(costs);
      })
      .catch(() => {
        if (alive) setTaskTemplates([]);
      });
    void getCompanyHourlyRates()
      .then((rates) => {
        if (alive) setHourlyRates(rates);
      })
      .catch(() => undefined);
    void listIntervenants()
      .then((rows) => {
        if (alive) setSubcontractors(rows.filter((row) => row.status === "subcontractor" && !row.archived_at));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (existingAppointment?.id) setCurrentAppointment(existingAppointment);
  }, [existingAppointment?.id, existingAppointment]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(serializeDraft(draft)));
      setSaveState((current) => (current === "error" ? current : "draft"));
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, storageKey]);

  /**
   * Auto-enregistrement serveur. Le relevé d'une visite représente une heure de
   * terrain : il ne doit pas dépendre du fait de penser à cliquer "Enregistrer"
   * avant de fermer l'onglet. On n'auto-enregistre qu'une visite déjà créée, pour
   * ne pas semer des RDV vides au premier caractère saisi.
   */
  useEffect(() => {
    if (!appointmentId || firstDraftRender.current) {
      firstDraftRender.current = false;
      return;
    }
    // Enregistrer toutes les 4 s pendant la frappe rendait la saisie poussive :
    // chaque cycle réécrivait toutes les lignes et toutes les pièces jointes du
    // compte rendu. On laisse la main à l'utilisateur, et on ne repart que si
    // quelque chose a réellement changé depuis le dernier enregistrement réussi.
    const timer = window.setTimeout(() => {
      if (draftSignature(draftRef.current) === lastSavedSignatureRef.current) return;
      void persistVisit(draftRef.current.status, { silent: true });
    }, 12000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, appointmentId]);

  /**
   * Filet de sécurité : entre deux auto-enregistrements, le relevé n'existe que
   * dans l'onglet. Quitter la page, verrouiller le téléphone ou basculer d'appli
   * déclenche donc un enregistrement immédiat de ce qui n'est pas encore parti.
   */
  useEffect(() => {
    if (!appointmentId) return;
    function flush() {
      if (document.visibilityState === "visible") return;
      if (draftSignature(draftRef.current) === lastSavedSignatureRef.current) return;
      void persistVisit(draftRef.current.status, { silent: true });
    }
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  useEffect(() => {
    let alive = true;
    if (!appointmentId) return () => {
      alive = false;
    };
    loadCrmVisitReportDraft(appointmentId).then((stored) => {
      if (!alive || !stored) return;
      setDraft((current) => ({
        ...current,
        ...stored,
        status: normalizeVisitStatus(stored.status),
        architecture: Array.isArray((stored as { architecture?: unknown }).architecture)
          ? ((stored as { architecture?: ArchitectureRoom[] }).architecture ?? [])
          : current.architecture,
        lines: stored.lines?.length ? stored.lines as EstimateLine[] : current.lines,
        attachments: stored.attachments?.length ? stored.attachments as VisitAttachment[] : current.attachments,
      }));
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [appointmentId]);


  /**
   * La quantite d'une ligne rattachee a des pieces est la somme de ce qui est
   * retenu piece par piece : trois murs sur quatre se corrigent dans la ligne
   * de la piece, pas en reecrivant le total.
   */
  function applyZoneLinks(lineId: string, links: ZoneLink[]) {
    const total = round2(links.reduce((sum, link) => sum + Number(link.value || 0), 0));
    const firstMeasure = links[0] ? ZONE_MEASURES.find((entry) => entry.key === links[0].measure) : null;
    patchLine(lineId, {
      zoneLinks: links,
      ...(links.length
        ? { quantity: total, manualQuantity: true, length: null, width: null, height: null, ...(firstMeasure ? { unit: firstMeasure.unit } : {}) }
        : {}),
    });
  }

  function addZoneLink(lineId: string, roomId: string, measure: ZoneMeasure) {
    const room = draft.architecture.find((entry) => entry.id === roomId);
    if (!room) return;
    const line = draft.lines.find((entry) => entry.id === lineId);
    const links = [...(line?.zoneLinks ?? [])];
    if (links.some((link) => link.roomId === roomId && link.measure === measure)) return;
    links.push({ roomId, roomName: room.name.trim() || "Piece", measure, value: round2(measureValue(room, measure)) });
    applyZoneLinks(lineId, links);
  }

  function patchZoneLink(lineId: string, index: number, value: number | null) {
    const line = draft.lines.find((entry) => entry.id === lineId);
    const links = [...(line?.zoneLinks ?? [])];
    if (!links[index]) return;
    links[index] = { ...links[index], value: round2(Number(value ?? 0)) };
    applyZoneLinks(lineId, links);
  }

  /** Revenir a la mesure relevee apres un ajustement. */
  function resetZoneLink(lineId: string, index: number) {
    const line = draft.lines.find((entry) => entry.id === lineId);
    const links = [...(line?.zoneLinks ?? [])];
    const link = links[index];
    const room = link ? draft.architecture.find((entry) => entry.id === link.roomId) : null;
    if (!link || !room) return;
    links[index] = { ...link, value: round2(measureValue(room, link.measure)) };
    applyZoneLinks(lineId, links);
  }

  function removeZoneLink(lineId: string, index: number) {
    const line = draft.lines.find((entry) => entry.id === lineId);
    const links = (line?.zoneLinks ?? []).filter((_, position) => position !== index);
    applyZoneLinks(lineId, links);
  }
  const sections = useMemo(() => draft.lines.filter((line) => line.type === "section"), [draft.lines]);
  const tasks = useMemo(() => draft.lines.filter((line) => line.type === "task"), [draft.lines]);
  const selectedLine = useMemo(() => draft.lines.find((line) => line.id === selectedLineId) ?? null, [draft.lines, selectedLineId]);
  const pickerSection = useMemo(() => (pickerSectionId ? draft.lines.find((line) => line.id === pickerSectionId) ?? null : null), [draft.lines, pickerSectionId]);
  const activeSectionId = selectedLine?.type === "section" ? selectedLine.id : selectedLine?.parentId ?? sections[0]?.id ?? null;
  const report = useMemo(() => reportText(project, draft), [project, draft]);
  const photos = useMemo(() => draft.attachments.filter((item) => item.kind === "photo"), [draft.attachments]);
  const selectedTemplateIds = useMemo(() => (selectedLine ? lineTemplateIds(selectedLine) : []), [selectedLine]);
  const selectedTemplateQuantities = useMemo(
    () => (selectedLine ? lineTemplateQuantities(selectedLine, selectedTemplateIds) : []),
    [selectedLine, selectedTemplateIds],
  );
  const selectedLineQuantity = selectedLine ? quantity(selectedLine) : 0;
  const selectedSubcontracting = useMemo(() => (selectedLine ? subcontractingFor(selectedLine, draft.lines) : null), [selectedLine, draft.lines]);
  const defaultMarginRate = Number(hourlyRates?.defaultMarginRate ?? 30);

  /**
   * Composition reelle des taches liees : ce que l'ouvrier trouvera au chantier.
   * On la charge pour tout le releve et pas seulement pour la ligne ouverte :
   * le prix indicatif de chaque ligne en depend, et il doit etre juste meme sur
   * une ligne qu'on n'a jamais selectionnee.
   */
  const draftTemplateKey = useMemo(() => {
    const ids = draft.lines.filter((line) => line.type === "task").flatMap((line) => lineTemplateIds(line));
    return Array.from(new Set(ids)).sort().join(",");
  }, [draft.lines]);

  useEffect(() => {
    const ids = draftTemplateKey ? draftTemplateKey.split(",") : [];
    if (!ids.length) {
      setLinkedPreparation({ materialsByTemplateId: {}, equipmentByTemplateId: {} });
      return;
    }
    let alive = true;
    void listTaskTemplatePreparationByTemplateIds(ids)
      .then((preparation) => {
        if (!alive) return;
        setLinkedPreparation({
          materialsByTemplateId: preparation.materialsByTemplateId ?? {},
          equipmentByTemplateId: preparation.equipmentByTemplateId ?? {},
        });
      })
      .catch(() => {
        if (!alive) return;
        setLinkedPreparation({ materialsByTemplateId: {}, equipmentByTemplateId: {} });
      });
    return () => {
      alive = false;
    };
  }, [draftTemplateKey]);

  const linkedEntries = useMemo<LinkedTaskEntry[]>(
    () =>
      selectedTemplateIds
        .map((templateId, index) => {
          const template = taskTemplates.find((row) => row.id === templateId) ?? null;
          if (!template) return null;
          return {
            template,
            materials: linkedPreparation.materialsByTemplateId[templateId] ?? [],
            equipment: linkedPreparation.equipmentByTemplateId[templateId] ?? [],
            quantity: selectedTemplateQuantities[index] ?? selectedLineQuantity,
          };
        })
        .filter((entry): entry is LinkedTaskEntry => entry !== null),
    [selectedTemplateIds, selectedTemplateQuantities, selectedLineQuantity, taskTemplates, linkedPreparation],
  );

  /**
   * Temps et prix indicatifs des lignes liees a des taches. Ils suivent le
   * chiffrage reel tant que le commercial n'a pas mis les siens : le prix part
   * du deboursé sec (main d'oeuvre, materiaux pertes incluses, amortissement et
   * frais generaux) majore de la marge par defaut. L'ancien cout de reference
   * saisi a la main n'existe plus : une seule verite, le deboursé calcule.
   *
   * Le calcul a besoin des ratios materiaux, qui arrivent en differe : il vit
   * donc dans un effet, pas dans le clic qui rattache la tache.
   */
  const autoEstimates = useRef<Map<string, { hours: number | null; price: number | null }>>(new Map());
  useEffect(() => {
    const patches = new Map<string, Partial<EstimateLine>>();

    for (const line of draft.lines) {
      if (line.type !== "task") continue;
      // Tache sous-traitee : ni main d'oeuvre ni materiaux a nous. Le prix suit
      // le prix du sous-traitant et la marge de la section, tant que le
      // commercial n'a pas ecrit le sien.
      const subcontracting = subcontractingFor(line, draft.lines);
      if (subcontracting) {
        const nextPrice = subcontractedSalePrice(line.subcontractorUnitCostHt, subcontracting.marginRate);
        const tracked = autoEstimates.current.get(line.id) ?? { hours: null, price: null };
        const followsPrice = followsAutoValue(line.priceHintHt, tracked.price);
        if (followsPrice && nextPrice !== null && !sameEstimate(line.priceHintHt, nextPrice)) patches.set(line.id, { priceHintHt: nextPrice });
        autoEstimates.current.set(line.id, { hours: tracked.hours, price: followsPrice ? nextPrice ?? tracked.price : null });
        continue;
      }
      if (!hourlyRates) continue;
      const ids = lineTemplateIds(line);
      if (!ids.length) continue;
      const quantities = lineTemplateQuantities(line, ids);
      const lineQuantity = quantity(line);
      let hours = 0;
      let saleHt = 0;
      for (let index = 0; index < ids.length; index += 1) {
        const template = taskTemplates.find((row) => row.id === ids[index]);
        if (!template) continue;
        const pinned = quantities[index];
        // Une tache sans quantite propre compte une fois par unite de la ligne ;
        // une tache dont la quantite est fixee ne compte que sa part.
        const share = pinned === null ? 1 : lineQuantity > 0 ? pinned / lineQuantity : pinned;
        const materials = linkedPreparation.materialsByTemplateId[ids[index]] ?? [];
        hours += taskTemplateUnitCost(template, materials, hourlyRates).hours * share;
        // Chaque tache apporte son propre prix de vente : sa marge lui appartient.
        saleHt += taskTemplateUnitSale(template, materials, hourlyRates) * share;
      }

      const nextHours = hours > 0 ? Math.round(hours * 100) / 100 : null;
      const nextPrice = saleHt > 0 ? Math.round(saleHt * 100) / 100 : null;
      const tracked = autoEstimates.current.get(line.id) ?? { hours: null, price: null };
      const patch: Partial<EstimateLine> = {};
      const followsHours = followsAutoValue(line.estimatedHours, tracked.hours);
      const followsPrice = followsAutoValue(line.priceHintHt, tracked.price);
      if (followsHours && nextHours !== null && !sameEstimate(line.estimatedHours, nextHours)) patch.estimatedHours = nextHours;
      if (followsPrice && nextPrice !== null && !sameEstimate(line.priceHintHt, nextPrice)) patch.priceHintHt = nextPrice;

      autoEstimates.current.set(line.id, {
        hours: followsHours ? nextHours ?? tracked.hours : null,
        price: followsPrice ? nextPrice ?? tracked.price : null,
      });
      if (Object.keys(patch).length) patches.set(line.id, patch);
    }

    if (!patches.size) return;
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => (patches.has(line.id) ? { ...line, ...patches.get(line.id) } : line)),
    }));
  }, [draft.lines, hourlyRates, linkedPreparation, taskTemplates]);
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

  /**
   * Rattache une tache de plus. Un intitule annonce au client demande souvent
   * plusieurs gestes de la bibliotheque : ils s'ajoutent au lieu de se
   * remplacer. Le temps et le prix indicatif ne sont recalcules que s'ils sont
   * encore a la valeur automatique : une estimation saisie a la main gagne.
   */
  function linkTaskTemplate(lineId: string, templateId: string) {
    if (!templateId) return;
    const template = taskTemplates.find((row) => row.id === templateId);
    if (!template) return;
    const line = draft.lines.find((item) => item.id === lineId);
    if (!line) return;
    const current = lineTemplateIds(line);
    if (current.includes(template.id)) return;
    const nextIds = [...current, template.id];
    const nextQuantities = [...lineTemplateQuantities(line, current), null];
    const patch = templateLinkPatch(line, current, nextIds, nextQuantities);
    const untouchedTitle = !line.title.trim() || line.title.trim() === "Nouvelle tache / prestation";
    if (!current.length && untouchedTitle) patch.title = template.titre;
    if (!current.length) {
      const templateUnit = normalizeVisitUnit(template.unite);
      if (templateUnit) patch.unit = templateUnit;
    }
    patchLine(lineId, patch);
  }

  /** Detache une tache sans toucher a la designation ni aux mesures relevees. */
  function unlinkTaskTemplate(lineId: string, templateId: string) {
    const line = draft.lines.find((item) => item.id === lineId);
    if (!line) return;
    const current = lineTemplateIds(line);
    const index = current.indexOf(templateId);
    if (index === -1) return;
    const quantities = lineTemplateQuantities(line, current);
    const nextIds = current.filter((id) => id !== templateId);
    const nextQuantities = quantities.filter((_, position) => position !== index);
    patchLine(lineId, templateLinkPatch(line, current, nextIds, nextQuantities));
  }

  /**
   * Quantite propre a une tache liee. Vide = la tache suit la quantite de la
   * ligne : c'est le cas courant, et il reste juste apres une nouvelle mesure.
   */
  function setTaskTemplateQuantity(lineId: string, templateId: string, value: number | null) {
    const line = draft.lines.find((item) => item.id === lineId);
    if (!line) return;
    const current = lineTemplateIds(line);
    const index = current.indexOf(templateId);
    if (index === -1) return;
    const nextQuantities = lineTemplateQuantities(line, current).map((quantity, position) => (position === index ? value : quantity));
    patchLine(lineId, templateLinkPatch(line, current, current, nextQuantities));
  }

  /**
   * Champs derives du lien : la liste, les libelles, les quantites et le couple
   * historique (premiere tache) que lisent le devis et le chantier. Le temps et
   * le prix indicatifs sont recalcules a part, quand les ratios materiaux sont la.
   */
  function templateLinkPatch(
    line: EstimateLine,
    previousIds: string[],
    nextIds: string[],
    nextQuantities: Array<number | null>,
  ): Partial<EstimateLine> {
    const labels = nextIds.map((id) => {
      const template = taskTemplates.find((row) => row.id === id);
      if (template) return template.titre;
      const previousIndex = previousIds.indexOf(id);
      return line.taskTemplateLabels?.[previousIndex] ?? (previousIndex === 0 ? line.taskTemplateLabel ?? "" : "") ?? "";
    });
    return {
      taskTemplateIds: nextIds,
      taskTemplateLabels: labels,
      taskTemplateQuantities: nextQuantities,
      taskTemplateId: nextIds[0] ?? null,
      taskTemplateLabel: labels[0] ?? null,
    };
  }
  function addSection(title = "Nouvelle section") {
    const line: EstimateLine = { id: uid("section"), type: "section", parentId: null, title, unit: "u", quantity: 0, manualQuantity: false, technicalNotes: "", constraints: "", variants: "", attentionPoints: "" };
    setDraft((current) => ({ ...current, lines: [...current.lines, line] }));
    setSelectedLineId(line.id);
    setStep("estimating");
  }

  function addTask() {
    let parentId = activeSectionId;
    const nextLines = [...draft.lines];
    if (!parentId) {
      parentId = uid("section");
      nextLines.push({ id: parentId, type: "section", parentId: null, title: "Nouvelle section", unit: "u", quantity: 0, manualQuantity: false, technicalNotes: "", constraints: "", variants: "", attentionPoints: "" });
    }
    const subcontracted = Boolean(draft.lines.find((item) => item.id === parentId)?.subcontracting);
    const line: EstimateLine = { id: uid("task"), type: "task", parentId, title: subcontracted ? "Prestation sous-traitee" : "Nouvelle tache / prestation", unit: subcontracted ? "u" : "m2", ...(subcontracted ? { subcontractorUnitCostHt: null } : {}), quantity: 0, manualQuantity: false, length: null, width: null, height: null, estimatedHours: null, priceHintHt: null, family: null, libraryId: null, taskTemplateId: null, taskTemplateLabel: null, taskTemplateIds: [], taskTemplateLabels: [], taskTemplateQuantities: [], technicalNotes: "", constraints: "", variants: "", attentionPoints: "" };
    setDraft((current) => ({ ...current, lines: [...nextLines.filter((item) => !current.lines.some((existing) => existing.id === item.id)), ...current.lines, line] }));
    setSelectedLineId(line.id);
    setStep("estimating");
  }

  /**
   * Remplit une section d'un coup a partir de la bibliotheque. Chaque tache
   * choisie devient une ligne deja reliee a son modele, avec l'unite, le temps
   * et le prix de revient calcule repris — il ne reste qu'a saisir la quantite.
   */
  function addTasksFromTemplates(sectionId: string, templateIds: string[]) {
    if (!templateIds.length) return;
    const newLines: EstimateLine[] = [];

    for (const templateId of templateIds) {
      const template = taskTemplates.find((row) => row.id === templateId);
      if (!template) continue;
      newLines.push({
        id: uid("task"),
        type: "task",
        parentId: sectionId,
        title: template.titre,
        unit: normalizeVisitUnit(template.unite) ?? "u",
        quantity: 0,
        manualQuantity: false,
        length: null,
        width: null,
        height: null,
        estimatedHours: template.temps_prevu_par_unite_h ? Number(template.temps_prevu_par_unite_h) : null,
        priceHintHt: (templateUnitCosts.get(template.id) ?? 0) > 0 ? (templateUnitCosts.get(template.id) ?? 0) : null,
        family: null,
        libraryId: null,
        taskTemplateId: template.id,
        taskTemplateLabel: template.titre,
        taskTemplateIds: [template.id],
        taskTemplateLabels: [template.titre],
        taskTemplateQuantities: [null],
        technicalNotes: "",
        constraints: "",
        variants: "",
        attentionPoints: "",
      });
    }

    if (!newLines.length) return;
    setDraft((current) => ({ ...current, lines: [...current.lines, ...newLines] }));
    setSelectedLineId(newLines[0].id);
  }

  /**
   * Une section confiee a un sous-traitant. On y entre son prix ou son devis,
   * on choisit la marge, et les taches en decoulent : chacune au prix du
   * sous-traitant, vendue avec la marge. Rien de tout cela ne passe par la
   * bibliotheque : ce ne sont pas nos gestes.
   */
  function addSubcontractingSection() {
    const line: EstimateLine = {
      id: uid("section"),
      type: "section",
      parentId: null,
      title: "Sous-traitance",
      unit: "u",
      quantity: 0,
      manualQuantity: false,
      subcontracting: { intervenantId: null, name: "", marginRate: defaultMarginRate, quoteTotalHt: null },
      technicalNotes: "",
      constraints: "",
      variants: "",
      attentionPoints: "",
    };
    setDraft((current) => ({ ...current, lines: [...current.lines, line] }));
    setSelectedLineId(line.id);
    setStep("estimating");
  }

  /** Bascule une section existante en sous-traitance, ou l'en sort. */
  function setSectionSubcontracted(sectionId: string, subcontracted: boolean) {
    const line = draft.lines.find((item) => item.id === sectionId);
    if (!line || line.type !== "section") return;
    patchLine(sectionId, {
      subcontracting: subcontracted ? line.subcontracting ?? { intervenantId: null, name: "", marginRate: defaultMarginRate, quoteTotalHt: null } : null,
    });
  }

  function patchSubcontracting(sectionId: string, patch: Partial<SubcontractingSection>) {
    const line = draft.lines.find((item) => item.id === sectionId);
    if (!line?.subcontracting) return;
    patchLine(sectionId, { subcontracting: { ...line.subcontracting, ...patch } });
  }

  /** Le sous-traitant choisi dans la liste : son nom suit, mais reste modifiable. */
  function chooseSubcontractor(sectionId: string, intervenantId: string) {
    const row = subcontractors.find((item) => item.id === intervenantId) ?? null;
    patchSubcontracting(sectionId, { intervenantId: row?.id ?? null, ...(row ? { name: subcontractorLabel(row) } : {}) });
  }

  /**
   * Les lignes du devis du sous-traitant deviennent des taches de la section,
   * chacune au prix qu'il facture. Le prix de vente se calcule ensuite tout
   * seul avec la marge de la section.
   */
  function addSubcontractedTasks(sectionId: string, drafts: SubcontractedTaskDraft[]) {
    if (!drafts.length) return;
    const newLines: EstimateLine[] = drafts.map((row) => ({
      id: uid("task"),
      type: "task",
      parentId: sectionId,
      title: row.title,
      unit: row.unit,
      quantity: row.quantity,
      manualQuantity: true,
      length: null,
      width: null,
      height: null,
      estimatedHours: null,
      priceHintHt: null,
      family: null,
      libraryId: null,
      taskTemplateId: null,
      taskTemplateLabel: null,
      taskTemplateIds: [],
      taskTemplateLabels: [],
      taskTemplateQuantities: [],
      subcontractorUnitCostHt: row.unitCostHt,
      technicalNotes: row.technicalNotes,
      constraints: "",
      variants: "",
      attentionPoints: "",
    }));
    setDraft((current) => ({ ...current, lines: [...current.lines, ...newLines] }));
    setSelectedLineId(newLines[0].id);
    setSubQuoteImport(null);
  }

  /** Le devis PDF du sous-traitant : garde avec la visite, puis lu pour en tirer les taches. */
  function attachSubcontractorQuote(sectionId: string, files: FileList | null) {
    const file = files?.[0] ?? null;
    if (!file) return;
    addFiles(files, "document", sectionId);
    setSubQuoteImport({ sectionId, file });
  }

  function removeLine(id: string) {
    setDraft((current) => ({ ...current, lines: current.lines.filter((line) => line.id !== id && line.parentId !== id), attachments: current.attachments.filter((item) => item.targetLineId !== id) }));
    setSelectedLineId(null);
  }

  function addFiles(files: FileList | null, kind: "photo" | "document", targetLineId: string | null = selectedLineId) {
    if (!files?.length) return;
    const attachments = Array.from(files).map((file) => ({ id: uid(kind), kind, name: file.name, targetLineId, comment: "", previewUrl: kind === "photo" ? URL.createObjectURL(file) : null, file, mimeType: file.type || null, sizeBytes: file.size }));
    const nextDraft = { ...draftRef.current, attachments: [...draftRef.current.attachments, ...attachments] };
    setDraft(nextDraft);
    // Une photo n'existe que dans l'onglet tant qu'elle n'est pas montée dans le
    // stockage : un rafraîchissement la perdrait. On l'envoie tout de suite.
    void persistVisit(nextDraft.status, { draftOverride: nextDraft, silent: true, queueIfBusy: true });
  }

  function removeAttachment(id: string) {
    const nextDraft = { ...draftRef.current, attachments: draftRef.current.attachments.filter((item) => item.id !== id) };
    setDraft(nextDraft);
    void persistVisit(nextDraft.status, { draftOverride: nextDraft, silent: true, queueIfBusy: true });
  }

  function patchAttachment(id: string, patch: Partial<VisitAttachment>) {
    setDraft((current) => ({ ...current, attachments: current.attachments.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
  }

  async function saveVisit(status: VisitStatus) {
    const saved = await persistVisit(status, {});
    if (!saved) return;
    if (status === "pre_devis") navigate(`/projets/${saved.targetProjectId}/devis/nouveau`);
    else if (status === "realisee") navigate(`/projets/${saved.targetProjectId}/visites/${saved.appointmentId}`);
    else navigate(`/projets/${saved.targetProjectId}/visites/${saved.appointmentId}?edit=1`, { replace: true });
  }

  async function persistVisit(
    status: VisitStatus,
    { draftOverride, silent, queueIfBusy }: { draftOverride?: VisitDraft; silent?: boolean; queueIfBusy?: boolean },
  ): Promise<{ targetProjectId: string; appointmentId: string } | null> {
    // Un enregistrement en cours ne fait pas jeter une photo : celle-ci est
    // rejouée après. En revanche l'auto-enregistrement, lui, ne se remet pas en
    // file — sinon chaque cycle relance le suivant et la temporisation disparaît,
    // ce qui remet la saisie à genoux.
    if (savingRef.current) {
      if (queueIfBusy) pendingSaveRef.current = true;
      return null;
    }
    savingRef.current = true;
    if (!silent) setSaving(true);
    try {
      const base = draftOverride ?? draftRef.current;
      const nextStatus = status === "brouillon" ? base.status : status;
      const nextDraft = { ...base, status: nextStatus };
      const signature = draftSignature(nextDraft);
      const startsAt = visitStartDate(nextDraft.date, nextDraft.time);
      const endsAt = new Date(startsAt.getTime() + Number(nextDraft.durationMinutes || 90) * 60000);
      const opportunity = project.opportunity ?? (project.prospect ? await createOpportunityForProspect(project.prospect, { stage_key: "visite", probabilite: 40, prochaine_action: "Finaliser le compte rendu de visite" }) : null);
      const targetProjectId = opportunity ? `opportunity-${opportunity.id}` : project.id;
      const source = quoteSource(nextDraft);
      localStorage.setItem(`batipro.project-quote-source.${targetProjectId}`, JSON.stringify(source));
      const serialized = serializeDraft(nextDraft);
      const payload = {
        prospect_id: project.prospect?.id ?? null,
        client_id: project.client?.id ?? null,
        opportunity_id: opportunity?.id ?? null,
        type: appointmentType(nextStatus),
        titre: `Visite chiffrage - ${project.name}`,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        statut: appointmentStatus(nextStatus),
        notes: `Visite terrain Batipro${VISIT_DRAFT_MARKER}${JSON.stringify(serialized)}`,
        compte_rendu: reportText(project, nextDraft),
      };
      const appointmentToUpdate = currentAppointment ?? existingAppointment ?? null;
      const saved = appointmentToUpdate ? await updateCrmAppointment(appointmentToUpdate.id, payload) : await createCrmAppointment(payload);
      setCurrentAppointment(saved);
      const reportResult = await saveCrmVisitReport({
        appointment_id: saved.id,
        prospect_id: project.prospect?.id ?? null,
        client_id: project.client?.id ?? null,
        opportunity_id: opportunity?.id ?? null,
        status: nextStatus,
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
        architecture: nextDraft.architecture,
        constraints: { access: nextDraft.access, parking: nextDraft.parking, floor: nextDraft.floor, condominium: nextDraft.condominium, schedule: nextDraft.schedule, nuisance: nextDraft.nuisance, safety: nextDraft.safety, waste: nextDraft.waste, water: nextDraft.water, electricity: nextDraft.electricity, authorizations: nextDraft.authorizations, notes: nextDraft.constraintNotes },
        budget: { known: nextDraft.budgetKnown, range: nextDraft.budgetRange, priceSensitivity: nextDraft.priceSensitivity, decisionMaker: nextDraft.decisionMaker, decisionOnSite: nextDraft.decisionOnSite, objections: nextDraft.objections },
        next_action: nextDraft.nextAction,
        follow_up_date: nextDraft.followUpDate,
        report_text: reportText(project, nextDraft),
        quote_source: source,
        lines: nextDraft.lines,
        attachments: nextDraft.attachments,
      });
      if (opportunity) await updateCrmOpportunityStageByKey(opportunity.id, stageFor(nextStatus), { prochaine_action: nextActionFor(nextStatus), prochaine_action_date: nextStatus === "realisee" || nextStatus === "pre_devis" ? nextDraft.followUpDate || null : nextDraft.date });
      localStorage.removeItem(storageKey);
      // On NE remplace PAS le brouillon par l'instantané envoyé : un enregistrement
      // dure plusieurs secondes, et tout ce qui a été tapé ou photographié pendant
      // ce temps serait écrasé. On se contente de marquer comme stockées les pièces
      // jointes réellement montées, dans le brouillon courant.
      const storedById = new Map(reportResult?.storedAttachments?.map((item) => [item.sourceId, item]) ?? []);
      if (storedById.size) {
        setDraft((current) => ({
          ...current,
          attachments: current.attachments.map((item) => {
            const stored = storedById.get(item.id);
            return stored ? { ...item, file: null, storagePath: stored.path } : item;
          }),
        }));
      }
      lastSavedSignatureRef.current = signature;
      setSaveState("saved");
      setSaveError(null);
      return { targetProjectId, appointmentId: saved.id };
    } catch (error) {
      setSaveState("error");
      setSaveError(readErrorMessage(error));
      return null;
    } finally {
      savingRef.current = false;
      setSaving(false);
      // Une modification arrivée pendant l'enregistrement ne doit pas être perdue :
      // on repart pour un tour au lieu de l'ignorer.
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        window.setTimeout(() => {
          if (draftSignature(draftRef.current) === lastSavedSignatureRef.current) return;
          void persistVisit(draftRef.current.status, { silent: true, queueIfBusy: true });
        }, 0);
      }
    }
  }


  /**
   * Applique ce que l'utilisateur a retenu de la proposition de Coco. Les lignes
   * arrivent en plus de l'existant : un import ne detruit jamais un releve deja
   * commence.
   */
  function applyImport(selection: VisitImportSelection) {
    // Un identifiant de tache invente par Coco viole la cle etrangere et fait
    // echouer l'ecriture des taches APRES celle des sections : le releve revient
    // ampute de toutes ses taches. On ne garde que les modeles qui existent.
    const knownTemplateIds = new Set(taskTemplates.map((row) => row.id));
    const safeSections = selection.sections.map((section) => ({
      ...section,
      tasks: section.tasks.map((task) =>
        task.taskTemplateId && knownTemplateIds.has(task.taskTemplateId)
          ? task
          : { ...task, taskTemplateId: null, taskTemplateLabel: null, taskTemplateIds: [], taskTemplateLabels: [], taskTemplateQuantities: [] },
      ),
    }));
    const newLines = buildLinesFromImport<EstimateLine>(safeSections, uid);
    const fields = applyImportedFields(selection.fields);
    setDraft((current) => ({
      ...current,
      ...(fields as Partial<VisitDraft>),
      lines: [...current.lines, ...newLines],
    }));
    setImportOpen(false);
    setStep(newLines.length ? "estimating" : "constraints");
  }
  function renderMeasurements(line: EstimateLine) {
    if (line.type !== "task") return null;
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Unite">
          <select className={inputClass} value={line.unit} onChange={(event) => patchLine(line.id, { unit: event.target.value as Unit, manualQuantity: false })}>
            <option value="u">U</option><option value="ml">ml</option><option value="m2">m2</option><option value="m3">m3</option><option value="h">h</option>
          </select>
        </Field>
        {(line.unit === "u" || line.unit === "h") ? <Field label={line.unit === "h" ? "Heures" : "Quantite"}><DecimalInput value={line.quantity || null} onValue={(value) => patchLine(line.id, { quantity: value ?? 0, manualQuantity: true })} /></Field> : null}
        {["ml", "m2", "m3"].includes(line.unit) ? <Field label="Longueur"><DecimalInput value={line.length ?? null} onValue={(value) => patchLine(line.id, { length: value, manualQuantity: false })} /></Field> : null}
        {["m2", "m3"].includes(line.unit) ? <Field label="Largeur"><DecimalInput value={line.width ?? null} onValue={(value) => patchLine(line.id, { width: value, manualQuantity: false })} /></Field> : null}
        {line.unit === "m3" ? <Field label="Hauteur"><DecimalInput value={line.height ?? null} onValue={(value) => patchLine(line.id, { height: value, manualQuantity: false })} /></Field> : null}
        {["ml", "m2", "m3"].includes(line.unit) ? <Field label="Quantite calculee"><DecimalInput value={line.quantity || null} onValue={(value) => patchLine(line.id, { quantity: value ?? 0, manualQuantity: true })} /></Field> : null}
      </div>
    );
  }

  return (
    <div className="pb-24 md:pb-0">
      <header className="sticky top-0 z-30 -mx-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:mb-5 md:rounded-3xl md:border md:p-5 md:shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link to={`/projets/${project.id}?tab=visits`} className="mb-2 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Retour projet</Link>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Visite terrain / chiffrage</div>
            <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-950 md:text-3xl">{project.name}</h1>
            <p className="mt-1 truncate text-sm text-slate-500">{draft.client} - {draft.address || "Adresse a renseigner"}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${saveState === "error" ? "bg-red-100 text-red-700" : saveState === "saved" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
              {saveState === "saved" ? "enregistre" : saveState === "error" ? "erreur" : draft.status}
            </span>
            <div className="flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)}><Mic className="h-4 w-4" />Compte rendu</Button>
              <Button size="sm" variant="secondary" disabled={saving} onClick={() => saveVisit("brouillon")}><Save className="h-4 w-4" />Enregistrer</Button>
            </div>
          </div>
        </div>
        {saveState === "error" && saveError ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
            Enregistrement impossible : {saveError}
          </p>
        ) : null}
        <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {steps.map((item) => <button key={item.key} type="button" onClick={() => setStep(item.key)} className={["shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition", step === item.key ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-600"].join(" ")}>{item.label}</button>)}
        </nav>
      </header>

      <main className="space-y-4">
        {step === "info" ? <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Client"><input className={inputClass} value={draft.client} onChange={(event) => patch("client", event.target.value)} /></Field>
          <Field label="Telephone"><input className={inputClass} value={draft.phone} onChange={(event) => patch("phone", event.target.value)} /></Field>
          <Field label="Email"><input className={inputClass} value={draft.email} onChange={(event) => patch("email", event.target.value)} /></Field>
          <Field label="Adresse RDV"><input className={inputClass} value={draft.address} onChange={(event) => patch("address", event.target.value)} /></Field>
          <Field label="Contact sur place"><input className={inputClass} value={draft.contactOnSite} onChange={(event) => patch("contactOnSite", event.target.value)} /></Field>
          <Field label="Date"><input type="date" className={inputClass} value={draft.date} onChange={(event) => patch("date", event.target.value)} /></Field>
          <Field label="Heure"><input type="time" className={inputClass} value={draft.time} onChange={(event) => patch("time", event.target.value)} /></Field>
          <Field label="Duree minutes"><input type="number" className={inputClass} value={draft.durationMinutes} onChange={(event) => patch("durationMinutes", Number(event.target.value))} /></Field>
        </div></section> : null}

        {step === "description" ? <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="grid gap-3 md:grid-cols-2">
          <Field label="Type projet"><input className={inputClass} value={draft.projectType} onChange={(event) => patch("projectType", event.target.value)} /></Field>
          <Field label="Urgence"><input className={inputClass} value={draft.urgency} onChange={(event) => patch("urgency", event.target.value)} /></Field>
          <Field label="Delai souhaite"><input type="date" className={inputClass} value={draft.desiredDeadline} onChange={(event) => patch("desiredDeadline", event.target.value)} /></Field>
          <Field label="Zones concernees"><input className={inputClass} value={draft.zones} onChange={(event) => patch("zones", event.target.value)} /></Field>
          <Field label="Objectif client"><textarea className={textareaClass} value={draft.clientObjective} onChange={(event) => patch("clientObjective", event.target.value)} /></Field>
          <Field label="Description besoin"><textarea className={textareaClass} value={draft.needDescription} onChange={(event) => patch("needDescription", event.target.value)} /></Field>
        </div></section> : null}

        {step === "estimating" ? <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Terrain / pre-devis</div><h2 className="mt-1 text-lg font-semibold text-slate-950">Sections et taches</h2></div>
              <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => addSection()}><Plus className="h-4 w-4" />Section</Button><Button variant="secondary" onClick={() => addSubcontractingSection()} title="Une section dont les travaux sont confies a un sous-traitant : son prix ou son devis, plus notre marge"><Plus className="h-4 w-4" />Sous-traitant</Button><Button variant="secondary" onClick={() => addTask()}><Plus className="h-4 w-4" />Tache</Button></div>
            </div>
            <div className="mt-4 space-y-3">
              {sections.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Creez une section, puis ajoutez les taches et quantites relevees.</div> : sections.map((section) => {
                const children = tasks.filter((task) => task.parentId === section.id);
                return <article key={section.id} className="overflow-hidden rounded-2xl border border-slate-200"><button type="button" onClick={() => { setSelectedLineId(section.id); setPickerSectionId(section.id); }} title="Ajouter des taches de la bibliotheque a cette section" className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"><span className="min-w-0 flex-1 truncate font-semibold text-slate-950">{section.title}{section.subcontracting ? <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">Sous-traite{section.subcontracting.name ? ` · ${section.subcontracting.name}` : ""} · marge {section.subcontracting.marginRate} %</span> : null}</span><span className="shrink-0 text-xs text-slate-500">{children.length} tache(s)</span></button><div className="divide-y divide-slate-100">{children.map((task) => <button key={task.id} type="button" onClick={() => setSelectedLineId(task.id)} className={["block w-full p-4 text-left hover:bg-slate-50", selectedLineId === task.id ? "bg-blue-50" : "bg-white"].join(" ")}><div className="font-semibold text-slate-950">{task.title}</div><div className="mt-1 text-sm text-slate-500">{quantity(task)} {task.unit}{section.subcontracting ? <span className="ml-2 text-xs text-violet-700">ST {euro(Number(task.subcontractorUnitCostHt ?? 0))} → vente {task.priceHintHt ? euro(task.priceHintHt) : "a chiffrer"} / {task.unit}</span> : null}</div>{task.technicalNotes ? <div className="mt-1 line-clamp-2 text-xs text-slate-500">{task.technicalNotes}</div> : null}</button>)}</div></article>;
              })}
            </div>
          </div>
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:max-h-[calc(100dvh-2rem)] xl:self-start xl:overflow-y-auto">
            <div className="mb-3 flex items-center justify-between gap-2"><div className="text-sm font-semibold text-slate-950">Detail</div>{selectedLine ? <button type="button" onClick={() => removeLine(selectedLine.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button> : null}</div>
            {selectedLine ? (
              <div className="space-y-3">
                <Field label="Designation">
                  <input className={inputClass} value={selectedLine.title} onChange={(event) => patchLine(selectedLine.id, { title: event.target.value })} placeholder="Intitule precis annonce au client" />
                </Field>
                {selectedLine.type === "section" ? (
                  <SubcontractingSectionPanel
                    section={selectedLine}
                    tasks={tasks.filter((task) => task.parentId === selectedLine.id)}
                    documents={draft.attachments.filter((item) => item.kind === "document" && item.targetLineId === selectedLine.id)}
                    subcontractors={subcontractors}
                    onToggle={(value) => setSectionSubcontracted(selectedLine.id, value)}
                    onPatch={(patch) => patchSubcontracting(selectedLine.id, patch)}
                    onChoose={(id) => chooseSubcontractor(selectedLine.id, id)}
                    onQuote={(files) => attachSubcontractorQuote(selectedLine.id, files)}
                    onAddTask={() => addTask()}
                    onRemoveDocument={removeAttachment}
                  />
                ) : null}
                {selectedLine.type === "task" && selectedSubcontracting ? (
                  <SubcontractedTaskPanel
                    line={selectedLine}
                    subcontracting={selectedSubcontracting}
                    onCost={(value) => patchLine(selectedLine.id, { subcontractorUnitCostHt: value })}
                  />
                ) : null}
                {selectedLine.type === "task" ? (
                  <>
                    {selectedSubcontracting ? null : (<>
                    <Field label="Taches liees">
                      <div className="space-y-2">
                        {selectedTemplateIds.length ? (
                          <ul className="space-y-1">
                            {selectedTemplateIds.map((templateId, index) => {
                              const template = taskTemplates.find((row) => row.id === templateId) ?? null;
                              // La tache enregistree reste lisible meme si la bibliotheque n'est pas
                              // encore chargee ou si le modele a ete supprime depuis la visite.
                              const label = template
                                ? template.lot
                                  ? `${template.lot} — ${template.titre}`
                                  : template.titre
                                : selectedLine.taskTemplateLabels?.[index] ?? selectedLine.taskTemplateLabel ?? "Tache liee";
                              const templateUnit = template ? normalizeVisitUnit(template.unite) ?? selectedLine.unit : selectedLine.unit;
                              return (
                                <li key={templateId} className="space-y-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="min-w-0 flex-1 truncate text-sm" title={label}>{label}</span>
                                    <button
                                      type="button"
                                      className="shrink-0 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                                      onClick={() => unlinkTaskTemplate(selectedLine.id, templateId)}
                                    >
                                      Retirer
                                    </button>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="shrink-0 text-[11px] text-slate-500">Quantite</span>
                                    <DecimalInput
                                      className="h-9 w-24 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                                      value={selectedTemplateQuantities[index] ?? null}
                                      placeholder={String(quantity(selectedLine) || 0)}
                                      onValue={(value) => setTaskTemplateQuantity(selectedLine.id, templateId, value)}
                                    />
                                    <span className="shrink-0 text-[11px] text-slate-500">{templateUnit}</span>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : (
                          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
                            Aucune tache liee.
                          </div>
                        )}
                        {selectedTemplateIds.length ? (
                          <p className="text-[11px] text-slate-500">
                            Quantite vide = la tache suit celle de la ligne ({quantity(selectedLine) || 0} {selectedLine.unit}).
                          </p>
                        ) : null}
                        <select className={inputClass} value="" onChange={(event) => linkTaskTemplate(selectedLine.id, event.target.value)}>
                          <option value="">Ajouter une tache de la bibliotheque...</option>
                          {taskTemplates
                            .filter((row) => !selectedTemplateIds.includes(row.id))
                            .map((row) => (
                              <option key={row.id} value={row.id}>{row.lot ? `${row.lot} — ${row.titre}` : row.titre}</option>
                            ))}
                        </select>
                      </div>
                    </Field>
                    <LinkedTaskSummary entries={linkedEntries} rates={hourlyRates} unit={selectedLine.unit} quantity={quantity(selectedLine)} />
                    </>)}
                    <ZoneLinkEditor
                      line={selectedLine}
                      rooms={draft.architecture}
                      onAdd={(roomId, measure) => addZoneLink(selectedLine.id, roomId, measure)}
                      onPatch={(index, value) => patchZoneLink(selectedLine.id, index, value)}
                      onReset={(index) => resetZoneLink(selectedLine.id, index)}
                      onRemove={(index) => removeZoneLink(selectedLine.id, index)}
                    />
                    <div>{renderMeasurements(selectedLine)}</div>
                    <Field label={selectedSubcontracting ? "Prix de vente HT / unite (calcule, modifiable)" : "Temps estime / prix indicatif"}>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {selectedSubcontracting ? null : <DecimalInput value={selectedLine.estimatedHours ?? null} placeholder="h" onValue={(value) => patchLine(selectedLine.id, { estimatedHours: value })} />}
                        <DecimalInput value={selectedLine.priceHintHt ?? null} placeholder="EUR HT" onValue={(value) => patchLine(selectedLine.id, { priceHintHt: value })} />
                      </div>
                    </Field>
                    <Field label="Notes techniques"><textarea className={textareaClass} value={selectedLine.technicalNotes} onChange={(event) => patchLine(selectedLine.id, { technicalNotes: event.target.value })} /></Field>
                    <Field label="Contraintes / observations"><textarea className={textareaClass} value={selectedLine.constraints} onChange={(event) => patchLine(selectedLine.id, { constraints: event.target.value })} /></Field>
                    <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-800">
                      <Camera className="h-4 w-4" />Photo de cette tache
                      <input className="hidden" type="file" accept="image/*" capture="environment" multiple onChange={(event) => { addFiles(event.target.files, "photo", selectedLine.id); event.target.value = ""; }} />
                    </label>
                  </>
                ) : null}
              </div>
            ) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Selectionnez une section ou une tache.</div>}
          </aside>
        </section> : null}

        {subQuoteImport ? (
          <SubcontractorQuoteImportDialog
            file={subQuoteImport.file}
            sectionTitle={draft.lines.find((line) => line.id === subQuoteImport.sectionId)?.title ?? "Sous-traitance"}
            marginRate={draft.lines.find((line) => line.id === subQuoteImport.sectionId)?.subcontracting?.marginRate ?? defaultMarginRate}
            onCancel={() => setSubQuoteImport(null)}
            onConfirm={(rows) => addSubcontractedTasks(subQuoteImport.sectionId, rows)}
          />
        ) : null}

        {pickerSection ? (
          <VisitTaskPickerDialog
            sectionTitle={pickerSection.title}
            templates={taskTemplates}
            onCancel={() => setPickerSectionId(null)}
            onConfirm={(templateIds) => {
              addTasksFromTemplates(pickerSection.id, templateIds);
              setPickerSectionId(null);
            }}
          />
        ) : null}

        {step === "architecture" ? (
          <ArchitectureStep
            rooms={draft.architecture}
            onChange={(architecture) => patch("architecture", architecture)}
          />
        ) : null}

        {step === "photos" ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Photos du projet</div>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">{photos.length} photo(s)</h2>
                <p className="mt-1 text-sm text-slate-500">Chaque photo part dans le stockage des l'ajout : elle reste disponible apres le rendez-vous.</p>
              </div>
              <div className="flex gap-2">
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">
                  <Camera className="h-4 w-4" />Prendre une photo
                  <input className="hidden" type="file" accept="image/*" capture="environment" multiple onChange={(event) => { addFiles(event.target.files, "photo", null); event.target.value = ""; }} />
                </label>
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">
                  <Plus className="h-4 w-4" />Depuis la galerie
                  <input className="hidden" type="file" accept="image/*" multiple onChange={(event) => { addFiles(event.target.files, "photo", null); event.target.value = ""; }} />
                </label>
              </div>
            </div>
            {photos.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Aucune photo. Photographiez l'existant, les acces et les points singuliers : ils serviront au chiffrage puis a l'ouvrier.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {photos.map((photo) => {
                  const linkedLine = photo.targetLineId ? draft.lines.find((line) => line.id === photo.targetLineId) ?? null : null;
                  return (
                    <figure key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      {photo.previewUrl ? (
                        <img
                          src={photo.previewUrl}
                          alt={photo.name}
                          className="h-40 w-full bg-slate-100 object-cover"
                          loading="lazy"
                          /* Une photo iPhone en HEIC ne s'affiche pas dans un navigateur :
                             sans ce repli, la vignette restait blanche et la photo semblait
                             perdue alors qu'elle est bien enregistrée. */
                          onError={(event) => {
                            const image = event.currentTarget;
                            image.style.display = "none";
                            const fallback = image.nextElementSibling as HTMLElement | null;
                            if (fallback) fallback.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className="h-40 w-full items-center justify-center bg-slate-100 px-3 text-center text-xs text-slate-500"
                        style={{ display: photo.previewUrl ? "none" : "flex" }}
                      >
                        Enregistrée, apercu impossible dans le navigateur
                      </div>
                      <figcaption className="space-y-2 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-xs font-semibold text-slate-900" title={photo.name}>{photo.name}</div>
                            <div className="text-[11px] text-slate-500">{linkedLine ? linkedLine.title : "Photo generale"}</div>
                          </div>
                          <button type="button" onClick={() => removeAttachment(photo.id)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" title="Supprimer"><Trash2 className="h-4 w-4" /></button>
                        </div>
                        <input className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500" placeholder="Commentaire" value={photo.comment} onChange={(event) => patchAttachment(photo.id, { comment: event.target.value })} />
                        <select className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs outline-none focus:border-blue-500" value={photo.targetLineId ?? ""} onChange={(event) => patchAttachment(photo.id, { targetLineId: event.target.value || null })}>
                          <option value="">Photo generale</option>
                          {tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                        </select>
                        <div className={`text-[11px] font-semibold ${photo.storagePath ? "text-emerald-700" : "text-amber-700"}`}>
                          {photo.storagePath ? "Enregistree" : "En attente d'enregistrement"}
                        </div>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        {step === "constraints" ? <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[["Acces", "access"], ["Stationnement", "parking"], ["Etage", "floor"], ["Copropriete", "condominium"], ["Horaires", "schedule"], ["Evacuation gravats", "waste"], ["Eau", "water"], ["Electricite", "electricity"], ["Autorisations", "authorizations"]].map(([label, key]) => <Field key={key} label={label}><input className={inputClass} value={String(draft[key as keyof VisitDraft] ?? "")} onChange={(event) => patch(key as keyof VisitDraft, event.target.value as never)} /></Field>)}<div className="xl:col-span-3"><Field label="Remarques contraintes"><textarea className={textareaClass} value={draft.constraintNotes} onChange={(event) => patch("constraintNotes", event.target.value)} /></Field></div></div></section> : null}

        {step === "budget" ? <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="grid gap-3 md:grid-cols-2"><Field label="Budget client connu"><input className={inputClass} value={draft.budgetKnown} onChange={(event) => patch("budgetKnown", event.target.value)} /></Field><Field label="Fourchette budget"><input className={inputClass} value={draft.budgetRange} onChange={(event) => patch("budgetRange", event.target.value)} /></Field><Field label="Decisionnaire"><input className={inputClass} value={draft.decisionMaker} onChange={(event) => patch("decisionMaker", event.target.value)} /></Field><Field label="Date relance"><input type="date" className={inputClass} value={draft.followUpDate} onChange={(event) => patch("followUpDate", event.target.value)} /></Field><Field label="Prochaine action"><textarea className={textareaClass} value={draft.nextAction} onChange={(event) => patch("nextAction", event.target.value)} /></Field><Field label="Objections"><textarea className={textareaClass} value={draft.objections} onChange={(event) => patch("objections", event.target.value)} /></Field></div></section> : null}

        {step === "summary" ? <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><div className="grid gap-3 md:grid-cols-4"><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Sections</div><div className="text-2xl font-bold">{sections.length}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Taches</div><div className="text-2xl font-bold">{tasks.length}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Photos</div><div className="text-2xl font-bold">{draft.attachments.filter((item) => item.kind === "photo").length}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">Documents</div><div className="text-2xl font-bold">{draft.attachments.filter((item) => item.kind === "document").length}</div></div></div><pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-700">{report}</pre><div className="mt-4 flex flex-wrap gap-2"><Button variant="secondary" disabled={saving} onClick={() => saveVisit("brouillon")}>Enregistrer brouillon</Button><Button variant="success" disabled={saving} onClick={() => saveVisit("realisee")}><CheckCircle2 className="h-4 w-4" />Terminer visite</Button><Button variant="primary" disabled={saving} onClick={() => saveVisit("pre_devis")}><FileText className="h-4 w-4" />Creer pre-devis</Button></div></section> : null}
      </main>

      <VisitReportImportDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        currentValues={draft as unknown as Record<string, string>}
        buildInput={(transcript) => ({
          transcript,
          project: {
            name: project.name,
            clientName: draft.client,
            address: draft.address,
            projectType: draft.projectType,
          },
          // Coco voit ce qui est deja saisi pour completer au lieu d'ecraser.
          currentDraft: {
            clientObjective: draft.clientObjective,
            needDescription: draft.needDescription,
            zones: draft.zones,
            constraints: { access: draft.access, parking: draft.parking, floor: draft.floor, condominium: draft.condominium, schedule: draft.schedule, nuisance: draft.nuisance, safety: draft.safety, waste: draft.waste, water: draft.water, electricity: draft.electricity, authorizations: draft.authorizations, notes: draft.constraintNotes },
            budget: { budgetKnown: draft.budgetKnown, budgetRange: draft.budgetRange, decisionMaker: draft.decisionMaker },
            lines: draft.lines.map((line) => ({ type: line.type, title: line.title })),
          },
          taskLibrary: taskTemplates.map((row) => ({ id: row.id, titre: row.titre, lot: row.lot, unite: row.unite })),
        })}
        onApply={applyImport}
      />
    </div>
  );
}


/**
 * Architecture du releve : on mesure une piece, l'application en tire le sol, le
 * plafond, les murs, les plinthes et le volume. Ces quantites partent ensuite
 * dans les lignes du pre-devis sans etre recomptees a la main.
 */
function ArchitectureStep({ rooms, onChange }: { rooms: ArchitectureRoom[]; onChange: (rooms: ArchitectureRoom[]) => void }) {
  function addRoom() {
    onChange([...rooms, { id: uid("piece"), name: "", length: null, width: null, height: 2.5, openingsM2: null, skirtingDeductionMl: null }]);
  }
  function patchRoom(id: string, patchValue: Partial<ArchitectureRoom>) {
    onChange(rooms.map((room) => (room.id === id ? { ...room, ...patchValue } : room)));
  }
  function removeRoom(id: string) {
    onChange(rooms.filter((room) => room.id !== id));
  }

  const totals = rooms.reduce(
    (sum, room) => {
      const metrics = roomMetrics(room);
      return {
        floor: sum.floor + metrics.floor,
        walls: sum.walls + metrics.walls,
        skirting: sum.skirting + metrics.skirting,
        volume: sum.volume + metrics.volume,
      };
    },
    { floor: 0, walls: 0, skirting: 0, volume: 0 },
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Architecture</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Pieces relevees</h2>
          <p className="mt-1 text-sm text-slate-500">Longueur, largeur, hauteur : le sol, les plafonds, les murs, les plinthes et le volume se calculent seuls.</p>
        </div>
        <Button variant="secondary" onClick={addRoom}><Plus className="h-4 w-4" />Piece</Button>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <TotalCard label="Sol / plafond" value={`${round2(totals.floor)} m2`} />
        <TotalCard label="Murs" value={`${round2(totals.walls)} m2`} />
        <TotalCard label="Plinthes" value={`${round2(totals.skirting)} ml`} />
        <TotalCard label="Volume" value={`${round2(totals.volume)} m3`} />
      </div>

      <div className="mt-4 space-y-3">
        {rooms.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Ajoutez une piece, puis saisissez ses dimensions.</div>
        ) : null}
        {rooms.map((room) => {
          const metrics = roomMetrics(room);
          return (
            <article key={room.id} className="rounded-2xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  className={`${inputClass} flex-1`}
                  placeholder="Nom de la piece (cuisine, chambre 1...)"
                  value={room.name}
                  onChange={(event) => patchRoom(room.id, { name: event.target.value })}
                />
                <button type="button" onClick={() => removeRoom(room.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Supprimer la piece">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-5">
                <Field label="Longueur (m)"><DecimalInput value={room.length} onValue={(value) => patchRoom(room.id, { length: value })} /></Field>
                <Field label="Largeur (m)"><DecimalInput value={room.width} onValue={(value) => patchRoom(room.id, { width: value })} /></Field>
                <Field label="Hauteur (m)"><DecimalInput value={room.height} onValue={(value) => patchRoom(room.id, { height: value })} /></Field>
                <Field label="Ouvertures a deduire (m2)"><DecimalInput value={room.openingsM2} onValue={(value) => patchRoom(room.id, { openingsM2: value })} /></Field>
                <Field label="Passages a deduire (ml)"><DecimalInput value={room.skirtingDeductionMl} onValue={(value) => patchRoom(room.id, { skirtingDeductionMl: value })} /></Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Measure label="Sol" value={`${round2(metrics.floor)} m2`} />
                <Measure label="Plafond" value={`${round2(metrics.ceiling)} m2`} />
                <Measure label="Perimetre" value={`${round2(metrics.perimeter)} ml`} />
                <Measure label="Murs" value={`${round2(metrics.walls)} m2`} />
                <Measure label="Plinthes" value={`${round2(metrics.skirting)} ml`} />
                <Measure label="Volume" value={`${round2(metrics.volume)} m3`} />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TotalCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-bold text-slate-950">{value}</div>
    </div>
  );
}

function Measure({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-700">
      <span className="text-slate-500">{label} </span>
      <span className="font-semibold">{value}</span>
    </span>
  );
}

/**
 * Les pieces concernees par une ligne, et pour chacune la quantite retenue.
 * La mesure relevee est proposee, puis ajustee : une piece dont trois murs
 * seulement sont repris se corrige ici, sans toucher au releve ni au total.
 */
function ZoneLinkEditor({
  line,
  rooms,
  onAdd,
  onPatch,
  onReset,
  onRemove,
}: {
  line: EstimateLine;
  rooms: ArchitectureRoom[];
  onAdd: (roomId: string, measure: ZoneMeasure) => void;
  onPatch: (index: number, value: number | null) => void;
  onReset: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const links = line.zoneLinks ?? [];
  if (!rooms.length) {
    return (
      <Field label="Pieces concernees">
        <p className="rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">
          Aucune piece relevee : ajoute-les dans l'onglet Architecture, elles seront proposees ici.
        </p>
      </Field>
    );
  }
  const total = round2(links.reduce((sum, link) => sum + Number(link.value || 0), 0));
  return (
    <Field label="Pieces concernees">
      <div className="space-y-2">
        {links.map((link, index) => {
          const room = rooms.find((entry) => entry.id === link.roomId) ?? null;
          const releve = room ? round2(measureValue(room, link.measure)) : null;
          const ajuste = releve !== null && Math.abs(releve - Number(link.value || 0)) > 0.009;
          const mesure = ZONE_MEASURES.find((entry) => entry.key === link.measure);
          return (
            <div key={`${link.roomId}-${link.measure}`} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                  {link.roomName}
                  <span className="text-slate-500"> — {mesure?.label ?? link.measure}</span>
                </span>
                <div className="w-24">
                  <DecimalInput value={link.value} onValue={(value) => onPatch(index, value)} />
                </div>
                <span className="text-xs text-slate-500">{mesure?.unit ?? line.unit}</span>
                <button type="button" onClick={() => onRemove(index)} className="rounded-lg p-1 text-red-600 hover:bg-red-50" aria-label="Retirer la piece">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              {ajuste ? (
                <div className="mt-1 flex items-center gap-2 text-[11px] text-amber-700">
                  <span>Ajuste au reel (releve : {releve} {mesure?.unit})</span>
                  <button type="button" onClick={() => onReset(index)} className="font-semibold underline">Revenir au releve</button>
                </div>
              ) : null}
            </div>
          );
        })}

        <div className="grid gap-2 sm:grid-cols-2">
          <select className={inputClass} value="" onChange={(event) => { const [roomId, measure] = event.target.value.split("|"); if (roomId && measure) onAdd(roomId, measure as ZoneMeasure); }}>
            <option value="">Ajouter une piece...</option>
            {rooms.map((room) => (
              <optgroup key={room.id} label={room.name.trim() || "Piece"}>
                {ZONE_MEASURES.map((mesure) => (
                  <option key={mesure.key} value={`${room.id}|${mesure.key}`}>
                    {mesure.label} ({round2(measureValue(room, mesure.key))} {mesure.unit})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {links.length ? (
            <div className="flex items-center justify-end rounded-xl bg-blue-50 px-3 text-sm font-semibold text-blue-800">
              Quantite de la ligne : {total} {ZONE_MEASURES.find((entry) => entry.key === links[0].measure)?.unit ?? line.unit}
            </div>
          ) : null}
        </div>
      </div>
    </Field>
  );
}

/**
 * Panneau d'une section : sous-traitee ou non, et si oui a qui, a quelle marge,
 * sur quel devis. Le controle compare le devis du sous-traitant a ce que les
 * taches couvrent : un ecart veut dire qu'une ligne manque ou qu'un prix est faux.
 */
function SubcontractingSectionPanel({
  section,
  tasks,
  documents,
  subcontractors,
  onToggle,
  onPatch,
  onChoose,
  onQuote,
  onAddTask,
  onRemoveDocument,
}: {
  section: EstimateLine;
  tasks: EstimateLine[];
  documents: VisitAttachment[];
  subcontractors: IntervenantRow[];
  onToggle: (value: boolean) => void;
  onPatch: (patch: Partial<SubcontractingSection>) => void;
  onChoose: (intervenantId: string) => void;
  onQuote: (files: FileList | null) => void;
  onAddTask: () => void;
  onRemoveDocument: (id: string) => void;
}) {
  const sub = section.subcontracting ?? null;
  const totalCost = round2(tasks.reduce((sum, task) => sum + Number(task.subcontractorUnitCostHt ?? 0) * quantity(task), 0));
  const totalSale = round2(tasks.reduce((sum, task) => sum + Number(task.priceHintHt ?? 0) * quantity(task), 0));
  const missingCost = tasks.filter((task) => !(Number(task.subcontractorUnitCostHt ?? 0) > 0)).length;
  const quoteGap = sub?.quoteTotalHt ? round2(sub.quoteTotalHt - totalCost) : null;

  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm">
        <input type="checkbox" className="h-4 w-4" checked={Boolean(sub)} onChange={(event) => onToggle(event.target.checked)} />
        <span className="font-semibold text-slate-900">Section sous-traitee</span>
      </label>
      {sub ? (
        <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/50 p-3">
          <Field label="Sous-traitant">
            <div className="space-y-2">
              <select className={inputClass} value={sub.intervenantId ?? ""} onChange={(event) => onChoose(event.target.value)}>
                <option value="">Choisir dans les intervenants...</option>
                {subcontractors.map((row) => <option key={row.id} value={row.id}>{subcontractorLabel(row)}</option>)}
              </select>
              <input className={inputClass} value={sub.name} placeholder="Nom du sous-traitant" onChange={(event) => onPatch({ name: event.target.value, ...(sub.intervenantId ? { intervenantId: null } : {}) })} />
            </div>
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Marge (%)"><DecimalInput value={sub.marginRate} placeholder="30" onValue={(value) => onPatch({ marginRate: Math.max(0, Number(value ?? 0)) })} /></Field>
            <Field label="Montant devis ST HT"><DecimalInput value={sub.quoteTotalHt} placeholder="EUR HT" onValue={(value) => onPatch({ quoteTotalHt: value })} /></Field>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white">
              <Upload className="h-4 w-4" />Devis sous-traitant (PDF)
              <input className="hidden" type="file" accept="application/pdf,.pdf" onChange={(event) => { onQuote(event.target.files); event.target.value = ""; }} />
            </label>
            <Button variant="secondary" onClick={onAddTask}><Plus className="h-4 w-4" />Prestation au prix</Button>
          </div>
          <p className="text-[11px] text-slate-500">Le PDF est garde avec la visite, puis lu : chaque ligne du devis devient une tache au prix du sous-traitant, vendue avec la marge.</p>
          {documents.length ? (
            <ul className="space-y-1">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs">
                  <FileText className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="min-w-0 flex-1 truncate" title={doc.name}>{doc.name}</span>
                  <span className={doc.storagePath ? "text-emerald-700" : "text-amber-700"}>{doc.storagePath ? "Enregistre" : "En attente"}</span>
                  <button type="button" onClick={() => onRemoveDocument(doc.id)} className="rounded-lg p-1 text-red-600 hover:bg-red-50" aria-label="Retirer le document"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          ) : null}
          <dl className="space-y-1 rounded-xl border border-violet-200 bg-white p-3 text-xs text-slate-700">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Prix sous-traitant ({tasks.length} tache(s))</dt><dd className="font-medium">{euro(totalCost)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Marge {sub.marginRate} %</dt><dd className="font-medium">{euro(round2(totalSale - totalCost))}</dd></div>
            <div className="flex justify-between gap-3 border-t border-violet-100 pt-1 font-semibold text-slate-900"><dt>Prix de vente HT</dt><dd>{euro(totalSale)}</dd></div>
          </dl>
          {missingCost ? <p className="text-[11px] font-semibold text-amber-700">{missingCost} tache(s) sans prix sous-traitant : elles partent a 0 au devis.</p> : null}
          {quoteGap !== null && Math.abs(quoteGap) > 0.5 ? (
            <p className="text-[11px] font-semibold text-amber-700">
              Ecart avec le devis ST : {euro(quoteGap)} {quoteGap > 0 ? "non couverts par les taches" : "de trop dans les taches"}.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Tache sous-traitee : le prix du sous-traitant par unite, la marge de la
 * section, et ce que ca donne. Pas de bibliotheque ici : ce n'est pas nous
 * qui posons, on ne compte ni heures ni materiaux.
 */
function SubcontractedTaskPanel({
  line,
  subcontracting,
  onCost,
}: {
  line: EstimateLine;
  subcontracting: SubcontractingSection;
  onCost: (value: number | null) => void;
}) {
  const count = quantity(line);
  const unitCost = Number(line.subcontractorUnitCostHt ?? 0);
  const unitSale = Number(line.priceHintHt ?? 0);
  return (
    <div className="space-y-2 rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-violet-700">
        Sous-traite{subcontracting.name ? ` par ${subcontracting.name}` : ""}
      </div>
      <Field label={`Prix sous-traitant HT / ${line.unit}`}>
        <DecimalInput value={line.subcontractorUnitCostHt ?? null} placeholder="EUR HT" onValue={onCost} />
      </Field>
      <dl className="space-y-1 text-xs text-slate-700">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Marge de la section</dt><dd className="font-medium">{subcontracting.marginRate} %</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Prix de vente / {line.unit}</dt><dd className="font-medium">{unitSale > 0 ? euro(unitSale) : "a chiffrer"}</dd></div>
        {count > 0 ? (
          <div className="flex justify-between gap-3 border-t border-violet-200 pt-1 font-semibold text-slate-900">
            <dt>{count.toLocaleString("fr-FR")} {line.unit} : achat {euro(round2(unitCost * count))}</dt>
            <dd>vente {euro(round2(unitSale * count))}</dd>
          </div>
        ) : null}
      </dl>
      {!(unitCost > 0) ? <p className="text-[11px] font-semibold text-amber-700">Sans prix sous-traitant, la tache part a 0 au devis.</p> : null}
    </div>
  );
}
