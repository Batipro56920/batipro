// src/pages/AuthPage.tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // Si déjà connecté → on renvoie vers l'app
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate("/dashboard", { replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      if (!email.trim() || !password) {
        setMsg("Email et mot de passe requis.");
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setMsg("Compte créé. Tu peux te connecter.");
        setMode("login");
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      // Si tu avais une redirection initiale
      const from = (location.state as any)?.from?.pathname ?? "/dashboard";
      navigate(from, { replace: true });
    } catch (err: any) {
      setMsg(err?.message ?? "Erreur authentification.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[100dvh] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-6 space-y-4">
        <div className="space-y-1">
          <div className="text-2xl font-bold">Batipro</div>
          <div className="text-slate-500 text-sm">
            {mode === "login" ? "Connexion" : "Création de compte"}
          </div>
        </div>

        {msg && (
          <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
            {msg}
          </div>
        )}

        <form className="space-y-3" onSubmit={onSubmit}>
          <input
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
          />
          <input
            className="w-full rounded-xl border px-3 py-2 text-sm"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          <button
            type="submit"
            disabled={loading}
            className={[
              "w-full rounded-xl px-4 py-2 text-sm transition",
              loading ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
            ].join(" ")}
          >
            {loading ? "…" : mode === "login" ? "Se connecter" : "Créer le compte"}
          </button>
        </form>

        <div className="text-sm text-slate-600">
          {mode === "login" ? (
            <button
              className="underline hover:text-slate-900"
              onClick={() => setMode("signup")}
              type="button"
            >
              Créer un compte
            </button>
          ) : (
            <button
              className="underline hover:text-slate-900"
              onClick={() => setMode("login")}
              type="button"
            >
              J’ai déjà un compte
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
