import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, BrainCircuit, CheckCircle2, ChevronDown, ChevronUp, Clock3, Database, ExternalLink, Loader2, PauseCircle, RefreshCw, RotateCcw, Save, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { COCO_LEARNING_SOURCES, DEFAULT_COCO_LEARNING_SETTINGS, analyzeCocoLearning, applyCocoImprovementAction, getCocoLearningSettings, regenerateCocoImprovementProposal, saveCocoLearningSettings, setCocoDetectionState, type CocoImprovementOption, type CocoImprovementPlan, type CocoLearningSettings, type CocoLearningSignal, type CocoLearningSourceKey } from "../services/cocoImprovement.service";

const categoryLabel: Record<CocoLearningSignal["category"], string> = { temps: "Temps", materiaux: "Matériaux", materiel: "Matériel", methode: "Méthode", qualite: "Qualité", planning: "Planning", achats: "Achats" };

function SignalCard({ signal, onChanged }: { signal: CocoLearningSignal; onChanged: (signal: CocoLearningSignal, state: "applied" | "active" | "pending" | "dismissed", message: string) => void }) {
  const immediate = signal.kind === "immediate";
  const [selectedOptionId, setSelectedOptionId] = useState(signal.actionOptions[0]?.id ?? "");
  const selectedOption = signal.actionOptions.find((option) => option.id === selectedOptionId) ?? signal.actionOptions[0];
  const [decision, setDecision] = useState(selectedOption?.proposal ?? signal.proposedAction);
  const [plan, setPlan] = useState<CocoImprovementPlan | null>(null);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>(selectedOption?.templateIds ?? []);
  const [regenerating, setRegenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [changingState, setChangingState] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const effectiveOption: CocoImprovementOption | undefined = selectedOption ? { ...selectedOption, templateIds: selectedOption.actionType === "add_equipment_to_templates" ? selectedTemplateIds : selectedOption.templateIds } : undefined;
  const canApply = Boolean(signal.chantierId && signal.sourceRefs.length && effectiveOption && (effectiveOption.actionType !== "add_equipment_to_templates" || effectiveOption.templateIds?.length));

  function chooseOption(option: CocoImprovementOption) {
    setSelectedOptionId(option.id);
    setDecision(option.proposal);
    setSelectedTemplateIds(option.templateIds ?? []);
    setPlan(null);
    setActionError(null);
  }

  async function regenerate() {
    setRegenerating(true);
    setActionError(null);
    try {
      if (!effectiveOption) throw new Error("Choisis d'abord ce que COCO doit modifier.");
      const result = await regenerateCocoImprovementProposal(signal, decision, effectiveOption);
      setDecision(result.proposal);
      setPlan(result.plan);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Régénération impossible.");
    } finally {
      setRegenerating(false);
    }
  }

  async function apply() {
    setApplying(true);
    setActionError(null);
    try {
      if (!effectiveOption) throw new Error("Choisis d'abord ce que COCO doit modifier.");
      await applyCocoImprovementAction({ signal, decisionText: decision, option: effectiveOption, plan });
      onChanged(signal, "applied", `Décision appliquée : ${effectiveOption.detail}`);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Application impossible.");
    } finally {
      setApplying(false);
    }
  }

  async function changeState(state: "active" | "pending" | "dismissed") {
    setChangingState(true);
    setActionError(null);
    try {
      await setCocoDetectionState(signal.signalKey, state);
      onChanged(signal, state, state === "pending" ? "Détection mise en attente." : state === "dismissed" ? "Détection supprimée de la liste. La donnée chantier d'origine est conservée." : "Détection remise dans les éléments à traiter.");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "Modification impossible.");
    } finally {
      setChangingState(false);
    }
  }

  return <article className={`rounded-2xl border p-4 ${immediate ? "border-red-200 bg-red-50/60" : "border-slate-200 bg-white"}`}>
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${signal.state === "pending" ? "bg-slate-200 text-slate-700" : immediate ? "bg-red-100 text-red-800" : signal.kind === "trend" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>{signal.state === "pending" ? "En attente" : immediate ? "À traiter maintenant" : signal.kind === "trend" ? "Tendance confirmée" : "Piste d'amélioration"}</span><span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{categoryLabel[signal.category]}</span>{signal.sourceRefs.length > 1 ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-800">{signal.sourceRefs.length} sources regroupées</span> : null}</div><h3 className="mt-2 text-base font-semibold text-slate-950">{signal.title}</h3>{signal.chantierName ? <div className="mt-1 text-xs font-medium text-blue-700">{signal.chantierName}</div> : null}{signal.detectedAt ? <div className="mt-1 text-xs text-slate-400">Signalé le {new Date(signal.detectedAt).toLocaleString("fr-FR")}</div> : null}</div>{signal.targetHref ? <Link to={signal.targetHref} className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${immediate ? "bg-red-700 text-white hover:bg-red-800" : "border border-slate-200 bg-white text-blue-700 hover:bg-slate-50"}`}>Voir la source <ExternalLink className="h-3.5 w-3.5" /></Link> : null}</div>
    <p className="mt-3 text-sm leading-6 text-slate-700">{signal.finding}</p>
    {signal.actionOptions.length ? <div className={`mt-3 rounded-xl p-3 ${immediate ? "bg-white" : "bg-blue-50"}`}>
      <fieldset><legend className="text-sm font-semibold text-slate-950">Ce que COCO peut réellement faire</legend><div className="mt-2 space-y-2">{signal.actionOptions.map((option) => <label key={option.id} className={`block cursor-pointer rounded-xl border p-3 ${selectedOptionId === option.id ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white"}`}><span className="flex items-start gap-2"><input type="radio" name={`option-${signal.id}`} className="mt-1" checked={selectedOptionId === option.id} onChange={() => chooseOption(option)} /><span><span className="block text-sm font-semibold text-slate-900">{option.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{option.detail}</span></span></span></label>)}</div></fieldset>
      {selectedOption?.actionType === "add_equipment_to_templates" && (selectedOption.templateIds?.length ?? 0) > 1 ? <fieldset className="mt-3"><legend className="text-xs font-semibold text-slate-700">Templates à modifier</legend><div className="mt-2 flex flex-wrap gap-2">{selectedOption.templateIds?.map((id, index) => <label key={id} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><input type="checkbox" checked={selectedTemplateIds.includes(id)} onChange={() => { setSelectedTemplateIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); setPlan(null); }} />{selectedOption.templateTitles?.[index] ?? "Template"}</label>)}</div></fieldset> : null}
      <label className="text-sm font-semibold text-slate-950" htmlFor={`decision-${signal.id}`}>Décision proposée</label>
      <textarea
        id={`decision-${signal.id}`}
        value={decision}
        onChange={(event) => { setDecision(event.target.value); setPlan(null); }}
        rows={4}
        className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm leading-6 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        placeholder="Écris une décision ou seulement des mots-clés…"
      />
      {effectiveOption ? <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-800"><strong>COCO appliquera exactement :</strong> {effectiveOption.detail}</div> : null}
      {actionError ? <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</div> : null}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => void regenerate()} disabled={regenerating || applying || !decision.trim() || !canApply} className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${regenerating ? "animate-spin" : ""}`} />{regenerating ? "Régénération…" : "Régénérer une proposition"}</button>
        <button type="button" onClick={() => void apply()} disabled={applying || regenerating || !decision.trim() || !canApply} title={canApply ? "Appliquer cette décision dans Batipro" : "Cette proposition doit d'abord être reliée à une donnée chantier précise"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-700 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />{applying ? "Application…" : "Appliquer"}</button>
      </div>
      {!canApply ? <div className="mt-2 text-xs text-slate-500">Application disponible lorsque COCO a identifié le chantier et la donnée d'origine.</div> : null}
    </div> : <div className="mt-3 rounded-xl bg-blue-50 p-3 text-sm leading-6 text-blue-900"><strong>Analyse :</strong> {signal.proposedAction}<div className="mt-1 text-xs text-blue-700">COCO n’a pas encore identifié une cible assez précise pour appliquer cette amélioration automatiquement.</div></div>}
    <div className="mt-3 flex flex-wrap gap-2">{signal.state === "pending" ? <button type="button" onClick={() => void changeState("active")} disabled={changingState} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RotateCcw className="h-4 w-4" />Remettre à traiter</button> : <button type="button" onClick={() => void changeState("pending")} disabled={changingState} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><PauseCircle className="h-4 w-4" />Mettre en attente</button>}<button type="button" onClick={() => void changeState("dismissed")} disabled={changingState} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" />Supprimer la détection</button></div>
    {actionError && !signal.actionOptions.length ? <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{actionError}</div> : null}
    <div className="mt-3 text-xs text-slate-500"><strong>Données utilisées :</strong> {signal.sourceKeys.map((key) => COCO_LEARNING_SOURCES.find((source) => source.key === key)?.label ?? key).join(" · ")}</div>
  </article>;
}

export default function CocoImprovementPage() {
  const [settings, setSettings] = useState<CocoLearningSettings>(DEFAULT_COCO_LEARNING_SETTINGS);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [signals, setSignals] = useState<CocoLearningSignal[]>([]);
  const [sourceCounts, setSourceCounts] = useState<Partial<Record<CocoLearningSourceKey, number>>>({});
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis(activeSettings: CocoLearningSettings) { setAnalyzing(true); setError(null); try { const result = await analyzeCocoLearning(activeSettings); setSignals(result.signals); setSourceCounts(result.sourceCounts); setAnalyzedAt(result.analyzedAt); } catch (reason) { setError(reason instanceof Error ? reason.message : "Analyse impossible."); } finally { setAnalyzing(false); } }

  useEffect(() => { let alive = true; getCocoLearningSettings().then(async (result) => { if (!alive) return; setSettings(result.settings); setSchemaReady(result.schemaReady); if (result.settings.enabled) await runAnalysis(result.settings); }).catch((reason) => { if (alive) setError(reason instanceof Error ? reason.message : "Chargement impossible."); }).finally(() => { if (alive) setLoading(false); }); return () => { alive = false; }; }, []);

  const immediate = useMemo(() => signals.filter((signal) => signal.state === "active" && signal.kind === "immediate"), [signals]);
  const improvements = useMemo(() => signals.filter((signal) => signal.state === "active" && signal.kind !== "immediate"), [signals]);
  const pending = useMemo(() => signals.filter((signal) => signal.state === "pending"), [signals]);
  const enabledCount = useMemo(() => Object.values(settings.sources).filter(Boolean).length, [settings.sources]);
  function handleSignalChanged(signal: CocoLearningSignal, state: "applied" | "active" | "pending" | "dismissed", message: string) { setSignals((current) => state === "applied" || state === "dismissed" ? current.filter((item) => item.signalKey !== signal.signalKey) : current.map((item) => item.signalKey === signal.signalKey ? { ...item, state } : item)); setNotice(message); }
  function toggleSource(key: CocoLearningSourceKey) { setSettings((current) => ({ ...current, sources: { ...current.sources, [key]: !current.sources[key] } })); }
  async function saveSettings() { setSaving(true); setError(null); setNotice(null); try { await saveCocoLearningSettings(settings); setSchemaReady(true); setNotice("Sources enregistrées. L'analyse a été actualisée."); if (settings.enabled) await runAnalysis(settings); } catch (reason) { setError(reason instanceof Error ? reason.message : "Enregistrement impossible."); } finally { setSaving(false); } }

  if (loading) return <div className="p-10 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />COCO contrôle les données chantier...</div>;

  return <div className="space-y-5 pb-10"><header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6"><Link to="/assistant-direction" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Assistant Direction</Link><div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold text-blue-700"><BrainCircuit className="h-4 w-4" /> COCO · décisions et amélioration</div><h1 className="mt-1 text-2xl font-semibold text-slate-950">Ce qui demande une décision</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">COCO surveille les données choisies, remonte chaque blocage dès son premier signalement et distingue les urgences des tendances qui peuvent améliorer les références métier.</p></div><button type="button" onClick={() => void runAnalysis(settings)} disabled={analyzing || !settings.enabled} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${analyzing ? "animate-spin" : ""}`} />Actualiser</button></div></header>
    <main className="space-y-5 px-4 sm:px-6">{!schemaReady ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Configuration non persistée.</strong> La migration Supabase des sources doit être appliquée.</div> : null}{error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}{notice ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{notice}</div> : null}
      <section className="grid gap-3 sm:grid-cols-3"><div className={`rounded-2xl border p-4 ${immediate.length ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600"><AlertTriangle className="h-4 w-4" /> À traiter maintenant</div><div className="mt-2 text-3xl font-semibold text-slate-950">{immediate.length}</div><div className="mt-1 text-xs text-slate-600">Un seul blocage suffit pour apparaître.</div></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600"><Sparkles className="h-4 w-4" /> Améliorations</div><div className="mt-2 text-3xl font-semibold text-slate-950">{improvements.length}</div><div className="mt-1 text-xs text-slate-600">Tendances et références à fiabiliser.</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600"><Clock3 className="h-4 w-4" /> Dernier contrôle</div><div className="mt-2 text-sm font-semibold text-slate-950">{analyzing ? "Analyse en cours" : analyzedAt ? new Date(analyzedAt).toLocaleString("fr-FR") : "Non analysé"}</div><div className="mt-1 text-xs text-slate-600">{enabledCount} source(s) active(s).</div></div></section>
      <section className="rounded-2xl border border-red-200 bg-white p-5"><div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><AlertTriangle className="h-5 w-5" /></div><div><h2 className="font-semibold text-slate-950">À traiter maintenant</h2><p className="mt-1 text-sm text-slate-500">Blocages, urgences et risques remontent immédiatement, sans attendre une répétition.</p></div></div><div className="mt-4 space-y-3">{immediate.length ? immediate.map((signal) => <SignalCard key={signal.id} signal={signal} onChanged={handleSignalChanged} />) : <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">Aucun blocage ou retour urgent détecté dans les sources actives.</div>}</div></section>
      {pending.length ? <section className="rounded-2xl border border-slate-300 bg-slate-50 p-5"><h2 className="font-semibold text-slate-950">En attente ({pending.length})</h2><p className="mt-1 text-sm text-slate-500">Ces détections restent mémorisées sans encombrer les décisions immédiates.</p><div className="mt-4 space-y-3">{pending.map((signal) => <SignalCard key={signal.id} signal={signal} onChanged={handleSignalChanged} />)}</div></section> : null}
      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">Améliorations proposées</h2><p className="mt-1 text-sm text-slate-500">Ici seulement, COCO attend plusieurs cas comparables avant de parler de tendance et de proposer de modifier un ratio, un temps, un prix ou une méthode.</p><div className="mt-4 space-y-3">{improvements.length ? improvements.map((signal) => <SignalCard key={signal.id} signal={signal} onChanged={handleSignalChanged} />) : <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">Pas encore assez de données comparables pour proposer une modification de référence.</div>}</div></section>
      <section className="rounded-2xl border border-slate-200 bg-white"><button type="button" onClick={() => setSettingsOpen((value) => !value)} className="flex w-full items-center justify-between gap-3 p-5 text-left"><span><span className="flex items-center gap-2 font-semibold text-slate-950"><Database className="h-4 w-4 text-blue-700" /> Sources analysées</span><span className="mt-1 block text-sm text-slate-500">{enabledCount} sources actives · réglage secondaire</span></span>{settingsOpen ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}</button>{settingsOpen ? <div className="border-t border-slate-200 p-5"><div className="flex items-start gap-2 rounded-xl bg-blue-50 p-3 text-xs leading-5 text-blue-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>Ces choix déterminent où COCO lit. Ils ne déterminent pas si un blocage est important : tout signal critique est remonté dès la première occurrence.</span></div><div className="mt-4 grid gap-3 lg:grid-cols-2">{COCO_LEARNING_SOURCES.map((source) => <label key={source.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4"><input className="mt-1" type="checkbox" checked={settings.sources[source.key]} onChange={() => toggleSource(source.key)} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-950"><span>{source.label}</span>{sourceCounts[source.key] !== undefined ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{sourceCounts[source.key]}</span> : null}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{source.detail}</span></span></label>)}</div><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><label className="text-xs font-semibold text-slate-700">Période observée<select className="mt-1 block w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={settings.lookbackDays} onChange={(event) => setSettings((current) => ({ ...current, lookbackDays: Number(event.target.value) }))}><option value={90}>3 mois</option><option value={180}>6 mois</option><option value={365}>12 mois</option><option value={730}>24 mois</option></select></label><button type="button" onClick={() => void saveSettings()} disabled={saving || enabledCount === 0} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Enregistrement..." : "Enregistrer les sources"}</button></div></div> : null}</section>
    </main></div>;
}
