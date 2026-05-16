import BudgetTab from "../../../components/chantiers/BudgetTab";

export default function ChantierFinancialSection({ chantierId }: { chantierId: string }) {
  return <BudgetTab chantierId={chantierId} />;
}

