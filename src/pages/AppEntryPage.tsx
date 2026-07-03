import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Building2, HardHat, LogIn } from "lucide-react";
import { getCurrentUserHomeRoute, type CurrentUserHomeRoute } from "../services/currentUserProfile.service";
import { readStoredIntervenantToken } from "../utils/intervenantSession";

type EntryTarget = CurrentUserHomeRoute | "/intervenant" | "choice";

export default function AppEntryPage() {
  const [target, setTarget] = useState<EntryTarget | null>(null);
  const [hasIntervenantAccess, setHasIntervenantAccess] = useState(false);

  useEffect(() => {
    let alive = true;
    const storedIntervenantToken = Boolean(readStoredIntervenantToken());
    setHasIntervenantAccess(storedIntervenantToken);

    getCurrentUserHomeRoute()
      .then((route) => {
        if (!alive) return;
        if (route !== "/login") {
          setTarget(route);
          return;
        }
        setTarget(storedIntervenantToken ? "/intervenant" : "choice");
      })
      .catch(() => {
        if (!alive) return;
        setTarget(storedIntervenantToken ? "/intervenant" : "choice");
      });

    return () => {
      alive = false;
    };
  }, []);

  if (!target) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 text-sm font-semibold text-slate-500">
        Chargement de Batipro...
      </div>
    );
  }

  if (target !== "choice") return <Navigate to={target} replace />;

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-4xl flex-col justify-center">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-blue-700 text-white">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase text-blue-700">Batipro</div>
            <h1 className="text-2xl font-semibold text-slate-950">Choisir un espace</h1>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Link
            className="group rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.04)] transition hover:border-blue-300 hover:bg-blue-50"
            to="/login"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-blue-700 group-hover:bg-white">
                  <LogIn className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-950">Back-office</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Dirigeant, conducteur de travaux, administration, devis, chantiers, factures et pilotage.
                </p>
              </div>
            </div>
            <div className="mt-5 text-sm font-semibold text-blue-700">Se connecter au back-office</div>
          </Link>

          <Link
            className="group rounded-lg border border-slate-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.04)] transition hover:border-blue-300 hover:bg-blue-50"
            to="/intervenant"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-blue-700 group-hover:bg-white">
                  <HardHat className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold text-slate-950">Portail terrain</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Intervenants et employés : tâches du jour, temps, photos, remarques et signalements chantier.
                </p>
              </div>
            </div>
            <div className="mt-5 text-sm font-semibold text-blue-700">
              {hasIntervenantAccess ? "Reprendre mon accès terrain" : "Saisir mon lien d'accès"}
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}
