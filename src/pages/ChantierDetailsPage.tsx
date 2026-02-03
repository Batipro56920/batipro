// src/pages/ChantierDetailsPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

const tabs = [
  { to: "infos", label: "Infos" },
  { to: "planning", label: "Planning" },
  { to: "reserves", label: "Réserves" },
  { to: "documents", label: "Documents" },
] as const;

type TabKey = (typeof tabs)[number]["to"];

type ChantierRow = {
  id: string;
  nom: string;
  client: string | null;
  adresse: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function TabLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          "px-3 py-2 rounded-xl text-sm border transition",
          isActive
            ? "bg-slate-900 text-white border-slate-900"
            : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200",
        ].join(" ")
      }
    >
      {label}
    </NavLink>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-slate-500">{label}</div>
      {children}
    </div>
  );
}

async function getChantierById(id: string): Promise<ChantierRow | null> {
  const { data, error } = await supabase
    .from("chantiers")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return (data ?? null) as ChantierRow | null;
}

async function updateChantier(
  id: string,
  patch: Partial<Pick<ChantierRow, "nom" | "client" | "adresse">>
): Promise<void> {
  const { error } = await supabase
    .from("chantiers")
    .update({
      nom: patch.nom,
      client: patch.client,
      adresse: patch.adresse,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

export default function ChantierDetailsPage() {
  const navigate = useNavigate();
  const { id, tab } = useParams<{ id: string; tab?: string }>();

  const [chantier, setChantier] = useState<ChantierRow | null>(null);
  const [loading, setLoading] = useState(true);

  const currentTab: TabKey = useMemo(() => {
    const t = (tab ?? "infos") as TabKey;
    return (tabs.map((x) => x.to) as TabKey[]).includes(t) ? t : "infos";
  }, [tab]);

  useEffect(() => {
    if (id && !tab) navigate(`/chantiers/${id}/infos`, { replace: true });
  }, [id, tab, navigate]);

  useEffect(() => {
    if (!id) return;

    let alive = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    getChantierById(id)
      .then((c) => {
        if (!alive) return;
        setChantier(c);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [id]);

  if (!id) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="font-semibold">Chantier introuvable</div>
        <div className="text-slate-500 text-sm mt-1">ID manquant.</div>
        <div className="mt-4">
          <Link
            className="rounded-xl border px-3 py-2 hover:bg-slate-50"
            to="/chantiers"
          >
            Retour aux chantiers
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="font-semibold">Chargement…</div>
        <div className="text-slate-500 text-sm mt-1">
          Récupération du chantier depuis la base.
        </div>
      </div>
    );
  }

  if (!chantier) {
    return (
      <div className="rounded-2xl border bg-white p-6">
        <div className="font-semibold">Chantier introuvable</div>
        <div className="text-slate-500 text-sm mt-1">
          Aucun chantier ne correspond à l’ID :{" "}
          <span className="font-medium">{id}</span>
        </div>
        <div className="mt-4">
          <Link
            className="rounded-xl border px-3 py-2 hover:bg-slate-50"
            to="/chantiers"
          >
            Retour aux chantiers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-slate-500">
            <Link to="/chantiers" className="hover:underline">
              Chantiers
            </Link>{" "}
            <span className="mx-1">/</span>
            <span className="text-slate-700">{chantier.nom}</span>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <h1 className="text-2xl font-bold truncate">{chantier.nom}</h1>
          </div>

          <div className="text-slate-500 text-sm mt-1 truncate">
            {chantier.client ?? "—"} • {chantier.adresse ?? "—"}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            to="/chantiers"
            className="rounded-xl border px-3 py-2 hover:bg-slate-50 transition"
          >
            Retour
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <TabLink key={t.to} to={`/chantiers/${id}/${t.to}`} label={t.label} />
        ))}
      </div>

      {/* Contenu */}
      <div className="rounded-2xl border bg-white p-6">
        {currentTab === "infos" && (
          <InfosTab
            chantier={chantier}
            onSaved={async () => {
              const fresh = await getChantierById(id);
              setChantier(fresh);
            }}
          />
        )}

        {currentTab !== "infos" && (
          <div className="rounded-xl border bg-slate-50 p-6 text-slate-600">
            Cette section sera branchée ensuite (sans complexifier).
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- INFOS (branché Supabase) -------------------- */

function InfosTab({
  chantier,
  onSaved,
}: {
  chantier: ChantierRow;
  onSaved: () => Promise<void>;
}) {
  const initial = useMemo(
    () => ({
      nom: (chantier.nom ?? "").trim(),
      client: (chantier.client ?? "").trim(),
      adresse: (chantier.adresse ?? "").trim(),
    }),
    [chantier]
  );

  const [form, setForm] = useState({
    nom: initial.nom,
    client: initial.client,
    adresse: initial.adresse,
  });

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      nom: initial.nom,
      client: initial.client,
      adresse: initial.adresse,
    });
    setSaveState("idle");
  }, [initial]);

  const isDirty =
    initial.nom !== form.nom.trim() ||
    initial.client !== form.client.trim() ||
    initial.adresse !== form.adresse.trim();

  const canSave = isDirty && saveState !== "saving" && form.nom.trim().length > 0;

  const onSave = async () => {
    if (!canSave) return;
    setSaveState("saving");

    await updateChantier(chantier.id, {
      nom: form.nom.trim(),
      client: form.client.trim() || null,
      adresse: form.adresse.trim() || null,
    });

    await onSaved();

    setSaveState("saved");
    window.setTimeout(() => setSaveState("idle"), 1200);
  };

  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        <Field label="Nom">
          <input
            className="w-full rounded-xl border px-3 py-2"
            value={form.nom}
            onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
          />
        </Field>

        <Field label="Client">
          <input
            className="w-full rounded-xl border px-3 py-2"
            value={form.client}
            onChange={(e) => setForm((p) => ({ ...p, client: e.target.value }))}
          />
        </Field>

        <Field label="Adresse">
          <input
            className="w-full rounded-xl border px-3 py-2"
            value={form.adresse}
            onChange={(e) => setForm((p) => ({ ...p, adresse: e.target.value }))}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-slate-500">
          {saveState === "saved"
            ? "Enregistré ✓"
            : isDirty
              ? "Modifications non enregistrées."
              : "Aucune modification."}
        </div>

        <button
          className={[
            "rounded-xl px-4 py-2 transition",
            canSave
              ? "bg-slate-900 text-white hover:bg-slate-800"
              : "bg-slate-200 text-slate-500 cursor-not-allowed",
          ].join(" ")}
          onClick={onSave}
          disabled={!canSave}
        >
          {saveState === "saving"
            ? "Enregistrement..."
            : saveState === "saved"
              ? "Enregistré ✓"
              : "Enregistrer"}
        </button>
      </div>
    </div>
  );
}
