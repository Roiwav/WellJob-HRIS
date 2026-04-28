const db = require("../config/db");

// 🔥 HELPER FUNCTION
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
    const filePath = file ? file.path.replace(/\\/g, "/") : null;

    if (docName || file) {
      documents.push({
        name: docName || (file ? file.originalname : "Unknown"),
        expirationDate: expDate || null,
        filePath: filePath,
        hasNewFile: !!file
      });
    }
  }
  return documents;
};

// ✅ CREATE EMPLOYEE
exports.createEmployee = async (req, res) => {
  try {
    const { name, company, status, employmentType, contractStart, contractEnd } = req.body;
    const documents = extractDocumentsFromReq(req);

    const [result] = await db.promise().query(
      `INSERT INTO employees (name, company, status, employmentType, contractStart, contractEnd)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [name, company, status, employmentType, contractStart, contractEnd]
    );

    const employeeId = result.insertId;

    for (const doc of documents) {
      await db.promise().query(
        `INSERT INTO employee_documents (employee_id, name, expiration_date, file_path)
        VALUES (?, ?, ?, ?)`,
        [employeeId, doc.name, doc.expirationDate, doc.filePath]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error("CREATE ERROR:", err);
    res.status(500).json({ error: "Create employee error" });
  }
};

// ✅ GET EMPLOYEES
exports.getEmployees = async (req, res) => {
  try {
    const [employees] = await db.promise().query("SELECT * FROM employees");
    const [documents] = await db.promise().query("SELECT * FROM employee_documents");

    const result = employees.map((emp) => ({
      ...emp,
      documents: documents
        .filter((d) => d.employee_id === emp.id)
        .map((doc) => ({
          name: doc.name,
          expirationDate: doc.expiration_date,
          filePath: doc.file_path,
        })),
    }));

    res.json(result);
  } catch (err) {
    console.error("FETCH ERROR:", err);
    res.status(500).json({ error: "Fetch error" });
  }
};

// ✅ UPDATE EMPLOYEE (Kasama yung logic para burahin ang in-uncheck na checkbox)
exports.updateEmployee = async (req, res) => {
  const { id } = req.params;
  try {
    const { name, company, status, employmentType, contractStart, contractEnd } = req.body;

    await db.promise().query(
      `UPDATE employees SET name=?, company=?, status=?, employmentType=?, contractStart=?, contractEnd=? WHERE id=?`,
      [name, company, status, employmentType, contractStart, contractEnd, id]
    );

    const [existingDocs] = await db.promise().query(
      "SELECT * FROM employee_documents WHERE employee_id=?", [id]
    );

    const frontendDocs = extractDocumentsFromReq(req);

    for (const doc of frontendDocs) {
      const existing = existingDocs.find((d) => d.name === doc.name);
      if (existing) {
        const finalPath = doc.hasNewFile ? doc.filePath : existing.file_path;
        await db.promise().query(
          `UPDATE employee_documents SET expiration_date=?, file_path=? WHERE id=?`,
          [doc.expirationDate, finalPath, existing.id]
        );
      } else {
        await db.promise().query(
          `INSERT INTO employee_documents (employee_id, name, expiration_date, file_path) VALUES (?, ?, ?, ?)`,
          [id, doc.name, doc.expirationDate, doc.filePath]
        );
      }
    }

    // Burahin sa database yung mga documents na in-uncheck sa frontend
    for (const existing of existingDocs) {
      const stillChecked = frontendDocs.find((d) => d.name === existing.name);
      if (!stillChecked) {
        await db.promise().query(`DELETE FROM employee_documents WHERE id=?`, [existing.id]);
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ error: "Update error" });
  }
};

// ✅ ARCHIVE EMPLOYEE
exports.archiveEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    await db.promise().query("UPDATE employees SET archived = true WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("ARCHIVE ERROR:", err);
    res.status(500).json({ error: "Archive error" });
  }
};

// ✅ RESTORE EMPLOYEE
exports.restoreEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    await db.promise().query("UPDATE employees SET archived = false WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("RESTORE ERROR:", err);
    res.status(500).json({ error: "Restore error" });
  }
};

// ✅ PERMANENTLY DELETE EMPLOYEE
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    await db.promise().query("DELETE FROM employee_documents WHERE employee_id = ?", [id]);
    await db.promise().query("DELETE FROM employees WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: "Delete error" });
  }
};