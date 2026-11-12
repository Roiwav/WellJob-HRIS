export const TARGET_UNAVAILABLE = "This record is no longer available or you do not have access to it. Refresh notifications and try again.";
const WORKFORCE_ROLES = ["SUPER_ADMIN", "HR_MANAGER", "HR_STAFF", "HR_COORDINATOR"];
const positiveId = (value) => /^[1-9]\d*$/.test(String(value ?? "")) && Number.isSafeInteger(Number(value)) ? Number(value) : null;

// Both entry points use this same mapping. IDs locate records; the destination
// still fetches through its authenticated, company-scoped endpoint.
export function getNotificationDestination(alert, role) {
  const unavailable = { path: "/notifications", state: { targetError: TARGET_UNAVAILABLE } };
  if (!alert || !WORKFORCE_ROLES.includes(role)) return unavailable;
  const employeeId = positiveId(alert.employeeId ?? alert.employee_id ?? alert.employeeRecordId ?? alert.employee_record_id ?? alert.employee?.id);
  const incidentId = positiveId(alert.incidentId ?? alert.incident_id);
  const purpose = String(alert.notificationPurpose || "").toUpperCase();
  const source = String(alert.sourceType || "").toUpperCase();
  const alertKey = String(alert.alertKey || "");
  if (source === "COMPLIANCE" || purpose.startsWith("COMPLIANCE_")) {
    if (!employeeId || role === "HR_COORDINATOR") return unavailable;
    return { path: "/employees", state: { smartAlertEmployeeTarget: {
      employeeId, openCompliance: true, section: "compliance", alertKey,
      documentId: positiveId(alert.documentId ?? alert.document_id ?? alert.document?.id),
      documentName: String(alert.documentName ?? alert.document_name ?? alert.document?.name ?? ""),
    } } };
  }
  if (alert.route === "/incidents" || source === "INCIDENT" || source === "EMPLOYEE_PATTERN") {
    if (!incidentId || role === "HR_STAFF") return unavailable;
    return { path: "/incidents", state: { incidentId, action: alert.navigationAction || alert.action || "view", notificationFocus: true, alertKey } };
  }
  if (purpose === "DEPLOYMENT_SCHEDULED") {
    const attemptId = positiveId(alert.deploymentAttemptId ?? alert.attemptId);
    if (role !== "HR_COORDINATOR" || !employeeId || !attemptId) return unavailable;
    return { path: "/deployments", state: { notificationAttemptTarget: { employeeId, attemptId, alertKey } } };
  }
  if (["/kpi", "/kpi-reports"].includes(alert.route) || source === "KPI") {
    if (!employeeId || !["SUPER_ADMIN", "HR_MANAGER"].includes(role)) return unavailable;
    return { path: "/kpi", state: { notificationKpiTarget: { employeeId, alertKey } } };
  }
  if (employeeId) return { path: "/employees", state: { smartAlertEmployeeTarget: { employeeId, section: "workforce", openCompliance: false, alertKey } } };
  return unavailable;
}
