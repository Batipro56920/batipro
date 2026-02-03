// src/pages/IntervenantAccessPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { checkAccessToken } from "../services/chantierAccess.service";
import { createPortalClient } from "../services/portalSupabaseClient";

type TabKey =
  | "taches"
  | "temps"
  | "planning"
  | "materiel"
  | "reserves"
  | "messagerie"
  | "rapports";

const TABS: { key: TabKey; label: string; note?: string }[] = [
  { key: "taches", label: "Tâches" },
  { key: "temps", label: "Temps" },
  { key: "planning", label: "Planning", note: "Lecture seule" },
  { key: "materiel", label: "Matériel" },
  { key: "reserves", label: "Réserves" },
  { key: "messagerie", label: "Messagerie" },
  { key: "rapports", label: "Rapports", note: "Lecture seule" },
];

type TaskStatus = "A_FAIRE" | "EN_COURS" | "FAIT";

type ChantierTask = {
  id: string;
  titre: string;
  status: TaskStatus;
  date_debut: string | null; // YYYY-MM-DD
  date_fin: string | null; // YYYY-MM-DD
  temps_reel_h: number | null;
  ordre: number | null;
  chantier_id?: string;
};

type TaskDraft = {
  status: TaskStatus;
  date_debut: string; // "" ou YYYY-MM-DD
  date_fin: string; // "" ou YYYY-MM-DD
  ajout_h: string; // saisie ponctuelle à additionner
};

function toInputNumberString(v: number | null | undefined) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return String(n);
}

function normalizeHoursInput(s: string) {
  return (s ?? "").trim().replace(",", ".");
}

