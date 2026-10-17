const db = require("../config/db");

const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

/*
 * Legacy company-to-location display mapping.
 *
 * This remains temporarily to preserve the existing
 * deployment location display/search behavior.
 *
 * Client company and position selection itself is no
 * longer sourced from this object. New selectable
 * companies come from client_companies and selectable
 * positions come from company_positions.
 */
const COMPANY_LOCATIONS = {
  "SM Supermalls": "Calamba City, Laguna",
  "Robinsons Retail Holdings": "Calamba City, Laguna",
  "Ayala Land Inc.": "Makati City",
  "Jollibee Foods Corporation": "Pasig City",
  "San Miguel Corporation": "Mandaluyong City",
  "PLDT Inc.": "Makati City",
  "Globe Telecom": "Taguig City",
  "BDO Unibank": "Makati City",
  Metrobank: "Makati City",
  "Puregold Price Club": "Quezon City",
  "Wilcon Depot": "Quezon City",
  "DMCI Holdings": "Makati City",
  "Megaworld Corporation": "Taguig City",
  "Unilab Inc.": "Mandaluyong City",
  "Nestlé Philippines": "Makati City",
  "Coca-Cola Philippines": "Taguig City",
  "Pepsi-Cola Products Philippines": "Muntinlupa City",
  "Toyota Philippines": "Santa Rosa, Laguna",
  "Honda Philippines": "Batangas",
  "Accenture Philippines": "Taguig City",
  "IBM Philippines": "Quezon City",
  "Teleperformance Philippines": "Pasig City",
  "Concentrix Philippines": "Quezon City",
  "Sitel Philippines": "Makati City",
};

const COMPLETED_REASONS = new Set([
  "Completed Contract",
  "End of Assignment / Pulled Out by Client",
  "Transferred / Reassigned",
]);

/*
 * IMPORTANT DOMAIN NOTE:
 *
 * Existing production deployment records use "Cancelled" as a
 * legacy INTERNAL lifecycle value for employee-separation outcomes.
 *
 * We preserve that stored/API value for backward compatibility, but
 * HR-facing messages and display values must describe the real outcome:
 *
 * - Resigned
 * - AWOL
 * - Terminated
 * - Other Separation
 * - Ended (safe fallback for incomplete legacy data)
 */
const LEGACY_SEPARATION_DEPLOYMENT_STATUS =
  "Cancelled";

const SEPARATION_REASONS = new Set([
  "Resigned",
  "AWOL",
  "Terminated",
]);

const DEPLOYMENT_OPTION_ROLES = new Set([
  "HR_MANAGER",
  "HR_STAFF",
]);

const DEPLOYMENT_MUTATION_ROLES = new Set([
  "HR_MANAGER",
  "HR_STAFF",
]);

const DEPLOYMENT_REPORT_ROLES = new Set([
  "SUPER_ADMIN",
  "HR_MANAGER",
  "HR_STAFF",
  "HR_COORDINATOR",
]);

const DEFAULT_DEPLOYMENT_PAGE_SIZE = 50;
const MAX_DEPLOYMENT_PAGE_SIZE = 100;

/*
 * Business dates for Welljob must follow the
 * Philippine calendar regardless of the MySQL
 * session or Node host timezone.
 *
 * UTC_TIMESTAMP() is an absolute UTC reference.
 * Converting that reference to +08:00 is safe here
 * because the Philippines uses UTC+08:00 year-round.
 */
const MANILA_CURRENT_DATE_SQL =
  "DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'))";

