import { NavLink } from "react-router-dom";
import type { FinancialPeriod } from "../application/financialPeriod";
import { FINANCIAL_PERIOD_OPTIONS } from "../application/financialPeriod";

const FINANCIAL_NAV_ITEMS = [
  { to: "/rentabilite", label: "Rentabilité" },
  { to: "/financier/encaissements", label: "Encaissements" },
  { to: "/financier/decaissements", label: "Engagements fournisseurs" },
  { to: "/financier/tva", label: "TVA" },
  { to: "/financier/tresorerie", label: "Position simplifiée" },
  { to: "/financier/charges-fixes", label: "Charges fixes" },
] as const;

export function FinancialNavigation() {
  return (
    <nav
      className="flex w-full gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-sm"
      aria-label="Navigation financière"
    >
      {FINANCIAL_NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end
          className={({ isActive }) => [
            "whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition",
            isActive
              ? "bg-slate-950 text-white"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
          ].join(" ")}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function FinancialPeriodSelector({
  value,
  onChange,
}: {
  value: FinancialPeriod;
  onChange: (value: FinancialPeriod) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-semibold text-slate-950">Période documentaire</div>
        <div className="text-xs text-slate-500">
          Basée sur la date d'émission des factures et commandes.
        </div>
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as FinancialPeriod)}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"
        aria-label="Période documentaire"
      >
        {FINANCIAL_PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
