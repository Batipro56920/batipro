import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Save, Send, Signature, Trash2 } from "lucide-react";
import { Button } from "../../../components/ui/button";
import type { ChantierRow } from "../../../services/chantiers.service";
import { createReserve } from "../../../services/reserves.service";
import type { ChantierReserveRow } from "../../../services/reserves.service";
import {
  calculateDocumentTotals,
  DocumentPreview,
  DocumentSendDialog,
  downloadBusinessDocumentPdf,
  type BusinessDocument,
} from "../../document-engine";
import { receptionDecisionLabel } from "../application/receptionReportFactory";
import type { ReceptionReportDecision, ReceptionReportRecord, ReceptionReportReserve, ReceptionReserveStatus } from "../domain/types";
import { getOrCreateReceptionReport, saveReceptionReport } from "../infrastructure/receptionReportRepository";

export function ReceptionReportPanel({ chantier, reserves, onReservesRefresh }: { chantier: ChantierRow; reserves: ChantierReserveRow[]; onReservesRefresh?: () => Promise<void> | void }) {
  const [report, setReport] = useState<ReceptionReportRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getOrCreateReceptionReport(chantier)
      .then((nextReport) => {
        if (!alive) return;
        setReport(nextReport);
      })
      .catch((err: any) => {
        if (!alive) return;
        setError(err?.message ?? "Chargement du PV de réception impossible.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [chantier]);

  const chantierReservesToImport = useMemo(
    () => reserves.filter((reserve) => !report?.reserves.some((row) => row.chantierReserveId === reserve.id)),
    [report, reserves],
  );

  function patch(patch: Partial<ReceptionReportRecord>) {
    if (!report) return;
    const nextReport = { ...report, ...patch, updatedAt: new Date().toISOString() };
    const nextDocument = syncDocument(nextReport, chantier);
    setReport({ ...nextReport, document: nextDocument });
  }

  async function save() {
    if (!report) return;
    setSaving(true);
    setError(null);
    try {
      const syncedReport = await syncReportReservesWithChantier(report, chantier);
      const saved = await saveReceptionReport({ ...syncedReport, document: syncDocument(syncedReport, chantier) });
      setReport(saved);
      await onReservesRefresh?.();
    } catch (err: any) {
      setError(err?.message ?? "Enregistrement du PV de réception impossible.");
    } finally {
      setSaving(false);
    }
  }

  function addReserve() {
    if (!report) return;
    patch({
      decision: "with_reserves",
      reserves: [
        ...report.reserves,
        { id: crypto.randomUUID(), description: "", lot: null, responsible: null, dueDate: null, status: "open", chantierReserveId: null },
      ],
    });
  }

  function importChantierReserve(reserve: ChantierReserveRow) {
    if (!report) return;
    patch({
      decision: "with_reserves",
      reserves: [
        ...report.reserves,
        {
          id: crypto.randomUUID(),
          description: reserve.description || reserve.title || "",
          lot: (reserve as any).zone_nom ?? null,
          responsible: (reserve as any).intervenant_nom ?? null,
          dueDate: null,
          status: reserve.status === "LEVEE" ? "lifted" : "open",
          chantierReserveId: reserve.id,
        },
      ],
    });
  }

  function updateReserve(id: string, patchReserve: Partial<ReceptionReportReserve>) {
    if (!report) return;
    patch({ reserves: report.reserves.map((reserve) => reserve.id === id ? { ...reserve, ...patchReserve } : reserve) });
  }

  function removeReserve(id: string) {
    if (!report) return;
    const nextReserves = report.reserves.filter((reserve) => reserve.id !== id);
    patch({ reserves: nextReserves, decision: nextReserves.length ? report.decision : "without_reserves" });
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">PV de reception</div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Reception chantier</h2>
          <p className="mt-1 text-sm text-slate-500">Generation, envoi et signature du PV de fin de chantier.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPreviewOpen((open) => !open)}>Preview</Button>
          <Button variant="secondary" disabled={!report || loading} onClick={() => report ? downloadBusinessDocumentPdf(syncDocument(report, chantier)) : undefined}><Download className="h-4 w-4" /> PDF</Button>
          <Button variant="secondary" disabled={!report || loading} onClick={() => setSendOpen(true)}><Send className="h-4 w-4" /> Envoyer</Button>
          <Button variant="primary" onClick={() => void save()} disabled={!report || loading || saving}><Save className="h-4 w-4" /> {saving ? "Enregistrement..." : "Enregistrer"}</Button>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {loading ? <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Chargement du PV de réception...</div> : null}

      {!report || loading ? null : (

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Entreprise" value={report.document.company.displayName} onChange={(displayName) => patch({ document: { ...report.document, company: { ...report.document.company, displayName } } })} />
            <Field label="Client" value={report.document.recipient.displayName} onChange={(displayName) => patch({ document: { ...report.document, recipient: { ...report.document.recipient, displayName } } })} />
            <Field label="Chantier" value={chantier.nom} readOnly />
            <Field label="Adresse chantier" value={report.document.siteAddress ?? ""} onChange={(siteAddress) => patch({ document: { ...report.document, siteAddress } })} />
            <Field label="Date reception" type="date" value={report.receptionDate} onChange={(receptionDate) => patch({ receptionDate })} />
            <Field label="Reference projet / chantier" value={report.projectReference ?? ""} onChange={(projectReference) => patch({ projectReference: projectReference || null })} />
            <label className={labelClass}>
              Decision
              <select className={inputClass} value={report.decision} onChange={(event) => patch({ decision: event.target.value as ReceptionReportDecision })}>
                <option value="without_reserves">Reception sans reserve</option>
                <option value="with_reserves">Reception avec reserves</option>
                <option value="refused">Refus de reception</option>
              </select>
            </label>
            <label className={labelClass}>
              Statut
              <select className={inputClass} value={report.status} onChange={(event) => patch({ status: event.target.value as ReceptionReportRecord["status"] })}>
                <option value="draft">Brouillon</option>
                <option value="sent">Envoye</option>
                <option value="signed">Signe</option>
                <option value="refused">Refuse</option>
              </select>
            </label>
          </div>

          <label className={labelClass}>
            Observations libres
            <textarea className={`${inputClass} min-h-24 py-2`} value={report.observations} onChange={(event) => patch({ observations: event.target.value })} />
          </label>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-950">Reserves du PV</div>
                <div className="text-sm text-slate-500">Les reserves importees restent referencees au suivi chantier.</div>
              </div>
              <Button variant="secondary" onClick={addReserve}><Plus className="h-4 w-4" /> Ajouter reserve</Button>
            </div>

            {chantierReservesToImport.length ? (
              <div className="mt-4 rounded-2xl border border-dashed border-blue-200 bg-blue-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Reserves chantier disponibles</div>
                <div className="flex flex-wrap gap-2">
                  {chantierReservesToImport.slice(0, 6).map((reserve) => (
                    <button key={reserve.id} type="button" onClick={() => importChantierReserve(reserve)} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-semibold text-blue-800 hover:bg-blue-50">
                      Importer {reserve.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {report.reserves.length ? report.reserves.map((reserve) => (
                <div key={reserve.id} className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1.5fr)_1fr_1fr_150px_120px_auto]">
                  <input className={inputClass} placeholder="Description" value={reserve.description} onChange={(event) => updateReserve(reserve.id, { description: event.target.value })} />
                  <input className={inputClass} placeholder="Lot concerne" value={reserve.lot ?? ""} onChange={(event) => updateReserve(reserve.id, { lot: event.target.value || null })} />
                  <input className={inputClass} placeholder="Responsable" value={reserve.responsible ?? ""} onChange={(event) => updateReserve(reserve.id, { responsible: event.target.value || null })} />
                  <input className={inputClass} type="date" value={reserve.dueDate ?? ""} onChange={(event) => updateReserve(reserve.id, { dueDate: event.target.value || null })} />
                  <select className={inputClass} value={reserve.status} onChange={(event) => updateReserve(reserve.id, { status: event.target.value as ReceptionReserveStatus })}>
                    <option value="open">Ouverte</option>
                    <option value="lifted">Levee</option>
                  </select>
                  <button type="button" onClick={() => removeReserve(reserve.id)} className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 text-red-700 hover:bg-red-50">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Aucune reserve dans le PV.
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Decision</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{receptionDecisionLabel(report.decision)}</div>
            <div className="mt-1 text-sm text-slate-500">{report.reserves.length} reserve(s) rattachee(s)</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center gap-2 font-semibold text-slate-950"><Signature className="h-4 w-4" /> Signatures</div>
            <Field label="Signataire client" value={report.clientSignerName ?? ""} onChange={(clientSignerName) => patch({ clientSignerName: clientSignerName || null })} />
            <div className="mt-3" />
            <Field label="Signataire entreprise" value={report.companySignerName ?? ""} onChange={(companySignerName) => patch({ companySignerName: companySignerName || null })} />
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
              Signature electronique a connecter au lien client.
            </div>
          </div>
        </aside>
      </div>
      )}

      {report && previewOpen ? <DocumentPreview document={syncDocument(report, chantier)} /> : null}
      {report && sendOpen ? <DocumentSendDialog document={syncDocument(report, chantier)} onClose={() => setSendOpen(false)} onDownload={() => downloadBusinessDocumentPdf(syncDocument(report, chantier))} /> : null}
    </section>
  );
}

function syncDocument(report: ReceptionReportRecord, chantier: ChantierRow): BusinessDocument {
  const reserveLines = report.reserves.length
    ? report.reserves.map((reserve, index) => `${index + 1}. ${reserve.description || "Reserve"} - Lot: ${reserve.lot || "-"} - Responsable: ${reserve.responsible || "-"} - Levee prevue: ${reserve.dueDate || "-"} - Statut: ${reserve.status === "lifted" ? "levee" : "ouverte"}`).join("\n")
    : "Aucune reserve.";
  const description = [
    `Chantier: ${chantier.nom}`,
    `Reference: ${report.projectReference || chantier.id}`,
    `Decision: ${receptionDecisionLabel(report.decision)}`,
    `Date de reception: ${report.receptionDate}`,
    report.observations ? `Observations: ${report.observations}` : null,
    `Reserves:\n${reserveLines}`,
    `Signature client: ${report.clientSignerName || "-"}`,
    `Signature entreprise: ${report.companySignerName || "-"}`,
  ].filter(Boolean).join("\n\n");

  const next = {
    ...report.document,
    status: report.status === "signed" ? "signed" as const : report.status === "sent" ? "sent" as const : report.status === "refused" ? "refused" as const : "draft" as const,
    issueDate: report.receptionDate,
    chantierId: chantier.id,
    siteAddress: report.document.siteAddress ?? chantier.adresse ?? null,
    description,
    nodes: syncReceptionNodes(report.document, description),
  };
  return { ...next, totals: calculateDocumentTotals(next) };
}

async function syncReportReservesWithChantier(report: ReceptionReportRecord, chantier: ChantierRow): Promise<ReceptionReportRecord> {
  if (report.decision !== "with_reserves") return report;

  const nextReserves: ReceptionReportReserve[] = [];
  for (const reserve of report.reserves) {
    if (reserve.chantierReserveId || !reserve.description.trim()) {
      nextReserves.push(reserve);
      continue;
    }

    const created = await createReserve({
      chantier_id: chantier.id,
      title: reserve.description.trim().slice(0, 120),
      description: [
        reserve.description.trim(),
        reserve.lot ? `Lot concerne: ${reserve.lot}` : null,
        reserve.responsible ? `Responsable: ${reserve.responsible}` : null,
        reserve.dueDate ? `Levee prevue: ${reserve.dueDate}` : null,
        "Origine: PV de reception",
      ].filter(Boolean).join("\n"),
      status: reserve.status === "lifted" ? "LEVEE" : "OUVERTE",
      priority: "NORMALE",
    });

    nextReserves.push({ ...reserve, chantierReserveId: created.id });
  }

  return { ...report, reserves: nextReserves, updatedAt: new Date().toISOString() };
}

function syncReceptionNodes(document: BusinessDocument, content: string) {
  return document.nodes.map((node) => {
    if (node.type !== "section" || node.title !== "Reception du chantier") return node;
    return {
      ...node,
      children: node.children.map((child) => child.type === "text" ? { ...child, content } : child),
    };
  });
}

function Field({ label, value, onChange, type = "text", readOnly = false }: { label: string; value: string; onChange?: (value: string) => void; type?: string; readOnly?: boolean }) {
  return (
    <label className={labelClass}>
      {label}
      <input className={inputClass} type={type} value={value} readOnly={readOnly} onChange={(event) => onChange?.(event.target.value)} />
    </label>
  );
}

const labelClass = "block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400";
const inputClass = "mt-1 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal normal-case tracking-normal text-slate-950 outline-none focus:border-blue-300 read-only:bg-slate-50";
