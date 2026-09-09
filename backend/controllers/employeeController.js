const fs = require("fs");

const db = require("../config/db");

const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

const {
  cleanupUnreferencedFileCandidates,
} = require("../utils/fileReferenceService");

function toNullable(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const trimmed =
    String(value).trim();

  return trimmed === ""
    ? null
    : trimmed;
}

function toNullableDate(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const trimmed =
    String(value).trim();

  if (!trimmed) {
    return null;
  }

  const date =
    new Date(trimmed);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return trimmed.slice(
    0,
    10
  );
}

const EMPLOYEE_STATUS =
  Object.freeze({
    DEPLOYED:
      "Deployed",

    FLOATING_STANDBY:
      "Floating / Standby",

    INACTIVE:
      "Inactive",
  });

const EDITABLE_EMPLOYEE_STATUSES =
  new Set([
    EMPLOYEE_STATUS.DEPLOYED,
    EMPLOYEE_STATUS.FLOATING_STANDBY,
  ]);

const EMPLOYEE_STATUS_ALIASES =
  Object.freeze({
    deployed:
      EMPLOYEE_STATUS.DEPLOYED,

    "active deployed":
      EMPLOYEE_STATUS.DEPLOYED,

    floating:
      EMPLOYEE_STATUS.FLOATING_STANDBY,

    standby:
      EMPLOYEE_STATUS.FLOATING_STANDBY,

    "floating / standby":
      EMPLOYEE_STATUS.FLOATING_STANDBY,

    "floating/standby":
      EMPLOYEE_STATUS.FLOATING_STANDBY,

    inactive:
      EMPLOYEE_STATUS.INACTIVE,
  });

function normalizeEmployeeStatus(
  value
) {
  const normalized =
    toNullable(value);

  if (!normalized) {
    return null;
  }

  return (
    EMPLOYEE_STATUS_ALIASES[
      normalized.toLowerCase()
    ] || null
  );
}

function resolveEditableEmployeeStatus(
  value
) {
  const normalized =
    normalizeEmployeeStatus(
      value
    );

  if (
    !normalized ||
    !EDITABLE_EMPLOYEE_STATUSES.has(
      normalized
    )
  ) {
    return null;
  }

  return normalized;
}

/*
 * TRUSTED AUDIT ACTOR
 *
 * Actor identity comes only from req.user,
 * which is populated by verified JWT middleware.
 *
 * Client-supplied identity or role fields are
 * never authoritative for audit attribution.
 */
function getActor(req) {
  const authenticatedUser =
    req.user || {};

  const userId =
    authenticatedUser.userId ??
    authenticatedUser.id;

  const username =
    toNullable(
      authenticatedUser.username
    ) || "Unknown User";

  return {
    userId:
      toNullable(userId),

    username,

    fullName:
      username,

    role:
      toNullable(
        authenticatedUser.role
      ),
  };
}

/*
 * UPLOADED-FILE COMPENSATION
 *
 * Multer saves files before the controller runs.
 *
 * If employee validation fails before a transaction
 * begins, or if a create/update DB transaction
 * fails and rolls back successfully, remove only
 * files uploaded by that failed request.
 *
 * Pre-existing employee files are intentionally
 * never deleted by this helper.
 */
async function cleanupUploadedFiles(
  files
) {
  const uploadedFiles =
    Array.isArray(files)
      ? files
      : [];

  for (
    const file of uploadedFiles
  ) {
    const filePath =
      toNullable(
        file?.path
      );

    if (!filePath) {
      continue;
    }

    try {
      await fs.promises.unlink(
        filePath
      );
    } catch (error) {
      /*
       * ENOENT means the target is already absent,
       * which is already the desired compensated
       * state.
       */
      if (
        error?.code !==
        "ENOENT"
      ) {
        console.error(
          "EMPLOYEE FILE CLEANUP ERROR:",
          {
            filePath,

            message:
              error?.message ||
              error,
          }
        );
      }
    }
  }
}

/*
 * POST-COMMIT HISTORICAL FILE CLEANUP
 *
 * Historical/pre-existing files must only be
 * considered for physical deletion after the
 * database mutation has committed.
 *
 * Any cleanup failure is intentionally isolated
 * from the already committed employee operation.
 * The reference-aware service itself fails closed,
 * but this wrapper prevents an unexpected cleanup
 * exception from turning a successful DB mutation
 * into an HTTP 500 response.
 */
async function cleanupHistoricalFileCandidates(
  candidates,
  source
) {
  try {
    await cleanupUnreferencedFileCandidates(
      candidates,
      {
        source,
      }
    );
  } catch (error) {
    console.error(
      "EMPLOYEE HISTORICAL FILE CLEANUP ERROR:",
      {
        source,

        message:
          error?.message ||
          error,
      }
    );
  }
}

/*
 * EARLY EMPLOYEE VALIDATION REJECTION
 *
 * Employee document uploads are processed before
 * the controller executes.
 *
 * If normal employee-field validation fails before
 * a DB transaction begins, compensate by deleting
 * only the files uploaded by the current request
 * before returning HTTP 400.
 */
async function rejectEmployeeRequest(
  req,
  res,
  message
) {
  await cleanupUploadedFiles(
    req.files
  );

  return res
    .status(400)
    .json({
      error:
        message,
    });
}