function normalizeDate(value) {
  if (!value) {
    return "-";
  }

  if (
    typeof value ===
    "string"
  ) {
    const normalized =
      value.trim();

    const dateOnlyMatch =
      normalized.match(
        /^(\d{4}-\d{2}-\d{2})$/
      );

    if (dateOnlyMatch) {
      return dateOnlyMatch[1];
    }

    /*
     * Preserve the stored calendar date for legacy
     * timezone-less MySQL DATETIME fallbacks.
     *
     * Historical DATETIME semantics are mixed, so this
     * function intentionally does not apply a blanket
     * UTC or +08 conversion to those legacy values.
     */
    const mysqlDateTimeMatch =
      normalized.match(
        /^(\d{4}-\d{2}-\d{2})[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/
      );

    if (mysqlDateTimeMatch) {
      return mysqlDateTimeMatch[1];
    }

    const parsed =
      new Date(
        normalized
      );

    if (
      Number.isNaN(
        parsed.getTime()
      )
    ) {
      return "-";
    }

    const parts =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone:
            "Asia/Manila",
          year:
            "numeric",
          month:
            "2-digit",
          day:
            "2-digit",
        }
      ).formatToParts(
        parsed
      );

    const dateParts =
      Object.fromEntries(
        parts
          .filter(
            (part) =>
              [
                "year",
                "month",
                "day",
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

    if (
      !dateParts.year ||
      !dateParts.month ||
      !dateParts.day
    ) {
      return "-";
    }

    return (
      `${dateParts.year}-` +
      `${dateParts.month}-` +
      `${dateParts.day}`
    );
  }

  /*
   * mysql2 may expose DATE values as JavaScript Date
   * objects using the Node host's local timezone.
   * Reading local calendar components preserves the
   * original database DATE instead of converting it
   * through UTC ISO first.
   */
  if (
    value instanceof Date
  ) {
    if (
      Number.isNaN(
        value.getTime()
      )
    ) {
      return "-";
    }

    const year =
      value.getFullYear();

    const month =
      String(
        value.getMonth() +
          1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        value.getDate()
      ).padStart(
        2,
        "0"
      );

    return `${year}-${month}-${day}`;
  }

  return "-";
}

function normalizeText(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

function normalizeNullableText(
  value
) {
  const normalized = String(
    value || ""
  ).trim();

  return normalized || null;
}

function isLegacySeparationDeploymentStatus(
  value
) {
  const normalized =
    normalizeText(
      value
    );

  return (
    normalized ===
      "cancelled" ||
    normalized ===
      "canceled"
  );
}

function normalizeDeploymentLifecycleStatus(
  value
) {
  const normalized =
    normalizeText(
      value
    );

  if (!normalized) {
    return null;
  }

  if (
    normalized ===
    "active"
  ) {
    return "Active";
  }

  if (
    normalized ===
    "completed"
  ) {
    return "Completed";
  }

  if (
    normalized ===
      "cancelled" ||
    normalized ===
      "canceled" ||
    normalized ===
      "separated" ||
    normalized ===
      "ended"
  ) {
    return LEGACY_SEPARATION_DEPLOYMENT_STATUS;
  }

  if (
    normalized ===
    "pending"
  ) {
    return "Pending";
  }

  return null;
}

function getDeploymentDisplayStatus(
  status,
  endReason,
  endRemarks
) {
  const lifecycleStatus =
    normalizeDeploymentLifecycleStatus(
      status
    );

  if (
    lifecycleStatus ===
    "Active"
  ) {
    return "Deployed";
  }

  if (
    lifecycleStatus ===
    "Completed"
  ) {
    return "Completed";
  }

  if (
    lifecycleStatus ===
    "Pending"
  ) {
    return "For Deployment";
  }

  if (
    !isLegacySeparationDeploymentStatus(
      status
    )
  ) {
    return (
      normalizeNullableText(
        status
      ) ||
      "Ended"
    );
  }

  const reason =
    normalizeNullableText(
      endReason
    );

  if (
    reason === "Resigned" ||
    reason === "AWOL" ||
    reason === "Terminated"
  ) {
    return reason;
  }

  /*
   * Keep legacy/other separation reasons available in
   * the detail fields, but never expose "Separated" or
   * "Cancelled" as the visible deployment status.
   */
  void endRemarks;

  return "Ended";
}

function normalizeRole(value) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

function isHrCoordinatorRequest(
  req
) {
  return (
    normalizeRole(
      req?.user?.role
    ) ===
    "HR_COORDINATOR"
  );
}

function canReadDeploymentOptions(
  req
) {
  return DEPLOYMENT_OPTION_ROLES.has(
    normalizeRole(
      req?.user?.role
    )
  );
}

function canMutateDeployments(
  req
) {
  return DEPLOYMENT_MUTATION_ROLES.has(
    normalizeRole(
      req?.user?.role
    )
  );
}

function canExportDeploymentReport(
  req
) {
  return DEPLOYMENT_REPORT_ROLES.has(
    normalizeRole(
      req?.user?.role
    )
  );
}

function getHrCoordinatorAssignedCompany(
  req
) {
  return normalizeNullableText(
    req?.user?.assignedCompany ??
      req?.user?.assigned_company
  );
}

function buildCoordinatorCompanyCondition(
  assignmentAlias = "da"
) {
  return `
    LOWER(
      TRIM(
        ${assignmentAlias}.company
      )
    ) =
    LOWER(
      TRIM(?)
    )
  `;
}

/*
 * HR Coordinator access:
 *
 * An employee must currently be deployed at the
 * coordinator's assigned company.
 *
 * Historical deployment records from another company
 * are never included in the coordinator's view.
 *
 * Multiple active assignments fail closed.
 */
function buildCoordinatorCurrentEmployeeCondition(
  employeeAlias = "e"
) {
  return `
    LOWER(
      TRIM(
        COALESCE(
          ${employeeAlias}.status,
          ''
        )
      )
    ) = 'deployed'

    AND EXISTS (
      SELECT 1
      FROM deployment_assignments AS da_current

      WHERE
        da_current.employee_id = ${employeeAlias}.id

        AND da_current.status = 'Active'

        AND ${buildCoordinatorCompanyCondition(
          "da_current"
        )}

        AND NOT EXISTS (
          SELECT 1
          FROM deployment_assignments AS da_conflict

          WHERE
            da_conflict.employee_id = ${employeeAlias}.id

            AND da_conflict.status = 'Active'

            AND da_conflict.id <> da_current.id
        )
    )
  `;
}

function isCurrentlyDeployedEmployee(
  employee
) {
  return [
    "deployed",
    "active deployed",
  ].includes(
    normalizeText(
      employee?.status
    )
  );
}

function getEmployeeStatus(
  deploymentStatus
) {
  return isLegacySeparationDeploymentStatus(
    deploymentStatus
  )
    ? "Inactive"
    : "Floating / Standby";
}

function getActorUserId(req) {
  return (
    req?.user?.userId ??
    req?.user?.id ??
    null
  );
}

function getActor(req) {
  const user =
    req?.user || {};

  const username =
    normalizeNullableText(
      user.username
    );

  const fullName =
    normalizeNullableText(
      user.fullName ??
        user.full_name ??
        user.name
    ) ||
    username ||
    "Unknown User";

  return {
    userId:
      getActorUserId(
        req
      ),

    username,

    fullName,

    role:
      normalizeNullableText(
        user.role
      ),
  };
}

function mapAssignment(row) {
  const company =
    row.company || "-";

  const deploymentStatus =
    row.deploymentStatus ||
    "Active";

  const endReason =
    row.endReason || "";

  const endRemarks =
    row.endRemarks || "";

  const displayStatus =
    getDeploymentDisplayStatus(
      deploymentStatus,
      endReason,
      endRemarks
    );

  const reportDate =
    deploymentStatus ===
      "Active"
      ? row.startDate
      : (
          row.endDate ||
          row.endedAt ||
          row.startDate
        );

  return {
    id:
      row.deploymentId,

    deploymentId:
      row.deploymentId,

    employeeId:
      row.employeeId,

    employee:
      row.employee ||
      "Unknown Employee",

    company,

    location:
      COMPANY_LOCATIONS[
        company
      ] || "-",

    position:
      row.position || "",

    start:
      normalizeDate(
        row.startDate
      ),

    /*
     * "status" remains the canonical lifecycle value used by existing
     * frontend/backend flows. "displayStatus" is the HR-safe label.
     */
    status:
      deploymentStatus,

    displayStatus,

    employeeStatus:
      row.employeeStatus ||
      "",

    employmentType:
      "Permanent",

    contractStart:
      normalizeDate(
        row.startDate
      ),

    contractEnd:
      normalizeDate(
        row.endDate
      ),

    endReason,

    endRemarks,

    contractEndedAt:
      row.endedAt || null,

    reportDate:
      normalizeDate(
        reportDate
      ),

    eventDate:
      normalizeDate(
        reportDate
      ),

    archived:
      Number(
        row.archived || 0
      ) === 1,

    createdAt:
      row.createdAt,

    updatedAt:
      row.updatedAt,
  };
}

function toPositiveInteger(
  value,
  fallback
) {
  const parsed =
    Number.parseInt(
      String(
        value ?? ""
      ),
      10
    );

  return (
    Number.isInteger(
      parsed
    ) &&
    parsed > 0
  )
    ? parsed
    : fallback;
}

function normalizeDeploymentSearch(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /[^a-zA-Z0-9\s]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .slice(
      0,
      100
    );
}

function normalizeDeploymentReportStatus(
  value
) {
  const normalized =
    normalizeText(
      value
    );

  if (
    !normalized ||
    normalized ===
      "all" ||
    normalized ===
      "all statuses"
  ) {
    return null;
  }

  if (
    [
      "active",
      "deployed",
    ].includes(
      normalized
    )
  ) {
    return "Deployed";
  }

  if (
    normalized ===
    "completed"
  ) {
    return "Completed";
  }

  if (
    normalized ===
    "resigned"
  ) {
    return "Resigned";
  }

  if (
    normalized ===
    "terminated"
  ) {
    return "Terminated";
  }

  if (
    normalized ===
    "awol"
  ) {
    return "AWOL";
  }

  if (
    [
      "cancelled",
      "canceled",
      "separated",
      "ended",
      "other separation",
    ].includes(
      normalized
    )
  ) {
    return "Ended";
  }

  return null;
}

function getDeploymentEventDateSql(
  assignmentAlias = "da"
) {
  return `
    CASE
      WHEN ${assignmentAlias}.status = 'Active'
        THEN ${assignmentAlias}.start_date
      ELSE COALESCE(
        ${assignmentAlias}.end_date,
        DATE(${assignmentAlias}.ended_at),
        ${assignmentAlias}.start_date
      )
    END
  `;
}

function addDeploymentStatusFilter(
  where,
  params,
  status,
  assignmentAlias = "da"
) {
  if (!status) {
    return;
  }

  if (
    status ===
    "Deployed"
  ) {
    where.push(
      `${assignmentAlias}.status = 'Active'`
    );

    return;
  }

  if (
    status ===
    "Completed"
  ) {
    where.push(
      `${assignmentAlias}.status = 'Completed'`
    );

    return;
  }

  if (
    [
      "Resigned",
      "Terminated",
      "AWOL",
    ].includes(
      status
    )
  ) {
    where.push(`
      ${assignmentAlias}.status = ?
      AND LOWER(
        TRIM(
          COALESCE(
            ${assignmentAlias}.end_reason,
            ''
          )
        )
      ) = ?
    `);

    params.push(
      LEGACY_SEPARATION_DEPLOYMENT_STATUS,
      status.toLowerCase()
    );

    return;
  }

  if (
    status ===
    "Ended"
  ) {
    where.push(`
      ${assignmentAlias}.status = ?
      AND LOWER(
        TRIM(
          COALESCE(
            ${assignmentAlias}.end_reason,
            ''
          )
        )
      ) NOT IN (
        'resigned',
        'terminated',
        'awol'
      )
    `);

    params.push(
      LEGACY_SEPARATION_DEPLOYMENT_STATUS
    );
  }
}

function buildDeploymentSummaryFilters({
  search,
  status,
  month,
  year,
  coordinatorCompany = null,
}) {
  const where = [
    /*
     * Preserve historical ended/completed deployment
     * rows even when an employee is archived later.
     * Active archived employees remain excluded.
     */
    "(e.archived = 0 OR da.status <> 'Active')",
  ];

  const params = [];

  /*
   * HR Coordinator scope is based on the deployment
   * assignment's company, not the employee's current
   * company. This is required so the assigned-company
   * coordinator can report historical resignations,
   * terminations, AWOL, completed, and ended records.
   */
  if (coordinatorCompany) {
    where.push(
      buildCoordinatorCompanyCondition(
        "da"
      )
    );

    params.push(
      coordinatorCompany
    );
  }

  addDeploymentStatusFilter(
    where,
    params,
    status,
    "da"
  );

  const searchTerms =
    normalizeDeploymentSearch(
      search
    )
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

  for (
    const term of searchTerms
  ) {
    const pattern =
      `%${term}%`;

    const locationCompanies =
      Object.entries(
        COMPANY_LOCATIONS
      )
        .filter(
          ([
            ,
            location,
          ]) =>
            normalizeText(
              location
            ).includes(
              term
            )
        )
        .map(
          ([
            company,
          ]) =>
            company
        );

    const locationSql =
      locationCompanies.length >
      0
        ? `
          OR da.company IN (
            ${locationCompanies
              .map(
                () => "?"
              )
              .join(
                ", "
              )}
          )
        `
        : "";

    where.push(`
      (
        CAST(
          da.id AS CHAR
        ) LIKE ?

        OR CAST(
          da.employee_id AS CHAR
        ) LIKE ?

        OR LOWER(
          COALESCE(
            e.name,
            ''
          )
        ) LIKE ?

        OR LOWER(
          COALESCE(
            da.company,
            ''
          )
        ) LIKE ?

        OR LOWER(
          COALESCE(
            da.position,
            ''
          )
        ) LIKE ?

        OR LOWER(
          COALESCE(
            da.status,
            ''
          )
        ) LIKE ?

        OR LOWER(
          COALESCE(
            da.end_reason,
            ''
          )
        ) LIKE ?

        OR LOWER(
          CASE
            WHEN da.status = 'Active'
              THEN 'Deployed'
            WHEN da.status = 'Completed'
              THEN 'Completed'
            WHEN da.status = 'Cancelled'
              AND LOWER(
                TRIM(
                  COALESCE(
                    da.end_reason,
                    ''
                  )
                )
              ) IN (
                'resigned',
                'terminated',
                'awol'
              )
              THEN da.end_reason
            WHEN da.status = 'Cancelled'
              THEN 'Ended'
            ELSE da.status
          END
        ) LIKE ?

        OR 'permanent' LIKE ?

        ${locationSql}
      )
    `);

    params.push(
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      ...locationCompanies
    );
  }

  const eventDateSql =
    getDeploymentEventDateSql(
      "da"
    );

  if (
    month !== null
  ) {
    where.push(
      `MONTH(${eventDateSql}) = ?`
    );

    params.push(
      month + 1
    );
  }

  if (
    year !== null
  ) {
    where.push(
      `YEAR(${eventDateSql}) = ?`
    );

    params.push(
      year
    );
  }

  return {
    whereSql:
      `WHERE ${where.join(
        "\nAND "
      )}`,

    params,
  };
}

function buildDeploymentSummary(
  rows = []
) {
  const companies =
    rows.map(
      (row) => {
        const deployed =
          Number(
            row.deployed ??
              row.active ??
              0
          );

        const completed =
          Number(
            row.completed ||
              0
          );

        const resigned =
          Number(
            row.resigned ||
              0
          );

        const terminated =
          Number(
            row.terminated_count ??
              row.terminated ??
              0
          );

        const awol =
          Number(
            row.awol ||
              0
          );

        const ended =
          Number(
            row.ended ||
              0
          );

        const separated =
          Number(
            row.separated ??
              row.cancelled ??
              (
                resigned +
                terminated +
                awol +
                ended
              )
          );

        return {
          company:
            row.company ||
            "-",

          total:
            Number(
              row.total ||
                0
            ),

          deployed,

          /*
           * Backward-compatible alias for the existing
           * frontend summary card.
           */
          active:
            deployed,

          completed,
          resigned,
          terminated,
          awol,
          ended,
          separated,

          /*
           * Temporary compatibility alias.
           */
          cancelled:
            separated,
        };
      }
    );

  const totals =
    companies.reduce(
      (
        summary,
        company
      ) => {
        summary.totalDeployments +=
          company.total;

        summary.deployedDeployments +=
          company.deployed;

        summary.activeDeployments +=
          company.active;

        summary.completedDeployments +=
          company.completed;

        summary.resignedDeployments +=
          company.resigned;

        summary.terminatedDeployments +=
          company.terminated;

        summary.awolDeployments +=
          company.awol;

        summary.endedDeployments +=
          company.ended;

        summary.separatedDeployments +=
          company.separated;

        summary.cancelledDeployments +=
          company.cancelled;

        return summary;
      },
      {
        totalDeployments:
          0,

        deployedDeployments:
          0,

        activeDeployments:
          0,

        completedDeployments:
          0,

        resignedDeployments:
          0,

        terminatedDeployments:
          0,

        awolDeployments:
          0,

        endedDeployments:
          0,

        separatedDeployments:
          0,

        cancelledDeployments:
          0,
      }
    );

  return {
    companies,

    totalDeployments:
      totals.totalDeployments,

    totalCompanies:
      companies.length,

    deployedDeployments:
      totals.deployedDeployments,

    /*
     * Backward-compatible alias for existing clients.
     */
    activeDeployments:
      totals.activeDeployments,

    completedDeployments:
      totals.completedDeployments,

    resignedDeployments:
      totals.resignedDeployments,

    terminatedDeployments:
      totals.terminatedDeployments,

    awolDeployments:
      totals.awolDeployments,

    endedDeployments:
      totals.endedDeployments,

    separatedDeployments:
      totals.separatedDeployments,

    /*
     * Temporary compatibility alias for existing clients.
     */
    cancelledDeployments:
      totals.cancelledDeployments,

    topCompany:
      companies[0] ||
      null,
  };
}

function buildDeploymentReportSummary(
  deployments = []
) {
  const summary = {
    totalRecords: 0,
    deployed: 0,
    completed: 0,
    resigned: 0,
    terminated: 0,
    awol: 0,
    ended: 0,
  };

  for (
    const deployment of
    deployments
  ) {
    summary.totalRecords +=
      1;

    switch (
      deployment
        ?.displayStatus
    ) {
      case "Deployed":
        summary.deployed +=
          1;
        break;

      case "Completed":
        summary.completed +=
          1;
        break;

      case "Resigned":
        summary.resigned +=
          1;
        break;

      case "Terminated":
        summary.terminated +=
          1;
        break;

      case "AWOL":
        summary.awol +=
          1;
        break;

      default:
        summary.ended +=
          1;
        break;
    }
  }

  return summary;
}

/*
 * ==================================================
 * GET ACTIVE DEPLOYMENT COMPANY OPTIONS
 * ==================================================
 *
 * Operational read-only endpoint.
 *
 * This is intentionally separate from the System
 * Configuration management endpoints.
 *
 * HR Manager / HR Staff:
 * - may read active company choices for deployment
 *
 * HR Coordinator:
 * - cannot modify deployments and therefore does not
 *   need this operational selection endpoint
 *
 * Super Admin:
 * - deployment mutation is not part of the current
 *   Super Admin role design
 */
exports.getDeploymentCompanyOptions =
  async (
    req,
    res
  ) => {
    if (
      !canReadDeploymentOptions(
        req
      )
    ) {
      return res
        .status(403)
        .json({
          success:
            false,

          error:
            "You are not allowed to access deployment company options.",
        });
    }

    try {
      const [rows] =
        await db
          .promise()
          .query(
            `
            SELECT
              id,
              company_name
            FROM client_companies
            WHERE is_active = 1
            ORDER BY
              company_name ASC,
              id ASC
            `
          );

      return res
        .status(200)
        .json({
          success:
            true,

          companies:
            rows.map(
              (row) => ({
                id:
                  Number(
                    row.id
                  ),

                company:
                  normalizeNullableText(
                    row.company_name
                  ),

                companyName:
                  normalizeNullableText(
                    row.company_name
                  ),

                company_name:
                  normalizeNullableText(
                    row.company_name
                  ),
              })
            ),
        });
    } catch (error) {
      console.error(
        "GET DEPLOYMENT COMPANY OPTIONS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to fetch deployment company options.",
        });
    }
  };

/*
 * ==================================================
 * GET ACTIVE DEPLOYMENT POSITION OPTIONS
 * ==================================================
 *
 * Returns ACTIVE positions belonging to one ACTIVE
 * client company.
 *
 * The company is resolved from the master table, not
 * trusted directly from the browser.
 */
exports.getDeploymentPositionOptions =
  async (
    req,
    res
  ) => {
    if (
      !canReadDeploymentOptions(
        req
      )
    ) {
      return res
        .status(403)
        .json({
          success:
            false,

          error:
            "You are not allowed to access deployment position options.",
        });
    }

    const requestedCompany =
      normalizeNullableText(
        req.query?.company
      );

    if (
      !requestedCompany
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          error:
            "Company is required.",
        });
    }

    try {
      /*
       * Resolve the canonical ACTIVE company first.
       *
       * This allows the API to distinguish:
       *
       * - invalid/inactive company
       * - valid company with zero configured positions
       */
      const [companyRows] =
        await db
          .promise()
          .query(
            `
            SELECT
              id,
              company_name
            FROM client_companies
            WHERE is_active = 1
              AND LOWER(
                TRIM(
                  company_name
                )
              ) =
              LOWER(
                TRIM(?)
              )
            LIMIT 1
            `,
            [
              requestedCompany,
            ]
          );

      if (
        companyRows.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            error:
              "Active client company was not found.",
          });
      }

      const company =
        companyRows[0];

      const [positionRows] =
        await db
          .promise()
          .query(
            `
            SELECT
              id,
              position_name
            FROM company_positions
            WHERE company_id = ?
              AND is_active = 1
            ORDER BY
              position_name ASC,
              id ASC
            `,
            [
              company.id,
            ]
          );

      const canonicalCompanyName =
        normalizeNullableText(
          company.company_name
        );

      return res
        .status(200)
        .json({
          success:
            true,

          company: {
            id:
              Number(
                company.id
              ),

            company:
              canonicalCompanyName,

            companyName:
              canonicalCompanyName,

            company_name:
              canonicalCompanyName,
          },

          positions:
            positionRows.map(
              (row) => {
                const positionName =
                  normalizeNullableText(
                    row.position_name
                  );

                return {
                  id:
                    Number(
                      row.id
                    ),

                  position:
                    positionName,

                  positionName,

                  position_name:
                    positionName,
                };
              }
            ),
        });
    } catch (error) {
      console.error(
        "GET DEPLOYMENT POSITION OPTIONS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to fetch deployment position options.",
        });
    }
  };

