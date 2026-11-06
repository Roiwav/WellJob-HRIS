# WELLJOB HRIS Phase 3 Development and Verification Report

Date: 2026-11-06 (Asia/Manila)

Branch: `VercelBackendMigration`

Reviewed HEAD: `8b4eedc5473f25c4b0aa0a4d33cc6563738aec51`

## 1. Outcome

The isolated Aiven database was initialized over verified TLS and the core API persistence matrix was exercised using fictional records. Migration, exact minimum-age validation, mandatory government-ID validation for new employees, Philippine date consistency, employee CRUD/archive, protected incident resolution, KPI evaluation, HR decision persistence, stale-snapshot recovery, RBAC, and company-scope checks passed.

Three runtime defects were reproduced and fixed:

1. MySQL 8.4 rejected `ON UPDATE CASCADE` on `deployment_attempts.employee_id` because that column feeds a stored generated guard column. The canonical constraint now uses `ON UPDATE RESTRICT`.
2. KPI decision persistence sent ISO timestamps directly to MySQL `DATETIME`, causing HTTP 500. Snapshot dates are now converted to explicit `Asia/Manila` SQL datetime values.
3. Compliance day calculations depended on the browser/server local timezone. Date-only expiration values now use a consistent `Asia/Manila` calendar comparison in both frontend and backend suggestion logic.

No live deployment was changed during implementation and runtime verification. Delivery is performed only after the reviewed checks in this report pass.

## 2. Preservation and backups

The checkout is on `VercelBackendMigration` at `8b4eedc`. The Phase 1/2 work from commit `11def1f` was preserved. The original four untracked files were left unchanged:

- `.vercelignore`
- `README.txt`
- `WELLJOB-backend-deployment-review.txt`
- `backend/scripts/migrateChatAttachmentsToSupabase.cjs`

Pre-edit backups were created at:

- `C:\Users\dudeg\AppData\Local\Temp\WellJob-HRIS-pre-codex-20261105`
- `C:\Users\dudeg\AppData\Local\Temp\WellJob-HRIS-before-phase3-changes-20261105`
- `C:\Users\dudeg\AppData\Local\Temp\WellJob-HRIS-before-items-1-5-20261106`

The copied files matched their source SHA-256 hashes.

## 3. Database setup and migration verification

The migration registry now contains 23 unique migrations. `setupDatabase.cjs` derives its expected ledger from that registry, removing the 17-versus-21 count drift. Fresh setup and normal migration handling now include:

- `deployment_attempts.scheduled_time TIME NULL`
- `incident_phone_capture_sessions`

Schema commands require `DB_EXPECTED_NAME` to match `DB_NAME`, verify `SELECT DATABASE()` before DDL, support `DB_REQUIRE_EXISTING=true`, and can require certificate-verified TLS through `DB_REQUIRE_SSL=true` plus `DB_SSL_CA_BASE64`.

The ignored `backend/.env.phase3.local` selected `welljob_phase3_test`; the original `backend/.env` was not edited. The first setup attempt exposed the generated-column foreign-key defect after seven tables. After the constraint fix and focused regression test, idempotent setup completed:

- Database: `welljob_phase3_test`
- MySQL: 8.4.8
- TLS: active and certificate-verified
- Application tables: 30
- `schema_migrations`: present
- Migration ledger: 23/23 records
- Migration result: 20 adopted, 3 executed, 0 failed
- Executed: password-reset approval requests, credential-delivery status, and Messenger schema

The final read-only readiness check reported 31 total tables including the ledger. The supplied account is broader than preferred: global privileges are present, including global `CREATE`; it has no explicit target-only database grant and has grants involving five other databases. Exact target guards constrained this run, but future test credentials should be restricted to `welljob_phase3_test`.

## 4. Birthday validation

Create and Update share strict calendar-date validation, reject impossible and future dates, and compare frontend dates using the `Asia/Manila` calendar. Minimum age is enforced as exactly 17 on `date_hired`: the 17th birthday passes and the preceding day fails. Create requires birthday. Update revalidates when birthday or Date Hired changes while leaving unchanged historical rows untouched.

Automated tests cover the exact birthday boundary, leap-day birthdays, invalid dates, and the UTC-to-Manila boundary. The isolated live Create API rejected a future birthday and an employee one day short of 17 with HTTP 400; an employee exactly 17 on Date Hired persisted successfully.

## 5. Government ID validation

SSS, PhilHealth, and Pag-IBIG are required for new employees. Frontend and backend enforce these formats on Create and Update:

