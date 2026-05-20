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
  estimated_amount: 0,
  comment: "",
  date: new Date().toISOString().slice(0, 10),
  status: "nouveau" as ApporteurLeadStatus,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
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
      if (!jwt) throw new Error("Accès non autorisé.");
      await createApporteurLeadPortal(jwt, {
        apporteur_id: portalData.apporteur.id,
        organization_id: portalData.apporteur.organization_id,
        client_name: leadForm.client_name,
        telephone: leadForm.telephone || null,
        project_address: leadForm.project_address || null,
        project_type: leadForm.project_type || null,
        estimated_amount: Number(leadForm.estimated_amount) || 0,
        comment: leadForm.comment || null,
        date: leadForm.date,
        status: leadForm.status,
      });
      setActNotice("Lead ajouté.");
      setLeadForm(DEFAULT_LEAD_FORM);
      const accessResult = await checkApporteurToken(token);
      const refreshed = await getApporteurPortalData(jwt, accessResult.apporteur_id);
      setPortalData(refreshed);
    } catch (err: any) {
      setActError(err?.message ?? "Impossible d'ajouter le lead.");
    } finally {
      setActSaving(false);
    }
  }

  const [actError, setActError] = useState<string | null>(null);

  if (loading) {
    return <PublicShell><div className="rounded-3xl border bg-white p-8 text-center text-sm text-slate-500">Chargement du portail apporteur...</div></PublicShell>;
  }

  if (portalError) {
    return <PublicShell><div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">{portalError}</div></PublicShell>;
  }

  return (
    <PublicShell>
      <div className="space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Portail apporteur</div>
              <h1 className="mt-3 text-2xl font-semibold text-slate-950">{portalData.apporteur?.nom || "Apporteur"}</h1>
              <p className="mt-2 text-sm text-slate-500">Ajoutez des leads, suivez vos commissions et téléchargez vos documents.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="text-xs text-slate-500">Leads</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{portalData.leads.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="text-xs text-slate-500">Commission payée</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(paidCommission)}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <div className="text-xs text-slate-500">Commission due</div>
                <div className="mt-2 text-lg font-semibold text-slate-950">{formatCurrency(unpaidCommission)}</div>
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6">
            <div className="text-sm font-semibold text-slate-900">Ajouter un lead</div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="space-y-1 text-sm text-slate-700">
                <div>Client</div>
                <input className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={leadForm.client_name} onChange={(e) => setLeadForm((prev) => ({ ...prev, client_name: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <div>Téléphone</div>
                <input className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={leadForm.telephone} onChange={(e) => setLeadForm((prev) => ({ ...prev, telephone: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <div>Adresse projet</div>
                <input className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={leadForm.project_address} onChange={(e) => setLeadForm((prev) => ({ ...prev, project_address: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <div>Type projet</div>
                <input className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={leadForm.project_type} onChange={(e) => setLeadForm((prev) => ({ ...prev, project_type: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <div>Montant estimé</div>
                <input type="number" step="0.01" className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={leadForm.estimated_amount} onChange={(e) => setLeadForm((prev) => ({ ...prev, estimated_amount: Number(e.target.value) }))} />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <div>Statut</div>
                <select className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={leadForm.status} onChange={(e) => setLeadForm((prev) => ({ ...prev, status: e.target.value as ApporteurLeadStatus }))}>
                  {LEAD_STATUSES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="md:col-span-2 space-y-1 text-sm text-slate-700">
                <div>Commentaire</div>
                <textarea className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={leadForm.comment} onChange={(e) => setLeadForm((prev) => ({ ...prev, comment: e.target.value }))} />
              </label>
              <label className="space-y-1 text-sm text-slate-700">
                <div>Date</div>
                <input type="date" className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm" value={leadForm.date} onChange={(e) => setLeadForm((prev) => ({ ...prev, date: e.target.value }))} />
              </label>
            </div>
            {actError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{actError}</div> : null}
            {actNotice ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{actNotice}</div> : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" disabled={actSaving} onClick={() => void onSubmitLead()} className="rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-800 disabled:bg-slate-300">Ajouter le lead</button>
              <button type="button" onClick={() => setLeadForm(DEFAULT_LEAD_FORM)} className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Réinitialiser</button>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="text-sm font-semibold text-slate-900">Vos commissions</div>
              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Commission due</div>
                  <div className="mt-2 text-xl font-semibold text-slate-950">{formatCurrency(unpaidCommission)}</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">Commission payée</div>
                  <div className="mt-2 text-xl font-semibold text-slate-950">{formatCurrency(paidCommission)}</div>
                </div>
              </div>
            </section>
            <section className="rounded-3xl border border-slate-200 bg-white p-6">
              <div className="text-sm font-semibold text-slate-900">Documents</div>
              {portalData.documents.length ? (
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  {portalData.documents.map((document) => (
                    <li key={document.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="font-semibold text-slate-900">{document.label}</div>
                      <a href={document.file_path} target="_blank" rel="noreferrer" className="mt-2 inline-block text-blue-600 underline">Télécharger</a>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mt-4 text-sm text-slate-500">Aucun document disponible pour le moment.</div>
              )}
            </section>
          </aside>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6">
          <div className="text-sm font-semibold text-slate-900">Vos leads</div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm text-slate-700">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left">Client</th>
                  <th className="px-4 py-3 text-left">Montant</th>
                  <th className="px-4 py-3 text-left">Statut</th>
                  <th className="px-4 py-3 text-left">Commission</th>
                  <th className="px-4 py-3 text-left">Date</th>
                </tr>
              </thead>
              <tbody>
                {portalData.leads.map((lead) => (
                  <tr key={lead.id} className="border-t border-slate-200">
                    <td className="px-4 py-3">{lead.client_name}</td>
                    <td className="px-4 py-3">{formatCurrency(lead.estimated_amount)}</td>
                    <td className="px-4 py-3">{LEAD_STATUSES.find((item) => item.value === lead.status)?.label}</td>
                    <td className="px-4 py-3">{formatCurrency(commissionAmount(lead, portalData.apporteur))}</td>
                    <td className="px-4 py-3">{lead.date}</td>
                  </tr>
                ))}
                {portalData.leads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-500">Aucun lead enregistré pour le moment.</td>
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
