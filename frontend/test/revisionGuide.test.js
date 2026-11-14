import test from "node:test";
import assert from "node:assert/strict";
import { getNotificationDestination, TARGET_UNAVAILABLE } from "../src/utils/notifications/notificationTarget.js";
import { hrErrorMessage } from "../src/utils/hrErrors.js";
import { getIncidentDaysOpen, getIncidentDaysOpenLabel } from "../src/utils/incidents/incidentDuration.js";
import { getUserFullName, getConfigurationActorDisplay, formatRoleLabel } from "../src/utils/userDisplay.js";
import { getSmartAlerts } from "../src/utils/incidentIntelligence.js";
import { requestKPIDecisionJson } from "../src/hooks/useKPIDecisionQueries.js";
import { saveAttendanceRecord } from "../src/utils/attendance/attendanceApi.js";

test("No Show opens the current employee workforce status independently of list position", () => {
  const target = getNotificationDestination({ route: "/deployments", employeeId: 1665, deploymentAttemptId: 99, notificationPurpose: "DEPLOYMENT_NO_SHOW" }, "HR_STAFF");
  assert.equal(target.path, "/employees");
  assert.deepEqual(target.state.smartAlertEmployeeTarget, { employeeId: 1665, section: "workforce", openCompliance: false, alertKey: "" });
});
test("pending arrival retains the exact attempt and employee while requiring coordinator role", () => {
  const alert = { route: "/deployments", employeeId: 77, deploymentAttemptId: 999, notificationPurpose: "DEPLOYMENT_SCHEDULED" };
  const target = getNotificationDestination(alert, "HR_COORDINATOR");
  assert.equal(target.path, "/deployments");
  assert.equal(target.state.notificationAttemptTarget.attemptId, 999);
  assert.equal(getNotificationDestination(alert, "HR_STAFF").state.targetError, TARGET_UNAVAILABLE);
});
test("compliance, incident and KPI alerts preserve exact IDs and intended section", () => {
  const compliance = getNotificationDestination({ sourceType: "COMPLIANCE", employee_id: "42", document_id: "702", document_name: "NBI Clearance" }, "HR_MANAGER");
  assert.equal(compliance.state.smartAlertEmployeeTarget.documentId, 702);
  assert.equal(compliance.state.smartAlertEmployeeTarget.openCompliance, true);
  const incident = getNotificationDestination({ route: "/incidents", incidentId: 812, navigationAction: "start-investigation" }, "HR_COORDINATOR");
  assert.equal(incident.state.incidentId, 812);
  assert.equal(incident.state.action, "start-investigation");
  assert.equal(incident.state.notificationFocus, true);
  const kpi = getNotificationDestination({ route: "/kpi", employeeId: 421 }, "HR_MANAGER");
  assert.equal(kpi.path, "/kpi");
  assert.equal(kpi.state.notificationKpiTarget.employeeId, 421);
});
test("missing, malformed and unauthorized targets fail with a friendly message", () => {
  for (const alert of [null, { route: "/incidents" }, { employeeId: "1 OR 1=1" }, { employeeId: -1 }]) {
    assert.equal(getNotificationDestination(alert, "HR_MANAGER").state.targetError, TARGET_UNAVAILABLE);
  }
  assert.equal(getNotificationDestination({ employeeId: 1 }, "IT_SUPPORT").state.targetError, TARGET_UNAVAILABLE);
  assert.equal(getNotificationDestination({ incidentId: 1, route: "/incidents" }, "HR_STAFF").state.targetError, TARGET_UNAVAILABLE);
  assert.equal(getNotificationDestination({ employeeId: 1, sourceType: "COMPLIANCE" }, "HR_COORDINATOR").state.targetError, TARGET_UNAVAILABLE);
});
test("HR errors hide transport/provider/database details and retain field validation", () => {
  for (const message of ["Request failed with status 500", "ER_BAD_FIELD_ERROR: database detail", '<html>Bad gateway</html>', 'Protected file upload failed: Supabase bucket missing', 'Failed to fetch']) {
    assert.equal(hrErrorMessage(new Error(message)), "The information could not be loaded. Please try again.");
  }
  assert.match(hrErrorMessage({ name: "AbortError" }), /taking longer than expected/);
  assert.match(hrErrorMessage({}, undefined, 401), /Sign in again/);
  assert.match(hrErrorMessage({}, undefined, 403), /do not have access/);
  assert.match(hrErrorMessage("Suggestion key is invalid"), /no longer available/);
  assert.equal(hrErrorMessage("Invalid decision type"), "Select a valid review decision.");
  assert.equal(hrErrorMessage("Company name is required.", undefined, 400), "Company name is required.");
  assert.equal(hrErrorMessage("Refresh and review the latest assessment.", undefined, 409), "Refresh and review the latest assessment.");
});
test("empty 500 and invalid decision responses map at the KPI UI boundary while retaining status", async () => {
  const original = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => "fixture-token" };
  try {
    for (const [status, data, expected] of [[500, {}, /could not be loaded/], [400, { error: "Invalid decision type" }, /Select a valid review decision/]]) {
      globalThis.fetch = async () => ({ ok: false, status, json: async () => data });
      await assert.rejects(requestKPIDecisionJson("http://test.invalid/api"), (error) => error.status === status && expected.test(error.message));
    }
  } finally {
    globalThis.fetch = original;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
test("closed incident duration stops at approval, including old and same-day closures", () => {
  const incident = { reportedAt: "2025-02-01T00:00:00Z", reviewedAt: "2025-02-04T00:00:00Z", status: "Closed" };
  assert.equal(getIncidentDaysOpen(incident, Date.parse("2026-11-12T00:00:00Z")), 3);
  assert.equal(getIncidentDaysOpen({ ...incident, reviewedAt: "2025-02-01T01:00:00Z" }), 0);
  assert.equal(getIncidentDaysOpen({ ...incident, reviewedAt: null }), null);
  assert.equal(getIncidentDaysOpen({ ...incident, reviewedAt: "invalid" }), null);
  assert.equal(getIncidentDaysOpen({ ...incident, reviewedAt: "2024-01-01" }), null);
  assert.equal(getIncidentDaysOpenLabel(incident), "3 days");
  assert.equal(getIncidentDaysOpenLabel({ ...incident, reviewedAt: "2025-02-02T00:00:00Z" }), "1 day");
  assert.equal(getIncidentDaysOpenLabel({ ...incident, reviewedAt: "invalid" }), "Duration unavailable");
});
test("active or reopened incident elapsed duration uses now and respects timezone offsets", () => {
  const incident = { reportedAt: "2026-11-10T23:30:00+08:00", reviewedAt: "2025-01-01", status: "Investigating" };
  assert.equal(getIncidentDaysOpen(incident, Date.parse("2026-11-11T15:30:00Z")), 1);
  assert.equal(getIncidentDaysOpen({ ...incident, status: "Open" }, Date.parse("2026-11-12T15:30:00Z")), 2);
});
test("actor presentation resolves actual full/partial names and readable roles without username fallback", () => {
  assert.equal(getUserFullName({ full_name: "Maria Santos", username: "hm01" }), "Maria Santos");
  assert.equal(getUserFullName({ firstName: "Maria", lastName: "Santos" }), "Maria Santos");
  assert.equal(getUserFullName({ first_name: "Maria" }), "Maria");
  assert.equal(getUserFullName({ username: "hm01" }), "Reviewer name unavailable");
  assert.equal(getUserFullName({ name: "hm01", username: "hm01" }), "Reviewer name unavailable");
  assert.equal(formatRoleLabel("HR_MANAGER"), "HR Manager");
  assert.equal(formatRoleLabel("unrecognized_role"), "Role unavailable");
  assert.equal(getConfigurationActorDisplay({ updatedByDisplayName: "Maria Santos", updatedBy: "hm02" }), "Maria Santos");
  assert.equal(getConfigurationActorDisplay({ updatedBy: "hm02" }), "Account name unavailable (username: hm02)");
  assert.equal(getConfigurationActorDisplay({}), "Account name unavailable");
});

test("incident duration presentation stays consistent across table and modal source paths", async () => {
  const incident = {
    reportedAt: "2026-04-07T01:00:00+08:00",
    reviewedAt: "2026-04-10T00:59:59+08:00",
    status: "Closed",
  };
  assert.equal(getIncidentDaysOpenLabel(incident), "2 days");

  const [{ readFile }, { fileURLToPath }, { dirname, resolve }] = await Promise.all([
    import("node:fs/promises"),
    import("node:url"),
    import("node:path"),
  ]);
  const testDirectory = dirname(fileURLToPath(import.meta.url));
  const [badgeSource, modalSource] = await Promise.all([
    readFile(resolve(testDirectory, "../src/components/incidents/badges/IncidentBadges.jsx"), "utf8"),
    readFile(resolve(testDirectory, "../src/components/incidents/modals/ViewIncidentModal.jsx"), "utf8"),
  ]);
  assert.match(badgeSource, /getIncidentDaysOpenLabel/);
  assert.match(modalSource, /getIncidentDaysOpenLabel/);
});

test("incident smart alerts use count-aware day wording without changing SLA calculations", () => {
  const now = Date.now();
  const threeDays = getSmartAlerts({
    status: "Open",
    severity: "Critical",
    reportedAt: new Date(now - (3 * 86400000)).toISOString(),
  });
  const manyDays = getSmartAlerts({
    status: "Open",
    severity: "Critical",
    reportedAt: new Date(now - (30 * 86400000)).toISOString(),
  });
  assert.match(threeDays.map((alert) => alert.message).join(" "), /3 days old/);
  assert.match(manyDays.map((alert) => alert.message).join(" "), /30 days old/);
  assert.equal(manyDays.some((alert) => /30 day\(s\)/.test(alert.message)), false);
});

test("attendance provider error stays in diagnostics and the UI receives a retry message; JWT is never forwarded", async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  const originalConsoleError = console.error;
  const diagnostics = [];
  globalThis.localStorage = { getItem: () => "fictional-welljob-jwt" };
  console.error = (...values) => diagnostics.push(values);
  globalThis.fetch = async (url, options) => {
    if (url.includes("upload-authorizations")) {
      assert.equal(options.headers.get("Authorization"), "Bearer fictional-welljob-jwt");
      return new Response(JSON.stringify({ uploads: [{ signedUrl: "https://storage.test.invalid/temporary-upload", descriptor: "fictional-descriptor" }] }), { status: 200 });
    }
    assert.equal(url, "https://storage.test.invalid/temporary-upload");
    assert.equal(new Headers(options.headers).has("Authorization"), false);
    return new Response("Provider HTTP 500: private bucket detail", { status: 500 });
  };
  try {
    await assert.rejects(saveAttendanceRecord({ attendanceDate: "2026-11-12", source: "client", entries: [], evidenceFile: new File(["fictional-image"], "attendance.png", { type: "image/png" }) }), {
      message: "The attendance image could not be uploaded. Check your connection and try again.",
    });
    assert.match(String(diagnostics), /private bucket detail/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    if (originalStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = originalStorage;
  }
});