/*
 * ==================================================
 * GET DEPLOYMENTS
 * ==================================================
 *
 * HR Coordinator:
 *
 * - may view deployment records
 * - receives only deployment rows belonging to
 *   their assigned company
 * - summary cards are company-scoped
 * - available year filters are company-scoped
 * - query/body values cannot override scope
 */
exports.getDeployments = async (
  req,
  res
) => {
  try {
    const isHrCoordinator =
      isHrCoordinatorRequest(
        req
      );

    const coordinatorCompany =
      isHrCoordinator
        ? getHrCoordinatorAssignedCompany(
            req
          )
        : null;

    /*
     * authMiddleware already rejects an
     * unassigned coordinator.
     *
     * Keep this defense here so no controller change
     * can accidentally turn the request unrestricted.
     */
    if (
      isHrCoordinator &&
      !coordinatorCompany
    ) {
      return res
        .status(403)
        .json({
          error:
            "HR Coordinator company assignment is required.",
        });
    }

    const view =
      String(
        req.query?.view ||
          ""
      )
        .trim()
        .toLowerCase();

    /*
     * ==================================================
     * PAGINATED SUMMARY VIEW
     * ==================================================
     */
    if (
      view === "summary"
    ) {
      const page =
        toPositiveInteger(
          req.query?.page,
          1
        );

      const requestedPageSize =
        toPositiveInteger(
          req.query?.pageSize,
          DEFAULT_DEPLOYMENT_PAGE_SIZE
        );

      const pageSize =
        Math.min(
          requestedPageSize,
          MAX_DEPLOYMENT_PAGE_SIZE
        );

      const offset =
        (page - 1) *
        pageSize;

      const search =
        normalizeDeploymentSearch(
          req.query?.search
        );

      const requestedStatus =
        normalizeNullableText(
          req.query?.status
        );

      const status =
        requestedStatus
          ? normalizeDeploymentReportStatus(
              requestedStatus
            )
          : null;

      const isAllStatusFilter =
        [
          "all",
          "all statuses",
        ].includes(
          normalizeText(
            requestedStatus
          )
        );

      if (
        requestedStatus &&
        !status &&
        !isAllStatusFilter
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid deployment status filter.",
          });
      }

      const monthValue =
        String(
          req.query?.month ??
            ""
        ).trim();

      let month =
        null;

      if (monthValue) {
        const parsedMonth =
          Number.parseInt(
            monthValue,
            10
          );

        if (
          !Number.isInteger(
            parsedMonth
          ) ||
          parsedMonth < 0 ||
          parsedMonth > 11
        ) {
          return res
            .status(400)
            .json({
              error:
                "Deployment month must be between 0 and 11.",
            });
        }

        month =
          parsedMonth;
      }

      const yearValue =
        String(
          req.query?.year ??
            ""
        ).trim();

      let year =
        null;

      if (yearValue) {
        const parsedYear =
          Number.parseInt(
            yearValue,
            10
          );

        if (
          !Number.isInteger(
            parsedYear
          ) ||
          parsedYear < 1900 ||
          parsedYear > 2100
        ) {
          return res
            .status(400)
            .json({
              error:
                "Invalid deployment year.",
            });
        }

        year =
          parsedYear;
      }

      const {
        whereSql,
        params:
          filterParams,
      } =
        buildDeploymentSummaryFilters({
          search,
          status,
          month,
          year,
          coordinatorCompany,
        });

      /*
       * Data and count queries inherit the exact same
       * authorization filter.
       */
      const dataSql = `
        SELECT
          da.id AS deploymentId,
          da.employee_id AS employeeId,
          e.name AS employee,
          da.company,
          da.position,
          DATE_FORMAT(da.start_date, '%Y-%m-%d') AS startDate,
          DATE_FORMAT(da.end_date, '%Y-%m-%d') AS endDate,
          da.end_reason AS endReason,
          da.end_remarks AS endRemarks,
          da.status AS deploymentStatus,
          da.ended_at AS endedAt,
          da.created_at AS createdAt,
          da.updated_at AS updatedAt,
          e.status AS employeeStatus,
          e.archived

        FROM deployment_assignments AS da

        INNER JOIN employees AS e
          ON e.id =
            da.employee_id

        ${whereSql}

        ORDER BY
          ${getDeploymentEventDateSql(
            "da"
          )} DESC,
          da.id DESC

        LIMIT ${pageSize}
        OFFSET ${offset}
      `;

      const countSql = `
        SELECT
          COUNT(*) AS total

        FROM deployment_assignments AS da

        INNER JOIN employees AS e
          ON e.id =
            da.employee_id

        ${whereSql}
      `;

      /*
       * Summary and year-filter metadata also need
       * company authorization. Otherwise the
       * coordinator could infer statistics belonging
       * to other clients even if table rows are hidden.
       */
      const companyScopeSql =
        isHrCoordinator
          ? `
            AND
            ${buildCoordinatorCompanyCondition(
              "da"
            )}
          `
          : "";

      const companyScopeParams =
        isHrCoordinator
          ? [
              coordinatorCompany,
            ]
          : [];

      const companySummarySql = `
        SELECT
          COALESCE(
            NULLIF(
              TRIM(
                da.company
              ),
              ''
            ),
            '-'
          ) AS company,

          COUNT(*) AS total,

          SUM(
            da.status =
              'Active'
          ) AS deployed,

          SUM(
            da.status =
              'Completed'
          ) AS completed,

          SUM(
            da.status =
              'Cancelled'
            AND LOWER(
              TRIM(
                COALESCE(
                  da.end_reason,
                  ''
                )
              )
            ) = 'resigned'
          ) AS resigned,

          SUM(
            da.status =
              'Cancelled'
            AND LOWER(
              TRIM(
                COALESCE(
                  da.end_reason,
                  ''
                )
              )
            ) = 'terminated'
          ) AS terminated_count,

          SUM(
            da.status =
              'Cancelled'
            AND LOWER(
              TRIM(
                COALESCE(
                  da.end_reason,
                  ''
                )
              )
            ) = 'awol'
          ) AS awol,

          SUM(
            da.status =
              'Cancelled'
            AND LOWER(
              TRIM(
                COALESCE(
                  da.end_reason,
                  ''
                )
              )
            ) NOT IN (
              'resigned',
              'terminated',
              'awol'
            )
          ) AS ended,

          SUM(
            da.status =
              'Cancelled'
          ) AS separated

        FROM deployment_assignments AS da

        INNER JOIN employees AS e
          ON e.id =
            da.employee_id

        WHERE
          (
            e.archived = 0
            OR da.status <> 'Active'
          )

          ${companyScopeSql}

        GROUP BY
          COALESCE(
            NULLIF(
              TRIM(
                da.company
              ),
              ''
            ),
            '-'
          )

        ORDER BY
          total DESC,
          company ASC
      `;

      const yearOptionsSql = `
        SELECT DISTINCT
          YEAR(
            ${getDeploymentEventDateSql(
              "da"
            )}
          ) AS year

        FROM deployment_assignments AS da

        INNER JOIN employees AS e
          ON e.id =
            da.employee_id

        WHERE
          (
            e.archived = 0
            OR da.status <> 'Active'
          )

          AND
          ${getDeploymentEventDateSql(
            "da"
          )}
            IS NOT NULL

          ${companyScopeSql}

        ORDER BY
          year DESC
      `;

      const [
        dataResult,
        countResult,
        companySummaryResult,
        yearOptionsResult,
      ] =
        await Promise.all([
          db
            .promise()
            .query(
              dataSql,
              filterParams
            ),

          db
            .promise()
            .query(
              countSql,
              filterParams
            ),

          db
            .promise()
            .query(
              companySummarySql,
              companyScopeParams
            ),

          db
            .promise()
            .query(
              yearOptionsSql,
              companyScopeParams
            ),
        ]);

      const [rows] =
        dataResult;

      const [[countRow]] =
        countResult;

      const [
        companySummaryRows,
      ] =
        companySummaryResult;

      const [
        yearOptionRows,
      ] =
        yearOptionsResult;

      const total =
        Number(
          countRow?.total ||
            0
        );

      return res.json({
        deployments:
          rows.map(
            mapAssignment
          ),

        pagination: {
          page,
          pageSize,
          total,

          totalPages:
            total > 0
              ? Math.ceil(
                  total /
                    pageSize
                )
              : 0,
        },

        summary:
          buildDeploymentSummary(
            companySummaryRows
          ),

        filterMeta: {
          years:
            yearOptionRows
              .map(
                (row) =>
                  Number(
                    row.year
                  )
              )
              .filter(
                Number.isInteger
              ),
        },

        filters: {
          search,
          status,
          month,
          year,
        },
      });
    }

    /*
     * ==================================================
     * LEGACY/FULL DEPLOYMENT RESPONSE
     * ==================================================
     *
     * Preserve the existing response format while
     * applying company scope for HR Coordinator.
     */
    const companyScopeSql =
      isHrCoordinator
        ? `
          AND
          ${buildCoordinatorCompanyCondition(
            "da"
          )}
          AND
          ${buildCoordinatorCurrentEmployeeCondition(
            "e"
          )}
        `
        : "";

    const companyScopeParams =
      isHrCoordinator
        ? [
            coordinatorCompany,
            coordinatorCompany,
          ]
        : [];

    const [rows] =
      await db
        .promise()
        .query(
          `
          SELECT
            da.id AS deploymentId,
            da.employee_id AS employeeId,
            e.name AS employee,
            da.company,
            da.position,
            DATE_FORMAT(da.start_date, '%Y-%m-%d') AS startDate,
            DATE_FORMAT(da.end_date, '%Y-%m-%d') AS endDate,
            da.end_reason AS endReason,
            da.end_remarks AS endRemarks,
            da.status AS deploymentStatus,
            da.ended_at AS endedAt,
            da.created_at AS createdAt,
            da.updated_at AS updatedAt,
            e.status AS employeeStatus,
            e.archived

          FROM deployment_assignments AS da

          INNER JOIN employees AS e
            ON e.id =
              da.employee_id

          WHERE
            e.archived = 0

            ${companyScopeSql}

          ORDER BY
            da.start_date DESC,
            da.id DESC
          `,
          companyScopeParams
        );

    return res.json(
      rows.map(
        mapAssignment
      )
    );
  } catch (err) {
    console.error(
      "GET DEPLOYMENTS ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Failed to fetch deployments",
      });
  }
};

