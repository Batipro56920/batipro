import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { QuoteDraft, QuoteTotals } from "../types";

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: "#0f172a" },
  title: { fontSize: 20, marginBottom: 12, fontWeight: 700 },
  section: { marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#e2e8f0", paddingVertical: 6 },
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
            <View key={line.id} style={styles.row}>
              <Text>{line.designation}</Text>
              <Text>{(line.quantity * line.unitPriceHt).toFixed(2)} EUR HT</Text>
            </View>
          ))}
        </View>
        <View style={styles.section}>
          <Text>Total HT : {totals.totalHt.toFixed(2)} EUR</Text>
          <Text>Total TVA : {totals.totalVat.toFixed(2)} EUR</Text>
          <Text>Total TTC : {totals.totalTtc.toFixed(2)} EUR</Text>
        </View>
      </Page>
    </Document>
  );
}
