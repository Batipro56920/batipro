import { useState } from "react";
import type { ComponentProps } from "react";

import PreparationTreeTab from "../../../components/chantiers/PreparationTreeTab";

type ChantierLocationSectionProps = ComponentProps<typeof PreparationTreeTab>;

export default function ChantierLocationSection(props: ChantierLocationSectionProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Localisation
            </div>
            <div className="mt-1 text-lg font-semibold text-slate-950">Arborescence chantier</div>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Batiments, niveaux et pieces servent a rattacher les taches, documents, photos, reserves et consignes.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Ouvrir l'arborescence
          </button>
        </div>
      </section>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 p-4" onClick={() => setDrawerOpen(false)}>
          <aside
            className="ml-auto h-full w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 z-10 -mx-5 -mt-5 mb-5 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Preparation chantier
                </div>
                <div className="mt-1 text-xl font-semibold text-slate-950">Arborescence chantier</div>
                <div className="mt-1 text-sm text-slate-500">Structure du chantier et rattachements operationnels.</div>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
            <PreparationTreeTab {...props} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
