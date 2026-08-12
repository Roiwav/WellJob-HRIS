const db = require("../config/db");
const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

function toNullable(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const trimmed = String(value).trim();

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

  const trimmed = String(value).trim();

  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return trimmed.slice(0, 10);
}

/*
 * TRUSTED AUDIT ACTOR
 *
 * SECURITY:
 * Actor identity comes exclusively from req.user,
 * which is established by verifyToken().
 *
 * Do NOT trust these request values for actor identity:
 * - req.body.userId
 * - req.body.user_id
 * - req.body.username
 * - req.body.fullName
 * - req.body.full_name
 * - req.body.role
 * - req.query.userId
 * - req.query.role
 *
 * Older frontend requests may continue sending those
 * fields for compatibility, but they are intentionally
 * ignored for audit authority.
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
    userId: toNullable(userId),
    username,
    fullName: username,
    role: toNullable(
      authenticatedUser.role
    ),
  };
}

/*
 * Returns:
 * - employee name when the record exists
 * - null when the employee does not exist
 *
 * This allows archive / restore / delete handlers
 * to return a correct 404 response instead of
 * reporting success for a nonexistent employee.
 */
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

  for (let i = 0; i < 20; i++) {
    let docName = null;
    let expDate = null;

    if (
      req.body.documents &&
      req.body.documents[i]
    ) {
      docName =
        req.body.documents[i].name;

      expDate =
        req.body.documents[i]
          .expirationDate;
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

    const file = req.files?.find(
      (item) =>
        item.fieldname ===
        `documents[${i}]`
    );

    const filePath = file
      ? `documents/employees/${file.filename}`
      : null;

    if (docName || file) {
      documents.push({
        name:
          toNullable(docName) ||
          (file
            ? file.originalname
            : "Unknown"),

        expirationDate:
          toNullableDate(expDate),

        filePath,

        hasNewFile:
          Boolean(file),
      });
    }
  }

  return documents;
};

exports.createEmployee = async (
  req,
  res
) => {
  const connection = db.promise();

  try {
    const {
      name,
      company,
      status,
      contractStart,
    } = req.body;

    const actor = getActor(req);

    const finalName =
      toNullable(name);

    const finalStatus =
      toNullable(status) ||
      "Deployed";

    const finalCompany =
      finalStatus === "Deployed"
        ? toNullable(company)
        : null;

    const finalContractStart =
      toNullableDate(contractStart);

    if (!finalName) {
      return res.status(400).json({
        error:
          "Employee name is required.",
      });
    }

    if (
      finalStatus === "Deployed" &&
      !finalCompany
    ) {
      return res.status(400).json({
        error:
          "Company is required for deployed employees.",
      });
    }

    const documents =
      extractDocumentsFromReq(req);

    const [result] =
      await connection.query(
        `
        INSERT INTO employees
        (name, company, status, contractStart)
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

    for (const doc of documents) {
      await connection.query(
        `
        INSERT INTO employee_documents
        (employee_id, name, expiration_date, file_path)
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

    await logAudit({
      userId: actor.userId,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,

      category:
        AUDIT_CATEGORY.OPERATIONAL,

      action:
        "ADD_EMPLOYEE",

      description:
        `${actor.fullName} added employee record for ${finalName}.`,
    });

    return res.status(201).json({
      success: true,

      message:
        "Employee created successfully.",

      id:
        employeeId,
    });
  } catch (err) {
    console.error(
      "CREATE EMPLOYEE ERROR:",
      err
    );

    return res.status(500).json({
      error:
        err.sqlMessage ||
        err.message ||
        "Create employee error",
    });
  }
};

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
        (map, doc) => {
          const employeeId =
            Number(
              doc.employee_id
            );

          const employeeDocuments =
            map.get(employeeId) || [];

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
        (employee) => ({
          ...employee,

          documents:
            documentsByEmployeeId.get(
              Number(employee.id)
            ) || [],
        })
      );

    return res.json(result);
  } catch (err) {
    console.error(
      "FETCH EMPLOYEES ERROR:",
      err
    );

    return res.status(500).json({
      error:
        err.sqlMessage ||
        err.message ||
        "Fetch employees error",
    });
  }
};

exports.updateEmployee = async (
  req,
  res
) => {
  const { id } = req.params;

  const connection = db.promise();

  try {
    const {
      name,
      company,
      status,
      contractStart,
    } = req.body;

    const actor = getActor(req);

    const finalName =
      toNullable(name);

    const finalStatus =
      toNullable(status) ||
      "Deployed";

    const finalCompany =
      finalStatus === "Deployed"
        ? toNullable(company)
        : null;

    const finalContractStart =
      toNullableDate(contractStart);

    if (!finalName) {
      return res.status(400).json({
        error:
          "Employee name is required.",
      });
    }

    if (
      finalStatus === "Deployed" &&
      !finalCompany
    ) {
      return res.status(400).json({
        error:
          "Company is required for deployed employees.",
      });
    }

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

    const [existingDocs] =
      await connection.query(
        `
        SELECT
          id,
          name,
          file_path
        FROM employee_documents
        WHERE employee_id = ?
        `,
        [id]
      );

    const frontendDocs =
      extractDocumentsFromReq(req);

    for (
      const doc of frontendDocs
    ) {
      const existing =
        existingDocs.find(
          (item) =>
            item.name ===
            doc.name
        );

      if (existing) {
        const finalPath =
          doc.hasNewFile
            ? doc.filePath
            : existing.file_path;

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
          (employee_id, name, expiration_date, file_path)
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
      const existing of existingDocs
    ) {
      const stillChecked =
        frontendDocs.find(
          (doc) =>
            doc.name ===
            existing.name
        );

      if (!stillChecked) {
        await connection.query(
          `
          DELETE FROM employee_documents
          WHERE id = ?
          `,
          [existing.id]
        );
      }
    }

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
    console.error(
      "UPDATE EMPLOYEE ERROR:",
      err
    );

    return res.status(500).json({
      error:
        err.sqlMessage ||
        err.message ||
        "Update employee error",
    });
  }
};

const CONTRACT_END_REASON_RULES = {
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

  "Transferred / Reassigned": {
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
        err.sqlMessage ||
        err.message ||
        "Failed to update contract end date.",
    });
  }
};

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
        err.sqlMessage ||
        err.message ||
        "Archive employee error",
    });
  }
};

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
        err.sqlMessage ||
        err.message ||
        "Restore employee error",
    });
  }
};

exports.deleteEmployee = async (
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
     * Verify the employee exists
     * before deleting related
     * document rows.
     */
    if (!employeeName) {
      return res.status(404).json({
        error:
          "Employee not found.",
      });
    }

    await db
      .promise()
      .query(
        `
        DELETE FROM employee_documents
        WHERE employee_id = ?
        `,
        [id]
      );

    await db.promise().query(
      `
      DELETE FROM employees
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
    console.error(
      "DELETE EMPLOYEE ERROR:",
      err
    );

    return res.status(500).json({
      error:
        err.sqlMessage ||
        err.message ||
        "Delete employee error",
    });
  }
};