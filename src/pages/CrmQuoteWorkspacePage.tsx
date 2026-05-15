import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  createCrmPaymentTerm,
  createCrmQuoteComponent,
  createCrmQuoteItemFromTemplate,
  createCrmQuoteSection,
  downloadCrmQuotePdf,
  loadCrmDataset,
  loadCrmQuoteEngineData,
  recalculateCrmQuoteTotals,
  updateCrmQuote,
  type CrmClientRow,
  type CrmDataset,
  type CrmProspectRow,
  type CrmQuoteEngineData,
  type CrmQuoteItemRow,
} from "../services/crm.service";

const EMPTY_DATASET: CrmDataset = {
  prospects: [],
  clients: [],
  opportunities: [],
  quotes: [],
  tasks: [],
  appointments: [],
  sav: [],
  stages: [],
  documents: [],
  communications: [],
  invoices: [],
  purchases: [],
  chantiers: [],
  taskTemplates: [],
};

function eur(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
}

function entityLabel(row: Pick<CrmProspectRow | CrmClientRow, "prenom" | "nom" | "societe" | "email"> | null | undefined) {
  if (!row) return "Client a definir";
  return [row.prenom, row.nom].filter(Boolean).join(" ") || row.societe || row.email || "Client a definir";
}

function toInputDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "";
}

export default function CrmQuoteWorkspacePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [dataset, setDataset] = useState<CrmDataset>(EMPTY_DATASET);
  const [engine, setEngine] = useState<CrmQuoteEngineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [componentItem, setComponentItem] = useState<CrmQuoteItemRow | null>(null);
  const [quoteForm, setQuoteForm] = useState<Record<string, string>>({});
  const [lineForm, setLineForm] = useState<Record<string, string>>({
    lineType: "simple",
    designation: "",
    quantity: "1",
    unit: "u",
    unitPriceHt: "0",
    tvaRate: "20",
    sectionId: "",
  });
  const [sectionForm, setSectionForm] = useState<Record<string, string>>({ title: "", parentId: "" });
  const [paymentForm, setPaymentForm] = useState<Record<string, string>>({ label: "Acompte a la signature", percent: "30", dueTrigger: "signature" });
  const [options, setOptions] = useState<Record<string, boolean>>({
    showMargins: true,
    showReferences: true,
    showQuantityUnit: true,
    showTva: true,
    showSectionTotals: true,
    hideCompositeDetails: false,
    showTypes: true,
    customNumbering: false,
    showStocks: false,
    lineDiscounts: false,
    tvaCertificate: false,
  });

  async function refresh() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [nextDataset, nextEngine] = await Promise.all([loadCrmDataset(), loadCrmQuoteEngineData(id)]);
      setDataset(nextDataset);
      setEngine(nextEngine);
      setQuoteForm({
        quote_number: nextEngine.quote.quote_number ?? "",
        date_emission: toInputDate(nextEngine.quote.date_emission),
        valid_until: toInputDate(nextEngine.quote.valid_until),
        description: nextEngine.quote.description ?? "",
        lot: nextEngine.quote.lot ?? "",
        conditions: nextEngine.quote.conditions ?? "",
        acompte_percent: String(nextEngine.quote.acompte_percent ?? 30),
        payment_terms_text: nextEngine.quote.payment_terms_text ?? "",
        project_start: String((nextEngine.quote.display_options as any)?.project_start ?? ""),
        estimated_duration: String((nextEngine.quote.display_options as any)?.estimated_duration ?? ""),
        sales_owner: String((nextEngine.quote.display_options as any)?.sales_owner ?? ""),
        waste_management: String((nextEngine.quote.waste_management as any)?.text ?? ""),
        footer_notes: String((nextEngine.quote.legal_mentions as any)?.footer_notes ?? ""),
      });
    } catch (err: any) {
      setError(err?.message ?? "Chargement du devis impossible.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [id]);

  const client = useMemo(() => dataset.clients.find((row) => row.id === engine?.quote.client_id) ?? null, [dataset.clients, engine?.quote.client_id]);
  const prospect = useMemo(() => dataset.prospects.find((row) => row.id === engine?.quote.prospect_id) ?? null, [dataset.prospects, engine?.quote.prospect_id]);
  const account = client ?? prospect;
  const componentsByItem = useMemo(() => {
    const map = new Map<string, CrmQuoteEngineData["components"]>();
    for (const component of engine?.components ?? []) {
      map.set(component.quote_item_id, [...(map.get(component.quote_item_id) ?? []), component]);
    }
    return map;
  }, [engine?.components]);
  const tvaRows = useMemo(() => {
    const map = new Map<number, { base: number; tva: number }>();
    for (const row of engine?.items ?? []) {
      const rate = Number(row.tva_rate ?? 20);
      const base = Number(row.sale_total_ht ?? row.total_ht ?? 0);
      const current = map.get(rate) ?? { base: 0, tva: 0 };
      map.set(rate, { base: current.base + base, tva: current.tva + base * (rate / 100) });
    }
    return [...map.entries()].map(([rate, value]) => ({ rate, ...value }));
  }, [engine?.items]);
  const depositTtc = Number(engine?.quote.montant_ttc ?? 0) * (Number(quoteForm.acompte_percent || 0) / 100);

  async function saveQuote() {
    if (!engine) return;
    setSaving(true);
    setError(null);
    try {
      const displayOptions = {
        ...(engine.quote.display_options ?? {}),
        project_start: quoteForm.project_start || null,
        estimated_duration: quoteForm.estimated_duration || null,
        sales_owner: quoteForm.sales_owner || null,
        quote_options: options,
      };
      await updateCrmQuote(engine.quote.id, {
        quote_number: quoteForm.quote_number,
        date_emission: quoteForm.date_emission || null,
        valid_until: quoteForm.valid_until || null,
        description: quoteForm.description,
        lot: quoteForm.lot,
        conditions: quoteForm.conditions,
        acompte_percent: Number(quoteForm.acompte_percent || 0),
        payment_terms_text: quoteForm.payment_terms_text,
        display_options: displayOptions,
        waste_management: { text: quoteForm.waste_management || "" },
        legal_mentions: { footer_notes: quoteForm.footer_notes || "" },
      } as any);
      await recalculateCrmQuoteTotals(engine.quote.id);
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Sauvegarde impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function addSection(kind: "section" | "subsection") {
    if (!engine || !sectionForm.title.trim()) return;
    setSaving(true);
    try {
      await createCrmQuoteSection({
        quote_id: engine.quote.id,
        title: sectionForm.title,
        parent_id: kind === "subsection" ? sectionForm.parentId || null : null,
        section_type: kind,
        ordre: engine.sections.length + 1,
      });
      setSectionForm({ title: "", parentId: "" });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function addLine(kind: string, templateId?: string) {
    if (!engine) return;
    const template = templateId ? dataset.taskTemplates.find((row) => row.id === templateId) ?? null : null;
    const designation = template?.titre ?? lineForm.designation.trim();
    if (!designation && kind !== "page_break") return;
    setSaving(true);
    try {
      await createCrmQuoteItemFromTemplate({
        quote_id: engine.quote.id,
        section_id: lineForm.sectionId || null,
        lineType: kind,
        template,
        designation: kind === "page_break" ? "Saut de page" : designation,
        description: kind === "text" ? lineForm.designation : null,
        quantity: kind === "text" || kind === "page_break" ? 0 : lineForm.quantity,
        unit: lineForm.unit,
        unitPriceHt: kind === "text" || kind === "page_break" ? 0 : lineForm.unitPriceHt,
        tvaRate: lineForm.tvaRate,
        ordre: engine.items.length + 1,
      });
      setLineForm((prev) => ({ ...prev, designation: "", quantity: "1", unitPriceHt: "0" }));
      await refresh();
    } catch (err: any) {
      setError(err?.message ?? "Ajout de ligne impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function addPaymentTerm() {
    if (!engine || !paymentForm.label.trim()) return;
    setSaving(true);
    try {
      const percent = Number(paymentForm.percent || 0);
      await createCrmPaymentTerm({
        quote_id: engine.quote.id,
        label: paymentForm.label,
        percent,
        amount_ht: Number(engine.quote.montant_ht ?? 0) * (percent / 100),
        amount_ttc: Number(engine.quote.montant_ttc ?? 0) * (percent / 100),
        due_trigger: paymentForm.dueTrigger,
        ordre: engine.paymentTerms.length + 1,
      });
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function sendQuote() {
    if (!engine) return;
    await updateCrmQuote(engine.quote.id, { statut: "envoye", sent_at: new Date().toISOString() } as any);
    await refresh();
  }

  if (loading) {
    return <div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement du workspace devis...</div>;
  }

  if (!engine) {
    return <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error ?? "Devis introuvable."}</div>;
  }

  return (
    <div className="-m-4 min-h-[calc(100vh-2rem)] bg-slate-100 lg:-m-6">
      <header className="sticky top-0 z-30 border-b bg-white/95 px-4 py-3 backdrop-blur lg:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Workspace devis</div>
            <h1 className="text-xl font-semibold text-slate-950">Devis n° {engine.quote.quote_number}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setTab("edit")} className={["rounded-xl px-3 py-2 text-sm", tab === "edit" ? "bg-slate-900 text-white" : "border bg-white"].join(" ")}>Edition</button>
            <button onClick={() => setTab("preview")} className={["rounded-xl px-3 py-2 text-sm", tab === "preview" ? "bg-slate-900 text-white" : "border bg-white"].join(" ")}>Previsualisation</button>
            <div className="relative">
              <button onClick={() => setOptionsOpen((value) => !value)} className="rounded-xl border bg-white px-3 py-2 text-sm">Options</button>
              {optionsOpen ? (
                <div className="absolute right-0 z-40 mt-2 w-72 rounded-2xl border bg-white p-3 shadow-xl">
                  {Object.entries({
                    showMargins: "Afficher calcul marges",
                    lineDiscounts: "Afficher remises par ligne",
                    showReferences: "Afficher references",
                    showStocks: "Afficher stocks",
                    customNumbering: "Numerotation personnalisee",
                    showTypes: "Afficher types",
                    tvaCertificate: "Attestation TVA",
                    hideCompositeDetails: "Cacher details ouvrages",
                    showQuantityUnit: "Afficher quantite/unite",
                    showTva: "Afficher colonne TVA",
                    showSectionTotals: "Afficher totaux sections",
                  }).map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm hover:bg-slate-50">
                      <span>{label}</span>
                      <input type="checkbox" checked={options[key]} onChange={(event) => setOptions((prev) => ({ ...prev, [key]: event.target.checked }))} />
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
            <button onClick={() => navigate("/crm/devis")} className="rounded-xl border bg-white px-3 py-2 text-sm">Annuler</button>
            <button disabled={saving} onClick={saveQuote} className="rounded-xl border bg-white px-3 py-2 text-sm disabled:opacity-60">{saving ? "Enregistrement..." : "Enregistrer"}</button>
            <button onClick={sendQuote} className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">Envoyer</button>
            <Link to="/crm/devis" className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-white">Fermer</Link>
          </div>
        </div>
        {error ? <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      </header>

      <main className="grid gap-4 p-4 xl:grid-cols-[280px_minmax(0,1fr)_310px]">
        {tab === "edit" ? (
          <aside className="space-y-4 rounded-3xl border bg-white p-4">
            <div>
              <div className="font-semibold">Bibliotheque</div>
              <input className="mt-3 w-full rounded-xl border px-3 py-2 text-sm" placeholder="Rechercher ouvrage..." />
            </div>
            <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
              {dataset.taskTemplates.map((template) => (
                <button key={template.id} onClick={() => addLine("composite", template.id)} className="w-full rounded-2xl border bg-slate-50 p-3 text-left text-sm hover:bg-blue-50">
                  <div className="font-medium text-slate-950">{template.titre}</div>
                  <div className="mt-1 text-xs text-slate-500">{template.lot ?? "Sans famille"} · {template.unite ?? "u"} · {eur(template.cout_reference_unitaire_ht ?? 0)}</div>
                </button>
              ))}
            </div>
          </aside>
        ) : null}

        <section className={["space-y-4", tab === "preview" ? "xl:col-span-2" : ""].join(" ")}>
          {tab === "edit" ? (
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="grid gap-4 lg:grid-cols-4">
                <Input label="Numero devis" value={quoteForm.quote_number} onChange={(value) => setQuoteForm((prev) => ({ ...prev, quote_number: value }))} />
                <Input label="Date" type="date" value={quoteForm.date_emission} onChange={(value) => setQuoteForm((prev) => ({ ...prev, date_emission: value }))} />
                <Input label="Validite" type="date" value={quoteForm.valid_until} onChange={(value) => setQuoteForm((prev) => ({ ...prev, valid_until: value }))} />
                <Input label="Debut travaux" type="date" value={quoteForm.project_start} onChange={(value) => setQuoteForm((prev) => ({ ...prev, project_start: value }))} />
                <Input label="Duree estimee" value={quoteForm.estimated_duration} onChange={(value) => setQuoteForm((prev) => ({ ...prev, estimated_duration: value }))} />
                <Input label="Commercial" value={quoteForm.sales_owner} onChange={(value) => setQuoteForm((prev) => ({ ...prev, sales_owner: value }))} />
                <Input label="Client" value={entityLabel(account)} onChange={() => undefined} disabled />
                <Input label="Adresse chantier" value={[account?.adresse, account?.code_postal, account?.ville].filter(Boolean).join(" ")} onChange={() => undefined} disabled />
              </div>
              <label className="mt-4 block space-y-1 text-sm">
                <span className="text-slate-600">Description projet</span>
                <textarea className="min-h-24 w-full rounded-xl border px-3 py-2" value={quoteForm.description} onChange={(event) => setQuoteForm((prev) => ({ ...prev, description: event.target.value }))} />
              </label>
            </div>
          ) : (
            <PreviewDocument engine={engine} account={account} quoteForm={quoteForm} tvaRows={tvaRows} />
          )}

          {tab === "edit" ? (
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap gap-2">
                {["+ Fourniture", "+ Main d'oeuvre", "+ Ouvrage", "+ Section", "+ Sous-section", "+ Texte", "+ Saut de page"].map((label) => (
                  <button
                    key={label}
                    onClick={() => {
                      if (label.includes("Section") && !label.includes("Sous")) void addSection("section");
                      else if (label.includes("Sous")) void addSection("subsection");
                      else if (label.includes("Texte")) void addLine("text");
                      else if (label.includes("Saut")) void addLine("page_break");
                      else void addLine(label.includes("Ouvrage") ? "composite" : label.includes("Main") ? "labor" : "material");
                    }}
                    className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 lg:grid-cols-[1fr_1fr_100px_100px_120px_90px]">
                <Input label="Section a ajouter" value={sectionForm.title} onChange={(value) => setSectionForm((prev) => ({ ...prev, title: value }))} />
                <select className="rounded-xl border px-3 py-2 text-sm" value={sectionForm.parentId} onChange={(event) => setSectionForm((prev) => ({ ...prev, parentId: event.target.value }))}>
                  <option value="">Parent section</option>
                  {engine.sections.filter((row) => !row.parent_id).map((row) => <option key={row.id} value={row.id}>{row.title}</option>)}
                </select>
                <Input label="Qte" type="number" value={lineForm.quantity} onChange={(value) => setLineForm((prev) => ({ ...prev, quantity: value }))} />
                <Input label="Unite" value={lineForm.unit} onChange={(value) => setLineForm((prev) => ({ ...prev, unit: value }))} />
                <Input label="PU HT" type="number" value={lineForm.unitPriceHt} onChange={(value) => setLineForm((prev) => ({ ...prev, unitPriceHt: value }))} />
                <Input label="TVA" type="number" value={lineForm.tvaRate} onChange={(value) => setLineForm((prev) => ({ ...prev, tvaRate: value }))} />
                <label className="lg:col-span-2 block space-y-1 text-sm">
                  <span className="text-slate-600">Designation / texte libre</span>
                  <input className="w-full rounded-xl border px-3 py-2" value={lineForm.designation} onChange={(event) => setLineForm((prev) => ({ ...prev, designation: event.target.value }))} />
                </label>
                <select className="rounded-xl border px-3 py-2 text-sm" value={lineForm.sectionId} onChange={(event) => setLineForm((prev) => ({ ...prev, sectionId: event.target.value }))}>
                  <option value="">Sans section</option>
                  {engine.sections.map((row) => <option key={row.id} value={row.id}>{row.parent_id ? " - " : ""}{row.title}</option>)}
                </select>
              </div>
            </div>
          ) : null}

          {tab === "edit" ? (
            <QuoteTable engine={engine} options={options} componentsByItem={componentsByItem} onConfigure={setComponentItem} />
          ) : null}

          {tab === "edit" ? (
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-slate-950">Conditions de paiement et mentions</h2>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <Input label="Acompte %" type="number" value={quoteForm.acompte_percent} onChange={(value) => setQuoteForm((prev) => ({ ...prev, acompte_percent: value }))} />
                <Input label="Montant acompte" value={eur(depositTtc)} onChange={() => undefined} disabled />
                <Input label="Reste a facturer" value={eur(Number(engine.quote.montant_ttc ?? 0) - depositTtc)} onChange={() => undefined} disabled />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <TextArea label="Conditions libres" value={quoteForm.payment_terms_text} onChange={(value) => setQuoteForm((prev) => ({ ...prev, payment_terms_text: value }))} />
                <TextArea label="Gestion dechets" value={quoteForm.waste_management} onChange={(value) => setQuoteForm((prev) => ({ ...prev, waste_management: value }))} />
              </div>
              <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); void addPaymentTerm(); }}>
                <Input label="Echeance" value={paymentForm.label} onChange={(value) => setPaymentForm((prev) => ({ ...prev, label: value }))} />
                <Input label="%" type="number" value={paymentForm.percent} onChange={(value) => setPaymentForm((prev) => ({ ...prev, percent: value }))} />
                <Input label="Declencheur" value={paymentForm.dueTrigger} onChange={(value) => setPaymentForm((prev) => ({ ...prev, dueTrigger: value }))} />
                <button className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50">Ajouter echeance</button>
              </form>
            </div>
          ) : null}
        </section>

        <aside className="space-y-4 rounded-3xl border bg-white p-4 xl:sticky xl:top-24 xl:h-fit">
          <h2 className="font-semibold text-slate-950">Totaux</h2>
          <TotalLine label="Total net HT" value={eur(engine.quote.montant_ht)} />
          <TotalLine label="TVA" value={eur(Number(engine.quote.montant_ttc ?? 0) - Number(engine.quote.montant_ht ?? 0))} />
          <TotalLine label="Total TTC" value={eur(engine.quote.montant_ttc)} strong />
          <TotalLine label="Net a payer" value={eur(engine.quote.montant_ttc)} strong />
          <div className="border-t pt-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ventilation TVA</div>
            <div className="mt-2 space-y-2">
              {tvaRows.map((row) => (
                <div key={row.rate} className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="flex justify-between"><span>{row.rate}%</span><b>{eur(row.tva)}</b></div>
                  <div className="text-xs text-slate-500">Base {eur(row.base)}</div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => downloadCrmQuotePdf({ quote: engine.quote, client, prospect, lots: engine.lots, items: engine.items })} className="w-full rounded-xl border px-4 py-2 text-sm hover:bg-slate-50">Generer PDF</button>
        </aside>
      </main>

      {componentItem ? (
        <CompositeModal
          item={componentItem}
          components={componentsByItem.get(componentItem.id) ?? []}
          templates={dataset.taskTemplates}
          saving={saving}
          onClose={() => setComponentItem(null)}
          onSave={async (payload) => {
            setSaving(true);
            try {
              await createCrmQuoteComponent({ quote_id: engine.quote.id, quote_item_id: componentItem.id, ...payload } as any);
              await refresh();
            } finally {
              setSaving(false);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function QuoteTable({
  engine,
  options,
  componentsByItem,
  onConfigure,
}: {
  engine: CrmQuoteEngineData;
  options: Record<string, boolean>;
  componentsByItem: Map<string, CrmQuoteEngineData["components"]>;
  onConfigure: (item: CrmQuoteItemRow) => void;
}) {
  const sectionById = new Map(engine.sections.map((row) => [row.id, row]));
  return (
    <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            {["N°", "Designation", ...(options.showQuantityUnit ? ["Quantite", "Unite"] : []), "PU HT", ...(options.showTva ? ["TVA"] : []), "Total HT", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {engine.items.map((row, index) => {
            const section = row.section_id ? sectionById.get(row.section_id) : null;
            const components = componentsByItem.get(row.id) ?? [];
            return (
              <tr key={row.id} className="border-t align-top">
                <td className="px-4 py-3 text-slate-500">{row.numbering || index + 1}</td>
                <td className="px-4 py-3">
                  {section ? <div className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">{section.title}</div> : null}
                  <div className="font-medium text-slate-950">{row.designation}</div>
                  {options.showTypes ? <div className="mt-1 text-xs text-slate-500">{row.line_type}</div> : null}
                  {!options.hideCompositeDetails && components.length ? (
                    <div className="mt-2 space-y-1 text-xs text-slate-500">
                      {components.map((component) => <div key={component.id}>{component.component_type} · {component.designation} · {eur(component.total_sale_ht)}</div>)}
                    </div>
                  ) : null}
                </td>
                {options.showQuantityUnit ? <td className="px-4 py-3">{row.quantite}</td> : null}
                {options.showQuantityUnit ? <td className="px-4 py-3">{row.unite ?? ""}</td> : null}
                <td className="px-4 py-3">{eur(row.sale_unit_price_ht ?? row.prix_unitaire_ht)}</td>
                {options.showTva ? <td className="px-4 py-3">{row.tva_rate}%</td> : null}
                <td className="px-4 py-3 font-semibold">{eur(row.sale_total_ht ?? row.total_ht)}</td>
                <td className="px-4 py-3"><button onClick={() => onConfigure(row)} className="rounded-xl border px-3 py-2 text-xs hover:bg-slate-50">Configurer elements</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PreviewDocument({ engine, account, quoteForm, tvaRows }: { engine: CrmQuoteEngineData; account: CrmClientRow | CrmProspectRow | null; quoteForm: Record<string, string>; tvaRows: Array<{ rate: number; base: number; tva: number }> }) {
  return (
    <div className="mx-auto max-w-4xl rounded-3xl border bg-white p-8 shadow-sm">
      <div className="flex items-start justify-between gap-6 border-b pb-6">
        <div>
          <div className="text-2xl font-bold text-slate-950">Batipro</div>
          <div className="mt-2 text-sm text-slate-500">Coordonnees entreprise · SIRET · Assurance decennale</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold">Devis {engine.quote.quote_number}</div>
          <div className="text-sm text-slate-500">Date {quoteForm.date_emission || "—"} · Validite {quoteForm.valid_until || "—"}</div>
        </div>
      </div>
      <div className="grid gap-6 border-b py-6 md:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Client</div>
          <div className="mt-2 font-semibold">{entityLabel(account)}</div>
          <div className="text-sm text-slate-500">{[account?.adresse, account?.code_postal, account?.ville].filter(Boolean).join(" ")}</div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Projet</div>
          <p className="mt-2 text-sm text-slate-700">{quoteForm.description || "Description projet a completer."}</p>
        </div>
      </div>
      <table className="mt-6 w-full text-sm">
        <thead className="border-b text-slate-500">
          <tr><th className="py-2 text-left">Designation</th><th className="py-2 text-right">Total HT</th></tr>
        </thead>
        <tbody>
          {engine.items.map((row) => <tr key={row.id} className="border-b"><td className="py-3">{row.designation}</td><td className="py-3 text-right">{eur(row.sale_total_ht ?? row.total_ht)}</td></tr>)}
        </tbody>
      </table>
      <div className="mt-6 flex justify-end">
        <div className="w-72 space-y-2 text-sm">
          <TotalLine label="Total HT" value={eur(engine.quote.montant_ht)} />
          {tvaRows.map((row) => <TotalLine key={row.rate} label={`TVA ${row.rate}%`} value={eur(row.tva)} />)}
          <TotalLine label="Total TTC" value={eur(engine.quote.montant_ttc)} strong />
        </div>
      </div>
      <div className="mt-8 border-t pt-6 text-sm text-slate-600">
        <div className="font-semibold text-slate-950">Conditions</div>
        <p className="mt-2">{quoteForm.payment_terms_text || "Conditions de paiement a completer."}</p>
        <div className="mt-10 rounded-2xl border p-6 text-center text-slate-500">Bon pour accord, date et signature client</div>
      </div>
    </div>
  );
}

function CompositeModal({
  item,
  components,
  templates,
  saving,
  onClose,
  onSave,
}: {
  item: CrmQuoteItemRow;
  components: CrmQuoteEngineData["components"];
  templates: CrmDataset["taskTemplates"];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState<Record<string, string>>({ component_type: "material", designation: "", quantity: "1", unit: "u", purchase_unit_price_ht: "0", sale_unit_price_ht: "0", tva_rate: "20" });
  const debourse = components.reduce((sum, row) => sum + Number(row.total_cost_ht ?? 0), 0);
  const sale = components.reduce((sum, row) => sum + Number(row.total_sale_ht ?? 0), 0);
  const margin = sale - debourse;
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/40 p-4" onClick={onClose}>
      <div className="mx-auto my-8 max-w-4xl rounded-3xl border bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">Configurer les elements de l'ouvrage</h2>
            <div className="mt-1 text-sm text-slate-500">{item.designation}</div>
          </div>
          <button onClick={onClose} className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50">Fermer</button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <TotalCard label="Debourse sec HT" value={eur(debourse)} />
          <TotalCard label="Prix vente HT" value={eur(sale)} />
          <TotalCard label="Marge brute" value={eur(margin)} />
          <TotalCard label="Taux marge" value={`${sale ? Math.round((margin / sale) * 100) : 0}%`} />
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <section className="rounded-2xl border bg-slate-50 p-4">
            <div className="font-semibold">Recherche bibliotheque</div>
            <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
              {templates.slice(0, 12).map((template) => (
                <button key={template.id} onClick={() => setForm((prev) => ({ ...prev, designation: template.titre, unit: template.unite ?? "u", purchase_unit_price_ht: String(template.cout_reference_unitaire_ht ?? 0), sale_unit_price_ht: String(template.cout_reference_unitaire_ht ?? 0) }))} className="w-full rounded-xl border bg-white p-3 text-left text-sm hover:bg-blue-50">
                  {template.titre}
                </button>
              ))}
            </div>
          </section>
          <form className="rounded-2xl border p-4" onSubmit={(event) => { event.preventDefault(); void onSave(form); }}>
            <div className="grid gap-3 md:grid-cols-2">
              <Input label="Type" value={form.component_type} onChange={(value) => setForm((prev) => ({ ...prev, component_type: value }))} />
              <Input label="Designation" value={form.designation} onChange={(value) => setForm((prev) => ({ ...prev, designation: value }))} />
              <Input label="Quantite" type="number" value={form.quantity} onChange={(value) => setForm((prev) => ({ ...prev, quantity: value }))} />
              <Input label="Unite" value={form.unit} onChange={(value) => setForm((prev) => ({ ...prev, unit: value }))} />
              <Input label="Prix achat HT" type="number" value={form.purchase_unit_price_ht} onChange={(value) => setForm((prev) => ({ ...prev, purchase_unit_price_ht: value }))} />
              <Input label="Prix vente HT" type="number" value={form.sale_unit_price_ht} onChange={(value) => setForm((prev) => ({ ...prev, sale_unit_price_ht: value }))} />
            </div>
            <button disabled={saving} className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-60">Ajouter composant</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", disabled = false }: { label: string; value?: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <input className="w-full rounded-xl border px-3 py-2 disabled:bg-slate-50 disabled:text-slate-500" type={type} value={value ?? ""} onChange={(event) => onChange(event.target.value)} disabled={disabled} />
    </label>
  );
}

function TextArea({ label, value, onChange }: { label: string; value?: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <textarea className="min-h-28 w-full rounded-xl border px-3 py-2" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TotalLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className={["flex justify-between gap-3", strong ? "text-base font-semibold text-slate-950" : "text-sm text-slate-600"].join(" ")}><span>{label}</span><span>{value}</span></div>;
}

function TotalCard({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-slate-50 p-4"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div><div className="mt-1 text-lg font-semibold">{value}</div></div>;
}
