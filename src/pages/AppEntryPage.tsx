import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getCurrentUserHomeRoute } from "../services/currentUserProfile.service";
import { readStoredIntervenantToken } from "../utils/intervenantSession";

export default function AppEntryPage() {
  const [target, setTarget] = useState<"/dashboard" | "/intervenant" | "/login" | null>(null);

  useEffect(() => {
    let alive = true;

    getCurrentUserHomeRoute()
      .then((route) => {
        if (!alive) return;
        if (route === "/login" && readStoredIntervenantToken()) {
          setTarget("/intervenant");
          return;
        }
        setTarget(route);
      })
      .catch(() => {
        if (!alive) return;
        setTarget(readStoredIntervenantToken() ? "/intervenant" : "/login");
      });

    return () => {
      alive = false;
    };
  }, []);

  if (!target) return null;
  return <Navigate to={target} replace />;
}