async function getEmployeeNameById(id) {
  const [rows] = await db
    .promise()
    .query(
      `
      SELECT name
      FROM employees
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

  if (rows.length === 0) {
    return null;
  }

  return (
    rows[0]?.name ||
    "Unknown Employee"
  );
}

const extractDocumentsFromReq = (
  req
) => {
  const documents = [];

  for (
    let i = 0;
    i < 20;
    i++
  ) {
    let docName = null;
    let expDate = null;

    if (
      req.body.documents &&
      req.body.documents[i]
    ) {
      docName =
        req.body.documents[
          i
        ].name;

      expDate =
        req.body.documents[
          i
        ].expirationDate;
    } else if (
      req.body[
        `documents[${i}][name]`
      ] !== undefined
    ) {
      docName =
        req.body[
          `documents[${i}][name]`
        ];

      expDate =
        req.body[
          `documents[${i}][expirationDate]`
        ];
    }

    const file =
      req.files?.find(
        (item) =>
          item.fieldname ===
          `documents[${i}]`
      );

    const filePath =
      file
        ? `documents/employees/${file.filename}`
        : null;

    if (
      docName ||
      file
    ) {
      documents.push({
        name:
          toNullable(
            docName
          ) ||
          (
            file
              ? file.originalname
              : "Unknown"
          ),

        expirationDate:
          toNullableDate(
            expDate
          ),

        filePath,

        hasNewFile:
          Boolean(file),
      });
    }
  }

  return documents;
};

/*
 * ==================================================
 * CREATE EMPLOYEE
 * PHASE 8A — TRANSACTION SAFE
 * ==================================================
 *
 * Atomic DB unit:
 *
 * employees INSERT
 * +
 * employee_documents INSERT(s)
 *
 * On validation failure:
 * remove newly uploaded request files
 * +
 * return HTTP 400
 *
 * On DB failure:
 * ROLLBACK
 * +
 * remove only newly uploaded request files
 */
exports.createEmployee = async (
  req,
  res
) => {
  let connection = null;

  let transactionStarted =
    false;

  let transactionCommitted =
    false;

  try {
    const {
      name,
      company,
      status,
      contractStart,
    } = req.body;

    const actor =
      getActor(req);

    const finalName =
      toNullable(name);

    const submittedStatus =
      toNullable(status);

    const finalStatus =
      submittedStatus
        ? resolveEditableEmployeeStatus(
            submittedStatus
          )
        : EMPLOYEE_STATUS.DEPLOYED;

    if (!finalStatus) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Employee status must be either Deployed or Floating / Standby."
      );
    }

    const finalCompany =
      finalStatus ===
      EMPLOYEE_STATUS.DEPLOYED
        ? toNullable(
            company
          )
        : null;

    const submittedContractStart =
      toNullableDate(
        contractStart
      );

    const finalContractStart =
      finalStatus ===
      EMPLOYEE_STATUS.DEPLOYED
        ? submittedContractStart
        : null;

    if (!finalName) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Employee name is required."
      );
    }

    if (
      finalStatus ===
        EMPLOYEE_STATUS.DEPLOYED &&
      !finalCompany
    ) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Company is required for deployed employees."
      );
    }

    if (
      finalStatus ===
        EMPLOYEE_STATUS.DEPLOYED &&
      !finalContractStart
    ) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Deployment start date is required for deployed employees."
      );
    }

    const documents =
      extractDocumentsFromReq(
        req
      );

    connection =
      await db
        .promise()
        .getConnection();

    await connection
      .beginTransaction();

    transactionStarted =
      true;

    const [result] =
      await connection.query(
        `
        INSERT INTO employees
        (
          name,
          company,
          status,
          contractStart
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          finalName,
          finalCompany,
          finalStatus,
          finalContractStart,
        ]
      );

    const employeeId =
      result.insertId;

    /*
     * Initial workforce status is preserved as
     * effective-dated employee history.
     *
     * For deployed employees, the effective date
     * is the deployment start date entered by HR.
     * For an initially floating/standby employee,
     * the record-creation time becomes the initial
     * status effective time.
     */
    await connection.query(
      `
      INSERT INTO employee_status_history
      (
        employee_id,
        from_status,
        to_status,
        effective_at,
        reason,
        source_event,
        changed_by_user_id
      )
      VALUES (
        ?,
        NULL,
        ?,
        COALESCE(?, NOW()),
        ?,
        ?,
        ?
      )
      `,
      [
        employeeId,
        finalStatus,
        finalContractStart
          ? `${finalContractStart} 00:00:00`
          : null,
        "Initial employee record",
        "EMPLOYEE_CREATED",
        actor.userId,
      ]
    );

    /*
     * A deployed employee must also have one
     * authoritative active assignment row.
     *
     * Floating / Standby employees intentionally
     * receive no fabricated deployment assignment.
     */
    if (
      finalStatus ===
      EMPLOYEE_STATUS.DEPLOYED
    ) {
      await connection.query(
        `
        INSERT INTO deployment_assignments
        (
          employee_id,
          company,
          position,
          start_date,
          status,
          created_by_user_id
        )
        VALUES (?, ?, NULL, ?, 'Active', ?)
        `,
        [
          employeeId,
          finalCompany,
          finalContractStart,
          actor.userId,
        ]
      );
    }

    for (
      const doc of documents
    ) {
      await connection.query(
        `
        INSERT INTO employee_documents
        (
          employee_id,
          name,
          expiration_date,
          file_path
        )
        VALUES (?, ?, ?, ?)
        `,
        [
          employeeId,
          doc.name,
          doc.expirationDate,
          doc.filePath,
        ]
      );
    }

    await connection.commit();

    transactionCommitted =
      true;

    /*
     * Existing audit semantics are preserved.
     * Audit occurs after successful DB commit.
     */
    await logAudit({
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
        "ADD_EMPLOYEE",

      description:
        `${actor.fullName} added employee record for ${finalName}.`,
    });

    return res
      .status(201)
      .json({
        success: true,

        message:
          "Employee created successfully.",

        id:
          employeeId,
      });
  } catch (err) {
    let rollbackSucceeded =
      !transactionStarted;

    if (
      connection &&
      transactionStarted &&
      !transactionCommitted
    ) {
      try {
        await connection.rollback();

        rollbackSucceeded =
          true;
      } catch (
        rollbackError
      ) {
        rollbackSucceeded =
          false;

        console.error(
          "CREATE EMPLOYEE ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    if (
      !transactionCommitted &&
      rollbackSucceeded
    ) {
      await cleanupUploadedFiles(
        req.files
      );
    }

    console.error(
      "CREATE EMPLOYEE ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Create employee error",
      });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

function normalizeEmployeeLookupName(
  value
) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 255);
}

/*
 * ==================================================
 * EMPLOYEE FORM META
 * ==================================================
 *
 * Returns a display-only next ID preview and,
 * when a name is supplied, the matching employee
 * needed for duplicate-name verification.
 */
exports.getEmployeeFormMeta = async (
  req,
  res
) => {
  try {
    const name =
      normalizeEmployeeLookupName(
        req.query?.name
      );

    const excludeIdValue =
      String(
        req.query?.excludeId ??
          ""
      ).trim();

    let excludeId = null;

    if (excludeIdValue) {
      const parsedExcludeId =
        Number.parseInt(
          excludeIdValue,
          10
        );

      if (
        !Number.isInteger(
          parsedExcludeId
        ) ||
        parsedExcludeId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid excluded employee ID.",
          });
      }

      excludeId =
        parsedExcludeId;
    }

    const nextIdQuery =
      db.promise().query(`
        SELECT
          COALESCE(
            (
              SELECT
                AUTO_INCREMENT
              FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'employees'
              LIMIT 1
            ),
            (
              SELECT
                COALESCE(
                  MAX(id),
                  0
                ) + 1
              FROM employees
            ),
            1
          ) AS next_employee_id
      `);

    let duplicateQuery =
      Promise.resolve([
        [],
        [],
      ]);

    if (name) {
      const duplicateSql = `
        SELECT
          id,
          name,
          company,
          status,
          archived
        FROM employees
        WHERE LOWER(TRIM(name)) =
          LOWER(?)
        ${
          excludeId
            ? "AND id <> ?"
            : ""
        }
        ORDER BY
          archived ASC,
          created_at DESC,
          id DESC
        LIMIT 1
      `;

      const duplicateParams =
        excludeId
          ? [
              name,
              excludeId,
            ]
          : [
              name,
            ];

      duplicateQuery =
        db.promise().query(
          duplicateSql,
          duplicateParams
        );
    }

    const [
      nextIdResult,
      duplicateResult,
    ] = await Promise.all([
      nextIdQuery,
      duplicateQuery,
    ]);

    const [nextIdRows] =
      nextIdResult;

    const [duplicateRows] =
      duplicateResult;

    const nextEmployeeId =
      Number(
        nextIdRows[
          0
        ]?.next_employee_id ||
          1
      );

    return res.json({
      employeeIdPreview:
        `EMP${String(
          nextEmployeeId
        ).padStart(
          3,
          "0"
        )}`,

      duplicateEmployee:
        duplicateRows[
          0
        ] || null,
    });
  } catch (err) {
    console.error(
      "FETCH EMPLOYEE FORM META ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Fetch employee form metadata error",
      });
  }
};

