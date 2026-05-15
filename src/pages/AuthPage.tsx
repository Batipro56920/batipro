// src/pages/AuthPage.tsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useI18n } from "../i18n";
import { readStoredIntervenantToken } from "../utils/intervenantSession";
import { getCurrentUserHomeRoute } from "../services/currentUserProfile.service";

function isTransientLoginError(error: unknown): boolean {
  const message = String((error as any)?.message ?? "").toLowerCase();
  return (
    message.includes("load failed") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("fetcherror")
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function shouldPreferDirectAuth(): boolean {
  if (typeof navigator === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const isAppleMobile =
    userAgent.includes("iphone") ||
    userAgent.includes("ipad") ||
    userAgent.includes("ipod") ||
    (userAgent.includes("macintosh") && "ontouchend" in document);
  const isWebKit = userAgent.includes("applewebkit");
  const isOtherIosBrowser =
    userAgent.includes("crios") ||
    userAgent.includes("fxios") ||
    userAgent.includes("edgios") ||
    userAgent.includes("opios");
  return isAppleMobile && isWebKit && !isOtherIosBrowser;
}

type DirectAuthPayload = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: unknown;
  error_description?: string;
  msg?: string;
};

function buildSupabaseAuthUrl(): string {
  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
  return `${baseUrl}/auth/v1/token?grant_type=password`;
}

function buildSupabaseStorageKey(): string {
  const baseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  try {
    const hostname = new URL(baseUrl).hostname;
    return `sb-${hostname.split(".")[0]}-auth-token`;
  } catch {
    return "supabase-auth-token";
  }
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function directPasswordSignIn(email: string, password: string): Promise<DirectAuthPayload> {
  const apikey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
  const url = buildSupabaseAuthUrl();

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.responseType = "text";
    xhr.timeout = 15000;
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("apikey", apikey);
    xhr.setRequestHeader("x-client-info", "batipro-auth-fallback");

    xhr.onload = () => {
      let payload: DirectAuthPayload = {};
      try {
        payload = xhr.responseText ? (JSON.parse(xhr.responseText) as DirectAuthPayload) : {};
      } catch {
        payload = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload);
        return;
      }

      reject(new Error(payload.error_description || payload.msg || `Auth error (${xhr.status})`));
    };

    xhr.onerror = () => reject(new Error("Load failed"));
    xhr.ontimeout = () => reject(new Error("Load failed"));
    xhr.send(JSON.stringify({ email, password }));
  });
}

function isRecoveryUrl(): boolean {
  if (typeof window === "undefined") return false;
  const hash = String(window.location.hash ?? "");
  return hash.includes("type=recovery") || hash.includes("access_token=");
}

async function persistSessionManually(session: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: string;
  user: unknown;
}): Promise<void> {
  const authClient = supabase.auth as any;
  const storageKey = String(authClient.storageKey ?? buildSupabaseStorageKey()).trim() || buildSupabaseStorageKey();
  const storage = authClient.storage ?? getBrowserStorage();
  const userStorage = authClient.userStorage ?? storage;

  if (!storage || typeof storage.setItem !== "function") {
    throw new Error("Stockage de session indisponible.");
  }

  try {
    storage.removeItem?.(`${storageKey}-code-verifier`);
  } catch {
    // Ignore local cleanup errors.
  }

  if (userStorage && typeof userStorage.setItem === "function" && session.user) {
    userStorage.setItem(`${storageKey}-user`, JSON.stringify({ user: session.user }));
    const mainSession = {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      expires_at: session.expires_at,
      token_type: session.token_type,
    };
    storage.setItem(storageKey, JSON.stringify(mainSession));
    return;
  }

  storage.setItem(storageKey, JSON.stringify(session));
}

