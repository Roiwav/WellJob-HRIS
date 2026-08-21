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

    const finalStatus =
      toNullable(status) ||
      "Deployed";

    const finalCompany =
      finalStatus ===
      "Deployed"
        ? toNullable(
            company
          )
        : null;

    const finalContractStart =
      toNullableDate(
        contractStart
      );

    if (!finalName) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Employee name is required."
      );
    }

    if (
      finalStatus ===
        "Deployed" &&
      !finalCompany
    ) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Company is required for deployed employees."
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

/*
 * ==================================================
 * GET EMPLOYEES
 * ==================================================
 */
exports.getEmployees = async (
  req,
  res
) => {
  try {
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

    const finalStatus =
      toNullable(status) ||
      "Deployed";

    const finalCompany =
      finalStatus ===
      "Deployed"
        ? toNullable(
            company
          )
        : null;

    const finalContractStart =
      toNullableDate(
        contractStart
      );

    if (!finalName) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Employee name is required."
      );
    }

    if (
      finalStatus ===
        "Deployed" &&
      !finalCompany
    ) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Company is required for deployed employees."
      );
    }

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

    await connection.query(
      `
      UPDATE employees
      SET
        name = ?,
        company = ?,
        status = ?,
        contractStart = ?
      WHERE id = ?
      `,
      [
        finalName,
        finalCompany,
        finalStatus,
        finalContractStart,
        id,
      ]
    );

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

    /*
     * Release the transaction connection before
     * post-commit cleanup performs its own
     * reference-count queries through the pool.
     */
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
        "UPDATE_EMPLOYEE",

      description:
        `${actor.fullName} updated employee record for ${finalName}.`,
    });

    return res.json({
      success: true,

      message:
        "Employee updated successfully.",
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
        "Floating / Standby",

      deploymentStatus:
        "Completed",
    },

    "End of Assignment / Pulled Out by Client":
      {
        employeeStatus:
          "Floating / Standby",

        deploymentStatus:
          "Completed",
      },

    "Transferred / Reassigned":
      {
        employeeStatus:
          "Floating / Standby",

        deploymentStatus:
          "Completed",
      },

    Resigned: {
      employeeStatus:
        "Inactive",

      deploymentStatus:
        "Cancelled",
    },

    AWOL: {
      employeeStatus:
        "Inactive",

      deploymentStatus:
        "Cancelled",
    },

    Terminated: {
      employeeStatus:
        "Inactive",

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
  try {
    const { id } =
      req.params;

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

    const [employeeRows] =
      await db
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

    if (
      employeeRows.length === 0
    ) {
      return res.status(404).json({
        error:
          "Employee not found.",
      });
    }

    const employeeName =
      employeeRows[0]?.name ||
      "Unknown Employee";

    await db.promise().query(
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
    console.error(
      "UPDATE CONTRACT END ERROR:",
      err
    );

    return res.status(500).json({
      error:
        "Failed to update contract end date.",
    });
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

    /*
     * employee_documents has no FK constraint,
     * so it must be explicitly deleted.
     */
    await connection.query(
      `
      DELETE FROM employee_documents
      WHERE employee_id = ?
      `,
      [
        id,
      ]
    );

    /*
     * Deleting the employee triggers the existing
     * database cascade:
     *
     * employees
     * -> incidents
     * -> incident_evidence
     * -> incident_timeline
     *
     * Do NOT manually duplicate those deletes.
     */
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