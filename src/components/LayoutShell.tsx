// src/components/LayoutShell.tsx
import { useEffect, useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { supabase } from "../lib/supabaseClient";

export default function LayoutShell() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let alive = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      setEmail(data.user?.email ?? null);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      navigate("/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900 max-w-[100vw] overflow-x-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex min-h-[100dvh] max-w-[100vw] overflow-x-hidden">
        {/* Sidebar */}
        <aside className="w-72 flex-shrink-0 border-r bg-white">
          <Sidebar />
        </aside>

        {/* Contenu */}
        <main className="flex-1 min-w-0">
          <header className="h-14 border-b bg-white flex items-center justify-between px-4">
            <span className="font-semibold">Batipro</span>

            <div className="flex items-center gap-3">
              {email ? (
                <span className="text-sm text-slate-500 truncate max-w-[240px]">
                  {email}
                </span>
              ) : (
                <span className="text-sm text-slate-400">—</span>
              )}

              <button
                type="button"
                onClick={logout}
                disabled={signingOut}
                className={[
                  "rounded-xl border px-3 py-2 text-sm transition",
                  signingOut
                    ? "bg-slate-100 text-slate-500 border-slate-200"
                    : "bg-white hover:bg-slate-50 border-slate-200",
                ].join(" ")}
              >
                {signingOut ? "Déconnexion…" : "Se déconnecter"}
              </button>
            </div>
          </header>

          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
