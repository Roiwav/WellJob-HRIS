# WELLJOB HRIS Phase 3 Business-Rule Decision Record

Date recorded: 2026-11-06 (Asia/Manila)

Branch: `VercelBackendMigration`

## Decision status

The repository owner/project user instructed completion of items 1–5 and approved the following configuration for the final-defense build on 2026-11-06. This records project approval for demonstration and technical verification. The user's identity was not independently verified as Ms. Ann or another authorized HR representative, so this record must not be presented as a signed company-policy approval.

## Approved final-defense configuration

1. Minimum employee age is 17 years on `date_hired`.
   - A person whose 17th birthday is exactly the hire date passes.
   - Invalid dates, future birthdays, and people who have not reached 17 on the hire date are rejected.
   - Create requires a birthday.
   - Update revalidates when birthday or Date Hired changes; unrelated edits do not rewrite unchanged historical rows.
2. SSS, PhilHealth, and Pag-IBIG identifiers are mandatory for new employee records.
   - SSS is exactly 10 digits.
   - PhilHealth PIN and Pag-IBIG MID are exactly 12 digits each.
   - Supported hyphenated input is normalized to digit-only storage.
   - New or changed values must be valid; unchanged legacy values remain preserved.
3. The rule-based DSS configuration remains:
   - Severity weights: Minor 1, Major 3, Critical 5.
   - Current-score bands: 0–3 Minor Concern, 4–7 Needs Improvement, 8 or more Critical Concern.
   - Resolved-incident decay: 100% through 3 months, 75% through 6 months, 50% through 9 months, 25% through 12 months, then 0%.
   - Only incidents with positive current points establish current corrective repetition patterns. Fully decayed incidents remain in history.
   - Suggested HR Workflow Action and Corrective Intervention are separate advisory outputs.
   - Recording a recommendation never imposes discipline or changes employment/deployment status automatically.

## Company-policy acknowledgement

If Welljob wants to adopt these rules as formal company policy after the defense, an identified authorized HR representative may add a signed or traceable approval reference here. That governance action is separate from the completed defense-build implementation and verification.

Authorized HR representative: ______________________________

Decision/reference: _________________________________________

Effective date: ____________________

Any later revision must state the replacement age reference date, identifier-required status, severity weights, score bands, decay schedule, corrective-pattern rule, and acceptable recommendation wording before corresponding code changes are made.
