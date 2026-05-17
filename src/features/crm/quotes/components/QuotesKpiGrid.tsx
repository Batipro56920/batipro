import { BadgeEuro, CheckCircle2, FileClock, FileText, PenLine, Send } from "lucide-react";
import type { CrmQuoteRow } from "../../../../services/crm.service";
import { eur } from "../../components/crmFormat";

export function QuotesKpiGrid({ rows }: { rows: CrmQuoteRow[] }) {
  const drafts = rows.filter((row) => ["brouillon", "en_preparation"].includes(row.statut)).length;
  const sent = rows.filter((row) => ["envoye", "vu"].includes(row.statut)).length;
  const reminders = rows.filter((row) => ["relance_1", "relance_2"].includes(row.statut)).length;
  const pendingSignature = rows.filter((row) => row.signature_status === "attente_signature").length;
  const accepted = rows.filter((row) => row.statut === "accepte").length;
  const revenue = rows.reduce((sum, row) => sum + Number(row.montant_ht ?? 0), 0);

  const items = [
    { label: "Brouillons", value: String(drafts), hint: "À finaliser", icon: FileText, tone: "text-slate-700 bg-slate-50 border-slate-200" },
    { label: "Envoyés", value: String(sent), hint: "En attente retour client", icon: Send, tone: "text-blue-700 bg-blue-50 border-blue-200" },
    { label: "Relances", value: String(reminders), hint: "Suivi commercial", icon: FileClock, tone: "text-amber-700 bg-amber-50 border-amber-200" },
    { label: "Attente signature", value: String(pendingSignature), hint: "Validation client", icon: PenLine, tone: "text-indigo-700 bg-indigo-50 border-indigo-200" },
    { label: "Acceptés", value: String(accepted), hint: "Transformables chantier", icon: CheckCircle2, tone: "text-emerald-700 bg-emerald-50 border-emerald-200" },
    { label: "CA devis", value: eur(revenue), hint: "Total HT portefeuille", icon: BadgeEuro, tone: "text-slate-700 bg-slate-50 border-slate-200" },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm shadow-slate-950/[0.03]">
            <span className={`inline-flex rounded-lg border p-1.5 ${item.tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="mt-3 text-xl font-bold tracking-tight text-slate-950">{item.value}</div>
            <div className="mt-1 text-sm font-semibold text-slate-800">{item.label}</div>
            <div className="mt-0.5 text-xs text-slate-500">{item.hint}</div>
          </div>
        );
      })}
    </section>
  );
}
