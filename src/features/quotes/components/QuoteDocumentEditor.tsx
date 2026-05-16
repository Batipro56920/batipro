import { format } from "date-fns";
import { Plus } from "lucide-react";
import { QuoteLineTable } from "./QuoteLineTable";
import { useQuoteStore } from "../store/quoteStore";
import type { QuoteAccountOption, QuoteChantierOption, QuoteLineKind } from "../types";

type Props = {
  clients: QuoteAccountOption[];
  prospects: QuoteAccountOption[];
  chantiers: QuoteChantierOption[];
};

const LINE_ACTIONS: Array<{ kind: QuoteLineKind; label: string }> = [
  { kind: "fourniture", label: "+ Fourniture" },
  { kind: "main_oeuvre", label: "+ Main-d'oeuvre" },
  { kind: "ouvrage", label: "+ Ouvrage" },
  { kind: "section", label: "+ Section" },
  { kind: "sous_section", label: "+ Sous-section" },
  { kind: "texte", label: "+ Texte" },
  { kind: "saut_page", label: "+ Saut de page" },
];

export function QuoteDocumentEditor({ clients, prospects, chantiers }: Props) {
  const draft = useQuoteStore((state) => state.draft);
  const setDraft = useQuoteStore((state) => state.setDraft);
  const addLine = useQuoteStore((state) => state.addLine);

  function addQuickLine(kind: QuoteLineKind) {
    const nonBillable = kind === "section" || kind === "sous_section" || kind === "texte" || kind === "saut_page";
    addLine({
      id: crypto.randomUUID(),
      persisted: false,
      parentId: null,
      kind,
      designation: defaultDesignation(kind),
      quantity: nonBillable ? 0 : 1,
      unit: kind === "main_oeuvre" ? "h" : "u",
      unitPriceHt: 0,
      vatRate: draft.defaultVatRate,
      purchaseCostHt: 0,
      order: draft.lines.length + 1,
    });
  }

  function selectClient(id: string) {
    const client = clients.find((item) => item.id === id) ?? null;
    setDraft({
      clientId: client?.id ?? null,
      prospectId: null,
      clientName: client?.label ?? "",
      projectAddress: client?.address || draft.projectAddress,
    });
  }

  function selectProspect(id: string) {
    const prospect = prospects.find((item) => item.id === id) ?? null;
    setDraft({
      prospectId: prospect?.id ?? null,
      clientId: null,
      clientName: prospect?.label ?? "",
      projectAddress: prospect?.address || draft.projectAddress,
    });
  }

  function selectChantier(id: string) {
    const chantier = chantiers.find((item) => item.id === id) ?? null;
    setDraft({
      chantierId: chantier?.id ?? null,
      clientId: chantier?.clientId ?? draft.clientId,
      prospectId: chantier?.prospectId ?? draft.prospectId,
      clientName: chantier?.clientName || draft.clientName,
      projectAddress: chantier?.address || draft.projectAddress,
    });
  }

  return (
    <section className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
        <div className="grid gap-4 xl:grid-cols-[1fr_22rem]">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Document devis</div>
            <input
              className="mt-1 w-full rounded-xl border border-transparent px-0 py-1 text-2xl font-semibold text-slate-950 outline-none focus:border-slate-200 focus:px-3"
              value={draft.quoteNumber}
              onChange={(event) => setDraft({ quoteNumber: event.target.value })}
            />
            <div className="mt-2 text-sm text-slate-500">
              Date : {format(new Date(), "dd/MM/yyyy")} - Validite : {draft.validUntil || "a definir"}
            </div>
            <textarea
              className="mt-4 min-h-20 w-full rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm outline-none focus:border-blue-200"
              value={draft.projectDescription}
              onChange={(event) => setDraft({ projectDescription: event.target.value })}
              placeholder="Description du projet, contexte, contraintes principales..."
            />
          </div>
          <div className="space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
            <Select label="Client CRM" value={draft.clientId ?? ""} onChange={selectClient} options={clients} placeholder="Selectionner un client" />
            <Select label="Prospect" value={draft.prospectId ?? ""} onChange={selectProspect} options={prospects} placeholder="Selectionner un prospect" />
            <Select label="Chantier existant" value={draft.chantierId ?? ""} onChange={selectChantier} options={chantiers} placeholder="Lier un chantier" />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-300"
              value={draft.clientName}
              onChange={(event) => setDraft({ clientName: event.target.value })}
              placeholder="Nom client affiche"
            />
            <textarea
              className="min-h-16 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-300"
              value={draft.projectAddress}
              onChange={(event) => setDraft({ projectAddress: event.target.value })}
              placeholder="Adresse chantier"
            />
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-100">
        <div className="mb-3 flex flex-wrap gap-2">
          {LINE_ACTIONS.map((action) => (
            <button key={action.kind} className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50" onClick={() => addQuickLine(action.kind)}>
              <Plus className="mr-1 inline h-4 w-4" />
              {action.label}
            </button>
          ))}
        </div>
        <QuoteLineTable />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <TextBlock title="Conditions de paiement" value={draft.paymentTerms} onChange={(paymentTerms) => setDraft({ paymentTerms })} />
        <TextBlock title="Mentions et notes" value={draft.legalMentions} onChange={(legalMentions) => setDraft({ legalMentions })} />
        <TextBlock title="Gestion dechets" value={draft.wasteManagement} onChange={(wasteManagement) => setDraft({ wasteManagement })} />
        <TextBlock title="Notes de bas de page" value={draft.footerNotes} onChange={(footerNotes) => setDraft({ footerNotes })} />
      </div>
    </section>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  options: Array<{ id: string; label: string }>;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
      <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-blue-300" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextBlock({ title, value, onChange }: { title: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <h2 className="font-semibold text-slate-950">{title}</h2>
      <textarea className="mt-3 min-h-24 w-full rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-sm outline-none focus:border-blue-200" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function defaultDesignation(kind: QuoteLineKind): string {
  switch (kind) {
    case "section":
      return "Nouvelle section";
    case "sous_section":
      return "Nouvelle sous-section";
    case "texte":
      return "Texte libre";
    case "saut_page":
      return "Saut de page";
    case "main_oeuvre":
      return "Main-d'oeuvre";
    case "ouvrage":
      return "Nouvel ouvrage";
    case "sous_traitance":
      return "Sous-traitance";
    case "materiel":
      return "Materiel";
    case "divers":
      return "Divers";
    default:
      return "Fourniture";
  }
}
