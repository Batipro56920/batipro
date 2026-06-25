import { useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

export default function IntervenantAccessPage() {
  const navigate = useNavigate();
  const { search } = useLocation();
  const { token } = useParams();

  useEffect(() => {
    const incomingParams = new URLSearchParams(search);
    const targetParams = new URLSearchParams();
    const chantierId = incomingParams.get("chantier_id")?.trim();

    if (token) targetParams.set("token", token);
    if (chantierId) targetParams.set("chantier_id", chantierId);

    const query = targetParams.toString();
    const target = query ? `/intervenant?${query}` : "/intervenant";
    navigate(target, { replace: true });
  }, [navigate, search, token]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 text-sm font-semibold text-slate-700">
      Ouverture du portail terrain...
    </div>
  );
}
