import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, Image as ImageIcon, Loader2, Send, Trash2, Upload, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import {
  deleteItem,
  listPublicationVariants,
  reopenItem,
  saveItemVariants,
  scheduleItem,
  updateItem,
  uploadAssets,
  validateItem,
} from "./communicationRepository";
import { COMPOSER_NETWORKS, channelLabel, channelLimit, normalizeChannels } from "./networks";
import type { CampaignAsset, CampaignItem, ChantierOption, PublishJob } from "./types";

const inputClass = "w-full rounded-xl border border-subtle bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-primary";

function localDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/**
 * L'atelier d'un contenu.
 *
 * Le tableau ne permettait que de créer une carte puis de la faire glisser : le
 * texte, les réseaux et les médias n'étaient modifiables nulle part. Tout se
 * travaille ici, et le parcours suit l'ordre réel du métier : écrire, valider,
 * puis seulement planifier.
 */
export function CommunicationContentEditor({
  campaignId,
  item,
  assets,
  jobs,
  chantiers,
  onClose,
  onSaved,
}: {
  campaignId: string;
  item: CampaignItem;
  assets: CampaignAsset[];
  jobs: PublishJob[];
  chantiers: ChantierOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content ?? "");
  const [networks, setNetworks] = useState<string[]>(normalizeChannels(item.channels));
  const [chantierId, setChantierId] = useState(item.chantier_id ?? "");
  const [scheduledAt, setScheduledAt] = useState(localDateTime(item.scheduled_at));
  const [files, setFiles] = useState<File[]>([]);
  const [approved, setApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const published = item.status === "published";
  const planned = item.status === "scheduled";

  const readVariants = useCallback(async () => {
    try {
      const variants = await listPublicationVariants(item.id);
      setApproved(variants.length > 0 && variants.every((variant) => variant.approval_status === "approved"));
    } catch {
      setApproved(false);
    } finally {
      setLoading(false);
    }
  }, [item.id]);

  useEffect(() => { void readVariants(); }, [readVariants]);

  function toggleNetwork(network: string) {
    setNetworks((current) => (current.includes(network) ? current.filter((entry) => entry !== network) : [...current, network]));
  }

  const tooLong = networks
    .map((network) => ({ network, limit: channelLimit(network) }))
    .filter((entry) => entry.limit !== null && content.trim().length > entry.limit);

  async function save(): Promise<boolean> {
    if (!title.trim()) { setError("Donne un titre à ce contenu."); return false; }
    if (tooLong.length) {
      setError(tooLong.map((entry) => `${channelLabel(entry.network)} : ${content.trim().length} caractères pour ${entry.limit} autorisés.`).join(" "));
      return false;
    }
    setError(""); setMessage("");
    await updateItem(item.id, { title: title.trim(), content: content.trim(), chantier_id: chantierId || null });
    await saveItemVariants(item.id, networks, content.trim());
    if (files.length) { await uploadAssets(campaignId, item.id, files); setFiles([]); }
    await readVariants();
    return true;
  }

  async function run(action: () => Promise<void>, done: string) {
    setBusy(true); setError(""); setMessage("");
    try {
      await action();
      setMessage(done);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action impossible.");
    } finally {
      setBusy(false);
    }
  }

  const itemAssets = assets.filter((asset) => asset.item_id === item.id);
  const itemJobs = jobs.filter((job) => job.itemId === item.id);

  return (
    <div className="fixed inset-0 z-[80] flex justify-end bg-black/35" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="flex h-full w-full max-w-2xl flex-col bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-subtle px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {published ? "Publié" : planned ? "Planifié" : approved ? "Validé" : "En préparation"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{title || "Nouveau contenu"}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-interactive" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <label className="block text-sm font-medium text-ink">
            Titre interne
            <input value={title} onChange={(event) => setTitle(event.target.value)} className={`${inputClass} mt-1`} placeholder="Ex. Avant / après dallage parking" />
          </label>

          <label className="block text-sm font-medium text-ink">
            Texte de la publication
            <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={10} className={`${inputClass} mt-1`} placeholder="L'histoire du chantier, le résultat obtenu, l'appel à l'action…" />
            <span className="mt-1 block text-xs text-muted">{content.trim().length} caractères</span>
          </label>

          <fieldset>
            <legend className="text-sm font-medium text-ink">Réseaux</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {COMPOSER_NETWORKS.map((network) => {
                const selected = networks.includes(network.id);
                return (
                  <button
                    key={network.id}
                    type="button"
                    onClick={() => toggleNetwork(network.id)}
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm ${selected ? "border-primary bg-primary-soft text-primary-on" : "border-subtle text-muted"}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${network.dot}`} />
                    {network.label}
                    {selected ? <Check className="h-3.5 w-3.5" /> : null}
                  </button>
                );
              })}
            </div>
            {tooLong.length ? (
              <p className="mt-2 text-xs font-semibold text-danger">
                Texte trop long pour {tooLong.map((entry) => channelLabel(entry.network)).join(", ")}.
              </p>
            ) : null}
          </fieldset>

          <label className="block text-sm font-medium text-ink">
            Chantier mis en avant
            <select value={chantierId} onChange={(event) => setChantierId(event.target.value)} className={`${inputClass} mt-1`}>
              <option value="">Aucun chantier</option>
              {chantiers.map((chantier) => (
                <option key={chantier.id} value={chantier.id}>{chantier.nom}{chantier.client ? ` — ${chantier.client}` : ""}</option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-sm font-medium text-ink">Visuels</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {itemAssets.map((asset) => (
                <a key={asset.id} href={asset.signed_url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-subtle">
                  {asset.mime_type?.startsWith("image/") && asset.signed_url
                    ? <img src={asset.signed_url} alt={asset.file_name} className="h-20 w-28 object-cover" />
                    : <span className="flex h-20 w-28 items-center justify-center bg-interactive"><ImageIcon className="h-5 w-5 text-primary" /></span>}
                </a>
              ))}
              <label className="flex h-20 w-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-strong text-xs text-muted hover:border-primary">
                <Upload className="h-4 w-4 text-primary" />
                {files.length ? `${files.length} à envoyer` : "Ajouter"}
                <input type="file" multiple accept="image/*,video/*,application/pdf" className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
              </label>
            </div>
          </div>

          {itemJobs.length ? (
            <div className="space-y-1 rounded-xl bg-interactive p-3 text-xs">
              {itemJobs.map((job) => (
                <p key={job.id} className={job.status === "failed" ? "font-semibold text-danger-on" : "text-muted"}>
                  {channelLabel(job.network)} · {job.status === "failed" ? job.lastError : job.status === "published" ? "diffusée" : "en attente de diffusion"}
                </p>
              ))}
            </div>
          ) : null}

          {error ? <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger-on">{error}</p> : null}
          {message ? <p className="rounded-xl bg-success-soft p-3 text-sm text-success">{message}</p> : null}
        </div>

        <footer className="space-y-3 border-t border-subtle px-5 py-4">
          {approved && !published ? (
            <div className="flex flex-wrap items-end gap-2 rounded-xl bg-primary-soft p-3">
              <label className="flex-1 text-sm font-medium text-ink">
                <span className="flex items-center gap-2"><CalendarClock className="h-4 w-4" />Date de publication</span>
                <input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className={`${inputClass} mt-1`} />
              </label>
              <Button variant="primary" disabled={busy || !scheduledAt} onClick={() => void run(() => scheduleItem(item.id, scheduledAt), planned ? "Date mise à jour." : "Contenu planifié.")}>
                <Send className="h-4 w-4" />{planned ? "Replanifier" : "Planifier"}
              </Button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => { if (window.confirm("Supprimer ce contenu ?")) void run(async () => { await deleteItem(item.id); onClose(); }, "Contenu supprimé."); }}
              className="flex items-center gap-1 text-sm text-muted hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />Supprimer
            </button>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={busy || published} onClick={() => void run(async () => { await save(); }, "Enregistré.")}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Enregistrer
              </Button>
              {approved ? (
                <Button variant="secondary" disabled={busy || published} onClick={() => void run(() => reopenItem(item.id), "Contenu remis en préparation.")}>
                  Revenir en préparation
                </Button>
              ) : (
                <Button variant="success" disabled={busy || loading || published} onClick={() => void run(async () => { if (await save()) await validateItem(item.id); }, "Contenu validé. Tu peux le planifier.")}>
                  <Check className="h-4 w-4" />Valider
                </Button>
              )}
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}
