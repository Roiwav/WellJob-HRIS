# WELLJOB HRIS revision guide implementation

Date: November 12, 2026 (Asia/Manila)

Source: `Welljob_HRIS_Developer_Revision_Guide_2026-11-10.pdf`, all eight pages.

Starting branch/HEAD: `VercelBackendMigration` / `45a889c`. The working tree was clean before this work. Source changes and verification evidence are included in the revision-guide implementation commit on this branch, as requested by the user after production verification.

## Result

All six implementation groups in the guide are implemented and deployed to the existing production projects. The approved correction of live employee **#1665 / assignment #1865** was committed and independently verified.

Verification passed: **160 backend tests, 57 frontend tests, 23 fixture-based browser checks, 16 real-service integration checks, 11 real-service browser checks, 8 role/SMTP readiness checks, 11 live production checks, frontend lint, production build, and Git whitespace checks**.

The integration and CRUD browser checks use the real Express API, TLS-verified MySQL 8.4.8 database `welljob_phase3_test`, and private Supabase bucket `welljob-phase3-test`, with fictional users and documents. Production verification uses read-only probes; the separately approved #1665 correction is the only production HR-data mutation in this work.

## Revisions and actual source locations

Line numbers below refer to the final working tree, not the PDF's original audit references.

| Revision | Before → after | Actual files and lines |
| --- | --- | --- |
| REV-007 | Ending an assignment changed only legacy employee status → the same locked transaction now updates legacy status, employment status and workforce status, and records an employment transition when the value changes. | [deploymentController.js:2807](../backend/controllers/deploymentController.js#L2807), [employee lock:2895](../backend/controllers/deploymentController.js#L2895), [employee update:3165](../backend/controllers/deploymentController.js#L3165), [employment history:3247](../backend/controllers/deploymentController.js#L3247) |
| REV-008 / TERM-008–010 | Different notification handlers fell back to general pages → both use one exact-record destination resolver, authenticated detail requests, and temporary visual emphasis with a dot. | [notificationTarget.js:1](../frontend/src/utils/notifications/notificationTarget.js#L1), [notificationFocus.js:1](../frontend/src/utils/notifications/notificationFocus.js#L1), [Navbar.jsx:555](../frontend/src/components/Navbar.jsx#L555), [Notifications.jsx:791](../frontend/src/pages/Notifications.jsx#L791), [Employees.jsx:3014](../frontend/src/pages/Employees.jsx#L3014), [Deployments.jsx:2980](../frontend/src/pages/Deployments.jsx#L2980), [Incidents.jsx:2047](../frontend/src/pages/Incidents.jsx#L2047), [KPIReports.jsx:519](../frontend/src/pages/KPIReports.jsx#L519) |
| REV-001 / TERM-003–005 | History could expose a username and raw role code → the API supplies an additional resolved display name; the UI shows a real profile name or an explicit unavailable fallback, plus a readable role. | [decisionReviewerDisplay.js:1](../backend/utils/decisionReviewerDisplay.js#L1), [kpiDecisionController.js:179](../backend/controllers/kpiDecisionController.js#L179), [authMiddleware.js:420](../backend/middleware/authMiddleware.js#L420), [userDisplay.js:1](../frontend/src/utils/userDisplay.js#L1), [DecisionHistorySection.jsx:333](../frontend/src/components/kpi/sections/DecisionHistorySection.jsx#L333), [KPIThresholdsTab.jsx:2136](../frontend/src/components/config/KPIThresholdsTab.jsx#L2136), [RecommendationReviewSection.jsx:86](../frontend/src/components/kpi/sections/RecommendationReviewSection.jsx#L86) |
| TERM-001 / 002 / 006 | Raw HTTP/database/provider details could reach HR screens → a shared UI error mapper handles technical errors, timeout, session/access, invalid suggestions and invalid decisions while preserving business validation and stale-review status/data. | [hrErrors.js:1](../frontend/src/utils/hrErrors.js#L1); full boundary list below |
| TERM-007 / 014 | Technical handoff wording → “Secure phone document session”, “Continue on this phone”, friendly invalid-link/session messages and a plain protected-document explanation. | [EmployeeMobileHandoff.jsx:74](../frontend/src/pages/EmployeeMobileHandoff.jsx#L74), [session heading:330](../frontend/src/pages/EmployeeMobileHandoff.jsx#L330), [continue button:465](../frontend/src/pages/EmployeeMobileHandoff.jsx#L465), [storage explanation:489](../frontend/src/pages/EmployeeMobileHandoff.jsx#L489), [EmployeeMobileHandoffPanel.jsx:256](../frontend/src/components/employees/EmployeeMobileHandoffPanel.jsx#L256) |
| TERM-011–013 | Ambiguous recommendation/action labels, raw actor fallbacks and `record(s)` → distinct workflow, intervention, decision and basis labels; explicit name/role fallbacks; singular/plural record wording. | [DecisionHistorySection.jsx:309](../frontend/src/components/kpi/sections/DecisionHistorySection.jsx#L309), [RecommendationReviewSection.jsx](../frontend/src/components/kpi/sections/RecommendationReviewSection.jsx), [ExecutiveActionItems.jsx](../frontend/src/components/dashboard/insights/ExecutiveActionItems.jsx), [EmployeeKpiDetailsModal.jsx:626](../frontend/src/components/kpi/modals/EmployeeKpiDetailsModal.jsx#L626), [useKPIQueries.js](../frontend/src/hooks/useKPIQueries.js), [SystemConfiguration.jsx:64](../frontend/src/pages/SystemConfiguration.jsx#L64) |
| REV-004 | A closed case continued aging through today → the displayed Days Open stops at its closure/approval time. Active/reopened cases use now. Missing, invalid or chronologically inconsistent closure dates display “Duration unavailable”. | Actual original renderer located at `ViewIncidentModal.jsx:605` before editing; final [renderer:606](../frontend/src/components/incidents/modals/ViewIncidentModal.jsx#L606) and [incidentDuration.js:1](../frontend/src/utils/incidents/incidentDuration.js#L1) |
| REV-005 | Add Employee could show “Update Completed” → Add shows “Employee Added Successfully”; Edit shows “Employee Information Updated Successfully”. Existing callbacks still run after successful server saves. | Actual original toast located at `Employees.jsx:4385` before editing; final [save callback:3758](../frontend/src/pages/Employees.jsx#L3758) and [toast:4396](../frontend/src/pages/Employees.jsx#L4396) |

### Separation outcomes

| Action | Assignment internal status | Legacy employee status | Employment status | Workforce status |
| --- | --- | --- | --- | --- |
| Resigned | Cancelled (existing compatibility value) | Inactive | Resigned | NULL |
| AWOL | Cancelled | Inactive | Terminated | NULL |
| Terminated | Cancelled | Inactive | Terminated | NULL |
| Completed assignment | Completed | Floating / Standby | Active | Floating / Standby |

Other Separation continues using the existing Terminated reason plus encoded remarks. The endpoint, role gates, exact assignment selection, one-active-assignment invariant, end reasons, remarks and transactional audit remain in place. The closed assignment is no longer current. Employment history is added only for a real transition; a repeated request conflicts instead of adding duplicate history. Completion does not fabricate an Active → Active employment transition.

### Notification behavior

- No Show and confirmed deployment alerts open the exact employee's current workforce status, even when the employee is absent from the current list page.
- Scheduled-arrival alerts open the coordinator's exact pending attempt. A separate existing employee-filtered request finds a target beyond the default first 100 attempts; it still uses the backend's company scope.
- Incident alerts retain the existing authorized action/detail flow and add temporary modal emphasis.
- Compliance retains the existing edit/view document targeting and scrolling; both presentations now include a temporary dot.
- KPI alerts open the authorized employee assessment in the existing details modal under Employee Intelligence.
- Missing IDs, unavailable records, removed compliance documents, completed incident workflow actions and unsupported role destinations receive a friendly message. Route state grants no API authority.
- The employee notification effect also handles React Strict Mode cleanup, avoiding a lost initial detail-opening request.
- Emphasis expires after five seconds and adds no record labels or timestamps.

### Error boundary coverage

The shared mapper is used in:

| Boundary | Final line |
| --- | --- |
| KPI data / decision requests | `frontend/src/hooks/useKPIQueries.js:58`, `useKPIDecisionQueries.js:104` |
| Client-company configuration | `frontend/src/components/config/ClientCompaniesTab.jsx:213` |
| Company-position configuration | `frontend/src/components/config/CompanyPositionsTab.jsx:188` |
| Performance evaluation | `frontend/src/components/config/KPIThresholdsTab.jsx:402` |
| Violation configuration | `frontend/src/components/config/ViolationRulesTab.jsx:210` |
| Account administration | `frontend/src/pages/SuperAdminPortal.jsx:155` |
| Attendance API and protected image upload | `frontend/src/utils/attendance/attendanceApi.js:114`, provider failure branch in the same file |
| Employee API and protected document upload | `frontend/src/utils/employees/employeeDirectUpload.js:66`, `employeeFormHelpers.js:469` |
| Suggestion actions | `frontend/src/utils/suggestions/smartSuggestions.js:58` |
| Phone session resolution and QR generation | `frontend/src/pages/EmployeeMobileHandoff.jsx:74`, `EmployeeMobileHandoffPanel.jsx:256` |

The KPI request error retains its HTTP status and response data, including `STALE_KPI_SNAPSHOT`, so the existing 409 refresh-and-review recovery still works. Provider requests still receive only their temporary signed authorization; the Welljob JWT is not forwarded. Backend response fields, stored role codes and audit identities remain available internally. Technical audit permissions were not changed.

## Verification

| Check | Result | Evidence / scope |
| --- | --- | --- |
| Backend full suite | Passed: 160/160 | [backend-tests.log](../artifacts/revision-guide/backend-tests.log) |
| Frontend full suite | Passed: 57/57 | [frontend-tests.log](../artifacts/revision-guide/frontend-tests.log) |
| Browser acceptance | Passed: 23/23 | [browser-results.json](../artifacts/revision-guide/browser-results.json); real React pages with fictional localhost APIs |
| Real-service integration | Passed: 16/16 | [runtime-results.json](../artifacts/revision-guide/runtime-results.json); actual MySQL transactions, concurrency, rollback, scopes, arrival, sessions, date serialization and private Supabase upload/download |
| Real-service browser | Passed: 11/11 | [real-browser-results.json](../artifacts/revision-guide/real-browser-results.json); actual Add/Edit saves/rejections, date preservation, protected proof files and 390px phone-link flow |
| Roles and SMTP | Passed: 8/8 | [service-readiness-results.json](../artifacts/revision-guide/service-readiness-results.json); seven real isolated role requests and configured SMTP authentication; no message sent |
| Production release | Passed: 11/11 | [production-deployment-results.json](../artifacts/revision-guide/production-deployment-results.json); both READY releases, source fingerprint, public routes, current function identity, CORS and unauthorized-session rejection |
| Approved live correction | Committed and verified | [employee-1665-correction-result.json](../artifacts/revision-guide/employee-1665-correction-result.json), [release-inspection.json](../artifacts/revision-guide/release-inspection.json) |
| Frontend lint | Passed, no errors or warnings | `npm.cmd run lint` |
| Production build | Passed | [frontend-build.log](../artifacts/revision-guide/frontend-build.log); Vite's existing large-chunk advisory remains |
| Git whitespace | Passed | `git diff --check` |

New focused coverage:

- [deploymentSeparation.test.js](../backend/test/deploymentSeparation.test.js): actual controller execution for resignation/AWOL/termination/completion, employee current-workforce exclusion, response fields, histories, retries, role denial, and rollback on employee/history/audit failure.
- [decisionReviewerDisplay.test.js](../backend/test/decisionReviewerDisplay.test.js): legacy username and full-name lookup, inactive reviewers, partial names, missing profiles, preserved stored identity/role/notes, and a single parameterized lookup.
- [revisionGuide.test.js](../frontend/test/revisionGuide.test.js): exact navigation IDs, denied/malformed targets, friendly errors, request status retention, old closed cases, same-day closure, missing/invalid closure, reopened cases, timezone offsets, real/partial names, unknown roles, and a simulated provider failure proving safe UI text plus no JWT forwarding.
- Existing suites retain Confirm Arrival, No Show, incident authorization/review/evidence rules, reporting helpers, current/history KPI parity and decay, maintenance audit authorization, and stale-snapshot recovery coverage.

The browser harness is [verifyRevisionGuide.cjs](../frontend/scripts/verifyRevisionGuide.cjs). Run from `frontend` with `node scripts/verifyRevisionGuide.cjs`. It starts only local fixtures/Vite and a headless Edge profile, blocks remote HTTPS page requests, captures evidence and stops its child processes. It does not load application database credentials.

### Real-service verification and additional fixes

The new [verifyRevisionRuntime.cjs](../backend/scripts/verifyRevisionRuntime.cjs) defaults to read-only preflight. Its explicit `--confirm-test-writes --serve` mode guards the isolated database and test bucket, creates fictional fixtures, and serves a local test API for [verifyRevisionBrowser.cjs](../backend/scripts/verifyRevisionBrowser.cjs). The temporary JWT secret is random and SMTP delivery is disabled in that runtime. Session material is stored only in an ignored local file; credentials and tokens are absent from evidence JSON.

Real MySQL checks cover resignation, AWOL, termination, completion, duplicate retries, one winner in simultaneous separation, and rollback after actual SQL failures at employee update, workforce history, employment history and audit stages. Injected SQL-error logs are expected test behavior. Confirm Arrival, No Show, cross-company denial, expired sessions, one-time phone-link ownership/expiry, and signed private storage upload/finalization/download also passed.

Two additional bugs were found and fixed during real browser testing:

- **Employee calendar dates shifted backward on editing.** MySQL DATE values were serialized as midnight timestamps; Manila midnight became the previous UTC day. [db.js](../backend/config/db.js) now uses `dateStrings: ["DATE"]`. Add/Edit browser checks confirm birthday `2000-01-01` and hire date `2025-01-01` remain unchanged through saving and editing. DATETIME/TIMESTAMP parsing retains its existing behavior; real MySQL confirms DATETIME remains a Date object. Existing stored dates were not rewritten.
- **A resolved phone link could land on the employee list without opening its form.** React Strict Mode canceled the initial detail effect while leaving its handled flag set. [Employees.jsx](../frontend/src/pages/Employees.jsx) now resets that flag on effect cleanup, allowing the resolved target to retry. The 390px browser test confirms the exact employee opens with Compliance Documents expanded, and a reused link shows the friendly unavailable message.

Browser saves were paused before reaching the real API to verify no premature success toast or persistence. After release, successful Add/Edit produced the correct title and persisted data; actual server rejection left no added employee or changed record and showed no success toast. Add also saved three proof documents to the private test bucket. The role-readiness verifier checked both staff accounts, manager, admin, both coordinators, and IT Support against the actual local API with real test-DB authorization; IT Support remained denied.

The SMTP verifier connected and authenticated against the configured provider using the same host/port/security mapping as the mailers. It sent no message and makes no claim about recipient inbox delivery.

### Screenshots

All screenshots show fictional test data. Screenshots 01-06 include fictional fixture ID 1665; screenshots 07-11 use generated records in the isolated test database. None is a capture of the live employee #1665.

- [No Show → current employee workforce](../artifacts/revision-guide/01-no-show-workforce.png)
- [Coordinator exact pending arrival](../artifacts/revision-guide/02-pending-arrival.png)
- [Closed incident duration](../artifacts/revision-guide/03-closed-incident.png)
- [Manager compliance document](../artifacts/revision-guide/04-compliance-hr_manager.png)
- [Staff compliance document](../artifacts/revision-guide/04-compliance-hr_staff.png)
- [Mobile employee target](../artifacts/revision-guide/05-mobile-workforce.png)
- [Named reviewer and singular count](../artifacts/revision-guide/06-history.png)
- [Legacy reviewer fallbacks and plural count](../artifacts/revision-guide/06-legacy-history.png)
- [Real Add success](../artifacts/revision-guide/07-real-add-success.png)
- [Real Add server rejection](../artifacts/revision-guide/08-real-add-rejected.png)
- [Real Edit success](../artifacts/revision-guide/09-real-edit-success.png)
- [Real Edit server rejection](../artifacts/revision-guide/10-real-edit-rejected.png)
- [Real 390px phone session](../artifacts/revision-guide/11-real-phone-session.png)

## Diff and preservation

Most source deletions remove duplicated notification routing, error-message handling and username fallback code. New focused helpers, tests, guarded verification/repair scripts, and evidence accompany the source changes. No dependency versions or lockfiles changed. The initial production release used the exact working-tree inputs directly through Vercel CLI; those source changes and this evidence are now included together in version control.

Scoring weights, thresholds, decay, risk/trend calculations, recommendation rules and existing document-storage security were not changed. The Days Open correction is display-only. No new notes requirement was added; Accept notes remain optional and saved automatic notes were not rewritten. The withdrawn compliance-mismatch work was not implemented.

No schema migration, blanket data backfill or merge was performed. The approved one-record repair and the two production deployments are detailed below. The user subsequently requested committing and pushing the completed changes to the existing branch.

## Approved live employee correction

The user explicitly approved the reviewed correction of employee #1665 and assignment #1865. [correctRevisionEmployee1665.cjs](../backend/scripts/correctRevisionEmployee1665.cjs) required those exact approved IDs and checked the existing Cancelled/Resigned assignment, no active assignment, original resignation event, matching contract end date and expected old state before changing anything.

One transaction changed `employment_status` from Active to Resigned and `workforce_status` from Deployed to NULL. Legacy status stayed Inactive. It added exactly one missing Active-to-Resigned employment-history row using original workforce event #2225, its stored effective time **2026-11-10 07:57:14**, actor #22, reason and remarks. A separate operational repair audit records the correction without impersonating a current user. A local backup was saved outside versioned/deployed files.

Independent read-only verification confirms active scope membership **0**, separated scope membership **1**, no active assignment, exactly one resignation transition, and byte-for-value equality of the original assignment fields and workforce event against the pre-change backup. A repeated dry run reports `alreadyCorrect: true` and `addMissingEmploymentHistory: false`.

## Production release and rollback references

Both existing projects retain their original project IDs, owner and backend/frontend root directories. The root [.vercelignore](../.vercelignore) now excludes environment files, private uploads, local dependencies, build output, evidence and developer-only scripts/tests when deploying the monorepo. A CLI dry run found **295 files and zero prohibited secret/private-upload paths**. No environment values were printed or checked into source.

Reviewed deployment input fingerprint: `5ecb32b300feb45bdbecd2ab6f62e796c20ac5b1b7445fa39c6deac741d15e69` (SHA-256 of the sorted path/content-hash manifest). Both deployments carry this value in `revisionSource` metadata and `revisionGuide=2026-11-10`. [release-source.json](../artifacts/revision-guide/release-source.json) records the source identity. These initial deployments display the original base Git commit because they were created before committing the local changes; that displayed commit must not be used alone to identify those deployments.

| Project | Production URL | New READY deployment | Previous READY deployment for rollback |
| --- | --- | --- | --- |
| Backend | https://welljob-hris-backend.vercel.app | `dpl_DbkgfaM65GwxwwittL79RnGxn7Zc` | `dpl_DMZzago3574AxE7fGctm9JZAfCHF` |
| Frontend | https://welljob-hris-frontend.vercel.app | `dpl_Brhz31wnYjQ1h4Guri5gA5u9EsmR` | `dpl_29qR3e6usE6E5EaEzEutJfK6m5s3` |

The [production verifier](../backend/scripts/verifyRevisionDeployment.cjs) confirmed the current production aliases, READY status, correct source metadata, backend availability/security headers, newly deployed function identity, missing/invalid-session rejection, allowed frontend CORS origin, served JavaScript pointing at the stable production backend, and SPA routes `/`, `/employees`, `/mobile-handoff`.

## Verification limits

No required implementation or release step remains open from this guide. There are no failing checks in the final verification. This does not establish that the entire HRIS has no bugs.

- Destructive employee CRUD and role/company scenarios ran against actual isolated services with fictional records. Production probes were read-only; ordinary production users were not impersonated and production employee CRUD fixtures were not created.
- SMTP connection/authentication passed; recipient inbox delivery and email rendering were not exercised.
- Phone layout and one-time-link behavior passed in headless Edge at 390px. A physical phone camera capture was not exercised.
- Vite still reports its existing advisory for a JavaScript chunk larger than 500 kB. The production builds succeed.
