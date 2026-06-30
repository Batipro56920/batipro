import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Plus, RefreshCw, Search, Truck } from "lucide-react";
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
  type SupplierRow,
} from "../services/suppliers.service";
import { useI18n } from "../i18n";
import { PurchaseOrdersPanel, StockTrackingPanel } from "../features/purchase-orders";

type SupplierFormState = {
  name: string;
  specialty: string;
  address: string;
  city: string;
  phone: string;
  email: string;
  siret: string;
  notes: string;
  is_active: boolean;
};

type FournisseursTab = "suppliers" | "orders" | "stock";

const EMPTY_SUPPLIER: SupplierFormState = {
  name: "",
  specialty: "",
  address: "",
  city: "",
  phone: "",
  email: "",
  siret: "",
  notes: "",
  is_active: true,
};

function toSupplierForm(row: SupplierRow): SupplierFormState {
  return {
    name: row.name ?? "",
    specialty: row.specialty ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    phone: row.phone ?? "",
    email: row.email ?? "",
    siret: row.siret ?? "",
    notes: row.notes ?? "",
    is_active: row.is_active,
  };
}

function isFournisseursTab(value: string | null): value is FournisseursTab {
  return value === "suppliers" || value === "orders" || value === "stock";
}

type FournisseursPageProps = {
  initialTab?: FournisseursTab;
};

