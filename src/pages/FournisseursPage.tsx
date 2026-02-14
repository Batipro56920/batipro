import { useMemo, useState } from "react";

type FournisseurRow = {
  id: string;
  nom: string;
  specialite: string;
  ville: string;
  contact: string;
  email: string;
  statut: "ACTIF" | "A_VALIDER";
};

const FOURNISSEURS_V1: FournisseurRow[] = [
  {
    id: "f1",
    nom: "Point P Lorient",
    specialite: "Gros oeuvre",
    ville: "Lorient",
    contact: "02 97 00 00 01",
    email: "lorient@pointp.fr",
    statut: "ACTIF",
  },
  {
    id: "f2",
    nom: "Rexel Vannes",
    specialite: "Electricite",
    ville: "Vannes",
    contact: "02 97 00 00 02",
    email: "vannes@rexel.fr",
    statut: "ACTIF",
  },
  {
    id: "f3",
    nom: "Cedeo Rennes",
    specialite: "Plomberie",
    ville: "Rennes",
    contact: "02 97 00 00 03",
    email: "rennes@cedeo.fr",
    statut: "ACTIF",
  },
  {
    id: "f4",
    nom: "Littoral Carrelage",
    specialite: "Carrelage",
    ville: "Auray",
    contact: "02 97 00 00 04",
    email: "contact@littoral-carrelage.fr",
    statut: "A_VALIDER",
  },
];

export default function FournisseursPage() {
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FOURNISSEURS_V1;
    return FOURNISSEURS_V1.filter((row) => {
      return (
        row.nom.toLowerCase().includes(q) ||
        row.specialite.toLowerCase().includes(q) ||
        row.ville.toLowerCase().includes(q)
      );
    });
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Fournisseurs</h1>
          <p className="text-slate-500">Liste V1 des fournisseurs referents.</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <input
          className="w-full rounded-xl border px-3 py-2 text-sm"
          placeholder="Rechercher un fournisseur..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">Aucun fournisseur.</div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Nom</th>
                <th className="px-4 py-3 text-left font-medium">Specialite</th>
                <th className="px-4 py-3 text-left font-medium">Ville</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{row.nom}</td>
                  <td className="px-4 py-3">{row.specialite}</td>
                  <td className="px-4 py-3">{row.ville}</td>
                  <td className="px-4 py-3">{row.contact}</td>
                  <td className="px-4 py-3">{row.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "text-xs px-2 py-1 rounded-full border",
                        row.statut === "ACTIF"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200",
                      ].join(" ")}
                    >
                      {row.statut}
                    </span>
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
