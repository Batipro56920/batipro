import React from "react";

import { useI18n } from "../../i18n";

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
      className={["tab-btn", active ? "tab-btn--active" : "tab-btn--inactive"].join(" ")}
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
  const { t } = useI18n();

  return (
    <div className="flex gap-2 flex-wrap">
      <TabButton active={tab === "devis-taches"} onClick={() => setTab("devis-taches")}>
        {t("chantierTabs.quotesTasks")}
      </TabButton>
      <TabButton active={tab === "intervenants"} onClick={() => setTab("intervenants")}>
        {t("chantierTabs.intervenants")}
      </TabButton>
      <TabButton active={tab === "temps"} onClick={() => setTab("temps")}>
        {t("chantierTabs.time")}
      </TabButton>
      <TabButton active={tab === "planning"} onClick={() => setTab("planning")}>
        {t("chantierTabs.planning")}
      </TabButton>
      <TabButton active={tab === "plans-reserves"} onClick={() => setTab("plans-reserves")}>
        {t("chantierTabs.plansReserves")}
      </TabButton>
      <TabButton active={tab === "materiel"} onClick={() => setTab("materiel")}>
        {t("chantierTabs.material")}
      </TabButton>
      <TabButton active={tab === "messagerie"} onClick={() => setTab("messagerie")}>
        {t("chantierTabs.messaging")}
      </TabButton>
      <TabButton active={tab === "rapports"} onClick={() => setTab("rapports")}>
        {t("chantierTabs.reports")}
      </TabButton>
    </div>
  );
}