const REQUIRED_EMPLOYEE_DOCUMENT_NAMES =
  Object.freeze([
    "resume",
    "nso/psa",
    "sss (id or e1 form)",
    "pag-ibig (id or mdrf form)",
    "philhealth (id or mdf form)",
    "diploma",
    "cedula",
    "barangay clearance",
    "nbi/police clearance",
  ]);

const EXPIRABLE_EMPLOYEE_DOCUMENT_NAMES =
  Object.freeze([
    "barangay clearance",
    "nbi/police clearance",
  ]);

const EMPLOYEE_COMPLIANCE_STATUSES =
  new Set([
    "Complete",
    "Expiring Soon",
    "Expired",
    "Incomplete",
    "No Data",
  ]);

const EMPLOYEE_SUMMARY_SORTS =
  new Set([
    "latest",
    "name-asc",
    "name-desc",
    "expired-first",
    "expiring-first",
  ]);

const EMPLOYEE_SUMMARY_SCOPES =
  new Set([
    "active",
    "archived",
    "all",
  ]);

const DEFAULT_EMPLOYEE_PAGE_SIZE =
  50;

const MAX_EMPLOYEE_PAGE_SIZE =
  100;

function toPositiveInteger(
  value,
  fallback
) {
  const parsed =
    Number.parseInt(
      String(value ?? ""),
      10
    );

  return (
    Number.isInteger(parsed) &&
    parsed > 0
  )
    ? parsed
    : fallback;
}

function normalizeEmployeeSummarySearch(
  value
) {
  return String(value || "")
    .trim()
    .slice(0, 100);
}

function resolveEmployeeComplianceStatus(
  summary
) {
  const documentCount =
    Number(
      summary?.document_count ||
        0
    );

  if (documentCount === 0) {
    return "No Data";
  }

  if (
    Number(
      summary?.expired_count ||
        0
    ) > 0
  ) {
    return "Expired";
  }

  if (
    Number(
      summary?.expiring_soon_count ||
        0
    ) > 0
  ) {
    return "Expiring Soon";
  }

  if (
    Number(
      summary?.complete_required_count ||
        0
    ) <
    REQUIRED_EMPLOYEE_DOCUMENT_NAMES.length
  ) {
    return "Incomplete";
  }

  return "Complete";
}

function getEmployeeSummarySortSql(
  sortBy,
  complianceStatusSql = ""
) {
  if (sortBy === "name-asc") {
    return "e.name ASC, e.id ASC";
  }

  if (sortBy === "name-desc") {
    return "e.name DESC, e.id DESC";
  }

  if (
    sortBy === "expired-first" ||
    sortBy === "expiring-first"
  ) {
    return `
      CASE ${complianceStatusSql}
        WHEN 'Expired' THEN 1
        WHEN 'Expiring Soon' THEN 2
        WHEN 'Incomplete' THEN 3
        WHEN 'Complete' THEN 4
        WHEN 'No Data' THEN 5
        ELSE 6
      END ASC,
      e.name ASC,
      e.id ASC
    `;
  }

  return "e.created_at DESC, e.id DESC";
}

function buildEmployeeSummaryFilters({
  scope,
  search,
  status,
  compliance,
  complianceStatusSql = "",
}) {
  const where = [];
  const params = [];

  if (scope === "active") {
    where.push(
      "e.archived = 0",
      "e.status <> 'Inactive'"
    );
  } else if (
    scope === "archived"
  ) {
    where.push(
      "(e.archived = 1 OR e.status = 'Inactive')"
    );
  }

  if (search) {
    const searchPattern =
      `%${search.toLowerCase()}%`;

    where.push(`
      (
        CAST(e.id AS CHAR) LIKE ?
        OR LOWER(e.name) LIKE ?
        OR LOWER(COALESCE(e.company, '')) LIKE ?
        OR EXISTS (
          SELECT 1
          FROM deployment_assignments AS da_search
          WHERE da_search.employee_id = e.id
            AND LOWER(COALESCE(da_search.position, '')) LIKE ?
        )
      )
    `);

    params.push(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern
    );
  }

  if (
    status &&
    status !== "All"
  ) {
    where.push(
      "e.status = ?"
    );

    params.push(
      status
    );
  }

  if (
    compliance &&
    compliance !== "All"
  ) {
    where.push(
      `${complianceStatusSql} = ?`
    );

    params.push(
      compliance
    );
  }

  return {
    whereSql:
      where.length > 0
        ? `WHERE ${where.join(
            "\nAND "
          )}`
        : "",

    params,
  };
}

function createEmployeeComplianceSql(
  employeeIds = []
) {
  const requiredNames =
    REQUIRED_EMPLOYEE_DOCUMENT_NAMES
      .map(() => "?")
      .join(", ");

  const expirableNames =
    EXPIRABLE_EMPLOYEE_DOCUMENT_NAMES
      .map(() => "?")
      .join(", ");

  const normalizedEmployeeIds =
    Array.isArray(
      employeeIds
    )
      ? employeeIds
          .map((id) =>
            Number.parseInt(
              String(id),
              10
            )
          )
          .filter(
            Number.isInteger
          )
      : [];

  const employeeFilterSql =
    normalizedEmployeeIds.length > 0
      ? `
        WHERE d.employee_id IN (
          ${normalizedEmployeeIds
            .map(() => "?")
            .join(", ")}
        )
      `
      : "";

  const aggregateSql = `
    SELECT
      d.employee_id,
      COUNT(*) AS document_count,
      COUNT(
        DISTINCT CASE
          WHEN
            LOWER(TRIM(d.name)) IN (${requiredNames})
            AND TRIM(COALESCE(d.file_path, '')) <> ''
            AND (
              LOWER(TRIM(d.name)) NOT IN (${expirableNames})
              OR d.expiration_date IS NOT NULL
            )
          THEN LOWER(TRIM(d.name))
          ELSE NULL
        END
      ) AS complete_required_count,
      MAX(
        CASE
          WHEN
            LOWER(TRIM(d.name)) IN (${expirableNames})
            AND TRIM(COALESCE(d.file_path, '')) <> ''
            AND d.expiration_date < CURDATE()
          THEN 1
          ELSE 0
        END
      ) AS expired_count,
      MAX(
        CASE
          WHEN
            LOWER(TRIM(d.name)) IN (${expirableNames})
            AND TRIM(COALESCE(d.file_path, '')) <> ''
            AND d.expiration_date BETWEEN
              CURDATE()
              AND DATE_ADD(
                CURDATE(),
                INTERVAL 30 DAY
              )
          THEN 1
          ELSE 0
        END
      ) AS expiring_soon_count
    FROM employee_documents AS d
    ${employeeFilterSql}
    GROUP BY d.employee_id
  `;

  const params = [
    ...REQUIRED_EMPLOYEE_DOCUMENT_NAMES,
    ...EXPIRABLE_EMPLOYEE_DOCUMENT_NAMES,
    ...EXPIRABLE_EMPLOYEE_DOCUMENT_NAMES,
    ...EXPIRABLE_EMPLOYEE_DOCUMENT_NAMES,
    ...normalizedEmployeeIds,
  ];

  return {
    aggregateSql,
    params,
  };
}

/*
 * ==================================================
 * GET EMPLOYEES
 * ==================================================
 *
 * Default mode preserves the existing full response.
 * view=summary provides a paginated lightweight list.
 */
