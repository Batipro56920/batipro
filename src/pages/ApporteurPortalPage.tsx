import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import {
  checkApporteurToken,
  createApporteurLeadPortal,
  getApporteurPortalData,
} from "../services/apporteurs.service";
import type {
  ApporteurAffaireRow,
  ApporteurLeadRow,
  ApporteurDocumentRow,
  ApporteurLeadStatus,
} from "../services/apporteurs.service";

const LEAD_STATUSES: { value: ApporteurLeadStatus; label: string }[] = [
  { value: "nouveau", label: "Nouveau" },
  { value: "contacte", label: "Contacté" },
  { value: "devis_envoye", label: "Devis envoyé" },
  { value: "signe", label: "Signé" },
  { value: "perdu", label: "Perdu" },
  { value: "commission_a_payer", label: "Commission à payer" },
  { value: "paye", label: "Payé" },
];

const DEFAULT_LEAD_FORM = {
  client_name: "",
  telephone: "",
  project_address: "",
  project_type: "",
  estimated_amount: "",
  comment: "",
  date: new Date().toISOString().slice(0, 10),
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}

function parseFrenchNumber(value: string) {
  const text = value.trim().replace(/\u00a0/g, " ");
  if (!text) return 0;
  if (/[.,]$/.test(text)) throw new Error("Le montant estimé est incomplet.");

  const compact = text.replace(/\s/g, "").replace(/€/g, "");
  const commaCount = (compact.match(/,/g) ?? []).length;
  if (commaCount > 1) throw new Error("Le montant estimé doit être un nombre valide.");

  let normalized = compact;
  if (commaCount === 1) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else {
    const dotGroups = compact.split(".");
    if (dotGroups.length > 2) {
      const validThousands = dotGroups.every((group, index) => (index === 0 ? /^\d{1,3}$/.test(group) : /^\d{3}$/.test(group)));
      if (!validThousands) throw new Error("Le montant estimé doit être un nombre valide.");
      normalized = dotGroups.join("");
    } else if (/^\d+\.\d{3}$/.test(compact)) {
      normalized = compact.replace(".", "");
    }
  }

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error("Le montant estimé doit être un nombre valide.");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error("Le montant estimé doit être un nombre valide.");
  return parsed;
}

function commissionAmount(lead: ApporteurLeadRow, apporteur: ApporteurAffaireRow | null) {
  if (!apporteur) return 0;
  if (apporteur.calculation_mode === "fixe") return apporteur.commission_percent;
  return Math.round((lead.estimated_amount * apporteur.commission_percent) / 100 * 100) / 100;
}

