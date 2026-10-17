const db = require("../config/db");

const {
  WORKFORCE_SCOPE_KEY,
  normalizeStatusText,
  isDeployedStatus,
  isFloatingStatus,
  isCurrentWorkforceStatus,
} = require("../utils/workforceScope");

const EXPIRABLE_DOCUMENTS = [
  "Barangay Clearance",
  "NBI/Police Clearance",
];

const MONTHLY_WORKFORCE_CATEGORY = Object.freeze({
  DEPLOYED:
    "Deployed",
  FOR_DEPLOYMENT:
    "For Deployment",
  FLOATING:
    "Floating / Standby",
  RESIGNED:
    "Resigned",
  TERMINATED:
    "Terminated",
  AWOL:
    "AWOL",
  OTHER_SEPARATION:
    "Other Separation",
});

const MANILA_TIME_ZONE =
  "Asia/Manila";

const MANILA_CURRENT_DATE_SQL =
  "DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'))";

function getManilaCurrentYearMonth() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          MANILA_TIME_ZONE,
        year:
          "numeric",
        month:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            [
              "year",
              "month",
            ].includes(
              part.type
            )
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );

  return {
    year:
      Number(
        values.year
      ),

    month:
      Number(
        values.month
      ) - 1,
  };
}

function normalizeDateOnlyValue(value) {
  if (!value) {
    return "";
  }

  const normalized =
    String(
      value
    ).trim();

  const match =
    normalized.match(
      /^(\d{4}-\d{2}-\d{2})/
    );

  return match
    ? match[1]
    : "";
}

function timestampToIsoString(value) {
  const numericValue =
    Number(
      value
    );

  if (
    !Number.isFinite(
      numericValue
    ) ||
    numericValue <= 0
  ) {
    return null;
  }

  const milliseconds =
    numericValue <
    100000000000
      ? numericValue * 1000
      : numericValue;

  const date =
    new Date(
      milliseconds
    );

  return Number.isNaN(
    date.getTime()
  )
    ? null
    : date.toISOString();
}

function isActiveIncidentStatus(status) {
  return [
    "open",
    "investigating",
    "for review",
    "for_review",
  ].includes(
    normalizeStatusText(
      status
    )
  );
}

function mapEmployees(
  employeeRows,
  expiringDocumentRows
) {
  const documentsByEmployeeId =
    new Map();

  for (const document of expiringDocumentRows) {
    const employeeId = String(
      document.employeeId
    );

    if (
      !documentsByEmployeeId.has(
        employeeId
      )
    ) {
      documentsByEmployeeId.set(
        employeeId,
        []
      );
    }

    documentsByEmployeeId
      .get(employeeId)
      .push({
        id: document.id,
        name: document.name,
        expirationDate:
          document.expirationDate,
      });
  }

  return employeeRows.map(
    (employee) => ({
      id: employee.id,
      employeeId: employee.id,
      name: employee.name,
      company: employee.company,
      status: employee.status,
      contractStart:
        employee.contractStart,
      createdAt: employee.createdAt,
      archived:
        Number(employee.archived) === 1,
      documents:
        documentsByEmployeeId.get(
          String(employee.id)
        ) || [],
      hasDeploymentHistory:
        Number(
          employee.hasDeploymentHistory
        ) === 1,
      hasActiveDeployment:
        Number(
          employee.hasActiveDeployment
        ) === 1,
    })
  );
}

function buildKpis(
  employees,
  incidents,
  expiringDocumentCount
) {
  const currentEmployees =
    employees.filter((employee) =>
      isCurrentWorkforceStatus(
        employee.status
      )
    );

  const deployed =
    currentEmployees.filter(
      (employee) => {
        if (
          !isDeployedStatus(
            employee.status
          )
        ) {
          return false;
        }

        if (
          employee.hasActiveDeployment
        ) {
          return true;
        }

        return (
          !employee.hasDeploymentHistory
        );
      }
    ).length;

  const available =
    currentEmployees.filter(
      (employee) =>
        isFloatingStatus(
          employee.status
        )
    ).length;

  const activeIncidents =
    incidents.filter((incident) =>
      isActiveIncidentStatus(
        incident.status
      )
    ).length;

  return {
    total: currentEmployees.length,
    deployed,
    available,
    activeIncidents,
    expiringDocs:
      Number(expiringDocumentCount) || 0,
  };
}

