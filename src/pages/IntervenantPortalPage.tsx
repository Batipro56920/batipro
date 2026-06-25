import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import EmployeePortalV2Page from "./EmployeePortalV2Page";
import { clearStoredIntervenantToken } from "../utils/intervenantSession";

export default function IntervenantPortalPage() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const isInternalPortal = pathname.startsWith("/portail/employe");
  const [ready, setReady] = useState(!isInternalPortal);

  useEffect(() => {
    if (!isInternalPortal) {
      setReady(true);
      return;
    }

    clearStoredIntervenantToken();
    if (search) {
      navigate(pathname, { replace: true });
    }
    setReady(true);
  }, [isInternalPortal, navigate, pathname, search]);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 text-sm font-semibold text-slate-600">
        Chargement du portail employe...
      </div>
    );
  }

  return <EmployeePortalV2Page />;
}
