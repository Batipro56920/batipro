import { useMemo } from "react";
import { Link } from "react-router-dom";
import { BriefcaseBusiness, FileText } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { ThemeSelector } from "../../../design-system/theme/ThemeSelector";

type DashboardHeaderProps = {
  /** Nom d'affichage du profil connecte ; null tant qu'il n'est pas charge. */
  userName: string | null;
  locale: string;
};

function greeting(hour: number): string {
  if (hour < 6) return "Bonne nuit";
  if (hour < 18) return "Bonjour";
  return "Bonsoir";
}

/**
 * Niveau 0 : une ligne de contexte et une barre d'actions.
 * La salutation ne consomme plus le premier niveau typographique — il revient au verdict.
 * Le selecteur de theme est une preference, pas une action : il vit sur la ligne de contexte.
 */
export function DashboardHeader({ userName, locale }: DashboardHeaderProps) {
  const now = useMemo(() => new Date(), []);

  const dateLabel = useMemo(() => {
    const formatted = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }, [locale, now]);

  const hello = userName ? `${greeting(now.getHours())} ${userName}` : greeting(now.getHours());

  return (
    <header className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="bt-caption min-w-0 truncate text-muted">
          {dateLabel} <span aria-hidden>·</span> {hello}
        </p>
        <ThemeSelector className="shrink-0" />
      </div>

      <div className="flex items-center gap-2">
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
