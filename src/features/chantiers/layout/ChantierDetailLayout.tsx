import type { ReactNode } from "react";

export function ChantierDetailLayout({
  header,
  primaryNav,
  secondaryNav,
  children,
}: {
  header: ReactNode;
  primaryNav: ReactNode;
  secondaryNav?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6">
      <section className="sticky top-4 z-20 rounded-3xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm backdrop-blur">
        <div className="space-y-4">
          {header}
          {primaryNav}
          {secondaryNav}
        </div>
      </section>
      {children}
    </div>
  );
}

