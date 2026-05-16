import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { QuoteDraft, QuoteLine, QuoteTotals } from "../types";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: "#0f172a" },
  title: { fontSize: 20, marginBottom: 12, fontWeight: 700 },
  section: { marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 6 },
  sectionTitle: { marginTop: 10, paddingVertical: 6, fontSize: 12, fontWeight: 700, backgroundColor: "#0f172a", color: "white", paddingHorizontal: 8 },
  subTitle: { marginTop: 6, paddingVertical: 5, fontSize: 11, fontWeight: 700, backgroundColor: "#f1f5f9", paddingHorizontal: 8 },
  textLine: { paddingVertical: 5, color: "#475569" },
});

export function QuotePdfDocument({ draft, totals }: { draft: QuoteDraft; totals: QuoteTotals }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Devis {draft.quoteNumber}</Text>
        <View style={styles.section}>
          <Text>Client : {draft.clientName || "A definir"}</Text>
          <Text>Adresse chantier : {draft.projectAddress || "A definir"}</Text>
        </View>
        <View style={styles.section}>
          {draft.lines.map((line) => (
            <QuotePdfLine key={line.id} line={line} />
          ))}
        </View>
        <View style={styles.section}>
          <Text>Total HT : {totals.totalHt.toFixed(2)} EUR</Text>
          <Text>Total TVA : {totals.totalVat.toFixed(2)} EUR</Text>
          <Text>Total TTC : {totals.totalTtc.toFixed(2)} EUR</Text>
        </View>
        <View style={styles.section}>
          <Text>Conditions : {draft.paymentTerms}</Text>
          <Text>Mentions : {draft.legalMentions}</Text>
        </View>
      </Page>
    </Document>
  );
}

function QuotePdfLine({ line }: { line: QuoteLine }) {
  if (line.kind === "section") return <Text style={styles.sectionTitle}>{line.designation}</Text>;
  if (line.kind === "sous_section") return <Text style={styles.subTitle}>{line.designation}</Text>;
  if (line.kind === "texte") return <Text style={styles.textLine}>{line.designation}</Text>;
  if (line.kind === "saut_page") return <Text style={styles.textLine}>--- Saut de page ---</Text>;
  return (
    <View style={styles.row}>
      <Text>{line.designation}</Text>
      <Text>{(line.quantity * line.unitPriceHt).toFixed(2)} EUR HT</Text>
    </View>
  );
}
