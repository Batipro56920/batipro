const DEFAULT_ITEMS = [
  "Prendre photos",
  "Relever métrés",
  "Vérifier accès",
  "Vérifier support existant",
  "Vérifier contraintes techniques",
  "Demander plans",
  "Valider budget",
  "Identifier décisions client",
];

export function ProjectAppointmentChecklist({
  values,
  onChange,
}: {
  values: string[];
  onChange: (values: string[]) => void;
}) {
  function toggle(item: string) {
    onChange(values.includes(item) ? values.filter((value) => value !== item) : [...values, item]);
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {DEFAULT_ITEMS.map((item) => (
        <label key={item} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-medium text-slate-800 transition hover:bg-slate-50">
          <input
            type="checkbox"
            checked={values.includes(item)}
            onChange={() => toggle(item)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          {item}
        </label>
      ))}
    </div>
  );
}