function normalizeMonthlyReportMonth(
  value,
  fallbackMonth
) {
  const raw =
    String(
      value ?? ""
    ).trim();

  if (!raw) {
    return fallbackMonth;
  }

  const parsed =
    Number.parseInt(
      raw,
      10
    );

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed < 0 ||
    parsed > 11
  ) {
    return null;
  }

  return parsed;
}

function normalizeMonthlyReportYear(
  value,
  fallbackYear
) {
  const raw =
    String(
      value ?? ""
    ).trim();

  if (!raw) {
    return fallbackYear;
  }

  const parsed =
    Number.parseInt(
      raw,
      10
    );

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed < 1900 ||
    parsed > 9999
  ) {
    return null;
  }

  return parsed;
}

function formatSqlDateUtc(date) {
  const year =
    date
      .getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function buildMonthlyReportPeriod(
  year,
  month
) {
  const start =
    new Date(
      Date.UTC(
        year,
        month,
        1
      )
    );

  const endExclusive =
    new Date(
      Date.UTC(
        year,
        month + 1,
        1
      )
    );

  const monthLabel =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month:
          "long",
        timeZone:
          "UTC",
      }
    ).format(
      start
    );

  return {
    start:
      formatSqlDateUtc(
        start
      ),

    endExclusive:
      formatSqlDateUtc(
        endExclusive
      ),

    label:
      `${monthLabel} ${year}`,
  };
}

function normalizeMonthlyCategory(
  value
) {
  const normalized =
    normalizeStatusText(
      value
    );

  if (
    [
      "deployed",
      "active deployed",
    ].includes(
      normalized
    )
  ) {
    return MONTHLY_WORKFORCE_CATEGORY.DEPLOYED;
  }

  if (
    [
      "for deployment",
      "for_deployment",
      "pending deployment",
    ].includes(
      normalized
    )
  ) {
    return MONTHLY_WORKFORCE_CATEGORY.FOR_DEPLOYMENT;
  }

  if (
    [
      "floating",
      "floating standby",
      "floating / standby",
      "standby",
      "pooling",
      "available",
    ].includes(
      normalized
    )
  ) {
    return MONTHLY_WORKFORCE_CATEGORY.FLOATING;
  }

  if (
    normalized ===
    "resigned"
  ) {
    return MONTHLY_WORKFORCE_CATEGORY.RESIGNED;
  }

  if (
    normalized ===
    "terminated"
  ) {
    return MONTHLY_WORKFORCE_CATEGORY.TERMINATED;
  }

  if (
    normalized ===
    "awol"
  ) {
    return MONTHLY_WORKFORCE_CATEGORY.AWOL;
  }

  return null;
}

function normalizeMonthlySeparationReason(
  reason
) {
  const normalized =
    normalizeStatusText(
      reason
    );

  if (
    normalized ===
    "resigned"
  ) {
    return MONTHLY_WORKFORCE_CATEGORY.RESIGNED;
  }

  if (
    normalized ===
    "terminated"
  ) {
    return MONTHLY_WORKFORCE_CATEGORY.TERMINATED;
  }

  if (
    normalized ===
    "awol"
  ) {
    return MONTHLY_WORKFORCE_CATEGORY.AWOL;
  }

  if (
    normalized
  ) {
    return MONTHLY_WORKFORCE_CATEGORY.OTHER_SEPARATION;
  }

  return MONTHLY_WORKFORCE_CATEGORY.OTHER_SEPARATION;
}

function buildMonthlyWorkforceBucket() {
  return {
    totalEmployees:
      0,

    deployed:
      0,

    forDeployment:
      0,

    floatingStandby:
      0,

    resigned:
      0,

    terminated:
      0,

    awol:
      0,

    otherSeparation:
      0,
  };
}

