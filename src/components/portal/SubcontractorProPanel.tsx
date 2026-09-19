import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Receipt, RefreshCw, ShieldCheck, Trash2, Upload, Wrench } from "lucide-react";
import {
  DOCUMENT_KINDS,
  INVOICE_KIND_LABELS,
  INVOICE_STATUS_LABELS,
  documentsNeedingAttention,
  subcontractorDeletePiece,
  subcontractorPortalLoad,
  subcontractorUploadDocument,
  subcontractorUploadInvoice,
  summarizeDocuments,
  type DocumentStatusSummary,
  type SubcontractorDocumentKind,
  type SubcontractorInvoiceKind,
  type SubcontractorInvoiceStatus,
  type SubcontractorPortalData,
} from "../../services/subcontractorPortal.service";
import {
  intervenantReserveList,
  intervenantReserveMarkLifted,
  type IntervenantReserve,
} from "../../services/intervenantPortal.service";

type Props = { token: string };

const cardClass = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
const inputClass = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-400";

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-FR");
}

function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return "";
  return value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

const STATE_STYLES: Record<DocumentStatusSummary["state"], { label: (entry: DocumentStatusSummary) => string; tone: string }> = {
  manquant: { label: () => "À déposer", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  a_valider: { label: () => "En cours de vérification", tone: "bg-blue-50 text-blue-800 border-blue-200" },
  valide: {
    label: (entry) => (entry.expiresOn ? `Valide jusqu'au ${formatDate(entry.expiresOn)}` : "Validé"),
    tone: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  expire_bientot: {
    label: (entry) => `Expire le ${formatDate(entry.expiresOn)}`,
    tone: "bg-amber-50 text-amber-800 border-amber-200",
  },
  expire: { label: (entry) => `Expiré le ${formatDate(entry.expiresOn)}`, tone: "bg-red-50 text-red-700 border-red-200" },
  refuse: { label: () => "Refusé", tone: "bg-red-50 text-red-700 border-red-200" },
};

const INVOICE_TONES: Record<SubcontractorInvoiceStatus, string> = {
  soumis: "bg-blue-50 text-blue-800",
  accepte: "bg-emerald-50 text-emerald-800",
  refuse: "bg-red-50 text-red-700",
  paye: "bg-slate-900 text-white",
};

/**
 * Espace "Pro" du sous-traitant, dans le portail terrain : ce qui fait la
 * relation de sous-traitance, en plus du travail sur le chantier. Documents
 * obligatoires avec leurs échéances, devis et factures déposés au lieu d'être
 * envoyés par mail, réserves qui lui sont affectées.
 */
export default function SubcontractorProPanel({ token }: Props) {
  const [data, setData] = useState<SubcontractorPortalData | null>(null);
  const [reserves, setReserves] = useState<IntervenantReserve[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [portal, reserveRows] = await Promise.all([
        subcontractorPortalLoad(token),
        intervenantReserveList(token).catch(() => [] as IntervenantReserve[]),
      ]);
      setData(portal);
      setReserves(reserveRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Espace sous-traitant indisponible.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => summarizeDocuments(data?.documents ?? []), [data?.documents]);
  const attention = useMemo(() => documentsNeedingAttention(summary), [summary]);
  const openReserves = useMemo(() => reserves.filter((reserve) => reserve.status !== "LEVEE"), [reserves]);
  const chantierName = useMemo(() => new Map((data?.chantiers ?? []).map((row) => [row.id, row.nom])), [data?.chantiers]);

  async function run(label: string, task: () => Promise<SubcontractorPortalData | void>, success: string) {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const next = await task();
      if (next) setData(next);
      setNotice(success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opération impossible.");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) {
    return <div className={`${cardClass} text-sm text-slate-500`}>Chargement de ton espace…</div>;
  }

  return (
    <div className="space-y-4">
      <section className={cardClass}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-600">Espace sous-traitant</div>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">{data?.identity.company || data?.identity.nom || "Mon entreprise"}</h2>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-xl border border-slate-200 p-2 text-slate-500" aria-label="Actualiser">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat value={attention.length} label="document(s) à fournir" alert={attention.length > 0} />
          <Stat value={(data?.invoices ?? []).filter((row) => row.status === "soumis").length} label="pièce(s) en attente" />
          <Stat value={openReserves.length} label="réserve(s) à lever" alert={openReserves.length > 0} />
        </div>
      </section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}

      <section className={cardClass}>
        <SectionTitle icon={ShieldCheck} title="Mes documents obligatoires" />
        <p className="mt-1 text-xs text-slate-500">
          CB Rénovation doit les détenir à jour pour te confier des travaux. Dépose une photo nette ou le PDF.
        </p>
        <div className="mt-3 space-y-3">
          {summary.map((entry) => (
            <DocumentRow
              key={entry.kind}
              entry={entry}
              busy={busy === `doc-${entry.kind}`}
              onUpload={(file, validUntil) =>
                run(`doc-${entry.kind}`, () => subcontractorUploadDocument(token, { kind: entry.kind, file, validUntil }), `${entry.label} déposé.`)
              }
            />
          ))}
          <OtherDocumentUpload
            busy={busy === "doc-autre"}
            onUpload={(file, label) =>
              run("doc-autre", () => subcontractorUploadDocument(token, { kind: "autre" as SubcontractorDocumentKind, file, label }), "Document déposé.")
            }
          />
        </div>
      </section>

      <section className={cardClass}>
        <SectionTitle icon={Receipt} title="Devis, factures et situations" />
        <InvoiceForm
          chantiers={data?.chantiers ?? []}
          busy={busy === "invoice"}
          onSubmit={(payload) => run("invoice", () => subcontractorUploadInvoice(token, payload), `${INVOICE_KIND_LABELS[payload.kind]} envoyé(e) à CB Rénovation.`)}
        />
        <div className="mt-4 space-y-2">
          {(data?.invoices ?? []).length ? (
            (data?.invoices ?? []).map((invoice) => (
              <div key={invoice.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {INVOICE_KIND_LABELS[invoice.kind]}
                      {invoice.reference ? ` n° ${invoice.reference}` : ""}
                    </div>
                    <div className="text-xs text-slate-500">
                      {[invoice.chantier_id ? chantierName.get(invoice.chantier_id) ?? "Chantier" : null, formatMoney(invoice.amount_ht) ? `${formatMoney(invoice.amount_ht)} HT` : null, invoice.issued_on ? `du ${formatDate(invoice.issued_on)}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${INVOICE_TONES[invoice.status]}`}>
                    {INVOICE_STATUS_LABELS[invoice.status]}
                  </span>
                </div>
                {invoice.review_note ? <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">CB Rénovation : {invoice.review_note}</p> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {invoice.url ? <FileLink url={invoice.url} name={invoice.file_name} /> : null}
                  {invoice.status === "soumis" ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void run(`del-${invoice.id}`, () => subcontractorDeletePiece(token, "invoice", invoice.id), "Pièce retirée.")}
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Retirer
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">Aucune pièce déposée pour le moment.</p>
          )}
        </div>
      </section>

      <section className={cardClass}>
        <SectionTitle icon={Wrench} title="Réserves à lever" />
        <div className="mt-3 space-y-2">
          {openReserves.length ? (
            openReserves.map((reserve) => (
              <div key={reserve.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{reserve.title}</div>
                    <div className="text-xs text-slate-500">
                      {[reserve.chantier_nom, reserve.zone_nom, reserve.task_titre].filter(Boolean).join(" · ")}
                    </div>
                    {reserve.description ? <p className="mt-1 text-xs text-slate-600">{reserve.description}</p> : null}
                  </div>
                  {reserve.priority === "URGENTE" ? (
                    <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">Urgente</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    void run(
                      `reserve-${reserve.id}`,
                      async () => {
                        await intervenantReserveMarkLifted(token, reserve.id);
                        setReserves((current) => current.map((row) => (row.id === reserve.id ? { ...row, status: "LEVEE" } : row)));
                      },
                      "Réserve signalée comme levée.",
                    )
                  }
                  className="mt-2 inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Réserve levée
                </button>
              </div>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 p-3 text-sm text-slate-500">Aucune réserve à lever.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ value, label, alert }: { value: number; label: string; alert?: boolean }) {
  return (
    <div className={`rounded-xl p-2 ${alert ? "bg-amber-50" : "bg-slate-50"}`}>
      <div className={`text-xl font-bold ${alert ? "text-amber-700" : "text-slate-900"}`}>{value}</div>
      <div className="text-[11px] leading-4 text-slate-500">{label}</div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: typeof FileText; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950">
      <Icon className="h-5 w-5 text-blue-600" />
      {title}
    </h3>
  );
}

function FileLink({ url, name }: { url: string; name: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-700">
      <ExternalLink className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{name}</span>
    </a>
  );
}

function DocumentRow({
  entry,
  busy,
  onUpload,
}: {
  entry: DocumentStatusSummary;
  busy: boolean;
  onUpload: (file: File, validUntil: string | null) => void;
}) {
  const [validUntil, setValidUntil] = useState("");
  const style = STATE_STYLES[entry.state];
  const needsAction = ["manquant", "refuse", "expire", "expire_bientot"].includes(entry.state);

  return (
    <div className={`rounded-xl border p-3 ${needsAction ? "border-amber-200 bg-amber-50/40" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">{entry.label}</div>
          <div className="text-xs text-slate-500">{entry.hint}</div>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${style.tone}`}>
          {needsAction ? <AlertTriangle className="mr-1 inline h-3 w-3" /> : null}
          {style.label(entry)}
        </span>
      </div>
      {entry.state === "refuse" && entry.latest?.review_note ? (
        <p className="mt-2 rounded-lg bg-white px-2 py-1 text-xs text-red-700">Motif : {entry.latest.review_note}</p>
      ) : null}
      {entry.latest?.url ? (
        <div className="mt-2">
          <FileLink url={entry.latest.url} name={entry.latest.file_name} />
        </div>
      ) : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="text-xs text-slate-500">
          Valable jusqu'au (si indiqué sur le document)
          <input type="date" className={`${inputClass} mt-1`} value={validUntil} onChange={(event) => setValidUntil(event.target.value)} />
        </label>
        <FilePickButton
          label={entry.latest ? "Remplacer" : "Déposer"}
          busy={busy}
          onPick={(file) => onUpload(file, validUntil || null)}
        />
      </div>
    </div>
  );
}

function OtherDocumentUpload({ busy, onUpload }: { busy: boolean; onUpload: (file: File, label: string | null) => void }) {
  const [label, setLabel] = useState("");
  const other = DOCUMENT_KINDS.find((entry) => entry.kind === "autre");
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-3">
      <div className="text-sm font-semibold text-slate-900">{other?.label}</div>
      <div className="text-xs text-slate-500">{other?.hint}</div>
      <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
        <input className={inputClass} placeholder="Nom du document" value={label} onChange={(event) => setLabel(event.target.value)} />
        <FilePickButton label="Déposer" busy={busy} onPick={(file) => onUpload(file, label.trim() || null)} />
      </div>
    </div>
  );
}

function FilePickButton({ label, busy, onPick }: { label: string; busy: boolean; onPick: (file: File) => void }) {
  return (
    <label className={`inline-flex h-11 cursor-pointer items-center justify-center gap-2 self-end rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white ${busy ? "opacity-60" : ""}`}>
      {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {busy ? "Envoi…" : label}
      <input
        type="file"
        accept="application/pdf,image/*"
        className="sr-only"
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onPick(file);
        }}
      />
    </label>
  );
}

function InvoiceForm({
  chantiers,
  busy,
  onSubmit,
}: {
  chantiers: Array<{ id: string; nom: string }>;
  busy: boolean;
  onSubmit: (payload: {
    kind: SubcontractorInvoiceKind;
    file: File;
    chantierId: string | null;
    reference: string | null;
    amountHt: string | null;
    issuedOn: string | null;
  }) => void;
}) {
  const [kind, setKind] = useState<SubcontractorInvoiceKind>("facture");
  const [chantierId, setChantierId] = useState(chantiers.length === 1 ? chantiers[0].id : "");
  const [reference, setReference] = useState("");
  const [amountHt, setAmountHt] = useState("");
  const [issuedOn, setIssuedOn] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!chantierId && chantiers.length === 1) setChantierId(chantiers[0].id);
  }, [chantierId, chantiers]);

  function submit() {
    if (!file) return;
    onSubmit({
      kind,
      file,
      chantierId: chantierId || null,
      reference: reference.trim() || null,
      amountHt: amountHt.trim() || null,
      issuedOn: issuedOn || null,
    });
    setReference("");
    setAmountHt("");
    setIssuedOn("");
    setFile(null);
  }

  return (
    <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
      <label className="text-xs text-slate-500">
        Type
        <select className={`${inputClass} mt-1`} value={kind} onChange={(event) => setKind(event.target.value as SubcontractorInvoiceKind)}>
          {(Object.keys(INVOICE_KIND_LABELS) as SubcontractorInvoiceKind[]).map((value) => (
            <option key={value} value={value}>{INVOICE_KIND_LABELS[value]}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-500">
        Chantier
        <select className={`${inputClass} mt-1`} value={chantierId} onChange={(event) => setChantierId(event.target.value)}>
          <option value="">Sans chantier précis</option>
          {chantiers.map((row) => (
            <option key={row.id} value={row.id}>{row.nom}</option>
          ))}
        </select>
      </label>
      <label className="text-xs text-slate-500">
        Numéro
        <input className={`${inputClass} mt-1`} value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ex. F-2026-014" />
      </label>
      <label className="text-xs text-slate-500">
        Montant HT (€)
        <input className={`${inputClass} mt-1`} inputMode="decimal" value={amountHt} onChange={(event) => setAmountHt(event.target.value)} placeholder="0,00" />
      </label>
      <label className="text-xs text-slate-500">
        Date du document
        <input type="date" className={`${inputClass} mt-1`} value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} />
      </label>
      <label className="text-xs text-slate-500">
        Fichier (PDF ou photo)
        <input
          type="file"
          accept="application/pdf,image/*"
          className="mt-1 block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      <button
        type="button"
        onClick={submit}
        disabled={!file || busy}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
      >
        {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? "Envoi…" : `Envoyer ${INVOICE_KIND_LABELS[kind].toLowerCase()}`}
      </button>
    </div>
  );
}
