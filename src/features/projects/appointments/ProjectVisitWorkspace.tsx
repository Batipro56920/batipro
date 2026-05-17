import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileText,
  Library,
  Plus,
  Save,
  Search,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Button } from "../../../components/ui/button";
import { createCrmAppointment, type CrmAppointmentRow } from "../../../services/crm.service";
import { list as listTaskTemplates, type TaskTemplateRow } from "../../../services/taskLibrary.service";
import type { ProjectRecord } from "../types";

type VisitStatus = "brouillon" | "planifiee" | "realisee" | "pre_devis";
type Unit = "m2" | "m3" | "ml" | "u" | "h";
type NodeType = "section" | "line" | "note";
type AttachmentTarget = "project" | "section" | "line" | "note";

type EstimateNode = {
  id: string;
  type: NodeType;
  parentId: string | null;
  title: string;
  unit?: Unit;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  quantity: number;
  manualQuantity: boolean;
  unitPriceHt?: number | null;
  family?: string | null;
  libraryTemplateId?: string | null;
  internalNote?: string;
  clientNote?: string;
  constraint?: string;
  variant?: string;
  uncertainty?: string;
};

type VisitAttachment = {
  id: string;
  name: string;
  kind: "photo" | "document";
  targetType: AttachmentTarget;
  targetId: string | null;
  comment: string;
  previewUrl?: string;
};

type VisitDraft = {
  status: VisitStatus;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  salesperson: string;
  date: string;
  time: string;
  contactOnSite: string;
  quickNotes: string;
  nodes: EstimateNode[];
  attachments: VisitAttachment[];
};

const inputClass =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const textareaClass =
  "min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(String(value).replace(",", "."));
  return Number.isFinite(next) ? next : null;
}

function normalizeUnit(value: string | null | undefined): Unit {
  const unit = String(value ?? "").toLowerCase().replace("²", "2").replace("³", "3").trim();
  if (unit.includes("m3")) return "m3";
  if (unit.includes("m2")) return "m2";
  if (unit === "ml" || unit.includes("metre lineaire")) return "ml";
  if (unit === "h" || unit.includes("heure")) return "h";
  return "u";
}

function formatUnit(unit: Unit) {
  if (unit === "m2") return "m²";
  if (unit === "m3") return "m³";
  if (unit === "ml") return "ml";
  if (unit === "h") return "h";
  return "u";
}

function computeQuantity(node: EstimateNode): number {
  if (node.manualQuantity) return Number(node.quantity || 0);
  const length = Number(node.length || 0);
  const width = Number(node.width || 0);
  const height = Number(node.height || 0);
  if (node.unit === "m2") return Math.round(length * width * 100) / 100;
  if (node.unit === "m3") return Math.round(length * width * height * 100) / 100;
  if (node.unit === "ml") return Math.round(length * 100) / 100;
  return Number(node.quantity || 0);
}

function initialDraft(project: ProjectRecord, appointment?: CrmAppointmentRow | null): VisitDraft {
  const start = appointment ? new Date(appointment.starts_at) : null;
  return {
    status: appointment ? "planifiee" : "brouillon",
    contactName: project.clientName,
    phone: project.contactPhone ?? "",
    email: project.contactEmail ?? "",
    address: project.address ?? "",
    salesperson: project.salesperson ?? "",
    date: start ? start.toISOString().slice(0, 10) : today(),
    time: start ? start.toTimeString().slice(0, 5) : "09:00",
    contactOnSite: project.clientName,
    quickNotes: appointment?.notes ?? project.needDescription ?? "",
    nodes: [
      {
        id: uid("section"),
        type: "section",
        parentId: null,
        title: "Zone a chiffrer",
        quantity: 0,
        manualQuantity: false,
      },
    ],
    attachments: [],
  };
}

function serializeDraft(draft: VisitDraft) {
  return {
    ...draft,
    attachments: draft.attachments.map(({ previewUrl: _previewUrl, ...attachment }) => attachment),
  };
}

