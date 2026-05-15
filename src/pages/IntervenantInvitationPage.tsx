import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import {
  previewIntervenantInvitation,
  redeemIntervenantInvitation,
  type IntervenantInvitationPreview,
} from "../services/intervenants.service";

export default function IntervenantInvitationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => String(searchParams.get("token") ?? "").trim(), [searchParams]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<IntervenantInvitationPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadPreview() {
      if (!token) {
        setError("Lien d'invitation invalide.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const invitation = await previewIntervenantInvitation(token);
        if (!alive) return;
        setPreview(invitation);
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message ?? "Impossible de charger l'invitation.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    void loadPreview();
    return () => {
      alive = false;
    };
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!preview) return;

    if (!password || password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await redeemIntervenantInvitation({ token, password });
      await supabase.auth.signOut();
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: preview.email,
        password,
      });
      if (loginError) throw loginError;
      navigate("/intervenant", { replace: true });
    } catch (err: any) {
      setError(err?.message ?? "Impossible de finaliser le compte intervenant.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-xl p-6 text-sm text-slate-500">Chargement de l'invitation...</div>;
  }

  return (
    <div className="min-h-[100dvh] bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl rounded-3xl border bg-white p-6 shadow-sm">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Invitation intervenant</div>
          <h1 className="text-2xl font-semibold text-slate-900">Finaliser le compte intervenant</h1>
          <p className="text-sm text-slate-500">
            Ce lien sert uniquement a confirmer l'adresse email et creer le mot de passe du compte.
          </p>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        {preview ? (
          <>
            <div className="mt-5 rounded-2xl border bg-slate-50 p-4 text-sm">
              <div className="font-medium text-slate-900">{preview.intervenant.nom ?? "Intervenant"}</div>
              <div className="mt-1 text-slate-600">{preview.email}</div>
              <div className="mt-2 text-slate-500">
                {preview.intervenant.entreprise || "Entreprise non renseignee"}
                {preview.intervenant.metier ? ` • ${preview.intervenant.metier}` : ""}
              </div>
            </div>

            {preview.alreadyLinked ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Un compte utilisateur est deja rattache a cette fiche intervenant.
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/login", { replace: true })}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800"
                >
                  Aller a la connexion
                </button>
              </div>
            ) : (
              <form className="mt-5 space-y-4" onSubmit={onSubmit}>
                <label className="block space-y-1 text-sm">
                  <div className="text-slate-600">Mot de passe</div>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="w-full rounded-xl border px-3 py-2"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Au moins 8 caracteres"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <div className="text-slate-600">Confirmer le mot de passe</div>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="w-full rounded-xl border px-3 py-2"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Retape le mot de passe"
                  />
                </label>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? "Creation du compte..." : "Creer le compte intervenant"}
                </button>
              </form>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
