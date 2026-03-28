import { Navigate } from "react-router-dom";
import { readStoredIntervenantToken } from "../utils/intervenantSession";

export default function AppEntryPage() {
  const intervenantToken = readStoredIntervenantToken();
  if (intervenantToken) {
    return <Navigate to="/intervenant" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}
