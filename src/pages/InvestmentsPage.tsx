import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Building2, CalendarDays, CirclePause, Landmark, Pencil, Plus, Save, Target, Trash2, X } from "lucide-react";
import { FinancialNavigation } from "../features/financial/components/FinancialNavigation";
import {
  getCompanySettings,
  getInvestmentMonthlyTotal,
  investmentMonthlyContribution,
  upsertCompanySettings,
  type CompanyInvestmentCategory,
  type CompanyInvestmentEntry,
} from "../services/companySettings.service";

const CATEGORIES: Array<{ value: CompanyInvestmentCategory; label: string }> = [
  { value: "materiel", label: "Matériel" },
  { value: "services", label: "Services" },
  { value: "vehicules", label: "Véhicules" },
  { value: "locaux", label: "Locaux" },
  { value: "numerique", label: "Numérique & logiciels" },
  { value: "recrutement", label: "Recrutement" },
  { value: "formation", label: "Formation" },
  { value: "communication", label: "Communication" },
  { value: "autre", label: "Autre" },
];
const INPUT_CLASS = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function createInvestment(): CompanyInvestmentEntry {
  return {
    id: "",
    name: "",
    category: "materiel",
    targetAmountHt: 0,
    durationMonths: 12,
    startDate: new Date().toISOString().slice(0, 10),
    notes: "",
    status: "planned",
  };
}

