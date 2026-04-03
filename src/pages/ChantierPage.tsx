  // src/pages/ChantierPage.tsx
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import { getChantierById, type ChantierRow } from "../services/chantiers.service";

import {
  getTasksByChantierIdDetailed,
  createTask,
  updateTask,
  adminSetTaskProgressOffset,
  type ChantierTaskRow,
  type TaskQualityStatus,
  type TaskStatus,
} from "../services/chantierTasks.service";
import { listTaskAssigneeIdsByTaskIds, replaceTaskAssignees } from "../services/chantierTaskAssignees.service";
import { bulkUpdatePlanningTasks } from "../services/chantierPlanningTasks.service";
import {
  createChantierTimeEntry,
  deleteChantierTimeEntry,
  listChantierTimeEntriesByChantierId,
  type ChantierTimeEntryRow,
} from "../services/chantierTimeEntries.service";

import {
  listDevisByChantierId,
  listDevisLignes,
  createDevisLigne,
  deleteDevisLigne,
  type DevisRow,
  type DevisLigneRow,
} from "../services/devis.service";

import { decodeQtyUnit } from "../services/devisImport.service";
const PlanningTab = lazy(() => import("../components/chantiers/PlanningBoard"));

import {
  listIntervenantsByChantierId,
  listIntervenants,
  createIntervenant,
  attachIntervenantToChantier,
  updateIntervenant,
  deleteIntervenant,
  type IntervenantRow,
} from "../services/intervenants.service";

import {
  listMaterielDemandesByChantierId,
  createMaterielDemande,
  updateMaterielDemande,
  deleteMaterielDemande,
  type MaterielDemandeRow,
  type MaterielStatus,
} from "../services/materielDemandes.service";
import {
  createChantierConsigne,
  deleteChantierConsigne,
  listChantierConsignesByChantierId,
  updateChantierConsigne,
  type ChantierConsigneRow,
} from "../services/chantierConsignes.service";
import {
  listByChantier as listDocumentsByChantier,
  getSignedUrl,
  linkDocumentToTask,
  uploadDocument,
  listDocumentAccess,
  updateDocument,
  deleteDocument,
  updateDocumentAccess,
  type ChantierDocumentRow,
  type DocumentVisibilityOption,
  type DocumentVisibilityMode,
} from "../services/chantierDocuments.service";
import {
  listReservesByChantierId,
  createReserve,
  updateReserve,
  setReserveStatus,
  getTaskAssignee,
  type ChantierReserveRow,
  type ReservePriority,
  type ReserveStatus,
} from "../services/reserves.service";
import {
  listReserveDocuments,
  addReserveDocument,
} from "../services/reserveDocuments.service";
import {
  listReserveMarkersByPlan,
  addReserveMarker,
  removeReserveMarker,
  removeReserveMarkersGroup,
  renameReserveMarkersGroup,
  type ReservePlanMarkerRow,
} from "../services/reserveMarkers.service";
import {
  listTaskDocuments,
  listTaskDocumentsByTaskIds,
  adminSetTaskDocumentPermissions,
  listDocumentPermissionsByDocumentIds,
  type TaskDocumentLinkRow,
} from "../services/taskDocuments.service";
import {
  listDoeItemsByChantierId,
  removeDoeItem,
  reorderDoeItems,
  upsertDoeItem,
} from "../services/chantierDoe.service";
import TaskDocumentsDrawer from "../components/chantiers/TaskDocumentsDrawer";
import DocumentEditDrawer from "../components/chantiers/DocumentEditDrawer";
import ApprovisionnementTab from "../components/chantiers/ApprovisionnementTab";
import ChantierPhotosTab from "../components/chantiers/ChantierPhotosTab";
import PreparationTab from "../components/chantiers/PreparationTab";
import ReservePlanViewer from "../components/chantiers/ReservePlanViewer";
import {
  listChantierZones,
  type ChantierZoneRow,
} from "../services/chantierZones.service";
import {
  appendChantierActivityLog,
  listChantierActivityLogs,
  type ChantierActivityLogRow,
} from "../services/chantierActivityLog.service";
import VisiteTab from "../components/chantiers/VisiteTab";
import DoeTab from "../components/chantiers/DoeTab";
import DevisImportDrawer, { type DevisImportResult } from "../components/chantiers/DevisImportDrawer";
import TaskTemplateDrawer from "../components/TaskTemplateDrawer";
import {
  create as createTaskTemplate,
  type TaskTemplateInput,
} from "../services/taskTemplates.service";
import { useI18n } from "../i18n";

// ENVOI ACCÈS (Edge Function via service)
import { sendIntervenantAccess } from "../services/chantierAccessAdmin.service";
import { buildIntervenantLink } from "../lib/publicUrl";

/* ---------------- types ---------------- */
type TabKey =
  | "accueil"
  | "preparer"
  | "devis-taches"
  | "photos"
  | "documents"
  | "intervenants"
  | "planning"
  | "temps"
  | "reserves"
  | "achats"
  | "materiel"
  | "consignes"
  | "journal"
  | "messagerie"
  | "rapports"
  | "doe"
  | "visite";

type ToastState = { type: "ok" | "error"; msg: string } | null;

