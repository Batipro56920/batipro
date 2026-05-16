import { useNavigate, useParams } from "react-router-dom";
import { QuoteWorkspace } from "../features/quotes/components/workspace/QuoteWorkspace";
import { useQuote } from "../features/quotes/hooks/useQuote";

export default function CrmQuoteWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { loading, error, dataset, options, save, saving } = useQuote(id);

  if (loading) {
    return <div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement du workspace devis...</div>;
  }

  if (error || !dataset) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? "Devis introuvable."}</div>;
  }

  return (
    <QuoteWorkspace
      templates={dataset.taskTemplates}
      clients={options.clients}
      prospects={options.prospects}
      projects={options.projects}
      saving={saving}
      onSave={() => void save()}
      onSend={() => window.alert("Envoi devis a finaliser : la sauvegarde reste disponible.")}
      onClose={() => navigate("/crm/devis")}
    />
  );
}
