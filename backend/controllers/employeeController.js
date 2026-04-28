const db = require("../config/db");
const { logAudit, AUDIT_CATEGORY } = require("../utils/auditLogger");

function toNullable(value) {
  if (value === undefined || value === null) return null;

  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function toNullableDate(value) {
  if (value === undefined || value === null) return null;

  const trimmed = String(value).trim();
  if (!trimmed) return null;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;

  return trimmed.slice(0, 10);
}

function getActor(req) {
  const body = req.body || {};

  const username = toNullable(body.username);
  const fullName =
    toNullable(body.fullName) ||
    toNullable(body.full_name) ||
    toNullable(body.name) ||
    username ||
    "Unknown User";

  return {
    userId: toNullable(body.userId || body.user_id),
    username,
    fullName,
    role: toNullable(body.role),
  };
}

async function getEmployeeNameById(id) {
  const [rows] = await db
    .promise()
    .query(`SELECT name FROM employees WHERE id = ? LIMIT 1`, [id]);

  return rows[0]?.name || "Unknown Employee";
}

const extractDocumentsFromReq = (req) => {
  const documents = [];

  for (let i = 0; i < 20; i++) {
    let docName = null;
    let expDate = null;

    if (req.body.documents && req.body.documents[i]) {
      docName = req.body.documents[i].name;
      expDate = req.body.documents[i].expirationDate;
    } else if (req.body[`documents[${i}][name]`] !== undefined) {
      docName = req.body[`documents[${i}][name]`];
      expDate = req.body[`documents[${i}][expirationDate]`];
    }

    const file = req.files?.find((f) => f.fieldname === `documents[${i}]`);
    const filePath = file ? `documents/employees/${file.filename}` : null;

    if (docName || file) {
      documents.push({
        name: toNullable(docName) || (file ? file.originalname : "Unknown"),
        expirationDate: toNullableDate(expDate),
        filePath,
        hasNewFile: !!file,
      });
    }
  }

  return documents;
};

exports.createEmployee = async (req, res) => {
  const connection = db.promise();

  try {
    const {
      name,
      company,
      status,
      employmentType,
      contractStart,
      contractEnd,
    } = req.body;

    const actor = getActor(req);

    const finalName = toNullable(name);
    const finalStatus = toNullable(status) || "Deployed";
    const finalEmploymentType = toNullable(employmentType) || "Permanent";
    const finalCompany =
      finalStatus === "Deployed" ? toNullable(company) : null;

    const finalContractStart =
      finalEmploymentType === "Contractual"
        ? toNullableDate(contractStart)
        : null;

    const finalContractEnd =
      finalEmploymentType === "Contractual"
        ? toNullableDate(contractEnd)
        : null;

    if (!finalName) {
      return res.status(400).json({ error: "Employee name is required." });
    }

    if (finalStatus === "Deployed" && !finalCompany) {
      return res.status(400).json({
        error: "Company is required for deployed employees.",
      });
    }

    if (
      finalEmploymentType === "Contractual" &&
      (!finalContractStart || !finalContractEnd)
    ) {
      return res.status(400).json({
        error:
          "Contract start and end dates are required for contractual employees.",
      });
    }

    const documents = extractDocumentsFromReq(req);

    const [result] = await connection.query(
      `
      INSERT INTO employees
      (name, company, status, employmentType, contractStart, contractEnd)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        finalName,
        finalCompany,
        finalStatus,
        finalEmploymentType,
        finalContractStart,
        finalContractEnd,
      ]
    );

    const employeeId = result.insertId;

    for (const doc of documents) {
      await connection.query(
        `
        INSERT INTO employee_documents
        (employee_id, name, expiration_date, file_path)
        VALUES (?, ?, ?, ?)
        `,
        [employeeId, doc.name, doc.expirationDate, doc.filePath]
      );
    }

    await logAudit({
      userId: actor.userId,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      category: AUDIT_CATEGORY.OPERATIONAL,
      action: "ADD_EMPLOYEE",
      description: `${actor.fullName} added employee record for ${finalName}.`,
    });

    res.status(201).json({
      success: true,
      message: "Employee created successfully.",
      id: employeeId,
    });
  } catch (err) {
    console.error("CREATE EMPLOYEE ERROR:", err);

    res.status(500).json({
      error: err.sqlMessage || err.message || "Create employee error",
    });
  }
};

exports.getEmployees = async (req, res) => {
  try {
    const [employees] = await db.promise().query(`
      SELECT *
      FROM employees
      ORDER BY created_at DESC
    `);

    const [documents] = await db.promise().query(`
      SELECT *
      FROM employee_documents
      ORDER BY id ASC
    `);

    const result = employees.map((emp) => ({
      ...emp,
      documents: documents
        .filter((doc) => Number(doc.employee_id) === Number(emp.id))
        .map((doc) => ({
          id: doc.id,
          name: doc.name,
          expirationDate: doc.expiration_date,
          filePath: doc.file_path,
        })),
    }));

    res.json(result);
  } catch (err) {
    console.error("FETCH EMPLOYEES ERROR:", err);

    res.status(500).json({
      error: err.sqlMessage || err.message || "Fetch employees error",
    });
  }
};

exports.updateEmployee = async (req, res) => {
  const { id } = req.params;
  const connection = db.promise();

  try {
    const {
      name,
      company,
      status,
      employmentType,
      contractStart,
      contractEnd,
    } = req.body;

    const actor = getActor(req);

    const finalName = toNullable(name);
    const finalStatus = toNullable(status) || "Deployed";
    const finalEmploymentType = toNullable(employmentType) || "Permanent";
    const finalCompany =
      finalStatus === "Deployed" ? toNullable(company) : null;

    const finalContractStart =
      finalEmploymentType === "Contractual"
        ? toNullableDate(contractStart)
        : null;

    const finalContractEnd =
      finalEmploymentType === "Contractual"
        ? toNullableDate(contractEnd)
        : null;

    if (!finalName) {
      return res.status(400).json({ error: "Employee name is required." });
    }

    if (finalStatus === "Deployed" && !finalCompany) {
      return res.status(400).json({
        error: "Company is required for deployed employees.",
      });
    }

    if (
      finalEmploymentType === "Contractual" &&
      (!finalContractStart || !finalContractEnd)
    ) {
      return res.status(400).json({
        error:
          "Contract start and end dates are required for contractual employees.",
      });
    }

    await connection.query(
      `
      UPDATE employees
      SET
        name = ?,
        company = ?,
        status = ?,
        employmentType = ?,
        contractStart = ?,
        contractEnd = ?
      WHERE id = ?
      `,
      [
        finalName,
        finalCompany,
        finalStatus,
        finalEmploymentType,
        finalContractStart,
        finalContractEnd,
        id,
      ]
    );

    const [existingDocs] = await connection.query(
      `SELECT * FROM employee_documents WHERE employee_id = ?`,
      [id]
    );

    const frontendDocs = extractDocumentsFromReq(req);

    for (const doc of frontendDocs) {
      const existing = existingDocs.find((item) => item.name === doc.name);

      if (existing) {
        const finalPath = doc.hasNewFile ? doc.filePath : existing.file_path;

        await connection.query(
          `
          UPDATE employee_documents
          SET expiration_date = ?, file_path = ?
          WHERE id = ?
          `,
          [doc.expirationDate, finalPath, existing.id]
        );
      } else {
        await connection.query(
          `
          INSERT INTO employee_documents
          (employee_id, name, expiration_date, file_path)
          VALUES (?, ?, ?, ?)
          `,
          [id, doc.name, doc.expirationDate, doc.filePath]
        );
      }
    }

    for (const existing of existingDocs) {
      const stillChecked = frontendDocs.find(
        (doc) => doc.name === existing.name
      );

      if (!stillChecked) {
        await connection.query(`DELETE FROM employee_documents WHERE id = ?`, [
          existing.id,
        ]);
      }
    }

    await logAudit({
      userId: actor.userId,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      category: AUDIT_CATEGORY.OPERATIONAL,
      action: "UPDATE_EMPLOYEE",
      description: `${actor.fullName} updated employee record for ${finalName}.`,
    });

    res.json({
      success: true,
      message: "Employee updated successfully.",
    });
  } catch (err) {
    console.error("UPDATE EMPLOYEE ERROR:", err);

    res.status(500).json({
      error: err.sqlMessage || err.message || "Update employee error",
    });
  }
};

exports.archiveEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const actor = getActor(req);
    const employeeName = await getEmployeeNameById(id);

    await db.promise().query(`UPDATE employees SET archived = 1 WHERE id = ?`, [
      id,
    ]);

    await logAudit({
      userId: actor.userId,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      category: AUDIT_CATEGORY.OPERATIONAL,
      action: "ARCHIVE_EMPLOYEE",
      description: `${actor.fullName} archived employee record for ${employeeName}.`,
    });

    res.json({
      success: true,
      message: "Employee archived successfully.",
    });
  } catch (err) {
    console.error("ARCHIVE EMPLOYEE ERROR:", err);

    res.status(500).json({
      error: err.sqlMessage || err.message || "Archive employee error",
    });
  }
};

exports.restoreEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const actor = getActor(req);
    const employeeName = await getEmployeeNameById(id);

    await db.promise().query(`UPDATE employees SET archived = 0 WHERE id = ?`, [
      id,
    ]);

    await logAudit({
      userId: actor.userId,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      category: AUDIT_CATEGORY.OPERATIONAL,
      action: "RESTORE_EMPLOYEE",
      description: `${actor.fullName} restored employee record for ${employeeName}.`,
    });

    res.json({
      success: true,
      message: "Employee restored successfully.",
    });
  } catch (err) {
    console.error("RESTORE EMPLOYEE ERROR:", err);

    res.status(500).json({
      error: err.sqlMessage || err.message || "Restore employee error",
    });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const actor = getActor(req);
    const employeeName = await getEmployeeNameById(id);

    await db
      .promise()
      .query(`DELETE FROM employee_documents WHERE employee_id = ?`, [id]);

    await db.promise().query(`DELETE FROM employees WHERE id = ?`, [id]);

    await logAudit({
      userId: actor.userId,
      username: actor.username,
      fullName: actor.fullName,
      role: actor.role,
      category: AUDIT_CATEGORY.OPERATIONAL,
      action: "DELETE_EMPLOYEE",
      description: `${actor.fullName} permanently deleted employee record for ${employeeName}.`,
    });

    res.json({
      success: true,
      message: "Employee permanently deleted.",
    });
  } catch (err) {
    console.error("DELETE EMPLOYEE ERROR:", err);

    res.status(500).json({
      error: err.sqlMessage || err.message || "Delete employee error",
    });
  }
};