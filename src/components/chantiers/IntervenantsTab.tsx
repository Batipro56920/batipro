import { useEffect, useState } from "react";
import type { FormEvent } from "react";

import { sendIntervenantAccess } from "../../services/chantierAccessAdmin.service";
import {
  listIntervenantsByChantierId,
  createIntervenant,
  deleteIntervenant,
  type IntervenantRow,
} from "../../services/intervenants.service";

type Props = {
  chantierId: string;
};

export default function IntervenantsTab({ chantierId }: Props) {
  const [items, setItems] = useState<IntervenantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [accessUrlById, setAccessUrlById] = useState<Record<string, string>>({});

  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");

  async function refresh() {
    if (!chantierId) return;
    setLoading(true);
    try {
      const data = await listIntervenantsByChantierId(chantierId);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantierId]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = nom.trim();
    if (!trimmed) return;

    await createIntervenant({
      chantier_id: chantierId,
      nom: trimmed,
      email: email.trim() || null,
      telephone: telephone.trim() || null,
    });

    setNom("");
    setEmail("");
    setTelephone("");
    await refresh();
  }

  async function onDelete(id: string) {
    if (!window.confirm("Supprimer cet intervenant ?")) return;
    await deleteIntervenant(id);
    await refresh();
  }

  async function onSendAccess(itv: IntervenantRow) {
    if (!chantierId) return;
    const to = (itv.email ?? "").trim();
    if (!to || !to.includes("@")) {
      window.alert("Email intervenant manquant ou invalide.");
      return;
    }

    try {
      setSendingId(itv.id);
      const res = await sendIntervenantAccess({
        chantierId,
        intervenantId: itv.id,
        email: to,
      });

      if (res?.accessUrl) {
        setAccessUrlById((prev) => ({ ...prev, [itv.id]: res.accessUrl }));
      }
    } finally {
      setSendingId(null);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      window.alert("Lien copie.");
    } catch {
      window.prompt("Copie ce lien :", text);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>Intervenants</div>
          <div style={{ opacity: 0.7 }}>Creer, modifier et supprimer les intervenants du chantier</div>
        </div>
        <button onClick={refresh} disabled={loading}>
          {loading ? "Chargement..." : "Rafraichir"}
        </button>
      </div>

      <form onSubmit={onAdd} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>Ajouter un intervenant</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 10 }}>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom (ex: Pierre - Plombier)" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optionnel)" />
          <input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="Telephone (optionnel)" />
          <button type="submit">+ Ajouter</button>
        </div>
      </form>

      <div style={{ display: "grid", gap: 12 }}>
        {items.map((itv) => {
          const accessUrl = accessUrlById[itv.id];

          return (
            <div key={itv.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{itv.nom}</div>
                  <div style={{ opacity: 0.75, fontSize: 13 }}>
                    {(itv.email ?? "-")} {itv.telephone ? ` • ${itv.telephone}` : ""}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => onSendAccess(itv)} disabled={sendingId === itv.id}>
                    {sendingId === itv.id ? "Envoi..." : "Envoyer acces"}
                  </button>
                  <button onClick={() => onDelete(itv.id)} style={{ color: "#b91c1c" }}>
                    Supprimer
                  </button>
                </div>
              </div>

              {accessUrl ? (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 6 }}>Dernier lien genere</div>
                  <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 10, padding: 10 }}>
                    <div style={{ wordBreak: "break-all", fontFamily: "monospace", fontSize: 12 }}>{accessUrl}</div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                      <button onClick={() => copy(accessUrl)}>Copier</button>
                      <a href={accessUrl} target="_blank" rel="noreferrer">
                        <button type="button">Ouvrir</button>
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}

        {!loading && items.length === 0 && <div style={{ opacity: 0.7 }}>Aucun intervenant pour l'instant.</div>}
      </div>
    </div>
  );
}
