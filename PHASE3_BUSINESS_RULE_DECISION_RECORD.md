# WELLJOB HRIS Phase 3 Business-Rule Decision Record

Date prepared: 2026-11-06 (Asia/Manila)

Branch: `VercelBackendMigration`

This record makes the final-defense configuration explicit. The project instruction on 2026-11-06 authorized implementation of items 1–5. The repository does not contain evidence identifying that instruction as formal approval from Ms. Ann or another authorized HR representative, so the configuration must not be described as established company policy until the client acknowledgement below is completed.

## Implemented defense configuration

1. Minimum employee age is 17 years on `date_hired`.
   - A person whose 17th birthday is exactly the hire date passes.
   - Invalid dates, future birthdays, and people who have not reached 17 on the hire date are rejected.
   - Create requires a birthday.
   - Update validates the rule when birthday or Date Hired changes. Unchanged historical rows are not rewritten or blocked.
2. SSS, PhilHealth, and Pag-IBIG identifiers are required for new employees.
   - SSS is exactly 10 digits.
   - PhilHealth PIN and Pag-IBIG MID are exactly 12 digits each.
   - Hyphenated display input is normalized to digit-only strings.
   - New or changed identifier records must be valid. Unchanged legacy values remain preserved.
3. The existing rule-based DSS configuration remains unchanged for the defense build.
   - Severity weights: Minor 1, Major 3, Critical 5.
   - Current-score bands: 0–3 Minor Concern, 4–7 Needs Improvement, 8 or more Critical Concern.
   - Resolved-incident decay: 100% through 3 months, 75% through 6 months, 50% through 9 months, 25% through 12 months, then 0%.
   - Only incidents with positive current points establish current corrective repetition patterns. Fully decayed incidents remain in history.
   - Suggested HR Workflow Action and Corrective Intervention remain separate advisory outputs. Recording a recommendation does not automatically impose discipline or change employment/deployment status.

## Client acknowledgement

Authorized HR representative: ______________________________

Decision: Approve / Revise / Reject

Effective date: ____________________

Signature or documented approval reference: ______________________________

Any revision must state the replacement age reference date, identifier-required status, severity weights, score bands, decay schedule, corrective-pattern rule, and acceptable recommendation wording before code changes are made.
