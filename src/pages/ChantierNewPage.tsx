// src/pages/ChantierNewPage.tsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

type ChantierStatus = "PREPARATION" | "EN_COURS" | "TERMINE";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ChantierNewPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    nom: "",
    client: "",
    adresse: "",
    date_debut: todayISO(), // défaut aujourd’hui
    date_fin_prevue: "",
    status: "PREPARATION" as ChantierStatus,
  });

  const canSubmit = useMemo(
    () => form.nom.trim().length > 0 && !loading,
    [form.nom, loading]
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setErrorMsg(null);

    const payload = {
      nom: form.nom.trim(),
      client: form.client.trim() || null,
      adresse: form.adresse.trim() || null,
      date_debut: form.date_debut || null,
      date_fin_prevue: form.date_fin_prevue || null,
      status: form.status,
    };

    const { data, error } = await supabase
      .from("chantiers")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    setLoading(false);
    navigate(`/chantiers/${data.id}`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="text-sm text-slate-500">
            <Link to="/chantiers" className="hover:underline">
              Chantiers
            </Link>{" "}
            <span className="mx-1">/</span>
            <span className="text-slate-700">Nouveau chantier</span>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">Nouveau chantier</h1>
            <span className="text-xs px-2 py-1 rounded-full border bg-slate-50 text-slate-700">
              {form.status === "PREPARATION"
                ? "Préparation"
                : form.status === "EN_COURS"
                ? "En cours"
                : "Terminé"}
            </span>
          </div>

          <div className="text-slate-500">Créer un chantier et démarrer le suivi</div>
        </div>

        <Link
          to="/chantiers"
          className="rounded-xl border px-4 py-2 hover:bg-slate-50 transition"
        >
          Retour
        </Link>
      </div>

      {/* Form card */}
      <form onSubmit={onSubmit} className="rounded-2xl border bg-white p-6 space-y-6">
        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Erreur : {errorMsg}
          </div>
        )}

        <div className="grid gap-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Nom du chantier <span className="text-red-600">*</span>
            </label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Ex: Rénovation appartement Dupont"
              value={form.nom}
              onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Client</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="Ex: SCI LOJO IMMO"
              value={form.client}
              onChange={(e) => setForm((p) => ({ ...p, client: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Adresse du chantier</label>
            <textarea
              className="w-full rounded-xl border px-3 py-2 min-h-[84px]"
              placeholder="Adresse complète"
              value={form.adresse}
              onChange={(e) => setForm((p) => ({ ...p, adresse: e.target.value }))}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date de début</label>
              <input
                type="date"
                className="w-full rounded-xl border px-3 py-2"
                value={form.date_debut}
                onChange={(e) => setForm((p) => ({ ...p, date_debut: e.target.value }))}
              />
              <button
                type="button"
                className="text-xs text-slate-600 hover:underline"
                onClick={() => setForm((p) => ({ ...p, date_debut: todayISO() }))}
              >
                Mettre aujourd’hui
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date de fin prévue</label>
              <input
                type="date"
                className="w-full rounded-xl border px-3 py-2"
                value={form.date_fin_prevue}
                onChange={(e) => setForm((p) => ({ ...p, date_fin_prevue: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Statut</label>
            <select
              className="w-full rounded-xl border px-3 py-2 bg-white"
              value={form.status}
              onChange={(e) =>
                setForm((p) => ({ ...p, status: e.target.value as ChantierStatus }))
              }
            >
              <option value="PREPARATION">Préparation</option>
              <option value="EN_COURS">En cours</option>
              <option value="TERMINE">Terminé</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link to="/chantiers" className="rounded-xl border px-4 py-2 hover:bg-slate-50 transition">
            Annuler
          </Link>

          <button
            type="submit"
            disabled={!canSubmit}
            className={[
              "rounded-xl px-4 py-2 transition",
              canSubmit
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-slate-200 text-slate-500 cursor-not-allowed",
            ].join(" ")}
          >
            {loading ? "Création..." : "Créer le chantier"}
          </button>
        </div>
      </form>
    </div>
  );
}
