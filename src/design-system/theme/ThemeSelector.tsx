import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-context";
import type { ThemeMode } from "./theme-context";

const OPTIONS: { mode: ThemeMode; label: string; icon: typeof Sun }[] = [
  { mode: "light", label: "Clair", icon: Sun },
  { mode: "dark", label: "Sombre", icon: Moon },
  { mode: "system", label: "Système", icon: Monitor },
];

/**
 * Segmented control Light / Dark / System.
 * Boutons `aria-pressed` plutot que `role="radio"` : la navigation clavier reste
 * la tabulation standard, sans avoir a implementer un roving tabindex.
 * Le libelle reste accessible aux lecteurs d'ecran quand seule l'icone est visible.
 */
export function ThemeSelector({ className = "" }: { className?: string }) {
  const { mode, setMode } = useTheme();

  return (
    <div role="group" aria-label="Thème de l'interface" className={`inline-flex items-center gap-0.5 rounded-[10px] bg-interactive p-[3px] ${className}`}>
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = mode === option.mode;

        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={active}
            title={option.label}
            onClick={() => setMode(option.mode)}
            className={[
              "bt-tap inline-flex items-center justify-center rounded-lg px-2 text-[13px] font-medium transition-colors duration-[120ms]",
              active
                ? "bg-surface text-ink shadow-[0_1px_2px_rgb(11_18_32/0.08)] dark:bg-elevated dark:shadow-none dark:ring-1 dark:ring-subtle"
                : "text-muted hover:text-ink",
            ].join(" ")}
          >
            <Icon className="h-4 w-4" strokeWidth={1.75} />
            <span className="sr-only">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
