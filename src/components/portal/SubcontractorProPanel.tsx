import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ExternalLink, FileText, Paperclip, Receipt, RefreshCw, ShieldCheck, Trash2, Upload, Wrench, X } from "lucide-react";
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

/** Le poids d'un fichier, dit comme on le lit : 840 Ko, 2,4 Mo. */
function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(Math.round((bytes / (1024 * 1024)) * 10) / 10).toLocaleString("fr-FR")} Mo`;
}

const STATE_STYLES: Record<DocumentStatusSummary["state"], { label: (entry: DocumentStatusSummary) => string; tone: string }> = {
  manquant: { label: () => "À déposer", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  a_valider: { label: () => "En vérification", tone: "bg-blue-50 text-blue-800 border-blue-200" },
  valide: {
    label: (entry) => (entry.expiresOn ? `Jusqu'au ${formatDate(entry.expiresOn)}` : "À jour"),
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
 *
 * Tout se lit sur un téléphone, d'un pouce : une ligne par pièce, une seule
 * action mise en avant à la fois — celle qui manque. Ce qui est à jour ne
 * propose qu'un remplacement discret. L'échéance d'un document n'est pas
 * demandée ici : elle est lue sur la pièce au moment de la valider, au bureau.
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
  const waiting = (data?.invoices ?? []).filter((row) => row.status === "soumis").length;
  const extraDocuments = (data?.documents ?? []).filter((row) => row.kind === "autre");

  // Une seule phrase pour dire ce qui reste à faire : les pastilles de chaque
  // ligne disent déjà l'état, inutile de les recompter en gros chiffres.
  const todo = [
    attention.length ? `${attention.length} document${attention.length > 1 ? "s" : ""} à fournir` : null,
    openReserves.length ? `${openReserves.length} réserve${openReserves.length > 1 ? "s" : ""} à lever` : null,
  ].filter(Boolean) as string[];

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
        <div className={`mt-3 rounded-xl px-3 py-2 text-sm ${todo.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>
          {todo.length ? `À faire : ${todo.join(" · ")}.` : "Tout est à jour, rien à fournir."}
          {waiting ? (
            <span className="mt-0.5 block text-xs text-slate-500">
              {waiting > 1 ? `${waiting} pièces en attente` : "1 pièce en attente"} de réponse de CB Rénovation.
            </span>
          ) : null}
        </div>
      </section>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}

      <section className={cardClass}>
        <SectionTitle icon={ShieldCheck} title="Mes documents obligatoires" />
        <p className="mt-1 text-xs text-slate-500">
          CB Rénovation doit les détenir à jour pour te confier des travaux. Dépose une photo nette ou le PDF.
        </p>
        <div className="mt-3 divide-y divide-slate-100">
          {summary.map((entry) => (
            <DocumentRow
              key={entry.kind}
              entry={entry}
              busy={busy === `doc-${entry.kind}`}
              disabled={busy !== null}
              onUpload={(file) => run(`doc-${entry.kind}`, () => subcontractorUploadDocument(token, { kind: entry.kind, file }), `${entry.label} déposé.`)}
            />
          ))}
          {extraDocuments.map((document) => (
            <div key={document.id} className="flex items-center gap-3 py-3">
              <Thumbnail url={document.url} mime={document.mime_type} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-slate-900">{document.label || document.file_name}</div>
                <div className="text-xs text-slate-500">
                  {[`Déposé le ${formatDate(document.created_at)}`, formatSize(document.size_bytes)].filter(Boolean).join(" · ")}
                </div>
              </div>
              {document.url ? <OpenLink url={document.url} /> : null}
            </div>
          ))}
          <OtherDocumentUpload
            busy={busy === "doc-autre"}
            disabled={busy !== null}
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
                <div className="flex items-start gap-3">
                  <Thumbnail url={invoice.url} mime={invoice.mime_type} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {INVOICE_KIND_LABELS[invoice.kind]}
                      {invoice.reference ? ` n° ${invoice.reference}` : ""}
                    </div>
                    <div className="text-xs text-slate-500">
                      {[
                        invoice.chantier_id ? chantierName.get(invoice.chantier_id) ?? "Chantier" : null,
                        formatMoney(invoice.amount_ht) ? `${formatMoney(invoice.amount_ht)} HT` : null,
                        invoice.issued_on ? `du ${formatDate(invoice.issued_on)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    <div className="text-xs text-slate-400">
                      {[`Déposé le ${formatDate(invoice.created_at)}`, formatSize(invoice.size_bytes)].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${INVOICE_TONES[invoice.status]}`}>
                    {INVOICE_STATUS_LABELS[invoice.status]}
                  </span>
                </div>
                {invoice.review_note ? <p className="mt-2 rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">CB Rénovation : {invoice.review_note}</p> : null}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {invoice.url ? <OpenLink url={invoice.url} /> : null}
                  {invoice.status === "soumis" ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void run(`del-${invoice.id}`, () => subcontractorDeletePiece(token, "invoice", invoice.id), "Pièce retirée.")}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 disabled:opacity-50"
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

function SectionTitle({ icon: Icon, title }: { icon: typeof FileText; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-base font-semibold text-slate-950">
      <Icon className="h-5 w-5 text-blue-600" />
      {title}
    </h3>
  );
}

/** Ce qui a été envoyé, en un coup d'œil : la photo elle-même, ou l'icône du PDF. */
function Thumbnail({ url, mime }: { url: string | null; mime: string | null }) {
  const isImage = Boolean(mime && mime.startsWith("image/") && url);
  const content = isImage ? (
    <img src={url!} alt="" className="h-11 w-11 rounded-lg object-cover" />
  ) : (
    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
      <FileText className="h-5 w-5" />
    </span>
  );
  if (!url) return <span className="shrink-0">{content}</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="shrink-0" aria-label="Ouvrir le fichier">
      {content}
    </a>
  );
}

function OpenLink({ url }: { url: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
      <ExternalLink className="h-3.5 w-3.5" />
      Ouvrir
    </a>
  );
}

function DocumentRow({
  entry,
  busy,
  disabled,
  onUpload,
}: {
  entry: DocumentStatusSummary;
  busy: boolean;
  disabled: boolean;
  onUpload: (file: File) => void;
}) {
  const style = STATE_STYLES[entry.state];
  const needsAction = ["manquant", "refuse", "expire", "expire_bientot"].includes(entry.state);

  // Sur un téléphone, le bouton sur la même ligne que le texte ne laisse que
  // 150 px au titre, qui se casse en trois lignes : il prend donc sa propre
  // ligne, à droite, et revient à côté du texte dès qu'il y a de la place.
  return (
    <div className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3">
      {entry.latest ? <Thumbnail url={entry.latest.url} mime={entry.latest.mime_type} /> : null}
      <div className="min-w-0 flex-1 basis-40">
        <div className="text-sm font-semibold text-slate-900">{entry.label}</div>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${style.tone}`}>{style.label(entry)}</span>
          <span className="text-xs text-slate-500">
            {entry.latest
              ? [`Déposé le ${formatDate(entry.latest.created_at)}`, formatSize(entry.latest.size_bytes)].filter(Boolean).join(" · ")
              : entry.hint}
          </span>
        </div>
        {entry.state === "refuse" && entry.latest?.review_note ? (
          <p className="mt-1 text-xs text-red-700">Motif : {entry.latest.review_note}</p>
        ) : null}
      </div>
      <div className="ml-auto">
        <FilePick
          label={entry.latest ? "Remplacer" : "Déposer"}
          quiet={!needsAction}
          busy={busy}
          disabled={disabled}
          onPick={onUpload}
        />
      </div>
    </div>
  );
}

