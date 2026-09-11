import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronLeft, FileText, Image, Lightbulb, MessageCircle, RefreshCw, Send } from "lucide-react";
import { Button } from "../../components/ui/button";
import { PageHeader } from "../../components/layout/PageHeader";
import { addComment, addItem, campaignStatusLabel, listChantiers, loadWorkspace, updateCampaign } from "./communicationRepository";
import { channelLabel } from "./networks";
import { AssetTile } from "./CommunicationAssetTile";
import { CommunicationContentEditor } from "./CommunicationContentEditor";
import type { Campaign, CampaignItem, ChantierOption, PublicationVariant, Workspace } from "./types";

const inputClass = "w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary";

type ContentState = "draft" | "approved" | "scheduled" | "published";

const STATE_LABELS: Record<ContentState, string> = {
  draft: "En préparation",
  approved: "Validé",
  scheduled: "Planifié",
  published: "Publié",
};
const STATE_CLASSES: Record<ContentState, string> = {
  draft: "bg-interactive text-muted",
  approved: "bg-success-soft text-success",
  scheduled: "bg-primary-soft text-primary-on",
  published: "bg-success-soft text-success",
};

/** L'état réel d'un contenu, validation comprise, que le statut seul ne dit pas. */
function contentState(item: CampaignItem, variants: PublicationVariant[]): ContentState {
  if (item.status === "published") return "published";
  if (item.status === "scheduled") return "scheduled";
  const mine = variants.filter((variant) => variant.item_id === item.id);
  return mine.length > 0 && mine.every((variant) => variant.approval_status === "approved") ? "approved" : "draft";
}

/**
 * L'idée de la campagne, en clair et modifiable.
 *
 * Les trois encadrés précédents affichaient un brief qu'aucun écran ne
 * permettait d'écrire : ils restaient donc à « À définir » pour toujours.
 */
