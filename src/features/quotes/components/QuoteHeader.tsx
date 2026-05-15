import { Send, Settings, X } from "lucide-react";
import { useQuoteStore } from "../store/quoteStore";

type Props = {
  onClose?: () => void;
  onToggleOptions?: () => void;
};

export function QuoteHeader({ onClose, onToggleOptions }: Props) {
  const { draft, dirty, markSaved } = useQuoteStore();
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-3">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Devis BTP</div>
        <h1 className="text-lg font-semibold text-slate-950">Devis n° {draft.quoteNumber}</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border px-3 py-1 text-xs text-slate-600">{dirty ? "Modifications non sauvegardees" : "Enregistre"}</span>
        <button className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={onToggleOptions}>
          <Settings className="mr-2 inline h-4 w-4" />
          Options
        </button>
        <button className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">Annuler</button>
        <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white" onClick={markSaved}>Enregistrer</button>
        <button className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <Send className="mr-2 inline h-4 w-4" />
          Envoyer
        </button>
        <button className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50" onClick={onClose}>
          <X className="mr-2 inline h-4 w-4" />
          Fermer
        </button>
      </div>
    </header>
  );
}
