import { useEffect, useMemo, useState } from "react";
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  updateSupplier,
  type SupplierRow,
} from "../services/suppliers.service";

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

export default function FournisseursPage() {
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);
  const [savingSupplier, setSavingSupplier] = useState(false);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [suppliersNotice, setSuppliersNotice] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [search, setSearch] = useState("");
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierFormOpen, setSupplierFormOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(EMPTY_SUPPLIER);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((row) =>
      [row.name, row.specialty, row.city, row.email, row.phone]
        .map((part) => String(part ?? "").toLowerCase())
        .some((part) => part.includes(q)),
    );
  }, [search, suppliers]);

  async function loadSuppliersData() {
    setLoadingSuppliers(true);
    setSuppliersError(null);
    try {
      const rows = await listSuppliers();
      setSuppliers(rows);
    } catch (err: any) {
      setSuppliersError(err?.message ?? "Erreur chargement fournisseurs.");
      setSuppliers([]);
    } finally {
      setLoadingSuppliers(false);
    }
  }

  useEffect(() => {
    void loadSuppliersData();
  }, []);

  function openCreateSupplier() {
    setEditingSupplierId(null);
    setSupplierForm({ ...EMPTY_SUPPLIER });
    setSupplierFormOpen(true);
    setSuppliersNotice(null);
    setSuppliersError(null);
  }

  function openEditSupplier(row: SupplierRow) {
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
        setSuppliersNotice("Fournisseur modifie.");
      } else {
        await createSupplier(supplierForm);
        setSuppliersNotice("Fournisseur cree.");
      }
      setSupplierFormOpen(false);
      setEditingSupplierId(null);
      setSupplierForm({ ...EMPTY_SUPPLIER });
      await loadSuppliersData();
    } catch (err: any) {
      setSuppliersError(err?.message ?? "Impossible d'enregistrer ce fournisseur.");
    } finally {
      setSavingSupplier(false);
    }
  }

  async function onDeleteSupplier(id: string) {
    if (!window.confirm("Supprimer ce fournisseur ?")) return;
    setSuppliersError(null);
    setSuppliersNotice(null);
    try {
      await deleteSupplier(id);
      await loadSuppliersData();
      setSuppliersNotice("Fournisseur supprime.");
    } catch (err: any) {
      setSuppliersError(err?.message ?? "Impossible de supprimer ce fournisseur.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fournisseurs</h1>
          <p className="text-sm text-slate-500">Gestion complete des fournisseurs de l'entreprise.</p>
        </div>
        <button
          type="button"
          onClick={openCreateSupplier}
          className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800"
        >
          + Nouveau fournisseur
        </button>
      </div>

      {suppliersError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{suppliersError}</div>
      )}
      {suppliersNotice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
          {suppliersNotice}
        </div>
      )}

      {supplierFormOpen && (
        <div className="rounded-2xl border bg-white p-4 space-y-3">
          <div className="font-semibold">{editingSupplierId ? "Modifier fournisseur" : "Nouveau fournisseur"}</div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="space-y-1 text-sm md:col-span-2">
              <div className="text-xs text-slate-600">Nom</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.name}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Specialite</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.specialty}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, specialty: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Ville</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.city}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, city: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <div className="text-xs text-slate-600">Adresse</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.address}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Telephone</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">Email</div>
              <input
                className="w-full rounded-xl border px-3 py-2 text-sm"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))}
              />
            </label>

            <label className="space-y-1 text-sm">
              <div className="text-xs text-slate-600">SIRET</div>
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
              Actif
            </label>

            <label className="space-y-1 text-sm md:col-span-2">
              <div className="text-xs text-slate-600">Notes</div>
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
              onClick={() => {
                setSupplierFormOpen(false);
                setEditingSupplierId(null);
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="rounded-xl bg-slate-900 text-white px-4 py-2 text-sm hover:bg-slate-800"
              onClick={() => void onSaveSupplier()}
              disabled={savingSupplier}
            >
              {savingSupplier ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border bg-white p-4">
        <input
          className="w-full rounded-xl border px-3 py-2 text-sm"
          placeholder="Rechercher un fournisseur..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loadingSuppliers ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Chargement fournisseurs...</div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Aucun fournisseur.</div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nom</th>
                <th className="px-4 py-3 text-left font-medium">Specialite</th>
                <th className="px-4 py-3 text-left font-medium">Ville</th>
                <th className="px-4 py-3 text-left font-medium">Telephone</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSuppliers.map((row) => (
                <tr key={row.id} className="border-t">
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
                      {row.is_active ? "Actif" : "Inactif"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-lg border px-2 py-1 text-xs hover:bg-slate-50"
                        onClick={() => openEditSupplier(row)}
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                        onClick={() => void onDeleteSupplier(row.id)}
                      >
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
