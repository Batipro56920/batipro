import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
  /** Chaine des composants React au moment de la casse. */
  componentStack: string | null;
  /** Vrai quand l'onglet tourne sur une version remplacee depuis. */
  staleBuild: boolean;
};

/** Marqueur de rechargement, pour ne pas boucler si le fichier manque vraiment. */
const RELOAD_MARK = "batipro:rechargement-version";
const RELOAD_GUARD_MS = 30000;

/**
 * Un onglet ouvert garde en memoire les noms de fichiers de la version qu'il a
 * chargee. Des qu'un nouveau deploiement passe, ces fichiers n'existent plus sur
 * le serveur : la premiere navigation vers un ecran pas encore charge echoue
 * avec "Failed to fetch dynamically imported module". Rien n'est casse, l'onglet
 * est simplement perime — on le recharge donc au lieu d'afficher une erreur que
 * l'utilisateur ne peut pas comprendre.
 */
function isStaleBuildError(error: Error | null): boolean {
  const message = String(error?.message ?? "").toLowerCase();
  const name = String(error?.name ?? "").toLowerCase();
  return (
    name === "chunkloaderror" ||
    message.includes("failed to fetch dynamically imported module") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("importing a module script failed") ||
    message.includes("unable to preload css")
  );
}

function reloadedRecently(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_MARK) ?? 0);
    return Number.isFinite(last) && Date.now() - last < RELOAD_GUARD_MS;
  } catch {
    return false;
  }
}

function markReload(): void {
  try {
    window.sessionStorage.setItem(RELOAD_MARK, String(Date.now()));
  } catch {
    // Navigation privee ou stockage refuse : on rechargera une fois de trop, pas grave.
  }
}

export default class LazyRouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, staleBuild: false };

  static getDerivedStateFromError(error: Error): State {
    return { error, componentStack: null, staleBuild: isStaleBuildError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error("Lazy route failed", error, info);
    // Une seule tentative : si le fichier manque encore apres rechargement,
    // c'est un vrai probleme et on laisse l'ecran d'erreur le dire.
    if (isStaleBuildError(error) && !reloadedRecently()) {
      markReload();
      window.location.reload();
    }
  }

  private detail(): string {
    const { error, componentStack } = this.state;
    return [error?.message ?? "", error?.stack ?? "", componentStack ?? ""].filter(Boolean).join("\n\n");
  }

  render() {
    const { error, componentStack, staleBuild } = this.state;
    if (!error) return this.props.children;

    if (staleBuild && !reloadedRecently()) {
      return (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-6 text-sm text-blue-800">
          <div className="font-semibold">Nouvelle version de Batipro.</div>
          <div className="mt-2">Rechargement en cours...</div>
        </div>
      );
    }

    const frames = (componentStack ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("at "))
      .slice(0, 4);

    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        <div className="font-semibold">Impossible de charger cet espace.</div>
        <div className="mt-2 text-red-600">{error.message}</div>
        {staleBuild ? (
          <div className="mt-2 text-red-600">
            Cet onglet tournait sur une version remplacée depuis. Si le rechargement ne suffit pas, ferme l&apos;onglet
            et rouvre Batipro.
          </div>
        ) : null}
        {frames.length ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-white p-3 font-mono text-xs leading-5 text-red-700">
            {frames.map((frame, index) => (
              <div key={index}>{frame}</div>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm"
            onClick={() => window.location.reload()}
          >
            Recharger la page
          </button>
          <button
            className="rounded-xl border border-red-200 bg-white px-3 py-2 text-sm"
            onClick={() => void navigator.clipboard?.writeText(this.detail())}
          >
            Copier le détail
          </button>
        </div>
      </div>
    );
  }
}
