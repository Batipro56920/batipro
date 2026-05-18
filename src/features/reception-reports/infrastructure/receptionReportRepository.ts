import { supabase } from "../../../lib/supabaseClient";
import type { ChantierRow } from "../../../services/chantiers.service";
import { createReceptionReport } from "../application/receptionReportFactory";
import type { ReceptionReportRecord } from "../domain/types";

const TABLE = "reception_reports";
const LEGACY_STORAGE_KEY = "batipro.reception-reports.v1";

type ReceptionReportRow = {
  id: string;
  chantier_id: string;
  status: ReceptionReportRecord["status"];
  decision: ReceptionReportRecord["decision"];
  reception_date: string;
  project_reference: string | null;
  observations: string;
  client_signer_name: string | null;
  company_signer_name: string | null;
  reserves: ReceptionReportRecord["reserves"];
  document: ReceptionReportRecord["document"];
  created_at: string;
  updated_at: string;
};

export async function listReceptionReports(): Promise<ReceptionReportRecord[]> {
  await migrateLegacyReportsIfNeeded();
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .order("created_at", { ascending: false })
    .overrideTypes<ReceptionReportRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

export async function listReceptionReportsByChantier(chantierId: string) {
  await migrateLegacyReportsIfNeeded();
  const { data, error } = await supabase
    .from(TABLE as any)
    .select("*")
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false })
    .overrideTypes<ReceptionReportRow[]>();

  if (error) throw new Error(error.message);
  return (data ?? []).map(fromRow);
}

export async function getOrCreateReceptionReport(chantier: ChantierRow) {
  const existing = (await listReceptionReportsByChantier(chantier.id))[0];
  if (existing) return existing;
  return saveReceptionReport(createReceptionReport(chantier));
}

export async function saveReceptionReport(report: ReceptionReportRecord) {
  const { data, error } = await supabase
    .from(TABLE as any)
    .upsert(toRow(report), { onConflict: "id" })
    .select("*")
    .single()
    .overrideTypes<ReceptionReportRow>();

  if (error) throw new Error(error.message);
  return fromRow(data);
}

function fromRow(row: ReceptionReportRow): ReceptionReportRecord {
  return {
    id: row.id,
    chantierId: row.chantier_id,
    status: row.status,
    decision: row.decision,
    receptionDate: row.reception_date,
    projectReference: row.project_reference,
    observations: row.observations ?? "",
    clientSignerName: row.client_signer_name,
    companySignerName: row.company_signer_name,
    reserves: row.reserves ?? [],
    document: row.document,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toRow(report: ReceptionReportRecord) {
  return {
    id: report.id,
    chantier_id: report.chantierId,
    status: report.status,
    decision: report.decision,
    reception_date: report.receptionDate,
    project_reference: report.projectReference,
    observations: report.observations,
    client_signer_name: report.clientSignerName,
    company_signer_name: report.companySignerName,
    reserves: report.reserves as any,
    document: report.document as any,
    created_at: report.createdAt,
    updated_at: new Date().toISOString(),
  };
}

async function migrateLegacyReportsIfNeeded() {
  const legacy = readLegacyReports();
  if (!legacy.length) return;

  const { error } = await supabase
    .from(TABLE as any)
    .upsert(legacy.map(toRow), { onConflict: "id" });
  if (error) throw new Error(error.message);
  removeLegacyReports();
}

function readLegacyReports(): ReceptionReportRecord[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ReceptionReportRecord[];
  } catch {
    return [];
  }
}

function removeLegacyReports() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
}