export default function IntervenantAccessPage() {
  const params = useParams();
  const token = params.token as string | undefined;

  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState<string | null>(null);

  const [jwt, setJwt] = useState<string | null>(null);
  const [chantierId, setChantierId] = useState<string | null>(null);
  const [intervenantId, setIntervenantId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("taches");

  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ChantierTask[]>([]);

  const [draftById, setDraftById] = useState<Record<string, TaskDraft>>({});
  const [savingById, setSavingById] = useState<Record<string, boolean>>({});
  const [saveMsgById, setSaveMsgById] = useState<Record<string, string>>({});

  const portalClient = useMemo(() => {
    if (!jwt) return null;
    return createPortalClient(jwt);
  }, [jwt]);

  // 1) Token => JWT (avec cache sessionStorage)
  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setFatalError(null);

        if (!token) {
          setFatalError("Lien invalide (token manquant).");
          return;
        }

        // ✅ cache pour éviter de rappeler la function à chaque refresh
        const keyJwt = `portal_jwt_${token}`;
        const keyChantier = `portal_chantier_${token}`;
        const keyInterv = `portal_intervenant_${token}`;

        const storedJwt = sessionStorage.getItem(keyJwt);
        const storedChantier = sessionStorage.getItem(keyChantier);
        const storedInterv = sessionStorage.getItem(keyInterv);

        if (storedJwt) {
          if (!alive) return;
          setJwt(storedJwt);
          setChantierId(storedChantier ? storedChantier : null);
          setIntervenantId(storedInterv ? storedInterv : null);
          return;
        }

        const res = await checkAccessToken(token);

        if (!alive) return;

        // ✅ sécurise les champs attendus
        const nextJwt = (res as any)?.jwt as string | undefined;
        const nextChantier = (res as any)?.chantier_id as string | undefined;
        const nextInterv = (res as any)?.intervenant_id as string | null | undefined;

        if (!nextJwt || !nextChantier) {
          throw new Error("Accès refusé : réponse invalide (jwt/chantier_id manquant).");
        }

        setJwt(nextJwt);
        setChantierId(nextChantier);
        setIntervenantId(nextInterv ?? null);

        // ⚠️ sessionStorage n'accepte que des strings
        sessionStorage.setItem(keyJwt, nextJwt);
        sessionStorage.setItem(keyChantier, nextChantier);
        sessionStorage.setItem(keyInterv, String(nextInterv ?? ""));
      } catch (e) {
        if (!alive) return;
        setFatalError((e as Error).message || "Accès refusé.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [token]);

  // 2) Load tâches (on charge quand on est sur Tâches OU Temps)
  useEffect(() => {
    let alive = true;

    async function loadTasks() {
      if (!portalClient) return;
      if (!chantierId) return;
      if (activeTab !== "taches" && activeTab !== "temps") return;

      try {
        setTasksLoading(true);
        setTasksError(null);

        const { data, error } = await portalClient
          .from("chantier_tasks")
          .select("id,titre,status,date_debut,date_fin,temps_reel_h,ordre,chantier_id")
          .eq("chantier_id", chantierId)
          .order("ordre", { ascending: true });

        if (error) throw new Error(error.message);

        const rows = (data ?? []) as ChantierTask[];

        if (!alive) return;
        setTasks(rows);

        // init drafts si manquants
        setDraftById((prev) => {
          const next = { ...prev };
          for (const t of rows) {
            if (!next[t.id]) {
              next[t.id] = {
                status: (t.status ?? "A_FAIRE") as TaskStatus,
                date_debut: t.date_debut ?? "",
                date_fin: t.date_fin ?? "",
                ajout_h: "",
              };
            }
          }
          return next;
        });
      } catch (e) {
        if (!alive) return;
        setTasksError((e as Error).message);
      } finally {
        if (alive) setTasksLoading(false);
      }
    }

    loadTasks();
    return () => {
      alive = false;
    };
  }, [portalClient, chantierId, activeTab]);

  function setDraft(taskId: string, patch: Partial<TaskDraft>) {
    setDraftById((prev) => {
      const current =
        prev[taskId] ??
        ({
          status: "A_FAIRE",
          date_debut: "",
          date_fin: "",
          ajout_h: "",
        } as TaskDraft);

      return {
        ...prev,
        [taskId]: { ...current, ...patch },
      };
    });
    setSaveMsgById((prev) => ({ ...prev, [taskId]: "" }));
  }

  async function saveTask(taskId: string) {
    if (!portalClient) return;
    if (!chantierId) return;

    const draft = draftById[taskId];
    if (!draft) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    try {
      setSavingById((p) => ({ ...p, [taskId]: true }));
      setSaveMsgById((p) => ({ ...p, [taskId]: "" }));

      // Ajout h
      const addStr = normalizeHoursInput(draft.ajout_h);
      const add = addStr === "" ? 0 : Number(addStr);

      if (!Number.isFinite(add) || add < 0) {
        throw new Error("Ajout (h) invalide (ex: 1.5 ou 1,5).");
      }

      const current = Number(task.temps_reel_h ?? 0);
      const nextTotal = current + add;

      const payload: Partial<ChantierTask> & {
        status: TaskStatus;
        date_debut: string | null;
        date_fin: string | null;
        temps_reel_h: number;
      } = {
        status: draft.status,
        date_debut: draft.date_debut === "" ? null : draft.date_debut,
        date_fin: draft.date_fin === "" ? null : draft.date_fin,
        temps_reel_h: nextTotal,
      };

      const { error } = await portalClient
        .from("chantier_tasks")
        .update(payload)
        .eq("id", taskId)
        .eq("chantier_id", chantierId);

      if (error) throw new Error(error.message);

      // maj local + reset ajout
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? ({ ...t, ...payload } as any) : t))
      );

      setDraftById((prev) => ({
        ...prev,
        [taskId]: { ...(prev[taskId] as TaskDraft), ajout_h: "" },
      }));

      setSaveMsgById((p) => ({ ...p, [taskId]: "Enregistré ✅" }));
    } catch (e) {
      setSaveMsgById((p) => ({
        ...p,
        [taskId]: (e as Error).message || "Erreur enregistrement",
      }));
    } finally {
      setSavingById((p) => ({ ...p, [taskId]: false }));
    }
  }

  const totalSaisi = useMemo(() => {
    const sum = tasks.reduce((acc, t) => acc + Number(t.temps_reel_h ?? 0), 0);
    return Math.round(sum * 100) / 100;
  }, [tasks]);

  const renderTaskCards = () => {
    if (tasksLoading) return <p>Chargement des tâches…</p>;
    if (tasksError) return <p style={{ color: "crimson" }}>{tasksError}</p>;
    if (tasks.length === 0) return <p>Aucune tâche trouvée.</p>;

    return (
      <div style={{ display: "grid", gap: 10 }}>
        {tasks.map((task) => {
          const d: TaskDraft =
            draftById[task.id] ?? {
              status: task.status ?? "A_FAIRE",
              date_debut: task.date_debut ?? "",
              date_fin: task.date_fin ?? "",
              ajout_h: "",
            };

          const saving = !!savingById[task.id];
          const msg = saveMsgById[task.id];

          return (
            <div
              key={task.id}
              style={{
                border: "1px solid #eee",
                borderRadius: 10,
                padding: 12,
              }}
            >
              <div style={{ fontWeight: 700 }}>{task.titre}</div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px 1fr",
                  gap: 10,
                  marginTop: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ fontSize: 13, opacity: 0.8 }}>Statut</div>
                <select
                  value={d.status}
                  onChange={(e) => setDraft(task.id, { status: e.target.value as TaskStatus })}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                >
                  <option value="A_FAIRE">À faire</option>
                  <option value="EN_COURS">En cours</option>
                  <option value="FAIT">Fait</option>
                </select>

                <div style={{ fontSize: 13, opacity: 0.8 }}>Date début</div>
                <input
                  type="date"
                  value={d.date_debut}
                  onChange={(e) => setDraft(task.id, { date_debut: e.target.value })}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                />

                <div style={{ fontSize: 13, opacity: 0.8 }}>Date fin</div>
                <input
                  type="date"
                  value={d.date_fin}
                  onChange={(e) => setDraft(task.id, { date_fin: e.target.value })}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                />

                <div style={{ fontSize: 13, opacity: 0.8 }}>Total actuel (h)</div>
                <input
                  value={toInputNumberString(task.temps_reel_h)}
                  disabled
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    background: "#f6f6f6",
                  }}
                />

                <div style={{ fontSize: 13, opacity: 0.8 }}>Ajouter (h)</div>
                <input
                  inputMode="decimal"
                  placeholder="ex: 1.5"
                  value={d.ajout_h}
                  onChange={(e) => setDraft(task.id, { ajout_h: e.target.value })}
                  style={{ padding: 8, borderRadius: 8, border: "1px solid #ddd" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
                <button
                  disabled={saving}
                  onClick={() => saveTask(task.id)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    background: saving ? "#f4f4f4" : "#111",
                    color: saving ? "#666" : "#fff",
                    cursor: saving ? "not-allowed" : "pointer",
                  }}
                >
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>

                {msg ? (
                  <span style={{ fontSize: 13, color: msg.includes("✅") ? "green" : "crimson" }}>
                    {msg}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Portail intervenant</h2>
        <p>Chargement de l’accès…</p>
      </div>
    );
  }

  if (fatalError) {
    return (
      <div style={{ padding: 16 }}>
        <h2>Accès intervenant</h2>
        <p style={{ color: "crimson" }}>{fatalError}</p>
        <p>Demande à l’administrateur de renvoyer un lien.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Portail intervenant</h2>
        <div style={{ opacity: 0.7, fontSize: 13, marginTop: 6 }}>
          Chantier: {chantierId ?? "—"} — Intervenant: {intervenantId ?? "—"}
        </div>
      </header>

      <nav style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid #ddd",
              background: activeTab === t.key ? "#111" : "#fff",
              color: activeTab === t.key ? "#fff" : "#111",
              cursor: "pointer",
            }}
          >
            {t.label}
            {t.note ? (
              <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.75 }}>({t.note})</span>
            ) : null}
          </button>
        ))}
      </nav>

      <section style={{ border: "1px solid #eee", borderRadius: 14, padding: 14 }}>
        {activeTab === "taches" && (
          <>
            <h3 style={{ marginTop: 0 }}>Tâches</h3>
            {renderTaskCards()}
          </>
        )}

        {activeTab === "temps" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <h3 style={{ marginTop: 0, marginBottom: 6 }}>Temps (par tâche)</h3>
                <div style={{ fontSize: 13, opacity: 0.75 }}>
                  Renseigne dates début/fin et ajoute des heures. Le total s’incrémente.
                </div>
              </div>
              <div style={{ fontSize: 13, opacity: 0.85 }}>
                Total saisi : <b>{totalSaisi} h</b>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>{renderTaskCards()}</div>

            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 10 }}>
              Note : “Ajouter (h)” s’additionne au total. Laisse vide si tu ne veux rien ajouter.
            </div>
          </>
        )}

        {activeTab === "planning" && (
          <>
            <h3 style={{ marginTop: 0 }}>Planning (lecture seule)</h3>
            <p>V1 : lecture seule (à brancher ensuite).</p>
          </>
        )}

        {activeTab === "materiel" && (
          <>
            <h3 style={{ marginTop: 0 }}>Matériel</h3>
            <p>V1 : demandes + statut (à brancher ensuite).</p>
          </>
        )}

        {activeTab === "reserves" && (
          <>
            <h3 style={{ marginTop: 0 }}>Réserves</h3>
            <p>V1 : création/modification (à brancher ensuite).</p>
          </>
        )}

        {activeTab === "messagerie" && (
          <>
            <h3 style={{ marginTop: 0 }}>Messagerie</h3>
            <p>V1 : écrire (à brancher ensuite).</p>
          </>
        )}

        {activeTab === "rapports" && (
          <>
            <h3 style={{ marginTop: 0 }}>Rapports (lecture seule)</h3>
            <p>V1 : lecture seule (à brancher ensuite).</p>
          </>
        )}
      </section>
    </div>
  );
}
