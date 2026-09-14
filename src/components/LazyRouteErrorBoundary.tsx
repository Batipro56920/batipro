import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
  /** Chaine des composants React au moment de la casse. */
  componentStack: string | null;
};

/**
 * Un ecran blanc avec "Impossible de charger cet espace" et un message technique
 * ne dit ni ou ni pourquoi. On affiche donc aussi les premiers composants de la
 * pile : c'est ce qui permet de nommer le coupable sans avoir a reproduire.
 */
export default class LazyRouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, componentStack: null };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error("Lazy route failed", error, info);
  }

  private detail(): string {
    const { error, componentStack } = this.state;
    return [
      error?.message ?? "",
      error?.stack ?? "",
      componentStack ?? "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  render() {
    const { error, componentStack } = this.state;
    if (error) {
      const frames = (componentStack ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("at "))
        .slice(0, 4);

      return (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <div className="font-semibold">Impossible de charger cet espace.</div>
          <div className="mt-2 text-red-600">{error.message}</div>
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

    return this.props.children;
  }
}