function buildPreQuoteReport(project: ProjectRecord, draft: VisitDraft) {
  const sections = draft.nodes.filter((node) => node.type === "section");
  const lines = draft.nodes.filter((node) => node.type === "line");
  const notes = draft.nodes.filter((node) => node.type === "note");
  const libraryLines = lines.filter((line) => line.libraryTemplateId);
  const toPrice = lines.filter((line) => !line.unitPriceHt || Number(line.unitPriceHt) <= 0);

  const lineText = sections
    .map((section) => {
      const sectionLines = lines.filter((line) => line.parentId === section.id);
      const sectionNotes = notes.filter((note) => note.parentId === section.id);
      return [
        `# ${section.title}`,
        ...sectionLines.map((line) => {
          const qty = computeQuantity(line);
          const source = line.libraryTemplateId ? "bibliotheque" : "manuel";
          return `- ${line.title} | ${qty} ${formatUnit(line.unit ?? "u")} | ${source}${line.internalNote ? ` | note: ${line.internalNote}` : ""}`;
        }),
        ...sectionNotes.map((note) => `- Note: ${note.title}`),
      ].join("\n");
    })
    .join("\n\n");

  return [
    `Projet: ${project.name}`,
    `Client: ${draft.contactName}`,
    `Adresse: ${draft.address}`,
    `Visite: ${draft.date} ${draft.time}`,
    "",
    "Pre-devis terrain",
    lineText || "Aucune ligne.",
    "",
    "Resume",
    `Sections: ${sections.length}`,
    `Taches/prestations: ${lines.length}`,
    `Lignes issues bibliotheque: ${libraryLines.length}`,
    `Lignes a chiffrer: ${toPrice.length}`,
    `Photos: ${draft.attachments.filter((item) => item.kind === "photo").length}`,
    `Documents: ${draft.attachments.filter((item) => item.kind === "document").length}`,
    `Notes: ${notes.length}`,
    "",
    "Notes rapides",
    draft.quickNotes || "Aucune note.",
  ].join("\n");
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function PhotoInput({ onFiles }: { onFiles: (files: FileList | null, kind: "photo" | "document") => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-800">
        <Camera className="h-4 w-4" />
        Prendre photo
        <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => onFiles(event.target.files, "photo")} />
      </label>
      <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900">
        <FileText className="h-4 w-4" />
        Importer fichiers
        <input className="hidden" type="file" multiple accept="image/*,.pdf" onChange={(event) => onFiles(event.target.files, "document")} />
      </label>
    </div>
  );
}

