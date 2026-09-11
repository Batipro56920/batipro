import { BarChart3, CalendarDays, CheckCircle2, Image, Inbox, Link2, Megaphone, MessageSquareText, Radio, Send, Sparkles } from "lucide-react";

type Props = { onNavigate: (view: string) => void };

/**
 * Les trois espaces qui contiennent le travail, avant les outils qui l'ouvrent.
 *
 * Les compteurs qui occupaient cette place ne servaient à rien : quatre grands
 * chiffres, dont une alerte toujours à zéro, pour une information qu'on relit
 * dans chaque écran concerné.
 */
const SHORTCUTS = [
  ["Campagnes", Megaphone, "campagnes"],
  ["Planning", CalendarDays, "calendrier"],
  ["Médiathèque", Image, "mediatheque"],
] as const;

const MODULES = [
  ["Créer", "Rédiger et décliner une publication pour chaque réseau.", Sparkles, "composer"],
  ["Validations", "Relire, corriger puis approuver.", CheckCircle2, "validations"],
  ["Planning", "Programmer et déplacer les publications.", Send, "calendrier"],
  ["Boîte de réception", "Messages, commentaires, mentions et avis.", Inbox, "inbox"],
  ["Statistiques", "Portée, engagement, clics et leads.", BarChart3, "statistiques"],
  ["Veille", "Marque, concurrents, tendances et réputation.", Radio, "veille"],
  ["Connexions", "Facebook, Instagram, LinkedIn, Google, TikTok et YouTube.", Link2, "connexions"],
] as const;

export function CommunicationOverview({ onNavigate }: Props) {
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3">
        {SHORTCUTS.map(([label, Icon, view]) => (
          <button
            key={view}
            onClick={() => onNavigate(view)}
            className="flex items-center gap-3 rounded-2xl border border-subtle bg-surface p-4 text-left shadow-sm transition hover:border-primary"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-interactive">
              <Icon className="h-5 w-5 text-primary" />
            </span>
            <span className="text-base font-semibold text-ink">{label}</span>
          </button>
        ))}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-ink">Piloter la communication</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {MODULES.map(([title, description, Icon, view]) => (
            <button
              key={title}
              onClick={() => onNavigate(view)}
              className="group rounded-2xl border border-subtle bg-surface p-5 text-left shadow-sm transition hover:border-primary"
            >
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-semibold text-ink">{title}</h3>
              <p className="mt-1 text-sm text-muted">{description}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-subtle bg-surface p-5">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-ink">Échanges sur les contenus</h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          Les demandes de validation, commentaires et corrections sont centralisés ici, sans mélanger les échanges avec
          le fil chantier.
        </p>
      </section>
    </div>
  );
}
