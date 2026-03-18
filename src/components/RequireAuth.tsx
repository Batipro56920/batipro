// src/components/RequireAuth.tsx
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useI18n } from "../i18n";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { t } = useI18n();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let alive = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setHasSession(!!data.session);
      setChecking(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="font-semibold">{t("requireAuth.loadingTitle")}</div>
        <div className="text-slate-500 text-sm mt-1">{t("requireAuth.loadingMessage")}</div>
      </div>
    );
  }

  if (!hasSession) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}



