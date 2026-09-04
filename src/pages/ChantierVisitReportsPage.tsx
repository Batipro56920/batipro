import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FileText, MapPin, Plus, RefreshCw, Search, X } from "lucide-react";

import VisiteWizardDrawer from "../components/chantiers/VisiteWizardDrawer";
import { getSignedUrl, listByChantier as listDocumentsByChantier, type ChantierDocumentRow } from "../services/chantierDocuments.service";
import { listAllVisites, type ChantierVisiteRow } from "../services/chantierVisites.service";
import { listChantiers, type ChantierRow } from "../services/chantiers.service";
import { listIntervenantsByChantierId, type IntervenantRow } from "../services/intervenants.service";

const PAGE_SIZE = 12;

type EditorContext = {
  chantier: ChantierRow;
  visiteId: string | null;
  intervenants: IntervenantRow[];
  documents: ChantierDocumentRow[];
};

function formatVisitDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date non renseignée";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function ChantierVisitReportsPage() {
  const [visites, setVisites] = useState<ChantierVisiteRow[]>([]);
  const [chantiers, setChantiers] = useState<ChantierRow[]>([]);
  const [search, setSearch] = useState("");
  const [chantierFilter, setChantierFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingEditor, setLoadingEditor] = useState(false);
  const [openingPdfId, setOpeningPdfId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [newChantierId, setNewChantierId] = useState("");
  const [editor, setEditor] = useState<EditorContext | null>(null);

  const chantierById = useMemo(() => new Map(chantiers.map((chantier) => [chantier.id, chantier])), [chantiers]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [visiteRows, chantierRows] = await Promise.all([listAllVisites(), listChantiers({ scope: "all" })]);
      setVisites(visiteRows);
      setChantiers(chantierRows);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger les rapports de visite.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, chantierFilter]);

  const filteredVisites = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("fr");
    return visites.filter((visite) => {
      if (chantierFilter !== "all" && visite.chantier_id !== chantierFilter) return false;
      if (!needle) return true;
      const chantier = chantierById.get(visite.chantier_id);
      return [visite.titre, visite.phase, visite.redactor_email, chantier?.nom, chantier?.client, chantier?.adresse]
        .some((value) => String(value ?? "").toLocaleLowerCase("fr").includes(needle));
    });
  }, [visites, chantierFilter, search, chantierById]);

  const pageCount = Math.max(1, Math.ceil(filteredVisites.length / PAGE_SIZE));
  const visibleVisites = filteredVisites.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function openEditor(chantierId: string, visiteId: string | null) {
    const chantier = chantierById.get(chantierId);
    if (!chantier) {
      setError("Le chantier associé à ce rapport est introuvable.");
      return;
    }
    setLoadingEditor(true);
    setError(null);
    try {
      const [intervenants, documents] = await Promise.all([
        listIntervenantsByChantierId(chantierId),
        listDocumentsByChantier(chantierId),
      ]);
      setEditor({ chantier, visiteId, intervenants, documents });
      setChooserOpen(false);
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'ouvrir le rapport.");
    } finally {
      setLoadingEditor(false);
    }
  }

  async function openPdf(visite: ChantierVisiteRow) {
    if (!visite.pdf_document_id) return;
    setOpeningPdfId(visite.id);
    setError(null);
    try {
      const documents = await listDocumentsByChantier(visite.chantier_id);
      const document = documents.find((row) => row.id === visite.pdf_document_id);
      if (!document) throw new Error("Le PDF associé à ce rapport est introuvable.");
      const url = await getSignedUrl(document.storage_path, 120);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'ouvrir le PDF.");
    } finally {
      setOpeningPdfId(null);
    }
  }

  return (
    <div className="bt-page space-y-5">
      <section className="rounded-surface border border-subtle bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="bt-eyebrow text-primary">Production · tous les chantiers</div>
            <h1 className="bt-page-title mt-1 text-ink">Rapports de visite chantier</h1>
            <p className="bt-secondary mt-2 max-w-3xl text-muted">
              Crée, consulte et modifie les rapports de visite de l’ensemble des chantiers. Depuis le dossier d’un chantier, cette même fonction reste limitée au chantier concerné.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className="bt-control inline-flex items-center gap-2 rounded-field border border-subtle bg-surface px-4 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} strokeWidth={1.75} />
              Actualiser
            </button>
            <button
              type="button"
              onClick={() => setChooserOpen(true)}
              className="bt-control inline-flex items-center gap-2 rounded-field bg-primary px-4 py-2 text-sm font-semibold text-primary-contrast hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              Nouveau rapport
            </button>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-card border border-danger/20 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-on">{error}</div> : null}

      <section className="rounded-surface border border-subtle bg-surface shadow-sm">
        <div className="grid gap-3 border-b border-subtle p-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" strokeWidth={1.75} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="bt-control w-full rounded-field border border-subtle bg-surface py-2 pl-10 pr-3 text-sm text-ink outline-none focus:border-primary"
              placeholder="Rechercher un rapport, chantier, client…"
            />
          </label>
          <select
            value={chantierFilter}
            onChange={(event) => setChantierFilter(event.target.value)}
            className="bt-control w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          >
            <option value="all">Tous les chantiers</option>
            {chantiers.map((chantier) => <option key={chantier.id} value={chantier.id}>{chantier.nom}</option>)}
          </select>
          <div className="flex items-center justify-end text-sm font-medium text-muted">
            {filteredVisites.length} rapport{filteredVisites.length > 1 ? "s" : ""}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted">Chargement des rapports…</div>
        ) : visibleVisites.length === 0 ? (
          <div className="m-4 rounded-card border border-dashed border-subtle bg-interactive p-8 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted" strokeWidth={1.5} />
            <div className="mt-3 font-semibold text-ink">Aucun rapport trouvé</div>
            <p className="mt-1 text-sm text-muted">Crée un premier rapport ou modifie les filtres.</p>
          </div>
        ) : (
          <div className="divide-y divide-subtle">
            {visibleVisites.map((visite) => {
              const chantier = chantierById.get(visite.chantier_id);
              return (
                <article key={visite.id} className="grid gap-3 p-4 transition-colors hover:bg-interactive/60 lg:grid-cols-[minmax(0,1.5fr)_minmax(180px,0.8fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate font-semibold text-ink">{visite.titre || "Rapport de visite"}{visite.numero ? ` · n°${visite.numero}` : ""}</h2>
                      {visite.phase ? <span className="rounded-full border border-subtle bg-surface px-2 py-0.5 text-xs font-medium text-ink-secondary">{visite.phase}</span> : null}
                    </div>
                    <div className="mt-1 font-medium text-primary">{chantier?.nom ?? "Chantier indisponible"}</div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatVisitDate(visite.visit_datetime)}</span>
                      {chantier?.adresse ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{chantier.adresse}</span> : null}
                    </div>
                  </div>
                  <div className="text-sm text-muted">
                    <div>{chantier?.client || "Client non renseigné"}</div>
                    <div className="mt-1 text-xs">{visite.redactor_email || "Rédacteur non renseigné"}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {visite.pdf_document_id ? (
                      <button
                        type="button"
                        onClick={() => void openPdf(visite)}
                        disabled={openingPdfId === visite.id}
                        className="rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive disabled:opacity-60"
                      >
                        {openingPdfId === visite.id ? "Ouverture…" : "Ouvrir le PDF"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void openEditor(visite.chantier_id, visite.id)}
                      disabled={loadingEditor || !chantier}
                      className="rounded-field bg-primary px-3 py-2 text-sm font-semibold text-primary-contrast hover:bg-primary-hover disabled:opacity-60"
                    >
                      Consulter / modifier
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {pageCount > 1 ? (
          <div className="flex items-center justify-between border-t border-subtle px-4 py-3 text-sm">
            <button type="button" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-field border border-subtle px-3 py-1.5 font-semibold text-ink-secondary disabled:opacity-40">Précédent</button>
            <span className="text-muted">Page {page} sur {pageCount}</span>
            <button type="button" disabled={page === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded-field border border-subtle px-3 py-1.5 font-semibold text-ink-secondary disabled:opacity-40">Suivant</button>
          </div>
        ) : null}
      </section>

      {chooserOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <button type="button" aria-label="Fermer" className="absolute inset-0 bg-black/40" onClick={() => setChooserOpen(false)} />
          <div className="relative w-full max-w-lg rounded-surface border border-subtle bg-surface p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="bt-section-title text-ink">Nouveau rapport de visite</h2>
                <p className="mt-1 text-sm text-muted">Choisis le chantier auquel le rapport doit être rattaché.</p>
              </div>
              <button type="button" aria-label="Fermer" onClick={() => setChooserOpen(false)} className="rounded-field border border-subtle p-2 text-muted hover:bg-interactive"><X className="h-4 w-4" /></button>
            </div>
            <label className="mt-5 block text-sm font-semibold text-ink-secondary">
              Chantier
              <select value={newChantierId} onChange={(event) => setNewChantierId(event.target.value)} className="mt-2 w-full rounded-field border border-subtle bg-surface px-3 py-2.5 text-sm text-ink">
                <option value="">Sélectionner un chantier</option>
                {chantiers.map((chantier) => <option key={chantier.id} value={chantier.id}>{chantier.nom}{chantier.client ? ` · ${chantier.client}` : ""}</option>)}
              </select>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setChooserOpen(false)} className="rounded-field border border-subtle px-4 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">Annuler</button>
              <button type="button" disabled={!newChantierId || loadingEditor} onClick={() => void openEditor(newChantierId, null)} className="rounded-field bg-primary px-4 py-2 text-sm font-semibold text-primary-contrast hover:bg-primary-hover disabled:opacity-50">
                {loadingEditor ? "Ouverture…" : "Créer le rapport"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editor ? (
        <VisiteWizardDrawer
          open
          visiteId={editor.visiteId}
          chantierId={editor.chantier.id}
          chantierName={editor.chantier.nom}
          chantierReference={editor.chantier.id}
          chantierAddress={editor.chantier.adresse}
          clientName={editor.chantier.client}
          intervenants={editor.intervenants}
          documents={editor.documents}
          onClose={() => {
            setEditor(null);
            void refresh();
          }}
          onSaved={refresh}
        />
      ) : null}
    </div>
  );
}
