import { PortalBadge } from "../../../components/intervenantPortal/PortalUi";

export default function IntervenantStatusBadge({
  tone,
  children,
}: {
  tone: "neutral" | "blue" | "amber" | "green" | "red";
  children: React.ReactNode;
}) {
  return <PortalBadge tone={tone}>{children}</PortalBadge>;
}