function addCategoryToMonthlyBucket(
  bucket,
  category
) {
  if (
    !bucket ||
    !category
  ) {
    return;
  }

  bucket.totalEmployees +=
    1;

  if (
    category ===
    MONTHLY_WORKFORCE_CATEGORY.DEPLOYED
  ) {
    bucket.deployed +=
      1;

    return;
  }

  if (
    category ===
    MONTHLY_WORKFORCE_CATEGORY.FOR_DEPLOYMENT
  ) {
    bucket.forDeployment +=
      1;

    return;
  }

  if (
    category ===
    MONTHLY_WORKFORCE_CATEGORY.FLOATING
  ) {
    bucket.floatingStandby +=
      1;

    return;
  }

  if (
    category ===
    MONTHLY_WORKFORCE_CATEGORY.RESIGNED
  ) {
    bucket.resigned +=
      1;

    return;
  }

  if (
    category ===
    MONTHLY_WORKFORCE_CATEGORY.TERMINATED
  ) {
    bucket.terminated +=
      1;

    return;
  }

  if (
    category ===
    MONTHLY_WORKFORCE_CATEGORY.AWOL
  ) {
    bucket.awol +=
      1;

    return;
  }

  bucket.otherSeparation +=
    1;
}

function classifyMonthlyWorkforceRow(
  row,
  period
) {
  const statusCategory =
    normalizeMonthlyCategory(
      row?.historicalStatus
    );

  const statusEffectiveDate =
    normalizeDateOnlyValue(
      row?.statusEffectiveAt
    );

  const normalizedHistoricalStatus =
    normalizeStatusText(
      row?.historicalStatus
    );

  const isHistoricalInactive =
    [
      "inactive",
      "separated",
    ].includes(
      normalizedHistoricalStatus
    );

  /*
   * A separation that happened before the selected
   * month must not keep appearing as a resignation /
   * termination / AWOL in every later monthly report.
   */
  if (
    isHistoricalInactive &&
    statusEffectiveDate &&
    statusEffectiveDate <
      period.start
  ) {
    return null;
  }

  if (
    statusCategory
  ) {
    return statusCategory;
  }

  if (
    isHistoricalInactive
  ) {
    return normalizeMonthlySeparationReason(
      row?.monthlySeparationReason ||
      row?.statusReason ||
      row?.assignmentEndReason
    );
  }

  /*
   * Defense for legacy rows whose status history was
   * incomplete but whose assignment history is clear.
   *
   * An assignment is considered deployed at month-end
   * if it started before the report cut-off and had not
   * yet ended before that cut-off.
   */
  const assignmentStatus =
    normalizeStatusText(
      row?.assignmentStatus
    );

  const assignmentEndDate =
    normalizeDateOnlyValue(
      row?.assignmentEndDate
    );

  const assignmentEndedBeforePeriodEnd =
    Boolean(
      assignmentEndDate &&
      assignmentEndDate <
        period.endExclusive
    );

  if (
    assignmentStatus ===
      "active" ||
    (
      row?.assignmentStartDate &&
      !assignmentEndedBeforePeriodEnd
    )
  ) {
    return MONTHLY_WORKFORCE_CATEGORY.DEPLOYED;
  }

  return null;
}

function resolveMonthlyWorkforceCompany(
  row
) {
  const candidates = [
    row?.monthlySeparationCompany,
    row?.assignmentCompany,
    row?.employeeCompany,
  ];

  for (const candidate of candidates) {
    const normalized =
      String(
        candidate || ""
      ).trim();

    if (normalized) {
      return normalized;
    }
  }

  return "Unassigned";
}