export default function InvestmentsPage() {
  const [entries, setEntries] = useState<CompanyInvestmentEntry[]>([]);
  const [form, setForm] = useState<CompanyInvestmentEntry>(() => createInvestment());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | CompanyInvestmentCategory>("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const settings = await getCompanySettings();
      setEntries(settings.investment_plan?.entries ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Impossible de charger le plan d'investissement.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const active = useMemo(() => entries.filter((entry) => entry.status === "planned"), [entries]);
  const monthlyTotal = getInvestmentMonthlyTotal(entries);
  const targetTotal = active.reduce((sum, entry) => sum + entry.targetAmountHt, 0);
  const filtered = filter === "all" ? entries : entries.filter((entry) => entry.category === filter);
  const next = [...active].sort((a, b) => targetDate(a).getTime() - targetDate(b).getTime())[0];

  function openNew() {
    setEditingId(null);
    setForm(createInvestment());
    setError(null);
    setNotice(null);
    setDrawerOpen(true);
  }

  function openEdit(entry: CompanyInvestmentEntry) {
    setEditingId(entry.id);
    setForm({ ...entry });
    setError(null);
    setNotice(null);
    setDrawerOpen(true);
  }

  async function persist(next: CompanyInvestmentEntry[], message: string) {
    setSaving(true);
    setError(null);
    try {
      const saved = await upsertCompanySettings({ investment_plan: { entries: next } });
      setEntries(saved.investment_plan?.entries ?? []);
      setDrawerOpen(false);
      setNotice(message);
    } catch (err: any) {
      setError(err?.message ?? "Impossible d'enregistrer l'investissement.");
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!form.name.trim()) return setError("Le nom de l'investissement est requis.");
    if (!(form.targetAmountHt > 0)) return setError("Le budget doit être supérieur à 0 €.");
    if (!(form.durationMonths >= 1)) return setError("La durée doit être d'au moins un mois.");
    const entry = { ...form, id: editingId ?? crypto.randomUUID(), name: form.name.trim() };
    const nextEntries = editingId ? entries.map((item) => item.id === editingId ? entry : item) : [...entries, entry];
    await persist(nextEntries, editingId ? "Investissement mis à jour." : "Investissement ajouté au plan.");
  }

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-500"><Landmark className="h-6 w-6" /></div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">Pilotage financier</div>
              <h1 className="mt-1 text-2xl font-bold">Plan d'investissement</h1>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">Transformez chaque objectif d'achat en effort mensuel réaliste, intégré à votre pilotage de rentabilité.</p>
            </div>
          </div>
          <button type="button" onClick={openNew} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white hover:bg-blue-400"><Plus className="h-4 w-4" /> Ajouter un investissement</button>
        </div>
      </header>

      <FinancialNavigation />
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{notice}</div> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Target />} label="Objectifs actifs" value={String(active.length)} hint="Investissements à financer" />
        <Metric icon={<Landmark />} label="Budget visé" value={formatCurrency(targetTotal)} hint="Total HT des objectifs actifs" />
        <Metric icon={<CalendarDays />} label="Effort mensuel" value={formatCurrency(monthlyTotal)} hint="Ajouté aux charges prévisionnelles" accent />
        <Metric icon={<Building2 />} label="Prochaine échéance" value={next ? formatMonth(targetDate(next)) : "—"} hint={next?.name ?? "Aucun objectif actif"} />
      </section>

      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
        <strong>À savoir :</strong> cette mensualité est une réserve de pilotage pour financer vos objectifs. Elle est incluse dans les charges prévisionnelles et le seuil de rentabilité, sans être présentée comme une écriture comptable réelle.
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
          <div><h2 className="font-semibold text-slate-950">Feuille de route</h2><p className="mt-1 text-sm text-slate-500">Un objectif, une durée, une mensualité lisible.</p></div>
          <div className="flex max-w-full gap-2 overflow-x-auto">
            <Filter active={filter === "all"} onClick={() => setFilter("all")}>Tous</Filter>
            {CATEGORIES.map((category) => <Filter key={category.value} active={filter === category.value} onClick={() => setFilter(category.value)}>{category.label}</Filter>)}
          </div>
        </div>
        {loading ? <div className="p-10 text-center text-sm text-slate-500">Chargement du plan...</div> : null}
        {!loading && filtered.length === 0 ? <div className="p-10 text-center"><Target className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-medium text-slate-700">Aucun investissement dans cette vue</p><p className="mt-1 text-sm text-slate-500">Ajoutez votre premier objectif pour calculer l'effort mensuel.</p></div> : null}
        {!loading && filtered.length ? <div className="grid gap-4 p-5 lg:grid-cols-2">{filtered.map((entry) => (
          <article key={entry.id} className="rounded-2xl border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{categoryLabel(entry.category)}</span><Status status={entry.status} /></div><h3 className="mt-3 text-lg font-bold text-slate-950">{entry.name}</h3></div>
              <div className="flex gap-1"><IconButton label="Modifier" onClick={() => openEdit(entry)}><Pencil /></IconButton><IconButton label="Supprimer" danger onClick={() => void persist(entries.filter((item) => item.id !== entry.id), "Investissement supprimé.")}><Trash2 /></IconButton></div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-3 border-y border-slate-100 py-4 text-sm"><Value label="Objectif" value={formatCurrency(entry.targetAmountHt)} /><Value label="Durée" value={`${entry.durationMonths} mois`} /><Value label="Mensualité" value={formatCurrency(investmentMonthlyContribution(entry))} strong /></div>
            <div className="mt-4 flex items-center justify-between text-sm"><span className="text-slate-500">Acquisition visée</span><span className="font-semibold text-slate-800">{formatMonth(targetDate(entry))}</span></div>
            {entry.notes ? <p className="mt-3 line-clamp-2 text-sm text-slate-500">{entry.notes}</p> : null}
          </article>
        ))}</div> : null}
      </section>

      {drawerOpen ? <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onMouseDown={() => !saving && setDrawerOpen(false)}><aside className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-5"><div><div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Objectif financier</div><h2 className="mt-1 text-xl font-bold">{editingId ? "Modifier l'investissement" : "Nouvel investissement"}</h2></div><IconButton label="Fermer" onClick={() => setDrawerOpen(false)}><X /></IconButton></div>
        <div className="space-y-5 p-5">
          <Field label="Nom de l'investissement"><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Mini-pelle, nouveau local..." className={INPUT_CLASS} /></Field>
          <Field label="Catégorie"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as CompanyInvestmentCategory })} className={INPUT_CLASS}>{CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</select></Field>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Budget cible HT"><input type="number" min="0" step="0.01" value={form.targetAmountHt || ""} onChange={(e) => setForm({ ...form, targetAmountHt: Number(e.target.value) })} className={INPUT_CLASS} /></Field><Field label="Durée souhaitée (mois)"><input type="number" min="1" step="1" value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: Number(e.target.value) })} className={INPUT_CLASS} /></Field></div>
          <Field label="Début du financement"><input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={INPUT_CLASS} /></Field>
          <Field label="Statut"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CompanyInvestmentEntry["status"] })} className={INPUT_CLASS}><option value="planned">À financer</option><option value="paused">En pause</option><option value="acquired">Acquis</option></select></Field>
          <Field label="Notes"><textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Contexte, modèle envisagé, fournisseur..." className={`${INPUT_CLASS} h-auto resize-none py-3`} /></Field>
          <div className="rounded-2xl bg-slate-950 p-4 text-white"><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Effort mensuel calculé</div><div className="mt-2 text-3xl font-bold">{formatCurrency(investmentMonthlyContribution({ ...form, status: "planned" }))}</div><div className="mt-1 text-sm text-slate-300">sur {Math.max(1, form.durationMonths || 1)} mois</div></div>
        </div>
        <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-200 bg-white p-5"><button type="button" onClick={() => setDrawerOpen(false)} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold">Annuler</button><button type="button" disabled={saving} onClick={() => void save()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-60"><Save className="h-4 w-4" /> {saving ? "Enregistrement..." : "Enregistrer"}</button></div>
      </aside></div> : null}
    </div>
  );
}

