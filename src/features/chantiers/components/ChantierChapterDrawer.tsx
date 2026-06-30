import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type ChantierChapterDrawerProps = {
  title: string;
  subtitle: string;
  actionLabel: string;
  eyebrow?: string;
  previewClassName?: string;
  drawerMaxWidthClassName?: string;
  autoOpenKey?: string;
  children: ReactNode;
};

export default function ChantierChapterDrawer({
  title,
  subtitle,
  actionLabel,
  eyebrow = "Chantier",
  previewClassName = "",
  drawerMaxWidthClassName = "max-w-5xl",
  autoOpenKey = "",
  children,
}: ChantierChapterDrawerProps) {
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!autoOpenKey) return;
    setOpen(true);
  }, [autoOpenKey]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    window.requestAnimationFrame(() => {
      drawerRef.current?.focus();
      drawerRef.current?.scrollTo({ top: 0 });
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <style>{`
        .batipro-chapter-preview > div > div:first-child { display: none; }
        .batipro-chapter-preview--intervenants > div > :not(:last-child) { display: none; }
        .batipro-chapter-preview--time > div > :not(:last-child) { display: none; }
        .batipro-chapter-preview--reserves > div > :nth-child(1),
        .batipro-chapter-preview--reserves > div > :nth-child(2) { display: none; }
        .batipro-chapter-preview--documents table th:last-child,
        .batipro-chapter-preview--documents table td:last-child { display: none; }
        .batipro-chapter-preview--documents .overflow-hidden,
        .batipro-chapter-preview--documents .overflow-x-auto { max-height: 280px; overflow: hidden; }
        .batipro-chapter-preview--purchases > div > :not(:last-child) { display: none; }
        .batipro-chapter-preview--tasks-quotes > div > :first-child > :not(:last-child) { display: none; }
        .batipro-chapter-preview--tasks-quotes > div > :last-child > :not(:last-child) { display: none; }
        .batipro-chapter-preview--tasks-quotes > div { gap: 1rem; }
        .batipro-chapter-preview--financial > div > :not(:first-child),
        .batipro-chapter-preview--unforeseen > div > :not(:first-child),
        .batipro-chapter-preview--notes > div > :not(:last-child) { display: none; }
        .batipro-chapter-preview--financial,
        .batipro-chapter-preview--unforeseen,
        .batipro-chapter-preview--notes { max-height: 320px; overflow: hidden; }
        .batipro-chapter-preview:empty::before {
          content: "Aucun element a afficher.";
          display: block;
          border: 1px dashed #cbd5e1;
          border-radius: 0.75rem;
          padding: 1rem;
          color: #64748b;
          font-size: 0.875rem;
        }
      `}</style>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {eyebrow}
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-950">{title}</div>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {actionLabel}
          </button>
        </div>
        <div className={["batipro-chapter-preview mt-4", previewClassName].filter(Boolean).join(" ")}>
          {children}
        </div>
      </section>

      {open ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 p-4" onClick={() => setOpen(false)}>
          <aside
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            className={["ml-auto h-full w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl outline-none", drawerMaxWidthClassName].join(" ")}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-5 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {eyebrow}
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-950">{title}</div>
                <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
            {children}
          </aside>
        </div>
      ) : null}
    </>
  );
}