export default function ApporteurPortalPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [loading, setLoading] = useState(true);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [jwt, setJwt] = useState<string | null>(null);
  const [portalData, setPortalData] = useState<{ apporteur: ApporteurAffaireRow | null; leads: ApporteurLeadRow[]; documents: ApporteurDocumentRow[] }>({ apporteur: null, leads: [], documents: [] });
  const [leadForm, setLeadForm] = useState<typeof DEFAULT_LEAD_FORM>(DEFAULT_LEAD_FORM);
  const [actSaving, setActSaving] = useState(false);
  const [actNotice, setActNotice] = useState<string | null>(null);
  const [actError, setActError] = useState<string | null>(null);

  const unpaidCommission = useMemo(() => portalData.leads.filter((lead) => lead.status !== "paye").reduce((sum, lead) => sum + commissionAmount(lead, portalData.apporteur), 0), [portalData]);
  const paidCommission = useMemo(() => portalData.leads.filter((lead) => lead.status === "paye").reduce((sum, lead) => sum + commissionAmount(lead, portalData.apporteur), 0), [portalData]);

  useEffect(() => {
    let alive = true;
    async function fetchToken() {
      setLoading(true);
      setPortalError(null);
      try {
        if (!token) throw new Error("Token manquant.");
        const result = await checkApporteurToken(token);
        if (!alive) return;
        setJwt(result.jwt);
      } catch (err: any) {
        if (!alive) return;
        setPortalError(err?.message ?? "Accès refusé.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void fetchToken();
    return () => { alive = false; };
  }, [token]);

  useEffect(() => {
    if (!jwt) return;
    const jwtToken = jwt;
    let alive = true;
    async function fetchData() {
      setLoading(true);
      setPortalError(null);
      try {
        const accessResult = await checkApporteurToken(token);
        const result = await getApporteurPortalData(jwtToken, accessResult.apporteur_id);
        if (!alive) return;
        setPortalData(result);
      } catch (err: any) {
        if (!alive) return;
        setPortalError(err?.message ?? "Impossible de charger les données apporteur.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void fetchData();
    return () => { alive = false; };
  }, [jwt, token]);

  async function onSubmitLead() {
    setActSaving(true);
    setActError(null);
    setActNotice(null);
    try {
      if (!portalData.apporteur) throw new Error("Apporteur non trouvé.");
      if (!leadForm.client_name.trim()) throw new Error("Le nom du client est requis.");
      if (!leadForm.telephone.trim()) throw new Error("Le téléphone du client est requis.");
      if (!jwt) throw new Error("Accès non autorisé.");
      await createApporteurLeadPortal(jwt, {
        apporteur_id: portalData.apporteur.id,
        organization_id: portalData.apporteur.organization_id,
        client_name: leadForm.client_name,
        telephone: leadForm.telephone || null,
        project_address: leadForm.project_address || null,
        project_type: leadForm.project_type || null,
        estimated_amount: parseFrenchNumber(leadForm.estimated_amount),
        comment: leadForm.comment || null,
        date: leadForm.date,
      });
      setActNotice("Client transmis. L'équipe prendra le relais.");
      setLeadForm(DEFAULT_LEAD_FORM);
      const accessResult = await checkApporteurToken(token);
      const refreshed = await getApporteurPortalData(jwt, accessResult.apporteur_id);
      setPortalData(refreshed);
    } catch (err: any) {
      setActError(err?.message ?? "Impossible de transmettre le client.");
    } finally {
      setActSaving(false);
    }
  }

  if (loading) {
    return <PublicShell><div className="bt-card rounded-xl p-8 text-center text-sm text-slate-500">Chargement du portail apporteur...</div></PublicShell>;
  }

  if (portalError) {
    return <PublicShell><div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">{portalError}</div></PublicShell>;
  }

  return (
    <PublicShell>
      <div className="space-y-5">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="section-title text-xs font-semibold uppercase tracking-[0.16em]">Portail apporteur</div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">{portalData.apporteur?.nom || "Apporteur"}</h1>
            <p className="mt-1 text-sm text-slate-500">Transmettez les coordonnées client. Batipro reprend ensuite le suivi commercial.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Metric label="Clients transmis" value={String(portalData.leads.length)} />
            <Metric label="Commission due" value={formatCurrency(unpaidCommission)} />
            <Metric label="Commission payée" value={formatCurrency(paidCommission)} />
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="bt-card rounded-xl bg-white p-5">
            <div className="text-sm font-semibold text-slate-950">Transmettre un client</div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Input label="Nom du client" value={leadForm.client_name} onChange={(value) => setLeadForm((prev) => ({ ...prev, client_name: value }))} />
              <Input label="Téléphone" value={leadForm.telephone} onChange={(value) => setLeadForm((prev) => ({ ...prev, telephone: value }))} />
              <Input label="Adresse du projet" value={leadForm.project_address} onChange={(value) => setLeadForm((prev) => ({ ...prev, project_address: value }))} />
              <Input label="Nature des travaux" value={leadForm.project_type} onChange={(value) => setLeadForm((prev) => ({ ...prev, project_type: value }))} />
              <Input label="Montant estimé des travaux" value={leadForm.estimated_amount} inputMode="decimal" onChange={(value) => setLeadForm((prev) => ({ ...prev, estimated_amount: value }))} />
              <div className="md:col-span-2"><Textarea label="Informations utiles" value={leadForm.comment} onChange={(value) => setLeadForm((prev) => ({ ...prev, comment: value }))} /></div>
            </div>
            {actError ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actError}</div> : null}
            {actNotice ? <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{actNotice}</div> : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" disabled={actSaving} onClick={() => void onSubmitLead()} className={primaryButtonClass}>Transmettre le client</button>
              <button type="button" onClick={() => setLeadForm(DEFAULT_LEAD_FORM)} className={secondaryButtonClass}>Réinitialiser</button>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="bt-card rounded-xl bg-white p-4">
              <div className="text-sm font-semibold text-slate-950">Documents</div>
              {portalData.documents.length ? (
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {portalData.documents.map((document) => (
                    <li key={document.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="font-semibold text-slate-900">{document.label}</div>
                      <a href={document.file_path} target="_blank" rel="noreferrer" className="mt-2 inline-block text-blue-700 underline">Télécharger</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-3 text-sm text-slate-500">Aucun document disponible pour le moment.</div>
              )}
            </section>
          </aside>
        </div>

        <section className="bt-card rounded-xl bg-white p-4">
          <div className="mb-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Suivi</div><h2 className="mt-1 text-lg font-semibold text-slate-950">Clients transmis</h2></div>
          <div className="overflow-x-auto">
            <table className="bt-table min-w-full">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Projet</th>
                  <th>Montant estimé</th>
                  <th>Statut</th>
                  <th>Commission</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {portalData.leads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="align-top"><div className="font-semibold text-slate-950">{lead.client_name}</div><div className="text-xs text-slate-500">{lead.telephone || "-"}</div></td>
                    <td className="align-top"><div>{lead.project_type || "-"}</div><div className="text-xs text-slate-500">{lead.project_address || ""}</div></td>
                    <td className="align-top">{formatCurrency(lead.estimated_amount)}</td>
                    <td className="align-top">{LEAD_STATUSES.find((item) => item.value === lead.status)?.label}</td>
                    <td className="align-top">{formatCurrency(commissionAmount(lead, portalData.apporteur))}</td>
                    <td className="align-top">{lead.date}</td>
                  </tr>
                ))}
                {portalData.leads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">Aucun client transmis pour le moment.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-slate-100 px-4 py-6 text-slate-950 lg:px-8"><div className="mx-auto max-w-7xl">{children}</div></main>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="bt-card rounded-xl bg-white p-4"><div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div><div className="mt-2 text-lg font-bold text-slate-950">{value}</div></div>;
}

function Input({ label, value, onChange, inputMode }: { label: string; value: string; onChange: (value: string) => void; inputMode?: "decimal" }) {
  return <label className="block text-sm"><span className="text-xs font-medium text-slate-600">{label}</span><input inputMode={inputMode} className={`${inputClass} mt-1`} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm"><span className="text-xs font-medium text-slate-600">{label}</span><textarea className={`${inputClass} mt-1 min-h-24`} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

const inputClass = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const primaryButtonClass = "rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-600";
const secondaryButtonClass = "rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700";