- SSS: exactly 10 digits; optional display input `00-0000000-0`
- PhilHealth: exactly 12 digits; optional display input `00-000000000-0`
- Pag-IBIG: exactly 12 digits; optional display input `0000-0000-0000`

Letters, spaces, bad lengths, unsupported punctuation, and a missing required identifier are rejected. Valid input is stored as a string of digits, preserving leading zeroes. New or changed identifier records must be valid. Unchanged legacy values are preserved during unrelated edits; existing structured identifiers cannot be silently removed. No unique constraint or historical data rewrite was added.

The live API rejected malformed SSS input with HTTP 400. A fictional employee was created and updated using hyphenated SSS, PhilHealth, and Pag-IBIG values; direct database verification confirmed digit-only persistence with leading zeroes intact. These checks validate format only and do not claim agency issuance verification.

Official references reviewed:

- [SSS Citizens Charter](https://www.sss.gov.ph/wp-content/uploads/2022/03/2021-SSS-Citizens-Charter.pdf)
- [PhilHealth Claim Form 4 Guidelines](https://www.philhealth.gov.ph/downloads/claim/PhilHealthClaim4_Guidelines.pdf)
- [Pag-IBIG Member's Data Form](https://www.pagibigfund.gov.ph/document/pdf/dlforms/providentrelated/PFF039_MembersDataForm_V11.pdf)

## 6. Actual backend/API runtime verification

`backend/scripts/verifyPhase3Runtime.cjs` starts the real Express app on an ephemeral local port. It uses fictional database users, is hard-guarded to `welljob_phase3_test`, and requires `--confirm-write`. Supabase is restricted to the dedicated private `welljob-phase3-test` bucket. Gmail, scheduler, and Socket.IO paths are not invoked.

Successful checks:

- missing authentication rejected with HTTP 401
- IT Support employee operational access rejected with HTTP 403
- future birthday, under-17 hire date, malformed ID, and missing mandatory ID rejected with HTTP 400
- employee Create, retrieve, Update, archive, and database reload passed
- same-company Coordinator employee detail returned HTTP 200; cross-company detail returned HTTP 404
- HR Staff and Super Admin incident creation returned HTTP 403
- Coordinator cross-company incident creation returned HTTP 404
- incident Create/retrieve passed and server classified the fictional rule as Critical
- prescribed sanction remained separate from actual investigator action
- Open to Investigating to For Review to Closed transitions persisted
- a fictional PDF resolution proof was uploaded to the private Phase 3 Supabase bucket
- the authorized protected-download endpoint returned the stored PDF, and the evidence purpose persisted as `RESOLUTION_PROOF`
- independent HR Manager closure approval persisted
- one Closed incident and one unresolved Open incident remained available in history
- KPI evaluation returned behavior trend, risk/KPI, separate workflow action and corrective intervention, and reasons
- HR Staff decision recording returned HTTP 403
- HR Manager decision save/reload persisted reviewer username/role, notes, and snapshot
- stale decision snapshot returned HTTP 409; refreshed resubmission returned HTTP 201
- employee employment/workforce state was identical before and after recording decisions
- HR Manager archive persisted while retaining the historical employee row

The existing Supabase credentials had sufficient access, so no additional secret was needed. `backend/scripts/preparePhase3Supabase.cjs` created the dedicated private bucket and updated only the ignored Phase 3 environment file. The original application bucket was not modified. Failed diagnostic runs and the successful run left only clearly named fictional Phase 3 database records and test-bucket objects; no destructive cleanup SQL was used.

## 7. Automated verification

- Backend suite: **147/147 passed**
- Frontend suite: **47/47 passed**
- Frontend/backend KPI parity subset: **10/10 passed**
- Frontend employee validation subset: **7/7 passed**
- Backend age/government-ID subset: **10/10 passed**
- KPI stale-request recovery subset: **3/3 passed**
- KPI MySQL datetime regression: **passed**
- Migration/generated-column constraint regression: **passed**
- Compliance timezone regression in UTC and Asia/Manila: **passed**
- Deployment metadata endpoint regression: **passed**
- Targeted frontend ESLint: **0 errors, 0 warnings**
- Backend syntax checks: **passed**
- Frontend production build: **passed**, 2918 modules transformed

The locked `qrcode.react` dependency was restored locally without changing the lockfile. Vite reports the existing large-chunk advisory. The package install also reported six dependency advisories that need a separate upgrade-impact review; no automatic audit fix was run.

## 8. Files inspected and modified

Database/backend changes:

- `backend/.env.example`
- `backend/database/baseline.sql`
- `backend/scripts/migrateDatabase.cjs`
- `backend/scripts/setupDatabase.cjs`
- `backend/scripts/verifyDatabaseReadiness.cjs`
- `backend/scripts/verifyPhase3Runtime.cjs`
- `backend/scripts/preparePhase3Supabase.cjs`
- `backend/scripts/verifyVercelDeployment.cjs`
- `backend/app.js`
- `backend/controllers/employeeController.js`
- `backend/controllers/kpiDecisionController.js`
- `backend/controllers/smartSuggestionController.js`
- `backend/utils/employeeGovernmentIdValidation.js`
- `backend/utils/employeeAgeValidation.js`
- `backend/utils/deploymentMetadata.js`
- `backend/test/complianceTimezone.test.js`
- `backend/test/databaseIntegrity.test.js`
- `backend/test/deploymentMetadata.test.js`
- `backend/test/employeeGovernmentIdValidation.test.js`
- `backend/test/employeeAgeValidation.test.js`
- `backend/test/kpiDecisionTrustedSnapshot.test.js`
- `backend/package.json`

Frontend changes:

- `frontend/src/utils/employees/employeeGovernmentIdValidation.js`
- `frontend/src/utils/employees/employeeFormHelpers.js`
- `frontend/src/utils/employees/employeeHelpers.js`
- `frontend/src/utils/employees/employeeDirectUpload.js`
- `frontend/src/components/employees/employeeConstants.js`
- `frontend/src/components/employees/EmployeeDocumentsSection.jsx`
- `frontend/src/components/employees/EmployeeFormFields.jsx`
- `frontend/src/hooks/employees/useEmployeeForm.js`
- `frontend/src/hooks/useKPIDecisionQueries.js`
- `frontend/src/components/kpi/sections/RecommendationReviewSection.jsx`
- `frontend/test/employee-form-helper-loader.mjs`
- `frontend/test/complianceTimezone.test.js`
- `frontend/test/employeeValidation.test.js`
- `frontend/test/kpiDecisionRequest.test.js`
- `frontend/package.json`

The frontend stale-409 flow preserves the HTTP status, fetches the current server evaluation, replaces the stale snapshot, clears the prior choice, and requires explicit HR Manager review and resubmission. It never auto-submits a decision.

## 9. Pending decisions and blockers

The defense-build decisions are documented in `PHASE3_BUSINESS_RULE_DECISION_RECORD.md`: age 17 on Date Hired, mandatory government IDs for new employees, the existing 1/3/5 severity weights and 0–3/4–7/8+ score bands, the existing resolved-incident decay schedule, positive-current-point corrective patterns, and advisory-only recommendations. Formal acknowledgement by Ms. Ann or another identified authorized HR representative is not evidenced in the repository and must still be recorded before describing these rules as established company policy.

Other remaining limits:

- the public GitHub Deployments API confirms successful frontend and backend production deployments of commit `8b4eedc5473f25c4b0aa0a4d33cc6563738aec51` on 2026-11-03; that deployment predates the uncommitted Phase 3 changes in this report
- the local Vercel token still lacks direct project/team API access, but this no longer blocks identifying the deployed commit through the public deployment record
- the current Aiven account is broader than the preferred test-only scope
- KPI terminology, forecast wording, and keyword edge cases were not changed because no additional defect was reproduced

## 10. Git status, deployment readiness, and final-defense steps

Before delivery, the working tree contained the preserved original untracked files plus the reviewed Phase 3 changes and reports. `backend/.env.phase3.local` is ignored and contains no reportable secrets. The delivery index excludes `.vercelignore`, `README.txt`, `WELLJOB-backend-deployment-review.txt`, and `backend/scripts/migrateChatAttachmentsToSupabase.cjs` because they predated this work and were not part of the reviewed change set.

The source and isolated database are ready for delivery review and a final-defense rehearsal of the verified flows. The production baseline before delivery was commit `8b4eedc5473f25c4b0aa0a4d33cc6563738aec51`; the delivery commit and resulting deployment status must be verified in GitHub/Vercel after push. Remaining operational steps are:

1. obtain the authorized HR acknowledgement in the business-rule decision record
2. replace broad Aiven credentials with test-database-scoped credentials
3. keep the dedicated private Supabase bucket for defense rehearsal, then decide whether to remove its fictional artifacts after the defense
4. capture UI screenshots using only the fictional dataset
5. review dependency advisories and the Vite chunk-size warning
6. review the full diff, then commit, push, and verify the resulting frontend/backend deployments