function BriefPanel({ campaign, onSaved }: { campaign: Campaign; onSaved: () => void }) {
  const [idea, setIdea] = useState(campaign.brief ?? "");
  const [goals, setGoals] = useState(campaign.objective ?? "");
  const [audience, setAudience] = useState(campaign.audience ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = idea !== (campaign.brief ?? "") || goals !== (campaign.objective ?? "") || audience !== (campaign.audience ?? "");

  async function save() {
    setBusy(true);
    try {
      await updateCampaign(campaign.id, { brief: idea, objective: goals, audience });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-subtle bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">L&apos;idée de la campagne</h2>
      <textarea
        value={idea}
        onChange={(event) => setIdea(event.target.value)}
        rows={4}
        className={`${inputClass} mt-3`}
        placeholder="Ce qu'on veut raconter, le contexte, l'angle…"
      />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-ink">
          Buts et objectifs
          <textarea value={goals} onChange={(event) => setGoals(event.target.value)} rows={3} className={`${inputClass} mt-1`} placeholder="Gagner en visibilité locale, faire connaître un savoir-faire…" />
        </label>
        <label className="block text-sm font-medium text-ink">
          Public visé
          <textarea value={audience} onChange={(event) => setAudience(event.target.value)} rows={3} className={`${inputClass} mt-1`} placeholder="Propriétaires du secteur, prescripteurs…" />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-end gap-3">
        {saved ? <span className="text-sm text-success">Enregistré.</span> : null}
        <Button variant="secondary" disabled={busy || !dirty} onClick={() => void save()}>Enregistrer l&apos;idée</Button>
      </div>
    </section>
  );
}

export function CommunicationWorkspace({ id }: { id: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<Workspace | null>(null);
  const [chantiers, setChantiers] = useState<ChantierOption[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setBusy(true); setError("");
    try {
      const [workspace, sites] = await Promise.all([loadWorkspace(id), listChantiers()]);
      setData(workspace);
      setChantiers(sites);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    } finally {
      setBusy(false);
    }
  }, [id]);

  useEffect(() => { void reload(); }, [reload]);

  // Créer puis ouvrir : une carte vide n'a aucun intérêt tant qu'on ne l'écrit pas.
  async function create(kind: "texte" | "visuel") {
    setBusy(true); setError("");
    try {
      const item = await addItem(id, {
        title: kind === "texte" ? "Nouveau texte" : "Nouveau visuel",
        item_type: "publication",
        status: "to_prepare",
        channels: [],
      });
      await reload();
      setEditingId(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!comment.trim()) return;
    setBusy(true);
    try {
      await addComment(id, comment.trim());
      setComment("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <div className="p-6">{error || "Chargement de la campagne…"}</div>;
  const editing = data.items.find((item) => item.id === editingId) ?? null;

  return (
    <div className="space-y-5">
      <button className="flex items-center gap-2 text-sm font-medium text-primary" onClick={() => navigate("/communication")}>
        <ChevronLeft className="h-4 w-4" />Toutes les campagnes
      </button>
      <PageHeader
        eyebrow="Communication · Campagne"
        title={data.campaign.title}
        description="Écrire, valider, puis planifier."
        actions={<>
          <select
            value={data.campaign.status}
            onChange={async (event) => { await updateCampaign(id, { status: event.target.value as Campaign["status"] }); await reload(); }}
            className={inputClass}
          >
            {Object.entries(campaignStatusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <Button variant="secondary" onClick={() => void reload()}><RefreshCw className="h-4 w-4" />Actualiser</Button>
        </>}
      />
      {error ? <p className="rounded-xl bg-danger-soft p-3 text-danger-on">{error}</p> : null}

      <BriefPanel campaign={data.campaign} onSaved={() => void reload()} />

      <section className="rounded-2xl border border-subtle bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Contenus</h2>
            <p className="text-sm text-muted">Clique sur un contenu pour l&apos;écrire, le valider, puis le planifier.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => void create("texte")}><FileText className="h-4 w-4" />Nouveau texte</Button>
            <Button variant="secondary" disabled={busy} onClick={() => void create("visuel")}><Image className="h-4 w-4" />Nouveau visuel</Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.items.map((item) => {
            const state = contentState(item, data.variants);
            const media = data.assets.filter((asset) => asset.item_id === item.id);
            const failed = data.jobs.filter((job) => job.itemId === item.id && job.status === "failed");
            return (
              <button
                key={item.id}
                onClick={() => setEditingId(item.id)}
                className="rounded-2xl border border-subtle bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-ink">{item.title}</h3>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${STATE_CLASSES[state]}`}>{STATE_LABELS[state]}</span>
                </div>
                {item.content
                  ? <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{item.content}</p>
                  : <p className="mt-2 text-sm italic text-muted">Rien d&apos;écrit pour l&apos;instant.</p>}
                <div className="mt-3 flex flex-wrap items-center gap-1">
                  {item.channels.map((channel) => <span key={channel} className="rounded bg-interactive px-1.5 py-0.5 text-[10px] text-muted">{channelLabel(channel)}</span>)}
                  {media.length ? <span className="flex items-center gap-1 text-[10px] text-muted"><Image className="h-3 w-3" />{media.length}</span> : null}
                </div>
                {item.published_at
                  ? <p className="mt-2 text-xs text-success">Publié le {new Date(item.published_at).toLocaleString("fr-FR")}</p>
                  : item.scheduled_at
                    ? <p className="mt-2 flex items-center gap-1 text-xs text-primary"><CalendarDays className="h-3 w-3" />{new Date(item.scheduled_at).toLocaleString("fr-FR")}</p>
                    : null}
                {failed.map((job) => (
                  <p key={job.id} className="mt-2 rounded-lg bg-danger-soft px-2 py-1 text-[11px] text-danger-on">{channelLabel(job.network)} : {job.lastError}</p>
                ))}
              </button>
            );
          })}
          {!data.items.length ? (
            <div className="rounded-2xl border border-dashed border-strong p-8 text-center text-sm text-muted md:col-span-2 xl:col-span-3">
              <Lightbulb className="mx-auto mb-2 h-8 w-8 text-primary" />Aucun contenu. Commence par un texte ou un visuel.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-primary/30 bg-primary-soft/40 p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"><MessageCircle className="h-5 w-5 text-primary" />Fil de la campagne</h2>
        <p className="mt-1 text-sm text-muted">Les idées, remarques et corrections de l&apos;équipe sur cette campagne.</p>
        <div className="mt-4 space-y-3">
          {data.comments.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-subtle bg-surface p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{entry.author_name || "Équipe"}</p>
                <time className="text-xs text-muted">{new Date(entry.created_at).toLocaleString("fr-FR")}</time>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{entry.body}</p>
            </article>
          ))}
          {!data.comments.length ? (
            <p className="rounded-2xl border border-dashed border-strong bg-surface p-6 text-center text-sm text-muted">Aucun message. Lance la discussion.</p>
          ) : null}
        </div>
        <div className="mt-4 flex gap-2">
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={2} className={`${inputClass} bg-surface`} placeholder="Une idée, une correction…" />
          <Button variant="primary" disabled={busy || !comment.trim()} onClick={() => void send()}><Send className="h-4 w-4" />Envoyer</Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-ink">Médiathèque de la campagne</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.assets.length
            ? data.assets.map((asset) => <AssetTile key={asset.id} asset={asset} />)
            : <div className="rounded-2xl border border-dashed border-strong p-6 text-sm text-muted sm:col-span-2 xl:col-span-4">Les visuels ajoutés aux contenus apparaîtront ici.</div>}
        </div>
      </section>

      {editing ? (
        <CommunicationContentEditor
          campaignId={id}
          item={editing}
          assets={data.assets}
          jobs={data.jobs}
          chantiers={chantiers}
          onClose={() => setEditingId(null)}
          onSaved={() => void reload()}
        />
      ) : null}
    </div>
  );
}
