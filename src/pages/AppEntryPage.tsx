import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Building2, LogIn } from "lucide-react";
import { getCurrentUserHomeRoute, type CurrentUserHomeRoute } from "../services/currentUserProfile.service";

type EntryTarget = CurrentUserHomeRoute | "login";

export default function AppEntryPage() {
  const [target, setTarget] = useState<EntryTarget | null>(null);

  useEffect(() => {
    let alive = true;
    getCurrentUserHomeRoute()
      .then((route) => {
        if (!alive) return;
        setTarget(route === "/login" ? "login" : route);
      })
      .catch(() => {
        if (alive) setTarget("login");
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!target) {
    return <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 text-sm font-semibold text-slate-500">Chargement de Batipro...</div>;
  }

  if (target !== "login") return <Navigate to={target} replace />;

  return (
    <main className="min-h-dvh bg-slate-50 px-4 py-8 text-slate-950">
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-700 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Batipro</div>
          <h1 className="mt-2 text-2xl font-semibold">Connexion</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Un seul accès Batipro. Après connexion, vous êtes automatiquement dirigé vers votre espace selon votre profil.
          </p>
          <Link to="/login" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">
            <LogIn className="h-4 w-4" />
            Se connecter
          </Link>
          <p className="mt-4 text-center text-xs leading-5 text-slate-500">
            Intervenant : utilisez l'adresse e-mail et le mot de passe transmis par votre responsable.
          </p>
        </div>
      </section>
    </main>
  );
}
