import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BriefcaseBusiness, FileText, RotateCcw } from "lucide-react";
import { Button } from "../../../components/ui/button";

type DashboardHeaderProps = {
  /** Nom d'affichage du profil connecte ; null tant qu'il n'est pas charge. */
  userName: string | null;
  locale: string;
  /** Un filtre ou un tri est actif : l'ecran ne montre pas tout. */
  isFiltered: boolean;
  onReset: () => void;
};

function greeting(hour: number): string {
  if (hour < 6) return "Bonne nuit";
  if (hour < 18) return "Bonjour";
  return "Bonsoir";
}

/**
 * Niveau 0 : une ligne de contexte et une barre d'actions.
 * La salutation ne consomme plus le premier niveau typographique — il revient au verdict.
 */
export function DashboardHeader({ userName, locale, isFiltered, onReset }: DashboardHeaderProps) {
  const now = useMemo(() => new Date(), []);

  const dateLabel = useMemo(() => {
    const formatted = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [locale, now]);

  const hello = userName ? `${greeting(now.getHours())} ${userName}` : greeting(now.getHours());

  return (
    <header className="space-y-3">
      <p className="bt-caption min-w-0 truncate text-muted">
        {dateLabel} <span aria-hidden>·</span> {hello}
      </p>

      <div className="flex items-center gap-2">
        {/* Une seule reinitialisation pour toute la page : l'etat vit dans l'URL,
            jamais en localStorage, pour eviter l'ecran filtre fantome. */}
        {isFiltered ? (
          <Button variant="ghost" size="md" onClick={onReset} className="shrink-0">
            <RotateCcw className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Réinitialiser</span>
          </Button>
        ) : null}
        <Link to="/projets" className="flex-1 sm:flex-none">
          <Button variant="primary" size="md" className="w-full">
            <FileText className="h-4 w-4" strokeWidth={1.75} />
            Créer devis
          </Button>
        </Link>
        <Link to="/chantiers/nouveau" className="flex-1 sm:flex-none">
          <Button variant="secondary" size="md" className="w-full">
            <BriefcaseBusiness className="h-4 w-4" strokeWidth={1.75} />
            Nouveau chantier
          </Button>
        </Link>
      </div>
    </header>
  );
}