exports.getEmployees = async (
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

    if (view === "summary") {
      const page =
        toPositiveInteger(
          req.query?.page,
          1
        );

      const requestedPageSize =
        toPositiveInteger(
          req.query?.pageSize,
          DEFAULT_EMPLOYEE_PAGE_SIZE
        );

      const pageSize =
        Math.min(
          requestedPageSize,
          MAX_EMPLOYEE_PAGE_SIZE
        );

      const offset =
        (page - 1) *
        pageSize;

      const search =
        normalizeEmployeeSummarySearch(
          req.query?.search
        );

      const scopeInput =
        String(
          req.query?.scope ||
            "active"
        )
          .trim()
          .toLowerCase();

      const scope =
        EMPLOYEE_SUMMARY_SCOPES.has(
          scopeInput
        )
          ? scopeInput
          : "active";

      const sortInput =
        String(
          req.query?.sort ||
            "latest"
        ).trim();

      const sortBy =
        EMPLOYEE_SUMMARY_SORTS.has(
          sortInput
        )
          ? sortInput
          : "latest";

      const statusInput =
        String(
          req.query?.status ||
            "All"
        ).trim();

      const status =
        statusInput === "All"
          ? "All"
          : normalizeEmployeeStatus(
              statusInput
            );

      if (!status) {
        return res
          .status(400)
          .json({
            error:
              "Invalid employee status filter.",
          });
      }

      const compliance =
        String(
          req.query?.compliance ||
            "All"
        ).trim();

      if (
        compliance !== "All" &&
        !EMPLOYEE_COMPLIANCE_STATUSES.has(
          compliance
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid compliance filter.",
          });
      }

      const complianceSensitiveSort =
        sortBy === "expired-first" ||
        sortBy === "expiring-first";

      const needsGlobalCompliance =
        compliance !== "All" ||
        complianceSensitiveSort;

      const activeTotalSql = `
        SELECT
          COUNT(*) AS total
        FROM employees
        WHERE archived = 0
          AND status <> 'Inactive'
      `;

      if (!needsGlobalCompliance) {
        const {
          whereSql,
          params:
            filterParams,
        } =
          buildEmployeeSummaryFilters({
            scope,
            search,
            status,
            compliance:
              "All",
          });

        const orderBySql =
          getEmployeeSummarySortSql(
            sortBy
          );

        const dataSql = `
          SELECT
            e.id,
            e.name,
            e.company,
            (
              SELECT da_position.position
              FROM deployment_assignments AS da_position
              WHERE da_position.employee_id = e.id
              ORDER BY
                da_position.start_date DESC,
                da_position.id DESC
              LIMIT 1
            ) AS position,
            e.status,
            e.contractStart,
            e.contractEnd,
            e.contractEndReason,
            e.contractEndedAt,
            e.created_at,
            e.updated_at,
            e.archived
          FROM employees AS e
          ${whereSql}
          ORDER BY
            ${orderBySql}
          LIMIT ${pageSize}
          OFFSET ${offset}
        `;

        const countSql = `
          SELECT
            COUNT(*) AS total
          FROM employees AS e
          ${whereSql}
        `;

        const [
          dataResult,
          countResult,
          activeTotalResult,
        ] = await Promise.all([
          db.promise().query(
            dataSql,
            filterParams
          ),

          db.promise().query(
            countSql,
            filterParams
          ),

          db.promise().query(
            activeTotalSql
          ),
        ]);

        const [employees] =
          dataResult;

        const [[countRow]] =
          countResult;

        const [[activeTotalRow]] =
          activeTotalResult;

        const employeeIds =
          employees.map(
            (employee) =>
              employee.id
          );

        let complianceRows = [];

        if (
          employeeIds.length > 0
        ) {
          const {
            aggregateSql,
            params,
          } =
            createEmployeeComplianceSql(
              employeeIds
            );

          const [
            complianceResult,
          ] =
            await db.promise().query(
              aggregateSql,
              params
            );

          complianceRows =
            complianceResult;
        }

        const complianceByEmployeeId =
          new Map(
            complianceRows.map(
              (row) => [
                Number(
                  row.employee_id
                ),
                row,
              ]
            )
          );

        const result =
          employees.map(
            (employee) => ({
              ...employee,

              complianceStatus:
                resolveEmployeeComplianceStatus(
                  complianceByEmployeeId.get(
                    Number(
                      employee.id
                    )
                  )
                ),
            })
          );

        const total =
          Number(
            countRow?.total ||
              0
          );

        const activeTotal =
          Number(
            activeTotalRow?.total ||
              0
          );

        return res.json({
          employees:
            result,

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
            activeTotal,
          },

          filters: {
            scope,
            search,
            status,
            compliance,
            sort:
              sortBy,
          },
        });
      }

      /*
       * Compliance-specific filtering/sorting must
       * evaluate the full matching set before LIMIT.
       * This path runs only when the user explicitly
       * requests a compliance filter or sort.
       */
      const {
        aggregateSql,
        params:
          complianceParams,
      } =
        createEmployeeComplianceSql();

      const complianceStatusSql = `
        CASE
          WHEN COALESCE(c.document_count, 0) = 0
            THEN 'No Data'
          WHEN COALESCE(c.expired_count, 0) > 0
            THEN 'Expired'
          WHEN COALESCE(c.expiring_soon_count, 0) > 0
            THEN 'Expiring Soon'
          WHEN COALESCE(c.complete_required_count, 0) <
            ${REQUIRED_EMPLOYEE_DOCUMENT_NAMES.length}
            THEN 'Incomplete'
          ELSE 'Complete'
        END
      `;

      const {
        whereSql,
        params:
          filterParams,
      } =
        buildEmployeeSummaryFilters({
          scope,
          search,
          status,
          compliance,
          complianceStatusSql,
        });

      const orderBySql =
        getEmployeeSummarySortSql(
          sortBy,
          complianceStatusSql
        );

      const dataSql = `
        SELECT
          e.id,
          e.name,
          e.company,
          (
            SELECT da_position.position
            FROM deployment_assignments AS da_position
            WHERE da_position.employee_id = e.id
            ORDER BY
              da_position.start_date DESC,
              da_position.id DESC
            LIMIT 1
          ) AS position,
          e.status,
          e.contractStart,
          e.contractEnd,
          e.contractEndReason,
          e.contractEndedAt,
          e.created_at,
          e.updated_at,
          e.archived,
          ${complianceStatusSql}
            AS complianceStatus
        FROM employees AS e
        LEFT JOIN (
          ${aggregateSql}
        ) AS c
          ON c.employee_id = e.id
        ${whereSql}
        ORDER BY
          ${orderBySql}
        LIMIT ${pageSize}
        OFFSET ${offset}
      `;

      const countSql = `
        SELECT
          COUNT(*) AS total
        FROM employees AS e
        LEFT JOIN (
          ${aggregateSql}
        ) AS c
          ON c.employee_id = e.id
        ${whereSql}
      `;

      const [
        dataResult,
        countResult,
        activeTotalResult,
      ] = await Promise.all([
        db.promise().query(
          dataSql,
          [
            ...complianceParams,
            ...filterParams,
          ]
        ),

        db.promise().query(
          countSql,
          [
            ...complianceParams,
            ...filterParams,
          ]
        ),

        db.promise().query(
          activeTotalSql
        ),
      ]);

      const [employees] =
        dataResult;

      const [[countRow]] =
        countResult;

      const [[activeTotalRow]] =
        activeTotalResult;

      const total =
        Number(
          countRow?.total ||
            0
        );

      const activeTotal =
        Number(
          activeTotalRow?.total ||
            0
        );

      return res.json({
        employees,

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
          activeTotal,
        },

        filters: {
          scope,
          search,
          status,
          compliance,
          sort:
            sortBy,
        },
      });
    }

    const [
      employeeResult,
      documentResult,
    ] = await Promise.all([
      db.promise().query(`
        SELECT *
        FROM employees
        ORDER BY created_at DESC
      `),

      db.promise().query(`
        SELECT
          id,
          employee_id,
          name,
          expiration_date,
          file_path
        FROM employee_documents
        ORDER BY id ASC
      `),
    ]);

    const [employees] =
      employeeResult;

    const [documents] =
      documentResult;

    const documentsByEmployeeId =
      documents.reduce(
        (
          map,
          doc
        ) => {
          const employeeId =
            Number(
              doc.employee_id
            );

          const employeeDocuments =
            map.get(
              employeeId
            ) || [];

          employeeDocuments.push({
            id:
              doc.id,

            name:
              doc.name,

            expirationDate:
              doc.expiration_date,

            filePath:
              doc.file_path,
          });

          map.set(
            employeeId,
            employeeDocuments
          );

          return map;
        },
        new Map()
      );

    const result =
      employees.map(
        (
          employee
        ) => ({
          ...employee,

          documents:
            documentsByEmployeeId.get(
              Number(
                employee.id
              )
            ) || [],
        })
      );

    return res.json(
      result
    );
  } catch (err) {
    console.error(
      "FETCH EMPLOYEES ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Fetch employees error",
      });
  }
};


