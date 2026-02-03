import React from "react";

export type TabKey =
  | "devis-taches"
  | "intervenants"
  | "planning"
  | "temps"
  | "plans-reserves"
  | "materiel"
  | "messagerie"
  | "rapports";

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-2 rounded-xl text-sm border transition whitespace-nowrap",
        active
          ? "bg-slate-900 text-white border-slate-900"
          : "bg-white hover:bg-slate-50 text-slate-700 border-slate-200",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export default function ChantierTabs({
  tab,
  setTab,
}: {
  tab: TabKey;
  setTab: (t: TabKey) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      <TabButton active={tab === "devis-taches"} onClick={() => setTab("devis-taches")}>
        Devis & tâches
      </TabButton>
      <TabButton active={tab === "intervenants"} onClick={() => setTab("intervenants")}>
        Intervenants
      </TabButton>
      <TabButton active={tab === "temps"} onClick={() => setTab("temps")}>
        Temps
      </TabButton>
      <TabButton active={tab === "planning"} onClick={() => setTab("planning")}>
        Planning
      </TabButton>
      <TabButton active={tab === "plans-reserves"} onClick={() => setTab("plans-reserves")}>
        Plans & réserves
      </TabButton>
      <TabButton active={tab === "materiel"} onClick={() => setTab("materiel")}>
        Matériel
      </TabButton>
      <TabButton active={tab === "messagerie"} onClick={() => setTab("messagerie")}>
        Messagerie
      </TabButton>
      <TabButton active={tab === "rapports"} onClick={() => setTab("rapports")}>
        Rapports
      </TabButton>
    </div>
  );
}