export default function FournisseursPage({ initialTab = "suppliers" }: FournisseursPageProps) {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const supplierQueryParam = searchParams.get("q") ?? "";
  const activeSupplierId = searchParams.get("supplierId") ?? "";
  const activePurchaseOrderId = searchParams.get("purchaseOrderId") ?? "";
  const openedSupplierFromUrlRef = useRef("");
  const tabQueryParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<FournisseursTab>(() => activePurchaseOrderId ? "orders" : isFournisseursTab(tabQueryParam) ? tabQueryParam : initialTab);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [suppliersNotice, setSuppliersNotice] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [search, setSearch] = useState(supplierQueryParam);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(EMPTY_SUPPLIER);

  const targetedSupplier = useMemo(
    () => (activeSupplierId ? suppliers.find((row) => row.id === activeSupplierId) ?? null : null),
    [activeSupplierId, suppliers],
  );
  const targetedSupplierMissing = Boolean(activeSupplierId && !loadingSuppliers && !targetedSupplier);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((row) =>
      [row.name, row.specialty, row.city, row.email, row.phone]
        .map((part) => String(part ?? "").toLowerCase())
        .some((part) => part.includes(q)),
    );
  }, [search, suppliers]);
  const supplierStats = useMemo(() => ({
    total: suppliers.length,
    active: suppliers.filter((row) => row.is_active).length,
    inactive: suppliers.filter((row) => !row.is_active).length,
    withEmail: suppliers.filter((row) => row.email).length,
  }), [suppliers]);

  async function loadSuppliersData() {
    setLoadingSuppliers(true);
    setSuppliersError(null);
    try {
      const rows = await listSuppliers();
      setSuppliers(rows);
    } catch (err: any) {
      setSuppliersError(err?.message ?? t("fournisseurs.loadError"));
      setSuppliers([]);
    } finally {
      setLoadingSuppliers(false);
    }
  }

  useEffect(() => {
    void loadSuppliersData();
  }, []);

  useEffect(() => {
    setSearch((current) => current === supplierQueryParam ? current : supplierQueryParam);
    if (supplierQueryParam || activeSupplierId) {
      setActiveTab("suppliers");
      return;
    }
    if (activePurchaseOrderId) {
      setActiveTab("orders");
      return;
    }
    if (isFournisseursTab(tabQueryParam)) {
      setActiveTab(tabQueryParam);
    }
  }, [activePurchaseOrderId, activeSupplierId, supplierQueryParam, tabQueryParam]);

  useEffect(() => {
    if (!activeSupplierId) {
      openedSupplierFromUrlRef.current = "";
      return;
    }
    if (loadingSuppliers || openedSupplierFromUrlRef.current === activeSupplierId) return;
    if (!targetedSupplier) return;

    setActiveTab("suppliers");
    setEditingSupplierId(targetedSupplier.id);
    setSupplierForm(toSupplierForm(targetedSupplier));
    setSupplierFormOpen(true);
    setSuppliersNotice(null);
    setSuppliersError(null);
    openedSupplierFromUrlRef.current = activeSupplierId;
  }, [activeSupplierId, loadingSuppliers, targetedSupplier]);

  function clearActiveSupplierParam() {
    if (!activeSupplierId) return;
    openedSupplierFromUrlRef.current = "";
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("supplierId");
    setSearchParams(nextParams, { replace: true });
  }

  function closeSupplierForm() {
    setSupplierFormOpen(false);
    setEditingSupplierId(null);
    clearActiveSupplierParam();
  }

  function updateSearch(nextSearch: string) {
    setSearch(nextSearch);
    const nextParams = new URLSearchParams(searchParams);
    const trimmed = nextSearch.trim();
    if (trimmed) {
      nextParams.set("q", trimmed);
    } else {
      nextParams.delete("q");
    }
    nextParams.delete("supplierId");
    nextParams.delete("purchaseOrderId");
    nextParams.delete("tab");
    setSearchParams(nextParams, { replace: true });
  }

  function clearSearchFromUrl() {
    setSearch("");
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("q");
    nextParams.delete("supplierId");
    setSearchParams(nextParams, { replace: true });
  }

  function changeTab(tab: FournisseursTab) {
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("supplierId");
    nextParams.delete("purchaseOrderId");
    if (tab === "suppliers") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tab);
      nextParams.delete("q");
      setSearch("");
    }
    setSearchParams(nextParams, { replace: true });
  }

  function openCreateSupplier() {
    clearActiveSupplierParam();
    setEditingSupplierId(null);
    setSupplierForm({ ...EMPTY_SUPPLIER });
    setSupplierFormOpen(true);
    setSuppliersNotice(null);
    setSuppliersError(null);
  }

  function openEditSupplier(row: SupplierRow) {
    clearActiveSupplierParam();
    setEditingSupplierId(row.id);
    setSupplierForm(toSupplierForm(row));
    setSupplierFormOpen(true);
    setSuppliersNotice(null);
    setSuppliersError(null);
  }

  async function onSaveSupplier() {
    setSavingSupplier(true);
    setSuppliersError(null);
    setSuppliersNotice(null);
    try {
      if (editingSupplierId) {
        await updateSupplier(editingSupplierId, supplierForm);
        setSuppliersNotice(t("fournisseurs.updated"));
      } else {
        await createSupplier(supplierForm);
        setSuppliersNotice(t("fournisseurs.created"));
      }
      closeSupplierForm();
      setSupplierForm({ ...EMPTY_SUPPLIER });
      await loadSuppliersData();
    } catch (err: any) {
      setSuppliersError(err?.message ?? t("fournisseurs.saveError"));
    } finally {
      setSavingSupplier(false);
    }
  }

  async function onDeleteSupplier(id: string) {
    if (!window.confirm(t("fournisseurs.deleteConfirm"))) return;
    setSuppliersError(null);
    setSuppliersNotice(null);
    try {
      await deleteSupplier(id);
      await loadSuppliersData();
      setSuppliersNotice(t("fournisseurs.deleted"));
    } catch (err: any) {
      setSuppliersError(err?.message ?? t("fournisseurs.deleteError"));
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">Achats</div>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">{t("fournisseurs.title")}</h1>
          <p className="mt-1 text-sm text-slate-500">Fournisseurs, bons de commande, stock chantier et achats liés à la rentabilité projet.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void loadSuppliersData()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw className="h-4 w-4" /> Rafraîchir
          </button>
        {activeTab === "suppliers" ? (
          <button
            type="button"
            onClick={openCreateSupplier}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> {t("fournisseurs.new")}
          </button>
        ) : null}
        </div>
      </div>
      </div>

      <nav className="flex w-fit rounded-2xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Navigation fournisseurs">
        {[
          ["suppliers", "Fournisseurs"],
          ["orders", "Bons de commande"],
          ["stock", "Stock"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => changeTab(id as FournisseursTab)}
            className={[
              "h-9 rounded-xl px-4 text-sm font-semibold transition",
              activeTab === id ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
            ].join(" ")}
          >
            {label}
          </button>
        ))}
      </nav>

      {suppliersError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{suppliersError}</div>
      )}
      {suppliersNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {suppliersNotice}
        </div>
      )}

      {activeTab === "orders" ? <PurchaseOrdersPanel suppliers={suppliers} /> : null}
      {activeTab === "stock" ? <StockTrackingPanel suppliers={suppliers} /> : null}

      {activeTab === "suppliers" && activeSupplierId ? (
        <div className={[
          "rounded-2xl border p-4 text-sm",
          targetedSupplierMissing ? "border-amber-200 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900",
        ].join(" ")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">
                {targetedSupplierMissing ? "Fournisseur introuvable" : "Fournisseur ouvert depuis la recherche globale"}
              </div>
              <p className={targetedSupplierMissing ? "mt-1 text-amber-800" : "mt-1 text-blue-800"}>
                {targetedSupplierMissing
                  ? "Le lien pointe vers un fournisseur supprimé ou non accessible avec les droits actuels."
                  : `${targetedSupplier?.name ?? "Le fournisseur"} est sélectionné et prêt à être contrôlé ou mis à jour.`}
              </p>
            </div>
            <button
              type="button"
              onClick={clearActiveSupplierParam}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              Retirer le ciblage
            </button>
          </div>
        </div>
      ) : null}

      {activeTab === "suppliers" ? (
        <section className="grid gap-3 md:grid-cols-4">
          <SupplierMetric icon={Building2} label="Fournisseurs" value={String(supplierStats.total)} />
          <SupplierMetric icon={Truck} label="Actifs" value={String(supplierStats.active)} />
          <SupplierMetric icon={Building2} label="Inactifs" value={String(supplierStats.inactive)} />
          <SupplierMetric icon={Building2} label="Avec email" value={String(supplierStats.withEmail)} />
        </section>
      ) : null}

      {activeTab === "suppliers" && supplierFormOpen && (
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <div className="font-semibold">{editingSupplierId ? t("fournisseurs.edit") : t("fournisseurs.new")}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm md:col-span-2">
              <div className="text-xs text-slate-600">{t("common.labels.name")}</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">{t("fournisseurs.fields.specialty")}</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.specialty}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, specialty: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">{t("fournisseurs.fields.city")}</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.city}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, city: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <div className="text-xs text-slate-600">{t("common.labels.address")}</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.address}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">{t("common.labels.phone")}</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">{t("common.labels.email")}</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">{t("fournisseurs.fields.siret")}</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.siret}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, siret: e.target.value }))}
              />
            </label>

            <label className="flex items-center gap-2 text-sm mt-5">
              <input
                type="checkbox"
                checked={supplierForm.is_active}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              {t("fournisseurs.fields.active")}
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <div className="text-xs text-slate-600">{t("fournisseurs.fields.notes")}</div>
              <textarea
                className="w-full rounded-xl border px-3 py-2 text-sm min-h-20"
                value={supplierForm.notes}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-xl border px-3 py-2 text-sm hover:bg-slate-50"
              onClick={closeSupplierForm}
            >
              {t("common.actions.cancel")}
            </button>
            <button
              type="button"
              className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800"
              onClick={() => void onSaveSupplier()}
              disabled={savingSupplier}
            >
              {savingSupplier ? t("common.states.saving") : t("common.actions.save")}
            </button>
          </div>
        </div>
      )}

      {activeTab === "suppliers" ? <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none focus:border-blue-300"
            placeholder={t("fournisseurs.searchPlaceholder")}
            value={search}
            onChange={(e) => updateSearch(e.target.value)}
          />
        </label>
        {search.trim() ? (
          <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800 sm:flex-row sm:items-center sm:justify-between">
            <span>Fournisseurs filtrés sur « {search.trim()} »{activeSupplierId ? " depuis la recherche globale" : ""}.</span>
            <button type="button" className="self-start rounded-lg border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 sm:self-auto" onClick={clearSearchFromUrl}>Réinitialiser</button>
          </div>
        ) : null}
      </div> : null}

      {activeTab === "suppliers" && loadingSuppliers ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">{t("common.states.loading")}</div>
      ) : activeTab === "suppliers" && filteredSuppliers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Truck className="h-5 w-5" /></div>
          <div className="mt-3 font-semibold text-slate-950">{t("fournisseurs.empty")}</div>
          <div className="mt-1 text-sm text-slate-500">Ajoutez un fournisseur pour préparer les bons de commande.</div>
          <button type="button" onClick={openCreateSupplier} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Nouveau fournisseur</button>
        </div>
      ) : activeTab === "suppliers" ? (
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.name")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("fournisseurs.fields.specialty")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("fournisseurs.fields.city")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.phone")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.email")}</th>
                <th className="px-4 py-3 text-left font-medium">{t("common.labels.status")}</th>
                <th className="px-4 py-3 text-right font-medium">{t("common.actions.edit")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((row) => (
                <tr key={row.id} className={row.id === activeSupplierId ? "border-t bg-blue-50 ring-1 ring-inset ring-blue-200" : "border-t"}>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">{row.specialty ?? "-"}</td>
                  <td className="px-4 py-3">{row.city ?? "-"}</td>
                  <td className="px-4 py-3">{row.phone ?? "-"}</td>
                  <td className="px-4 py-3">{row.email ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "text-xs px-2 py-1 rounded-full border",
                        row.is_active
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-600 border-slate-200",
                      ].join(" ")}
                    >
                      {row.is_active ? t("common.activity.active") : t("common.activity.inactive")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                        onClick={() => openEditSupplier(row)}
                      >
                        {t("common.actions.edit")}
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        onClick={() => void onDeleteSupplier(row.id)}
                      >
                        {t("common.actions.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function SupplierMetric({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</div>
          <div className="mt-2 text-xl font-bold text-slate-950">{value}</div>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}