function buildMonthlyWorkforceSummary(
  rows
) {
  const overall =
    buildMonthlyWorkforceBucket();

  const companyMap =
    new Map();

  for (const row of rows) {
    if (
      !row?.category
    ) {
      continue;
    }

    const company =
      resolveMonthlyWorkforceCompany(
        row
      );

    if (
      !companyMap.has(
        company
      )
    ) {
      companyMap.set(
        company,
        {
          company,
          ...buildMonthlyWorkforceBucket(),
        }
      );
    }

    addCategoryToMonthlyBucket(
      overall,
      row.category
    );

    addCategoryToMonthlyBucket(
      companyMap.get(
        company
      ),
      row.category
    );
  }

  const companies =
    Array.from(
      companyMap.values()
    ).sort(
      (
        firstCompany,
        secondCompany
      ) => {
        if (
          secondCompany.totalEmployees !==
          firstCompany.totalEmployees
        ) {
          return (
            secondCompany.totalEmployees -
            firstCompany.totalEmployees
          );
        }

        return firstCompany.company.localeCompare(
          secondCompany.company
        );
      }
    );

  const companyTotals =
    companies.reduce(
      (
        totals,
        company
      ) => {
        totals.totalEmployees +=
          company.totalEmployees;

        totals.deployed +=
          company.deployed;

        totals.forDeployment +=
          company.forDeployment;

        totals.floatingStandby +=
          company.floatingStandby;

        totals.resigned +=
          company.resigned;

        totals.terminated +=
          company.terminated;

        totals.awol +=
          company.awol;

        totals.otherSeparation +=
          company.otherSeparation;

        return totals;
      },
      buildMonthlyWorkforceBucket()
    );

  return {
    overall,
    companies,
    companyTotals,

    totalsMatch:
      Object.keys(
        overall
      ).every(
        (key) =>
          Number(
            overall[key]
          ) ===
          Number(
            companyTotals[key]
          )
      ),
  };
}

/*
 * ==================================================
 * DASHBOARD — MONTHLY WORKFORCE SUMMARY
 * ==================================================
 *
 * This is the authoritative monthly management report
 * source for Super Admin / HR Manager / HR Staff.
 *
 * Filters:
 * - month: JavaScript month index, 0..11
 * - year: four-digit year
 *
 * The result has two reporting levels:
 *
 * 1. Overall workforce summary for the selected month
 * 2. Automatic company-by-company breakdown
 *
 * There is intentionally NO company filter.
 *
 * Historical rules:
 *
 * - the latest employee_status_history row before the
 *   end of the selected month represents the employee's
 *   workforce state for that reporting cut-off;
 * - a resignation / termination / AWOL is counted only
 *   in the month in which the separation became effective;
 * - employees separated before the selected month are
 *   not repeated in later monthly separation counts;
 * - deployment assignment history is used as a legacy
 *   fallback when an older status-history row is unclear;
 * - archived rows are intentionally not removed from the
 *   historical monthly report, so archiving an employee
 *   does not rewrite past workforce totals.
 *
 * IMPORTANT:
 * created_at is NOT treated as Date Hired and is not used
 * to fabricate an employment start date.
 */
