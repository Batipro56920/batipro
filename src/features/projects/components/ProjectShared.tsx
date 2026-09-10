import { useEffect, useState, type ReactNode } from "react";
import { listSalespeople } from "../../../services/salespeople.service";

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "Non renseigné";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function Panel({ title, description, children, actions }: { title: string; description?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function EmptyProjectBlock({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
      <div className="font-semibold text-slate-800">{title}</div>
      <p className="mt-1">{description}</p>
    </div>
  );
}

const SALESPERSON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Le projet ne porte que l'identifiant du commercial. Afficher un UUID de 36
 * caractères n'apprend rien : on va chercher le nom, et on s'abstient quand on
 * ne peut pas le résoudre.
 */
export function useSalespersonName(salespersonId: string | null | undefined): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const id = salespersonId?.trim();
    if (!id || !SALESPERSON_UUID.test(id)) {
      setName(id || null);
      return;
    }
    let alive = true;
    void listSalespeople()
      .then((people) => {
        if (!alive) return;
        setName(people.find((person) => person.id === id)?.name ?? null);
      })
      .catch(() => {
        if (alive) setName(null);
      });
    return () => {
      alive = false;
    };
  }, [salespersonId]);

  return name;
}

/**
 * Affiche le nom du commercial a partir de son identifiant. Le projet ne stocke
 * que l'identifiant, parce que le selecteur d'attribution en a besoin pour se
 * positionner : la traduction en nom se fait donc a l'affichage.
 */
export function SalespersonName({ id, fallback = "À assigner" }: { id: string | null | undefined; fallback?: string }) {
  const name = useSalespersonName(id);
  return <>{name ?? fallback}</>;
}
