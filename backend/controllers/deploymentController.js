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

const CANCELLED_REASONS = new Set([
  "Resigned",
  "AWOL",
  "Terminated",
]);

const DEPLOYMENT_OPTION_ROLES = new Set([
  "HR_MANAGER",
  "HR_STAFF",
]);

const DEFAULT_DEPLOYMENT_PAGE_SIZE = 50;
const MAX_DEPLOYMENT_PAGE_SIZE = 100;

function normalizeDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return date
    .toISOString()
    .slice(0, 10);
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
  return deploymentStatus ===
    "Cancelled"
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

    status:
      row.deploymentStatus ||
      "Active",

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

    endReason:
      row.endReason || "",

    endRemarks:
      row.endRemarks || "",

    contractEndedAt:
      row.endedAt || null,

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

function buildDeploymentSummaryFilters({
  search,
  month,
  year,
  coordinatorCompany = null,
}) {
  const where = [
    "e.archived = 0",
  ];

  const params = [];

  /*
   * HR Coordinator company filtering is based only
   * on the authenticated server-side company scope.
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
      ...locationCompanies
    );
  }

  if (
    month !== null
  ) {
    where.push(
      "MONTH(da.start_date) = ?"
    );

    params.push(
      month + 1
    );
  }

  if (
    year !== null
  ) {
    where.push(
      "YEAR(da.start_date) = ?"
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
      (row) => ({
        company:
          row.company ||
          "-",

        total:
          Number(
            row.total ||
              0
          ),

        active:
          Number(
            row.active ||
              0
          ),

        completed:
          Number(
            row.completed ||
              0
          ),

        cancelled:
          Number(
            row.cancelled ||
              0
          ),
      })
    );

  const totals =
    companies.reduce(
      (
        summary,
        company
      ) => {
        summary.totalDeployments +=
          company.total;

        summary.activeDeployments +=
          company.active;

        summary.completedDeployments +=
          company.completed;

        summary.cancelledDeployments +=
          company.cancelled;

        return summary;
      },
      {
        totalDeployments:
          0,

        activeDeployments:
          0,

        completedDeployments:
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

    activeDeployments:
      totals.activeDeployments,

    completedDeployments:
      totals.completedDeployments,

    cancelledDeployments:
      totals.cancelledDeployments,

    topCompany:
      companies[0] ||
      null,
  };
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
          da.start_date AS startDate,
          da.end_date AS endDate,
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
          da.start_date DESC,
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
          ) AS active,

          SUM(
            da.status =
              'Completed'
          ) AS completed,

          SUM(
            da.status =
              'Cancelled'
          ) AS cancelled

        FROM deployment_assignments AS da

        INNER JOIN employees AS e
          ON e.id =
            da.employee_id

        WHERE
          e.archived = 0

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
            da.start_date
          ) AS year

        FROM deployment_assignments AS da

        INNER JOIN employees AS e
          ON e.id =
            da.employee_id

        WHERE
          e.archived = 0

          AND
          da.start_date
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
        `
        : "";

    const companyScopeParams =
      isHrCoordinator
        ? [
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
            da.start_date AS startDate,
            da.end_date AS endDate,
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
    if (
      isHrCoordinatorRequest(
        req
      )
    ) {
      return res
        .status(403)
        .json({
          error:
            "HR Coordinator accounts have read-only deployment access.",
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

    if (!deploymentId) {
      return res
        .status(400)
        .json({
          error:
            "Deployment ID is required.",
        });
    }

    if (
      ![
        "Completed",
        "Cancelled",
      ].includes(
        status
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Deployment status must be Completed or Cancelled.",
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
      status ===
      "Cancelled"
    ) {
      if (
        !finalReason ||
        !CANCELLED_REASONS.has(
          finalReason
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Cancelled deployments require Resigned, AWOL, or Terminated.",
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
            deploymentId,
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
            deploymentId,
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
              "Only an active deployment assignment can be completed or cancelled.",
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
          Number(
            deploymentId
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
              "Deployment assignment integrity conflict detected for this employee.",
          });
      }

      /*
       * End deployment assignment.
       */
      await connection.query(
        `
        UPDATE
          deployment_assignments

        SET
          end_date =
            CURDATE(),

          end_reason = ?,

          end_remarks = ?,

          status = ?,

          ended_at =
            NOW()

        WHERE
          id = ?

          AND
          status = 'Active'
        `,
        [
          finalReason,
          finalRemarks,
          status,
          deploymentId,
        ]
      );

      /*
       * Synchronize employee lifecycle status.
       */
      await connection.query(
        `
        UPDATE
          employees

        SET
          status = ?,

          contractEnd =
            CURDATE(),

          contractEndReason = ?,

          contractEndRemarks = ?,

          contractEndedAt =
            NOW()

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
          'Deployed',
          ?,
          NOW(),
          ?,
          ?,
          'DEPLOYMENT_STATUS_UPDATED',
          ?
        )
        `,
        [
          employeeId,
          employeeStatus,
          finalReason,
          finalRemarks,
          actorUserId,
        ]
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
            `${actor.fullName} updated deployment #${deploymentId} for ` +
            `${employee.name} (Employee #${employeeId}, ` +
            `${activeAssignment.company || "Unknown Company"}) from ` +
            `${activeAssignment.status} to ${status}. Employee status changed ` +
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
          status ===
          "Cancelled"
            ? "Deployment cancelled successfully."
            : "Deployment marked as completed successfully.",

        deploymentId:
          Number(
            deploymentId
          ),

        assignmentId:
          Number(
            deploymentId
          ),

        employeeId,

        company:
          activeAssignment.company,

        deploymentStatus:
          status,

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