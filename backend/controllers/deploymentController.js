const db = require("../config/db");

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

function normalizeDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeNullableText(value) {
  const normalized = String(
    value || ""
  ).trim();

  return normalized || null;
}

function isCurrentlyDeployedEmployee(
  employee
) {
  return [
    "deployed",
    "active deployed",
  ].includes(
    normalizeText(employee?.status)
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
      row.employeeStatus || "",

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

const DEFAULT_DEPLOYMENT_PAGE_SIZE =
  50;

const MAX_DEPLOYMENT_PAGE_SIZE =
  100;

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
}) {
  const where = [
    "e.archived = 0",
  ];

  const params = [];

  const searchTerms =
    normalizeDeploymentSearch(
      search
    )
      .toLowerCase()
      .split(
        /\s+/
      )
      .filter(
        Boolean
      );

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
          (
            [
              ,
              location,
            ]
          ) =>
            normalizeText(
              location
            ).includes(
              term
            )
        )
        .map(
          (
            [
              company,
            ]
          ) =>
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
        CAST(da.id AS CHAR) LIKE ?
        OR CAST(da.employee_id AS CHAR) LIKE ?
        OR LOWER(COALESCE(e.name, '')) LIKE ?
        OR LOWER(COALESCE(da.company, '')) LIKE ?
        OR LOWER(COALESCE(da.position, '')) LIKE ?
        OR LOWER(COALESCE(da.status, '')) LIKE ?
        OR LOWER(COALESCE(da.end_reason, '')) LIKE ?
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

exports.getDeployments = async (
  req,
  res
) => {
  try {
    const view =
      String(
        req.query?.view ||
          ""
      )
        .trim()
        .toLowerCase();

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
        });

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
          ON e.id = da.employee_id
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
          ON e.id = da.employee_id
        ${whereSql}
      `;

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
            da.status = 'Active'
          ) AS active,
          SUM(
            da.status = 'Completed'
          ) AS completed,
          SUM(
            da.status = 'Cancelled'
          ) AS cancelled
        FROM deployment_assignments AS da
        INNER JOIN employees AS e
          ON e.id = da.employee_id
        WHERE e.archived = 0
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
          ON e.id = da.employee_id
        WHERE e.archived = 0
          AND da.start_date IS NOT NULL
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
          db.promise().query(
            dataSql,
            filterParams
          ),

          db.promise().query(
            countSql,
            filterParams
          ),

          db.promise().query(
            companySummarySql
          ),

          db.promise().query(
            yearOptionsSql
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

    const [rows] =
      await db.promise().query(
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
          ON e.id = da.employee_id
        WHERE e.archived = 0
        ORDER BY
          da.start_date DESC,
          da.id DESC
        `
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

    return res.status(500).json({
      error:
        "Failed to fetch deployments",
    });
  }
};

exports.updateDeploymentStatus = async (
  req,
  res
) => {
  const {
    deploymentId,
  } = req.params;

  const {
    status,
    endReason,
    endRemarks,
  } = req.body || {};

  if (!deploymentId) {
    return res.status(400).json({
      error:
        "Deployment ID is required.",
    });
  }

  if (
    ![
      "Completed",
      "Cancelled",
    ].includes(status)
  ) {
    return res.status(400).json({
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

  if (status === "Completed") {
    finalReason =
      requestedReason ||
      "Completed Contract";

    if (
      !COMPLETED_REASONS.has(
        finalReason
      )
    ) {
      return res.status(400).json({
        error:
          "Invalid completed deployment reason.",
      });
    }
  }

  if (status === "Cancelled") {
    if (
      !finalReason ||
      !CANCELLED_REASONS.has(
        finalReason
      )
    ) {
      return res.status(400).json({
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
    getEmployeeStatus(status);

  const actorUserId =
    getActorUserId(req);

  let connection = null;
  let transactionStarted =
    false;

  try {
    connection =
      await db
        .promise()
        .getConnection();

    await connection.beginTransaction();

    transactionStarted = true;

    const [assignmentLookup] =
      await connection.query(
        `
        SELECT
          employee_id
        FROM deployment_assignments
        WHERE id = ?
        LIMIT 1
        `,
        [
          deploymentId,
        ]
      );

    if (
      assignmentLookup.length === 0
    ) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        error:
          "Deployment assignment not found.",
      });
    }

    const employeeId =
      assignmentLookup[0]
        .employee_id;

    const [employeeRows] =
      await connection.query(
        `
        SELECT
          id,
          name,
          status,
          archived
        FROM employees
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          employeeId,
        ]
      );

    if (
      employeeRows.length === 0
    ) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
        error:
          "Employee not found.",
      });
    }

    const employee =
      employeeRows[0];

    if (
      Number(
        employee.archived || 0
      ) === 1
    ) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        error:
          "Archived employees cannot have their deployment status updated.",
      });
    }

    if (
      !isCurrentlyDeployedEmployee(
        employee
      )
    ) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        error:
          "Only a currently deployed employee can have an active deployment ended.",
      });
    }

    const [assignmentRows] =
      await connection.query(
        `
        SELECT
          id,
          employee_id,
          company,
          start_date,
          status
        FROM deployment_assignments
        WHERE id = ?
          AND employee_id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          deploymentId,
          employeeId,
        ]
      );

    if (
      assignmentRows.length === 0
    ) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(404).json({
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
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        error:
          "Only an active deployment assignment can be completed or cancelled.",
      });
    }

    const [activeAssignments] =
      await connection.query(
        `
        SELECT id
        FROM deployment_assignments
        WHERE employee_id = ?
          AND status = 'Active'
        ORDER BY id ASC
        LIMIT 2
        FOR UPDATE
        `,
        [
          employeeId,
        ]
      );

    if (
      activeAssignments.length !== 1 ||
      Number(
        activeAssignments[0]?.id
      ) !==
        Number(deploymentId)
    ) {
      await connection.rollback();
      transactionStarted = false;

      return res.status(409).json({
        error:
          "Deployment assignment integrity conflict detected for this employee.",
      });
    }

    await connection.query(
      `
      UPDATE deployment_assignments
      SET
        end_date = CURDATE(),
        end_reason = ?,
        end_remarks = ?,
        status = ?,
        ended_at = NOW()
      WHERE id = ?
        AND status = 'Active'
      `,
      [
        finalReason,
        finalRemarks,
        status,
        deploymentId,
      ]
    );

    await connection.query(
      `
      UPDATE employees
      SET
        status = ?,
        contractEnd = CURDATE(),
        contractEndReason = ?,
        contractEndRemarks = ?,
        contractEndedAt = NOW()
      WHERE id = ?
      `,
      [
        employeeStatus,
        finalReason,
        finalRemarks,
        employeeId,
      ]
    );

    await connection.query(
      `
      INSERT INTO employee_status_history
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
      VALUES (
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

    await connection.commit();

    transactionStarted = false;

    return res.json({
      success: true,

      message:
        status ===
        "Cancelled"
          ? "Deployment cancelled successfully."
          : "Deployment marked as completed successfully.",

      deploymentId:
        Number(deploymentId),

      assignmentId:
        Number(deploymentId),

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
        await connection.rollback();
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

    return res.status(500).json({
      error:
        "Failed to update deployment status",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};