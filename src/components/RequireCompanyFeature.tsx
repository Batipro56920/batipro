import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { CompanyFeatureModuleId } from "../config/companyFeatures";
import {
  getCompanySettings,
  getEnabledCompanyModulesFromSettings,
} from "../services/companySettings.service";

type FeatureGateState = {
  checking: boolean;
  allowed: boolean;
};

export default function RequireCompanyFeature({
  moduleId,
  children,
}: {
  moduleId: CompanyFeatureModuleId;
  children: ReactNode;
}) {
  const [gateState, setGateState] = useState<FeatureGateState>({
    checking: true,
    allowed: true,
  });

  useEffect(() => {
    let alive = true;

    async function verifyFeatureAccess() {
      try {
        const settings = await getCompanySettings();
        const enabledModules = new Set(getEnabledCompanyModulesFromSettings(settings));
        if (!alive) return;
        setGateState({
          checking: false,
          allowed: enabledModules.has(moduleId),
        });
      } catch {
        if (!alive) return;
        setGateState({
          checking: false,
          allowed: true,
        });
      }
    }

    void verifyFeatureAccess();

    return () => {
      alive = false;
    };
  }, [moduleId]);

  if (gateState.checking) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="font-semibold text-slate-900">Chargement des fonctionnalités</div>
        <div className="mt-1 text-sm text-slate-500">
          Vérification des modules activés pour votre entreprise...
        </div>
      </div>
    );
  }

  if (!gateState.allowed) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
