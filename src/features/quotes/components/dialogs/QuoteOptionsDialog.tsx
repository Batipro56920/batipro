import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { useQuoteActions } from "../../hooks/useQuoteActions";
import { useQuoteStore } from "../../store/quoteStore";

type Props = {
  onClose: () => void;
};

export function QuoteOptionsDialog({ onClose }: Props) {
  const settings = useQuoteStore((state) => state.quote.settings);
  const { updateQuote } = useQuoteActions();

  function toggle(key: keyof typeof settings) {
    const value = settings[key];
    if (typeof value === "boolean") updateQuote({ settings: { ...settings, [key]: !value } });
  }

  return (
    <Card className="w-80 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Options devis</h2>
        <Button variant="ghost" onClick={onClose}>Fermer</Button>
      </div>
      {(["showMargins", "showReferences", "showVatColumn", "showQuantityColumns", "hideCompositeDetails"] as const).map((key) => (
        <label key={key} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm hover:bg-slate-50">
          <span>{label(key)}</span>
          <input type="checkbox" checked={Boolean(settings[key])} onChange={() => toggle(key)} />
        </label>
      ))}
    </Card>
  );
}

function label(key: string) {
  return {
    showMargins: "Afficher les marges",
    showReferences: "Afficher les references",
    showVatColumn: "Afficher TVA",
    showQuantityColumns: "Afficher quantites/unites",
    hideCompositeDetails: "Cacher details ouvrages",
  }[key];
}
