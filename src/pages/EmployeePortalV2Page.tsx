import EmployeeDailyChecklistWidget from "./EmployeeDailyChecklistWidget";
import EmployeeFieldDataWidget from "./EmployeeFieldDataWidget";
import EmployeePortalTerrainV2Page from "./EmployeePortalTerrainV2Page";

export default function EmployeePortalV2Page() {
  return (
    <>
      <EmployeePortalTerrainV2Page />
      <EmployeeFieldDataWidget />
      <EmployeeDailyChecklistWidget />
    </>
  );
}
