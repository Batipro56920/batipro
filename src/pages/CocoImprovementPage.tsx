import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, BrainCircuit, CheckCircle2, Database, ExternalLink, Loader2, Play, Save, ShieldCheck } from "lucide-react";
import {
  COCO_LEARNING_SOURCES,
  DEFAULT_COCO_LEARNING_SETTINGS,
  analyzeCocoLearning,
  getCocoLearningSettings,
  saveCocoLearningSettings,
  type CocoLearningSettings,
  type CocoLearningSignal,
  type CocoLearningSourceKey,
} from "../services/cocoImprovement.service";

const ACTIONS = [
  ["Temps", "Ajuster les temps prévus des modèles à partir des écarts réellement constatés."],
  ["Matériaux", "Proposer un ratio ou un coefficient de perte plus réaliste."],
  ["Matériel", "Ajouter l'outillage souvent manquant aux tâches et au contrôle du matin."],
  ["Méthode", "Enrichir modes opératoires, prérequis, erreurs à éviter et contrôles."],
  ["Qualité", "Transformer réserves et reprises récurrentes en contrôles préventifs."],
  ["Planning", "Corriger les durées et dépendances qui provoquent des retards répétés."],
  ["Achats", "Actualiser les coûts de référence et détecter les fournisseurs à risque."],
] as const;

const tone = {
  haute: "border-red-200 bg-red-50 text-red-800",
  normale: "border-amber-200 bg-amber-50 text-amber-800",
  faible: "border-slate-200 bg-slate-50 text-slate-700",
};