async function persistDirectSession(payload: DirectAuthPayload): Promise<void> {
  const accessToken = String(payload.access_token ?? "").trim();
  const refreshToken = String(payload.refresh_token ?? "").trim();
  if (!accessToken || !refreshToken) {
    throw new Error("Session de connexion invalide.");
  }

  const expiresIn = Number(payload.expires_in ?? 3600);
  const expiresAt =
    Number(payload.expires_at ?? 0) || Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600);

  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: Number.isFinite(expiresIn) ? expiresIn : 3600,
    expires_at: expiresAt,
    token_type: String(payload.token_type ?? "bearer"),
    user: payload.user ?? null,
  };

  const authClient = supabase.auth as any;
  if (typeof authClient._saveSession === "function") {
    await authClient._saveSession(session);
  } else {
    await persistSessionManually(session);
  }

  if (typeof authClient._notifyAllSubscribers === "function") {
    await authClient._notifyAllSubscribers("SIGNED_IN", session);
  }
}

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  const [mode, setMode] = useState<"login" | "signup" | "forgot" | "reset">(() =>
    isRecoveryUrl() ? "reset" : "login",
  );
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (readStoredIntervenantToken()) {
      navigate("/intervenant", { replace: true });
      return;
    }

    const authError = String((location.state as any)?.authError ?? "").trim();
    if (authError) {
      setMsg(authError);
    }

    // Si déjà connecté ? on renvoie vers l'app
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session && !isRecoveryUrl()) {
        const nextRoute = await getCurrentUserHomeRoute();
        navigate(nextRoute, { replace: true });
      }
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("reset");
        setMsg(null);
      }
    });

    return () => {
      authSub.subscription.unsubscribe();
    };
  }, [location.state, navigate]);

  function buildPasswordResetRedirectUrl(): string {
    const configured = String(import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
    if (configured) return `${configured}/login`;
    if (typeof window !== "undefined") {
      return `${window.location.origin.replace(/\/+$/, "")}/login`;
    }
    return "/login";
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      if (!email.trim() || !password) {
        setMsg(t("auth.emailRequired"));
        return;
      }

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setMsg(t("auth.signupSuccess"));
        setMode("login");
        return;
      }

      if (mode === "forgot") {
        if (!email.trim()) {
          setMsg(t("auth.emailRequired"));
          return;
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: buildPasswordResetRedirectUrl(),
        });
        if (error) throw error;
        setMsg(t("auth.resetRequestSuccess"));
        return;
      }

      if (mode === "reset") {
        if (!resetPassword.trim()) {
          setMsg(t("auth.resetPasswordRequired"));
          return;
        }

        const { error } = await supabase.auth.updateUser({
          password: resetPassword,
        });
        if (error) throw error;

        setResetPassword("");
        setPassword("");
        setMode("login");
        setMsg(t("auth.resetPasswordSuccess"));
        return;
      }

      const credentials = {
        email: email.trim(),
        password,
      };

      if (shouldPreferDirectAuth()) {
        const payload = await directPasswordSignIn(credentials.email, credentials.password);
        await persistDirectSession(payload);
      } else {
        let signInResult = await supabase.auth.signInWithPassword(credentials);
        if (signInResult.error && isTransientLoginError(signInResult.error)) {
          await wait(400);
          signInResult = await supabase.auth.signInWithPassword(credentials);
        }
        if (signInResult.error && isTransientLoginError(signInResult.error)) {
          const payload = await directPasswordSignIn(credentials.email, credentials.password);
          await persistDirectSession(payload);
        } else if (signInResult.error) {
          throw signInResult.error;
        }
      }

      // Si tu avais une redirection initiale
      const requestedPath = (location.state as any)?.from?.pathname;
      const defaultRoute = await getCurrentUserHomeRoute();
      const from = defaultRoute === "/dashboard" && requestedPath ? requestedPath : defaultRoute;
      navigate(from, { replace: true });
    } catch (err: any) {
      setMsg(
        isTransientLoginError(err)
          ? "Connexion au serveur impossible pour le moment. Recharge la page puis reessaie."
          : err?.message ?? t("auth.error"),
      );
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
            {mode === "login"
              ? t("auth.loginTitle")
              : mode === "signup"
                ? t("auth.signupTitle")
                : mode === "forgot"
                  ? t("auth.forgotTitle")
                  : t("auth.resetTitle")}
          </div>
        </div>

        {msg && (
          <div className="rounded-xl border bg-slate-50 p-3 text-sm text-slate-700">
            {msg}
          </div>
        )}

        <form className="space-y-3" onSubmit={onSubmit}>
          {mode !== "reset" && (
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder={t("common.labels.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
            />
          )}
          {(mode === "login" || mode === "signup") && (
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder={t("auth.passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          )}
          {mode === "reset" && (
            <input
              className="w-full rounded-xl border px-3 py-2 text-sm"
              placeholder={t("auth.resetPasswordPlaceholder")}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
            />
          )}

          <button
            type="submit"
            disabled={loading}
            className={[
              "w-full rounded-xl px-4 py-2 text-sm transition",
              loading ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
            ].join(" ")}
          >
            {loading
              ? "…"
              : mode === "login"
                ? t("auth.submitLogin")
                : mode === "signup"
                  ? t("auth.submitSignup")
                  : mode === "forgot"
                    ? t("auth.submitForgot")
                    : t("auth.submitReset")}
          </button>
        </form>

        <div className="text-sm text-slate-600">
          {mode === "login" ? (
            <>
              <button
                className="underline hover:text-slate-900"
                onClick={() => setMode("signup")}
                type="button"
              >
                {t("auth.goToSignup")}
              </button>
              <span className="mx-2 text-slate-300">•</span>
              <button
                className="underline hover:text-slate-900"
                onClick={() => setMode("forgot")}
                type="button"
              >
                {t("auth.goToForgot")}
              </button>
            </>
          ) : mode === "reset" ? null : (
            <button
              className="underline hover:text-slate-900"
              onClick={() => setMode("login")}
              type="button"
            >
              {t("auth.goToLogin")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}



