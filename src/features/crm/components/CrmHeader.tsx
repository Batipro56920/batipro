import type { CrmSection } from "../types";
import { CrmNavigationTabs } from "./CrmNavigation";

export function CrmDashboardHeader({
  section,
}: {
  section: CrmSection;
  onRefresh: () => void;
  onCreateProspect: () => void;
  onCreateOpportunity: () => void;
  onCreateQuote: () => void;
}) {
  return <CrmNavigationTabs section={section} />;
}

export const CrmHeader = CrmDashboardHeader;
