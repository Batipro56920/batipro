import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: ReactNode;
};

export default function ComingSoonPage({ title, description }: Props) {
  return (
    <section className="rounded-2xl border bg-white p-8">
      <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
      <p className="mt-3 text-sm text-slate-600">
        {description ?? "Cette page sera disponible prochainement."}
      </p>
    </section>
  );
}

