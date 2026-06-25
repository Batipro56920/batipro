import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import EmployeePortalV2Page from "./EmployeePortalV2Page";
import { clearStoredIntervenantToken } from "../utils/intervenantSession";

export default function IntervenantPortalPage() {
  const { pathname } = useLocation();
  const isInternalPortal = pathname.startsWith("/portail/employe");
  const [ready, setReady] = useState(!isInternalPortal);

  useEffect(() => {
    if (!isInternalPortal) {
      setReady(true);
      return;
    }

    clearStoredIntervenantToken();
    setReady(true);
  }, [isInternalPortal]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 text-sm font-semibold text-slate-600">
        Chargement du portail employe...
      </div>
    );
  }

  return <EmployeePortalV2Page />;
}