export default function CocoImprovementPage() {
  const [settings, setSettings] = useState<CocoLearningSettings>(DEFAULT_COCO_LEARNING_SETTINGS);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [signals, setSignals] = useState<CocoLearningSignal[]>([]);
  const [sourceCounts, setSourceCounts] = useState<Partial<Record<CocoLearningSourceKey, number>>>({});
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getCocoLearningSettings().then((result) => {
      if (!alive) return;
      setSettings(result.settings);
      setSchemaReady(result.schemaReady);
    }).catch((reason) => {
      if (alive) setError(reason instanceof Error ? reason.message : "Chargement impossible.");
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const enabledCount = useMemo(() => Object.values(settings.sources).filter(Boolean).length, [settings.sources]);

  function toggleSource(key: CocoLearningSourceKey) {
    setSettings((current) => ({ ...current, sources: { ...current.sources, [key]: !current.sources[key] } }));
  }

  async function save() {
    setSaving(true); setError(null); setNotice(null);
    try {
      await saveCocoLearningSettings(settings);
      setSchemaReady(true);
      setNotice("Paramétrage enregistré. COCO n'analysera que les sources activées.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Enregistrement impossible.");
    } finally { setSaving(false); }
  }

  async function analyze() {
    setAnalyzing(true); setError(null); setNotice(null);
    try {
      const result = await analyzeCocoLearning(settings);
      setSignals(result.signals);
      setSourceCounts(result.sourceCounts);
      setAnalyzedAt(result.analyzedAt);
      setNotice(result.signals.length ? `${result.signals.length} proposition(s) préparée(s) pour revue.` : "Analyse terminée : pas encore assez de données pour produire une proposition fiable.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Analyse impossible.");
    } finally { setAnalyzing(false); }
  }

  if (loading) return <div className="p-10 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />Chargement du moteur d'amélioration...</div>;

  return <div className="space-y-5 pb-10">
    <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-6">
      <Link to="/assistant-direction" className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" /> Assistant Direction</Link>
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div><div className="flex items-center gap-2 text-xs font-semibold text-blue-700"><BrainCircuit className="h-4 w-4" /> COCO · amélioration métier</div><h1 className="mt-1 text-2xl font-semibold text-slate-950">Apprendre du réel, sans modifier automatiquement</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Le module compare ce qui était prévu avec ce qui s'est réellement passé sur les chantiers. Il prépare des corrections argumentées ; l'administrateur décide ensuite de les appliquer ou non dans le module concerné.</p></div>
        <div className="flex max-w-md items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Aucune écriture automatique.</strong> Les données sont lues pour proposer. Les ratios, modèles, prix et plannings restent inchangés tant que tu ne les valides pas.</span></div>
      </div>
    </header>

    <main className="space-y-5 px-4 sm:px-6">
      {!schemaReady ? <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>Configuration non persistée.</strong><div className="mt-1 text-xs leading-5">La page fonctionne avec les réglages par défaut, mais la migration Supabase doit être appliquée pour enregistrer les choix.</div></div></div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {notice ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">{notice}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><div className="flex items-center gap-2 font-semibold text-slate-950"><Database className="h-4 w-4 text-blue-700" /> Sources de données</div><p className="mt-1 text-sm text-slate-500">Choisis précisément ce que COCO a le droit d'inclure dans ses analyses.</p></div><label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings((current) => ({ ...current, enabled: event.target.checked }))} /> Moteur actif</label></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">{COCO_LEARNING_SOURCES.map((source) => <label key={source.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4 hover:border-blue-200"><input className="mt-1" type="checkbox" checked={settings.sources[source.key]} onChange={() => toggleSource(source.key)} /><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2 text-sm font-semibold text-slate-950"><span>{source.label}</span>{sourceCounts[source.key] !== undefined ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{sourceCounts[source.key]} donnée(s)</span> : null}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{source.detail}</span></span></label>)}</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-xl"><label className="text-xs font-semibold text-slate-700">Période analysée<select className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" value={settings.lookbackDays} onChange={(event) => setSettings((current) => ({ ...current, lookbackDays: Number(event.target.value) }))}><option value={90}>3 mois</option><option value={180}>6 mois</option><option value={365}>12 mois</option><option value={730}>24 mois</option></select></label><label className="text-xs font-semibold text-slate-700">Minimum avant proposition<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" type="number" min={1} max={20} value={settings.minimumSamples} onChange={(event) => setSettings((current) => ({ ...current, minimumSamples: Number(event.target.value) }))} /><span className="mt-1 block font-normal text-slate-500">Ex. 3 occurrences avant de parler de tendance.</span></label></div>
        <div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => void save()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "Enregistrement..." : "Enregistrer les sources"}</button><button type="button" onClick={() => void analyze()} disabled={analyzing || !settings.enabled || enabledCount === 0} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Play className="h-4 w-4" />{analyzing ? "Analyse en cours..." : "Lancer l'analyse maintenant"}</button></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-semibold text-slate-950">Ce que COCO peut proposer</h2><p className="mt-1 text-sm text-slate-500">Le ratio matériaux n'est qu'un usage parmi plusieurs.</p><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{ACTIONS.map(([label, detail]) => <div key={label} className="rounded-xl bg-slate-50 p-4"><div className="text-sm font-semibold text-slate-950">{label}</div><p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p></div>)}</div></section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-950">Propositions à examiner</h2><p className="mt-1 text-sm text-slate-500">Chaque proposition indique les constats et les sources qui la justifient.</p></div>{analyzedAt ? <span className="text-xs text-slate-400">{new Date(analyzedAt).toLocaleString("fr-FR")}</span> : null}</div>
        <div className="mt-4 space-y-3">{signals.length ? signals.map((signal) => <article key={signal.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone[signal.priority]}`}>{signal.priority === "haute" ? "Priorité haute" : "À examiner"}</span><span className="text-xs font-semibold uppercase text-blue-700">{signal.category}</span></div><h3 className="mt-2 font-semibold text-slate-950">{signal.title}</h3></div>{signal.targetHref ? <Link to={signal.targetHref} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">Ouvrir le module <ExternalLink className="h-3.5 w-3.5" /></Link> : null}</div><p className="mt-2 text-sm text-slate-700">{signal.finding}</p><div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-950"><strong>Action proposée :</strong> {signal.proposedAction}</div><div className="mt-3 text-xs text-slate-500"><strong>Sources :</strong> {signal.sourceKeys.map((key) => COCO_LEARNING_SOURCES.find((source) => source.key === key)?.label ?? key).join(" · ")}</div>{signal.evidence.length ? <ul className="mt-2 space-y-1 text-xs text-slate-500">{signal.evidence.map((item, index) => <li key={index}>• {item}</li>)}</ul> : null}</article>) : <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center"><CheckCircle2 className="mx-auto h-6 w-6 text-slate-300" /><div className="mt-2 text-sm font-medium text-slate-700">Aucune analyse lancée ou pas assez de données</div><p className="mt-1 text-xs text-slate-500">COCO ne fabrique pas de tendance tant que le seuil minimum n'est pas atteint.</p></div>}</div>
      </section>
    </main>
  </div>;
}
