const db = require("../config/db");

// ✅ CREATE EMPLOYEE
exports.createEmployee = async (req, res) => {
  try {
    const {
      name,
      company,
      status,
      employmentType,
      contractStart,
      contractEnd,
    } = req.body;

    const documents = [];

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        const cleanPath = file.path.replace(/\\/g, "/");

        const match = file.fieldname.match(/documents\[(\d+)\]/);
        const index = match ? match[1] : null;

        const nameKey = `documents[${index}][name]`;
        const expKey = `documents[${index}][expirationDate]`;

        documents.push({
          name: req.body[nameKey] || file.originalname,
          expirationDate: req.body[expKey] || null,
          filePath: cleanPath,
        });
      });
    }

    const [result] = await db.promise().query(
      `INSERT INTO employees 
      (name, company, status, employmentType, contractStart, contractEnd)
      VALUES (?, ?, ?, ?, ?, ?)`,
      [name, company, status, employmentType, contractStart, contractEnd]
    );

    const employeeId = result.insertId;

    for (const doc of documents) {
      await db.promise().query(
        `INSERT INTO employee_documents 
        (employee_id, name, expiration_date, file_path)
        VALUES (?, ?, ?, ?)`,
        [employeeId, doc.name, doc.expirationDate, doc.filePath]
      );
    }

    res.json({ success: true, documents });

  } catch (err) {
    console.error("CREATE ERROR:", err);
    res.status(500).json({ error: "Create employee error" });
  }
};

// ✅ GET EMPLOYEES
exports.getEmployees = async (req, res) => {
  try {
    const [employees] = await db.promise().query("SELECT * FROM employees");

    const [documents] = await db.promise().query(
      "SELECT * FROM employee_documents"
    );

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

// ✅ UPDATE EMPLOYEE (FINAL FIXED VERSION)
exports.updateEmployee = async (req, res) => {
  const { id } = req.params;

  try {
    const {
      name,
      company,
      status,
      employmentType,
      contractStart,
      contractEnd,
    } = req.body;

    // 🔥 UPDATE BASIC INFO
    await db.promise().query(
      `UPDATE employees SET 
        name=?, company=?, status=?, employmentType=?, contractStart=?, contractEnd=?
       WHERE id=?`,
      [name, company, status, employmentType, contractStart, contractEnd, id]
    );

    // 🔥 PROCESS FILES
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const cleanPath = file.path.replace(/\\/g, "/");

        const match = file.fieldname.match(/documents\[(\d+)\]/);
        const index = match ? match[1] : null;

        const nameKey = `documents[${index}][name]`;
        const expKey = `documents[${index}][expirationDate]`;

        const docName = req.body[nameKey] || file.originalname;
        const expiration = req.body[expKey] || null;

        // 🔥 CHECK IF DOCUMENT EXISTS
        const [existing] = await db.promise().query(
          `SELECT id FROM employee_documents 
           WHERE employee_id=? AND name=?`,
          [id, docName]
        );

        if (existing.length > 0) {
          // ✅ UPDATE EXISTING DOCUMENT
          await db.promise().query(
            `UPDATE employee_documents 
             SET expiration_date=?, file_path=? 
             WHERE id=?`,
            [expiration, cleanPath, existing[0].id]
          );
        } else {
          // ✅ INSERT NEW DOCUMENT
          await db.promise().query(
            `INSERT INTO employee_documents 
             (employee_id, name, expiration_date, file_path)
             VALUES (?, ?, ?, ?)`,
            [id, docName, expiration, cleanPath]
          );
        }
      }
    }

    res.json({ success: true });

  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ error: "Update error" });
  }
};