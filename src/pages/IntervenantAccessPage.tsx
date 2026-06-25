import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

export default function IntervenantAccessPage() {
  const navigate = useNavigate();
  const { token } = useParams();

  useEffect(() => {
    const target = token ? `/intervenant?token=${encodeURIComponent(token)}` : "/intervenant";
    navigate(target, { replace: true });
  }, [navigate, token]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 text-sm font-semibold text-slate-700">
      Ouverture du portail terrain...
    </div>
  );
}