/*
 * ==================================================
 * GET DEPLOYMENT PDF REPORT DATA
 * ==================================================
 *
 * This endpoint returns the complete filtered dataset
 * for PDF generation.
 *
 * HR Coordinator:
 * - scope is locked to the authenticated assigned
 *   company
 * - historical completed/separation rows for that
 *   company remain reportable
 * - request query values cannot override company scope
 *
 * Reporting period:
 * - Deployed uses deployment start_date
 * - Completed / Resigned / Terminated / AWOL / Ended
 *   use end_date, then ended_at, then start_date as a
 *   safe legacy fallback
 */
exports.getDeploymentReport =
  async (
    req,
    res
  ) => {
    if (
      !canExportDeploymentReport(
        req
      )
    ) {
      return res
        .status(403)
        .json({
          error:
            "You are not allowed to export deployment reports.",
        });
    }

    try {
      const role =
        normalizeRole(
          req?.user?.role
        );

      const isHrCoordinator =
        role ===
        "HR_COORDINATOR";

      const coordinatorCompany =
        isHrCoordinator
          ? getHrCoordinatorAssignedCompany(
              req
            )
          : null;

      if (
        isHrCoordinator &&
        !coordinatorCompany
      ) {
        return res
          .status(403)
          .json({
            error:
              "HR Coordinator company assignment is required.",
          });
      }

      const search =
        normalizeDeploymentSearch(
          req.query?.search
        );

      const requestedStatus =
        normalizeNullableText(
          req.query?.status
        );

      const status =
        requestedStatus
          ? normalizeDeploymentReportStatus(
              requestedStatus
            )
          : null;

      const isAllStatusFilter =
        [
          "all",
          "all statuses",
        ].includes(
          normalizeText(
            requestedStatus
          )
        );

      if (
        requestedStatus &&
        !status &&
        !isAllStatusFilter
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid deployment status filter.",
          });
      }

      const monthValue =
        String(
          req.query?.month ??
            ""
        ).trim();

      let month =
        null;

      if (monthValue) {
        const parsedMonth =
          Number.parseInt(
            monthValue,
            10
          );

        if (
          !Number.isInteger(
            parsedMonth
          ) ||
          parsedMonth < 0 ||
          parsedMonth > 11
        ) {
          return res
            .status(400)
            .json({
              error:
                "Deployment month must be between 0 and 11.",
            });
        }

        month =
          parsedMonth;
      }

      const yearValue =
        String(
          req.query?.year ??
            ""
        ).trim();

      let year =
        null;

      if (yearValue) {
        const parsedYear =
          Number.parseInt(
            yearValue,
            10
          );

        if (
          !Number.isInteger(
            parsedYear
          ) ||
          parsedYear < 1900 ||
          parsedYear > 2100
        ) {
          return res
            .status(400)
            .json({
              error:
                "Invalid deployment year.",
            });
        }

        year =
          parsedYear;
      }

      const {
        whereSql,
        params,
      } =
        buildDeploymentSummaryFilters({
          search,
          status,
          month,
          year,
          coordinatorCompany,
        });

      const [rows] =
        await db
          .promise()
          .query(
            `
            SELECT
              da.id AS deploymentId,
              da.employee_id AS employeeId,
              e.name AS employee,
              da.company,
              da.position,
              DATE_FORMAT(da.start_date, '%Y-%m-%d') AS startDate,
              DATE_FORMAT(da.end_date, '%Y-%m-%d') AS endDate,
              da.end_reason AS endReason,
              da.end_remarks AS endRemarks,
              da.status AS deploymentStatus,
              da.ended_at AS endedAt,
              da.created_at AS createdAt,
              da.updated_at AS updatedAt,
              e.status AS employeeStatus,
              e.archived

            FROM deployment_assignments AS da

            INNER JOIN employees AS e
              ON e.id =
                da.employee_id

            ${whereSql}

            ORDER BY
              ${getDeploymentEventDateSql(
                "da"
              )} DESC,
              da.id DESC
            `,
            params
          );

      const deployments =
        rows.map(
          mapAssignment
        );

      return res.json({
        deployments,

        total:
          deployments.length,

        summary:
          buildDeploymentReportSummary(
            deployments
          ),

        scope: {
          role,

          company:
            coordinatorCompany ||
            null,
        },

        filters: {
          search,
          status,
          month,
          year,
        },

        generatedAt:
          new Date()
            .toISOString(),
      });
    } catch (error) {
      console.error(
        "GET DEPLOYMENT REPORT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to generate deployment report data.",
        });
    }
  };

