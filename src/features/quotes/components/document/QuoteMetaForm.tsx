import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Card } from "../../../../components/ui/card";
import { Input, Textarea } from "../../../../components/ui/input";
import { quoteMetaSchema, type QuoteMetaFormValues } from "../../application/quoteValidation";
import { useQuoteActions } from "../../hooks/useQuoteActions";
import { useQuoteStore } from "../../store/quoteStore";
import type { QuoteAccountOption, QuoteProjectOption } from "../../domain/Quote";

type Props = {
  clients: QuoteAccountOption[];
  prospects: QuoteAccountOption[];
  projects: QuoteProjectOption[];
};

export function QuoteMetaForm({ clients, prospects, projects }: Props) {
  const quote = useQuoteStore((state) => state.quote);
  const { updateQuote, selectClient, selectProspect, selectProject } = useQuoteActions();
  const form = useForm<QuoteMetaFormValues>({
    resolver: zodResolver(quoteMetaSchema),
    values: {
      number: quote.number,
      clientId: quote.clientId,
      prospectId: quote.prospectId,
      projectId: quote.projectId,
      clientName: quote.clientName,
      siteAddress: quote.siteAddress,
      validityDate: quote.validityDate,
    },
  });

  useEffect(() => {
    const subscription = form.watch((value) => {
      updateQuote({
        number: value.number ?? "",
        clientName: value.clientName ?? "",
        siteAddress: value.siteAddress ?? "",
        validityDate: value.validityDate ?? null,
      });
    });
    return () => subscription.unsubscribe();
  }, [form, updateQuote]);

  return (
    <Card className="p-5">
      <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Numero"><Input {...form.register("number")} className="font-semibold" /></Field>
            <Field label="Date"><Input type="date" value={quote.date} onChange={(event) => updateQuote({ date: event.target.value })} /></Field>
            <Field label="Validite"><Input type="date" {...form.register("validityDate")} value={quote.validityDate ?? ""} /></Field>
            <Field label="Debut travaux"><Input type="date" value={quote.workStartDate ?? ""} onChange={(event) => updateQuote({ workStartDate: event.target.value || null })} /></Field>
            <Field label="Duree"><Input value={quote.estimatedDuration ?? ""} onChange={(event) => updateQuote({ estimatedDuration: event.target.value || null })} placeholder="Ex: 4 semaines" /></Field>
            <Field label="Commercial"><Input value={quote.salespersonId ?? ""} onChange={(event) => updateQuote({ salespersonId: event.target.value || null })} placeholder="Nom ou identifiant" /></Field>
          </div>
          <Textarea value={quote.description} onChange={(event) => updateQuote({ description: event.target.value })} className="min-h-20" placeholder="Description du projet" />
        </div>
        <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
          <Select label="Client" value={quote.clientId ?? ""} options={clients} onChange={(id) => selectClient(clients.find((item) => item.id === id) ?? null)} />
          <Select label="Prospect" value={quote.prospectId ?? ""} options={prospects} onChange={(id) => selectProspect(prospects.find((item) => item.id === id) ?? null)} />
          <Select label="Chantier" value={quote.projectId ?? ""} options={projects} onChange={(id) => selectProject(projects.find((item) => item.id === id) ?? null)} />
          <Input {...form.register("clientName")} placeholder="Nom client affiche" />
          <Textarea {...form.register("siteAddress")} className="min-h-16" placeholder="Adresse chantier" />
        </div>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: Array<{ id: string; label: string }>; onChange: (id: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-300" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Aucun</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}
