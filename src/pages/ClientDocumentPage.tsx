import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Clock, FileText, MessageSquare, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { accessClientDocument, DocumentPreview, DocumentStatusBadge, downloadBusinessDocumentPdf, type BusinessDocument, type ClientWorkflowEvent, type ClientWorkflowRecord } from "../features/document-engine";

type Feedback = { type: "success" | "error"; message: string } | null;

export default function ClientDocumentPage() {
  const { token = "" } = useParams();
  const [workflow, setWorkflow] = useState<ClientWorkflowRecord | null>(null);
  const [document, setDocument] = useState<BusinessDocument | null>(null);
  const [events, setEvents] = useState<ClientWorkflowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [signerName, setSignerName] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setFeedback(null);
      try {
        const result = await accessClientDocument(token, "view");
        if (!alive) return;
        setWorkflow(result.workflow);
        setDocument(result.document);
        setEvents(result.events);
        setSignerName(result.workflow.recipient_name ?? "");
      } catch (err) {
        if (!alive) return;
        setFeedback({ type: "error", message: err instanceof Error ? err.message : "Lien document invalide." });
      } finally {
        if (alive) setLoading(false);
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [token]);

  const terminal = useMemo(() => workflow ? ["accepted", "refused", "modification_requested", "expired"].includes(workflow.status) : false, [workflow]);

  async function runAction(action: "accept" | "refuse" | "request_modification") {
    setActing(action);
    setFeedback(null);
    try {
      const result = await accessClientDocument(token, action, { comment, signerName });
      setWorkflow(result.workflow);
      setDocument(result.document);
      setEvents(result.events);
      setFeedback({ type: "success", message: actionLabel(action) });
      // If accepted, generate an accepted PDF (signed) for the client
      if (action === "accept") {
        try {
          downloadBusinessDocumentPdf(result.document as BusinessDocument);
        } catch (err) {
          // ignore PDF generation errors but log
          console.error("ClientDocumentPage: failed to generate accepted PDF", err);
        }
      }
    } catch (err) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Action impossible." });
    } finally {
      setActing(null);
    }
  }

  if (loading) {
    return <PublicShell><div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Chargement du document...</div></PublicShell>;
  }

  if (!document || !workflow) {
    return (
      <PublicShell>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm font-medium text-red-700">{feedback?.message ?? "Document indisponible."}</div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-600"><FileText className="h-4 w-4" /> Portail client Batipro</div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{document.title} {document.number}</h1>
          <p className="mt-1 text-sm text-slate-500">Lien securise valable jusqu'au {formatDateTime(workflow.token_expires_at)}.</p>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-700">
            <div className="rounded-lg bg-slate-50 px-3 py-2">Entreprise: <span className="font-semibold">{document.company.displayName}</span></div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">Client: <span className="font-semibold">{document.recipient.displayName}</span></div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">Montant: <span className="font-semibold">{formatCurrency(document.totals?.totalTtc ?? 0)}</span></div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <DocumentStatusBadge status={workflowStatusToDocumentStatus(workflow.status)} />
          <div className="text-xs text-slate-500">{workflow.status === 'sent' ? 'Envoye' : workflow.status}</div>
        </div>
      </div>

      {feedback ? <div className={`mb-5 rounded-lg border p-3 text-sm font-medium ${feedback.type === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{feedback.message}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <DocumentPreview document={document} />

        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-950">Decision client</h2>
            <label className="mt-4 block text-sm font-semibold text-slate-700">
              Signataire
              <input className={inputClass} value={signerName} disabled={terminal} onChange={(event) => setSignerName(event.target.value)} placeholder="Nom du signataire" />
            </label>
            <label className="mt-3 block text-sm font-semibold text-slate-700">
              Commentaire
              <textarea className={`${inputClass} min-h-28 py-2`} value={comment} disabled={terminal} onChange={(event) => setComment(event.target.value)} placeholder="Commentaire optionnel" />
            </label>
            <div className="mt-4 grid gap-2">
              <Button type="button" variant="success" disabled={terminal || acting !== null} onClick={() => void runAction("accept")}><CheckCircle2 className="h-4 w-4" /> {acting === "accept" ? "Acceptation..." : "Accepter et signer"}</Button>
              <Button type="button" variant="secondary" disabled={terminal || acting !== null} onClick={() => void runAction("request_modification")}><MessageSquare className="h-4 w-4" /> Demander une modification</Button>
              <Button type="button" variant="danger" disabled={terminal || acting !== null} onClick={() => void runAction("refuse")}><XCircle className="h-4 w-4" /> Refuser</Button>
            </div>
            {terminal ? <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">Une decision a deja ete enregistree pour ce document.</div> : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-950"><Clock className="h-4 w-4" /> Historique</h2>
            <div className="mt-3 space-y-3">
              {events.map((event) => (
                <div key={`${event.event_type}-${event.created_at}`} className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  <div className="font-semibold text-slate-900">{eventLabel(event.event_type)}</div>
                  <div className="mt-1">{formatDateTime(event.created_at)}</div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </PublicShell>
  );
}

const inputClass = "mt-2 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 disabled:bg-slate-50 disabled:text-slate-400";

function PublicShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 lg:px-8"><div className="mx-auto max-w-7xl">{children}</div></main>;
}

function workflowStatusToDocumentStatus(status: ClientWorkflowRecord["status"]): BusinessDocument["status"] {
  if (status === "modification_requested") return "modification_requested";
  return status;
}

function actionLabel(action: "accept" | "refuse" | "request_modification") {
  if (action === "accept") return "Document accepte et signature horodatee enregistree.";
  if (action === "refuse") return "Refus enregistre.";
  return "Demande de modification enregistree.";
}

function eventLabel(type: string) {
  const labels: Record<string, string> = {
    sent: "Envoye",
    email_sent: "Email envoye",
    email_failed: "Email non envoye",
    viewed: "Consulte",
    accepted: "Accepte",
    refused: "Refuse",
    modification_requested: "Modification demandee",
    expired: "Expire",
    revoked: "Revoque",
  };
  return labels[type] ?? type;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}