/* ---------------- helpers ---------------- */
function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function statusBadge(status: string | null | undefined, t: (key: string) => string) {
  const s = status ?? "PREPARATION";
  if (s === "EN_COURS") {
    return { label: t("common.chantierStatus.EN_COURS"), className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  if (s === "TERMINE") {
    return { label: t("common.chantierStatus.TERMINE"), className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  return { label: t("common.chantierStatus.PREPARATION"), className: "bg-slate-50 text-slate-700 border-slate-200" };
}

function taskStatusLabel(s: ChantierTaskRow["status"], t: (key: string) => string) {
  if (s === "FAIT") return t("common.taskStatus.FAIT");
  if (s === "EN_COURS") return t("common.taskStatus.EN_COURS");
  return t("common.taskStatus.A_FAIRE");
}
function taskStatusBadgeClass(s: ChantierTaskRow["status"]) {
  if (s === "FAIT") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "EN_COURS") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function taskQualityLabel(status: TaskQualityStatus) {
  if (status === "en_cours") return "En cours";
  if (status === "termine_intervenant") return "Terminé intervenant";
  if (status === "valide_admin") return "Validé admin";
  if (status === "a_reprendre") return "À reprendre";
  return "À faire";
}

function taskQualityBadgeClass(status: TaskQualityStatus) {
  if (status === "valide_admin") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "termine_intervenant") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "a_reprendre") return "bg-red-50 text-red-700 border-red-200";
  if (status === "en_cours") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function chantierActivityEntityLabel(entityType: string) {
  if (entityType === "task") return "Tâche";
  if (entityType === "reserve") return "Réserve";
  if (entityType === "consigne") return "Consigne";
  if (entityType === "time_entry") return "Temps";
  if (entityType === "materiel") return "Matériel";
  if (entityType === "approvisionnement") return "Approvisionnement";
  if (entityType === "document") return "Document";
  if (entityType === "photo") return "Photo";
  if (entityType === "zone") return "Zone";
  return "Chantier";
}

function chantierActivityActionLabel(actionType: string) {
  if (actionType === "created") return "Création";
  if (actionType === "updated") return "Modification";
  if (actionType === "deleted") return "Suppression";
  if (actionType === "status_changed") return "Changement statut";
  if (actionType === "validated") return "Validation";
  if (actionType === "time_logged") return "Saisie temps";
  return actionType;
}

function chantierActivityTone(entityType: string) {
  if (entityType === "reserve") return "border-red-200 bg-red-50 text-red-700";
  if (entityType === "task") return "border-blue-200 bg-blue-50 text-blue-700";
  if (entityType === "time_entry") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (entityType === "consigne") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

const DEFAULT_STANDARD_LOTS = [
  "Curage / Démolition",
  "Maçonnerie / Gros œuvre",
  "Charpente / Couverture",
  "Menuiseries extérieures",
  "Cloisons / Plâtrerie",
  "Isolation",
  "Électricité",
  "Plomberie",
  "Chauffage / Ventilation",
  "Sols",
  "Faïence / Carrelage",
  "Peinture",
  "Cuisine / Sanitaires",
  "Finitions / Nettoyage",
  "Extérieurs / VRD",
  "Divers / À classer",
] as const;

function normalizeLotLabel(value: string | null | undefined): string {
  return String(value ?? "").trim();
}

function uniqueIds(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)));
}

function moveArrayItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function isPublicAppUrlConfigError(error: unknown): boolean {
  const msg = String((error as any)?.message ?? error ?? "");
  return msg.includes("VITE_PUBLIC_APP_URL");
}

function reserveStatusBadge(status: string | null | undefined, t: (key: string) => string) {
  const s = status ?? "OUVERTE";
  if (s === "LEVEE") {
    return { label: t("common.reserveStatus.LEVEE"), className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }
  if (s === "EN_COURS") {
    return { label: t("common.reserveStatus.EN_COURS"), className: "bg-amber-50 text-amber-700 border-amber-200" };
  }
  return { label: t("common.reserveStatus.OUVERTE"), className: "bg-slate-50 text-slate-700 border-slate-200" };
}

function reservePriorityBadge(priority: string | null | undefined, t: (key: string) => string) {
  const p = priority ?? "NORMALE";
  if (p === "URGENTE") {
    return { label: t("common.reservePriority.URGENTE"), className: "bg-red-50 text-red-700 border-red-200" };
  }
  if (p === "BASSE") {
    return { label: t("common.reservePriority.BASSE"), className: "bg-slate-50 text-slate-700 border-slate-200" };
  }
  return { label: t("common.reservePriority.NORMALE"), className: "bg-slate-50 text-slate-700 border-slate-200" };
}

function stripLegacyPrefix(titre: string) {
  const idx = titre.indexOf(" — ");
  if (idx <= 0) return titre;
  return titre.slice(idx + 3).trim();
}

function stripExtension(name: string) {
  return (name ?? "").replace(/\.[^/.]+$/, "");
}

const DOCUMENT_CATEGORIES = [
  "Administratif",
  "Plans",
  "Fiches techniques",
  "Photos",
  "PV",
  "VISITE",
  "DOE",
  "Divers",
] as const;
const DOCUMENT_TYPES = [
  "PLAN",
  "FICHE_TECHNIQUE",
  "PHOTO",
  "MAIL",
  "PV",
  "VISITE",
  "RAPPORT_CLIENT",
  "DOE",
  "PDF",
  "AUTRE",
] as const;
const DOCUMENT_VISIBILITY_OPTIONS = [
  { value: "GLOBAL", label: "Global" },
  { value: "RESTRICTED", label: "Restreint" },
  { value: "ADMIN_ONLY", label: "Admin uniquement" },
] as const;

function resolveVisibilityMode(option: DocumentVisibilityOption): DocumentVisibilityMode {
  return option === "GLOBAL" ? "GLOBAL" : "RESTRICTED";
}

function deriveLegacyVisibility(option: DocumentVisibilityOption, accessIds: string[]): string {
  if (option === "GLOBAL") return "INTERVENANT";
  if (option === "RESTRICTED") return accessIds.length ? "CUSTOM" : "ADMIN";
  return "ADMIN";
}

function formatDocumentVisibility(doc: ChantierDocumentRow): string {
  const mode = (doc.visibility_mode ?? "").toString().toUpperCase();
  const legacy = (doc.visibility ?? "").toString().toUpperCase();
  if (mode === "RESTRICTED" && legacy === "ADMIN") return "ADMIN";
  if (mode === "GLOBAL") return "GLOBAL";
  if (mode === "RESTRICTED") return "RESTRICTED";
  if (legacy === "ADMIN") return "ADMIN";
  if (legacy === "CUSTOM") return "RESTRICTED";
  if (legacy === "INTERVENANT" || legacy === "INTERVENANTS" || legacy === "CLIENT") return "GLOBAL";
  return legacy || "—";
}
function visibilityBadgeClass(label: string) {
  const key = String(label || "").toLowerCase();
  if (key === "global") return "badge-visibility global";
  if (key === "restricted") return "badge-visibility restricted";
  if (key === "admin") return "badge-visibility admin";
  return "badge-visibility";
}
function isAdminOnlyError(err: unknown): boolean {
  const msg = String((err as any)?.message ?? err ?? "").toLowerCase();
  if (!msg) return false;
  return (
    msg.includes("row-level security") ||
    msg.includes("permission denied") ||
    msg.includes("not authorized") ||
    msg.includes("not allowed") ||
    msg.includes("rls")
  );
}

function toInputNumberString(v: number | null | undefined) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return String(n);
}
function toNumberOrNull(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "string") {
    const raw = v.trim().replace(",", ".");
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  return null;
}

type TaskProgressInfo = {
  displayPercent: number;
  autoPercent: number | null;
  offsetPercent: number;
  isAdjusted: boolean;
};

function computeTaskProgress(task: {
  temps_reel_h?: number | null;
  temps_prevu_h?: number | null;
  progress_admin_offset_percent?: number | null;
}): TaskProgressInfo {
  const tempsReel = Number(task.temps_reel_h ?? 0);
  const tempsPrevu = toNumberOrNull(task.temps_prevu_h);
  const autoPercent =
    tempsPrevu !== null && tempsPrevu > 0
      ? Math.max(0, Math.min(100, Math.round((tempsReel / tempsPrevu) * 100)))
      : null;

  const offsetRaw = toNumberOrNull((task as any).progress_admin_offset_percent);
  const offsetPercent = Math.max(-100, Math.min(100, Math.round(offsetRaw ?? 0)));
  const displayPercent = Math.max(0, Math.min(100, Math.round((autoPercent ?? 0) + offsetPercent)));

  return {
    displayPercent,
    autoPercent,
    offsetPercent,
    isAdjusted: Math.abs(offsetPercent) > 0,
  };
}

function getStatusFromProgress(progressPercent: number): TaskStatus {
  if (progressPercent >= 100) return "FAIT";
  if (progressPercent > 0) return "EN_COURS";
  return "A_FAIRE";
}

function getQualityStatusFromTaskStatus(status: TaskStatus): TaskQualityStatus {
  if (status === "FAIT") return "termine_intervenant";
  if (status === "EN_COURS") return "en_cours";
  return "a_faire";
}

function getTaskStatusFromQualityStatus(status: TaskQualityStatus): TaskStatus {
  if (status === "valide_admin" || status === "termine_intervenant") return "FAIT";
  if (status === "en_cours" || status === "a_reprendre") return "EN_COURS";
  return "A_FAIRE";
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/* ---------------- component ---------------- */
export default function ChantierPage() {
  const { id } = useParams<{ id: string }>();
  const { locale, t } = useI18n();
  const translate = t;

  const [item, setItem] = useState<ChantierRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [tab, setTab] = useState<TabKey>("accueil");

  // Toast
  const [toast, setToast] = useState<ToastState>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Tasks
  const [tasks, setTasks] = useState<ChantierTaskRow[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [tasksPlanningWarning, setTasksPlanningWarning] = useState<string | null>(null);
  const [taskAssigneeIdsByTaskId, setTaskAssigneeIdsByTaskId] = useState<Record<string, string[]>>({});

  // Temps tab
  const [timeEntries, setTimeEntries] = useState<ChantierTimeEntryRow[]>([]);
  const [timeEntriesLoading, setTimeEntriesLoading] = useState(false);
  const [timeEntriesError, setTimeEntriesError] = useState<string | null>(null);
  const [timeEntryTaskId, setTimeEntryTaskId] = useState("");
  const [timeEntryIntervenantId, setTimeEntryIntervenantId] = useState("");
  const [timeEntryDate, setTimeEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeEntryHours, setTimeEntryHours] = useState("");
  const [timeEntryQuantity, setTimeEntryQuantity] = useState("");
  const [timeEntryNote, setTimeEntryNote] = useState("");
  const [timeEntrySaving, setTimeEntrySaving] = useState(false);
  const [timeEntryDeletingId, setTimeEntryDeletingId] = useState<string | null>(null);

  // Documents
  const [documents, setDocuments] = useState<ChantierDocumentRow[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [documentCategory, setDocumentCategory] = useState("Divers");
  const [documentType, setDocumentType] = useState("AUTRE");
  const [documentVisibilityMode, setDocumentVisibilityMode] = useState<DocumentVisibilityOption>("GLOBAL");
  const [documentAccessIds, setDocumentAccessIds] = useState<string[]>([]);
  const [documentTaskId, setDocumentTaskId] = useState("");
  const [documentUploading, setDocumentUploading] = useState(false);
  const [documentModalError, setDocumentModalError] = useState<string | null>(null);
  const [documentDragActive, setDocumentDragActive] = useState(false);
  const documentInputRef = useRef<HTMLInputElement | null>(null);
  const [documentPreviewOpen, setDocumentPreviewOpen] = useState(false);
  const [documentPreviewUrl, setDocumentPreviewUrl] = useState("");
  const [documentPreviewMime, setDocumentPreviewMime] = useState<string | null>(null);
  const [documentPreviewTitle, setDocumentPreviewTitle] = useState("");
  const [documentPreviewLoading, setDocumentPreviewLoading] = useState(false);
  const [documentPreviewError, setDocumentPreviewError] = useState<string | null>(null);
  const [documentEditOpen, setDocumentEditOpen] = useState(false);
  const [documentEditDoc, setDocumentEditDoc] = useState<ChantierDocumentRow | null>(null);
  const [documentEditTitle, setDocumentEditTitle] = useState("");
  const [documentEditCategory, setDocumentEditCategory] = useState("Divers");
  const [documentEditType, setDocumentEditType] = useState("AUTRE");
  const [documentEditVisibilityMode, setDocumentEditVisibilityMode] = useState<DocumentVisibilityOption>("GLOBAL");
  const [documentEditAccessIds, setDocumentEditAccessIds] = useState<string[]>([]);
  const [documentEditSaving, setDocumentEditSaving] = useState(false);
  const [documentEditDeleting, setDocumentEditDeleting] = useState(false);
  const [documentEditError, setDocumentEditError] = useState<string | null>(null);
  const [documentEditLoadingAccess, setDocumentEditLoadingAccess] = useState(false);
  const [doeDocumentIds, setDoeDocumentIds] = useState<string[]>([]);
  const [doeSyncingDocumentId, setDoeSyncingDocumentId] = useState<string | null>(null);
  // Réserves
  const [reserves, setReserves] = useState<ChantierReserveRow[]>([]);
  const [reservesLoading, setReservesLoading] = useState(false);
  const [reservesError, setReservesError] = useState<string | null>(null);
  const [reservesFilter, setReservesFilter] = useState<"ALL" | "OUVERTES" | "LEVEES">("ALL");
  const [reserveDrawerOpen, setReserveDrawerOpen] = useState(false);
  const [activeReserve, setActiveReserve] = useState<ChantierReserveRow | null>(null);
  const [reserveDrawerTab, setReserveDrawerTab] = useState<"details" | "photos" | "plan">("details");
  const [reserveDrawerError, setReserveDrawerError] = useState<string | null>(null);
  const [reserveSaving, setReserveSaving] = useState(false);
  const [reserveDraftTitle, setReserveDraftTitle] = useState("");
  const [reserveDraftDescription, setReserveDraftDescription] = useState("");
  const [reserveDraftStatus, setReserveDraftStatus] = useState<ReserveStatus>("OUVERTE");
  const [reserveDraftPriority, setReserveDraftPriority] = useState<ReservePriority>("NORMALE");
  const [reserveDraftTaskId, setReserveDraftTaskId] = useState<string>("");
  const [reserveDraftZoneId, setReserveDraftZoneId] = useState<string>("");
  const [reserveDraftIntervenantId, setReserveDraftIntervenantId] = useState<string>("__NONE__");
  const [reservePhotoUploading, setReservePhotoUploading] = useState(false);
  const [reservePhotoFile, setReservePhotoFile] = useState<File | null>(null);
  const [reservePhotos, setReservePhotos] = useState<ChantierDocumentRow[]>([]);
  const [reservePhotosLoading, setReservePhotosLoading] = useState(false);
  const [reservePhotoUrlCache, setReservePhotoUrlCache] = useState<Record<string, string>>({});
  const reservePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [reservePlanDocumentId, setReservePlanDocumentId] = useState("");
  const [reservePlanUrl, setReservePlanUrl] = useState("");
  const [reservePlanLoading, setReservePlanLoading] = useState(false);
  const [reservePlanError, setReservePlanError] = useState<string | null>(null);
  const [reserveMarkers, setReserveMarkers] = useState<ReservePlanMarkerRow[]>([]);
  const [reserveMarkersLoading, setReserveMarkersLoading] = useState(false);
  const [reserveMarkerSaving, setReserveMarkerSaving] = useState(false);
  const [reserveSelectedMarkerId, setReserveSelectedMarkerId] = useState<string | null>(null);
  const [reserveDrawingMode, setReserveDrawingMode] = useState(false);
  const [reserveShowAllMarkers, setReserveShowAllMarkers] = useState(false);
  const [chantierDocuments, setChantierDocuments] = useState<ChantierDocumentRow[]>([]);
  const [taskDocumentLinks, setTaskDocumentLinks] = useState<TaskDocumentLinkRow[]>([]);
  const [taskDocumentsLoading, setTaskDocumentsLoading] = useState(false);
  const [taskDocumentsModalOpen, setTaskDocumentsModalOpen] = useState(false);
  const [taskDocumentsModalTask, setTaskDocumentsModalTask] = useState<ChantierTaskRow | null>(null);
  const [taskDocumentsSelection, setTaskDocumentsSelection] = useState<string[]>([]);
  const [taskDocumentsIntervenantIds, setTaskDocumentsIntervenantIds] = useState<string[]>([]);
  const [taskDocumentsShareAll, setTaskDocumentsShareAll] = useState(true);
  const [taskDocumentsQuery, setTaskDocumentsQuery] = useState("");
  const [taskDocumentsModalSaving, setTaskDocumentsModalSaving] = useState(false);
  const [taskDocumentsModalError, setTaskDocumentsModalError] = useState<string | null>(null);

  // Intervenants
  const [intervenants, setIntervenants] = useState<IntervenantRow[]>([]);
  const [intervenantsLoading, setIntervenantsLoading] = useState(false);
  const [intervenantsError, setIntervenantsError] = useState<string | null>(null);
  const [allIntervenants, setAllIntervenants] = useState<IntervenantRow[]>([]);
  const [allIntervenantsLoading, setAllIntervenantsLoading] = useState(false);
  const [existingIntervenantQuery, setExistingIntervenantQuery] = useState("");
  const [attachingIntervenantId, setAttachingIntervenantId] = useState<string | null>(null);

  // ENVOI ACCÈS (bouton "Envoyer accès")
  const [sendingAccessId, setSendingAccessId] = useState<string | null>(null);

  // Ajout intervenant
  const [creatingIntervenant, setCreatingIntervenant] = useState(false);
  const [newIntervenantNom, setNewIntervenantNom] = useState("");
  const [newIntervenantEmail, setNewIntervenantEmail] = useState("");
  const [newIntervenantTel, setNewIntervenantTel] = useState("");

  // Edition intervenant (modal)
  const [editingIntervenant, setEditingIntervenant] = useState<IntervenantRow | null>(null);
  const [savingIntervenant, setSavingIntervenant] = useState(false);
  const [editIntervenantNom, setEditIntervenantNom] = useState("");
  const [editIntervenantEmail, setEditIntervenantEmail] = useState("");
  const [editIntervenantTel, setEditIntervenantTel] = useState("");

  // Ajout tâche
  const [newTitre, setNewTitre] = useState("");
  const [, setNewCorpsEtat] = useState("");
  const [newLotSelection, setNewLotSelection] = useState("");
  const [newLotDraftName, setNewLotDraftName] = useState("");
  const [newTaskZoneId, setNewTaskZoneId] = useState("");
  const [newTaskStepName, setNewTaskStepName] = useState("");
  const [newTaskStatus, setNewTaskStatus] = useState<TaskStatus>("A_FAIRE");
  const [newTaskQualityStatus, setNewTaskQualityStatus] = useState<TaskQualityStatus>("a_faire");
  const [newAssignedIntervenantIds, setNewAssignedIntervenantIds] = useState<string[]>([]);
  const [newQuantite, setNewQuantite] = useState("1");
  const [newUnite, setNewUnite] = useState("");
  const [newTempsPrevuH, setNewTempsPrevuH] = useState("1");
  const [addingTask, setAddingTask] = useState(false);
  const [taskCreateDrawerOpen, setTaskCreateDrawerOpen] = useState(false);
  const [taskReorderSaving, setTaskReorderSaving] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Edition tâche
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [savingTask, setSavingTask] = useState(false);
  const [editTitre, setEditTitre] = useState("");
  const [editCorpsEtat, setEditCorpsEtat] = useState("");
  const [editLotSelection, setEditLotSelection] = useState("");
  const [editLotDraftName, setEditLotDraftName] = useState("");
  const [editTaskZoneId, setEditTaskZoneId] = useState("");
  const [editTaskStepName, setEditTaskStepName] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("A_FAIRE");
  const [editTaskQualityStatus, setEditTaskQualityStatus] = useState<TaskQualityStatus>("a_faire");
  const [editTaskRepriseReason, setEditTaskRepriseReason] = useState("");
  const [editAssignedIntervenantIds, setEditAssignedIntervenantIds] = useState<string[]>([]);
  const [editQuantite, setEditQuantite] = useState("1");
  const [editUnite, setEditUnite] = useState("");
  const [editTempsPrevuH, setEditTempsPrevuH] = useState("");

  const [taskProgressDrafts, setTaskProgressDrafts] = useState<Record<string, string>>({});
  const [taskProgressSavingId, setTaskProgressSavingId] = useState<string | null>(null);
  const [taskProgressEditingId, setTaskProgressEditingId] = useState<string | null>(null);
  const [taskTemplateDrawerOpen, setTaskTemplateDrawerOpen] = useState(false);
  const [taskTemplateSeed, setTaskTemplateSeed] = useState<TaskTemplateInput | null>(null);
  const [taskTemplateSaving, setTaskTemplateSaving] = useState(false);
  const [taskTemplateError, setTaskTemplateError] = useState<string | null>(null);

  // Devis
  const [devis, setDevis] = useState<DevisRow[]>([]);
  const [devisLoading, setDevisLoading] = useState(false);
  const [devisError, setDevisError] = useState<string | null>(null);
  const [devisImportDrawerOpen, setDevisImportDrawerOpen] = useState(false);

  // Lignes devis
  const [activeDevisId, setActiveDevisId] = useState<string | null>(null);
  const [lignes, setLignes] = useState<DevisLigneRow[]>([]);
  const [lignesLoading, setLignesLoading] = useState(false);
  const [lignesError, setLignesError] = useState<string | null>(null);

  // Form ligne devis
  const [lCorpsEtat, setLCorpsEtat] = useState("");
  const [lEntreprise, setLEntreprise] = useState("");
  const [lDesignation, setLDesignation] = useState("");
  const [lUnite, setLUnite] = useState("U");
  const [lQty, setLQty] = useState("1");
  const [lGen, setLGen] = useState(true);
  const [addingLigne, setAddingLigne] = useState(false);

  // Filtres tâches
  const [filterIntervenant, setFilterIntervenant] = useState<string>("__ALL__");
  const [filterTaskQuality, setFilterTaskQuality] = useState<"__ALL__" | TaskQualityStatus>("__ALL__");

  // Matériel
  const [materiel, setMateriel] = useState<MaterielDemandeRow[]>([]);
  const [materielLoading, setMaterielLoading] = useState(false);
  const [materielError, setMaterielError] = useState<string | null>(null);

  // Form matériel
  const [mIntervenantId, setMIntervenantId] = useState<string>("__NONE__");
  const [mTaskId, setMTaskId] = useState("");
  const [mDesignation, setMDesignation] = useState("");
  const [mQuantite, setMQuantite] = useState("1");
  const [mUnite, setMUnite] = useState("");
  const [mDate, setMDate] = useState("");
  const [mStatus, setMStatus] = useState<MaterielStatus>("en_attente");
  const [mRemarques, setMRemarques] = useState("");
  const [addingMateriel, setAddingMateriel] = useState(false);
  const [materielFilter, setMaterielFilter] = useState<"__ALL__" | MaterielStatus>("__ALL__");
  const [materielAdminComments, setMaterielAdminComments] = useState<Record<string, string>>({});

  // Consignes
  const [consignes, setConsignes] = useState<ChantierConsigneRow[]>([]);
  const [consignesLoading, setConsignesLoading] = useState(false);
  const [consignesError, setConsignesError] = useState<string | null>(null);
  const [consigneEditingId, setConsigneEditingId] = useState<string | null>(null);
  const [consigneDescription, setConsigneDescription] = useState("");
  const [consigneDateDebut, setConsigneDateDebut] = useState("");
  const [consigneTaskId, setConsigneTaskId] = useState("");
  const [consigneAppliesToAll, setConsigneAppliesToAll] = useState(true);
  const [consigneIntervenantIds, setConsigneIntervenantIds] = useState<string[]>([]);
  const [consigneSaving, setConsigneSaving] = useState(false);

  const [zones, setZones] = useState<ChantierZoneRow[]>([]);
  const [activityLogs, setActivityLogs] = useState<ChantierActivityLogRow[]>([]);
  const [activityLogsLoading, setActivityLogsLoading] = useState(false);
  const [activityLogsError, setActivityLogsError] = useState<string | null>(null);
  const [activityLogSchemaReady, setActivityLogSchemaReady] = useState(true);

  function openDocumentModal() {
    setDocumentModalError(null);
    setDocumentModalOpen(true);
  }

  function closeDocumentModal() {
    if (documentUploading) return;
    setDocumentModalOpen(false);
    setDocumentModalError(null);
    setDocumentDragActive(false);
    setDocumentFile(null);
    setDocumentName("");
    setDocumentCategory("Divers");
    setDocumentType("AUTRE");
    setDocumentVisibilityMode("GLOBAL");
    setDocumentAccessIds([]);
    setDocumentTaskId("");
    if (documentInputRef.current) {
      documentInputRef.current.value = "";
    }
  }

  function setDocumentFileState(file: File | null) {
    setDocumentFile(file);
    setDocumentModalError(null);
    if (file) {
      setDocumentName(stripExtension(file.name));
    }
  }

  function onSelectDocumentFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setDocumentFileState(file);
  }

  function onDocumentDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDocumentDragActive(true);
  }

  function onDocumentDragLeave() {
    setDocumentDragActive(false);
  }

  function onDocumentDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDocumentDragActive(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    setDocumentFileState(file);
  }

  async function onImportDocument() {
    if (!id) {
      setDocumentModalError("Chantier manquant.");
      setToast({ type: "error", msg: "Chantier manquant." });
      return;
    }
    if (!documentFile) {
      setDocumentModalError("Fichier requis.");
      return;
    }
    if (!documentName.trim()) {
      setDocumentModalError("Nom du document requis.");
      return;
    }
    if (documentVisibilityMode === "RESTRICTED" && documentAccessIds.length === 0) {
      setDocumentModalError("Sélectionnez au moins un intervenant ou choisissez Admin uniquement.");
      return;
    }

    setDocumentUploading(true);
    setDocumentModalError(null);
    try {
      const accessIds = documentVisibilityMode === "RESTRICTED" ? documentAccessIds : [];
      const visibilityMode = resolveVisibilityMode(documentVisibilityMode);

      const created = await uploadDocument({
        chantierId: id,
        file: documentFile,
        title: documentName.trim(),
        category: documentCategory,
        documentType,
        visibility_mode: visibilityMode,
        accessIntervenantIds: accessIds,
      });

      if (documentTaskId) {
        await linkDocumentToTask(documentTaskId, created.id);
      }

      setDocumentsLoading(true);
      setDocumentsError(null);
      const data = await listDocumentsByChantier(id);
      setDocuments(data);
      setChantierDocuments(data);
      setToast({ type: "ok", msg: "Document importé." });
      closeDocumentModal();
    } catch (err: any) {
      console.error("[documents] upload error", err?.message ?? err);
      const message = err?.message ?? "Erreur upload document.";
      setDocumentModalError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setDocumentsLoading(false);
      setDocumentUploading(false);
    }
  }

  async function openDocumentPreview(doc: ChantierDocumentRow) {
    if (!doc.storage_path) {
      setToast({ type: "error", msg: "Chemin de stockage manquant." });
      return;
    }
    setDocumentPreviewOpen(true);
    setDocumentPreviewLoading(true);
    setDocumentPreviewError(null);
    setDocumentPreviewUrl("");
    setDocumentPreviewTitle(doc.title || doc.file_name || "Document");
    setDocumentPreviewMime(doc.mime_type ?? null);
    try {
      const url = await getSignedUrl(doc.storage_path, 60);
      setDocumentPreviewUrl(url);
    } catch (err: any) {
      setDocumentPreviewError(err?.message ?? "Impossible d'ouvrir le document.");
    } finally {
      setDocumentPreviewLoading(false);
    }
  }

  function closeDocumentPreview() {
    if (documentPreviewLoading) return;
    setDocumentPreviewOpen(false);
    setDocumentPreviewUrl("");
    setDocumentPreviewError(null);
    setDocumentPreviewMime(null);
    setDocumentPreviewTitle("");
  }

  async function downloadDocument(doc: ChantierDocumentRow) {
    if (!doc.storage_path) {
      setToast({ type: "error", msg: "Chemin de stockage manquant." });
      return;
    }
    try {
      const url = await getSignedUrl(doc.storage_path, 60);
      window.open(url, "_blank", "noopener");
    } catch (err: any) {
      const message = err?.message ?? "Erreur telechargement document.";
      setToast({ type: "error", msg: message });
    }
  }

  async function copyDocumentLink(doc: ChantierDocumentRow) {
    if (!doc.storage_path) {
      setToast({ type: "error", msg: "Chemin de stockage manquant." });
      return;
    }
    try {
      const url = await getSignedUrl(doc.storage_path, 60);
      await navigator.clipboard.writeText(url);
      setToast({ type: "ok", msg: "Lien copie (valable 60s)" });
    } catch (err: any) {
      const message = err?.message ?? "Erreur copie lien document.";
      setToast({ type: "error", msg: message });
    }
  }

  async function openDocumentEdit(doc: ChantierDocumentRow) {
    setDocumentEditDoc(doc);
    setDocumentEditTitle(doc.title ?? "");
    setDocumentEditCategory(doc.category ?? "Divers");
    setDocumentEditType(doc.document_type ?? "AUTRE");
    setDocumentEditError(null);
    setDocumentEditLoadingAccess(false);

    const mode = (doc.visibility_mode ?? "").toString().toUpperCase();
    const legacy = (doc.visibility ?? "").toString().toUpperCase();
    let nextMode: DocumentVisibilityOption = "GLOBAL";
    if (mode === "RESTRICTED") nextMode = "RESTRICTED";
    else if (mode === "GLOBAL") nextMode = "GLOBAL";
    else if (legacy === "ADMIN") nextMode = "ADMIN_ONLY";
    else if (legacy === "CUSTOM") nextMode = "RESTRICTED";

    setDocumentEditVisibilityMode(nextMode);
    setDocumentEditAccessIds([]);
    setDocumentEditOpen(true);

    if (nextMode === "RESTRICTED") {
      setDocumentEditLoadingAccess(true);
      try {
        const accessIds = await listDocumentAccess(doc.id);
        setDocumentEditAccessIds(accessIds ?? []);
      } catch (err: any) {
        setDocumentEditAccessIds([]);
        const message = isAdminOnlyError(err)
          ? "Action reservee a l'admin."
          : err?.message ?? "Erreur mise a jour document.";
        setDocumentEditError(message);
      } finally {
        setDocumentEditLoadingAccess(false);
      }
    }
  }

  function closeDocumentEdit() {
    if (documentEditSaving || documentEditDeleting) return;
    setDocumentEditOpen(false);
    setDocumentEditDoc(null);
    setDocumentEditTitle("");
    setDocumentEditCategory("Divers");
    setDocumentEditType("AUTRE");
    setDocumentEditVisibilityMode("GLOBAL");
    setDocumentEditAccessIds([]);
    setDocumentEditError(null);
    setDocumentEditLoadingAccess(false);
  }

  async function saveDocumentEdit() {
    if (!documentEditDoc) {
      return;
    }
    if (documentEditVisibilityMode === "RESTRICTED" && documentEditAccessIds.length === 0) {
      setDocumentEditError("Sélectionnez au moins un intervenant ou choisissez Admin uniquement.");
      return;
    }

    setDocumentEditSaving(true);
    setDocumentEditError(null);
    try {
      const accessIds = documentEditVisibilityMode === "RESTRICTED" ? documentEditAccessIds : [];
      const visibilityMode = resolveVisibilityMode(documentEditVisibilityMode);
      const legacyVisibility = deriveLegacyVisibility(documentEditVisibilityMode, accessIds);

      const updated = await updateDocument(documentEditDoc.id, {
        title: documentEditTitle,
        category: documentEditCategory,
        document_type: documentEditType,
        visibility_mode: visibilityMode,
        legacy_visibility: legacyVisibility,
      });

      await updateDocumentAccess(documentEditDoc.id, accessIds);

      const data = await listDocumentsByChantier(updated.chantier_id);
      setDocuments(data);
      setChantierDocuments(data);
      setToast({ type: "ok", msg: "Document mis à jour." });
      closeDocumentEdit();
    } catch (err: any) {
      const message = isAdminOnlyError(err)
        ? "Action reservee a l'admin."
        : err?.message ?? "Erreur mise a jour document.";
      setDocumentEditError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setDocumentEditSaving(false);
    }
  }

  async function deleteDocumentEdit() {
    if (!documentEditDoc) {
      return;
    }
    const ok = confirm(`Supprimer le document "${documentEditDoc.title || documentEditDoc.file_name}" ?`);
    if (!ok) return;

    setDocumentEditDeleting(true);
    setDocumentEditError(null);
    try {
      await deleteDocument(documentEditDoc.id, documentEditDoc.storage_path);
      if (id) {
        const data = await listDocumentsByChantier(id);
        setDocuments(data);
        setChantierDocuments(data);
      }
      setToast({ type: "ok", msg: "Document supprimé." });
      closeDocumentEdit();
    } catch (err: any) {
      const message = isAdminOnlyError(err)
        ? "Action reservee a l'admin."
        : err?.message ?? "Erreur suppression document.";
      setDocumentEditError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setDocumentEditDeleting(false);
    }
  }

  function applyReserveToDrawer(reserve: ChantierReserveRow | null) {
    if (reserve) {
      setActiveReserve(reserve);
      setReserveDraftTitle(reserve.title ?? "");
      setReserveDraftDescription(reserve.description ?? "");
      setReserveDraftStatus((reserve.status ?? "OUVERTE") as ReserveStatus);
      setReserveDraftPriority((reserve.priority ?? "NORMALE") as ReservePriority);
      setReserveDraftTaskId(reserve.task_id ?? "");
      setReserveDraftZoneId((reserve as any).zone_id ?? "");
      setReserveDraftIntervenantId(reserve.intervenant_id ?? "__NONE__");
      return;
    }
    setActiveReserve(null);
    setReserveDraftTitle("");
    setReserveDraftDescription("");
    setReserveDraftStatus("OUVERTE");
    setReserveDraftPriority("NORMALE");
    setReserveDraftTaskId("");
    setReserveDraftZoneId("");
    setReserveDraftIntervenantId("__NONE__");
  }

  function openReserveDrawer(reserve?: ChantierReserveRow | null) {
    setReserveDrawerError(null);
    setReserveDrawerTab("details");
    setReserveSelectedMarkerId(null);
    setReserveDrawingMode(false);
    setReserveShowAllMarkers(false);
    setReserveMarkerSaving(false);
    setReservePhotos([]);
    setReservePhotoFile(null);
    setReservePhotoUrlCache({});
    applyReserveToDrawer(reserve ?? null);
    setReserveDrawerOpen(true);
  }

  function closeReserveDrawer() {
    if (reserveSaving || reservePhotoUploading) return;
    setReserveDrawerOpen(false);
    setReserveDrawerError(null);
    setActiveReserve(null);
    setReserveSelectedMarkerId(null);
    setReserveDrawingMode(false);
    setReserveShowAllMarkers(false);
    setReserveMarkerSaving(false);
    setReservePhotos([]);
    setReservePhotoFile(null);
    setReservePhotoUrlCache({});
  }

  async function refreshReserves() {
    if (!id) return;
    setReservesLoading(true);
    setReservesError(null);
    try {
      const data = await listReservesByChantierId(id);
      setReserves(data);
    } catch (err: any) {
      setReserves([]);
      setReservesError(err?.message ?? "Erreur chargement réserves.");
    } finally {
      setReservesLoading(false);
    }
  }

  async function refreshChantierDocuments() {
    if (!id) return [] as ChantierDocumentRow[];
    const data = await listDocumentsByChantier(id);
    setChantierDocuments(data);
    return data;
  }

  async function refreshDoeDocumentIds() {
    if (!id) return;
    try {
      const items = await listDoeItemsByChantierId(id);
      setDoeDocumentIds(items.map((item) => item.document_id));
    } catch (err) {
      console.warn("[doe] refresh ids error", err);
      setDoeDocumentIds([]);
    }
  }

  async function toggleDocumentDoe(doc: ChantierDocumentRow) {
    if (!id) return;
    const alreadyIncluded = doeDocumentIds.includes(doc.id);
    setDoeSyncingDocumentId(doc.id);
    try {
      if (alreadyIncluded) {
        const nextIds = doeDocumentIds.filter((x) => x !== doc.id);
        await removeDoeItem(id, doc.id);
        if (nextIds.length > 0) {
          await reorderDoeItems(id, nextIds);
        }
        setDoeDocumentIds(nextIds);
        setToast({ type: "ok", msg: "Document retiré du DOE." });
      } else {
        const sortOrder = doeDocumentIds.length + 1;
        await upsertDoeItem({
          chantier_id: id,
          document_id: doc.id,
          sort_order: sortOrder,
        });
        setDoeDocumentIds((prev) => [...prev, doc.id]);
        setToast({ type: "ok", msg: "Document inclus au DOE." });
      }
    } catch (err: any) {
      const message = err?.message ?? "Erreur mise à jour DOE.";
      setToast({ type: "error", msg: message });
    } finally {
      setDoeSyncingDocumentId(null);
    }
  }

  async function saveReserve() {
    if (!id) {
      setReserveDrawerError("Chantier manquant.");
      return;
    }
    if (!reserveDraftTitle.trim()) {
      setReserveDrawerError("Titre requis.");
      return;
    }
    if (!reserveDraftTaskId) {
      setReserveDrawerError("Tâche requise.");
      return;
    }

    setReserveSaving(true);
    setReserveDrawerError(null);
    try {
      const taskId = reserveDraftTaskId || null;
      const selectedTaskAssigneeIds = selectedReserveTask ? getTaskAssignedIntervenantIds(selectedReserveTask) : [];
      const derivedIntervenantId =
        taskId && selectedTaskAssigneeIds.length > 0
          ? selectedTaskAssigneeIds[0]
          : reserveDraftIntervenantId !== "__NONE__"
            ? reserveDraftIntervenantId
            : null;

      if (activeReserve) {
        const updated = await updateReserve(activeReserve.id, {
          task_id: taskId,
          zone_id: reserveDraftZoneId || null,
          title: reserveDraftTitle.trim(),
          description: reserveDraftDescription.trim() || null,
          status: reserveDraftStatus,
          priority: reserveDraftPriority,
          intervenant_id: derivedIntervenantId,
        });
        setReserves((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setActiveReserve(updated);
        await recordChantierActivity({
          actionType: "updated",
          entityType: "reserve",
          entityId: updated.id,
          reason: "Réserve mise à jour",
          changes: {
            title: updated.title,
            status: updated.status,
            priority: updated.priority,
            task_id: updated.task_id,
            zone_id: (updated as any).zone_id ?? null,
            intervenant_id: updated.intervenant_id,
          },
        });
        setToast({ type: "ok", msg: "Réserve mise à jour." });
      } else {
        const created = await createReserve({
          chantier_id: id,
          task_id: taskId,
          zone_id: reserveDraftZoneId || null,
          title: reserveDraftTitle.trim(),
          description: reserveDraftDescription.trim() || null,
          status: reserveDraftStatus,
          priority: reserveDraftPriority,
          intervenant_id: derivedIntervenantId,
        });
        setReserves((prev) => [created, ...prev]);
        await recordChantierActivity({
          actionType: "created",
          entityType: "reserve",
          entityId: created.id,
          reason: "Réserve créée",
          changes: {
            title: created.title,
            status: created.status,
            priority: created.priority,
            task_id: created.task_id,
            zone_id: (created as any).zone_id ?? null,
            intervenant_id: created.intervenant_id,
          },
        });
        setToast({ type: "ok", msg: "Réserve créée." });
        closeReserveDrawer();
      }
    } catch (err: any) {
      const message = err?.message ?? "Erreur sauvegarde reserve.";
      setReserveDrawerError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setReserveSaving(false);
    }
  }

  async function markReserveLevee() {
    if (!activeReserve) return;
    setReserveSaving(true);
    setReserveDrawerError(null);
    try {
      const updated = await setReserveStatus(activeReserve.id, "LEVEE");
      setReserves((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setActiveReserve(updated);
      setReserveDraftStatus(updated.status as ReserveStatus);
      await recordChantierActivity({
        actionType: "validated",
        entityType: "reserve",
        entityId: updated.id,
        reason: "Réserve levée",
        changes: {
          status: updated.status,
          levee_at: (updated as any).levee_at ?? null,
        },
      });
      setToast({ type: "ok", msg: "Réserve marquée levée." });
    } catch (err: any) {
      const message = err?.message ?? "Erreur mise a jour reserve.";
      setReserveDrawerError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setReserveSaving(false);
    }
  }

  async function loadReservePhotos(reserveId: string) {
    if (!id) return;
    setReservePhotosLoading(true);
    try {
      const [links, docs] = await Promise.all([
        listReserveDocuments(reserveId, "PHOTO"),
        chantierDocuments.length ? Promise.resolve(chantierDocuments) : listDocumentsByChantier(id),
      ]);
      if (!chantierDocuments.length) {
        setChantierDocuments(docs);
      }
      const map = new Map<string, ChantierDocumentRow>();
      for (const doc of docs) map.set(doc.id, doc);
      const photos = (links ?? [])
        .map((link) => map.get(link.document_id))
        .filter(Boolean) as ChantierDocumentRow[];
      setReservePhotos(photos);
    } catch (err: any) {
      console.error("[reserves] load photos error", err?.message ?? err);
    } finally {
      setReservePhotosLoading(false);
    }
  }

  async function loadReserveMarkersForPlan(planDocumentId: string) {
    if (!planDocumentId) {
      setReserveMarkers([]);
      return;
    }
    setReserveMarkersLoading(true);
    try {
      const data = await listReserveMarkersByPlan(planDocumentId);
      setReserveMarkers(data);
    } catch (err: any) {
      console.error("[reserves] load markers error", err?.message ?? err);
    } finally {
      setReserveMarkersLoading(false);
    }
  }

  async function onSelectReservePhoto(e: ChangeEvent<HTMLInputElement>) {
    if (!id || !activeReserve) return;
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setReservePhotoFile(file);
    setReservePhotoUploading(true);
    try {
      const created = await uploadDocument({
        chantierId: id,
        file,
        title: stripExtension(file.name),
        category: "Photos",
        documentType: "PHOTO",
        visibility_mode: "RESTRICTED",
        accessIntervenantIds: [],
      });
      await addReserveDocument({ reserve_id: activeReserve.id, document_id: created.id, role: "PHOTO" });
      await refreshChantierDocuments();
      await loadReservePhotos(activeReserve.id);
      setToast({ type: "ok", msg: "Photo ajoutee." });
    } catch (err: any) {
      const message = err?.message ?? "Erreur ajout photo.";
      setToast({ type: "error", msg: message });
    } finally {
      setReservePhotoUploading(false);
      setReservePhotoFile(null);
      if (reservePhotoInputRef.current) reservePhotoInputRef.current.value = "";
    }
  }

  async function onSelectReservePlan(documentId: string) {
    setReservePlanDocumentId(documentId);
    setReservePlanUrl("");
    setReservePlanError(null);
    setReserveSelectedMarkerId(null);
    setReserveDrawingMode(false);
    setReserveShowAllMarkers(false);
    setReserveMarkerSaving(false);
    setReserveMarkers([]);
    if (!documentId) return;
    const doc = documentsById.get(documentId);
    if (!doc?.storage_path) {
      setReservePlanError("Chemin de stockage manquant.");
      return;
    }
    setReservePlanLoading(true);
    try {
      const [url] = await Promise.all([
        getSignedUrl(doc.storage_path, 60),
        loadReserveMarkersForPlan(documentId),
      ]);
      setReservePlanUrl(url);
    } catch (err: any) {
      setReservePlanError(err?.message ?? "Impossible de charger le plan.");
    } finally {
      setReservePlanLoading(false);
    }
  }

  async function onCreateReserveMarker(input: {
    type: "POINT" | "LINE" | "CROSS" | "CHECK" | "TEXT";
    color: string;
    stroke_width: number;
    page_number: number | null;
    x1: number;
    y1: number;
    x2?: number | null;
    y2?: number | null;
    text?: string | null;
  }) {
    if (!reservePlanDocumentId) return;
    if (!activeReserve) {
      const createNow = confirm("Aucune réserve sélectionnée. Créer une nouvelle réserve ?");
      if (createNow) {
        openReserveDrawer(null);
      }
      return;
    }
    const documentId = reservePlanDocumentId;
    const markerType = input.type;
    const markerColor = (input.color || "#ef4444").toLowerCase();
    const markerStroke = Number(input.stroke_width || 2) || 2;
    const markerLabel = (input.text ?? activeReserve.title ?? "").trim() || null;
    const payload = {
      reserve_id: activeReserve.id,
      document_id: documentId,
      plan_document_id: documentId,
      type: markerType,
      color: markerColor,
      stroke_width: markerStroke,
      page_number: input.page_number,
      x1: input.x1,
      y1: input.y1,
      x2: input.x2 ?? null,
      y2: input.y2 ?? null,
      text: input.text ?? null,
      label: markerLabel,
      legend_label: null,
      legend_key: `${markerType}:${markerColor}`,
    } as const;

    if (import.meta.env.DEV) {
      console.debug("[markers] insert payload", payload);
    }

    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const optimistic: ReservePlanMarkerRow = {
      id: tempId,
      reserve_id: activeReserve.id,
      document_id: documentId,
      plan_document_id: documentId,
      page_number: input.page_number,
      page: input.page_number,
      type: markerType,
      color: markerColor,
      stroke_width: markerStroke,
      x1: input.x1,
      y1: input.y1,
      x2: input.x2 ?? null,
      y2: input.y2 ?? null,
      text: input.text ?? null,
      legend_label: null,
      legend_key: `${markerType}:${markerColor}`,
      x: input.x1,
      y: input.y1,
      label: markerLabel,
      created_at: new Date().toISOString(),
    };

    setReserveMarkers((prev) => [...prev, optimistic]);
    setReserveSelectedMarkerId(tempId);
    setReserveMarkerSaving(true);

    try {
      const created = await addReserveMarker(payload);
      if (import.meta.env.DEV) {
        console.debug("[markers] insert ok", created);
      }
      setReserveMarkers((prev) => prev.map((marker) => (marker.id === tempId ? created : marker)));
      setReserveSelectedMarkerId(created.id);
      await loadReserveMarkersForPlan(documentId);
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error("[markers] insert err", err);
      }
      setReserveMarkers((prev) => prev.filter((marker) => marker.id !== tempId));
      setReserveSelectedMarkerId((prev) => (prev === tempId ? null : prev));
      const message = err?.message ?? "Erreur ajout repere.";
      setToast({ type: "error", msg: message });
    } finally {
      setReserveMarkerSaving(false);
    }
  }

  function onSelectReserveMarker(marker: { id: string; reserve_id: string }, openReserve: boolean) {
    setReserveSelectedMarkerId(marker.id);
    if (!openReserve) return;
    setReserveDrawingMode(false);
    const targetReserve = reserves.find((r) => r.id === marker.reserve_id) ?? null;
    if (!targetReserve) return;
    applyReserveToDrawer(targetReserve);
    setReserveDrawerTab("details");
  }

  async function deleteReserveMarkerById(markerId: string) {
    if (!markerId) return;
    try {
      await removeReserveMarker(markerId);
      if (reservePlanDocumentId) {
        await loadReserveMarkersForPlan(reservePlanDocumentId);
      } else {
        setReserveMarkers((prev) => prev.filter((marker) => marker.id !== markerId));
      }
      setReserveSelectedMarkerId((prev) => (prev === markerId ? null : prev));
      setToast({ type: "ok", msg: "Marqueur supprimé." });
    } catch (err: any) {
      const message = err?.message ?? "Erreur suppression marqueur.";
      setToast({ type: "error", msg: message });
    }
  }

  async function deleteSelectedReserveMarker() {
    if (!reserveSelectedMarkerId) return;
    await deleteReserveMarkerById(reserveSelectedMarkerId);
  }

  async function removeReserveLegendGroup(input: {
    page_number: number | null;
    type: "POINT" | "LINE" | "CROSS" | "CHECK" | "TEXT";
    color: string;
  }) {
    if (!reservePlanDocumentId) return;
    const scope = !reserveShowAllMarkers && activeReserve ? "ACTIVE_ONLY" : "ALL_RESERVES";
    const reserveId = scope === "ACTIVE_ONLY" ? activeReserve?.id ?? null : null;
    try {
      const removed = await removeReserveMarkersGroup({
        document_id: reservePlanDocumentId,
        page_number: input.page_number ?? 1,
        type: input.type,
        color: input.color,
        reserve_id: reserveId,
        scope,
      });
      await loadReserveMarkersForPlan(reservePlanDocumentId);
      setReserveSelectedMarkerId(null);
      setToast({ type: "ok", msg: `${removed} marqueur(s) supprimé(s).` });
    } catch (err: any) {
      const message = err?.message ?? "Erreur suppression du groupe.";
      setToast({ type: "error", msg: message });
      throw err;
    }
  }

  async function renameReserveLegendGroup(input: {
    page_number: number | null;
    type: "POINT" | "LINE" | "CROSS" | "CHECK" | "TEXT";
    color: string;
    label: string | null;
  }) {
    if (!reservePlanDocumentId) return;
    const scope = !reserveShowAllMarkers && activeReserve ? "ACTIVE_ONLY" : "ALL_RESERVES";
    const reserveId = scope === "ACTIVE_ONLY" ? activeReserve?.id ?? null : null;
    try {
      const updated = await renameReserveMarkersGroup({
        document_id: reservePlanDocumentId,
        page_number: input.page_number ?? 1,
        type: input.type,
        color: input.color,
        new_label: input.label,
        reserve_id: reserveId,
        scope,
      });
      if (updated === 0) {
        setToast({ type: "error", msg: "Aucun marqueur correspondant à renommer sur cette page." });
        return;
      }
      await loadReserveMarkersForPlan(reservePlanDocumentId);
      setToast({ type: "ok", msg: `${updated} marqueur(s) renommé(s).` });
    } catch (err: any) {
      const message = err?.message ?? "Erreur renommage du groupe.";
      setToast({ type: "error", msg: message });
      throw err;
    }
  }

  async function openReserveDocument(doc: ChantierDocumentRow) {
    if (!doc.storage_path) {
      setToast({ type: "error", msg: "Chemin de stockage manquant." });
      return;
    }
    try {
      const url = await getSignedUrl(doc.storage_path, 60);
      window.open(url, "_blank", "noopener");
    } catch (err: any) {
      const message = err?.message ?? "Erreur ouverture document.";
      setToast({ type: "error", msg: message });
    }
  }

  async function openTaskDocumentsModal(task: ChantierTaskRow) {
    if (!id) return;
    setTaskDocumentsModalError(null);
    setTaskDocumentsModalTask(task);
    setTaskDocumentsModalOpen(true);
    setTaskDocumentsQuery("");
    try {
      const [docs, linkedIds] = await Promise.all([
        chantierDocuments.length ? Promise.resolve(chantierDocuments) : listDocumentsByChantier(id),
        listTaskDocuments(task.id),
      ]);
      const permissions =
        linkedIds.length > 0 ? await listDocumentPermissionsByDocumentIds(id, linkedIds) : [];
      const permissionIntervenantIds = Array.from(
        new Set(permissions.map((row) => row.intervenant_id).filter(Boolean)),
      );
      const allIntervenantIds = intervenants.map((intervenant) => intervenant.id);
      const hasAllIntervenants =
        allIntervenantIds.length > 0 &&
        permissionIntervenantIds.length > 0 &&
        allIntervenantIds.every((intervenantId) => permissionIntervenantIds.includes(intervenantId));

      setChantierDocuments(docs);
      setTaskDocumentsSelection(linkedIds);
      setTaskDocumentsIntervenantIds(
        permissionIntervenantIds.length > 0
          ? permissionIntervenantIds
          : getTaskAssignedIntervenantIds(task),
      );
      setTaskDocumentsShareAll(hasAllIntervenants);
    } catch (err: any) {
      setTaskDocumentsModalError(err?.message ?? "Erreur chargement documents.");
    }
  }

  function closeTaskDocumentsModal() {
    if (taskDocumentsModalSaving) return;
    setTaskDocumentsModalOpen(false);
    setTaskDocumentsModalTask(null);
    setTaskDocumentsSelection([]);
    setTaskDocumentsIntervenantIds([]);
    setTaskDocumentsShareAll(true);
    setTaskDocumentsQuery("");
    setTaskDocumentsModalError(null);
  }

  async function saveTaskDocuments() {
    if (!taskDocumentsModalTask) return;
    const allIntervenantIds = intervenants.map((intervenant) => intervenant.id);
    const effectiveIntervenantIds = Array.from(
      new Set(
        (taskDocumentsShareAll ? allIntervenantIds : taskDocumentsIntervenantIds).filter(Boolean),
      ),
    );

    if (taskDocumentsSelection.length > 0 && effectiveIntervenantIds.length === 0) {
      setTaskDocumentsModalError("Sélectionne au moins un intervenant autorisé.");
      return;
    }

    setTaskDocumentsModalSaving(true);
    setTaskDocumentsModalError(null);
    try {
      await adminSetTaskDocumentPermissions({
        taskId: taskDocumentsModalTask.id,
        documentIds: taskDocumentsSelection,
        intervenantIds: effectiveIntervenantIds,
      });
      const links = await listTaskDocumentsByTaskIds(tasks.map((t) => t.id));
      setTaskDocumentLinks(links);
      setToast({ type: "ok", msg: "Documents et autorisations mis à jour." });
      closeTaskDocumentsModal();
    } catch (err: any) {
      const message = err?.message ?? "Erreur mise a jour des documents.";
      setTaskDocumentsModalError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setTaskDocumentsModalSaving(false);
    }
  }

  /* ---------------- loaders ---------------- */
  async function refreshIntervenants() {
    if (!id) return;
    setIntervenantsLoading(true);
    setIntervenantsError(null);
    try {
      const data = await listIntervenantsByChantierId(id);
      setIntervenants(data);
    } catch (e: any) {
      setIntervenants([]);
      setIntervenantsError(e?.message ?? "Erreur chargement intervenants.");
    } finally {
      setIntervenantsLoading(false);
    }
  }

  async function refreshAllIntervenants() {
    setAllIntervenantsLoading(true);
    try {
      const data = await listIntervenants();
      setAllIntervenants(data);
    } catch {
      setAllIntervenants([]);
    } finally {
      setAllIntervenantsLoading(false);
    }
  }

  async function refreshTaskAssigneesOnly(taskRows: ChantierTaskRow[]) {
    const ids = taskRows.map((task) => task.id);
    const grouped = await listTaskAssigneeIdsByTaskIds(ids);
    const fallbackMap: Record<string, string[]> = {};
    for (const task of taskRows) {
      const explicitIds = uniqueIds(grouped[task.id] ?? []);
      fallbackMap[task.id] = explicitIds.length > 0 ? explicitIds : uniqueIds([task.intervenant_id]);
    }
    setTaskAssigneeIdsByTaskId(fallbackMap);
  }

  async function refreshZonesOnly() {
    if (!id) return;
    try {
      const result = await listChantierZones(id);
      setZones(result.zones);
    } catch (e) {
      console.warn("[zones] refresh error", e);
      setZones([]);
    }
  }

  async function refreshTasksOnly() {
    if (!id) return;
    const tasksResult = await getTasksByChantierIdDetailed(id);
    setTasks(tasksResult.tasks);
    await refreshTaskAssigneesOnly(tasksResult.tasks);
    setTasksPlanningWarning(
      tasksResult.planningColumnsMissing
        ? `Migration planning manquante sur Supabase. Colonnes attendues sur public.chantier_tasks: ${tasksResult.expectedPlanningColumns.join(", ")}.`
        : null,
    );
  }

  async function refreshTimeEntriesOnly() {
    if (!id) return;
    setTimeEntriesLoading(true);
    setTimeEntriesError(null);
    try {
      const rows = await listChantierTimeEntriesByChantierId(id);
      setTimeEntries(rows);
    } catch (e: any) {
      setTimeEntries([]);
      setTimeEntriesError(e?.message ?? "Erreur lors du chargement des saisies temps.");
    } finally {
      setTimeEntriesLoading(false);
    }
  }

  async function refreshDevisOnly(preferredDevisId?: string | null) {
    if (!id) return;
    setDevisLoading(true);
    setDevisError(null);
    try {
      const devisData = await listDevisByChantierId(id);
      setDevis(devisData);
      if (preferredDevisId !== undefined) {
        setActiveDevisId(preferredDevisId);
      }
    } catch (e: any) {
      setDevis([]);
      setDevisError(e?.message ?? "Erreur lors du chargement des devis.");
    } finally {
      setDevisLoading(false);
    }
  }

  async function refreshMateriel() {
    if (!id) return;
    setMaterielLoading(true);
    setMaterielError(null);
    try {
      const data = await listMaterielDemandesByChantierId(id);
      setMateriel(data);
    } catch (e: any) {
      setMateriel([]);
      setMaterielError(e?.message ?? "Erreur chargement matériel.");
    } finally {
      setMaterielLoading(false);
    }
  }

  async function refreshConsignes() {
    if (!id) return;
    setConsignesLoading(true);
    setConsignesError(null);
    try {
      const data = await listChantierConsignesByChantierId(id);
      setConsignes(data);
    } catch (e: any) {
      setConsignes([]);
      setConsignesError(e?.message ?? "Erreur chargement consignes.");
    } finally {
      setConsignesLoading(false);
    }
  }

  async function refreshActivityLogs() {
    if (!id) return;
    setActivityLogsLoading(true);
    setActivityLogsError(null);
    try {
      const result = await listChantierActivityLogs(id);
      setActivityLogs(result.logs);
      setActivityLogSchemaReady(result.schemaReady);
    } catch (e: any) {
      setActivityLogs([]);
      setActivityLogsError(e?.message ?? "Erreur chargement journal chantier.");
    } finally {
      setActivityLogsLoading(false);
    }
  }

  async function recordChantierActivity(input: {
    actionType: string;
    entityType: string;
    entityId?: string | null;
    reason?: string | null;
    changes?: Record<string, unknown>;
  }) {
    if (!id) return;
    try {
      await appendChantierActivityLog({
        chantierId: id,
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        reason: input.reason ?? null,
        changes: input.changes ?? {},
      });
      if (tab === "journal") {
        await refreshActivityLogs();
      }
    } catch (e) {
      console.warn("[activity-log] append failed", e);
    }
  }

  function resetConsigneForm() {
    setConsigneEditingId(null);
    setConsigneDescription("");
    setConsigneDateDebut("");
    setConsigneTaskId("");
    setConsigneAppliesToAll(true);
    setConsigneIntervenantIds([]);
  }

  function startEditConsigne(row: ChantierConsigneRow) {
    setConsigneEditingId(row.id);
    setConsigneDescription(row.description);
    setConsigneDateDebut(row.date_debut);
    setConsigneTaskId(row.task_id ?? "");
    setConsigneAppliesToAll(row.applies_to_all);
    setConsigneIntervenantIds(row.assignee_ids);
    setTab("consignes");
  }

  async function saveConsigne(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    const description = consigneDescription.trim();
    const dateDebut = consigneDateDebut.trim();

    if (!description) {
      setToast({ type: "error", msg: "Description de consigne obligatoire." });
      return;
    }

    setConsigneSaving(true);
    try {
      if (consigneEditingId) {
        const updatedConsigne = await updateChantierConsigne(consigneEditingId, {
          chantier_id: id,
          description,
          date_debut: dateDebut || undefined,
          date_fin: null,
          task_id: consigneTaskId || null,
          applies_to_all: consigneAppliesToAll,
          intervenant_ids: consigneAppliesToAll ? [] : consigneIntervenantIds,
        });
        await recordChantierActivity({
          actionType: "updated",
          entityType: "consigne",
          entityId: updatedConsigne.id,
          reason: "Consigne mise à jour",
          changes: {
            date_debut: updatedConsigne.date_debut,
            task_id: updatedConsigne.task_id,
            applies_to_all: updatedConsigne.applies_to_all,
          },
        });
        setToast({ type: "ok", msg: "Consigne mise a jour." });
      } else {
        const createdConsigne = await createChantierConsigne({
          chantier_id: id,
          description,
          date_debut: dateDebut || undefined,
          date_fin: null,
          task_id: consigneTaskId || null,
          applies_to_all: consigneAppliesToAll,
          intervenant_ids: consigneAppliesToAll ? [] : consigneIntervenantIds,
        });
        await recordChantierActivity({
          actionType: "created",
          entityType: "consigne",
          entityId: createdConsigne.id,
          reason: "Consigne créée",
          changes: {
            title: createdConsigne.title,
            date_debut: createdConsigne.date_debut,
            task_id: createdConsigne.task_id,
          },
        });
        setToast({ type: "ok", msg: "Consigne creee." });
      }
      resetConsigneForm();
      await refreshConsignes();
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur enregistrement consigne." });
    } finally {
      setConsigneSaving(false);
    }
  }

  async function removeConsigne(row: ChantierConsigneRow) {
    const preview = row.description.trim();
    const label = preview ? `${preview.slice(0, 60)}${preview.length > 60 ? "..." : ""}` : "cette consigne";
    if (!confirm(`Supprimer ${label} ?`)) return;
    try {
      await deleteChantierConsigne(row.id);
      await recordChantierActivity({
        actionType: "deleted",
        entityType: "consigne",
        entityId: row.id,
        reason: "Consigne supprimée",
        changes: {
          title: row.title,
          task_id: row.task_id,
        },
      });
      if (consigneEditingId === row.id) {
        resetConsigneForm();
      }
      await refreshConsignes();
      setToast({ type: "ok", msg: "Consigne supprimee." });
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur suppression consigne." });
    }
  }

  function resetTimeEntryDraft() {
    setTimeEntryTaskId("");
    setTimeEntryIntervenantId("");
    setTimeEntryDate(new Date().toISOString().slice(0, 10));
    setTimeEntryHours("");
    setTimeEntryQuantity("");
    setTimeEntryNote("");
  }

  async function saveTimeEntry() {
    if (!id) return;

    const taskId = String(timeEntryTaskId ?? "").trim();
    const intervenantId = String(timeEntryIntervenantId ?? "").trim();
    const workDate = String(timeEntryDate ?? "").trim();
    const hours = toNumberOrNull(timeEntryHours);
    const quantity = timeEntryQuantity.trim() ? toNumberOrNull(timeEntryQuantity) : null;

    if (!taskId) {
      setToast({ type: "error", msg: "Choisis une tâche." });
      return;
    }
    if (!intervenantId) {
      setToast({ type: "error", msg: "Choisis un intervenant." });
      return;
    }
    if (!workDate) {
      setToast({ type: "error", msg: "Choisis une date." });
      return;
    }
    if (hours === null || hours <= 0) {
      setToast({ type: "error", msg: "Durée invalide (heures > 0)." });
      return;
    }
    if (quantity !== null && quantity <= 0) {
      setToast({ type: "error", msg: "Quantité invalide." });
      return;
    }

    setTimeEntrySaving(true);
    try {
      await createChantierTimeEntry({
        chantier_id: id,
        task_id: taskId,
        intervenant_id: intervenantId,
        work_date: workDate,
        duration_hours: hours,
        quantite_realisee: quantity,
        note: timeEntryNote.trim() || null,
      });
      await recordChantierActivity({
        actionType: "time_logged",
        entityType: "time_entry",
        entityId: taskId,
        reason: "Saisie temps ajoutée",
        changes: {
          task_id: taskId,
          intervenant_id: intervenantId,
          work_date: workDate,
          duration_hours: hours,
          quantite_realisee: quantity,
        },
      });
      await Promise.all([refreshTasksOnly(), refreshTimeEntriesOnly()]);
      resetTimeEntryDraft();
      setToast({ type: "ok", msg: "Saisie temps enregistrée." });
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur lors de l'enregistrement de la saisie temps." });
    } finally {
      setTimeEntrySaving(false);
    }
  }

  async function removeTimeEntry(entryId: string) {
    if (!entryId) return;
    setTimeEntryDeletingId(entryId);
    try {
      await deleteChantierTimeEntry(entryId);
      await recordChantierActivity({
        actionType: "deleted",
        entityType: "time_entry",
        entityId: entryId,
        reason: "Saisie temps supprimée",
      });
      await Promise.all([refreshTasksOnly(), refreshTimeEntriesOnly()]);
      setToast({ type: "ok", msg: "Saisie temps supprimée." });
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur lors de la suppression de la saisie temps." });
    } finally {
      setTimeEntryDeletingId(null);
    }
  }
  /* ---------------- initial load ---------------- */
  useEffect(() => {
    let alive = true;

    async function loadAll() {
      if (!id) return;
      setLoading(true);
      setErrorMsg(null);

      try {
        const chantier = await getChantierById(id);
        if (!alive) return;
        setItem(chantier);

        // tasks
        setTasksLoading(true);
        setTasksError(null);
        setTasksPlanningWarning(null);
        try {
          const tasksData = await getTasksByChantierIdDetailed(id);
          if (!alive) return;
          setTasks(tasksData.tasks);
          await refreshTaskAssigneesOnly(tasksData.tasks);
          setTasksPlanningWarning(
            tasksData.planningColumnsMissing
              ? `Migration planning manquante sur Supabase. Colonnes attendues sur public.chantier_tasks: ${tasksData.expectedPlanningColumns.join(", ")}.`
              : null,
          );
        } catch (e: any) {
          if (!alive) return;
          setTasksError(e?.message ?? "Erreur lors du chargement des tâches.");
          setTasks([]);
          setTaskAssigneeIdsByTaskId({});
          setTasksPlanningWarning(null);
        } finally {
          if (alive) setTasksLoading(false);
        }

        setTimeEntriesLoading(true);
        setTimeEntriesError(null);
        try {
          const rows = await listChantierTimeEntriesByChantierId(id);
          if (!alive) return;
          setTimeEntries(rows);
        } catch (e: any) {
          if (!alive) return;
          setTimeEntries([]);
          setTimeEntriesError(e?.message ?? "Erreur lors du chargement des saisies temps.");
        } finally {
          if (alive) setTimeEntriesLoading(false);
        }

        // devis
        setDevisLoading(true);
        setDevisError(null);
        try {
          const devisData = await listDevisByChantierId(id);
          if (!alive) return;
          setDevis(devisData);
        } catch (e: any) {
          if (!alive) return;
          setDevisError(e?.message ?? "Erreur lors du chargement des devis.");
          setDevis([]);
        } finally {
          if (alive) setDevisLoading(false);
        }

        // intervenants
        setIntervenantsLoading(true);
        setIntervenantsError(null);
        try {
          const iData = await listIntervenantsByChantierId(id);
          if (!alive) return;
          setIntervenants(iData);
        } catch (e: any) {
          if (!alive) return;
          setIntervenants([]);
          setIntervenantsError(e?.message ?? "Erreur chargement intervenants.");
        } finally {
          if (alive) setIntervenantsLoading(false);
        }

        setAllIntervenantsLoading(true);
        try {
          const allIntervenantsData = await listIntervenants();
          if (!alive) return;
          setAllIntervenants(allIntervenantsData);
        } catch {
          if (!alive) return;
          setAllIntervenants([]);
        } finally {
          if (alive) setAllIntervenantsLoading(false);
        }

        // matériel
        setMaterielLoading(true);
        setMaterielError(null);
        try {
          const mData = await listMaterielDemandesByChantierId(id);
          if (!alive) return;
          setMateriel(mData);
        } catch (e: any) {
          if (!alive) return;
          setMateriel([]);
          setMaterielError(e?.message ?? "Erreur chargement matériel.");
        } finally {
          if (alive) setMaterielLoading(false);
        }

        setConsignesLoading(true);
        setConsignesError(null);
        try {
          const consignesData = await listChantierConsignesByChantierId(id);
          if (!alive) return;
          setConsignes(consignesData);
        } catch (e: any) {
          if (!alive) return;
          setConsignes([]);
          setConsignesError(e?.message ?? "Erreur chargement consignes.");
        } finally {
          if (alive) setConsignesLoading(false);
        }

        try {
          await refreshZonesOnly();
        } catch (e) {
          console.warn("[zones] initial load error", e);
        }
      } catch (e: any) {
        if (!alive) return;
        setErrorMsg(e?.message ?? "Erreur lors du chargement du chantier.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadAll();
    return () => {
      alive = false;
    };
  }, [id]);

  /* ---------------- load documents ---------------- */
  useEffect(() => {
    let alive = true;

    async function loadDocuments() {
      if (!id || tab !== "documents") return;
      setDocumentsLoading(true);
      setDocumentsError(null);
      try {
        const data = await listDocumentsByChantier(id);
        if (!alive) return;
        setDocuments(data);
        setChantierDocuments(data);
      } catch (e: any) {
        if (!alive) return;
        setDocuments([]);
        setDocumentsError(e?.message ?? "Erreur chargement documents.");
      } finally {
        if (alive) setDocumentsLoading(false);
      }
    }

    loadDocuments();
    return () => {
      alive = false;
    };
  }, [id, tab]);

  /* ---------------- load reserves ---------------- */
  useEffect(() => {
    if (!id) return;
    void refreshReserves();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void refreshDoeDocumentIds();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    if (
      tab !== "preparer" &&
      tab !== "devis-taches" &&
      tab !== "reserves" &&
      tab !== "achats" &&
      tab !== "photos"
    ) {
      return;
    }
    void refreshZonesOnly();
  }, [id, tab]);

  useEffect(() => {
    if (!id || tab !== "journal") return;
    void refreshActivityLogs();
  }, [id, tab]);

  const documentEditInfoMessage =
    documentEditOpen && !documentEditDoc ? "Document introuvable ou non accessible." : null;

  /* ---------------- reserve drawer side effects ---------------- */
  useEffect(() => {
    if (!reserveDrawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [reserveDrawerOpen]);

  useEffect(() => {
    if (!reserveDrawerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeReserveDrawer();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [reserveDrawerOpen]);

  useEffect(() => {
    if (!reserveDrawerOpen || !activeReserve) return;
    void loadReservePhotos(activeReserve.id);
  }, [reserveDrawerOpen, activeReserve?.id]);

  useEffect(() => {
    if (!reserveDrawerOpen || !reservePlanDocumentId) return;
    void loadReserveMarkersForPlan(reservePlanDocumentId);
  }, [reserveDrawerOpen, reservePlanDocumentId]);

  useEffect(() => {
    if (!reserveDrawerOpen || reservePhotos.length === 0) return;
    let alive = true;

    async function loadPhotoUrls() {
      const missing = reservePhotos.filter(
        (doc) => doc.storage_path && !reservePhotoUrlCache[doc.id],
      );
      if (missing.length === 0) return;

      for (const doc of missing) {
        try {
          const url = await getSignedUrl(doc.storage_path, 60);
          if (!alive) return;
          setReservePhotoUrlCache((prev) => ({ ...prev, [doc.id]: url }));
        } catch (err) {
          if (!alive) return;
          console.warn("[reserves] photo url error", doc.id, err);
        }
      }
    }

    void loadPhotoUrls();
    return () => {
      alive = false;
    };
  }, [reserveDrawerOpen, reservePhotos, reservePhotoUrlCache]);

  /* ---------------- load task documents links ---------------- */
  useEffect(() => {
    let alive = true;

    async function loadTaskDocuments() {
      if (!id) return;
      if (!tasks.length) {
        setTaskDocumentLinks([]);
        return;
      }
      setTaskDocumentsLoading(true);
      try {
        const [docs, links] = await Promise.all([
          listDocumentsByChantier(id),
          listTaskDocumentsByTaskIds(tasks.map((t) => t.id)),
        ]);
        if (!alive) return;
        setChantierDocuments(docs);
        setTaskDocumentLinks(links);
      } catch (e: any) {
        if (!alive) return;
        console.error("[documents] load task documents error", e?.message ?? e);
      } finally {
        if (alive) setTaskDocumentsLoading(false);
      }
    }

    loadTaskDocuments();
    return () => {
      alive = false;
    };
  }, [id, tasks]);

  /* ---------------- load lignes devis ---------------- */
  useEffect(() => {
    let alive = true;

    async function loadLignes() {
      if (!activeDevisId) {
        setLignes([]);
        return;
      }
      setLignesLoading(true);
      setLignesError(null);
      try {
        const data = await listDevisLignes(activeDevisId);
        if (!alive) return;
        setLignes(data);
      } catch (e: any) {
        if (!alive) return;
        setLignesError(e?.message ?? "Erreur lors du chargement des lignes.");
        setLignes([]);
      } finally {
        if (alive) setLignesLoading(false);
      }
    }

    loadLignes();
    return () => {
      alive = false;
    };
  }, [activeDevisId]);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const task of tasks) {
      const progress = computeTaskProgress(task);
      next[task.id] = String(progress.offsetPercent);
    }
    setTaskProgressDrafts(next);
  }, [tasks]);

  /* ---------------- computed ---------------- */
  const badge = useMemo(() => statusBadge(item?.status, t), [item?.status, t]);

  const avancement = useMemo(() => {
    if (!tasks || tasks.length === 0) return 0;
    const done = tasks.filter((t) => t.status === "FAIT").length;
    return clamp(Math.round((done / tasks.length) * 100), 0, 100);
  }, [tasks]);
  const completedTasksCount = useMemo(() => tasks.filter((task) => task.status === "FAIT").length, [tasks]);
  const inProgressTasksCount = useMemo(() => tasks.filter((task) => task.status === "EN_COURS").length, [tasks]);
  const todoTasksCount = useMemo(
    () => tasks.filter((task) => task.status !== "FAIT" && task.status !== "EN_COURS").length,
    [tasks],
  );

  const intervenantById = useMemo(() => {
    const m = new Map<string, IntervenantRow>();
    for (const i of intervenants) m.set(i.id, i);
    return m;
  }, [intervenants]);

  const assignableIntervenants = useMemo(() => {
    const assignedIds = new Set(intervenants.map((intervenant) => intervenant.id));
    const query = existingIntervenantQuery.trim().toLowerCase();

    return allIntervenants
      .filter((intervenant) => !assignedIds.has(intervenant.id))
      .filter((intervenant) => {
        if (!query) return true;
        return [intervenant.nom, intervenant.email, intervenant.telephone]
          .map((value) => String(value ?? "").toLowerCase())
          .some((value) => value.includes(query));
      })
      .slice(0, 8);
  }, [allIntervenants, existingIntervenantQuery, intervenants]);

  const taskById = useMemo(() => {
    const m = new Map<string, ChantierTaskRow>();
    for (const t of tasks) m.set(t.id, t);
    return m;
  }, [tasks]);

  const zoneById = useMemo(() => {
    const map = new Map<string, ChantierZoneRow>();
    for (const zone of zones) {
      map.set(zone.id, zone);
    }
    return map;
  }, [zones]);

  function resolveZoneName(zoneId: string | null | undefined): string {
    const cleanZoneId = String(zoneId ?? "").trim();
    if (!cleanZoneId) return "Sans zone";
    return zoneById.get(cleanZoneId)?.nom ?? "Zone inconnue";
  }

  const timeEntriesByTaskId = useMemo(() => {
    const grouped = new Map<string, ChantierTimeEntryRow[]>();
    for (const entry of timeEntries) {
      const taskId = String(entry.task_id ?? "").trim();
      if (!taskId) continue;
      const current = grouped.get(taskId) ?? [];
      current.push(entry);
      grouped.set(taskId, current);
    }
    return grouped;
  }, [timeEntries]);

  const taskOrderLabelById = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((task, index) => {
      map.set(task.id, index + 1);
    });
    return map;
  }, [tasks]);

  function getTaskAssignedIntervenantIds(task: Pick<ChantierTaskRow, "id" | "intervenant_id">): string[] {
    const explicitIds = uniqueIds(taskAssigneeIdsByTaskId[task.id] ?? []);
    return explicitIds.length > 0 ? explicitIds : uniqueIds([task.intervenant_id]);
  }

  function getTaskAssignedIntervenantNames(task: Pick<ChantierTaskRow, "id" | "intervenant_id">): string[] {
    return getTaskAssignedIntervenantIds(task)
      .map((intervenantId) => intervenantById.get(intervenantId)?.nom ?? "")
      .filter(Boolean);
  }

  useEffect(() => {
    if (!timeEntryTaskId) {
      setTimeEntryIntervenantId("");
      return;
    }
    const task = taskById.get(timeEntryTaskId);
    if (!task) return;

    const allowedIds = getTaskAssignedIntervenantIds(task);
    if (!allowedIds.length) return;
    if (!timeEntryIntervenantId || !allowedIds.includes(timeEntryIntervenantId)) {
      setTimeEntryIntervenantId(allowedIds[0] ?? "");
    }
  }, [timeEntryTaskId, timeEntryIntervenantId, taskById, taskAssigneeIdsByTaskId, intervenants]);

  const selectedReserveTask = useMemo(() => {
    if (!reserveDraftTaskId) return null;
    return taskById.get(reserveDraftTaskId) ?? null;
  }, [taskById, reserveDraftTaskId]);

  useEffect(() => {
    let alive = true;
    if (!reserveDraftTaskId) return () => {};

    const assignedIds = selectedReserveTask ? getTaskAssignedIntervenantIds(selectedReserveTask) : [];
    if (assignedIds.length > 0) {
      setReserveDraftIntervenantId(assignedIds[0]);
      return () => {};
    }

    (async () => {
      try {
        const assigneeId = await getTaskAssignee(reserveDraftTaskId);
        if (!alive) return;
        setReserveDraftIntervenantId(assigneeId ?? "__NONE__");
      } catch (err) {
        if (!alive) return;
        console.warn("[reserves] assignee lookup error", err);
      }
    })();

    return () => {
      alive = false;
    };
  }, [reserveDraftTaskId, selectedReserveTask, taskAssigneeIdsByTaskId]);

  const lotOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    const add = (value: string | null | undefined) => {
      const normalized = normalizeLotLabel(value);
      if (!normalized) return;
      const key = normalized.toLocaleLowerCase("fr");
      if (!byKey.has(key)) byKey.set(key, normalized);
    };

    DEFAULT_STANDARD_LOTS.forEach((name) => add(name));
    for (const task of tasks) {
      add(task.lot);
      if (!normalizeLotLabel(task.lot)) add(task.corps_etat);
    }
    if (newLotSelection && newLotSelection !== "__CREATE__") add(newLotSelection);
    if (editLotSelection && editLotSelection !== "__CREATE__") add(editLotSelection);

    return [...byKey.values()];
  }, [tasks, newLotSelection, editLotSelection]);

  function resolveTaskLotName(task: Pick<ChantierTaskRow, "lot" | "corps_etat">): string {
    const fromLotText = normalizeLotLabel(task.lot);
    if (fromLotText) return fromLotText;
    const fromCorpsEtat = normalizeLotLabel(task.corps_etat);
    if (fromCorpsEtat) return fromCorpsEtat;
    return "A classer";
  }

  useEffect(() => {
    if (!lotOptions.length) return;
    if (newLotSelection === "__CREATE__") return;
    if (newLotSelection && lotOptions.includes(newLotSelection)) return;
    const firstLot = lotOptions[0];
    setNewLotSelection(firstLot);
    setNewCorpsEtat(firstLot);
  }, [lotOptions, newLotSelection]);

  const documentsById = useMemo(() => {
    const map = new Map<string, ChantierDocumentRow>();
    for (const doc of chantierDocuments) {
      map.set(doc.id, doc);
    }
    return map;
  }, [chantierDocuments]);

  const planDocuments = useMemo(() => {
    return chantierDocuments.filter((doc) => {
      return doc.document_type === "PLAN" || (doc.category ?? "") === "Plans";
    });
  }, [chantierDocuments]);

  const taskDocumentsByTaskId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of taskDocumentLinks) {
      if (!map.has(link.task_id)) map.set(link.task_id, []);
      map.get(link.task_id)?.push(link.document_id);
    }
    return map;
  }, [taskDocumentLinks]);

  const filteredReserves = useMemo(() => {
    if (reservesFilter === "ALL") return reserves;
    if (reservesFilter === "LEVEES") {
      return reserves.filter((r) => (r.status ?? "") === "LEVEE");
    }
    return reserves.filter((r) => (r.status ?? "") !== "LEVEE");
  }, [reserves, reservesFilter]);

  const reserveMarkersForPlan = useMemo(() => {
    if (!reservePlanDocumentId) return [];
    const markersOnPlan = reserveMarkers.filter((m) => {
      return (m.document_id ?? m.plan_document_id) === reservePlanDocumentId;
    });
    if (reserveShowAllMarkers) return markersOnPlan;
    if (!activeReserve) return markersOnPlan;
    return markersOnPlan.filter((marker) => marker.reserve_id === activeReserve.id);
  }, [reserveMarkers, reservePlanDocumentId, reserveShowAllMarkers, activeReserve?.id]);

  const selectedPlanDoc = useMemo(() => {
    if (!reservePlanDocumentId) return null;
    return documentsById.get(reservePlanDocumentId) ?? null;
  }, [documentsById, reservePlanDocumentId]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const assignedIds = getTaskAssignedIntervenantIds(t);
      if (filterIntervenant === "__NONE__") {
        if (assignedIds.length > 0) return false;
      } else if (filterIntervenant !== "__ALL__") {
        if (!assignedIds.includes(filterIntervenant)) return false;
      }
      const currentQualityStatus = ((t as any).quality_status ?? "a_faire") as TaskQualityStatus;
      if (filterTaskQuality !== "__ALL__" && currentQualityStatus !== filterTaskQuality) return false;
      return true;
    });
  }, [tasks, filterIntervenant, filterTaskQuality, taskAssigneeIdsByTaskId]);

  const totalTempsReel = useMemo(() => {
    return (tasks as any[]).reduce((sum, t) => sum + (Number(t.temps_reel_h ?? 0) || 0), 0);
  }, [tasks]);

  const tempsPrevues = Number((item as any)?.heures_prevues ?? 0) || 0;
  const reservesOuvertes = useMemo(() => {
    return reserves.filter((r) => (r.status ?? "") !== "LEVEE").length;
  }, [reserves]);
  const overdueTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return tasks.filter((task) => {
      if (!task.date_fin) return false;
      if (task.status === "FAIT") return false;
      const timestamp = Date.parse(`${task.date_fin}T00:00:00`);
      return Number.isFinite(timestamp) && timestamp < today.getTime();
    });
  }, [tasks]);
  const blockedLots = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const byLot = new Map<string, { hasProgress: boolean; hasPastCommitment: boolean }>();
    tasks.forEach((task) => {
      const lot = resolveTaskLotName(task);
      const current = byLot.get(lot) ?? { hasProgress: false, hasPastCommitment: false };
      if (task.status === "EN_COURS" || task.status === "FAIT" || Number(task.temps_reel_h ?? 0) > 0) {
        current.hasProgress = true;
      }
      const anchor = task.date_fin ?? task.date_debut ?? task.date;
      if (anchor) {
        const timestamp = Date.parse(`${anchor}T00:00:00`);
        if (Number.isFinite(timestamp) && timestamp < today.getTime()) {
          current.hasPastCommitment = true;
        }
      }
      byLot.set(lot, current);
    });
    return [...byLot.entries()]
      .filter(([, state]) => state.hasPastCommitment && !state.hasProgress)
      .map(([lot]) => lot);
  }, [tasks]);
  const heuresDepassees = useMemo(() => {
    if (tempsPrevues <= 0) return 0;
    return Math.max(0, totalTempsReel - tempsPrevues);
  }, [tempsPrevues, totalTempsReel]);
  const missingRecentTime = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const latestRelevantUpdate = tasks.reduce((latest, task) => {
      if (Number(task.temps_reel_h ?? 0) <= 0) return latest;
      const timestamp = Date.parse(task.updated_at ?? task.created_at ?? "");
      return Number.isFinite(timestamp) ? Math.max(latest, timestamp) : latest;
    }, 0);
    if (totalTempsReel <= 0) return true;
    if (latestRelevantUpdate <= 0) return true;
    return latestRelevantUpdate < cutoff;
  }, [tasks, totalTempsReel]);
  const alertCards = useMemo(() => {
    const rows: Array<{ key: string; title: string; detail: string; tone: "warning" | "danger" | "ok" }> = [];
    if (overdueTasks.length > 0) {
      rows.push({
        key: "retard",
        title: "Tâches en retard",
        detail: `${overdueTasks.length} tâche${overdueTasks.length > 1 ? "s" : ""} à relancer`,
        tone: overdueTasks.length > 3 ? "danger" : "warning",
      });
    }
    if (blockedLots.length > 0) {
      rows.push({
        key: "lots",
        title: "Lots bloqués",
        detail: blockedLots.slice(0, 2).join(" • "),
        tone: "warning",
      });
    }
    if (heuresDepassees > 0) {
      rows.push({
        key: "budget",
        title: "Dépassement budget",
        detail: `${heuresDepassees.toFixed(1)} h au-dessus du prévu`,
        tone: "danger",
      });
    }
    if (missingRecentTime) {
      rows.push({
        key: "temps",
        title: "Absence de saisie récente",
        detail: "Aucune saisie temps récente sur le chantier",
        tone: "warning",
      });
    }
    return rows;
  }, [blockedLots, heuresDepassees, missingRecentTime, overdueTasks.length]);

  /* ---------------- actions ---------------- */

  // ----- tâches -----
  function createLotAndSelect(lotName: string, target: "add" | "edit"): string | null {
    const cleanName = normalizeLotLabel(lotName);
    if (!cleanName) {
      setTasksError("Le nom du lot est obligatoire.");
      return null;
    }

    const existing = lotOptions.find((option) => option.toLocaleLowerCase("fr") === cleanName.toLocaleLowerCase("fr"));
    if (existing) {
      if (target === "add") {
        setNewLotSelection(existing);
        setNewCorpsEtat(existing);
        setNewLotDraftName("");
      } else {
        setEditLotSelection(existing);
        setEditCorpsEtat(existing);
        setEditLotDraftName("");
      }
      return existing;
    }

    setTasksError(null);
    if (target === "add") {
      setNewLotSelection(cleanName);
      setNewCorpsEtat(cleanName);
      setNewLotDraftName("");
    } else {
      setEditLotSelection(cleanName);
      setEditCorpsEtat(cleanName);
      setEditLotDraftName("");
    }

    setToast({ type: "ok", msg: "Lot ajouté à la liste." });
    return cleanName;
  }

  async function toggleTaskDone(t: ChantierTaskRow) {
    const nextStatus = t.status === "FAIT" ? "A_FAIRE" : "FAIT";
    const nextQualityStatus = getQualityStatusFromTaskStatus(nextStatus);
    setTasks((prev) =>
      prev.map((x) =>
        x.id === t.id
          ? {
              ...x,
              status: nextStatus,
              quality_status: nextQualityStatus,
              admin_validation_status: nextQualityStatus === "termine_intervenant" ? "non_verifie" : x.admin_validation_status,
            }
          : x,
      ),
    );
    try {
      await updateTask(t.id, {
        status: nextStatus,
        quality_status: nextQualityStatus,
        admin_validation_status: nextQualityStatus === "termine_intervenant" ? "non_verifie" : t.admin_validation_status,
      });
      await recordChantierActivity({
        actionType: "status_changed",
        entityType: "task",
        entityId: t.id,
        reason: "Statut tâche modifié depuis la liste",
        changes: {
          from_status: t.status,
          to_status: nextStatus,
          quality_status: nextQualityStatus,
        },
      });
    } catch (e: any) {
      setTasks((prev) =>
        prev.map((x) =>
          x.id === t.id
            ? {
                ...x,
                status: t.status,
                quality_status: t.quality_status,
                admin_validation_status: t.admin_validation_status,
              }
            : x,
        ),
      );
      setTasksError(e?.message ?? "Erreur lors de la mise à jour de la tâche.");
      setToast({ type: "error", msg: e?.message ?? "Erreur mise à jour tâche." });
    }
  }

  function onTaskProgressDraftChange(taskId: string, rawValue: string) {
    const normalized = rawValue.replace(",", ".");
    setTaskProgressDrafts((prev) => ({ ...prev, [taskId]: normalized }));
  }

  function startTaskProgressEdit(task: ChantierTaskRow) {
    const progress = computeTaskProgress(task);
    setTaskProgressDrafts((prev) => ({ ...prev, [task.id]: String(progress.offsetPercent ?? 0) }));
    setTaskProgressEditingId(task.id);
  }

  function cancelTaskProgressEdit(task: ChantierTaskRow) {
    const progress = computeTaskProgress(task);
    setTaskProgressDrafts((prev) => ({ ...prev, [task.id]: String(progress.offsetPercent ?? 0) }));
    setTaskProgressEditingId((prev) => (prev === task.id ? null : prev));
  }

  async function applyTaskProgressOffset(task: ChantierTaskRow) {
    const draftRaw = String(taskProgressDrafts[task.id] ?? "").trim().replace(",", ".");
    const parsed = Number(draftRaw);
    if (!Number.isFinite(parsed)) {
      setToast({ type: "error", msg: "Valeur d'ajustement invalide (-100 à 100)." });
      return;
    }

    const clamped = Math.max(-100, Math.min(100, parsed));
    setTaskProgressSavingId(task.id);

    try {
      await adminSetTaskProgressOffset(task.id, clamped);
      const progress = computeTaskProgress({
        ...task,
        progress_admin_offset_percent: clamped,
      });
      const nextStatus = getStatusFromProgress(progress.displayPercent);
      const nextQualityStatus = getQualityStatusFromTaskStatus(nextStatus);
      await updateTask(task.id, {
        status: nextStatus,
        quality_status: nextQualityStatus,
      });
      setTasks((prev) =>
        prev.map((row) =>
          row.id === task.id
            ? {
                ...row,
                progress_admin_offset_percent: clamped,
                progress_admin_offset_updated_at: new Date().toISOString(),
                status: nextStatus,
                quality_status: nextQualityStatus,
              }
            : row,
        ),
      );
      setTaskProgressDrafts((prev) => ({ ...prev, [task.id]: String(Math.round(clamped)) }));
      setToast({ type: "ok", msg: "Ajustement d'avancement appliqué." });
      setTaskProgressEditingId((prev) => (prev === task.id ? null : prev));
      await refreshTasksOnly();
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur mise à jour avancement." });
      await refreshTasksOnly();
    } finally {
      setTaskProgressSavingId(null);
    }
  }

  async function resetTaskProgressOffset(task: ChantierTaskRow) {
    setTaskProgressSavingId(task.id);
    try {
      await adminSetTaskProgressOffset(task.id, null);
      const progress = computeTaskProgress({
        ...task,
        progress_admin_offset_percent: 0,
      });
      const nextStatus = getStatusFromProgress(progress.displayPercent);
      const nextQualityStatus = getQualityStatusFromTaskStatus(nextStatus);
      await updateTask(task.id, {
        status: nextStatus,
        quality_status: nextQualityStatus,
      });
      setTasks((prev) =>
        prev.map((row) =>
          row.id === task.id
            ? {
                ...row,
                progress_admin_offset_percent: 0,
                progress_admin_offset_updated_at: new Date().toISOString(),
                status: nextStatus,
                quality_status: nextQualityStatus,
              }
            : row,
        ),
      );
      setTaskProgressDrafts((prev) => ({ ...prev, [task.id]: "0" }));
      setToast({ type: "ok", msg: "Retour au calcul automatique appliqué." });
      setTaskProgressEditingId((prev) => (prev === task.id ? null : prev));
      await refreshTasksOnly();
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur reset avancement." });
      await refreshTasksOnly();
    } finally {
      setTaskProgressSavingId(null);
    }
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    const titre = newTitre.trim();
    if (!titre) {
      setTasksError("Le titre est obligatoire.");
      return;
    }

    const qtyRaw = newQuantite.trim();
    const quantite = qtyRaw === "" ? 1 : toNumberOrNull(qtyRaw);
    if (quantite === null || quantite <= 0) {
      setTasksError("Quantite invalide.");
      return;
    }

    const unite = newUnite.trim() || null;
    const tempsPrevuRaw = newTempsPrevuH.trim();
    const tempsPrevu = tempsPrevuRaw === "" ? null : toNumberOrNull(tempsPrevuRaw);
    if (tempsPrevuRaw !== "" && (tempsPrevu === null || tempsPrevu <= 0)) {
      setTasksError("Temps prévu invalide (heures > 0).");
      return;
    }
    if (newLotSelection === "__CREATE__") {
      setTasksError("Crée d'abord le nouveau lot avant d'ajouter la tâche.");
      return;
    }
    const lotName = normalizeLotLabel(newLotSelection) || normalizeLotLabel(newLotDraftName) || null;
    if (!lotName) {
      setTasksError("Choisis un lot dans la liste ou crée-en un nouveau.");
      return;
    }

    setAddingTask(true);
    setTasksError(null);

    const assignedIntervenantIds = uniqueIds(newAssignedIntervenantIds);
    const intervenant_id = assignedIntervenantIds[0] ?? null;
    const orderIndex = tasks.reduce((max, task) => Math.max(max, Number(task.order_index ?? 0)), -1) + 1;

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: any = {
      id: tempId,
      chantier_id: id,
      titre,
      corps_etat: lotName,
      lot: lotName,
      zone_id: newTaskZoneId || null,
      etape_metier: newTaskStepName.trim() || null,
      status: newTaskStatus,
      quality_status: newTaskQualityStatus,
      admin_validation_status: "non_verifie",
      intervenant_id,
      quantite,
      unite,
      temps_prevu_h: tempsPrevu,
      date_debut: null,
      date_fin: null,
      temps_reel_h: null,
      progress_admin_offset_percent: 0,
      duration_days: 1,
      order_index: orderIndex,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setTasks((prev) => [...prev, optimistic]);
    setTaskAssigneeIdsByTaskId((prev) => ({ ...prev, [tempId]: assignedIntervenantIds }));

    try {
      const saved = await createTask({
        chantier_id: id,
        titre,
        corps_etat: lotName,
        lot: lotName,
        zone_id: newTaskZoneId || null,
        etape_metier: newTaskStepName.trim() || null,
        status: newTaskStatus,
        quality_status: newTaskQualityStatus,
        admin_validation_status: "non_verifie",
        intervenant_id,
        quantite,
        unite,
        temps_prevu_h: tempsPrevu,
        order_index: orderIndex,
      });
      await replaceTaskAssignees(saved.id, assignedIntervenantIds);
      await recordChantierActivity({
        actionType: "created",
        entityType: "task",
        entityId: saved.id,
        reason: "Tâche créée",
        changes: {
          title: saved.titre,
          lot: saved.lot,
          zone_id: saved.zone_id,
          etape_metier: saved.etape_metier,
          quality_status: saved.quality_status,
          temps_prevu_h: saved.temps_prevu_h,
        },
      });

      setTasks((prev) => prev.map((t) => (t.id === tempId ? (saved as any) : t)));
      setTaskAssigneeIdsByTaskId((prev) => {
        const next = { ...prev };
        delete next[tempId];
        next[saved.id] = assignedIntervenantIds;
        return next;
      });

      setNewTitre("");
      setNewCorpsEtat(lotName);
      setNewLotSelection(lotName);
      setNewTaskStatus("A_FAIRE");
      setNewTaskQualityStatus("a_faire");
      setNewTaskZoneId("");
      setNewTaskStepName("");
      setNewAssignedIntervenantIds([]);
      setNewQuantite("1");
      setNewUnite("");
      setNewTempsPrevuH("1");
      setTaskCreateDrawerOpen(false);

      setToast({ type: "ok", msg: "Tâche ajoutée." });
    } catch (e: any) {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
      setTaskAssigneeIdsByTaskId((prev) => {
        const next = { ...prev };
        delete next[tempId];
        return next;
      });
      setTasksError(e?.message ?? "Erreur lors de l’ajout de la tâche.");
      setToast({ type: "error", msg: e?.message ?? "Erreur ajout tâche." });
    } finally {
      setAddingTask(false);
    }
  }

  function startEditTask(t: ChantierTaskRow) {
    setEditingTaskId(t.id);
    const baseTitre = stripLegacyPrefix(t.titre ?? "");
    const decoded = decodeQtyUnit(baseTitre);
    const q = toNumberOrNull((t as any).quantite);
    const rawUnite = (t as any).unite;
    const unite = (typeof rawUnite === "string" ? rawUnite.trim() : "") || decoded.unite || "";
    const resolvedLotName = resolveTaskLotName(t);
    setEditTitre(baseTitre);
    setEditCorpsEtat(resolvedLotName === "A classer" ? "" : resolvedLotName);
    setEditLotSelection(resolvedLotName === "A classer" ? "" : resolvedLotName);
    setEditLotDraftName("");
    setEditTaskZoneId((t as any).zone_id ?? "");
    setEditTaskStepName((t as any).etape_metier ?? "");
    setEditStatus((t.status ?? "A_FAIRE") as any);
    setEditTaskQualityStatus((t as any).quality_status ?? "a_faire");
    setEditTaskRepriseReason(String((t as any).reprise_reason ?? ""));
    setEditAssignedIntervenantIds(getTaskAssignedIntervenantIds(t));
    setEditQuantite(String(q ?? decoded.quantite ?? 1));
    setEditUnite(unite);
    setEditTempsPrevuH(toInputNumberString((t as any).temps_prevu_h));
  }
  function cancelEditTask() {
    setEditingTaskId(null);
    setSavingTask(false);
    setEditLotSelection("");
    setEditLotDraftName("");
    setEditTaskZoneId("");
    setEditTaskStepName("");
    setEditTaskQualityStatus("a_faire");
    setEditTaskRepriseReason("");
    setEditAssignedIntervenantIds([]);
  }

  async function applyTaskQualityDecision(task: ChantierTaskRow, decision: "valide_admin" | "a_reprendre") {
    const repriseReason =
      decision === "a_reprendre"
        ? window.prompt("Motif de reprise ?", task.reprise_reason ?? "")?.trim() ?? ""
        : "";

    if (decision === "a_reprendre" && !repriseReason) {
      setToast({ type: "error", msg: "Motif de reprise obligatoire." });
      return;
    }

    const nextStatus = getTaskStatusFromQualityStatus(decision);
    const nextAdminValidationStatus: ChantierTaskRow["admin_validation_status"] =
      decision === "valide_admin" ? "valide" : "a_reprendre";
    const patch = {
      status: nextStatus,
      quality_status: decision,
      admin_validation_status: nextAdminValidationStatus,
      validated_at: decision === "valide_admin" ? new Date().toISOString() : null,
      reprise_reason: decision === "a_reprendre" ? repriseReason : null,
    };

    setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, ...patch } : row)));

    try {
      await updateTask(task.id, patch as any);
      await recordChantierActivity({
        actionType: "validated",
        entityType: "task",
        entityId: task.id,
        reason: decision === "valide_admin" ? "Tâche validée par admin" : "Tâche marquée à reprendre",
        changes: {
          from_quality_status: task.quality_status,
          to_quality_status: decision,
          admin_validation_status: patch.admin_validation_status,
          reprise_reason: patch.reprise_reason,
        },
      });
      setToast({
        type: "ok",
        msg: decision === "valide_admin" ? "Tâche validée." : "Tâche marquée à reprendre.",
      });
    } catch (e: any) {
      await refreshTasksOnly();
      setToast({ type: "error", msg: e?.message ?? "Erreur validation qualité." });
    }
  }

  function openTaskTemplateDrawerFromTask(t: ChantierTaskRow) {
    const titre = editTitre.trim() || stripLegacyPrefix(t.titre ?? "");
    if (!titre) {
      setToast({ type: "error", msg: "Titre tâche manquant." });
      return;
    }

    const lot = normalizeLotLabel(editLotSelection) || editCorpsEtat.trim() || resolveTaskLotName(t);
    const uniteRaw = editUnite.trim() || ((t as any).unite ?? "");
    const quantiteFromEdit = toNumberOrNull(editQuantite.trim());
    const quantiteTask = toNumberOrNull((t as any).quantite);
    const quantite = quantiteFromEdit ?? quantiteTask ?? 0;
    const tempsPrevu = toNumberOrNull((t as any).temps_prevu_h) ?? 0;
    const tempsParUnite = quantite > 0 ? tempsPrevu / quantite : 0;

    setTaskTemplateSeed({
      titre,
      lot: lot || null,
      unite: (String(uniteRaw).trim() || null) as string | null,
      quantite_defaut: quantite > 0 ? quantite : 0,
      temps_prevu_par_unite_h: Number.isFinite(tempsParUnite) ? tempsParUnite : 0,
      remarques: ((t as any).remarques ?? null) as string | null,
    });
    setTaskTemplateError(null);
    setTaskTemplateDrawerOpen(true);
  }

  function closeTaskTemplateDrawer() {
    if (taskTemplateSaving) return;
    setTaskTemplateDrawerOpen(false);
    setTaskTemplateError(null);
    setTaskTemplateSeed(null);
  }

  async function saveTaskTemplateFromTask(payload: TaskTemplateInput) {
    setTaskTemplateSaving(true);
    setTaskTemplateError(null);
    try {
      await createTaskTemplate(payload);
      setToast({ type: "ok", msg: "Template ajouté à la bibliothèque." });
      closeTaskTemplateDrawer();
    } catch (err: any) {
      const message = err?.message ?? "Erreur ajout template.";
      setTaskTemplateError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setTaskTemplateSaving(false);
    }
  }

  async function saveEditTask(t: ChantierTaskRow) {
    const titre = editTitre.trim();
    if (!titre) {
      setToast({ type: "error", msg: "Le titre est obligatoire." });
      return;
    }

    const qtyRaw = editQuantite.trim();
    const quantite = qtyRaw === "" ? 1 : toNumberOrNull(qtyRaw);
    if (quantite === null || quantite <= 0) {
      setToast({ type: "error", msg: "Quantite invalide." });
      return;
    }

    const unite = editUnite.trim() || null;
    const tempsPrevuRaw = editTempsPrevuH.trim();
    const tempsPrevu = tempsPrevuRaw === "" ? null : toNumberOrNull(tempsPrevuRaw);
    if (tempsPrevuRaw !== "" && (tempsPrevu === null || tempsPrevu <= 0)) {
      setToast({ type: "error", msg: "Temps prévu invalide (heures > 0)." });
      return;
    }
    if (editLotSelection === "__CREATE__") {
      setToast({ type: "error", msg: "Crée d'abord le nouveau lot avant d'enregistrer." });
      return;
    }

    const lotName = normalizeLotLabel(editLotSelection) || normalizeLotLabel(editLotDraftName) || null;
    if (!lotName) {
      setToast({ type: "error", msg: "Choisis un lot avant d'enregistrer la tâche." });
      return;
    }
    if (editTaskQualityStatus === "a_reprendre" && !editTaskRepriseReason.trim()) {
      setToast({ type: "error", msg: "Motif de reprise obligatoire pour passer la tâche à reprendre." });
      return;
    }

    const nextAdminValidationStatus: ChantierTaskRow["admin_validation_status"] =
      editTaskQualityStatus === "valide_admin"
        ? "valide"
        : editTaskQualityStatus === "a_reprendre"
          ? "a_reprendre"
          : "non_verifie";

    const patch = {
      titre,
      corps_etat: lotName,
      lot: lotName,
      zone_id: editTaskZoneId || null,
      etape_metier: editTaskStepName.trim() || null,
      status: editStatus ?? "A_FAIRE",
      quality_status: editTaskQualityStatus,
      admin_validation_status: nextAdminValidationStatus,
      validated_at: editTaskQualityStatus === "valide_admin" ? new Date().toISOString() : null,
      reprise_reason: editTaskQualityStatus === "a_reprendre" ? editTaskRepriseReason.trim() : null,
      intervenant_id: uniqueIds(editAssignedIntervenantIds)[0] ?? null,
      quantite,
      unite,
      temps_prevu_h: tempsPrevu,
    };

    setSavingTask(true);
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, ...patch } : x)));
    setTaskAssigneeIdsByTaskId((prev) => ({ ...prev, [t.id]: uniqueIds(editAssignedIntervenantIds) }));

    try {
      await updateTask(t.id, patch as any);
      await replaceTaskAssignees(t.id, editAssignedIntervenantIds);
      await recordChantierActivity({
        actionType: "updated",
        entityType: "task",
        entityId: t.id,
        reason: "Tâche mise à jour",
        changes: {
          title: titre,
          lot: lotName,
          zone_id: patch.zone_id,
          etape_metier: patch.etape_metier,
          status: patch.status,
          quality_status: patch.quality_status,
          admin_validation_status: patch.admin_validation_status,
          reprise_reason: patch.reprise_reason,
          temps_prevu_h: patch.temps_prevu_h,
        },
      });
      setToast({ type: "ok", msg: "Tâche mise à jour." });
      setEditingTaskId(null);
    } catch (e: any) {
      await refreshTasksOnly();
      setToast({ type: "error", msg: e?.message ?? "Erreur mise à jour tâche." });
    } finally {
      setSavingTask(false);
    }
  }

  // ----- intervenants -----
  function startEditIntervenant(i: IntervenantRow) {
    setEditingIntervenant(i);
    setEditIntervenantNom(i.nom ?? "");
    setEditIntervenantEmail(i.email ?? "");
    setEditIntervenantTel(i.telephone ?? "");
  }
  function cancelEditIntervenant() {
    setEditingIntervenant(null);
    setSavingIntervenant(false);
  }

  async function saveEditIntervenant() {
    if (!editingIntervenant) return;

    const nom = (editIntervenantNom ?? "").trim();
    if (!nom) {
      setToast({ type: "error", msg: "Le nom de l’intervenant est obligatoire." });
      return;
    }

    setSavingIntervenant(true);
    try {
      const updated = await updateIntervenant(editingIntervenant.id, {
        nom,
        email: editIntervenantEmail.trim() || null,
        telephone: editIntervenantTel.trim() || null,
      });

      setIntervenants((prev) =>
        prev.map((x) => (x.id === updated.id ? updated : x)).sort((a, b) => a.nom.localeCompare(b.nom)),
      );

      setToast({ type: "ok", msg: "Intervenant mis à jour." });
      setEditingIntervenant(null);
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur mise à jour intervenant." });
    } finally {
      setSavingIntervenant(false);
    }
  }

  async function onDeleteIntervenant(i: IntervenantRow) {
    if (!id) return;
    const ok = confirm(`Retirer l’intervenant "${i.nom}" de ce chantier ?`);
    if (!ok) return;

    try {
      await deleteIntervenant(i.id, id);
      setIntervenants((prev) => prev.filter((x) => x.id !== i.id));
      await refreshAllIntervenants();
      setToast({ type: "ok", msg: "Intervenant retiré du chantier." });
    } catch (e: any) {
      setToast({ type: "error", msg: e?.message ?? "Erreur suppression intervenant." });
    }
  }

  async function persistTaskOrder(nextTasks: ChantierTaskRow[]) {
    const normalized = nextTasks.map((task, index) => ({ ...task, order_index: index }));
    setTasks(normalized);
    setTaskReorderSaving(true);
    try {
      await bulkUpdatePlanningTasks(normalized.map((task, index) => ({ id: task.id, order_index: index })));
      setToast({ type: "ok", msg: "Ordre des tâches mis à jour." });
    } catch (e: any) {
      await refreshTasksOnly();
      setToast({ type: "error", msg: e?.message ?? "Erreur mise à jour ordre tâches." });
    } finally {
      setTaskReorderSaving(false);
      setDraggedTaskId(null);
    }
  }

  async function moveTaskBeforeTask(sourceTaskId: string, targetTaskId: string) {
    if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) return;
    const from = tasks.findIndex((task) => task.id === sourceTaskId);
    const to = tasks.findIndex((task) => task.id === targetTaskId);
    if (from < 0 || to < 0) return;
    await persistTaskOrder(moveArrayItem(tasks, from, to));
  }

  async function onCreateIntervenantFromTab(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    const nom = newIntervenantNom.trim();
    if (!nom) {
      setToast({ type: "error", msg: "Nom intervenant obligatoire." });
      return;
    }

    setCreatingIntervenant(true);
    setIntervenantsError(null);

    try {
      await createIntervenant({
        chantier_id: id,
        nom,
        email: newIntervenantEmail.trim() || null,
        telephone: newIntervenantTel.trim() || null,
      });

      await Promise.all([refreshIntervenants(), refreshAllIntervenants()]);

      setNewIntervenantNom("");
      setNewIntervenantEmail("");
      setNewIntervenantTel("");

      setToast({ type: "ok", msg: "Intervenant ajouté au chantier." });
    } catch (e: any) {
      const message = e?.message ?? "Erreur création intervenant.";
      setIntervenantsError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setCreatingIntervenant(false);
    }
  }

  async function onAttachExistingIntervenant(intervenant: IntervenantRow) {
    if (!id) return;

    setAttachingIntervenantId(intervenant.id);
    setIntervenantsError(null);
    try {
      await attachIntervenantToChantier({ chantier_id: id, intervenant_id: intervenant.id });
      await Promise.all([refreshIntervenants(), refreshAllIntervenants()]);
      setExistingIntervenantQuery("");
      setToast({ type: "ok", msg: `${intervenant.nom} a été affecté au chantier.` });
    } catch (e: any) {
      const message = e?.message ?? "Erreur affectation intervenant.";
      setIntervenantsError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setAttachingIntervenantId(null);
    }
  }
  // ----- ENVOI ACCÈS -----
  // même si le mail ne part pas : on récupère le token et on construit le lien public côté front
  async function onSendAccess(i: IntervenantRow) {
    if (!id) return;

    const email = (i.email ?? "").trim();
    if (!email || !email.includes("@")) {
      setToast({ type: "error", msg: "Email intervenant manquant ou invalide." });
      return;
    }

    try {
      setSendingAccessId(i.id);

      const resp = await sendIntervenantAccess({
        chantierId: id,
        intervenantId: i.id,
        // l'edge function va relire l'email en base si besoin, mais on peut aussi le passer
        email,
      });

      const accessUrl = buildIntervenantLink(resp.token);
      if (import.meta.env.DEV) {
        console.log("Generated intervenant link:", accessUrl);
      }

      const copied = await copyToClipboard(accessUrl);
      if (copied) {
        setToast({ type: "ok", msg: `Lien d’accès copié. Tu peux l’envoyer à ${i.nom}.` });
      } else {
        // fallback simple (fonctionne partout)
        window.prompt("Copie ce lien et envoie-le à l’intervenant :", accessUrl);
        setToast({ type: "ok", msg: `Lien d’accès généré. Envoie-le à ${i.nom}.` });
      }
    } catch (e: any) {
      const message = isPublicAppUrlConfigError(e)
        ? e?.message ?? "VITE_PUBLIC_APP_URL manquant (à définir sur Vercel et en local)"
        : e?.message ?? "Erreur lors de l’envoi de l’accès.";
      setToast({ type: "error", msg: message });
    } finally {
      setSendingAccessId(null);
    }
  }

  // ----- devis -----
  async function onDevisImported(result: DevisImportResult) {
    try {
      await Promise.all([refreshTasksOnly(), refreshDevisOnly(result.devisId)]);
    } catch (err) {
      console.error("[devis-import] refresh error", err);
    }
    setToast({
      type: "ok",
      msg: `Import termine: ${result.linesInserted} ligne(s), ${result.tasksCreated} tache(s), mode ${result.mode}.`,
    });
  }

  async function onAddLigne(e: FormEvent) {
    e.preventDefault();
    if (!activeDevisId) return;

    const designation = lDesignation.trim();
    if (!designation) {
      setLignesError("La désignation est obligatoire.");
      return;
    }

    setAddingLigne(true);
    setLignesError(null);

    const qty = Number(String(lQty ?? "1").replace(",", "."));
    const q = Number.isFinite(qty) ? qty : 1;

    try {
      const created = await createDevisLigne({
        devis_id: activeDevisId,
        ordre: (lignes?.length ?? 0) + 1,
        corps_etat: lCorpsEtat.trim() || null,
        entreprise: lEntreprise.trim() || null,
        designation,
        unite: lUnite.trim() || null,
        quantite: q,
        prix_unitaire_ht: null,
        tva_rate: null,
        generer_tache: lGen,
        titre_tache: null,
        date_prevue: null,
      } as any);

      setLignes((prev) => [...prev, created]);

      setLCorpsEtat("");
      setLEntreprise("");
      setLDesignation("");
      setLUnite("U");
      setLQty("1");
      setLGen(true);

      setToast({ type: "ok", msg: "Ligne ajoutée." });

      if (lGen && id) {
        await refreshTasksOnly();
      }
    } catch (err: any) {
      const message = err?.message ?? "Erreur lors de l'ajout de la ligne.";
      setLignesError(message);
      setToast({ type: "error", msg: message });
    } finally {
      setAddingLigne(false);
    }
  }

  async function onDeleteLigne(ligneId: string) {
    try {
      await deleteDevisLigne(ligneId);
      setLignes((prev) => prev.filter((x) => x.id !== ligneId));
      setToast({ type: "ok", msg: "Ligne supprimée." });
    } catch (e: any) {
      setLignesError(e?.message ?? "Erreur suppression ligne.");
      setToast({ type: "error", msg: e?.message ?? "Erreur suppression ligne." });
    }
  }

  // ----- matériel -----
  function materielStatusLabel(s: MaterielStatus) {
    if (s === "validee") return "Validée";
    if (s === "refusee") return "Refusée";
    if (s === "livree") return "Livrée";
    return "En attente";
  }

  function materielStatusBadgeClass(s: MaterielStatus) {
    if (s === "livree") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (s === "validee") return "bg-blue-50 text-blue-700 border-blue-200";
    if (s === "refusee") return "bg-red-50 text-red-700 border-red-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  async function onAddMateriel(e: FormEvent) {
    e.preventDefault();
    if (!id) return;

    const intervenant_id = mIntervenantId === "__NONE__" ? "" : mIntervenantId;
    const task_id = mTaskId || null;
    const designation = mDesignation.trim();
    const rawQty = String(mQuantite ?? "1").trim().replace(",", ".");
    const qty = Number(rawQty);

    if (!intervenant_id) {
      setMaterielError("Intervenant obligatoire.");
      return;
    }
    if (!designation) {
      setMaterielError("Désignation obligatoire.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      setMaterielError("Quantite invalide.");
      return;
    }

    setAddingMateriel(true);
    setMaterielError(null);

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: any = {
      id: tempId,
      chantier_id: id,
      intervenant_id,
      task_id,
      task_titre: task_id ? tasks.find((task) => task.id === task_id)?.titre ?? null : null,
      titre: designation,
      designation,
      quantite: qty,
      unite: mUnite.trim() || null,
      date_souhaitee: mDate || null,
      statut: mStatus,
      remarques: mRemarques.trim() || null,
      commentaire: mRemarques.trim() || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setMateriel((prev) => [optimistic, ...prev]);

    try {
      const saved = await createMaterielDemande({
        chantier_id: id,
        intervenant_id,
        task_id,
        titre: designation,
        quantite: qty,
        unite: mUnite.trim() || null,
        date_souhaitee: mDate || null,
        statut: mStatus,
        commentaire: mRemarques.trim() || null,
      } as any);

      setMateriel((prev) => prev.map((x) => (x.id === tempId ? (saved as any) : x)));
      await recordChantierActivity({
        actionType: "created",
        entityType: "materiel",
        entityId: saved.id,
        reason: "Demande matériel créée",
        changes: {
          titre: designation,
          task_id,
          statut: saved.statut,
          quantite: qty,
          unite: mUnite.trim() || null,
          date_souhaitee: mDate || null,
        },
      });

      setMIntervenantId("__NONE__");
      setMTaskId("");
      setMDesignation("");
      setMQuantite("1");
      setMUnite("");
      setMDate("");
      setMStatus("en_attente");
      setMRemarques("");

      setToast({ type: "ok", msg: "Demande matériel ajoutée." });
    } catch (e: any) {
      setMateriel((prev) => prev.filter((x) => x.id !== tempId));
      setMaterielError(e?.message ?? "Erreur ajout matériel.");
      setToast({ type: "error", msg: e?.message ?? "Erreur ajout matériel." });
    } finally {
      setAddingMateriel(false);
    }
  }

  async function onUpdateMaterielStatus(row: MaterielDemandeRow, status: MaterielStatus) {
    const adminCommentaireRaw =
      materielAdminComments[row.id] ?? row.admin_commentaire ?? row.commentaire ?? row.remarques ?? "";
    const adminCommentaire = adminCommentaireRaw.trim() || null;
    setMateriel((prev) =>
      prev.map((x) =>
        x.id === row.id ? { ...x, statut: status, admin_commentaire: adminCommentaire, updated_at: new Date().toISOString() } : x,
      ),
    );
    try {
      const updated = await updateMaterielDemande(row.id, { statut: status, admin_commentaire: adminCommentaire } as any);
      setMateriel((prev) => prev.map((x) => (x.id === row.id ? updated : x)));
      await recordChantierActivity({
        actionType: "status_changed",
        entityType: "materiel",
        entityId: row.id,
        reason: "Statut matériel mis à jour",
        changes: {
          from_status: row.statut,
          to_status: status,
          commentaire: adminCommentaire,
        },
      });
      setToast({ type: "ok", msg: "Statut matériel mis à jour." });
    } catch (e: any) {
      await refreshMateriel();
      setToast({ type: "error", msg: e?.message ?? "Erreur mise à jour matériel." });
    }
  }

  async function onDeleteMateriel(row: MaterielDemandeRow) {
    const label = row.titre || row.designation || "demande matériel";
    const ok = confirm(`Supprimer la demande "${label}" ?`);
    if (!ok) return;

    const before = materiel;
    setMateriel((prev) => prev.filter((x) => x.id !== row.id));

    try {
      await deleteMaterielDemande(row.id);
      await recordChantierActivity({
        actionType: "deleted",
        entityType: "materiel",
        entityId: row.id,
        reason: "Demande matériel supprimée",
        changes: {
          titre: row.titre || row.designation || null,
          task_id: row.task_id ?? null,
        },
      });
      setToast({ type: "ok", msg: "Demande supprimée." });
    } catch (e: any) {
      setMateriel(before);
      setToast({ type: "error", msg: e?.message ?? "Erreur suppression matériel." });
    }
  }

  /* ---------------- guards ---------------- */
  if (!id) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="font-semibold">{t("chantierPage.notFoundTitle")}</div>
        <div className="text-slate-500 text-sm mt-1">{t("chantierPage.missingId")}</div>
        <div className="mt-4">
          <Link to="/chantiers" className="rounded-xl border px-3 py-2 hover:bg-slate-50">
            {t("chantierPage.backToChantiers")}
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="font-semibold">{t("common.states.loading")}</div>
        <div className="text-slate-500 text-sm mt-1">{t("chantierPage.loadingMessage")}</div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">
        {errorMsg}
      </div>
    );
  }

  if (!item) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="font-semibold">{t("chantierPage.notFoundTitle")}</div>
        <div className="text-slate-500 text-sm mt-1">{t("chantierPage.notFoundMessage")}</div>
      </div>
    );
  }

  const filteredMateriel =
    materielFilter === "__ALL__" ? materiel : materiel.filter((row) => row.statut === materielFilter);
  const overviewTab: { key: TabKey; label: string } = { key: "accueil", label: "Accueil" };
  const preparerTabs: Array<{ key: TabKey; label: string }> = [
    { key: "preparer", label: "Préparer" },
    { key: "intervenants", label: t("sidebar.intervenants") },
    { key: "achats", label: "Approvisionnement" },
    { key: "materiel", label: t("intervenantAccess.tabs.material") },
    { key: "documents", label: t("intervenantAccess.tabs.documents") },
  ];
  const executerTabs: Array<{ key: TabKey; label: string }> = [
    { key: "devis-taches", label: t("chantierPage.tasks") },
    { key: "planning", label: t("chantierTabs.planning") },
    { key: "photos", label: "Photos" },
    { key: "consignes", label: "Consignes" },
    { key: "messagerie", label: t("intervenantAccess.tabs.messaging") },
  ];
  const controlerTabs: Array<{ key: TabKey; label: string }> = [
    { key: "reserves", label: t("intervenantAccess.tabs.reserves") },
    { key: "journal", label: "Journal" },
    { key: "doe", label: "DOE" },
    { key: "visite", label: "Visite" },
  ];
  const piloterTabs: Array<{ key: TabKey; label: string }> = [
    { key: "temps", label: t("chantierTabs.time") },
    { key: "rapports", label: "Rapports" },
  ];
  const chantierTabSections = [
    { title: "Préparer", tabs: preparerTabs },
    { title: "Exécuter", tabs: executerTabs },
    { title: "Contrôler", tabs: controlerTabs },
    { title: "Piloter", tabs: piloterTabs },
  ];
  const chantierTabs = [overviewTab, ...preparerTabs, ...executerTabs, ...controlerTabs, ...piloterTabs];
  const activeTabLabel = chantierTabs.find((entry) => entry.key === tab)?.label ?? "Rapports";
  const accueilPanel = (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Informations chantier</div>
            <div className="mt-2 flex flex-wrap items-start gap-2">
              <h2 className="max-w-3xl text-2xl font-semibold leading-tight text-slate-950">{item.nom}</h2>
              <span className={["rounded-full border px-2 py-1 text-xs", badge.className].join(" ")}>{badge.label}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
              <span>{t("chantierPage.start")} {item.date_debut ?? "—"}</span>
              <span>{t("chantierPage.end")} {item.date_fin_prevue ?? "—"}</span>
            </div>
          </div>
          <div className="w-full max-w-xs rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t("chantiers.progress")}</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{avancement}%</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${avancement}%` }} />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t("chantiers.progress")}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{avancement}%</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t("chantierPage.hoursPlanned")}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{tempsPrevues} h</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t("chantierPage.hoursDone")}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{totalTempsReel} h</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{t("intervenantAccess.tabs.reserves")}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-950">{reservesOuvertes}</div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Alertes</div>
            <div className="mt-1 text-lg font-semibold text-slate-950">Points à surveiller</div>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
            {alertCards.length} alerte{alertCards.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {alertCards.length === 0 ? (
            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              {t("chantierPage.noAlert")}
            </span>
          ) : (
            alertCards.map((alert) => (
              <span
                key={alert.key}
                className={[
                  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium",
                  alert.tone === "danger"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : alert.tone === "warning"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700",
                ].join(" ")}
              >
                {alert.title}: {alert.detail}
              </span>
            ))
          )}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Résumé rapide</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">Synthèse des tâches</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Nombre de tâches</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{tasks.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Tâches terminées / en cours</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">
                {completedTasksCount} / {inProgressTasksCount}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
              {completedTasksCount} terminée{completedTasksCount > 1 ? "s" : ""}
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
              {inProgressTasksCount} en cours
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-700">
              {todoTasksCount} à faire
            </span>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Pilotage</div>
          <div className="mt-1 text-lg font-semibold text-slate-950">Vue rapide</div>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-medium text-slate-900">Intervenants affectés</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">{intervenants.length}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-medium text-slate-900">Lots concernés</div>
              <div className="mt-1 text-2xl font-semibold text-slate-950">{lotOptions.length}</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );

  /* ---------------- render ---------------- */
  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={[
            "fixed right-6 bottom-6 z-50 rounded-xl border px-4 py-3 text-sm shadow-lg",
            toast.type === "ok"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-red-50 text-red-800 border-red-200",
          ].join(" ")}
        >
          {toast.msg}
        </div>
      )}

      <section className="sticky top-4 z-20 rounded-3xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3">
              <Link to="/chantiers" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50" aria-label={t("chantierPage.backToChantiers")}>
                ←
              </Link>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Chantier</div>
                <h1 className="max-w-3xl text-2xl font-semibold leading-tight text-slate-950">{item.nom}</h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span>Vue : {activeTabLabel}</span>
                  <span className={["rounded-full border px-2 py-0.5 text-xs", badge.className].join(" ")}>{badge.label}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTab(overviewTab.key)}
            className={[
              "w-full rounded-2xl border px-4 py-3 text-left text-sm font-medium transition",
              tab === overviewTab.key
                ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                : "border-slate-200 bg-slate-50/70 text-slate-700 hover:bg-slate-100",
            ].join(" ")}
          >
            {overviewTab.label}
          </button>

          <div className="grid gap-3 xl:grid-cols-4">
            {chantierTabSections.map((section) => (
              <section
                key={section.title}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {section.title}
                  </div>
                  <nav className="flex flex-wrap gap-2">
                    {section.tabs.map((entry) => (
                      <button
                        key={entry.key}
                        type="button"
                        onClick={() => setTab(entry.key)}
                        className={[
                          "rounded-full px-4 py-2 text-sm font-medium transition",
                          tab === entry.key
                            ? "bg-blue-600 text-white shadow-sm"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {entry.label}
                      </button>
                    ))}
                  </nav>
                </div>
              </section>
            ))}
          </div>
        </div>
      </section>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {tab === "devis-taches" ? (
          <button
            type="button"
            onClick={() => setTaskCreateDrawerOpen(true)}
            className="fixed bottom-6 right-6 z-20 rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-blue-700"
          >
            + {t("chantierPage.addTask")}
          </button>
        ) : null}
        {tab === "accueil" && accueilPanel}
        {tab === "preparer" && id && (
          <PreparationTab
            chantierId={id}
            tasksCount={tasks.length}
            documentsCount={chantierDocuments.length || documents.length}
            intervenantsCount={intervenants.length}
            materielCount={materiel.length}
          />
        )}
        {tab === "achats" && id && (
          <ApprovisionnementTab chantierId={id} tasks={tasks} zones={zones} />
        )}
        {/* ---------------- ONGLET TEMPS ---------------- */}
        {tab === "temps" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold section-title">{t("chantierPage.timeByTask")}</div>
              </div>
              <div className="text-xs text-slate-500">
                {t("intervenantAccess.totalEntered", { value: totalTempsReel })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1 text-xs text-slate-600">
                  <div>Tâche</div>
                  <select
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={timeEntryTaskId}
                    onChange={(e) => setTimeEntryTaskId(e.target.value)}
                    disabled={tasksLoading || timeEntrySaving}
                  >
                    <option value="">Choisir une tâche</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {stripLegacyPrefix(task.titre ?? "")}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs text-slate-600">
                  <div>Intervenant</div>
                  <select
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={timeEntryIntervenantId}
                    onChange={(e) => setTimeEntryIntervenantId(e.target.value)}
                    disabled={intervenantsLoading || timeEntrySaving}
                  >
                    <option value="">Choisir un intervenant</option>
                    {(timeEntryTaskId
                      ? (() => {
                          const task = taskById.get(timeEntryTaskId);
                          if (!task) return intervenants;
                          const allowedIds = getTaskAssignedIntervenantIds(task);
                          return allowedIds.length > 0
                            ? allowedIds
                                .map((intervenantId) => intervenantById.get(intervenantId))
                                .filter((row): row is IntervenantRow => Boolean(row))
                            : intervenants;
                        })()
                      : intervenants
                    ).map((intervenant) => (
                      <option key={intervenant.id} value={intervenant.id}>
                        {intervenant.nom}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1 text-xs text-slate-600">
                  <div>Date</div>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    type="date"
                    value={timeEntryDate}
                    onChange={(e) => setTimeEntryDate(e.target.value)}
                    disabled={timeEntrySaving}
                  />
                </label>

                <label className="space-y-1 text-xs text-slate-600">
                  <div>Durée (h)</div>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    inputMode="decimal"
                    placeholder="ex: 4"
                    value={timeEntryHours}
                    onChange={(e) => setTimeEntryHours(e.target.value)}
                    disabled={timeEntrySaving}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
                <label className="space-y-1 text-xs text-slate-600">
                  <div>Quantité réalisée (optionnel)</div>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    inputMode="decimal"
                    placeholder="ex: 3"
                    value={timeEntryQuantity}
                    onChange={(e) => setTimeEntryQuantity(e.target.value)}
                    disabled={timeEntrySaving}
                  />
                </label>

                <label className="space-y-1 text-xs text-slate-600">
                  <div>Note (optionnel)</div>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    placeholder="Observation éventuelle"
                    value={timeEntryNote}
                    onChange={(e) => setTimeEntryNote(e.target.value)}
                    disabled={timeEntrySaving}
                  />
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => void saveTimeEntry()}
                  disabled={timeEntrySaving}
                  className={[
                    "rounded-xl px-4 py-2 text-sm",
                    timeEntrySaving ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                >
                  {timeEntrySaving ? "Enregistrement..." : "Ajouter la saisie"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {tasksLoading || timeEntriesLoading ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  {t("common.states.loading")}
                </div>
              ) : tasksError || timeEntriesError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-5 text-sm text-red-700">
                  {tasksError ?? timeEntriesError}
                </div>
              ) : tasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-500">
                  Aucune tâche disponible pour saisir du temps.
                </div>
              ) : (
                tasks.map((task) => {
                  const assigneeNames = getTaskAssignedIntervenantNames(task);
                  const entries = timeEntriesByTaskId.get(task.id) ?? [];

                  return (
                    <div key={task.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{stripLegacyPrefix(task.titre ?? "")}</div>
                          <div className="text-xs text-slate-500">
                            {(task.corps_etat ?? task.lot ?? "—")} | {t("intervenantAccess.intervenantLabel")}: {assigneeNames.join(", ") || "—"}
                          </div>
                        </div>
                        <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">
                          Total tâche : {Math.round(Number(task.temps_reel_h ?? 0) * 100) / 100} h
                        </div>
                      </div>

                      {entries.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                          Aucune saisie temps sur cette tâche.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {entries.map((entry) => (
                            <div
                              key={entry.id}
                              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 md:flex-row md:items-start md:justify-between"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="text-sm font-medium text-slate-900">
                                  {intervenantById.get(entry.intervenant_id)?.nom ?? "Intervenant"}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {entry.work_date ? new Date(`${entry.work_date}T00:00:00`).toLocaleDateString(locale) : "—"}
                                  {" · "}
                                  {Math.round(Number(entry.duration_hours ?? 0) * 100) / 100} h
                                  {entry.quantite_realisee !== null ? ` · Qte: ${entry.quantite_realisee}` : ""}
                                </div>
                                {entry.note ? <div className="text-xs text-slate-500">{entry.note}</div> : null}
                              </div>
                              <button
                                type="button"
                                onClick={() => void removeTimeEntry(entry.id)}
                                disabled={timeEntryDeletingId === entry.id}
                                className="self-start rounded-xl border border-red-200 px-3 py-2 text-xs text-red-700 hover:bg-red-50"
                              >
                                {timeEntryDeletingId === entry.id ? "Suppression..." : "Supprimer"}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ---------------- ONGLET INTERVENANTS ---------------- */}
        {tab === "intervenants" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold section-title">Intervenants</div>
                <div className="text-sm text-slate-500">
                  {t("chantierPage.intervenantsSubtitle")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshIntervenants}
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  disabled={intervenantsLoading}
                >
                  {intervenantsLoading ? t("common.states.loading") : t("common.actions.refresh")}
                </button>
              </div>
            </div>

            {intervenantsError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {intervenantsError}
              </div>
            )}

            <form onSubmit={onCreateIntervenantFromTab} className="rounded-xl border bg-slate-50 p-4 space-y-3">
              <div className="font-semibold text-sm">{t("intervenantsTab.addTitle")}</div>
              <div className="grid gap-2 md:grid-cols-3">
                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder={t("intervenantsTab.namePlaceholder")}
                  value={newIntervenantNom}
                  onChange={(e) => setNewIntervenantNom(e.target.value)}
                />
                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder={t("intervenantsTab.emailPlaceholder")}
                  value={newIntervenantEmail}
                  onChange={(e) => setNewIntervenantEmail(e.target.value)}
                />
                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder={t("intervenantsTab.phonePlaceholder")}
                  value={newIntervenantTel}
                  onChange={(e) => setNewIntervenantTel(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creatingIntervenant}
                  className={[
                    "rounded-xl px-4 py-2 text-sm",
                    creatingIntervenant ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                >
                  {creatingIntervenant ? t("intervenantsTab.creating") : `+ ${t("common.actions.add")}`}
                </button>
              </div>
            </form>

            <div className="rounded-xl border bg-white p-4 space-y-3">
              <div className="font-semibold text-sm">Affecter un intervenant existant</div>
              <div className="text-sm text-slate-500">
                Rechercher un intervenant déjà enregistré puis l’affecter à ce chantier.
              </div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                placeholder="Rechercher par nom, email ou téléphone"
                value={existingIntervenantQuery}
                onChange={(e) => setExistingIntervenantQuery(e.target.value)}
              />

              {allIntervenantsLoading ? (
                <div className="text-sm text-slate-500">Chargement des intervenants existants...</div>
              ) : assignableIntervenants.length === 0 ? (
                <div className="text-sm text-slate-500">
                  {existingIntervenantQuery.trim()
                    ? "Aucun intervenant existant ne correspond à cette recherche."
                    : "Tous les intervenants connus sont déjà affectés à ce chantier."}
                </div>
              ) : (
                <div className="space-y-2">
                  {assignableIntervenants.map((intervenant) => (
                    <div
                      key={intervenant.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-slate-900">{intervenant.nom}</div>
                        <div className="text-xs text-slate-500">
                          {(intervenant.email ?? "—")} • {(intervenant.telephone ?? "—")}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onAttachExistingIntervenant(intervenant)}
                        disabled={attachingIntervenantId === intervenant.id}
                        className={[
                          "rounded-xl px-4 py-2 text-sm",
                          attachingIntervenantId === intervenant.id
                            ? "bg-slate-300 text-slate-700"
                            : "bg-white border border-slate-300 text-slate-900 hover:bg-slate-100",
                        ].join(" ")}
                      >
                        {attachingIntervenantId === intervenant.id ? "Affectation..." : "Affecter au chantier"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              {intervenantsLoading ? (
                <div className="text-sm text-slate-500">{t("common.states.loading")}</div>
              ) : intervenants.length === 0 ? (
                <div className="text-sm text-slate-500">{t("intervenantsTab.empty")}</div>
              ) : (
                intervenants.map((i) => (
                  <div key={i.id} className="rounded-xl border p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{i.nom}</div>
                      <div className="text-xs text-slate-500">
                        {(i.email ?? "—")} • {(i.telephone ?? "—")}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onSendAccess(i)}
                        disabled={sendingAccessId === i.id}
                        className={[
                          "text-sm rounded-xl border px-3 py-2",
                          sendingAccessId === i.id ? "bg-slate-100 text-slate-500" : "hover:bg-slate-50",
                        ].join(" ")}
                        title={i.email ? `${t("intervenantsTab.sendAccess")} ${i.email}` : t("common.labels.email")}
                      >
                        {sendingAccessId === i.id ? t("intervenantsTab.sending") : t("intervenantsTab.sendAccess")}
                      </button>

                      <button
                        type="button"
                        onClick={() => startEditIntervenant(i)}
                        className="text-sm rounded-xl border px-3 py-2 hover:bg-slate-50"
                      >
                        {t("common.actions.edit")}
                      </button>

                      <button
                        type="button"
                        onClick={() => onDeleteIntervenant(i)}
                        className="text-sm rounded-xl border border-red-200 text-red-700 px-3 py-2 hover:bg-red-50"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ---------------- ONGLET DOCUMENTS ---------------- */}
        {tab === "documents" && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="font-semibold section-title">{t("intervenantAccess.tabs.documents")}</div>
              <button
                type="button"
                onClick={openDocumentModal}
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
              >
                {t("chantierPage.importDocument")}
              </button>
            </div>

            {documentsError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {documentsError}
              </div>
            )}

            {documentsLoading ? (
              <div className="text-sm text-slate-500">{t("common.states.loading")}</div>
            ) : documents.length === 0 ? (
              <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-500">
                {t("chantierPage.noDocumentForChantier")}
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm table-soft">
                  <thead className="text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">{t("common.labels.name")}</th>
                      <th className="px-3 py-2 text-left font-medium">{t("common.labels.category")}</th>
                      <th className="px-3 py-2 text-left font-medium">{t("common.labels.type")}</th>
                      <th className="px-3 py-2 text-left font-medium">{t("documentEdit.visibilityMode")}</th>
                      <th className="px-3 py-2 text-left font-medium">{t("common.labels.date")}</th>
                      <th className="px-3 py-2 text-left font-medium">{t("chantierPage.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-t">
                        <td className="px-3 py-2">
                          <div className="font-medium truncate">{doc.title}</div>
                          <div className="text-xs text-slate-500 truncate">{doc.file_name}</div>
                        </td>
                        <td className="px-3 py-2">{doc.category}</td>
                        <td className="px-3 py-2">{doc.document_type}</td>
                        <td className="px-3 py-2">
                          {(() => {
                            const label = formatDocumentVisibility(doc);
                            return <span className={visibilityBadgeClass(label)}>{label}</span>;
                          })()}
                        </td>
                        <td className="px-3 py-2">
                          {doc.created_at ? new Date(doc.created_at).toLocaleDateString(locale) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={doeSyncingDocumentId === doc.id}
                              onClick={() => toggleDocumentDoe(doc)}
                              className={[
                                "rounded-lg border px-2 py-1 text-xs",
                                doeDocumentIds.includes(doc.id)
                                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                  : "hover:bg-slate-50",
                              ].join(" ")}
                            >
                              {doeSyncingDocumentId === doc.id
                                ? t("common.actions.update")
                                : doeDocumentIds.includes(doc.id)
                                  ? t("chantierPage.removeDoe")
                                  : t("chantierPage.includeDoe")}
                            </button>
                            <button
                              type="button"
                              onClick={() => openDocumentEdit(doc)}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                            >
                              {t("common.actions.edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => openDocumentPreview(doc)}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                            >
                              {t("common.actions.open")}
                            </button>
                            <button
                              type="button"
                              onClick={() => downloadDocument(doc)}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                            >
                              {t("common.actions.download")}
                            </button>
                            <button
                              type="button"
                              onClick={() => copyDocumentLink(doc)}
                              className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                            >
                              {t("common.actions.copy")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ---------------- ONGLET RÉSERVES ---------------- */}
        {tab === "reserves" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold section-title">{t("intervenantAccess.tabs.reserves")}</div>
                <div className="text-sm text-slate-500">{t("chantierPage.reservesSubtitle")}</div>
              </div>
              <button
                type="button"
                onClick={() => openReserveDrawer(null)}
                className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800"
              >
                {t("chantierPage.newReserve")}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "ALL", label: t("doe.all") },
                  { key: "OUVERTES", label: t("chantierPage.openReserves") },
                  { key: "LEVEES", label: t("common.reserveStatus.LEVEE") },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setReservesFilter(f.key)}
                  className={[
                    "chip-btn",
                    reservesFilter === f.key ? "chip-btn--active" : "chip-btn--inactive",
                  ].join(" ")}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {reservesError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {reservesError}
              </div>
            )}

            {reservesLoading ? (
              <div className="text-sm text-slate-500">{t("common.states.loading")}</div>
            ) : filteredReserves.length === 0 ? (
              <div className="text-sm text-slate-500">{t("chantierPage.noReserve")}</div>
            ) : (
              <div className="space-y-3">
                {filteredReserves.map((reserve) => {
                  const status = reserveStatusBadge(reserve.status, t);
                  const priority = reservePriorityBadge(reserve.priority, t);
                  const task = reserve.task_id ? taskById.get(reserve.task_id) : null;
                  const taskAssigneeNames = task ? getTaskAssignedIntervenantNames(task) : [];
                  const zoneLabel = resolveZoneName((reserve as any).zone_id ?? task?.zone_id ?? null);

                  return (
                    <div
                      key={reserve.id}
                      className="rounded-xl border p-4 hover:bg-slate-50 cursor-pointer"
                      onClick={() => openReserveDrawer(reserve)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{reserve.title}</div>
                          {reserve.description ? (
                            <div className="text-xs text-slate-500 line-clamp-2">
                              {reserve.description}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400">Aucune description.</div>
                          )}
                        </div>
                        <span
                          className={[
                            "text-xs px-2 py-1 rounded-full border shrink-0",
                            status.className,
                          ].join(" ")}
                        >
                          {status.label}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className={["px-2 py-1 rounded-full border", priority.className].join(" ")}>
                          {priority.label}
                        </span>
                        <span>Tâche : {task ? stripLegacyPrefix(task.titre ?? "") : "—"}</span>
                        <span>Zone : {zoneLabel}</span>
                        <span>Intervenant : {taskAssigneeNames.join(", ") || "—"}</span>
                        <span>
                          Créée : {new Date(reserve.created_at).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ---------------- ONGLET DEVIS & TÂCHES ---------------- */}
        {tab === "devis-taches" && (
          <div className="space-y-8">
            {/* DEVIS */}
            <section className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{t("chantierPage.quotesTitle")}</div>
                  <div className="text-sm text-slate-500">{t("chantierPage.quotesSubtitle")}</div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-500">{devisLoading ? t("common.states.loading") : `${devis.length} ${t("chantierPage.quotesCount")}`}</div>
                  <button
                    type="button"
                    className="rounded-xl bg-[#2563EB] px-4 py-2 text-sm text-white hover:bg-[#1d4ed8]"
                    onClick={() => setDevisImportDrawerOpen(true)}
                  >
                    {t("chantierPage.importQuotePdf")}
                  </button>
                </div>
              </div>

              {devisError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {devisError}
                </div>
              )}

              <div className="rounded-xl border bg-blue-50/50 p-4 text-sm text-slate-700">
                {t("chantierPage.quoteHelpPrefix")} <span className="font-semibold">{t("chantierPage.importQuotePdf")}</span> {t("chantierPage.quoteHelpSuffix")}
              </div>

              <div className="space-y-3">
                {devis.map((d: any) => {
                  const isOpen = activeDevisId === d.id;
                  return (
                    <div key={d.id} className="rounded-xl border p-4 space-y-3">
                      <div className="flex justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{d.nom ?? t("chantierPage.quoteFallback")}</div>
                          <div className="text-xs text-slate-500">ID : {d.id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                            onClick={() => setActiveDevisId(isOpen ? null : d.id)}
                          >
                            {isOpen ? t("common.actions.close") : t("chantierPage.viewLines")}
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="rounded-xl border bg-slate-50 p-3 space-y-3">
                          {lignesError && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                              {lignesError}
                            </div>
                          )}

                          {lignesLoading ? (
                            <div className="text-sm text-slate-500">{t("common.states.loading")}</div>
                          ) : lignes.length === 0 ? (
                            <div className="text-sm text-slate-500">{t("chantierPage.noLine")}</div>
                          ) : (
                            <div className="space-y-2">
                              {lignes.map((l: any) => (
                                <div key={l.id} className="flex justify-between items-start border-b py-2 text-sm gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="font-medium">{l.designation}</div>
                                    {l.titre_tache ? (
                                      <div className="mt-1 text-xs font-medium text-blue-700">Titre terrain: {l.titre_tache}</div>
                                    ) : null}
                                    <div className="text-xs text-slate-500">
                                      {(l.corps_etat ?? "—")} {" • "}
                                      {l.entreprise ?? "—"} {" • "}
                                      {(l.quantite ?? "—")} {(l.unite ?? "")}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => onDeleteLigne(l.id)}
                                    className="text-red-600 text-xs hover:underline"
                                  >
                                    {t("common.actions.delete")}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Ajouter une ligne */}
                          <div className="pt-2">
                            <div className="font-semibold text-sm">{t("chantierPage.addLine")}</div>
                            <form onSubmit={onAddLigne} className="mt-2 grid gap-2">
                              <div className="grid gap-2 md:grid-cols-2">
                                <input
                                  className="rounded-xl border px-3 py-2 text-sm"
                                  placeholder={t("chantierPage.lotPlaceholder")}
                                  value={lCorpsEtat}
                                  onChange={(e) => setLCorpsEtat(e.target.value)}
                                />
                                <input
                                  className="rounded-xl border px-3 py-2 text-sm"
                                  placeholder={t("chantierPage.companyPlaceholder")}
                                  value={lEntreprise}
                                  onChange={(e) => setLEntreprise(e.target.value)}
                                />
                              </div>

                              <input
                                className="rounded-xl border px-3 py-2 text-sm"
                                placeholder={t("chantierPage.designationPlaceholder")}
                                value={lDesignation}
                                onChange={(e) => setLDesignation(e.target.value)}
                              />

                              <div className="grid gap-2 md:grid-cols-3">
                                <input
                                  className="rounded-xl border px-3 py-2 text-sm"
                                  placeholder={t("common.labels.unit")}
                                  value={lUnite}
                                  onChange={(e) => setLUnite(e.target.value)}
                                />
                                <input
                                  className="rounded-xl border px-3 py-2 text-sm"
                                  placeholder={t("common.labels.quantity")}
                                  value={lQty}
                                  onChange={(e) => setLQty(e.target.value)}
                                />
                                <label className="text-sm text-slate-700 flex items-center gap-2 justify-between">
                                  <span className="flex items-center gap-2">
                                    <input type="checkbox" checked={lGen} onChange={(e) => setLGen(e.target.checked)} />
                                    {t("chantierPage.generateTask")}
                                  </span>
                                </label>
                              </div>

                              <div className="flex justify-end">
                                <button
                                  type="submit"
                                  disabled={addingLigne}
                                  className={[
                                    "rounded-xl px-4 py-2 text-sm",
                                    addingLigne ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                                  ].join(" ")}
                                >
                                  {addingLigne ? t("chantierPage.adding") : `+ ${t("chantierPage.addLine")}`}
                                </button>
                              </div>

                              <div className="text-xs text-slate-500">
                                {t("chantierPage.lineHelp")}
                              </div>
                            </form>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* TACHES */}
            <section className="space-y-4">
              <div className="flex justify-between">
                <div>
                  <div className="font-semibold section-title">{t("chantierPage.tasks")}</div>
                  <div className="text-sm text-slate-500">
                    {t("chantierPage.tasksSubtitle")} Glisse-dépose les cartes pour réorganiser l’ordre.
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {taskReorderSaving
                    ? "Enregistrement de l’ordre..."
                    : tasksLoading
                      ? t("common.states.loading")
                      : `${filteredTasks.length} / ${tasks.length} ${t("chantierPage.tasksCount")}`}
                </div>
              </div>

              {taskCreateDrawerOpen ? (
                <div
                  className="fixed inset-0 z-40 bg-slate-900/30"
                  onClick={() => setTaskCreateDrawerOpen(false)}
                >
                  <div
                    className="absolute inset-y-0 right-0 w-full max-w-4xl overflow-y-auto border-l bg-white p-4 shadow-2xl sm:p-6"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between border-b bg-white px-4 py-4 sm:-mx-6 sm:-mt-6 sm:px-6">
                      <div>
                        <div className="text-base font-semibold text-slate-900">Ajouter une tache</div>
                        <div className="text-xs text-slate-500">Creer et attribuer une tache sans quitter la liste.</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTaskCreateDrawerOpen(false)}
                        className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        Fermer
                      </button>
                    </div>

                    <form onSubmit={addTask} className="space-y-3">
                      <div className="grid gap-2 md:grid-cols-10">
                        <label className="space-y-1 text-xs text-slate-600 md:col-span-4">
                          <div>Intitule</div>
                          <input
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                            value={newTitre}
                            onChange={(e) => setNewTitre(e.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                          <div>Lot</div>
                          <select
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                            value={newLotSelection}
                            onChange={(e) => {
                              const value = e.target.value;
                              setNewLotSelection(value);
                              if (value === "__CREATE__") {
                                setNewCorpsEtat("");
                                return;
                              }
                              setNewCorpsEtat(value);
                            }}
                          >
                            {lotOptions.map((lot) => (
                              <option key={lot} value={lot}>
                                {lot}
                              </option>
                            ))}
                            <option value="__DIVIDER__" disabled>
                              ------------
                            </option>
                            <option value="__CREATE__">+ Creer un nouveau lot...</option>
                          </select>
                        </label>
                        <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                          <div>Quantite</div>
                          <input
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                            inputMode="decimal"
                            value={newQuantite}
                            onChange={(e) => setNewQuantite(e.target.value)}
                          />
                        </label>
                        <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                          <div>Unite</div>
                          <input
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                            value={newUnite}
                            onChange={(e) => setNewUnite(e.target.value)}
                          />
                        </label>
                      </div>

                      {newLotSelection === "__CREATE__" && (
                        <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                          <input
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                            placeholder="Nom du nouveau lot"
                            value={newLotDraftName}
                            onChange={(e) => setNewLotDraftName(e.target.value)}
                          />
                          <button
                            type="button"
                            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-100"
                            onClick={() => void createLotAndSelect(newLotDraftName, "add")}
                          >
                            Créer le lot
                          </button>
                        </div>
                      )}

                      <div className="grid gap-2 md:grid-cols-2">
                        <label className="space-y-1 text-xs text-slate-600">
                          <div>Zone / pièce</div>
                          <select
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                            value={newTaskZoneId}
                            onChange={(e) => setNewTaskZoneId(e.target.value)}
                          >
                            <option value="">Sans zone</option>
                            {zones.map((zone) => (
                              <option key={zone.id} value={zone.id}>
                                {zone.nom}
                                {zone.niveau ? ` · ${zone.niveau}` : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="space-y-1 text-xs text-slate-600">
                          <div>Étape métier</div>
                          <input
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                            placeholder="Ex : ossature, isolation, finitions"
                            value={newTaskStepName}
                            onChange={(e) => setNewTaskStepName(e.target.value)}
                          />
                        </label>
                      </div>

                      <div className="grid gap-2 md:grid-cols-3">
                        <label className="space-y-1 text-xs text-slate-600">
                          <div>Statut</div>
                          <select
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                            value={newTaskStatus}
                            onChange={(e) => {
                              const nextStatus = e.target.value as TaskStatus;
                              setNewTaskStatus(nextStatus);
                              setNewTaskQualityStatus(getQualityStatusFromTaskStatus(nextStatus));
                            }}
                          >
                            <option value="A_FAIRE">A faire</option>
                            <option value="EN_COURS">En cours</option>
                            <option value="FAIT">Fait</option>
                          </select>
                        </label>
                        <label className="space-y-1 text-xs text-slate-600">
                          <div>Statut qualité</div>
                          <select
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                            value={newTaskQualityStatus}
                            onChange={(e) => {
                              const nextQualityStatus = e.target.value as TaskQualityStatus;
                              setNewTaskQualityStatus(nextQualityStatus);
                              setNewTaskStatus(getTaskStatusFromQualityStatus(nextQualityStatus));
                            }}
                          >
                            <option value="a_faire">À faire</option>
                            <option value="en_cours">En cours</option>
                            <option value="termine_intervenant">Terminé intervenant</option>
                            <option value="valide_admin">Validé admin</option>
                            <option value="a_reprendre">À reprendre</option>
                          </select>
                        </label>
                        <label className="space-y-1 text-xs text-slate-600">
                          <div>Temps prevu (h)</div>
                          <input
                            className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                            inputMode="decimal"
                            placeholder="ex: 2.5"
                            value={newTempsPrevuH}
                            onChange={(e) => setNewTempsPrevuH(e.target.value)}
                          />
                          <p className="text-[11px] text-slate-500">Utilise pour le calcul automatique d'avancement</p>
                        </label>
                      </div>

                      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-medium text-slate-700">Intervenants affectés</div>
                          <div className="text-[11px] text-slate-500">
                            {newAssignedIntervenantIds.length > 0 ? `${newAssignedIntervenantIds.length} sélectionné(s)` : "Aucun intervenant sélectionné"}
                          </div>
                        </div>
                        {intervenants.length === 0 ? (
                          <div className="text-xs text-slate-500">Aucun intervenant disponible sur ce chantier.</div>
                        ) : (
                          <div className="grid gap-2 md:grid-cols-2">
                            {intervenants.map((i) => {
                              const checked = newAssignedIntervenantIds.includes(i.id);
                              return (
                                <label key={i.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={(e) =>
                                      setNewAssignedIntervenantIds((prev) =>
                                        e.target.checked ? uniqueIds([...prev, i.id]) : prev.filter((id) => id !== i.id),
                                      )
                                    }
                                  />
                                  <span className="truncate">{i.nom}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {(toNumberOrNull(newTempsPrevuH) ?? 0) <= 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          Temps prevu requis pour un calcul automatique fiable de l'avancement.
                        </div>
                      )}

                      <div className="text-xs text-slate-500">
                        Astuce : crée tes intervenants dans l'onglet "Intervenants", puis attribue-les ici.
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t pt-3">
                        <button
                          type="button"
                          onClick={() => setTaskCreateDrawerOpen(false)}
                          className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
                        >
                          Annuler
                        </button>
                        <button
                          type="submit"
                          disabled={addingTask}
                          className={[
                            "rounded-xl px-4 py-2 text-sm",
                            addingTask ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                          ].join(" ")}
                        >
                          {addingTask ? "Ajout..." : "+ Ajouter tache"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2 md:grid-cols-2">
                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={filterIntervenant}
                  onChange={(e) => setFilterIntervenant(e.target.value)}
                  disabled={intervenantsLoading}
                >
                  <option value="__ALL__">Tous les intervenants</option>
                  <option value="__NONE__">Non attribue</option>
                  {intervenants.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nom}
                    </option>
                  ))}
                </select>
                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={filterTaskQuality}
                  onChange={(e) => setFilterTaskQuality(e.target.value as "__ALL__" | TaskQualityStatus)}
                >
                  <option value="__ALL__">Tous les statuts qualité</option>
                  <option value="a_faire">À faire</option>
                  <option value="en_cours">En cours</option>
                  <option value="termine_intervenant">Terminé intervenant</option>
                  <option value="valide_admin">Validé admin</option>
                  <option value="a_reprendre">À reprendre</option>
                </select>
              </div>

              {tasksError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {tasksError}
                </div>
              )}
              {tasksPlanningWarning && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {tasksPlanningWarning}
                </div>
              )}

              <div className="space-y-2">
                {filteredTasks.map((t: any) => {
                  const isEditing = editingTaskId === t.id;
                  const displayTitre = stripLegacyPrefix(t.titre ?? "");
                  const decoded = decodeQtyUnit(displayTitre);
                  const displayTitreClean = decoded.cleanTitle || displayTitre;
                  const quantiteRaw = toNumberOrNull((t as any).quantite);
                  const uniteRaw = (t as any).unite;
                  const quantiteValue = quantiteRaw ?? decoded.quantite;
                  const uniteValue =
                    (typeof uniteRaw === "string" ? uniteRaw.trim() : "") || decoded.unite || null;

                  const tempsPasse = Number((t as any).temps_reel_h ?? 0);
                  const tempsPasseDisplay = Math.round(tempsPasse * 100) / 100;
                  const progress = computeTaskProgress(t);
                  const avancementPct = progress.displayPercent;
                  const hasOffset = progress.isAdjusted;
                  const offsetPct = progress.offsetPercent;
                  const autoPct = progress.autoPercent;
                  const isAdjustingProgress = taskProgressEditingId === t.id;
                  const draftRaw = taskProgressDrafts[t.id];
                  const parsedDraft = Number(String(draftRaw ?? "").replace(",", "."));
                  const draftOffset = Number.isFinite(parsedDraft)
                    ? Math.max(-100, Math.min(100, Math.round(parsedDraft)))
                    : offsetPct;

                  const qtyLabel =
                    quantiteValue === null ? "Qte: --" : `Qte: ${quantiteValue}${uniteValue ? ` ${uniteValue}` : ""}`;
                  const tempsPrevuLabel =
                    autoPct === null ? "Temps prevu: -- h" : `Temps prevu: ${Math.round((toNumberOrNull((t as any).temps_prevu_h) ?? 0) * 100) / 100} h`;
                  const tempsPasseLabel = `Temps passe: ${tempsPasseDisplay} h`;
                  const progressFillClass =
                    avancementPct < 40 ? "bg-amber-400" : avancementPct < 80 ? "bg-blue-500" : "bg-emerald-500";
                  const assignedNames = getTaskAssignedIntervenantNames(t);
                  const orderLabel = taskOrderLabelById.get(t.id) ?? Math.max(0, Number(t.order_index ?? 0)) + 1;
                  const taskZoneLabel = resolveZoneName((t as any).zone_id ?? null);
                  const taskQuality = ((t as any).quality_status ?? "a_faire") as TaskQualityStatus;
                  const taskStep = String((t as any).etape_metier ?? "").trim();
                  const taskRepriseReason = String((t as any).reprise_reason ?? "").trim();

                  return (
                    <div
                      key={t.id}
                      className={[
                        "rounded-xl border border-slate-200 bg-white p-3 space-y-3",
                        draggedTaskId === t.id ? "opacity-60" : "",
                        taskReorderSaving ? "pointer-events-none" : "",
                      ].join(" ")}
                      draggable={!isEditing}
                      onDragStart={() => setDraggedTaskId(t.id)}
                      onDragOver={(event) => {
                        if (!draggedTaskId || draggedTaskId === t.id) return;
                        event.preventDefault();
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        if (!draggedTaskId || draggedTaskId === t.id || taskReorderSaving) return;
                        void moveTaskBeforeTask(draggedTaskId, t.id);
                      }}
                      onDragEnd={() => setDraggedTaskId(null)}
                    >
                      <div className="flex flex-wrap items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 shrink-0"
                          checked={t.status === "FAIT"}
                          onChange={() => toggleTaskDone(t)}
                        />

                        <div className="min-w-0 flex-1 basis-[18rem]">
                          {!isEditing ? (
                            <>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="cursor-grab text-slate-300" aria-hidden="true">::</span>
                                <div className="font-medium break-words">{displayTitreClean}</div>
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                                  #{orderLabel}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">
                                {resolveTaskLotName(t)} | Intervenants: {assignedNames.join(", ") || "—"}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                                  Zone : {taskZoneLabel}
                                </span>
                                <span
                                  className={[
                                    "rounded-full border px-2 py-0.5",
                                    taskQualityBadgeClass(taskQuality),
                                  ].join(" ")}
                                >
                                  Qualité : {taskQualityLabel(taskQuality)}
                                </span>
                                {taskStep ? (
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                                    Étape : {taskStep}
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {qtyLabel} / {tempsPrevuLabel} / {tempsPasseLabel}
                              </div>
                              {taskRepriseReason && taskQuality === "a_reprendre" ? (
                                <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                  Motif de reprise : {taskRepriseReason}
                                </div>
                              ) : null}
                              <div className="mt-2 space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                                    <div
                                      className={["h-full transition-all", progressFillClass].join(" ")}
                                      style={{ width: `${Math.max(0, Math.min(100, avancementPct))}%` }}
                                    />
                                  </div>
                                  <span className="text-xs text-slate-600 tabular-nums">
                                    {`${avancementPct}%`}
                                  </span>
                                  {hasOffset && (
                                    <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-700">
                                      Ajuste admin ({offsetPct > 0 ? "+" : ""}
                                      {offsetPct}%)
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {autoPct === null
                                    ? `Auto indisponible (temps prevu manquant) | Ajustement admin: ${offsetPct > 0 ? "+" : ""}${offsetPct}% | Final: ${avancementPct}%`
                                    : `Auto: ${autoPct}% | Ajustement admin: ${offsetPct > 0 ? "+" : ""}${offsetPct}% | Final: ${avancementPct}%`}
                                </div>
                                {!isAdjustingProgress ? (
                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => startTaskProgressEdit(t)}
                                      className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                                    >
                                      Ajuster
                                    </button>
                                  </div>
                                ) : (
                                  <div className="rounded-lg border bg-slate-50 p-2 space-y-2">
                                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                                      <span>Ajustement (offset)</span>
                                      <span>
                                        {draftOffset > 0 ? "+" : ""}
                                        {draftOffset}%
                                      </span>
                                    </div>
                                    <input
                                      type="range"
                                      min={-100}
                                      max={100}
                                      step={1}
                                      value={String(draftOffset)}
                                      onChange={(e) => onTaskProgressDraftChange(t.id, e.target.value)}
                                      className="w-full accent-blue-600"
                                    />
                                    <div className="flex flex-wrap justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => void applyTaskProgressOffset(t)}
                                        disabled={taskProgressSavingId === t.id}
                                        className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                                      >
                                        {taskProgressSavingId === t.id ? "..." : "Enregistrer"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => cancelTaskProgressEdit(t)}
                                        disabled={taskProgressSavingId === t.id}
                                        className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                                      >
                                        Annuler
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void resetTaskProgressOffset(t)}
                                        disabled={taskProgressSavingId === t.id || !hasOffset}
                                        className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
                                      >
                                        Auto
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          ) : (
                            <div className="rounded-xl border bg-slate-50 p-3 space-y-3">
                              <div className="grid gap-2 md:grid-cols-10">
                                <label className="space-y-1 text-xs text-slate-600 md:col-span-3">
                                  <div>Intitule</div>
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editTitre}
                                    onChange={(e) => setEditTitre(e.target.value)}
                                  />
                                </label>
                                <label className="space-y-1 text-xs text-slate-600 md:col-span-2">
                                  <div>Lot</div>
                                  <select
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editLotSelection}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      setEditLotSelection(value);
                                      if (value === "__CREATE__") {
                                        setEditCorpsEtat("");
                                        return;
                                      }
                                      setEditCorpsEtat(value);
                                    }}
                                  >
                                    {lotOptions.map((lot) => (
                                      <option key={lot} value={lot}>
                                        {lot}
                                      </option>
                                    ))}
                                    <option value="__DIVIDER__" disabled>
                                      ------------
                                    </option>
                                    <option value="__CREATE__">+ Creer un nouveau lot...</option>
                                  </select>
                                </label>
                                <label className="space-y-1 text-xs text-slate-600">
                                  <div>Quantite</div>
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    inputMode="decimal"
                                    value={editQuantite}
                                    onChange={(e) => setEditQuantite(e.target.value)}
                                  />
                                </label>
                                <label className="space-y-1 text-xs text-slate-600">
                                  <div>Unite</div>
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editUnite}
                                    onChange={(e) => setEditUnite(e.target.value)}
                                  />
                                </label>
                                <label className="space-y-1 text-xs text-slate-600 md:col-span-3">
                                  <div>Statut</div>
                                  <select
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editStatus as any}
                                    onChange={(e) => {
                                      const nextStatus = e.target.value as TaskStatus;
                                      setEditStatus(nextStatus);
                                      setEditTaskQualityStatus(getQualityStatusFromTaskStatus(nextStatus));
                                    }}
                                  >
                                    <option value="A_FAIRE">A faire</option>
                                    <option value="EN_COURS">En cours</option>
                                    <option value="FAIT">Fait</option>
                                  </select>
                                </label>
                              </div>

                              {editLotSelection === "__CREATE__" && (
                                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    placeholder="Nom du nouveau lot"
                                    value={editLotDraftName}
                                    onChange={(e) => setEditLotDraftName(e.target.value)}
                                  />
                                  <button
                                    type="button"
                                    className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-100"
                                    onClick={() => void createLotAndSelect(editLotDraftName, "edit")}
                                  >
                                    Créer le lot
                                  </button>
                                </div>
                              )}

                              <div className="grid gap-2 md:grid-cols-2">
                                <label className="space-y-1 text-xs text-slate-600">
                                  <div>Zone / pièce</div>
                                  <select
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editTaskZoneId}
                                    onChange={(e) => setEditTaskZoneId(e.target.value)}
                                  >
                                    <option value="">Sans zone</option>
                                    {zones.map((zone) => (
                                      <option key={zone.id} value={zone.id}>
                                        {zone.nom}
                                        {zone.niveau ? ` · ${zone.niveau}` : ""}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="space-y-1 text-xs text-slate-600">
                                  <div>Étape métier</div>
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    placeholder="Ex : ossature, isolation, finitions"
                                    value={editTaskStepName}
                                    onChange={(e) => setEditTaskStepName(e.target.value)}
                                  />
                                </label>
                              </div>

                              <div className="grid gap-2 md:grid-cols-2">
                                <label className="space-y-1 text-xs text-slate-600">
                                  <div>Temps prevu (h)</div>
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    inputMode="decimal"
                                    placeholder="ex: 2.5"
                                    value={editTempsPrevuH}
                                    onChange={(e) => setEditTempsPrevuH(e.target.value)}
                                  />
                                  <p className="text-[11px] text-slate-500">Utilise pour le calcul automatique d'avancement</p>
                                </label>
                                <label className="space-y-1 text-xs text-slate-600">
                                  <div>Statut qualité</div>
                                  <select
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editTaskQualityStatus}
                                    onChange={(e) => {
                                      const nextQualityStatus = e.target.value as TaskQualityStatus;
                                      setEditTaskQualityStatus(nextQualityStatus);
                                      setEditStatus(getTaskStatusFromQualityStatus(nextQualityStatus));
                                    }}
                                  >
                                    <option value="a_faire">À faire</option>
                                    <option value="en_cours">En cours</option>
                                    <option value="termine_intervenant">Terminé intervenant</option>
                                    <option value="valide_admin">Validé admin</option>
                                    <option value="a_reprendre">À reprendre</option>
                                  </select>
                                </label>
                              </div>
                              {editTaskQualityStatus === "a_reprendre" ? (
                                <label className="block space-y-1 text-xs text-slate-600">
                                  <div>Motif de reprise</div>
                                  <input
                                    className="w-full rounded-xl border bg-white px-3 py-2 text-sm text-slate-900"
                                    value={editTaskRepriseReason}
                                    onChange={(e) => setEditTaskRepriseReason(e.target.value)}
                                    placeholder="Ex : finition non conforme, reprise joint..."
                                  />
                                </label>
                              ) : null}
                              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-xs font-medium text-slate-700">Intervenants affectés</div>
                                  <div className="text-[11px] text-slate-500">
                                    {editAssignedIntervenantIds.length > 0 ? `${editAssignedIntervenantIds.length} sélectionné(s)` : "Aucun intervenant sélectionné"}
                                  </div>
                                </div>
                                <div className="grid gap-2 md:grid-cols-2">
                                  {intervenants.map((x) => {
                                    const checked = editAssignedIntervenantIds.includes(x.id);
                                    return (
                                      <label key={x.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={(e) =>
                                            setEditAssignedIntervenantIds((prev) =>
                                              e.target.checked ? uniqueIds([...prev, x.id]) : prev.filter((id) => id !== x.id),
                                            )
                                          }
                                        />
                                        <span className="truncate">{x.nom}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                              {(toNumberOrNull(editTempsPrevuH) ?? 0) <= 0 && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                  Temps prevu requis pour un calcul automatique fiable de l'avancement.
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <span
                          className={[
                            "ml-auto shrink-0 self-start text-xs px-2 py-1 rounded-full border",
                            taskStatusBadgeClass(t.status),
                          ].join(" ")}
                        >
                          {taskStatusLabel(t.status, translate)}
                        </span>
                      </div>

                      {(() => {
                        const linkedIds = taskDocumentsByTaskId.get(t.id) ?? [];
                        const linkedDocs = linkedIds
                          .map((docId) => documentsById.get(docId))
                          .filter((doc): doc is ChantierDocumentRow => Boolean(doc));
                        const visibleDocs = linkedDocs.slice(0, 3);
                        const extraCount = Math.max(0, linkedDocs.length - visibleDocs.length);

                        return (
                          <div className="mt-2 space-y-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="text-xs text-slate-500 font-medium">Documents lies</div>
                              <button
                                type="button"
                                onClick={() => openTaskDocumentsModal(t)}
                                className="text-xs rounded-lg border px-2 py-1 hover:bg-slate-50"
                              >
                                Lier documents
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {linkedDocs.length === 0 ? (
                                <span className="text-xs text-slate-500">Aucun</span>
                              ) : (
                                <>
                                  {visibleDocs.map((doc) => (
                                    <span
                                      key={doc.id}
                                      className="text-xs rounded-full border bg-slate-50 px-2 py-1 text-slate-700"
                                    >
                                      {doc.title}
                                    </span>
                                  ))}
                                  {extraCount > 0 && (
                                    <span className="text-xs rounded-full border bg-slate-50 px-2 py-1 text-slate-700">
                                      +{extraCount}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {!isEditing ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void applyTaskQualityDecision(t, "valide_admin")}
                            className="text-sm rounded-xl border border-emerald-200 px-3 py-2 text-emerald-700 hover:bg-emerald-50"
                          >
                            Valider
                          </button>
                          <button
                            type="button"
                            onClick={() => void applyTaskQualityDecision(t, "a_reprendre")}
                            className="text-sm rounded-xl border border-red-200 px-3 py-2 text-red-700 hover:bg-red-50"
                          >
                            À reprendre
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditTask(t)}
                            className="text-sm rounded-xl border px-3 py-2 hover:bg-slate-50"
                          >
                            Modifier
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openTaskTemplateDrawerFromTask(t)}
                            className="text-sm rounded-xl border px-3 py-2 hover:bg-slate-50"
                            disabled={savingTask || taskTemplateSaving}
                          >
                            Ajouter a la bibliotheque
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditTask}
                            className="text-sm rounded-xl border px-3 py-2 hover:bg-slate-50"
                            disabled={savingTask}
                          >
                            Annuler
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditTask(t)}
                            className={[
                              "text-sm rounded-xl px-3 py-2",
                              savingTask ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                            ].join(" ")}
                            disabled={savingTask}
                          >
                            {savingTask ? "Enregistrement..." : "Enregistrer"}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ---------------- ONGLET MATÉRIEL ---------------- */}
        {tab === "consignes" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold section-title">Consignes</div>
                <div className="text-sm text-slate-500">
                  Instructions opérationnelles du chantier, distinctes des tâches et de la messagerie.
                </div>
              </div>
              <button
                type="button"
                onClick={refreshConsignes}
                className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                disabled={consignesLoading}
              >
                {consignesLoading ? "Chargement..." : "Rafraîchir"}
              </button>
            </div>

            {consignesError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {consignesError}
              </div>
            ) : null}

            <form onSubmit={saveConsigne} className="rounded-xl border bg-slate-50 p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-sm">
                  {consigneEditingId ? "Modifier une consigne" : "Créer une consigne"}
                </div>
                {consigneEditingId ? (
                  <button
                    type="button"
                    onClick={resetConsigneForm}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                    disabled={consigneSaving}
                  >
                    Annuler
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3">
                <textarea
                  className="rounded-xl border px-3 py-2 text-sm min-h-[120px] resize-y"
                  placeholder="Description de la consigne"
                  value={consigneDescription}
                  onChange={(e) => setConsigneDescription(e.target.value)}
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    className="rounded-xl border px-3 py-2 text-sm"
                    type="date"
                    value={consigneDateDebut}
                    onChange={(e) => setConsigneDateDebut(e.target.value)}
                  />

                  <select
                    className="rounded-xl border px-3 py-2 text-sm"
                    value={consigneTaskId}
                    onChange={(e) => setConsigneTaskId(e.target.value)}
                  >
                    <option value="">Tâche liée (optionnel)</option>
                    {tasks.map((task) => (
                      <option key={task.id} value={task.id}>
                        {stripLegacyPrefix(task.titre ?? "")}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-xs text-slate-500">
                  Date optionnelle. Si elle est vide, la consigne sera enregistrée pour aujourd&apos;hui.
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={consigneSaving}
                  className={[
                    "rounded-xl px-4 py-2 text-sm",
                    consigneSaving ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                >
                  {consigneSaving ? "Enregistrement..." : consigneEditingId ? "Enregistrer" : "Ajouter"}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              {consignesLoading ? (
                <div className="text-sm text-slate-500">Chargement...</div>
              ) : consignes.length === 0 ? (
                <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-500">
                  Aucune consigne chantier.
                </div>
              ) : (
                consignes.map((row) => {
                  const targetIntervenants = row.applies_to_all ? intervenants : row.assignees;
                  const targetCount = targetIntervenants.length;
                  const readCount = row.read_intervenant_ids.filter((intervenantId) =>
                    targetIntervenants.some((intervenant) => intervenant.id === intervenantId),
                  ).length;
                  const dateLabel = row.date_debut
                    ? `Le ${new Date(`${row.date_debut}T00:00:00`).toLocaleDateString("fr-FR")}`
                    : "Aujourd'hui";

                  return (
                    <article key={row.id} className="rounded-xl border p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 text-xs text-slate-500">
                          {dateLabel}
                          {row.task_titre ? ` • Tâche: ${stripLegacyPrefix(row.task_titre)}` : ""}
                        </div>
                        <span className="text-xs rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-700">
                          {targetCount > 0 ? `${readCount}/${targetCount} lus` : "Aucun destinataire"}
                        </span>
                      </div>

                      <div className="text-sm text-slate-900 whitespace-pre-wrap">{row.description}</div>

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEditConsigne(row)}
                          className="text-sm rounded-xl border px-3 py-2 hover:bg-slate-50"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeConsigne(row)}
                          className="text-sm rounded-xl border border-red-200 px-3 py-2 text-red-700 hover:bg-red-50"
                        >
                          Supprimer
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ---------------- ONGLET MATÉRIEL ---------------- */}
        {tab === "materiel" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold section-title">Matériel</div>
                <div className="text-sm text-slate-500">
                  Demandes matériel avec statut : En attente / Validée / Refusée / Livrée.
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={materielFilter}
                  onChange={(e) => setMaterielFilter(e.target.value as "__ALL__" | MaterielStatus)}
                >
                  <option value="__ALL__">Tous</option>
                  <option value="en_attente">En attente</option>
                  <option value="validee">Validée</option>
                  <option value="refusee">Refusée</option>
                  <option value="livree">Livrée</option>
                </select>
                <button
                  type="button"
                  onClick={refreshMateriel}
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  disabled={materielLoading}
                >
                  {materielLoading ? "Chargement..." : "Rafraîchir"}
                </button>
              </div>
            </div>

            {materielError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {materielError}
              </div>
            )}

            <form onSubmit={onAddMateriel} className="rounded-xl border bg-slate-50 p-4 space-y-3">
              <div className="font-semibold text-sm">Créer une demande de matériel</div>

              <div className="grid gap-2 md:grid-cols-3">
                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={mIntervenantId}
                  onChange={(e) => setMIntervenantId(e.target.value)}
                >
                  <option value="__NONE__">Intervenant (obligatoire)</option>
                  {intervenants.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nom}
                    </option>
                  ))}
                </select>

                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={mTaskId}
                  onChange={(e) => setMTaskId(e.target.value)}
                >
                  <option value="">Tâche concernée (optionnel)</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.titre}
                    </option>
                  ))}
                </select>

                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder="Désignation (obligatoire)"
                  value={mDesignation}
                  onChange={(e) => setMDesignation(e.target.value)}
                />

                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-xl border px-3 py-2 text-sm"
                    placeholder="Qté"
                    value={mQuantite}
                    onChange={(e) => setMQuantite(e.target.value)}
                  />
                  <input
                    className="rounded-xl border px-3 py-2 text-sm"
                    placeholder="Unite (ex: U, m², ml...)"
                    value={mUnite}
                    onChange={(e) => setMUnite(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  type="date"
                  value={mDate}
                  onChange={(e) => setMDate(e.target.value)}
                />

                <select
                  className="rounded-xl border px-3 py-2 text-sm"
                  value={mStatus}
                  onChange={(e) => setMStatus(e.target.value as any)}
                >
                  <option value="en_attente">En attente</option>
                  <option value="validee">Validée</option>
                  <option value="refusee">Refusée</option>
                  <option value="livree">Livrée</option>
                </select>

                <input
                  className="rounded-xl border px-3 py-2 text-sm"
                  placeholder="Remarques (optionnel)"
                  value={mRemarques}
                  onChange={(e) => setMRemarques(e.target.value)}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={addingMateriel}
                  className={[
                    "rounded-xl px-4 py-2 text-sm",
                    addingMateriel ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                >
                  {addingMateriel ? "Ajout..." : "+ Ajouter"}
                </button>
              </div>
            </form>

            <div className="space-y-2">
              {materielLoading ? (
                <div className="text-sm text-slate-500">Chargement...</div>
              ) : filteredMateriel.length === 0 ? (
                <div className="text-sm text-slate-500">Aucune demande matériel.</div>
              ) : (
                filteredMateriel.map((m) => {
                  const it = intervenantById.get(m.intervenant_id);
                  const displayName = m.titre || m.designation || "Demande matériel";
                  const draftComment = materielAdminComments[m.id] ?? m.admin_commentaire ?? "";
                  return (
                    <div key={m.id} className="rounded-xl border p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {displayName} • Qté {m.quantite}
                            {m.unite ? ` ${m.unite}` : ""}
                          </div>
                          {(m.task_titre || m.task_id) ? (
                            <div className="text-xs text-slate-500">
                              Tâche : {m.task_titre ?? tasks.find((task) => task.id === m.task_id)?.titre ?? "—"}
                            </div>
                          ) : null}
                          <div className="text-xs text-slate-500">Intervenant : {it?.nom ?? "—"}</div>
                          {m.date_souhaitee ? (
                            <div className="text-xs text-slate-500">Date souhaitée : {new Date(`${m.date_souhaitee}T00:00:00`).toLocaleDateString("fr-FR")}</div>
                          ) : null}
                        </div>

                        <span className={["text-xs px-2 py-1 rounded-full border", materielStatusBadgeClass(m.statut)].join(" ")}>
                          {materielStatusLabel(m.statut)}
                        </span>
                      </div>

                      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
                        <input
                          className="rounded-xl border px-3 py-2 text-sm"
                          placeholder="Commentaire admin (optionnel)"
                          value={draftComment}
                          onChange={(e) =>
                            setMaterielAdminComments((prev) => ({
                              ...prev,
                              [m.id]: e.target.value,
                            }))
                          }
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onUpdateMaterielStatus(m, "validee")}
                            className="text-sm rounded-xl border px-3 py-2 hover:bg-blue-50"
                          >
                            Valider
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateMaterielStatus(m, "refusee")}
                            className="text-sm rounded-xl border px-3 py-2 hover:bg-red-50"
                          >
                            Refuser
                          </button>
                          <button
                            type="button"
                            onClick={() => onUpdateMaterielStatus(m, "livree")}
                            className="text-sm rounded-xl border px-3 py-2 hover:bg-emerald-50"
                          >
                            Livrée
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteMateriel(m)}
                            className="text-sm rounded-xl border border-red-200 text-red-700 px-3 py-2 hover:bg-red-50"
                          >
                            Supprimer
                          </button>
                        </div>
                      </div>

                      {m.commentaire ? <div className="text-sm text-slate-600">{m.commentaire}</div> : null}
                      {m.admin_commentaire ? <div className="text-sm text-slate-500">Admin: {m.admin_commentaire}</div> : null}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === "planning" && id && (
          <Suspense
            fallback={
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                Chargement du planning...
              </div>
            }
          >
            <PlanningTab chantierId={id} chantierName={item?.nom ?? null} intervenants={intervenants} />
          </Suspense>
        )}

        {tab === "photos" && id && (
          <ChantierPhotosTab chantierId={id} tasks={tasks} zones={zones} />
        )}

        {tab === "journal" && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold section-title">Journal chantier</div>
                <div className="text-sm text-slate-500">
                  Historique des actions, validations, consignes, réserves et temps saisis.
                </div>
              </div>
              <button
                type="button"
                onClick={() => void refreshActivityLogs()}
                disabled={activityLogsLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {activityLogsLoading ? "Chargement..." : "Rafraîchir"}
              </button>
            </div>

            {!activityLogSchemaReady && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Migration journal non appliquée : le tableau reste vide tant que
                `20260402100000_batipro_v2_foundation_prepare_control_pilot.sql` n’est pas poussée sur Supabase.
              </div>
            )}

            {activityLogsError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {activityLogsError}
              </div>
            )}

            <div className="space-y-3">
              {activityLogsLoading ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  Chargement du journal...
                </div>
              ) : activityLogs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
                  Aucun événement journalisé pour ce chantier.
                </div>
              ) : (
                activityLogs.map((log) => (
                  <article
                    key={log.id}
                    className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={[
                              "rounded-full border px-3 py-1 text-xs font-semibold",
                              chantierActivityTone(log.entity_type),
                            ].join(" ")}
                          >
                            {chantierActivityEntityLabel(log.entity_type)}
                          </span>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                            {chantierActivityActionLabel(log.action_type)}
                          </span>
                        </div>
                        <div className="mt-3 text-base font-semibold text-slate-900">
                          {log.reason || "Action chantier"}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                          <span>{log.actor_name || "Utilisateur"}</span>
                          {log.actor_role ? <span>{log.actor_role}</span> : null}
                          <span>{new Date(log.created_at).toLocaleString("fr-FR")}</span>
                        </div>
                      </div>
                    </div>

                    {Object.keys(log.changes || {}).length > 0 ? (
                      <pre className="mt-4 max-h-64 overflow-auto rounded-2xl bg-slate-950 px-4 py-3 text-xs leading-relaxed text-slate-100">
                        {JSON.stringify(log.changes, null, 2)}
                      </pre>
                    ) : null}
                  </article>
                ))
              )}
            </div>
          </div>
        )}

        {tab === "doe" && id && (
          <DoeTab
            chantierId={id}
            chantierName={item?.nom ?? "Chantier"}
            chantierAddress={(item as any)?.adresse ?? null}
            clientName={(item as any)?.client_nom ?? (item as any)?.client ?? null}
            documents={documents}
            onDocumentsRefresh={async () => {
              const data = await refreshChantierDocuments();
              setDocuments(data);
              await refreshDoeDocumentIds();
            }}
          />
        )}

        {tab === "visite" && id && (
          <VisiteTab
            chantierId={id}
            chantierName={item?.nom ?? "Chantier"}
            chantierReference={(item as any)?.reference ?? id}
            chantierAddress={(item as any)?.adresse ?? null}
            clientName={(item as any)?.client_nom ?? (item as any)?.client ?? null}
            intervenants={intervenants}
            onDocumentsRefresh={async () => {
              const data = await refreshChantierDocuments();
              setDocuments(data);
              await refreshDoeDocumentIds();
            }}
          />
        )}

        {/* autres onglets placeholders */}
        {tab !== "accueil" &&
          tab !== "devis-taches" &&
          tab !== "intervenants" &&
          tab !== "documents" &&
          tab !== "reserves" &&
          tab !== "achats" &&
          tab !== "photos" &&
          tab !== "temps" &&
          tab !== "materiel" &&
          tab !== "consignes" &&
          tab !== "planning" &&
          tab !== "journal" &&
          tab !== "doe" &&
          tab !== "visite" && (
            <div className="space-y-3">
              <div className="font-semibold">
                {tab === "messagerie" && "Messagerie"}
                {tab === "rapports" && "Rapports"}
              </div>
              <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                Onglet en cours d’implémentation.
              </div>
            </div>
          )}
      </div>

        {/* DRAWER RESERVES */}
        {reserveDrawerOpen && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={closeReserveDrawer} />
            <div className="absolute right-0 top-0 h-screen w-full sm:w-[90vw] lg:w-[85vw] lg:min-w-[980px] 2xl:w-[70vw] bg-white border-l shadow-xl flex flex-col">
              <div className="px-3 lg:px-4 py-3 border-b flex items-center justify-between">
                <div className="font-semibold truncate">
                  {t("intervenantAccess.tabs.reserves")} — {activeReserve?.title ?? t("chantierPage.newReserve")}
                </div>
                <button
                  type="button"
                  className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
                  onClick={closeReserveDrawer}
                  disabled={reserveSaving}
                >
                  ×
                </button>
              </div>

              <div className="px-3 lg:px-4 py-2 border-b flex gap-2">
                {(
                  [
                    { key: "details", label: t("chantierPage.details") },
                    { key: "photos", label: t("common.documentCategories.photos") },
                    { key: "plan", label: t("common.documentCategories.plans") },
                  ] as const
                ).map((t) => {
                  const disabled = !activeReserve && t.key !== "details";
                  return (
                    <button
                      key={t.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => setReserveDrawerTab(t.key)}
                      className={[
                        "chip-btn",
                        reserveDrawerTab === t.key ? "chip-btn--active" : "chip-btn--inactive",
                        disabled ? "opacity-50 cursor-not-allowed" : "",
                      ].join(" ")}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto px-3 lg:px-4 py-3 space-y-4">
                {reserveDrawerTab === "details" && (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-600">{t("common.labels.title")}</div>
                      <input
                        className="w-full rounded-xl border px-3 py-2 text-sm"
                        value={reserveDraftTitle}
                        onChange={(e) => setReserveDraftTitle(e.target.value)}
                        placeholder={t("chantierPage.reserveTitlePlaceholder")}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-slate-600">{t("chantierPage.description")}</div>
                      <textarea
                        className="w-full rounded-xl border px-3 py-2 text-sm min-h-[120px]"
                        value={reserveDraftDescription}
                        onChange={(e) => setReserveDraftDescription(e.target.value)}
                        placeholder={t("chantierPage.reserveDescriptionPlaceholder")}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <div className="text-xs text-slate-600">{t("common.labels.status")}</div>
                        <select
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={reserveDraftStatus}
                          onChange={(e) => setReserveDraftStatus(e.target.value as ReserveStatus)}
                        >
                          <option value="OUVERTE">{t("common.reserveStatus.OUVERTE")}</option>
                          <option value="EN_COURS">{t("common.reserveStatus.EN_COURS")}</option>
                          <option value="LEVEE">{t("common.reserveStatus.LEVEE")}</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-slate-600">{t("chantierPage.priority")}</div>
                        <select
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={reserveDraftPriority}
                          onChange={(e) => setReserveDraftPriority(e.target.value as ReservePriority)}
                        >
                          <option value="BASSE">{t("common.reservePriority.BASSE")}</option>
                          <option value="NORMALE">{t("common.reservePriority.NORMALE")}</option>
                          <option value="URGENTE">{t("common.reservePriority.URGENTE")}</option>
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <div className="text-xs text-slate-600">{t("chantierPage.tasks")}</div>
                        <select
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={reserveDraftTaskId}
                          onChange={(e) => {
                            const nextTaskId = e.target.value;
                            setReserveDraftTaskId(nextTaskId);
                            const task = nextTaskId ? taskById.get(nextTaskId) : null;
                            setReserveDraftZoneId(task?.zone_id ?? "");
                          }}
                        >
                          <option value="">{t("chantierPage.selectTask")}</option>
                          {tasks.map((task) => (
                            <option key={task.id} value={task.id}>
                              {stripLegacyPrefix(task.titre ?? t("chantierPage.tasks"))}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <div className="text-xs text-slate-600">Zone / pièce</div>
                        <select
                          className="w-full rounded-xl border px-3 py-2 text-sm"
                          value={reserveDraftZoneId}
                          onChange={(e) => setReserveDraftZoneId(e.target.value)}
                        >
                          <option value="">Sans zone</option>
                          {zones.map((zone) => (
                            <option key={zone.id} value={zone.id}>
                              {zone.nom}
                              {zone.niveau ? ` · ${zone.niveau}` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <div className="text-xs text-slate-600">{t("intervenantAccess.intervenantLabel")}</div>
                        <select
                          className={[
                            "w-full rounded-xl border px-3 py-2 text-sm",
                            reserveDraftTaskId ? "bg-slate-50 text-slate-600" : "bg-white",
                          ].join(" ")}
                          value={
                            reserveDraftTaskId
                              ? (selectedReserveTask ? getTaskAssignedIntervenantIds(selectedReserveTask)[0] ?? "__NONE__" : "__NONE__")
                              : reserveDraftIntervenantId
                          }
                          onChange={(e) => setReserveDraftIntervenantId(e.target.value)}
                          disabled={!!reserveDraftTaskId}
                        >
                          <option value="__NONE__">{t("chantierPage.noIntervenant")}</option>
                          {intervenants.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.nom}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {activeReserve && (
                      <div>
                        <button
                          type="button"
                          onClick={markReserveLevee}
                          disabled={reserveSaving || reserveDraftStatus === "LEVEE"}
                          className={[
                            "rounded-xl border px-3 py-2 text-sm",
                            reserveDraftStatus === "LEVEE"
                              ? "bg-slate-100 text-slate-500 cursor-not-allowed"
                              : "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
                          ].join(" ")}
                        >
                          {t("chantierPage.markResolved")}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {reserveDrawerTab === "photos" && (
                  <div className="space-y-4">
                    {!activeReserve ? (
                      <div className="text-sm text-slate-500">
                        {t("chantierPage.createReserveForPhotos")}
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-semibold">{t("common.documentCategories.photos")}</div>
                          <div className="flex items-center gap-2">
                            <input
                              ref={reservePhotoInputRef}
                              type="file"
                              accept="image/*"
                              hidden
                              onChange={onSelectReservePhoto}
                            />
                            <button
                              type="button"
                              onClick={() => reservePhotoInputRef.current?.click()}
                              disabled={reservePhotoUploading}
                              className={[
                                "rounded-xl px-3 py-2 text-sm",
                                reservePhotoUploading
                                  ? "bg-slate-300 text-slate-700"
                                  : "bg-slate-900 text-white hover:bg-slate-800",
                              ].join(" ")}
                            >
                              {reservePhotoUploading ? "Upload..." : t("chantierPage.addPhoto")}
                            </button>
                          </div>
                        </div>

                        {reservePhotoFile && (
                          <div className="text-xs text-slate-500">
                            {t("chantierPage.selectedFile")}: {reservePhotoFile.name}
                          </div>
                        )}

                        {reservePhotosLoading ? (
                          <div className="text-sm text-slate-500">{t("common.states.loading")}</div>
                        ) : reservePhotos.length === 0 ? (
                          <div className="text-sm text-slate-500">{t("chantierPage.noPhotoLinked")}</div>
                        ) : (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {reservePhotos.map((doc) => {
                              const url = reservePhotoUrlCache[doc.id];
                              const isImage = (doc.mime_type ?? "").startsWith("image/");
                              return (
                                <div key={doc.id} className="rounded-xl border p-2 space-y-2">
                                  <div className="aspect-[4/3] rounded-lg border bg-slate-50 flex items-center justify-center overflow-hidden">
                                    {isImage && url ? (
                                      <img
                                        src={url}
                                        alt={doc.title}
                                        className="w-full h-full object-contain"
                                      />
                                    ) : (
                                      <div className="text-xs text-slate-500">Aperçu indisponible</div>
                                    )}
                                  </div>
                                  <div className="text-xs font-medium truncate">{doc.title}</div>
                                  <button
                                    type="button"
                                    onClick={() => openReserveDocument(doc)}
                                    className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                                  >
                                    Ouvrir
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {reserveDrawerTab === "plan" && (
                  <div className="space-y-4">
                    {planDocuments.length === 0 ? (
                      <div className="text-sm text-slate-500">
                        Aucun plan disponible. Ajoutez un document de type PLAN dans l’onglet Documents.
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-end justify-between gap-3">
                          <div className="space-y-1 min-w-[220px]">
                            <div className="text-xs text-slate-600">Choisir un plan</div>
                            <select
                              className="w-full rounded-xl border px-3 py-2 text-sm"
                              value={reservePlanDocumentId}
                              onChange={(e) => onSelectReservePlan(e.target.value)}
                            >
                              <option value="">Sélectionner un plan</option>
                              {planDocuments.map((doc) => (
                                <option key={doc.id} value={doc.id}>
                                  {doc.title || doc.file_name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            disabled={!selectedPlanDoc}
                            onClick={() => selectedPlanDoc && openReserveDocument(selectedPlanDoc)}
                            className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            Ouvrir
                          </button>
                          <label className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                            <input
                              type="checkbox"
                              checked={reserveShowAllMarkers}
                              onChange={(e) => setReserveShowAllMarkers(e.target.checked)}
                            />
                            Afficher toutes les réserves
                          </label>
                        </div>

                        {reservePlanError && (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                            {reservePlanError}
                          </div>
                        )}

                        {!reservePlanDocumentId ? (
                          <div className="text-sm text-slate-500">Choisissez un plan pour l’afficher.</div>
                        ) : reservePlanLoading ? (
                          <div className="text-sm text-slate-500">Chargement du plan…</div>
                        ) : !reservePlanUrl ? (
                          <div className="text-sm text-slate-500">Aperçu indisponible.</div>
                        ) : (
                          <div className="space-y-2">
                            <div className="text-xs text-slate-500 flex items-center gap-2">
                              <span
                                className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px]"
                                title="Consultation: clic marqueur = sélection. Corbeille: suppression avec annulation 5s."
                              >
                                i
                              </span>
                              {activeReserve ? (
                                <span className="font-medium text-slate-700">Réserve active : {activeReserve.title}</span>
                              ) : (
                                <span className="text-amber-700">Aucune réserve active.</span>
                              )}
                            </div>
                            <ReservePlanViewer
                              url={reservePlanUrl}
                              mimeType={selectedPlanDoc?.mime_type ?? null}
                              markers={reserveMarkersForPlan.map((marker) => ({
                                ...marker,
                                status:
                                  reserves.find((reserve) => reserve.id === marker.reserve_id)?.status ?? null,
                              }))}
                              selectedMarkerId={reserveSelectedMarkerId}
                              selectedReserveId={activeReserve?.id ?? null}
                              drawingMode={reserveDrawingMode}
                              onDrawingModeChange={setReserveDrawingMode}
                              onCreateMarker={onCreateReserveMarker}
                              onSelectMarker={onSelectReserveMarker}
                              onDeleteSelected={deleteSelectedReserveMarker}
                              onDeleteMarker={deleteReserveMarkerById}
                              onRemoveLegendGroup={removeReserveLegendGroup}
                              onRenameLegendGroup={renameReserveLegendGroup}
                              markerSaving={reserveMarkerSaving}
                              showAllReserves={reserveShowAllMarkers}
                            />
                            {reserveMarkersLoading && (
                              <div className="text-xs text-slate-500">Chargement des repères…</div>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {reserveDrawerError && (
                <div className="mx-4 my-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {reserveDrawerError}
                </div>
              )}

              <div className="sticky bottom-0 border-t bg-white/95 backdrop-blur px-3 lg:px-4 py-3 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={closeReserveDrawer}
                  disabled={reserveSaving}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={saveReserve}
                  disabled={reserveSaving}
                  className={[
                    "rounded-xl px-4 py-2 text-sm",
                    reserveSaving ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                >
                  {reserveSaving ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        )}

        <TaskDocumentsDrawer
          open={taskDocumentsModalOpen}
          taskTitle={taskDocumentsModalTask?.titre ?? "Tâche"}
          documents={chantierDocuments}
          selectedIds={taskDocumentsSelection}
          onSelectionChange={setTaskDocumentsSelection}
          intervenants={intervenants.map((intervenant) => ({ id: intervenant.id, nom: intervenant.nom }))}
          selectedIntervenantIds={taskDocumentsIntervenantIds}
          onIntervenantSelectionChange={setTaskDocumentsIntervenantIds}
          shareWithAllIntervenants={taskDocumentsShareAll}
          onShareWithAllIntervenantsChange={setTaskDocumentsShareAll}
          query={taskDocumentsQuery}
          onQueryChange={setTaskDocumentsQuery}
          onClose={closeTaskDocumentsModal}
          onSave={saveTaskDocuments}
          saving={taskDocumentsModalSaving}
          error={taskDocumentsModalError}
          loading={taskDocumentsLoading}
        />

        <DocumentEditDrawer
          open={documentEditOpen}
          documentTitle={documentEditDoc?.title ?? documentEditDoc?.file_name ?? "Document"}
          title={documentEditTitle}
          category={documentEditCategory}
          documentType={documentEditType}
          visibilityMode={documentEditVisibilityMode}
          accessIds={documentEditAccessIds}
          intervenants={intervenants}
          onTitleChange={setDocumentEditTitle}
          onCategoryChange={setDocumentEditCategory}
          onDocumentTypeChange={setDocumentEditType}
          onVisibilityModeChange={setDocumentEditVisibilityMode}
          onAccessIdsChange={setDocumentEditAccessIds}
          onClose={closeDocumentEdit}
          onSave={saveDocumentEdit}
          onDelete={deleteDocumentEdit}
          saving={documentEditSaving}
          deleting={documentEditDeleting}
          loadingAccess={documentEditLoadingAccess}
          error={documentEditError}
          infoMessage={documentEditInfoMessage}
          canSave={documentEditOpen && !!documentEditDoc}
        />

        <TaskTemplateDrawer
          open={taskTemplateDrawerOpen}
          template={null}
          initialValues={taskTemplateSeed}
          saving={taskTemplateSaving}
          deleting={false}
          error={taskTemplateError}
          onClose={closeTaskTemplateDrawer}
          onSave={saveTaskTemplateFromTask}
          onDelete={async () => {}}
        />

        <DevisImportDrawer
          open={devisImportDrawerOpen}
          chantierId={id ?? null}
          intervenants={intervenants}
          onClose={() => setDevisImportDrawerOpen(false)}
          onImported={onDevisImported}
        />

        {/* MODAL IMPORT DOCUMENT */}
        {documentModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={closeDocumentModal}
          >
            <div
              className="w-full max-w-2xl rounded-2xl bg-white border p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold">Importer un document</div>
                <button
                  type="button"
                  className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
                  onClick={closeDocumentModal}
                  disabled={documentUploading}
                >
                  ×
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs text-slate-600">Fichier</div>
                  <div
                    className={[
                      "rounded-xl border border-dashed px-4 py-6 text-sm text-slate-600 text-center cursor-pointer",
                      documentDragActive ? "bg-slate-50 border-slate-400" : "bg-white border-slate-200",
                    ].join(" ")}
                    onClick={() => documentInputRef.current?.click()}
                    onDragOver={onDocumentDragOver}
                    onDragLeave={onDocumentDragLeave}
                    onDrop={onDocumentDrop}
                  >
                    {documentFile ? (
                      <div className="space-y-2">
                        <div className="font-medium text-slate-900 truncate">{documentFile.name}</div>
                        <div className="text-xs">
                          Taille : {(documentFile.size / (1024 * 1024)).toFixed(2)} Mo • Type :{" "}
                          {documentFile.type || "—"}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDocumentFileState(null);
                          }}
                          className="rounded-xl border px-2 py-1 text-xs hover:bg-slate-50"
                          disabled={documentUploading}
                        >
                          Retirer
                        </button>
                      </div>
                    ) : (
                      <div>
                        Glissez-déposez un fichier ici ou cliquez pour sélectionner.
                        <div className="text-xs text-slate-500 mt-1">
                          PDF, images, Word, Excel
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    ref={documentInputRef}
                    type="file"
                    hidden
                    onChange={onSelectDocumentFile}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <div className="text-xs text-slate-600">Nom du document</div>
                    <input
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={documentName}
                      onChange={(e) => setDocumentName(e.target.value)}
                      placeholder="Nom du document"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-slate-600">Catégorie</div>
                    <select
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={documentCategory}
                      onChange={(e) => setDocumentCategory(e.target.value)}
                    >
                      {DOCUMENT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-slate-600">Type</div>
                    <select
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={documentType}
                      onChange={(e) => setDocumentType(e.target.value)}
                    >
                      {DOCUMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs text-slate-600">Mode visibilité</div>
                    <select
                      className="w-full rounded-xl border px-3 py-2 text-sm"
                      value={documentVisibilityMode}
                      onChange={(e) => setDocumentVisibilityMode(e.target.value as DocumentVisibilityOption)}
                    >
                      {DOCUMENT_VISIBILITY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Intervenants autorisés</div>
                  <div
                    className={[
                      "rounded-xl border p-3 space-y-2 max-h-40 overflow-auto",
                      documentVisibilityMode === "RESTRICTED" ? "bg-white" : "bg-slate-50 text-slate-400",
                    ].join(" ")}
                  >
                    {intervenantsLoading ? (
                      <div className="text-xs text-slate-500">Chargement...</div>
                    ) : intervenants.length === 0 ? (
                      <div className="text-xs text-slate-500">Aucun intervenant disponible.</div>
                    ) : (
                      intervenants.map((i) => {
                        const checked = documentAccessIds.includes(i.id);
                        return (
                          <label key={i.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={documentVisibilityMode !== "RESTRICTED"}
                              onChange={() =>
                                setDocumentAccessIds((prev) =>
                                  checked ? prev.filter((id) => id !== i.id) : [...prev, i.id],
                                )
                              }
                            />
                            <span>{i.nom}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {documentVisibilityMode !== "RESTRICTED" && (
                    <div className="text-xs text-slate-500">Sélection désactivée pour ce mode.</div>
                  )}
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Lier à une tâche (optionnel)</div>
                  <select
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={documentTaskId}
                    onChange={(e) => setDocumentTaskId(e.target.value)}
                    disabled={tasksLoading}
                  >
                    <option value="">Aucune</option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.titre}
                      </option>
                    ))}
                  </select>
                </div>

                {documentModalError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {documentModalError}
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                    onClick={closeDocumentModal}
                    disabled={documentUploading}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={onImportDocument}
                    disabled={documentUploading}
                    className={[
                      "rounded-xl px-4 py-2 text-sm",
                      documentUploading
                        ? "bg-slate-300 text-slate-700"
                        : "bg-slate-900 text-white hover:bg-slate-800",
                    ].join(" ")}
                  >
                    {documentUploading ? "Import..." : "Importer"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL PREVIEW DOCUMENT */}
        {documentPreviewOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={closeDocumentPreview}
          >
            <div
              className="w-full max-w-4xl rounded-2xl bg-white border p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold truncate">{documentPreviewTitle}</div>
                <button
                  type="button"
                  className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
                  onClick={closeDocumentPreview}
                  disabled={documentPreviewLoading}
                >
                  ×
                </button>
              </div>

              <div className="mt-4">
                {documentPreviewLoading ? (
                  <div className="text-sm text-slate-500">Chargement...</div>
                ) : documentPreviewError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {documentPreviewError}
                  </div>
                ) : documentPreviewMime?.startsWith("image/") ? (
                  <img src={documentPreviewUrl} alt={documentPreviewTitle} className="max-h-[70vh] w-auto mx-auto" />
                ) : documentPreviewMime === "application/pdf" ? (
                  <iframe
                    src={documentPreviewUrl}
                    title={documentPreviewTitle}
                    className="w-full h-[70vh] rounded-xl border"
                  />
                ) : (
                  <div className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-600">
                    Aperçu non disponible.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL EDIT INTERVENANT */}
        {editingIntervenant && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={() => {
              if (!savingIntervenant) cancelEditIntervenant();
            }}
          >
            <div className="w-full max-w-md rounded-2xl bg-white border p-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">Modifier intervenant</div>
                <button
                  type="button"
                  className="rounded-xl border px-2 py-1 text-sm hover:bg-slate-50"
                  onClick={cancelEditIntervenant}
                  disabled={savingIntervenant}
                >
                  ×
                </button>
              </div>

              <div className="mt-3 space-y-3">
                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Nom</div>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={editIntervenantNom}
                    onChange={(e) => setEditIntervenantNom(e.target.value)}
                    placeholder="Nom"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Email</div>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={editIntervenantEmail}
                    onChange={(e) => setEditIntervenantEmail(e.target.value)}
                    placeholder="Email (optionnel)"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-xs text-slate-600">Téléphone</div>
                  <input
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    value={editIntervenantTel}
                    onChange={(e) => setEditIntervenantTel(e.target.value)}
                    placeholder="Téléphone (optionnel)"
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={cancelEditIntervenant}
                  disabled={savingIntervenant}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  className={[
                    "rounded-xl px-4 py-2 text-sm",
                    savingIntervenant ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
                  ].join(" ")}
                  onClick={saveEditIntervenant}
                  disabled={savingIntervenant}
                >
                  {savingIntervenant ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}



























