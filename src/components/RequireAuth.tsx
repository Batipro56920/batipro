// src/components/RequireAuth.tsx
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { getCurrentUserProfile, hasLinkedIntervenantAccount, isBackofficeProfile, isIntervenantProfile } from "../services/currentUserProfile.service";
import { useI18n } from "../i18n";
import { readStoredIntervenantToken } from "../utils/intervenantSession";

type AuthGateState = {
  checking: boolean;
  allowed: boolean;
  redirectTo: "/login" | "/intervenant";
  denied: boolean;
};

function isTransientAuthNetworkError(error: unknown): boolean {
  const message = String((error as any)?.message ?? "").toLowerCase();
  return (
    message.includes("load failed") ||
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("fetcherror")
  );
}

export default function RequireAuth({ children, allow = "backoffice" }: { children: ReactNode; allow?: "backoffice" | "intervenant" }) {
  const location = useLocation();
  const { t } = useI18n();
  const [gateState, setGateState] = useState<AuthGateState>({
    checking: true,
    allowed: false,
    redirectTo: "/login",
    denied: false,
  });

  useEffect(() => {
    let alive = true;

    async function verifyAdminAccess(sessionExists: boolean) {
      if (!alive) return;

      if (!sessionExists) {
        setGateState({
          checking: false,
          allowed: false,
          redirectTo: readStoredIntervenantToken() ? "/intervenant" : "/login",
          denied: false,
        });
        return;
      }

      try {
        const profile = await getCurrentUserProfile();
        if (!alive) return;

        if (isBackofficeProfile(profile)) {
          setGateState({
            checking: false,
            allowed: true,
            redirectTo: "/login",
            denied: false,
          });
          return;
        }

        if (
          allow === "intervenant" &&
          (isIntervenantProfile(profile) || (profile?.id ? await hasLinkedIntervenantAccount(profile.id) : false))
        ) {
          if (!alive) return;
          setGateState({
            checking: false,
            allowed: true,
            redirectTo: "/login",
            denied: false,
          });
          return;
        }

        await supabase.auth.signOut();
        if (!alive) return;

        setGateState({
          checking: false,
          allowed: false,
          redirectTo: readStoredIntervenantToken() ? "/intervenant" : "/login",
          denied: true,
        });
      } catch (error) {
        if (!alive) return;

        if (sessionExists && isTransientAuthNetworkError(error)) {
          setGateState({
            checking: false,
            allowed: true,
            redirectTo: "/login",
            denied: false,
          });
          return;
        }

        await supabase.auth.signOut();
        if (!alive) return;
        setGateState({
          checking: false,
          allowed: false,
          redirectTo: "/login",
          denied: true,
        });
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      void verifyAdminAccess(!!data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      void verifyAdminAccess(!!session);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [allow]);

  if (gateState.checking) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="font-semibold">{t("requireAuth.loadingTitle")}</div>
        <div className="text-slate-500 text-sm mt-1">{t("requireAuth.loadingMessage")}</div>
      </div>
    );
  }

  if (!gateState.allowed) {
    return (
      <Navigate
        to={gateState.redirectTo}
        replace
        state={
          gateState.redirectTo === "/login"
            ? {
                from: location,
                authError: gateState.denied
                  ? "Accès refusé : ce compte n'a pas accès à l'espace bureau."
                  : undefined,
              }
            : undefined
        }
      />
    );
  }

  return children;
}



