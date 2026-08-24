// src/pages/ChantierNewPage.tsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, MapPin, Plus, RotateCcw } from "lucide-react";
import type { ChantierStatus } from "../types/chantier";
import { createChantier } from "../services/chantiers.service";
import { useI18n } from "../i18n";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ChantierNewPage() {
  const navigate = useNavigate();
  const { t } = useI18n();

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

    try {
      const createdChantier = await createChantier(payload);

      navigate(`/chantiers/${createdChantier.id}`);
    } catch (error: any) {
      setErrorMsg(error?.message ?? "Erreur création chantier.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <header className="rounded-surface border border-subtle bg-surface p-4 shadow-elevated">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Link to="/chantiers" className="bt-control inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-field border border-subtle bg-surface text-ink-secondary hover:bg-interactive" aria-label={t("chantierNew.back")}>
              <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <div className="min-w-0">
              <div className="bt-caption text-muted">
                <Link to="/chantiers" className="hover:text-ink">{t("chantierNew.breadcrumb")}</Link>
                <span aria-hidden> / </span>
                {t("chantierNew.title")}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h1 className="bt-page-title text-ink">{t("chantierNew.title")}</h1>
                <span className="rounded-full border border-subtle bg-neutral-soft px-2 py-0.5 text-xs font-semibold text-neutral-on">
                  {form.status === "PREPARATION"
                    ? t("common.chantierStatus.PREPARATION")
                    : form.status === "EN_COURS"
                    ? t("common.chantierStatus.EN_COURS")
                    : t("common.chantierStatus.TERMINE")}
                </span>
              </div>
              <p className="bt-secondary mt-1 max-w-2xl text-muted">{t("chantierNew.subtitle")}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link to="/chantiers" className="bt-control inline-flex items-center justify-center rounded-field border border-subtle bg-surface px-3 py-2 text-sm font-semibold text-ink-secondary hover:bg-interactive">
              {t("common.actions.cancel")}
            </Link>
            <button
              type="submit"
              form="new-chantier-form"
              disabled={!canSubmit}
              className={[
                "bt-control inline-flex items-center justify-center gap-2 rounded-field px-3 py-2 text-sm font-semibold transition",
                canSubmit
                  ? "bg-primary text-primary-contrast hover:bg-primary-hover"
                  : "cursor-not-allowed bg-neutral-soft text-muted",
              ].join(" ")}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              {loading ? t("chantierNew.creating") : t("chantierNew.submit")}
            </button>
          </div>
        </div>
      </header>

      <form id="new-chantier-form" onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-surface border border-subtle bg-surface p-4 shadow-sm">
        {errorMsg && (
          <div className="mb-4 rounded-card border border-danger/20 bg-danger-soft p-3 text-sm font-medium text-danger-on">
            {t("chantierNew.errorPrefix", { message: errorMsg })}
          </div>
        )}

        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="bt-caption text-ink-secondary">
              {t("chantierNew.fields.name")} <span className="text-danger">*</span>
            </label>
            <input
              className="bt-control w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted focus:border-primary"
              placeholder={t("chantierNew.placeholders.name")}
              value={form.nom}
              onChange={(e) => setForm((p) => ({ ...p, nom: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="bt-caption text-ink-secondary">{t("chantierNew.fields.client")}</label>
            <input
              className="bt-control w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted focus:border-primary"
              placeholder={t("chantierNew.placeholders.client")}
              value={form.client}
              onChange={(e) => setForm((p) => ({ ...p, client: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="bt-caption text-ink-secondary">{t("chantierNew.fields.address")}</label>
            <textarea
              className="min-h-[84px] w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none transition placeholder:text-muted focus:border-primary"
              placeholder={t("chantierNew.placeholders.address")}
              value={form.adresse}
              onChange={(e) => setForm((p) => ({ ...p, adresse: e.target.value }))}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="bt-caption text-ink-secondary">{t("chantierNew.fields.startDate")}</label>
              <input
                type="date"
                className="bt-control w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary"
                value={form.date_debut}
                onChange={(e) => setForm((p) => ({ ...p, date_debut: e.target.value }))}
              />
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary-on hover:text-primary"
                onClick={() => setForm((p) => ({ ...p, date_debut: todayISO() }))}
              >
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                {t("chantierNew.setToday")}
              </button>
            </div>

            <div className="space-y-2">
              <label className="bt-caption text-ink-secondary">{t("chantierNew.fields.endDate")}</label>
              <input
                type="date"
                className="bt-control w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary"
                value={form.date_fin_prevue}
                onChange={(e) => setForm((p) => ({ ...p, date_fin_prevue: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="bt-caption text-ink-secondary">{t("chantierNew.fields.status")}</label>
            <select
              className="bt-control w-full rounded-field border border-subtle bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-primary"
              value={form.status}
              onChange={(e) =>
                setForm((p) => ({ ...p, status: e.target.value as ChantierStatus }))
              }
            >
              <option value="PREPARATION">{t("common.chantierStatus.PREPARATION")}</option>
              <option value="EN_COURS">{t("common.chantierStatus.EN_COURS")}</option>
              <option value="TERMINE">{t("common.chantierStatus.TERMINE")}</option>
            </select>
          </div>
        </div>
        </section>

        <aside className="rounded-surface border border-subtle bg-surface p-4 shadow-sm lg:sticky lg:top-24 lg:self-start">
          <div className="bt-section-title text-ink">Synthèse</div>
          <div className="mt-3 space-y-3">
            <div className="rounded-card border border-subtle bg-interactive p-3">
              <div className="bt-caption text-muted">Nom</div>
              <div className="bt-card-title mt-1 truncate text-ink">{form.nom.trim() || t("chantierNew.placeholders.name")}</div>
            </div>
            <div className="rounded-card border border-subtle bg-interactive p-3">
              <div className="flex items-center gap-2 text-muted">
                <MapPin className="h-4 w-4" strokeWidth={1.75} />
                <span className="bt-caption">Contexte</span>
              </div>
              <div className="bt-secondary mt-1 text-ink">{form.client.trim() || t("chantierNew.placeholders.client")}</div>
              <div className="bt-caption mt-1 line-clamp-2 text-muted">{form.adresse.trim() || t("chantierNew.placeholders.address")}</div>
            </div>
            <div className="rounded-card border border-subtle bg-interactive p-3">
              <div className="flex items-center gap-2 text-muted">
                <CalendarDays className="h-4 w-4" strokeWidth={1.75} />
                <span className="bt-caption">Planning</span>
              </div>
              <div className="bt-secondary mt-1 text-ink">
                {form.date_debut || "-"} - {form.date_fin_prevue || "-"}
              </div>
            </div>
            <div className="rounded-card border border-subtle bg-primary-soft p-3 text-primary-on">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" strokeWidth={1.75} />
                <span className="bt-caption">Création</span>
              </div>
              <div className="bt-secondary mt-1">
                {canSubmit ? "Prêt à créer le chantier." : "Le nom du chantier est obligatoire."}
              </div>
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}



