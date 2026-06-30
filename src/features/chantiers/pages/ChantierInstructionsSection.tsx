import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export default function ChantierInstructionsSection({ children }: { children: React.ReactNode }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const targetedConsigneId = searchParams.get("consigneId") ?? "";
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!targetedConsigneId) return;
    const frame = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      sectionRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [targetedConsigneId]);

  function clearConsigneTarget() {
    if (!targetedConsigneId) return;
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("consigneId");
    setSearchParams(nextParams, { replace: true });
  }

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className="scroll-mt-28 space-y-4 outline-none"
      data-consigne-target={targetedConsigneId || undefined}
    >
      {targetedConsigneId ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="font-semibold">Consigne ciblée depuis un lien Batipro</div>
              <p className="mt-1 text-blue-800">
                La liste des consignes est amenée à l'écran. Vérifiez la consigne concernée avant action terrain ou mise à jour.
              </p>
            </div>
            <button
              type="button"
              onClick={clearConsigneTarget}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-100 hover:text-blue-700"
            >
              Retirer le ciblage
            </button>
          </div>
        </div>
      ) : null}
      {children}
    </section>
  );
}