/*
 * ==================================================
 * GET EMPLOYEE BY ID
 * ==================================================
 *
 * Fetches one employee and only that employee's
 * documents for on-demand detail/edit workflows.
 */
exports.getEmployeeById = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    const [rows] =
      await db
        .promise()
        .query(
          `
          SELECT
            e.*,
            d.id AS document_id,
            d.name AS document_name,
            d.expiration_date AS document_expiration_date,
            d.file_path AS document_file_path
          FROM employees AS e
          LEFT JOIN employee_documents AS d
            ON d.employee_id = e.id
          WHERE e.id = ?
          ORDER BY d.id ASC
          `,
          [id]
        );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({
          error:
            "Employee not found.",
        });
    }

    const firstRow =
      rows[0];

    const employee = {
      ...firstRow,
    };

    delete employee.document_id;
    delete employee.document_name;
    delete employee.document_expiration_date;
    delete employee.document_file_path;

    employee.documents =
      rows
        .filter(
          (row) =>
            row.document_id !==
              null &&
            row.document_id !==
              undefined
        )
        .map(
          (row) => ({
            id:
              row.document_id,

            name:
              row.document_name,

            expirationDate:
              row.document_expiration_date,

            filePath:
              row.document_file_path,
          })
        );

    return res.json(
      employee
    );
  } catch (err) {
    console.error(
      "FETCH EMPLOYEE BY ID ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Fetch employee error",
      });
  }
};

/*
 * ==================================================
 * UPDATE EMPLOYEE
 * PHASE 8B — TRANSACTION SAFE
 * ==================================================
 *
 * Atomic DB unit:
 *
 * employees UPDATE
 * +
 * employee_documents UPDATE/INSERT/DELETE
 *
 * On validation failure:
 * remove newly uploaded request files
 * +
 * return HTTP 400
 *
 * On DB failure:
 * ROLLBACK
 * +
 * remove only newly uploaded request files
 *
 * Old/pre-existing files replaced or removed by a
 * successfully committed update become cleanup
 * candidates. Physical deletion is performed only
 * after commit and only when no DB reference remains.
 */
