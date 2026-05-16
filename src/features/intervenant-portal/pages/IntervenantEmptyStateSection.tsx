export default function IntervenantEmptyStateSection({
  title,
  message,
  className = "",
}: {
  title: string;
  message: string;
  className?: string;
}) {
  return (
    <section className={["rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm", className].join(" ")}>
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <div className="mt-2 text-sm text-slate-500">{message}</div>
    </section>
  );
}