/*
 * ==================================================
 * UPDATE DEPLOYMENT STATUS
 * ==================================================
 *
 * HR Coordinator is read-only.
 *
 * Route middleware already blocks this mutation,
 * but the controller independently enforces the
 * restriction as defense in depth.
 */
exports.updateDeploymentStatus =
  async (
    req,
    res
  ) => {
    /*
     * Defense in depth:
     *
     * Only HR Manager and HR Staff may mutate
     * deployment state.
     *
     * Super Admin and HR Coordinator remain
     * read-only.
     */
    if (
      !canMutateDeployments(
        req
      )
    ) {
      return res
        .status(403)
        .json({
          error:
            "Only HR Manager and HR Staff may update deployment status.",
        });
    }

    const {
      deploymentId,
    } =
      req.params;

    const {
      status,
      endReason,
      endRemarks,
    } =
      req.body || {};

    const normalizedDeploymentId =
      String(
        deploymentId ??
        ""
      ).trim();

    if (
      !/^[1-9]\d*$/.test(
        normalizedDeploymentId
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Deployment ID must be a positive integer.",
        });
    }

    const canonicalDeploymentId =
      Number(
        normalizedDeploymentId
      );

    if (
      !Number.isSafeInteger(
        canonicalDeploymentId
      ) ||
      canonicalDeploymentId <= 0
    ) {
      return res
        .status(400)
        .json({
          error:
            "Deployment ID must be a valid positive integer.",
        });
    }

    if (
      ![
        "Completed",
        LEGACY_SEPARATION_DEPLOYMENT_STATUS,
      ].includes(
        status
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Deployment update must be either Completed or an employee separation.",
        });
    }

    const requestedReason =
      normalizeNullableText(
        endReason
      );

    let finalReason =
      requestedReason;

    if (
      status ===
      "Completed"
    ) {
      finalReason =
        requestedReason ||
        "Completed Contract";

      if (
        !COMPLETED_REASONS.has(
          finalReason
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid completed deployment reason.",
          });
      }
    }

    if (
      isLegacySeparationDeploymentStatus(
        status
      )
    ) {
      if (
        !finalReason ||
        !SEPARATION_REASONS.has(
          finalReason
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Employee separation requires a reason of Resigned, AWOL, or Terminated.",
          });
      }
    }

    const finalRemarks =
      normalizeNullableText(
        endRemarks
      );

    const employeeStatus =
      getEmployeeStatus(
        status
      );

    const actor =
      getActor(
        req
      );

    const actorUserId =
      actor.userId;

    let connection =
      null;

    let transactionStarted =
      false;

    try {
      connection =
        await db
          .promise()
          .getConnection();

      await connection
        .beginTransaction();

      transactionStarted =
        true;

      /*
       * Resolve target employee.
       */
      const [
        assignmentLookup,
      ] =
        await connection.query(
          `
          SELECT
            employee_id

          FROM
            deployment_assignments

          WHERE
            id = ?

          LIMIT 1
          `,
          [
            canonicalDeploymentId,
          ]
        );

      if (
        assignmentLookup.length ===
        0
      ) {
        await connection
          .rollback();

        transactionStarted =
          false;

        return res
          .status(404)
          .json({
            error:
              "Deployment assignment not found.",
          });
      }

      const employeeId =
        assignmentLookup[
          0
        ].employee_id;

      /*
       * Lock employee lifecycle row.
       */
      const [
        employeeRows,
      ] =
        await connection.query(
          `
          SELECT
            id,
            name,
            status,
            archived

          FROM employees

          WHERE
            id = ?

          LIMIT 1

          FOR UPDATE
          `,
          [
            employeeId,
          ]
        );

      if (
        employeeRows.length ===
        0
      ) {
        await connection
          .rollback();

        transactionStarted =
          false;

        return res
          .status(404)
          .json({
            error:
              "Employee not found.",
          });
      }

      const employee =
        employeeRows[0];

      if (
        Number(
          employee.archived ||
            0
        ) === 1
      ) {
        await connection
          .rollback();

        transactionStarted =
          false;

        return res
          .status(409)
          .json({
            error:
              "Archived employees cannot have their deployment status updated.",
          });
      }

      if (
        !isCurrentlyDeployedEmployee(
          employee
        )
      ) {
        await connection
          .rollback();

        transactionStarted =
          false;

        return res
          .status(409)
          .json({
            error:
              "Only a currently deployed employee can have an active deployment ended.",
          });
      }

      /*
       * Lock exact deployment assignment.
       */
      const [
        assignmentRows,
      ] =
        await connection.query(
          `
          SELECT
            id,
            employee_id,
            company,
            start_date,
            status

          FROM
            deployment_assignments

          WHERE
            id = ?

            AND
            employee_id = ?

          LIMIT 1

          FOR UPDATE
          `,
          [
            canonicalDeploymentId,
            employeeId,
          ]
        );

      if (
        assignmentRows.length ===
        0
      ) {
        await connection
          .rollback();

        transactionStarted =
          false;

        return res
          .status(404)
          .json({
            error:
              "Deployment assignment not found.",
          });
      }

      const activeAssignment =
        assignmentRows[0];

      if (
        activeAssignment.status !==
        "Active"
      ) {
        await connection
          .rollback();

        transactionStarted =
          false;

        return res
          .status(409)
          .json({
            error:
              "Only an active deployment assignment can be completed or ended through employee separation.",
          });
      }

      /*
       * Validate one-active-assignment invariant.
       */
      const [
        activeAssignments,
      ] =
        await connection.query(
          `
          SELECT
            id

          FROM
            deployment_assignments

          WHERE
            employee_id = ?

            AND
            status = 'Active'

          ORDER BY
            id ASC

          LIMIT 2

          FOR UPDATE
          `,
          [
            employeeId,
          ]
        );

      if (
        activeAssignments.length !==
          1 ||
        Number(
          activeAssignments[
            0
          ]?.id
        ) !==
          canonicalDeploymentId
      ) {
        await connection
          .rollback();

        transactionStarted =
          false;

        return res
          .status(409)
          .json({
            error:
              "Deployment assignment integrity conflict detected for this employee.",
          });
      }

      /*
       * End deployment assignment.
       */
      const [
        deploymentUpdateResult,
      ] =
        await connection.query(
          `
          UPDATE
            deployment_assignments

          SET
            end_date =
              ${MANILA_CURRENT_DATE_SQL},

            end_reason = ?,

            end_remarks = ?,

            status = ?,

            ended_at =
              UTC_TIMESTAMP()

          WHERE
            id = ?

            AND
            status = 'Active'
          `,
          [
            finalReason,
            finalRemarks,
            status,
            canonicalDeploymentId,
          ]
        );

      if (
        Number(
          deploymentUpdateResult.affectedRows ||
          0
        ) !== 1
      ) {
        throw new Error(
          "Deployment assignment changed before the status update could be completed."
        );
      }

      /*
       * Synchronize employee lifecycle status.
       */
      const [
        employeeUpdateResult,
      ] =
        await connection.query(
          `
          UPDATE
            employees

          SET
            status = ?,

            contractEnd =
              ${MANILA_CURRENT_DATE_SQL},

            contractEndReason = ?,

            contractEndRemarks = ?,

            contractEndedAt =
              UTC_TIMESTAMP()

          WHERE
            id = ?
          `,
          [
            employeeStatus,
            finalReason,
            finalRemarks,
            employeeId,
          ]
        );

      if (
        Number(
          employeeUpdateResult.affectedRows ||
          0
        ) !== 1
      ) {
        throw new Error(
          "Employee lifecycle state changed before the deployment update could be completed."
        );
      }

      /*
       * Preserve lifecycle history.
       */
      await connection.query(
        `
        INSERT INTO
          employee_status_history
        (
          employee_id,
          from_status,
          to_status,
          effective_at,
          reason,
          remarks,
          source_event,
          changed_by_user_id
        )
        VALUES
        (
          ?,
          ?,
          ?,
          UTC_TIMESTAMP(),
          ?,
          ?,
          'DEPLOYMENT_STATUS_UPDATED',
          ?
        )
        `,
        [
          employeeId,
          employee.status,
          employeeStatus,
          finalReason,
          finalRemarks,
          actorUserId,
        ]
      );

      const deploymentDisplayStatus =
        getDeploymentDisplayStatus(
          status,
          finalReason,
          finalRemarks
        );

      /*
       * Audit must succeed within the same
       * transaction before commit.
       */
      const remarksAuditText =
        finalRemarks
          ? ` Remarks: ${finalRemarks}.`
          : "";

      await logAudit(
        {
          userId:
            actor.userId,

          username:
            actor.username,

          fullName:
            actor.fullName,

          role:
            actor.role,

          category:
            AUDIT_CATEGORY.OPERATIONAL,

          action:
            "DEPLOYMENT_STATUS_UPDATED",

          description:
            `${actor.fullName} updated deployment #${canonicalDeploymentId} for ` +
            `${employee.name} (Employee #${employeeId}, ` +
            `${activeAssignment.company || "Unknown Company"}) from ` +
            `${activeAssignment.status} to ${deploymentDisplayStatus}. Employee status changed ` +
            `from ${employee.status} to ${employeeStatus}. Reason: ` +
            `${finalReason}.${remarksAuditText}`,
        },
        {
          connection,

          throwOnError:
            true,
        }
      );

      await connection
        .commit();

      transactionStarted =
        false;

      return res.json({
        success:
          true,

        message:
          isLegacySeparationDeploymentStatus(
            status
          )
            ? "Employee separation recorded successfully."
            : "Deployment marked as completed successfully.",

        deploymentId:
          canonicalDeploymentId,

        assignmentId:
          canonicalDeploymentId,

        employeeId,

        company:
          activeAssignment.company,

        /*
         * deploymentStatus remains the backward-compatible internal
         * lifecycle value. deploymentDisplayStatus is safe for UI.
         */
        deploymentStatus:
          status,

        deploymentDisplayStatus,

        employeeStatus,

        endReason:
          finalReason,

        endRemarks:
          finalRemarks,
      });
    } catch (err) {
      if (
        connection &&
        transactionStarted
      ) {
        try {
          await connection
            .rollback();
        } catch (
          rollbackError
        ) {
          console.error(
            "UPDATE DEPLOYMENT STATUS ROLLBACK ERROR:",
            rollbackError
          );
        }
      }

      console.error(
        "UPDATE DEPLOYMENT STATUS ERROR:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to update deployment status",
        });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  };