import { PDFViewer } from "@react-pdf/renderer";
import { QuotePdfDocument } from "../../pdf/QuotePdfDocument";
import { useQuoteStore } from "../../store/quoteStore";

export function QuotePreview() {
  const quote = useQuoteStore((state) => state.quote);
  return (
    <div className="h-full min-h-[34rem] p-4">
      <PDFViewer className="h-full min-h-[34rem] w-full rounded-2xl border bg-white">
        <QuotePdfDocument quote={quote} />
      </PDFViewer>
    </div>
  );
}
