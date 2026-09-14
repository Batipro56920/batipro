import { ExternalLink, Sparkles, Video } from "lucide-react";
import { CANVA_SOCIAL_MEDIA_URL, CAPCUT_EDITOR_URL } from "./externalStudios";

/**
 * Les ateliers de creation, la ou on ecrit une publication.
 *
 * Ils n'existaient que dans l'onglet "Creer". Une publication ecrite depuis une
 * campagne — le chemin normal quand on travaille par campagne — envoyait donc
 * chercher Canva ailleurs, alors que c'est exactement le moment ou il faut le
 * visuel. Une seule definition ici, affichee aux deux endroits.
 */
export function CreativeStudioLinks({ hint }: { hint?: string }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-xl bg-interactive p-3">
      <a
        href={CANVA_SOCIAL_MEDIA_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-subtle bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-primary"
      >
        <Sparkles className="h-4 w-4 text-primary" />
        Créer un visuel dans Canva
        <ExternalLink className="h-3 w-3 text-muted" />
      </a>
      <a
        href={CAPCUT_EDITOR_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-2 rounded-lg border border-subtle bg-surface px-3 py-2 text-sm font-medium text-ink hover:border-primary"
      >
        <Video className="h-4 w-4 text-primary" />
        Monter une vidéo dans CapCut
        <ExternalLink className="h-3 w-3 text-muted" />
      </a>
      {hint ? <span className="self-center text-xs text-muted">{hint}</span> : null}
    </div>
  );
}