exports.getDashboardMonthlyWorkforce =
  async (
    req,
    res
  ) => {
    let connection;

    try {
      const currentManilaPeriod =
        getManilaCurrentYearMonth();

      const month =
        normalizeMonthlyReportMonth(
          req.query?.month,
          currentManilaPeriod.month
        );

      if (
        month ===
        null
      ) {
        return res
          .status(400)
          .json({
            error:
              "Month must be between 0 and 11.",
          });
      }

      const year =
        normalizeMonthlyReportYear(
          req.query?.year,
          currentManilaPeriod.year
        );

      if (
        year ===
        null
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid report year.",
          });
      }

      const period =
        buildMonthlyReportPeriod(
          year,
          month
        );

      connection =
        await db
          .promise()
          .getConnection();

      /*
       * latest_status:
       *   employee workforce state at the selected
       *   month-end cut-off.
       *
       * latest_assignment:
       *   latest assignment that already existed by
       *   that month-end.
       *
       * monthly_separation:
       *   exact separation event occurring inside the
       *   selected month, used to distinguish
       *   Resigned / Terminated / AWOL / Other Separation.
       */
      const [historicalRows] =
        await connection.query(
          `
          WITH
          latest_status AS (
            SELECT
              ranked.employee_id,
              ranked.to_status,
              ranked.effective_at,
              ranked.reason

            FROM (
              SELECT
                esh.employee_id,
                esh.to_status,
                esh.effective_at,
                esh.reason,

                ROW_NUMBER() OVER (
                  PARTITION BY
                    esh.employee_id

                  ORDER BY
                    esh.effective_at DESC,
                    esh.id DESC
                ) AS row_number

              FROM
                employee_status_history AS esh

              WHERE
                esh.effective_at < ?
            ) AS ranked

            WHERE
              ranked.row_number = 1
          ),

          latest_assignment AS (
            SELECT
              ranked.employee_id,
              ranked.company,
              ranked.status,
              ranked.start_date,
              ranked.end_date,
              ranked.ended_at,
              ranked.end_reason

            FROM (
              SELECT
                da.employee_id,
                da.company,
                da.status,
                da.start_date,
                da.end_date,
                da.ended_at,
                da.end_reason,

                ROW_NUMBER() OVER (
                  PARTITION BY
                    da.employee_id

                  ORDER BY
                    da.start_date DESC,
                    da.id DESC
                ) AS row_number

              FROM
                deployment_assignments AS da

              WHERE
                da.start_date < ?
            ) AS ranked

            WHERE
              ranked.row_number = 1
          ),

          monthly_separation AS (
            SELECT
              ranked.employee_id,
              ranked.company,
              ranked.end_reason,
              ranked.separation_date

            FROM (
              SELECT
                da.employee_id,
                da.company,
                da.end_reason,

                COALESCE(
                  da.end_date,
                  DATE(
                    da.ended_at
                  )
                ) AS separation_date,

                ROW_NUMBER() OVER (
                  PARTITION BY
                    da.employee_id

                  ORDER BY
                    COALESCE(
                      da.end_date,
                      DATE(
                        da.ended_at
                      )
                    ) DESC,
                    da.id DESC
                ) AS row_number

              FROM
                deployment_assignments AS da

              WHERE
                COALESCE(
                  da.end_date,
                  DATE(
                    da.ended_at
                  )
                ) >= ?

                AND COALESCE(
                  da.end_date,
                  DATE(
                    da.ended_at
                  )
                ) < ?

                AND (
                  da.end_reason IS NOT NULL
                  OR da.status IN (
                    'Completed',
                    'Cancelled'
                  )
                )
            ) AS ranked

            WHERE
              ranked.row_number = 1
          )

          SELECT
            e.id AS employeeId,
            e.name AS employeeName,
            e.company AS employeeCompany,

            ls.to_status AS historicalStatus,
            DATE_FORMAT(
              ls.effective_at,
              '%Y-%m-%d %H:%i:%s'
            ) AS statusEffectiveAt,
            ls.reason AS statusReason,

            la.company AS assignmentCompany,
            la.status AS assignmentStatus,
            DATE_FORMAT(
              la.start_date,
              '%Y-%m-%d'
            ) AS assignmentStartDate,

            DATE_FORMAT(
              COALESCE(
                la.end_date,
                DATE(
                  la.ended_at
                )
              ),
              '%Y-%m-%d'
            ) AS assignmentEndDate,

            la.end_reason AS assignmentEndReason,

            ms.company AS monthlySeparationCompany,
            ms.end_reason AS monthlySeparationReason,
            DATE_FORMAT(
              ms.separation_date,
              '%Y-%m-%d'
            ) AS monthlySeparationDate

          FROM
            employees AS e

          LEFT JOIN
            latest_status AS ls
              ON ls.employee_id =
                e.id

          LEFT JOIN
            latest_assignment AS la
              ON la.employee_id =
                e.id

          LEFT JOIN
            monthly_separation AS ms
              ON ms.employee_id =
                e.id

          WHERE
            ls.employee_id IS NOT NULL
            OR la.employee_id IS NOT NULL

          ORDER BY
            e.id ASC
          `,
          [
            period.endExclusive,
            period.endExclusive,
            period.start,
            period.endExclusive,
          ]
        );

      const classifiedRows =
        historicalRows
          .map(
            (row) => ({
              ...row,

              category:
                classifyMonthlyWorkforceRow(
                  row,
                  period
                ),
            })
          )
          .filter(
            (row) =>
              Boolean(
                row.category
              )
          );

      const summary =
        buildMonthlyWorkforceSummary(
          classifiedRows
        );

      const [yearRows] =
        await connection.query(
          `
          SELECT DISTINCT
            source.year

          FROM (
            SELECT
              YEAR(
                esh.effective_at
              ) AS year

            FROM
              employee_status_history AS esh

            WHERE
              esh.effective_at
                IS NOT NULL

            UNION

            SELECT
              YEAR(
                da.start_date
              ) AS year

            FROM
              deployment_assignments AS da

            WHERE
              da.start_date
                IS NOT NULL

            UNION

            SELECT
              YEAR(
                COALESCE(
                  da.end_date,
                  DATE(
                    da.ended_at
                  )
                )
              ) AS year

            FROM
              deployment_assignments AS da

            WHERE
              COALESCE(
                da.end_date,
                DATE(
                  da.ended_at
                )
              ) IS NOT NULL
          ) AS source

          WHERE
            source.year
              IS NOT NULL

          ORDER BY
            source.year DESC
          `
        );

      const availableYears =
        yearRows
          .map(
            (row) =>
              Number(
                row.year
              )
          )
          .filter(
            Number.isInteger
          );

      return res.json({
        filters: {
          month,
          monthNumber:
            month + 1,
          year,
          label:
            period.label,
          periodStart:
            period.start,
          periodEndExclusive:
            period.endExclusive,
        },

        /*
         * "overall" is the primary management summary.
         * "summary" is provided as a compatibility alias
         * so the frontend can consume either name while
         * the Dashboard UI is being wired.
         */
        overall:
          summary.overall,

        summary:
          summary.overall,

        companies:
          summary.companies,

        overallTotal:
          summary.companyTotals,

        filterMeta: {
          years:
            availableYears,
        },

        meta: {
          generatedAt:
            new Date()
              .toISOString(),

          workforceScopeKey:
            WORKFORCE_SCOPE_KEY,

          classification:
            "MONTH_END_WORKFORCE_SNAPSHOT",

          employeeRowsEvaluated:
            historicalRows.length,

          employeeRowsIncluded:
            classifiedRows.length,

          companyRows:
            summary.companies.length,

          totalsMatch:
            summary.totalsMatch,

          usesCreatedAtAsHireDate:
            false,
        },
      });
    } catch (error) {
      console.error(
        "GET DASHBOARD MONTHLY WORKFORCE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to fetch monthly workforce summary",
        });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  };

