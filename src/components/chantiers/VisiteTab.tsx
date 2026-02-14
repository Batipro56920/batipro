import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { uploadDocument } from "../../services/chantierDocuments.service";
import {
  createVisiteWithActions,
  listVisiteActionsByVisiteIds,
  listVisitesByChantierId,
  setVisitePdfDocument,
  type ChantierVisiteActionRow,
  type ChantierVisiteRow,
} from "../../services/chantierVisites.service";
import { generateVisiteReportPdfBlob } from "../../services/chantiersReportsPdf.service";
import { listDoeItemsByChantierId, upsertDoeItem } from "../../services/chantierDoe.service";
import type { IntervenantRow } from "../../services/intervenants.service";

type ActionDraft = {
  action_text: string;
  responsable: string;
  due_date: string;
};

type Props = {
  chantierId: string;
  chantierName: string;
  chantierAddress?: string | null;
  intervenants: IntervenantRow[];
  onDocumentsRefresh: () => Promise<void>;
};

function defaultVisitDateTime() {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const local = new Date(now.getTime() - tzOffset);
  return local.toISOString().slice(0, 16);
}

export default function VisiteTab({
  chantierId,
  chantierName,
  chantierAddress,
  intervenants,
  onDocumentsRefresh,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [visites, setVisites] = useState<ChantierVisiteRow[]>([]);
  const [actionsByVisiteId, setActionsByVisiteId] = useState<Map<string, ChantierVisiteActionRow[]>>(new Map());

  const [visitDateTime, setVisitDateTime] = useState(defaultVisitDateTime());
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [meteo, setMeteo] = useState("");
  const [avancementText, setAvancementText] = useState("");
  const [avancementPercent, setAvancementPercent] = useState("");
  const [observations, setObservations] = useState("");
  const [safetyPoints, setSafetyPoints] = useState("");
  const [decisions, setDecisions] = useState("");
  const [actions, setActions] = useState<ActionDraft[]>([{ action_text: "", responsable: "", due_date: "" }]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [includeInDoe, setIncludeInDoe] = useState(false);

  const intervenantById = useMemo(() => {
    const map = new Map<string, IntervenantRow>();
    intervenants.forEach((it) => map.set(it.id, it));
    return map;
  }, [intervenants]);

  async function loadData() {
    if (!chantierId) return;
    setLoading(true);
    setError(null);
    try {
      const visiteRows = await listVisitesByChantierId(chantierId);
      setVisites(visiteRows);
      const actionRows = await listVisiteActionsByVisiteIds(visiteRows.map((v) => v.id));
      const next = new Map<string, ChantierVisiteActionRow[]>();
      actionRows.forEach((action) => {
        if (!next.has(action.visite_id)) next.set(action.visite_id, []);
        next.get(action.visite_id)?.push(action);
      });
      setActionsByVisiteId(next);
    } catch (err: any) {
      setError(err?.message ?? "Erreur chargement visites.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [chantierId]);

  function resetForm() {
    setVisitDateTime(defaultVisitDateTime());
    setSelectedParticipants([]);
    setMeteo("");
    setAvancementText("");
    setAvancementPercent("");
    setObservations("");
    setSafetyPoints("");
    setDecisions("");
    setActions([{ action_text: "", responsable: "", due_date: "" }]);
    setPhotos([]);
    setIncludeInDoe(false);
  }

  async function onValidateVisite() {
    if (!visitDateTime) {
      setError("Date/heure obligatoire.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const redactorEmail = userData.user?.email ?? null;
      const participantNames = selectedParticipants
        .map((id) => intervenantById.get(id)?.nom)
        .filter((name): name is string => Boolean(name));

      const created = await createVisiteWithActions({
        chantier_id: chantierId,
        visit_datetime: new Date(visitDateTime).toISOString(),
        redactor_email: redactorEmail,
        participants: participantNames,
        meteo: meteo || null,
        avancement_text: avancementText || null,
        avancement_percent: avancementPercent ? Number(avancementPercent) : null,
        observations: observations || null,
        safety_points: safetyPoints || null,
        decisions: decisions || null,
        include_in_doe: includeInDoe,
        photo_count: photos.length,
        actions,
      });

      const reportBlob = await generateVisiteReportPdfBlob({
        chantierName,
        chantierAddress,
        visitDateTime: new Date(visitDateTime).toISOString(),
        redactorEmail,
        participants: participantNames,
        meteo,
        avancementText,
        avancementPercent: avancementPercent ? Number(avancementPercent) : null,
        observations,
        safetyPoints,
        decisions,
        actions,
        photos,
      });

      const isoDate = new Date(visitDateTime).toISOString().slice(0, 10);
      const file = new File([reportBlob], `visite-chantier-${isoDate}.pdf`, { type: "application/pdf" });

      const createdDoc = await uploadDocument({
        chantierId,
        file,
        title: `Visite chantier - ${isoDate}`,
        category: "VISITE",
        documentType: "PDF",
        visibility_mode: "GLOBAL",
      });

      await setVisitePdfDocument(created.visite.id, createdDoc.id);

      if (includeInDoe) {
        const doeItems = await listDoeItemsByChantierId(chantierId);
        await upsertDoeItem({
          chantier_id: chantierId,
          document_id: createdDoc.id,
          sort_order: doeItems.length + 1,
        });
      }

      await onDocumentsRefresh();
      await loadData();
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      setError(err?.message ?? "Erreur validation visite.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold section-title">Visite de chantier</div>
          <div className="text-sm text-slate-500">Saisie, validation et génération automatique du rapport PDF.</div>
        </div>
        <button
          type="button"
          className="rounded-xl px-4 py-2 text-sm bg-slate-900 text-white hover:bg-slate-800"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Fermer" : "Nouvelle visite"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border bg-white p-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Date / heure</div>
              <input
                type="datetime-local"
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={visitDateTime}
                onChange={(e) => setVisitDateTime(e.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Météo</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={meteo}
                onChange={(e) => setMeteo(e.target.value)}
                placeholder="Ex: Couvert, vent faible"
              />
            </label>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-slate-600">Participants</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {intervenants.map((intervenant) => {
                const checked = selectedParticipants.includes(intervenant.id);
                return (
                  <label key={intervenant.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedParticipants((prev) => [...prev, intervenant.id]);
                        } else {
                          setSelectedParticipants((prev) => prev.filter((id) => id !== intervenant.id));
                        }
                      }}
                    />
                    <span>{intervenant.nom}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label className="space-y-1 text-sm">
            <div className="text-xs text-slate-600">Avancement (texte)</div>
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm min-h-20"
              value={avancementText}
              onChange={(e) => setAvancementText(e.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm max-w-[220px]">
            <div className="text-xs text-slate-600">Avancement (%)</div>
            <input
              type="number"
              min={0}
              max={100}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              value={avancementPercent}
              onChange={(e) => setAvancementPercent(e.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <div className="text-xs text-slate-600">Observations générales</div>
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm min-h-20"
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <div className="text-xs text-slate-600">Points sécurité</div>
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm min-h-20"
              value={safetyPoints}
              onChange={(e) => setSafetyPoints(e.target.value)}
            />
          </label>

          <label className="space-y-1 text-sm">
            <div className="text-xs text-slate-600">Décisions prises</div>
            <textarea
              className="w-full rounded-xl border px-3 py-2 text-sm min-h-20"
              value={decisions}
              onChange={(e) => setDecisions(e.target.value)}
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-slate-600">Actions à faire</div>
              <button
                type="button"
                className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                onClick={() => setActions((prev) => [...prev, { action_text: "", responsable: "", due_date: "" }])}
              >
                + Action
              </button>
            </div>
            <div className="space-y-2">
              {actions.map((action, index) => (
                <div key={`${index}-${action.action_text}`} className="grid gap-2 md:grid-cols-10">
                  <input
                    className="rounded-xl border px-3 py-2 text-sm md:col-span-5"
                    placeholder="Action"
                    value={action.action_text}
                    onChange={(e) =>
                      setActions((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, action_text: e.target.value } : row)),
                      )
                    }
                  />
                  <input
                    className="rounded-xl border px-3 py-2 text-sm md:col-span-3"
                    placeholder="Responsable"
                    value={action.responsable}
                    onChange={(e) =>
                      setActions((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, responsable: e.target.value } : row)),
                      )
                    }
                  />
                  <input
                    type="date"
                    className="rounded-xl border px-3 py-2 text-sm md:col-span-2"
                    value={action.due_date}
                    onChange={(e) =>
                      setActions((prev) =>
                        prev.map((row, i) => (i === index ? { ...row, due_date: e.target.value } : row)),
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Photos (optionnel)</div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
              />
              <div className="text-xs text-slate-500">{photos.length} photo(s) sélectionnée(s)</div>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeInDoe}
                onChange={(e) => setIncludeInDoe(e.target.checked)}
              />
              Inclure au DOE
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onValidateVisite}
              disabled={saving}
              className={[
                "rounded-xl px-4 py-2 text-sm",
                saving ? "bg-slate-300 text-slate-700" : "bg-slate-900 text-white hover:bg-slate-800",
              ].join(" ")}
            >
              {saving ? "Validation..." : "Valider la visite"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-white p-4">
        <div className="font-medium mb-2">Historique des visites</div>
        {loading ? (
          <div className="text-sm text-slate-500">Chargement...</div>
        ) : visites.length === 0 ? (
          <div className="text-sm text-slate-500">Aucune visite enregistrée.</div>
        ) : (
          <div className="space-y-3">
            {visites.map((visite) => (
              <div key={visite.id} className="rounded-xl border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">
                    Visite du {new Date(visite.visit_datetime).toLocaleDateString("fr-FR")}
                  </div>
                  <div className="text-xs text-slate-500">
                    {visite.redactor_email || "Rédacteur inconnu"} - PDF: {visite.pdf_document_id ? "OK" : "—"}
                  </div>
                </div>
                {visite.participants?.length > 0 && (
                  <div className="text-xs text-slate-500 mt-1">Participants: {visite.participants.join(", ")}</div>
                )}
                {(actionsByVisiteId.get(visite.id) ?? []).length > 0 && (
                  <div className="mt-2 text-xs text-slate-600">
                    {(actionsByVisiteId.get(visite.id) ?? []).length} action(s)
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
