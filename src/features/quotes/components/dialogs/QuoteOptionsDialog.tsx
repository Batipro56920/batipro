import { Button } from "../../../../components/ui/button";
import { Card } from "../../../../components/ui/card";
import { useQuoteActions } from "../../hooks/useQuoteActions";
import { useQuoteStore } from "../../store/quoteStore";
import { useCompanyQuoteSettings } from "../../hooks/useCompanyQuoteSettings";
import { Input, Textarea } from "../../../../components/ui/input";

type Props = {
  onClose: () => void;
};

export function QuoteOptionsDialog({ onClose }: Props) {
  const settings = useQuoteStore((state) => state.quote.settings);
  const { updateQuote } = useQuoteActions();
  const company = useCompanyQuoteSettings();

  function toggle(key: keyof typeof settings) {
    const value = settings[key];
    if (typeof value === "boolean") updateQuote({ settings: { ...settings, [key]: !value } });
  }

  return (
    <Card className="max-h-[85vh] w-96 overflow-y-auto p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Options devis</h2>
        <Button variant="ghost" onClick={onClose}>Fermer</Button>
      </div>
      {(["showMargins", "showLineDiscounts", "showReferences", "showStocks", "customNumbering", "showVatCertificate", "showWasteManagement", "showQuantityColumns", "showVatColumn", "hideCompositeDetails", "hideSectionTotals"] as const).map((key) => (
        <label key={key} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm hover:bg-slate-50">
          <span>{label(key)}</span>
          <input type="checkbox" checked={Boolean(settings[key])} onChange={() => toggle(key)} />
        </label>
      ))}
      <div className="mt-4 border-t pt-4">
        <h3 className="text-sm font-semibold text-slate-950">Parametres entreprise</h3>
        {company.settings ? (
          <div className="mt-3 space-y-3">
            <Field label="TVA defaut"><Input type="number" value={company.settings.defaultVatRate} onChange={(event) => void company.update({ defaultVatRate: Number(event.target.value) as any })} /></Field>
            <Field label="Acompte %"><Input type="number" value={company.settings.defaultDepositPercent} onChange={(event) => void company.update({ defaultDepositPercent: Number(event.target.value) })} /></Field>
            <Field label="Validite jours"><Input type="number" value={company.settings.defaultValidityDays} onChange={(event) => void company.update({ defaultValidityDays: Number(event.target.value) })} /></Field>
            <Field label="Prefixe devis"><Input value={company.settings.quoteNumberPrefix} onChange={(event) => void company.update({ quoteNumberPrefix: event.target.value })} /></Field>
            <Field label="Conditions paiement"><Textarea className="min-h-20" value={company.settings.defaultPaymentTerms} onChange={(event) => void company.update({ defaultPaymentTerms: event.target.value })} /></Field>
            <Field label="Mentions legales"><Textarea className="min-h-20" value={company.settings.defaultLegalMentions} onChange={(event) => void company.update({ defaultLegalMentions: event.target.value })} /></Field>
            <Field label="Gestion dechets"><Textarea className="min-h-16" value={company.settings.defaultWasteManagement} onChange={(event) => void company.update({ defaultWasteManagement: event.target.value })} /></Field>
          </div>
        ) : (
          <div className="mt-2 text-xs text-slate-500">Chargement...</div>
        )}
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function label(key: string) {
  return {
    showMargins: "Afficher les marges",
    showLineDiscounts: "Afficher les remises par ligne",
    showReferences: "Afficher les references",
    showStocks: "Afficher les stocks",
    customNumbering: "Numerotation personnalisee",
    showVatCertificate: "Attestation TVA",
    showWasteManagement: "Gestion dechets",
    showQuantityColumns: "Afficher colonnes quantite/unite",
    showVatColumn: "Afficher TVA",
    hideCompositeDetails: "Cacher details ouvrages",
    hideSectionTotals: "Cacher totaux des sections",
  }[key];
}