exports.updateEmployee = async (
  req,
  res
) => {
  const {
    id,
  } = req.params;

  let connection = null;

  let transactionStarted =
    false;

  let transactionCommitted =
    false;

  let isRedeployment =
    false;

  let newAssignmentId =
    null;

  let finalEmployeeName =
    "Unknown Employee";

  const historicalFileCandidates =
    [];

  try {
    const {
      name,
      company,
      status,
      contractStart,
    } = req.body;

    const actor =
      getActor(req);

    const finalName =
      toNullable(name);

    const submittedStatus =
      toNullable(status);

    const requestedStatus =
      submittedStatus
        ? resolveEditableEmployeeStatus(
            submittedStatus
          )
        : null;

    if (
      submittedStatus &&
      !requestedStatus
    ) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Employee status must be either Deployed or Floating / Standby."
      );
    }

    if (!finalName) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Employee name is required."
      );
    }

    const submittedCompany =
      toNullable(company);

    const submittedContractStart =
      toNullableDate(
        contractStart
      );

    const frontendDocs =
      extractDocumentsFromReq(
        req
      );

    connection =
      await db
        .promise()
        .getConnection();

    await connection
      .beginTransaction();

    transactionStarted =
      true;

    const rejectAfterRollback =
      async (
        statusCode,
        message
      ) => {
        await connection.rollback();

        transactionStarted =
          false;

        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(statusCode)
          .json({
            error:
              message,
          });
      };

    /*
     * Lock the current employee row before deciding
     * whether this is a normal edit or redeployment.
     */
    const [
      employeeRows,
    ] =
      await connection.query(
        `
        SELECT
          id,
          name,
          company,
          status,
          contractStart,
          contractEnd,
          contractEndReason,
          contractEndRemarks,
          contractEndedAt,
          archived
        FROM employees
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      employeeRows.length ===
      0
    ) {
      return await rejectAfterRollback(
        404,
        "Employee not found."
      );
    }

    const currentEmployee =
      employeeRows[0];

    finalEmployeeName =
      finalName ||
      currentEmployee.name ||
      "Unknown Employee";

    if (
      Number(
        currentEmployee.archived ||
        0
      ) === 1
    ) {
      return await rejectAfterRollback(
        409,
        "Archived employees cannot be updated through the active employee workflow."
      );
    }

    const currentStatus =
      normalizeEmployeeStatus(
        currentEmployee.status
      );

    if (!currentStatus) {
      return await rejectAfterRollback(
        409,
        "The employee has an unsupported current status. Resolve the employee status before editing this record."
      );
    }

    if (
      currentStatus ===
      EMPLOYEE_STATUS.INACTIVE
    ) {
      return await rejectAfterRollback(
        409,
        "Inactive employees cannot be reactivated through the standard employee edit workflow."
      );
    }

    const finalStatus =
      requestedStatus ||
      currentStatus;

    if (
      currentStatus ===
        EMPLOYEE_STATUS.DEPLOYED &&
      finalStatus ===
        EMPLOYEE_STATUS.FLOATING_STANDBY
    ) {
      return await rejectAfterRollback(
        409,
        "A deployed employee must use the End Assignment workflow before becoming Floating / Standby."
      );
    }

    const [
      activeAssignments,
    ] =
      await connection.query(
        `
        SELECT
          id,
          company,
          start_date
        FROM deployment_assignments
        WHERE employee_id = ?
          AND status = 'Active'
        ORDER BY
          start_date DESC,
          id DESC
        LIMIT 2
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      activeAssignments.length >
      1
    ) {
      return await rejectAfterRollback(
        409,
        "Multiple active deployment assignments were found for this employee. Resolve the assignment records before editing the employee."
      );
    }

    if (
      currentStatus ===
        EMPLOYEE_STATUS.DEPLOYED &&
      activeAssignments.length !==
        1
    ) {
      return await rejectAfterRollback(
        409,
        "The deployed employee does not have exactly one active deployment assignment."
      );
    }

    if (
      currentStatus ===
        EMPLOYEE_STATUS.FLOATING_STANDBY &&
      activeAssignments.length !==
        0
    ) {
      return await rejectAfterRollback(
        409,
        "A Floating / Standby employee cannot have an active deployment assignment."
      );
    }

    isRedeployment =
      currentStatus ===
        EMPLOYEE_STATUS.FLOATING_STANDBY &&
      finalStatus ===
        EMPLOYEE_STATUS.DEPLOYED;

    const currentCompany =
      toNullable(
        currentEmployee.company
      );

    const currentContractStart =
      toNullableDate(
        currentEmployee.contractStart
      );

    const finalCompany =
      finalStatus ===
      EMPLOYEE_STATUS.DEPLOYED
        ? (
            submittedCompany ||
            (
              currentStatus ===
              EMPLOYEE_STATUS.DEPLOYED
                ? currentCompany
                : null
            )
          )
        : null;

    const finalContractStart =
      finalStatus ===
      EMPLOYEE_STATUS.DEPLOYED
        ? (
            submittedContractStart ||
            (
              currentStatus ===
              EMPLOYEE_STATUS.DEPLOYED
                ? currentContractStart
                : null
            )
          )
        : currentContractStart;

    if (
      finalStatus ===
        EMPLOYEE_STATUS.DEPLOYED &&
      !finalCompany
    ) {
      return await rejectAfterRollback(
        400,
        "Company is required for deployed employees."
      );
    }

    if (
      finalStatus ===
        EMPLOYEE_STATUS.DEPLOYED &&
      !finalContractStart
    ) {
      return await rejectAfterRollback(
        400,
        "Deployment start date is required for deployed employees."
      );
    }

    if (isRedeployment) {
      /*
       * Redeployment starts a NEW assignment.
       *
       * Previous completed/cancelled assignment rows
       * are preserved as history.
       */
      const [
        assignmentResult,
      ] =
        await connection.query(
          `
          INSERT INTO deployment_assignments
          (
            employee_id,
            company,
            position,
            start_date,
            status,
            created_by_user_id
          )
          VALUES (?, ?, NULL, ?, 'Active', ?)
          `,
          [
            id,
            finalCompany,
            finalContractStart,
            actor.userId,
          ]
        );

      newAssignmentId =
        assignmentResult.insertId;

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
        VALUES (?, ?, ?, ?, ?, NULL, ?, ?)
        `,
        [
          id,
          EMPLOYEE_STATUS.FLOATING_STANDBY,
          EMPLOYEE_STATUS.DEPLOYED,
          `${finalContractStart} 00:00:00`,
          "Redeployed to client assignment",
          "EMPLOYEE_REDEPLOYED",
          actor.userId,
        ]
      );

      /*
       * employees remains the current-state
       * compatibility/master record.
       *
       * Prior assignment-end fields are safe to
       * clear here because historical assignment
       * and status records are now preserved.
       */
      await connection.query(
        `
        UPDATE employees
        SET
          name = ?,
          company = ?,
          status = ?,
          contractStart = ?,
          contractEnd = NULL,
          contractEndReason = NULL,
          contractEndRemarks = NULL,
          contractEndedAt = NULL
        WHERE id = ?
        `,
        [
          finalName,
          finalCompany,
          EMPLOYEE_STATUS.DEPLOYED,
          finalContractStart,
          id,
        ]
      );
    } else if (
      finalStatus ===
      EMPLOYEE_STATUS.DEPLOYED
    ) {
      /*
       * Normal edit while currently deployed.
       *
       * Keep the authoritative active assignment
       * synchronized with corrected company/start
       * details instead of creating a second row.
       */
      const activeAssignment =
        activeAssignments[0];

      await connection.query(
        `
        UPDATE deployment_assignments
        SET
          company = ?,
          start_date = ?
        WHERE id = ?
          AND status = 'Active'
        `,
        [
          finalCompany,
          finalContractStart,
          activeAssignment.id,
        ]
      );

      await connection.query(
        `
        UPDATE employees
        SET
          name = ?,
          company = ?,
          status = ?,
          contractStart = ?,
          contractEnd = NULL,
          contractEndReason = NULL,
          contractEndRemarks = NULL,
          contractEndedAt = NULL
        WHERE id = ?
        `,
        [
          finalName,
          finalCompany,
          EMPLOYEE_STATUS.DEPLOYED,
          finalContractStart,
          id,
        ]
      );
    } else {
      /*
       * Floating / Standby normal edit.
       *
       * Do not fabricate an assignment and do not
       * alter the preserved previous assignment-end
       * metadata through a generic profile edit.
       */
      await connection.query(
        `
        UPDATE employees
        SET
          name = ?,
          company = NULL,
          status = ?
        WHERE id = ?
        `,
        [
          finalName,
          EMPLOYEE_STATUS.FLOATING_STANDBY,
          id,
        ]
      );
    }

    const [
      existingDocs,
    ] =
      await connection.query(
        `
        SELECT
          id,
          name,
          file_path
        FROM employee_documents
        WHERE employee_id = ?
        `,
        [
          id,
        ]
      );

    for (
      const doc of frontendDocs
    ) {
      const existing =
        existingDocs.find(
          (
            item
          ) =>
            item.name ===
            doc.name
        );

      if (existing) {
        const finalPath =
          doc.hasNewFile
            ? doc.filePath
            : existing.file_path;

        if (
          doc.hasNewFile &&
          existing.file_path &&
          existing.file_path !==
            finalPath
        ) {
          historicalFileCandidates.push(
            existing.file_path
          );
        }

        await connection.query(
          `
          UPDATE employee_documents
          SET
            expiration_date = ?,
            file_path = ?
          WHERE id = ?
          `,
          [
            doc.expirationDate,
            finalPath,
            existing.id,
          ]
        );
      } else {
        await connection.query(
          `
          INSERT INTO employee_documents
          (
            employee_id,
            name,
            expiration_date,
            file_path
          )
          VALUES (?, ?, ?, ?)
          `,
          [
            id,
            doc.name,
            doc.expirationDate,
            doc.filePath,
          ]
        );
      }
    }

    for (
      const existing of
        existingDocs
    ) {
      const stillChecked =
        frontendDocs.find(
          (
            doc
          ) =>
            doc.name ===
            existing.name
        );

      if (!stillChecked) {
        if (existing.file_path) {
          historicalFileCandidates.push(
            existing.file_path
          );
        }

        await connection.query(
          `
          DELETE FROM employee_documents
          WHERE id = ?
          `,
          [
            existing.id,
          ]
        );
      }
    }

    await connection.commit();

    transactionCommitted =
      true;

    connection.release();

    connection = null;

    await cleanupHistoricalFileCandidates(
      historicalFileCandidates,
      "employee_update"
    );

    await logAudit({
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
        isRedeployment
          ? "REDEPLOY_EMPLOYEE"
          : "UPDATE_EMPLOYEE",

      description:
        isRedeployment
          ? `${actor.fullName} redeployed employee ${finalEmployeeName} to ${finalCompany}.`
          : `${actor.fullName} updated employee record for ${finalEmployeeName}.`,
    });

    return res.json({
      success: true,

      message:
        isRedeployment
          ? "Employee redeployed successfully."
          : "Employee updated successfully.",

      employeeId:
        id,

      employeeStatus:
        finalStatus,

      assignmentId:
        isRedeployment
          ? newAssignmentId
          : (
              finalStatus ===
                EMPLOYEE_STATUS.DEPLOYED
                ? activeAssignments[0]?.id ||
                  null
                : null
            ),
    });
  } catch (err) {
    let rollbackSucceeded =
      !transactionStarted;

    if (
      connection &&
      transactionStarted &&
      !transactionCommitted
    ) {
      try {
        await connection.rollback();

        rollbackSucceeded =
          true;
      } catch (
        rollbackError
      ) {
        rollbackSucceeded =
          false;

        console.error(
          "UPDATE EMPLOYEE ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    if (
      !transactionCommitted &&
      rollbackSucceeded
    ) {
      await cleanupUploadedFiles(
        req.files
      );
    }

    console.error(
      "UPDATE EMPLOYEE ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Update employee error",
      });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const CONTRACT_END_REASON_RULES =
  {
    "Completed Contract": {
      employeeStatus:
        EMPLOYEE_STATUS.FLOATING_STANDBY,

      deploymentStatus:
        "Completed",
    },

    "End of Assignment / Pulled Out by Client":
      {
        employeeStatus:
          EMPLOYEE_STATUS.FLOATING_STANDBY,

        deploymentStatus:
          "Completed",
      },

    "Transferred / Reassigned":
      {
        employeeStatus:
          EMPLOYEE_STATUS.FLOATING_STANDBY,

        deploymentStatus:
          "Completed",
      },

    Resigned: {
      employeeStatus:
        EMPLOYEE_STATUS.INACTIVE,

      deploymentStatus:
        "Cancelled",
    },

    AWOL: {
      employeeStatus:
        EMPLOYEE_STATUS.INACTIVE,

      deploymentStatus:
        "Cancelled",
    },

    Terminated: {
      employeeStatus:
        EMPLOYEE_STATUS.INACTIVE,

      deploymentStatus:
        "Cancelled",
    },
  };

/*
 * ==================================================
 * END DEPLOYMENT CONTRACT
 * ==================================================
 */
exports.updateContractEnd = async (
  req,
  res
) => {
  const { id } =
    req.params;

  let connection = null;

  let transactionStarted =
    false;

  let transactionCommitted =
    false;

  try {
    const {
      contractEnd,
      endReason,
      endRemarks,
    } = req.body || {};

    const actor =
      getActor(req);

    const finalContractEnd =
      toNullableDate(
        contractEnd
      );

    const finalReason =
      toNullable(
        endReason
      );

    const finalRemarks =
      toNullable(
        endRemarks
      );

    if (!finalContractEnd) {
      return res.status(400).json({
        error:
          "Contract end date is required.",
      });
    }

    if (!finalReason) {
      return res.status(400).json({
        error:
          "Contract end reason is required.",
      });
    }

    const reasonRule =
      CONTRACT_END_REASON_RULES[
        finalReason
      ];

    if (!reasonRule) {
      return res.status(400).json({
        error:
          "Invalid contract end reason.",
      });
    }

    connection =
      await db
        .promise()
        .getConnection();

    await connection
      .beginTransaction();

    transactionStarted =
      true;

    /*
     * Lock the employee master row while the
     * assignment and status history are closed.
     *
     * Archive state and current workforce status
     * are validated from the authoritative row,
     * not from client-supplied values.
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
          archived,
          contractStart
        FROM employees
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      employeeRows.length === 0
    ) {
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(404).json({
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
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(409).json({
        error:
          "Archived employees cannot have an active deployment ended.",
      });
    }

    const currentEmployeeStatus =
      normalizeEmployeeStatus(
        employee.status
      );

    if (
      currentEmployeeStatus !==
      EMPLOYEE_STATUS.DEPLOYED
    ) {
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(409).json({
        error:
          "Only a currently deployed employee can have an active deployment ended.",
      });
    }

    /*
     * Exactly one active assignment must exist.
     *
     * Two rows are intentionally requested so an
     * integrity conflict can be detected instead
     * of silently closing an arbitrary assignment.
     */
    const [
      activeAssignments,
    ] =
      await connection.query(
        `
        SELECT
          id,
          company,
          start_date
        FROM deployment_assignments
        WHERE employee_id = ?
          AND status = 'Active'
        ORDER BY
          start_date DESC,
          id DESC
        LIMIT 2
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      activeAssignments.length ===
      0
    ) {
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(409).json({
        error:
          "No active deployment assignment was found for this employee.",
      });
    }

    if (
      activeAssignments.length >
      1
    ) {
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(409).json({
        error:
          "Multiple active deployment assignments were found for this employee. Resolve the assignment records before ending the deployment.",
      });
    }

    const activeAssignment =
      activeAssignments[0];

    const assignmentStartDate =
      toNullableDate(
        activeAssignment.start_date
      );

    if (
      assignmentStartDate &&
      finalContractEnd <
        assignmentStartDate
    ) {
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(400).json({
        error:
          "Deployment end date cannot be earlier than the deployment start date.",
      });
    }

    /*
     * Close the historical assignment first.
     *
     * Assignment status describes the assignment:
     * - Completed: normal end/pull-out/reassignment
     * - Cancelled: employment separation
     *
     * Employee status separately describes the
     * person's current WELLJOB workforce state.
     */
    await connection.query(
      `
      UPDATE deployment_assignments
      SET
        end_date = ?,
        end_reason = ?,
        end_remarks = ?,
        status = ?,
        ended_at = NOW()
      WHERE id = ?
        AND status = 'Active'
      `,
      [
        finalContractEnd,
        finalReason,
        finalRemarks,
        reasonRule.deploymentStatus,
        activeAssignment.id,
      ]
    );

    /*
     * Preserve the compatibility/current-state
     * fields on employees while the application is
     * progressively migrated to assignment history.
     */
    await connection.query(
      `
      UPDATE employees
      SET
        contractEnd = ?,
        contractEndReason = ?,
        contractEndRemarks = ?,
        contractEndedAt = NOW(),
        status = ?
      WHERE id = ?
      `,
      [
        finalContractEnd,
        finalReason,
        finalRemarks,
        reasonRule.employeeStatus,
        id,
      ]
    );

    /*
     * Record the effective workforce transition.
     *
     * The effective date uses the HR-selected
     * assignment end date so historical yearly
     * reporting remains reconstructable.
     */
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        EMPLOYEE_STATUS.DEPLOYED,
        reasonRule.employeeStatus,
        `${finalContractEnd} 00:00:00`,
        finalReason,
        finalRemarks,
        "DEPLOYMENT_ENDED",
        actor.userId,
      ]
    );

    await connection.commit();

    transactionCommitted =
      true;

    connection.release();

    connection = null;

    const employeeName =
      employee?.name ||
      "Unknown Employee";

    await logAudit({
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
        "END_DEPLOYMENT_CONTRACT",

      description:
        `${actor.fullName} ended deployment contract for ${employeeName}. Reason: ${finalReason}.`,
    });

    return res.json({
      success: true,

      message:
        "Deployment contract ended successfully.",

      employeeId:
        id,

      employeeName,

      assignmentId:
        activeAssignment.id,

      company:
        activeAssignment.company,

      contractEnd:
        finalContractEnd,

      endReason:
        finalReason,

      endRemarks:
        finalRemarks,

      deploymentStatus:
        reasonRule.deploymentStatus,

      employeeStatus:
        reasonRule.employeeStatus,
    });
  } catch (err) {
    if (
      connection &&
      transactionStarted &&
      !transactionCommitted
    ) {
      try {
        await connection.rollback();
      } catch (
        rollbackError
      ) {
        console.error(
          "UPDATE CONTRACT END ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    console.error(
      "UPDATE CONTRACT END ERROR:",
      err
    );

    return res.status(500).json({
      error:
        "Failed to update contract end date.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/*
 * ==================================================
 * ARCHIVE EMPLOYEE
 * ==================================================
 */
exports.archiveEmployee = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    const actor =
      getActor(req);

    const employeeName =
      await getEmployeeNameById(
        id
      );

    /*
     * Do not report success for a
     * nonexistent employee.
     */
    if (!employeeName) {
      return res.status(404).json({
        error:
          "Employee not found.",
      });
    }

    await db.promise().query(
      `
      UPDATE employees
      SET archived = 1
      WHERE id = ?
      `,
      [id]
    );

    await logAudit({
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
        "ARCHIVE_EMPLOYEE",

      description:
        `${actor.fullName} archived employee record for ${employeeName}.`,
    });

    return res.json({
      success: true,

      message:
        "Employee archived successfully.",
    });
  } catch (err) {
    console.error(
      "ARCHIVE EMPLOYEE ERROR:",
      err
    );

    return res.status(500).json({
      error:
        "Archive employee error",
    });
  }
};

/*
 * ==================================================
 * RESTORE EMPLOYEE
 * ==================================================
 */
exports.restoreEmployee = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

    const actor =
      getActor(req);

    const employeeName =
      await getEmployeeNameById(
        id
      );

    /*
     * Do not report success for a
     * nonexistent employee.
     */
    if (!employeeName) {
      return res.status(404).json({
        error:
          "Employee not found.",
      });
    }

    await db.promise().query(
      `
      UPDATE employees
      SET archived = 0
      WHERE id = ?
      `,
      [id]
    );

    await logAudit({
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
        "RESTORE_EMPLOYEE",

      description:
        `${actor.fullName} restored employee record for ${employeeName}.`,
    });

    return res.json({
      success: true,

      message:
        "Employee restored successfully.",
    });
  } catch (err) {
    console.error(
      "RESTORE EMPLOYEE ERROR:",
      err
    );

    return res.status(500).json({
      error:
        "Restore employee error",
    });
  }
};

/*
 * ==================================================
 * DELETE EMPLOYEE
 * PHASE 8C — TRANSACTION SAFE
 * ==================================================
 *
 * Confirmed database relationship:
 *
 * employees
 * ├── employee_documents
 * │   No FK.
 * │   Explicitly removed here.
 * │
 * └── incidents
 *     FK incidents.employee_id -> employees.id
 *     ON DELETE CASCADE
 *
 *     incidents
 *     ├── incident_evidence
 *     │   ON DELETE CASCADE
 *     │
 *     └── incident_timeline
 *         ON DELETE CASCADE
 *
 * kpi_decision_history has no FK to employees and
 * is intentionally preserved as historical data.
 *
 * Before destructive DB changes, historical
 * employee-document and incident-evidence paths are
 * captured as cleanup candidates.
 *
 * Physical deletion is considered only after a
 * successful DB commit and only when the centralized
 * reference-aware service proves that no DB reference
 * remains anywhere in the active file-reference
 * sources.
 */
exports.deleteEmployee = async (
  req,
  res
) => {
  const {
    id,
  } = req.params;

  const actor =
    getActor(req);

  let connection = null;

  let transactionStarted =
    false;

  let transactionCommitted =
    false;

  const historicalFileCandidates =
    [];

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
     * Resolve employee name using the same
     * transaction connection.
     *
     * Existing behavior is preserved:
     * if no row exists, audit description uses
     * "Unknown Employee".
     */
    const [
      employeeRows,
    ] =
      await connection.query(
        `
        SELECT name
        FROM employees
        WHERE id = ?
        LIMIT 1
        `,
        [
          id,
        ]
      );

    const employeeName =
      employeeRows[
        0
      ]?.name ||
      "Unknown Employee";

    /*
     * Capture every physical-file reference that
     * will be removed by this transaction before
     * deleting rows or triggering cascades.
     *
     * These are only candidates. Nothing is
     * physically deleted inside the transaction.
     */
    const [
      employeeDocumentRows,
    ] =
      await connection.query(
        `
        SELECT file_path
        FROM employee_documents
        WHERE employee_id = ?
          AND file_path IS NOT NULL
          AND TRIM(file_path) <> ''
        `,
        [
          id,
        ]
      );

    for (
      const row of
        employeeDocumentRows
    ) {
      historicalFileCandidates.push(
        row.file_path
      );
    }

    const [
      incidentEvidenceRows,
    ] =
      await connection.query(
        `
        SELECT ie.file_path
        FROM incident_evidence AS ie
        INNER JOIN incidents AS i
          ON i.id = ie.incident_id
        WHERE i.employee_id = ?
          AND ie.file_path IS NOT NULL
          AND TRIM(ie.file_path) <> ''
        `,
        [
          id,
        ]
      );

    for (
      const row of
        incidentEvidenceRows
    ) {
      historicalFileCandidates.push(
        row.file_path
      );
    }

    await connection.query(
      `
      DELETE FROM employee_documents
      WHERE employee_id = ?
      `,
      [
        id,
      ]
    );

    await connection.query(
      `
      DELETE FROM deployment_assignments
      WHERE employee_id = ?
      `,
      [
        id,
      ]
    );

    await connection.query(
      `
      DELETE FROM employee_status_history
      WHERE employee_id = ?
      `,
      [
        id,
      ]
    );

    await connection.query(
      `
      DELETE FROM employees
      WHERE id = ?
      `,
      [
        id,
      ]
    );

    /*
     * At this point all related transactional DB
     * mutations have succeeded.
     */
    await connection.commit();

    transactionCommitted =
      true;

    /*
     * Release the transaction connection before
     * post-commit cleanup performs independent
     * reference-count queries.
     */
    connection.release();

    connection = null;

    await cleanupHistoricalFileCandidates(
      historicalFileCandidates,
      "employee_delete"
    );

    /*
     * Audit after successful commit only.
     */
    await logAudit({
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
        "DELETE_EMPLOYEE",

      description:
        `${actor.fullName} permanently deleted employee record for ${employeeName}.`,
    });

    return res.json({
      success: true,

      message:
        "Employee permanently deleted.",
    });
  } catch (err) {
    /*
     * If employee_documents deletion succeeds
     * but employee/cascade deletion fails, restore
     * the entire database state.
     *
     * Because the cascaded child deletes are part
     * of the same InnoDB transaction, rollback also
     * restores incidents/evidence/timeline.
     */
    if (
      connection &&
      transactionStarted &&
      !transactionCommitted
    ) {
      try {
        await connection.rollback();
      } catch (
        rollbackError
      ) {
        console.error(
          "DELETE EMPLOYEE ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    console.error(
      "DELETE EMPLOYEE ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Delete employee error",
      });
  } finally {
    /*
     * Always return the dedicated connection
     * to the pool.
     */
    if (connection) {
      connection.release();
    }
  }
};