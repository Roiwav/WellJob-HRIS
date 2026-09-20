
const db = require("../config/db");

/*
 * ==================================================
 * EMPLOYEE INCIDENT SUMMARY
 * ==================================================
 *
 * HR Coordinator:
 * - May view aggregate incident statistics for an
 *   employee currently assigned to their company.
 * - Statistics include historical incidents from
 *   all companies.
 * - No incident details, IDs, evidence, company
 *   history, or disciplinary actions are returned.
 *
 * This controller does not modify incident records.
 */

function normalizePositiveEmployeeId(value) {
  const raw = String(value ?? "").trim();

  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const id = Number(raw);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

function normalizeAssignedCompany(value) {
  const company = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");

  return company || null;
}

function normalizeRole(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function toSafeCount(value) {
  const count = Number(value);

  if (!Number.isFinite(count) || count < 0) {
    return 0;
  }

  return Math.trunc(count);
}

exports.getEmployeeIncidentSummary = async (req, res) => {
  try {
    /*
     * Route authorization will also restrict access
     * to HR_COORDINATOR.
     *
     * Keep this independent check as defense in depth.
     */
    if (
      normalizeRole(req.user?.role) !==
      "HR_COORDINATOR"
    ) {
      return res.status(403).json({
        error: "Access denied.",
      });
    }

    const employeeId = normalizePositiveEmployeeId(
      req.params?.employeeId
    );

    if (!employeeId) {
      return res.status(400).json({
        error: "Invalid employee ID.",
      });
    }

    /*
     * req.user is populated by verifyToken using the
     * CURRENT database account, not browser input.
     */
    const coordinatorCompany = normalizeAssignedCompany(
      req.user?.assignedCompany ??
        req.user?.assigned_company
    );

    if (!coordinatorCompany) {
      return res.status(403).json({
        error: "Company assignment required.",
      });
    }

    /*
     * One database query enforces current employee
     * ownership and calculates historical statistics.
     *
     * An employee is eligible only when:
     *
     * 1. Their employee record is not archived.
     * 2. Their current status is Deployed.
     * 3. They have exactly one Active deployment.
     * 4. That Active deployment belongs to the
     *    coordinator's assigned company.
     *
     * The incident aggregation itself does not filter
     * by incident company. This allows historical
     * statistics to follow the employee after transfer.
     *
     * IMPORTANT:
     * Only aggregate values are selected from incidents.
     */

    const [rows] = await db.promise().query(
      `
      SELECT
        e.id AS employee_id,

        COUNT(i.id) AS total_incidents,

        COALESCE(
          SUM(
            CASE
              WHEN
                i.id IS NOT NULL
                AND LOWER(
                  TRIM(
                    REPLACE(
                      COALESCE(i.status, ''),
                      '_',
                      ' '
                    )
                  )
                ) NOT IN (
                  'closed',
                  'resolved'
                )
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS open_cases,

        COALESCE(
          SUM(
            CASE
              WHEN
                i.id IS NOT NULL
                AND LOWER(
                  TRIM(
                    REPLACE(
                      COALESCE(i.status, ''),
                      '_',
                      ' '
                    )
                  )
                ) IN (
                  'closed',
                  'resolved'
                )
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS closed_cases,

        COALESCE(
          SUM(
            CASE
              WHEN LOWER(
                TRIM(
                  COALESCE(
                    NULLIF(i.severity, ''),
                    'Minor'
                  )
                )
              ) = 'critical'
              THEN 1
              ELSE 0
            END
          ),
          0
        ) AS critical_incidents,

        COALESCE(
          SUM(
            CASE
              WHEN LOWER(
                TRIM(
                  COALESCE(
                    NULLIF(i.severity, ''),
                    'Minor'
                  )
                )
              ) = 'critical'
              THEN 5

              WHEN LOWER(
                TRIM(
                  COALESCE(
                    NULLIF(i.severity, ''),
                    'Minor'
                  )
                )
              ) = 'major'
              THEN 3

              WHEN LOWER(
                TRIM(
                  COALESCE(
                    NULLIF(i.severity, ''),
                    'Minor'
                  )
                )
              ) = 'minor'
              THEN 1

              ELSE 0
            END
          ),
          0
        ) AS severity_score

      FROM employees AS e

      LEFT JOIN incidents AS i
        ON i.employee_id = CAST(e.id AS CHAR)

      WHERE
        e.id = ?

        AND e.archived = 0

        AND LOWER(
          TRIM(
            COALESCE(e.status, '')
          )
        ) = 'deployed'

        AND (
          SELECT COUNT(*)
          FROM deployment_assignments AS da_count

          WHERE
            da_count.employee_id = e.id

            AND da_count.status = 'Active'
        ) = 1

        AND EXISTS (
          SELECT 1
          FROM deployment_assignments AS da_current

          WHERE
            da_current.employee_id = e.id

            AND da_current.status = 'Active'

            AND LOWER(
              TRIM(
                COALESCE(
                  da_current.company,
                  ''
                )
              )
            ) = LOWER(TRIM(?))
        )

      GROUP BY e.id

      LIMIT 1
      `,
      [
        employeeId,
        coordinatorCompany,
      ]
    );

    /*
     * Same response for an unknown employee and an
     * employee outside the coordinator's company.
     *
     * Do not reveal whether an inaccessible employee
     * exists.
     */
    if (rows.length === 0) {
      return res.status(404).json({
        error: "Employee not found.",
      });
    }

    const row = rows[0];

    /*
     * Historical statistics only.
     *
     * No incident records or confidential metadata
     * are included in the response.
     */
    res.setHeader(
      "Cache-Control",
      "private, no-store, max-age=0"
    );

    return res.status(200).json({
      employeeId,

      summary: {
        total: toSafeCount(row.total_incidents),

        open: toSafeCount(row.open_cases),

        closed: toSafeCount(row.closed_cases),

        critical: toSafeCount(row.critical_incidents),

        severityScore: toSafeCount(row.severity_score),
      },
    });
  } catch (error) {
    console.error(
      "GET EMPLOYEE INCIDENT SUMMARY ERROR:",
      error
    );

    return res.status(500).json({
      error: "Unable to load employee incident summary.",
    });
  }
};