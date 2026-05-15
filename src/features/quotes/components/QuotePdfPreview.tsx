import { PDFViewer } from "@react-pdf/renderer";
import { QuotePdfDocument } from "../pdf/QuotePdfDocument";
import { useQuoteStore, useQuoteTotals } from "../store/quoteStore";

export function QuotePdfPreview() {
  const draft = useQuoteStore((state) => state.draft);
  const totals = useQuoteTotals();
  return (
    <div className="h-full min-h-[32rem] rounded-3xl border bg-white p-3">
      <PDFViewer className="h-full min-h-[32rem] w-full rounded-2xl">
        <QuotePdfDocument draft={draft} totals={totals} />
      </PDFViewer>
    </div>
  );
}
