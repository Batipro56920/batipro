import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export default class LazyRouteErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Lazy route failed", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <div className="font-semibold">Impossible de charger cet espace.</div>
          <div className="mt-2 text-red-600">{this.state.error.message}</div>
          <button className="mt-4 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm" onClick={() => window.location.reload()}>
            Recharger la page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
