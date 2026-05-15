import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { CompanyFeatureModuleId } from "../config/companyFeatures";
import {
  getCompanySettings,
  getEnabledCompanyModulesFromSettings,
} from "../services/companySettings.service";
import {
  getCurrentProfileFeaturePermissions,
  hasProfileFeaturePermission,
  type ProfileFeaturePermissionKey,
} from "../services/profileFeaturePermissions.service";

type FeatureGateState = {
  checking: boolean;
  allowed: boolean;
};

export default function RequireCompanyFeature({
  moduleId,
  profilePermissionKey,
  children,
}: {
  moduleId?: CompanyFeatureModuleId;
  profilePermissionKey?: ProfileFeaturePermissionKey;
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
        const [settings, profilePermissions] = await Promise.all([
          moduleId ? getCompanySettings() : Promise.resolve(null),
          moduleId || profilePermissionKey
            ? getCurrentProfileFeaturePermissions()
            : Promise.resolve(null),
        ]);
        const enabledModules = settings
          ? new Set(getEnabledCompanyModulesFromSettings(settings))
          : null;
        const nextProfileKey = profilePermissionKey ?? moduleId ?? null;
        const profileAllowed =
          nextProfileKey && profilePermissions
            ? hasProfileFeaturePermission(
                profilePermissions.permissions,
                nextProfileKey,
                profilePermissions.role,
              )
            : true;
        if (!alive) return;
        setGateState({
          checking: false,
          allowed: (!moduleId || !enabledModules || enabledModules.has(moduleId)) && profileAllowed,
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
  }, [moduleId, profilePermissionKey]);

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