function targetDate(entry: CompanyInvestmentEntry) { const date = new Date(`${entry.startDate}T12:00:00`); date.setMonth(date.getMonth() + entry.durationMonths); return date; }
function formatCurrency(value: number) { return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value || 0); }
function formatMonth(value: Date) { return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(value); }
function categoryLabel(value: CompanyInvestmentCategory) { return CATEGORIES.find((item) => item.value === value)?.label ?? "Autre"; }
function Status({ status }: { status: CompanyInvestmentEntry["status"] }) { const labels = { planned: "À financer", paused: "En pause", acquired: "Acquis" }; return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status === "planned" ? "bg-blue-50 text-blue-700" : status === "acquired" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{status === "paused" ? <CirclePause className="mr-1 inline h-3 w-3" /> : null}{labels[status]}</span>; }
function Metric({ icon, label, value, hint, accent = false }: { icon: ReactNode; label: string; value: string; hint: string; accent?: boolean }) { return <div className={`rounded-2xl border p-4 ${accent ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}><div className={`flex h-9 w-9 items-center justify-center rounded-xl [&>svg]:h-4 [&>svg]:w-4 ${accent ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>{icon}</div><div className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold text-slate-950">{value}</div><div className="mt-1 truncate text-xs text-slate-500">{hint}</div></div>; }
function Filter({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) { return <button type="button" onClick={onClick} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{children}</button>; }
function Value({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) { return <div><div className="text-xs text-slate-500">{label}</div><div className={`mt-1 ${strong ? "font-bold text-blue-700" : "font-semibold text-slate-900"}`}>{value}</div></div>; }
function IconButton({ label, onClick, children, danger = false }: { label: string; onClick: () => void; children: ReactNode; danger?: boolean }) { return <button type="button" aria-label={label} title={label} onClick={onClick} className={`rounded-lg border p-2 [&>svg]:h-4 [&>svg]:w-4 ${danger ? "border-red-200 text-red-600 hover:bg-red-50" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{children}</button>; }
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-semibold text-slate-800">{label}</span>{children}</label>; }