/** Un document en plus du socle obligatoire : le nom n'est demandé qu'une fois le dépôt engagé. */
function OtherDocumentUpload({ busy, disabled, onUpload }: { busy: boolean; disabled: boolean; onUpload: (file: File, label: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const other = DOCUMENT_KINDS.find((entry) => entry.kind === "autre");

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-2 py-3 text-sm font-semibold text-blue-700">
        <Paperclip className="h-4 w-4" />
        Ajouter un autre document
      </button>
    );
  }

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">{other?.label}</div>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400" aria-label="Annuler">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="text-xs text-slate-500">{other?.hint}</div>
      <div className="mt-2 flex items-center gap-2">
        <input className={inputClass} placeholder="Nom du document" value={label} onChange={(event) => setLabel(event.target.value)} />
        <FilePick
          label="Déposer"
          busy={busy}
          disabled={disabled}
          onPick={(file) => {
            onUpload(file, label.trim() || null);
            setLabel("");
            setOpen(false);
          }}
        />
      </div>
    </div>
  );
}

/**
 * Le même bouton partout où un fichier est demandé : le champ natif du
 * navigateur ("Aucun fichier choisi", tronqué sur un téléphone) reste caché.
 */
function FilePick({
  label,
  busy,
  disabled,
  quiet,
  onPick,
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  quiet?: boolean;
  onPick: (file: File) => void;
}) {
  const tone = quiet
    ? "border border-slate-200 bg-white text-slate-600"
    : "bg-blue-600 text-white";
  return (
    <label
      className={`inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold ${tone} ${busy || disabled ? "opacity-60" : ""}`}
    >
      {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
      {busy ? "Envoi…" : label}
      <input
        type="file"
        accept="application/pdf,image/*"
        className="sr-only"
        disabled={busy || disabled}
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
      <label className="text-xs text-slate-500 sm:col-span-2">
        Date du document
        <input type="date" className={`${inputClass} mt-1`} value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} />
      </label>

      <div className="sm:col-span-2">
        <div className="text-xs text-slate-500">Fichier (PDF ou photo)</div>
        {file ? (
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <Paperclip className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-800">{file.name}</span>
            <span className="shrink-0 text-xs text-slate-400">{formatSize(file.size)}</span>
            <button type="button" onClick={() => setFile(null)} className="rounded-lg p-1 text-slate-400" aria-label="Retirer le fichier">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="mt-1">
            <FilePick label="Choisir le fichier" quiet busy={false} onPick={(picked) => setFile(picked)} />
          </div>
        )}
      </div>

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
