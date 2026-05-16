import { Card } from "../../../../components/ui/card";
import { Textarea } from "../../../../components/ui/input";
import { lazy, Suspense } from "react";
import { useQuoteActions } from "../../hooks/useQuoteActions";
import { useQuoteStore } from "../../store/quoteStore";

export function QuoteTextsPanel() {
  const paymentTerms = useQuoteStore((state) => state.quote.paymentTerms);
  const legalMentions = useQuoteStore((state) => state.quote.legalMentions);
  const wasteManagement = useQuoteStore((state) => state.quote.wasteManagement);
  const footerNotes = useQuoteStore((state) => state.quote.footerNotes);
  const { updateQuote } = useQuoteActions();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TextCard title="Conditions de paiement" value={paymentTerms} onChange={(value) => updateQuote({ paymentTerms: value })} />
      <Card className="p-5">
        <h2 className="font-semibold text-slate-950">Mentions legales</h2>
        <div className="mt-3">
          <Suspense fallback={<Textarea className="min-h-24" value={legalMentions} onChange={(event) => updateQuote({ legalMentions: event.target.value })} />}>
            <QuoteRichTextField value={legalMentions} placeholder="Mentions legales, assurance, TVA, conditions..." onCommit={(value) => updateQuote({ legalMentions: value })} />
          </Suspense>
        </div>
      </Card>
      <TextCard title="Gestion dechets" value={wasteManagement} onChange={(value) => updateQuote({ wasteManagement: value })} />
      <TextCard title="Notes de bas de page" value={footerNotes} onChange={(value) => updateQuote({ footerNotes: value })} />
    </div>
  );
}

function TextCard({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return (
    <Card className="p-5">
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <Textarea className="mt-3 min-h-24" value={value} onChange={(event) => onChange(event.target.value)} />
    </Card>
  );
}
const QuoteRichTextField = lazy(() => import("./QuoteRichTextField").then((module) => ({ default: module.QuoteRichTextField })));