exports.getDashboardOverview = async (
  req,
  res
) => {
  let connection;

  try {
    connection =
      await db
        .promise()
        .getConnection();

    const [employeeRows] =
      await connection.query(`
        SELECT
          e.id,
          e.name,
          e.company,
          e.status,
          DATE_FORMAT(
            e.contractStart,
            '%Y-%m-%d'
          ) AS contractStart,
          e.created_at AS createdAt,
          e.archived,
          EXISTS (
            SELECT 1
            FROM deployment_assignments AS da_any
            WHERE da_any.employee_id = e.id
            LIMIT 1
          ) AS hasDeploymentHistory,
          EXISTS (
            SELECT 1
            FROM deployment_assignments AS da_active
            WHERE
              da_active.employee_id = e.id
              AND da_active.status = 'Active'
            LIMIT 1
          ) AS hasActiveDeployment
        FROM employees AS e
        WHERE e.archived = 0
        ORDER BY
          e.created_at DESC,
          e.id DESC
      `);

    const [expiringDocumentRows] =
      await connection.query(
        `
        SELECT
          d.id,
          d.employee_id AS employeeId,
          d.name,
          DATE_FORMAT(
            d.expiration_date,
            '%Y-%m-%d'
          ) AS expirationDate
        FROM employee_documents AS d
        INNER JOIN employees AS e
          ON e.id = d.employee_id
        WHERE
          e.archived = 0
          AND d.name IN (?, ?)
          AND d.expiration_date IS NOT NULL
          AND d.expiration_date >= ${MANILA_CURRENT_DATE_SQL}
          AND d.expiration_date < DATE_ADD(
            ${MANILA_CURRENT_DATE_SQL},
            INTERVAL 31 DAY
          )
        ORDER BY
          d.expiration_date ASC,
          d.id ASC
        `,
        EXPIRABLE_DOCUMENTS
      );

    const [incidentRows] =
      await connection.query(`
        SELECT
          i.id,
          i.employee_id AS employeeId,
          COALESCE(
            NULLIF(TRIM(i.employee_name), ''),
            e.name,
            'Unknown Employee'
          ) AS employee,
          COALESCE(
            NULLIF(TRIM(i.company), ''),
            e.company,
            ''
          ) AS company,
          i.violation_type AS violation,
          i.severity,
          i.status,
          DATE_FORMAT(
            i.incident_date,
            '%Y-%m-%d'
          ) AS date,
          DATE_FORMAT(
            i.incident_date,
            '%Y-%m-%d'
          ) AS incidentDate,
          DATE_FORMAT(
            i.incident_date,
            '%Y-%m-%d'
          ) AS reportedAt,
          i.created_at AS createdAt,
          UNIX_TIMESTAMP(
            i.created_at
          ) * 1000 AS createdAtTimestamp
        FROM incidents AS i
        LEFT JOIN employees AS e
          ON e.id = i.employee_id
        ORDER BY
          i.created_at DESC,
          i.id DESC
      `);

    const [deploymentTrendRows] =
      await connection.query(`
        SELECT
          DATE_FORMAT(
            da.start_date,
            '%Y-%m-01'
          ) AS date,
          COUNT(*) AS employees
        FROM deployment_assignments AS da
        INNER JOIN employees AS e
          ON e.id = da.employee_id
        WHERE
          e.archived = 0
          AND da.start_date IS NOT NULL
        GROUP BY
          DATE_FORMAT(da.start_date, '%Y-%m-01')
        ORDER BY
          date ASC
      `);

    const employees = mapEmployees(
      employeeRows,
      expiringDocumentRows
    );

    const incidents =
      incidentRows.map(
        (incident) => ({
          id: incident.id,
          employeeId:
            incident.employeeId,
          employee:
            incident.employee,
          company: incident.company,
          violation:
            incident.violation,
          severity:
            incident.severity,
          status: incident.status,
          date:
            incident.date,
          incidentDate:
            incident.incidentDate,
          reportedAt:
            incident.reportedAt,
          createdAtTimestamp:
            Number(
              incident.createdAtTimestamp
            ) || null,
          createdAt:
            timestampToIsoString(
              incident.createdAtTimestamp
            ) ||
            incident.createdAt ||
            null,
        })
      );

    const deploymentTrend =
      deploymentTrendRows.map(
        (row) => ({
          date: row.date,
          employees:
            Number(row.employees) || 0,
        })
      );

    const kpis = buildKpis(
      employees,
      incidents,
      expiringDocumentRows.length
    );

    return res.json({
      kpis,
      employees,
      incidents,
      deploymentTrend,
      meta: {
        workforceScopeKey:
          WORKFORCE_SCOPE_KEY,

        activeWorkforceRows:
          kpis.total,

        generatedAt:
          new Date().toISOString(),
        employeeRows:
          employees.length,
        incidentRows:
          incidents.length,
        deploymentTrendRows:
          deploymentTrend.length,
        expiringDocumentRows:
          expiringDocumentRows.length,
      },
    });
  } catch (error) {
    console.error(
      "GET DASHBOARD OVERVIEW ERROR:",
      error
    );

    return res
      .status(500)
      .json({
        error:
          "Failed to fetch dashboard overview",
      });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};