export function ProjectVisitWorkspace({ project, existingAppointment }: { project: ProjectRecord; existingAppointment?: CrmAppointmentRow | null }) {
  const navigate = useNavigate();
  const storageKey = `batipro.project-estimate-visit.${existingAppointment?.id ?? project.id}`;
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
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"draft" | "saved" | "error">("draft");
  const [selectedId, setSelectedId] = useState<string | null>(draft.nodes[0]?.id ?? null);
  const [library, setLibrary] = useState<TaskTemplateRow[]>([]);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryFamily, setLibraryFamily] = useState("__ALL__");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(storageKey, JSON.stringify(serializeDraft(draft)));
      setSaveState("draft");
    }, 600);
    return () => window.clearTimeout(timer);
  }, [draft, storageKey]);

  useEffect(() => {
    let alive = true;
    listTaskTemplates()
      .then((rows) => {
        if (alive) setLibrary(rows);
      })
      .catch(() => {
        if (alive) setLibrary([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const sections = useMemo(() => draft.nodes.filter((node) => node.type === "section"), [draft.nodes]);
  const lines = useMemo(() => draft.nodes.filter((node) => node.type === "line"), [draft.nodes]);
  const selectedNode = useMemo(() => draft.nodes.find((node) => node.id === selectedId) ?? null, [draft.nodes, selectedId]);
  const activeSectionId = selectedNode?.type === "section" ? selectedNode.id : selectedNode?.parentId ?? sections[0]?.id ?? null;
  const families = useMemo(() => Array.from(new Set(library.map((item) => item.lot).filter(Boolean) as string[])).sort(), [library]);
  const filteredLibrary = useMemo(() => {
    const query = libraryQuery.trim().toLowerCase();
    return library
      .filter((item) => libraryFamily === "__ALL__" || item.lot === libraryFamily)
      .filter((item) => !query || `${item.titre} ${item.lot ?? ""} ${item.remarques ?? ""}`.toLowerCase().includes(query))
      .slice(0, 20);
  }, [library, libraryFamily, libraryQuery]);
  const report = useMemo(() => buildPreQuoteReport(project, draft), [draft, project]);
  const totals = useMemo(() => {
    const billable = lines.length;
    const libraryCount = lines.filter((line) => line.libraryTemplateId).length;
    const toPrice = lines.filter((line) => !line.unitPriceHt || Number(line.unitPriceHt) <= 0).length;
    const estimatedHt = lines.reduce((sum, line) => sum + computeQuantity(line) * Number(line.unitPriceHt || 0), 0);
    return { billable, libraryCount, toPrice, estimatedHt };
  }, [lines]);

  function patchDraft<K extends keyof VisitDraft>(key: K, value: VisitDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function patchNode(id: string, patch: Partial<EstimateNode>) {
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.map((node) => {
        if (node.id !== id) return node;
        const next = { ...node, ...patch };
        if (!next.manualQuantity) next.quantity = computeQuantity(next);
        return next;
      }),
    }));
  }

  function addSection() {
    const node: EstimateNode = { id: uid("section"), type: "section", parentId: null, title: "Nouvelle section", quantity: 0, manualQuantity: false };
    setDraft((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedId(node.id);
  }

  function addLine(source?: Partial<EstimateNode>) {
    const sectionId = activeSectionId ?? sections[0]?.id ?? null;
    const node: EstimateNode = {
      id: uid("line"),
      type: "line",
      parentId: sectionId,
      title: source?.title ?? "Nouvelle prestation",
      unit: source?.unit ?? "m2",
      length: null,
      width: null,
      height: null,
      quantity: source?.quantity ?? 0,
      manualQuantity: Boolean(source?.manualQuantity),
      unitPriceHt: source?.unitPriceHt ?? null,
      family: source?.family ?? null,
      libraryTemplateId: source?.libraryTemplateId ?? null,
      internalNote: source?.internalNote ?? "",
      clientNote: source?.clientNote ?? "",
      constraint: source?.constraint ?? "",
      variant: source?.variant ?? "",
      uncertainty: source?.uncertainty ?? "",
    };
    setDraft((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedId(node.id);
  }

  function addNote() {
    const node: EstimateNode = {
      id: uid("note"),
      type: "note",
      parentId: activeSectionId ?? sections[0]?.id ?? null,
      title: "Note technique",
      quantity: 0,
      manualQuantity: false,
      internalNote: "",
    };
    setDraft((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setSelectedId(node.id);
  }

  function removeNode(id: string) {
    setDraft((current) => ({
      ...current,
      nodes: current.nodes.filter((node) => node.id !== id && node.parentId !== id),
      attachments: current.attachments.filter((attachment) => attachment.targetId !== id),
    }));
    setSelectedId(null);
  }

  function addFromLibrary(template: TaskTemplateRow) {
    addLine({
      title: template.titre,
      unit: normalizeUnit(template.unite),
      quantity: template.quantite_defaut ?? 0,
      manualQuantity: Boolean(template.quantite_defaut),
      unitPriceHt: template.cout_reference_unitaire_ht,
      family: template.lot,
      libraryTemplateId: template.id,
      internalNote: template.description_technique ?? template.remarques ?? "",
    });
  }

  function addFiles(files: FileList | null, kind: "photo" | "document") {
    if (!files?.length) return;
    const target = selectedNode;
    const attachments = Array.from(files).map((file) => ({
      id: uid(kind),
      name: file.name,
      kind,
      targetType: target?.type === "section" ? "section" as const : target?.type === "line" ? "line" as const : target?.type === "note" ? "note" as const : "project" as const,
      targetId: target?.id ?? null,
      comment: "",
      previewUrl: kind === "photo" ? URL.createObjectURL(file) : undefined,
    }));
    setDraft((current) => ({ ...current, attachments: [...current.attachments, ...attachments] }));
  }

  async function saveVisit(status: VisitStatus) {
    setSaving(true);
    try {
      const startsAt = new Date(`${draft.date}T${draft.time || "09:00"}:00`);
      const endsAt = new Date(startsAt.getTime() + 90 * 60_000);
      await createCrmAppointment({
        prospect_id: project.prospect?.id ?? null,
        client_id: project.client?.id ?? null,
        opportunity_id: project.opportunity?.id ?? null,
        type: status === "pre_devis" ? "visite_chiffrage_pre_devis" : "visite_chiffrage_projet",
        titre: `Visite de chiffrage - ${project.name}`,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        statut: status === "realisee" || status === "pre_devis" ? "realise" : "planifie",
        notes: JSON.stringify(serializeDraft({ ...draft, status }), null, 2),
        compte_rendu: report,
      });
      localStorage.removeItem(storageKey);
      setSaveState("saved");
      navigate(status === "pre_devis" ? "/crm/devis" : `/projets/${project.id}?tab=visits`);
    } catch {
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  function renderDimensionFields(node: EstimateNode) {
    if (node.type !== "line") return null;
    const unit = node.unit ?? "u";
    return (
      <div className="grid gap-2 sm:grid-cols-3">
        {["m2", "m3", "ml"].includes(unit) ? (
          <Field label="Longueur">
            <input className={inputClass} inputMode="decimal" value={node.length ?? ""} onChange={(event) => patchNode(node.id, { length: toNumber(event.target.value), manualQuantity: false })} />
          </Field>
        ) : null}
        {["m2", "m3"].includes(unit) ? (
          <Field label="Largeur">
            <input className={inputClass} inputMode="decimal" value={node.width ?? ""} onChange={(event) => patchNode(node.id, { width: toNumber(event.target.value), manualQuantity: false })} />
          </Field>
        ) : null}
        {unit === "m3" ? (
          <Field label="Hauteur / profondeur">
            <input className={inputClass} inputMode="decimal" value={node.height ?? ""} onChange={(event) => patchNode(node.id, { height: toNumber(event.target.value), manualQuantity: false })} />
          </Field>
        ) : null}
        <Field label={unit === "h" ? "Heures" : unit === "u" ? "Quantite" : "Quantite calculee"}>
          <input
            className={inputClass}
            inputMode="decimal"
            value={node.quantity || ""}
            onChange={(event) => patchNode(node.id, { quantity: Number(event.target.value.replace(",", ".")) || 0, manualQuantity: true })}
          />
        </Field>
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
              Projet
            </Link>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Visite de chiffrage</div>
            <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-950 md:text-3xl">{project.name}</h1>
            <p className="mt-1 truncate text-sm text-slate-500">{draft.contactName} - {draft.address || "Adresse a renseigner"}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {saveState === "saved" ? "enregistre" : saveState === "error" ? "erreur" : draft.status}
            </span>
            <Button size="sm" variant="secondary" onClick={() => localStorage.setItem(storageKey, JSON.stringify(serializeDraft(draft)))} disabled={saving}>
              <Save className="h-4 w-4" />
              Enregistrer
            </Button>
          </div>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
        <aside className="hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:block xl:sticky xl:top-4 xl:self-start">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
            <Library className="h-4 w-4" />
            Bibliotheque
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className={`${inputClass} pl-9`} placeholder="Rechercher une tache" value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} />
            </div>
            <select className={inputClass} value={libraryFamily} onChange={(event) => setLibraryFamily(event.target.value)}>
              <option value="__ALL__">Toutes familles</option>
              {families.map((family) => <option key={family} value={family}>{family}</option>)}
            </select>
          </div>
          <div className="mt-4 space-y-2">
            {filteredLibrary.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Aucun element.</div>
            ) : filteredLibrary.map((item) => (
              <button key={item.id} type="button" onClick={() => addFromLibrary(item)} className="w-full rounded-2xl border border-slate-200 p-3 text-left text-sm transition hover:border-blue-200 hover:bg-blue-50">
                <div className="font-semibold text-slate-950">{item.titre}</div>
                <div className="mt-1 text-xs text-slate-500">{item.lot ?? "Sans famille"} - {item.unite ?? "u"} {item.cout_reference_unitaire_ht ? `- ${item.cout_reference_unitaire_ht} EUR HT` : ""}</div>
              </button>
            ))}
          </div>
        </aside>

        <main className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Client"><input className={inputClass} value={draft.contactName} onChange={(event) => patchDraft("contactName", event.target.value)} /></Field>
              <Field label="Contact sur place"><input className={inputClass} value={draft.contactOnSite} onChange={(event) => patchDraft("contactOnSite", event.target.value)} /></Field>
              <Field label="Date"><input type="date" className={inputClass} value={draft.date} onChange={(event) => patchDraft("date", event.target.value)} /></Field>
              <Field label="Heure"><input type="time" className={inputClass} value={draft.time} onChange={(event) => patchDraft("time", event.target.value)} /></Field>
              <Field label="Telephone"><input className={inputClass} value={draft.phone} onChange={(event) => patchDraft("phone", event.target.value)} /></Field>
              <Field label="Email"><input className={inputClass} value={draft.email} onChange={(event) => patchDraft("email", event.target.value)} /></Field>
              <Field label="Commercial"><input className={inputClass} value={draft.salesperson} onChange={(event) => patchDraft("salesperson", event.target.value)} /></Field>
              <Field label="Adresse"><input className={inputClass} value={draft.address} onChange={(event) => patchDraft("address", event.target.value)} /></Field>
            </div>
            <div className="mt-3">
              <Field label="Note rapide terrain">
                <textarea className={textareaClass} placeholder="Dictee vocale possible via le clavier du telephone." value={draft.quickNotes} onChange={(event) => patchDraft("quickNotes", event.target.value)} />
              </Field>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Pre-devis terrain</div>
                <h2 className="mt-1 text-lg font-semibold text-slate-950">Sections et prestations relevees</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={addSection}><Plus className="h-4 w-4" />Section</Button>
                <Button type="button" variant="secondary" onClick={() => addLine()}><Plus className="h-4 w-4" />Tache</Button>
                <Button type="button" variant="secondary" onClick={addNote}><StickyNote className="h-4 w-4" />Note</Button>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              {sections.map((section) => {
                const sectionLines = draft.nodes.filter((node) => node.parentId === section.id);
                return (
                  <article key={section.id} className="overflow-hidden rounded-2xl border border-slate-200">
                    <button type="button" onClick={() => setSelectedId(section.id)} className={["flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left", selectedId === section.id ? "ring-2 ring-blue-200" : ""].join(" ")}>
                      <span className="font-semibold text-slate-950">{section.title}</span>
                      <span className="text-xs text-slate-500">{sectionLines.length} element(s)</span>
                    </button>
                    <div className="divide-y divide-slate-100">
                      {sectionLines.length === 0 ? (
                        <div className="p-4 text-sm text-slate-500">Ajoutez une tache, une note ou une photo.</div>
                      ) : sectionLines.map((node) => (
                        <button key={node.id} type="button" onClick={() => setSelectedId(node.id)} className={["block w-full p-4 text-left transition hover:bg-slate-50", selectedId === node.id ? "bg-blue-50" : "bg-white"].join(" ")}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-950">{node.title}</div>
                              {node.type === "line" ? (
                                <div className="mt-1 text-sm text-slate-500">
                                  {computeQuantity(node)} {formatUnit(node.unit ?? "u")} {node.family ? `- ${node.family}` : ""}
                                </div>
                              ) : (
                                <div className="mt-1 text-sm text-slate-500">Note technique</div>
                              )}
                              {node.internalNote ? <div className="mt-2 line-clamp-2 text-xs text-slate-500">{node.internalNote}</div> : null}
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{node.type === "line" ? "prestation" : "note"}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:hidden">
            <div className="mb-3 text-sm font-semibold text-slate-950">Bibliotheque</div>
            <input className={inputClass} placeholder="Rechercher une tache" value={libraryQuery} onChange={(event) => setLibraryQuery(event.target.value)} />
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {filteredLibrary.slice(0, 8).map((item) => (
                <button key={item.id} type="button" onClick={() => addFromLibrary(item)} className="min-w-56 rounded-2xl border border-slate-200 bg-white p-3 text-left text-sm">
                  <div className="font-semibold text-slate-950">{item.titre}</div>
                  <div className="text-xs text-slate-500">{item.lot ?? "Sans famille"}</div>
                </button>
              ))}
            </div>
          </section>
        </main>

        <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-4 xl:self-start">
          <div className="text-sm font-semibold text-slate-950">Detail / resume</div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Sections</div><div className="text-lg font-semibold">{sections.length}</div></div>
            <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Taches</div><div className="text-lg font-semibold">{totals.billable}</div></div>
            <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">Bibliotheque</div><div className="text-lg font-semibold">{totals.libraryCount}</div></div>
            <div className="rounded-2xl bg-slate-50 p-3"><div className="text-xs text-slate-500">A chiffrer</div><div className="text-lg font-semibold">{totals.toPrice}</div></div>
          </div>

          {selectedNode ? (
            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Element selectionne</div>
                <button type="button" onClick={() => removeNode(selectedNode.id)} className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Supprimer">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Field label="Designation"><input className={inputClass} value={selectedNode.title} onChange={(event) => patchNode(selectedNode.id, { title: event.target.value })} /></Field>
              {selectedNode.type === "line" ? (
                <>
                  <Field label="Unite">
                    <select className={inputClass} value={selectedNode.unit ?? "u"} onChange={(event) => patchNode(selectedNode.id, { unit: event.target.value as Unit, manualQuantity: false })}>
                      <option value="m2">m²</option>
                      <option value="m3">m³</option>
                      <option value="ml">ml</option>
                      <option value="u">u</option>
                      <option value="h">h</option>
                    </select>
                  </Field>
                  {renderDimensionFields(selectedNode)}
                  <Field label="Prix estimatif HT"><input className={inputClass} inputMode="decimal" value={selectedNode.unitPriceHt ?? ""} onChange={(event) => patchNode(selectedNode.id, { unitPriceHt: toNumber(event.target.value) })} /></Field>
                  <Field label="Note interne"><textarea className={textareaClass} value={selectedNode.internalNote ?? ""} onChange={(event) => patchNode(selectedNode.id, { internalNote: event.target.value })} /></Field>
                  <Field label="Note client"><textarea className={textareaClass} value={selectedNode.clientNote ?? ""} onChange={(event) => patchNode(selectedNode.id, { clientNote: event.target.value })} /></Field>
                  <Field label="Contrainte / incertitude"><textarea className={textareaClass} value={selectedNode.constraint ?? ""} onChange={(event) => patchNode(selectedNode.id, { constraint: event.target.value })} /></Field>
                </>
              ) : selectedNode.type === "note" ? (
                <Field label="Contenu note"><textarea className={textareaClass} value={selectedNode.internalNote ?? selectedNode.title} onChange={(event) => patchNode(selectedNode.id, { internalNote: event.target.value })} /></Field>
              ) : null}
              <PhotoInput onFiles={addFiles} />
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Selectionnez une section ou une ligne.</div>
          )}

          <div className="mt-5 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Photos / documents</div>
            {draft.attachments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Aucun fichier rattache.</div>
            ) : draft.attachments.map((attachment) => (
              <div key={attachment.id} className="rounded-2xl border border-slate-200 p-3">
                {attachment.previewUrl ? <img src={attachment.previewUrl} alt="" loading="lazy" className="mb-2 h-24 w-full rounded-xl object-cover" /> : null}
                <div className="text-sm font-semibold text-slate-950">{attachment.name}</div>
                <div className="text-xs text-slate-500">{attachment.kind} - {attachment.targetType}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-2">
            <Button type="button" variant="primary" className="w-full" disabled={saving} onClick={() => saveVisit("pre_devis")}>
              <FileText className="h-4 w-4" />
              Creer pre-devis
            </Button>
            <Button type="button" variant="success" className="w-full" disabled={saving} onClick={() => saveVisit("realisee")}>
              <CheckCircle2 className="h-4 w-4" />
              Terminer visite
            </Button>
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur md:hidden">
        <div className="grid grid-cols-4 gap-2">
          <button type="button" onClick={addSection} className="rounded-xl bg-slate-950 px-2 py-3 text-xs font-semibold text-white">+ Section</button>
          <button type="button" onClick={() => addLine()} className="rounded-xl bg-blue-600 px-2 py-3 text-xs font-semibold text-white">+ Tache</button>
          <label className="rounded-xl border border-slate-200 px-2 py-3 text-center text-xs font-semibold text-slate-900">
            + Photo
            <input className="hidden" type="file" accept="image/*" capture="environment" onChange={(event: ChangeEvent<HTMLInputElement>) => addFiles(event.target.files, "photo")} />
          </label>
          <button type="button" onClick={addNote} className="rounded-xl border border-slate-200 px-2 py-3 text-xs font-semibold text-slate-900">+ Note</button>
        </div>
      </div>
    </div>
  );
}
