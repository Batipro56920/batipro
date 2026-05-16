import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { numberQuoteNodes } from "../application/quoteNumbering";
import { getNodeSellHt } from "../application/quoteCalculations";
import type { Quote } from "../domain/Quote";
import type { NumberedQuoteNode } from "../application/quoteNumbering";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: "#0f172a" },
  title: { fontSize: 20, marginBottom: 12, fontWeight: 700 },
  section: { marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 6 },
  sectionTitle: { marginTop: 10, paddingVertical: 6, fontSize: 12, fontWeight: 700, backgroundColor: "#0f172a", color: "white", paddingHorizontal: 8 },
  subTitle: { marginTop: 6, paddingVertical: 5, fontSize: 11, fontWeight: 700, backgroundColor: "#f1f5f9", paddingHorizontal: 8 },
  textLine: { paddingVertical: 5, color: "#475569" },
});

export function QuotePdfDocument({ quote }: { quote: Quote }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Devis {quote.number}</Text>
        <View style={styles.section}>
          <Text>Client : {quote.clientName || "A definir"}</Text>
          <Text>Adresse chantier : {quote.siteAddress || "A definir"}</Text>
          <Text>{quote.description}</Text>
        </View>
        <View style={styles.section}>
          {numberQuoteNodes(quote.nodes).map((node) => <PdfNode key={node.id} node={node} />)}
        </View>
        <View style={styles.section}>
          <Text>Total HT : {quote.totals.sellHt.toFixed(2)} EUR</Text>
          <Text>Total TVA : {quote.totals.vat.toFixed(2)} EUR</Text>
          <Text>Total TTC : {quote.totals.ttc.toFixed(2)} EUR</Text>
        </View>
        <View style={styles.section}>
          <Text>Conditions : {quote.paymentTerms}</Text>
          <Text>Mentions : {quote.legalMentions}</Text>
        </View>
      </Page>
    </Document>
  );
}

function PdfNode({ node }: { node: NumberedQuoteNode }) {
  if (node.type === "section") return <Text style={styles.sectionTitle}>{node.number} {node.title}</Text>;
  if (node.type === "subsection") return <Text style={styles.subTitle}>{node.number} {node.title}</Text>;
  if (node.type === "text") return <Text style={styles.textLine}>{node.title}</Text>;
  if (node.type === "pagebreak") return <Text style={styles.textLine}>--- Saut de page ---</Text>;
  return (
    <View style={styles.row}>
      <Text>{node.number} {node.title}</Text>
      <Text>{getNodeSellHt(node).toFixed(2)} EUR HT</Text>
    </View>
  );
}
