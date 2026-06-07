import { supabase } from "../lib/supabaseClient";

const crmDb = supabase as any;

export type CrmVisitQuoteSource = {
  needDescription?: string;
  lines?: Array<{
    id?: string;
    type?: string;
    parentId?: string | null;
    title?: string;
    unit?: string;
    quantity?: number;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    priceHintHt?: number | null;
    family?: string | null;
    libraryId?: string | null;
    technicalNotes?: string;
    constraints?: string;
    variants?: string;
    attentionPoints?: string;
  }>;
};

export type CrmVisitReportLineInput = NonNullable<CrmVisitQuoteSource["lines"]>[number] & {
  manualQuantity?: boolean;
  estimatedHours?: number | null;
};

export type CrmVisitReportAttachmentInput = {
  id?: string;
  kind: "photo" | "document";
  name: string;
  targetLineId?: string | null;
  comment?: string | null;
  file?: File | null;
  storagePath?: string | null;
  url?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

export type CrmVisitReportDraft = {
  status?: string;
  client?: string;
  phone?: string;
  email?: string;
  address?: string;
  contactOnSite?: string;
  date?: string;
  time?: string;
  durationMinutes?: number;
  salesperson?: string;
  projectType?: string;
  clientObjective?: string;
  needDescription?: string;
  urgency?: string;
  desiredDeadline?: string;
  zones?: string;
  access?: string;
  parking?: string;
  floor?: string;
  condominium?: string;
  schedule?: string;
  nuisance?: string;
  safety?: string;
  waste?: string;
  water?: string;
  electricity?: string;
  authorizations?: string;
  constraintNotes?: string;
  budgetKnown?: string;
  budgetRange?: string;
  priceSensitivity?: string;
  decisionMaker?: string;
  decisionOnSite?: string;
  objections?: string;
  nextAction?: string;
  followUpDate?: string;
  lines?: CrmVisitReportLineInput[];
  attachments?: Array<CrmVisitReportAttachmentInput & { previewUrl?: string | null }>;
};

export type CrmVisitReportInput = CrmVisitReportDraft & {
  appointment_id: string;
  prospect_id?: string | null;
  client_id?: string | null;
  opportunity_id?: string | null;
  status: string;
  client_name?: string | null;
  contact_on_site?: string | null;
  visit_date?: string | null;
  visit_time?: string | null;
  duration_minutes?: number | null;
  salesperson?: string | null;
  project_type?: string | null;
  client_objective?: string | null;
  need_description?: string | null;
  desired_deadline?: string | null;
  constraints?: Record<string, unknown>;
  budget?: Record<string, unknown>;
  next_action?: string | null;
  follow_up_date?: string | null;
  report_text?: string | null;
  quote_source?: CrmVisitQuoteSource | null;
};

const VISIT_REPORT_SELECT =
  "id,appointment_id,prospect_id,client_id,opportunity_id,status,client_name,phone,email,address,contact_on_site,visit_date,visit_time,duration_minutes,salesperson,project_type,client_objective,need_description,urgency,desired_deadline,zones,constraints,budget,next_action,follow_up_date,report_text,quote_source,created_at,updated_at";
const VISIT_REPORT_ITEM_SELECT =
  "id,visit_report_id,parent_id,source_line_id,line_type,title,unit,quantity,manual_quantity,length,width,height,estimated_hours,price_hint_ht,family,library_id,technical_notes,constraints,variants,attention_points,ordre,created_at,updated_at";
const VISIT_REPORT_ATTACHMENT_SELECT =
  "id,visit_report_id,item_id,source_attachment_id,kind,name,storage_bucket,storage_path,url,mime_type,size_bytes,comment,ordre,created_at,updated_at";

function text(value: unknown): string | null {
  const clean = String(value ?? "").trim();
  return clean || null;
}

function numberOrZero(value: unknown): number {
  const n = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function jsonObjectOrDefault(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isMissingCrmSchema(error: unknown): boolean {
  const msg = String((error as any)?.message ?? "").toLowerCase();
  const code = String((error as any)?.code ?? "");
  return code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
}

async function currentOrgId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw new Error(error.message);
  const id = data.user?.id;
  if (!id) throw new Error("Utilisateur non authentifie.");
  return id;
}

function storageSafeName(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "piece-jointe";
}

async function uploadVisitAttachment(file: File, visitReportId: string) {
  const bucket = "crm-visit-attachments";
  const path = `${visitReportId}/${crypto.randomUUID()}-${storageSafeName(file.name)}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type || undefined });
  if (error) throw error;
  return { bucket, path };
}

export async function saveCrmVisitReport(input: CrmVisitReportInput) {
  const organization_id = await currentOrgId();
  const reportRow = {
    organization_id,
    appointment_id: input.appointment_id,
    prospect_id: input.prospect_id ?? null,
    client_id: input.client_id ?? null,
    opportunity_id: input.opportunity_id ?? null,
    status: text(input.status) ?? "brouillon",
    client_name: text(input.client_name ?? input.client),
    phone: text(input.phone),
    email: text(input.email)?.toLowerCase() ?? null,
    address: text(input.address),
    contact_on_site: text(input.contact_on_site ?? input.contactOnSite),
    visit_date: input.visit_date ?? input.date ?? null,
    visit_time: input.visit_time ?? input.time ?? null,
    duration_minutes: input.duration_minutes ?? input.durationMinutes ?? null,
    salesperson: text(input.salesperson),
    project_type: text(input.project_type ?? input.projectType),
    client_objective: text(input.client_objective ?? input.clientObjective),
    need_description: text(input.need_description ?? input.needDescription),
    urgency: text(input.urgency),
    desired_deadline: input.desired_deadline ?? input.desiredDeadline ?? null,
    zones: text(input.zones),
    constraints: jsonObjectOrDefault(input.constraints),
    budget: jsonObjectOrDefault(input.budget),
    next_action: text(input.next_action ?? input.nextAction),
    follow_up_date: input.follow_up_date ?? input.followUpDate ?? null,
    report_text: text(input.report_text),
    quote_source: jsonObjectOrDefault(input.quote_source),
  };

  const reportResult = await crmDb.from("crm_visit_reports").upsert([reportRow], { onConflict: "appointment_id" }).select(VISIT_REPORT_SELECT).single();
  if (reportResult.error) {
    if (isMissingCrmSchema(reportResult.error)) return null;
    throw reportResult.error;
  }

  const report = reportResult.data as { id: string };
  const deleteAttachments = await crmDb.from("crm_visit_report_attachments").delete().eq("visit_report_id", report.id);
  if (deleteAttachments.error) throw deleteAttachments.error;
  const deleteItems = await crmDb.from("crm_visit_report_items").delete().eq("visit_report_id", report.id);
  if (deleteItems.error) throw deleteItems.error;

  const itemIdBySource = new Map<string, string>();
  for (const [index, line] of (input.lines ?? []).entries()) {
    const parent_id = line.parentId ? itemIdBySource.get(line.parentId) ?? null : null;
    const insert = {
      organization_id,
      visit_report_id: report.id,
      parent_id,
      source_line_id: text(line.id),
      line_type: text(line.type) ?? "task",
      title: text(line.title) ?? "Prestation",
      unit: text(line.unit) ?? "u",
      quantity: numberOrZero(line.quantity),
      manual_quantity: Boolean(line.manualQuantity),
      length: line.length ?? null,
      width: line.width ?? null,
      height: line.height ?? null,
      estimated_hours: line.estimatedHours ?? null,
      price_hint_ht: line.priceHintHt ?? null,
      family: text(line.family),
      library_id: text(line.libraryId),
      technical_notes: text(line.technicalNotes),
      constraints: text(line.constraints),
      variants: text(line.variants),
      attention_points: text(line.attentionPoints),
      ordre: index + 1,
    };
    const { data, error } = await crmDb.from("crm_visit_report_items").insert([insert]).select(VISIT_REPORT_ITEM_SELECT).single();
    if (error) throw error;
    if (line.id) itemIdBySource.set(line.id, String(data.id));
  }

  for (const [index, attachment] of (input.attachments ?? []).entries()) {
    const uploaded = attachment.file ? await uploadVisitAttachment(attachment.file, report.id) : null;
    const item_id = attachment.targetLineId ? itemIdBySource.get(attachment.targetLineId) ?? null : null;
    const row = {
      organization_id,
      visit_report_id: report.id,
      item_id,
      source_attachment_id: text(attachment.id),
      kind: text(attachment.kind) ?? "document",
      name: text(attachment.name) ?? "Piece jointe",
      storage_bucket: uploaded?.bucket ?? (attachment.storagePath ? "crm-visit-attachments" : null),
      storage_path: uploaded?.path ?? attachment.storagePath ?? null,
      url: text(attachment.url),
      mime_type: text(attachment.mimeType ?? attachment.file?.type),
      size_bytes: attachment.sizeBytes ?? attachment.file?.size ?? null,
      comment: text(attachment.comment),
      ordre: index + 1,
    };
    const { error } = await crmDb.from("crm_visit_report_attachments").insert([row]).select(VISIT_REPORT_ATTACHMENT_SELECT).single();
    if (error) throw error;
  }

  return reportResult.data;
}

async function signedVisitAttachmentUrl(bucket: string | null, path: string | null, fallbackUrl: string | null) {
  if (fallbackUrl) return fallbackUrl;
  if (!bucket || !path) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

function readObjectValue(source: unknown, key: string) {
  return typeof source === "object" && source !== null ? String((source as Record<string, unknown>)[key] ?? "") : "";
}

export async function loadCrmVisitReportDraft(appointmentId: string): Promise<CrmVisitReportDraft | null> {
  const { data: report, error } = await crmDb.from("crm_visit_reports").select(VISIT_REPORT_SELECT).eq("appointment_id", appointmentId).maybeSingle();
  if (error) {
    if (isMissingCrmSchema(error)) return null;
    throw error;
  }
  if (!report) return null;

  const [itemsResult, attachmentsResult] = await Promise.all([
    crmDb.from("crm_visit_report_items").select(VISIT_REPORT_ITEM_SELECT).eq("visit_report_id", report.id).order("ordre", { ascending: true }),
    crmDb.from("crm_visit_report_attachments").select(VISIT_REPORT_ATTACHMENT_SELECT).eq("visit_report_id", report.id).order("ordre", { ascending: true }),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (attachmentsResult.error) throw attachmentsResult.error;

  const sourceIdByItemId = new Map<string, string>();
  for (const row of itemsResult.data ?? []) {
    if (row.source_line_id) sourceIdByItemId.set(String(row.id), String(row.source_line_id));
  }
  const constraints = report.constraints;
  const budget = report.budget;
  const lines = (itemsResult.data ?? []).map((row: any) => ({
    id: row.source_line_id ?? row.id,
    type: row.line_type,
    parentId: row.parent_id ? sourceIdByItemId.get(String(row.parent_id)) ?? null : null,
    title: row.title,
    unit: row.unit,
    quantity: Number(row.quantity ?? 0),
    manualQuantity: Boolean(row.manual_quantity),
    length: row.length,
    width: row.width,
    height: row.height,
    estimatedHours: row.estimated_hours,
    priceHintHt: row.price_hint_ht,
    family: row.family,
    libraryId: row.library_id,
    technicalNotes: row.technical_notes ?? "",
    constraints: row.constraints ?? "",
    variants: row.variants ?? "",
    attentionPoints: row.attention_points ?? "",
  }));
  const attachments = await Promise.all((attachmentsResult.data ?? []).map(async (row: any) => ({
    id: row.source_attachment_id ?? row.id,
    kind: row.kind,
    name: row.name,
    targetLineId: row.item_id ? sourceIdByItemId.get(String(row.item_id)) ?? null : null,
    comment: row.comment ?? "",
    storagePath: row.storage_path,
    url: row.url,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    previewUrl: await signedVisitAttachmentUrl(row.storage_bucket, row.storage_path, row.url),
  })));

  return {
    status: report.status,
    client: report.client_name ?? "",
    phone: report.phone ?? "",
    email: report.email ?? "",
    address: report.address ?? "",
    contactOnSite: report.contact_on_site ?? "",
    date: report.visit_date ?? "",
    time: report.visit_time ?? "",
    durationMinutes: Number(report.duration_minutes ?? 90),
    salesperson: report.salesperson ?? "",
    projectType: report.project_type ?? "",
    clientObjective: report.client_objective ?? "",
    needDescription: report.need_description ?? "",
    urgency: report.urgency ?? "",
    desiredDeadline: report.desired_deadline ?? "",
    zones: report.zones ?? "",
    access: readObjectValue(constraints, "access"),
    parking: readObjectValue(constraints, "parking"),
    floor: readObjectValue(constraints, "floor"),
    condominium: readObjectValue(constraints, "condominium"),
    schedule: readObjectValue(constraints, "schedule"),
    nuisance: readObjectValue(constraints, "nuisance"),
    safety: readObjectValue(constraints, "safety"),
    waste: readObjectValue(constraints, "waste"),
    water: readObjectValue(constraints, "water"),
    electricity: readObjectValue(constraints, "electricity"),
    authorizations: readObjectValue(constraints, "authorizations"),
    constraintNotes: readObjectValue(constraints, "notes"),
    budgetKnown: readObjectValue(budget, "known"),
    budgetRange: readObjectValue(budget, "range"),
    priceSensitivity: readObjectValue(budget, "priceSensitivity"),
    decisionMaker: readObjectValue(budget, "decisionMaker"),
    decisionOnSite: readObjectValue(budget, "decisionOnSite"),
    objections: readObjectValue(budget, "objections"),
    nextAction: report.next_action ?? "",
    followUpDate: report.follow_up_date ?? "",
    lines,
    attachments,
  };
}

export async function loadLatestCrmVisitQuoteSource(input: { opportunity_id?: string | null; prospect_id?: string | null; client_id?: string | null }): Promise<CrmVisitQuoteSource | null> {
  const filters = [
    input.opportunity_id ? `opportunity_id.eq.${input.opportunity_id}` : null,
    input.prospect_id ? `prospect_id.eq.${input.prospect_id}` : null,
    input.client_id ? `client_id.eq.${input.client_id}` : null,
  ].filter(Boolean);
  if (!filters.length) return null;
  const { data, error } = await crmDb.from("crm_visit_reports").select(VISIT_REPORT_SELECT).or(filters.join(",")).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) {
    if (isMissingCrmSchema(error)) return null;
    throw error;
  }
  const source = (data as { quote_source?: unknown } | null)?.quote_source;
  return typeof source === "object" && source !== null ? source as CrmVisitQuoteSource : null;
}
