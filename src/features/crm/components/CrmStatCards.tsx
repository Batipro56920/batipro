import { StatCard } from "../../../components/ui/design-system";

export function CrmStatCards({ items }: { items: Array<[string, string | number]> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {items.map(([label, value]) => (
        <StatCard key={label} label={label} value={value} />
      ))}
    </div>
  );
}

