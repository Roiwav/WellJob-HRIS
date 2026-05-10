const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const connection = db.promise();

const COMPANY_OPTIONS = [
  "SM Supermalls",
  "Robinsons Retail Holdings",
  "Ayala Land Inc.",
  "Jollibee Foods Corporation",
  "San Miguel Corporation",
  "PLDT Inc.",
  "Globe Telecom",
  "BDO Unibank",
  "Metrobank",
  "Puregold Price Club",
  "Wilcon Depot",
  "DMCI Holdings",
  "Megaworld Corporation",
  "Unilab Inc.",
  "Nestlé Philippines",
  "Coca-Cola Philippines",
  "Pepsi-Cola Products Philippines",
  "Toyota Philippines",
  "Honda Philippines",
  "Accenture Philippines",
  "IBM Philippines",
  "Teleperformance Philippines",
  "Concentrix Philippines",
  "Sitel Philippines",
];

const DOCUMENTS = [
  {
    name: "Resume",
    expirable: false,
  },
  {
    name: "NSO/PSA",
    expirable: false,
  },
  {
    name: "SSS (ID or E1 form)",
    expirable: false,
  },
  {
    name: "Pag-IBIG (ID or MDRF Form)",
    expirable: false,
  },
  {
    name: "PhilHealth (ID or MDF Form)",
    expirable: false,
  },
  {
    name: "Diploma",
    expirable: false,
  },
  {
    name: "Cedula",
    expirable: false,
  },
  {
    name: "Barangay Clearance",
    expirable: true,
  },
  {
    name: "NBI/Police Clearance",
    expirable: true,
  },
];

const FIRST_NAMES = [
  "Juan",
  "Maria",
  "Jose",
  "Ana",
  "Ramon",
  "Glenda",
  "Mark",
  "Angelica",
  "Carlo",
  "Jasmine",
  "Daniel",
  "Michelle",
  "Paolo",
  "Kristine",
  "Jerome",
  "Nicole",
  "Ryan",
  "Erika",
  "Joshua",
  "Camille",
  "John",
  "Yuri",
  "Jamil",
  "Shirleen",
  "Nookie",
  "Lara",
  "Bianca",
  "Patrick",
  "Louie",
  "Kathleen",
];

const MIDDLE_INITIALS = [
  "A.",
  "B.",
  "C.",
  "D.",
  "E.",
  "F.",
  "G.",
  "H.",
  "M.",
  "R.",
  "S.",
  "T.",
];

const LAST_NAMES = [
  "Dela Cruz",
  "Santos",
  "Reyes",
  "Garcia",
  "Mendoza",
  "Torres",
  "Ramos",
  "Aquino",
  "Flores",
  "Gonzales",
  "Cruz",
  "Bautista",
  "Rivera",
  "Castillo",
  "Marquez",
  "Valdez",
  "Navarro",
  "Salazar",
  "Domingo",
  "Villanueva",
  "Dalman",
  "Posas",
  "Cangas",
  "Bascos",
];

const VIOLATIONS = {
  ABSENCE: "Absence without notice",
  TARDINESS: "Tardiness",
  NEGLECT: "Neglect of Duty",
  MISCONDUCT: "Misconduct",
  NO_ID: "No ID",
  UNIFORM: "Improper Uniform",
};

function pad(number, size = 3) {
  return String(number).padStart(size, "0");
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function randomDateInYear(year) {
  const month = Math.floor(Math.random() * 12);
  const day = Math.floor(Math.random() * 24) + 1;
  return formatDate(new Date(year, month, day));
}

function makeName(index) {
  const zeroBasedIndex = index - 1;

  const first =
    FIRST_NAMES[zeroBasedIndex % FIRST_NAMES.length];

  const middle =
    MIDDLE_INITIALS[
      Math.floor(zeroBasedIndex / FIRST_NAMES.length) %
        MIDDLE_INITIALS.length
    ];

  const last =
    LAST_NAMES[
      Math.floor(
        zeroBasedIndex / (FIRST_NAMES.length * MIDDLE_INITIALS.length)
      ) % LAST_NAMES.length
    ];

  return `${first} ${middle} ${last}`;
}

function getDocumentsDirectory() {
  return path.join(__dirname, "..", "documents", "employees");
}

function ensureDemoFiles() {
  const documentsDir = getDocumentsDirectory();

  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
  }

  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 65 >>
stream
BT
/F1 12 Tf
40 120 Td
(Mock compliance document for Welljob demo.) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000210 00000 n 
trailer
<< /Root 1 0 R /Size 5 >>
startxref
325
%%EOF`;

  const files = {
    valid: "mock-valid-compliance.pdf",
    expiring: "mock-expiring-compliance.pdf",
    expired: "mock-expired-compliance.pdf",
    permanent: "mock-permanent-compliance.pdf",
  };

  Object.values(files).forEach((fileName) => {
    const filePath = path.join(documentsDir, fileName);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, pdfContent, "utf8");
    }
  });

  return {
    valid: `documents/employees/${files.valid}`,
    expiring: `documents/employees/${files.expiring}`,
    expired: `documents/employees/${files.expired}`,
    permanent: `documents/employees/${files.permanent}`,
  };
}

async function tableExists(tableName) {
  const [rows] = await connection.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function clearTableIfExists(tableName) {
  const exists = await tableExists(tableName);

  if (!exists) {
    console.log(`Skipped missing table: ${tableName}`);
    return;
  }

  await connection.query(`DELETE FROM \`${tableName}\``);

  try {
    await connection.query(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = 1`);
  } catch {
    // Some tables may not have AUTO_INCREMENT. Safe to ignore.
  }

  console.log(`Cleared table: ${tableName}`);
}

async function clearMockData() {
  console.log("Clearing old demo data...");

  await connection.query("SET FOREIGN_KEY_CHECKS = 0");

  const tablesToClear = [
    "smart_suggestion_states",
    "smart_alert_states",
    "notifications",
    "audit_logs",
    "kpi_decision_history",
    "incident_evidence",
    "incidents",
    "deployments",
    "employee_documents",
    "employees",
  ];

  for (const table of tablesToClear) {
    await clearTableIfExists(table);
  }

  await connection.query("SET FOREIGN_KEY_CHECKS = 1");
}

function buildEmployees() {
  const employees = [];

  // 2025: 400 deployed employees
  for (let i = 1; i <= 400; i++) {
    employees.push({
      name: makeName(i),
      company: COMPANY_OPTIONS[(i - 1) % COMPANY_OPTIONS.length],
      status: "Deployed",
      contractStart: randomDateInYear(2025),
      cohort: "2025",
      demoTag: "VALID",
    });
  }

  // 2026: 600 employees, 590 deployed + 10 floating
  for (let i = 401; i <= 1000; i++) {
    const yearIndex = i - 400;
    const isFloating = yearIndex > 590;

    employees.push({
      name:
        yearIndex === 1
          ? "Ramon M. Marquez"
          : makeName(i),
      company:
        yearIndex === 1
          ? "DMCI Holdings"
          : isFloating
          ? null
          : COMPANY_OPTIONS[(i - 1) % COMPANY_OPTIONS.length],
      status: isFloating ? "Floating / Standby" : "Deployed",
      contractStart: randomDateInYear(2026),
      cohort: "2026",
      demoTag: "VALID",
    });
  }

  // 2026 compliance demo cases
// These are deployed employees from 2026.

// 10 incomplete compliance records
for (let index = 410; index < 420; index++) {
  employees[index].demoTag = "INCOMPLETE";
}

// 2 no data compliance records
employees[420].demoTag = "NO_DATA";
employees[421].demoTag = "NO_DATA";

// 3 expiring soon compliance records
employees[422].demoTag = "EXPIRING_SOON";
employees[423].demoTag = "EXPIRING_SOON";
employees[424].demoTag = "EXPIRING_SOON";

// 1 expired compliance record
employees[425].demoTag = "EXPIRED";
  return employees;
}

async function insertEmployees(employees) {
  const values = employees.map((employee) => [
    employee.name,
    employee.company,
    employee.status,
    employee.contractStart,
  ]);

  const [result] = await connection.query(
    `
    INSERT INTO employees
      (name, company, status, contractStart)
    VALUES ?
    `,
    [values]
  );

  return employees.map((employee, index) => ({
    ...employee,
    id: result.insertId + index,
  }));
}

function buildDocumentRows(employees, filePaths) {
  const today = new Date();

  const validExpiry = formatDate(addDays(today, 365));
  const expiringSoon = formatDate(addDays(today, 15));
  const expired = formatDate(addDays(today, -20));

  const rows = [];

  for (const employee of employees) {
    if (employee.demoTag === "NO_DATA") {
      continue;
    }

    for (const doc of DOCUMENTS) {
      let filePath = doc.expirable ? filePaths.valid : filePaths.permanent;
      let expirationDate = doc.expirable ? validExpiry : null;

      if (employee.demoTag === "INCOMPLETE") {
        if (doc.name === "NBI/Police Clearance" || doc.name === "Medical Certificate") {
          filePath = null;
        }
      }

      if (employee.demoTag === "EXPIRING_SOON" && doc.name === "Barangay Clearance") {
        filePath = filePaths.expiring;
        expirationDate = expiringSoon;
      }

      if (employee.demoTag === "EXPIRED" && doc.name === "Barangay Clearance") {
        filePath = filePaths.expired;
        expirationDate = expired;
      }

      rows.push([
        employee.id,
        doc.name,
        expirationDate,
        filePath,
      ]);
    }
  }

  return rows;
}

async function insertDocuments(documentRows) {
  if (!documentRows.length) return;

  await connection.query(
    `
    INSERT INTO employee_documents
      (employee_id, name, expiration_date, file_path)
    VALUES ?
    `,
    [documentRows]
  );
}

function getEmployeesByCohort(employees, cohort) {
  return employees.filter((employee) => employee.cohort === cohort);
}

function getDeployedEmployeesByCohort(employees, cohort) {
  return employees.filter(
    (employee) => employee.cohort === cohort && employee.status === "Deployed"
  );
}

function makeIncidentRow({
  employee,
  violation,
  severity,
  status,
  incidentDate,
  location,
  description,
  reportedBy = "HR Demo Seeder",
  actionTaken = null,
  recommendation = null,
  resolutionNotes = null,
}) {
  if (!employee) {
    throw new Error("Incident seed error: employee is required.");
  }

  if (employee.status !== "Deployed") {
    throw new Error(
      `Incident seed error: Floating employee cannot have incident. Employee: ${employee.name}`
    );
  }

  return [
    employee.id,
    employee.name,
    employee.company,
    violation,
    severity,
    status,
    incidentDate,
    location,
    description,
    reportedBy,
    actionTaken,
    recommendation,
    resolutionNotes,
  ];
}

function buildIncidents(employees) {
  const incidents = [];

  const employees2025 = getDeployedEmployeesByCohort(employees, "2025");
  const employees2026 = getDeployedEmployeesByCohort(employees, "2026");

  // 2025: 20 closed cases
  for (let i = 0; i < 20; i++) {
    const employee = employees2025[i * 7];

    incidents.push(
      makeIncidentRow({
        employee,
        violation: randomItem([
          VIOLATIONS.TARDINESS,
          VIOLATIONS.NO_ID,
          VIOLATIONS.UNIFORM,
          VIOLATIONS.NEGLECT,
        ]),
        severity: randomItem(["Minor", "Minor", "Major"]),
        status: "Closed",
        incidentDate: randomDateInYear(2025),
        location: employee.company,
        description:
          "Closed 2025 demo case used for historical incident trend and case resolution display.",
        actionTaken: "Case reviewed and documented.",
        recommendation: "Monitor employee record.",
        resolutionNotes: "Resolved and closed for demo data.",
      })
    );
  }

  // 2026: one employee with repeated active pattern
  const repeatedEmployee = employees2026.find(
    (employee) => employee.name === "Ramon M. Marquez"
  );

  const repeatedDates = [
    "2026-01-12",
    "2026-02-04",
    "2026-03-08",
    "2026-04-11",
    "2026-05-02",
  ];

  repeatedDates.forEach((date, index) => {
    incidents.push(
      makeIncidentRow({
        employee: repeatedEmployee,
        violation: VIOLATIONS.ABSENCE,
        severity: index >= 3 ? "Major" : "Minor",
        status: index % 2 === 0 ? "Open" : "Investigating",
        incidentDate: date,
        location: repeatedEmployee.company,
        description:
          "Repeated attendance-related case for demo. This pattern should trigger KPI risk and Smart Suggestions.",
        actionTaken: "For HR review",
        recommendation:
          "Review attendance pattern and consider reserve manpower if needed.",
        resolutionNotes: null,
      })
    );
  });

  // 2026: 2 closed random cases
  for (let i = 0; i < 2; i++) {
    const employee = employees2026[50 + i * 25];

    incidents.push(
      makeIncidentRow({
        employee,
        violation: randomItem([VIOLATIONS.NO_ID, VIOLATIONS.TARDINESS]),
        severity: "Minor",
        status: "Closed",
        incidentDate: randomDateInYear(2026),
        location: employee.company,
        description:
          "Closed 2026 demo case used for current year incident history.",
        actionTaken: "Warning issued and documented.",
        recommendation: "Retain and monitor employee.",
        resolutionNotes: "Resolved and closed.",
      })
    );
  }

  return incidents;
}

async function insertIncidents(incidentRows) {
  if (!incidentRows.length) return;

  await connection.query(
    `
    INSERT INTO incidents
      (
        employee_id,
        employee_name,
        company,
        violation_type,
        severity,
        status,
        incident_date,
        location,
        description,
        reported_by,
        action_taken,
        recommendation,
        resolution_notes
      )
    VALUES ?
    `,
    [incidentRows]
  );
}

async function printSummary() {
  const [[employeeCount]] = await connection.query(`
    SELECT COUNT(*) AS total FROM employees
  `);

  const [[employees2025]] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM employees
    WHERE YEAR(contractStart) = 2025
  `);

  const [[employees2026]] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM employees
    WHERE YEAR(contractStart) = 2026
  `);

  const [[floating2026]] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM employees
    WHERE YEAR(contractStart) = 2026
      AND status = 'Floating / Standby'
  `);

  const [[deployed2026]] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM employees
    WHERE YEAR(contractStart) = 2026
      AND status = 'Deployed'
  `);

  const [[closed2025]] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM incidents
    WHERE YEAR(incident_date) = 2025
      AND status = 'Closed'
  `);

  const [[active2026]] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM incidents
    WHERE YEAR(incident_date) = 2026
      AND status IN ('Open', 'Investigating', 'For Review')
  `);

  const [[closed2026]] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM incidents
    WHERE YEAR(incident_date) = 2026
      AND status = 'Closed'
  `);

  const [[documentRows]] = await connection.query(`
    SELECT COUNT(*) AS total
    FROM employee_documents
  `);

  console.log("\nSeed completed successfully.");
  console.log("--------------------------------");
  console.log(`Employees total: ${employeeCount.total}`);
  console.log(`2025 employees: ${employees2025.total}`);
  console.log(`2026 employees: ${employees2026.total}`);
  console.log(`2026 deployed: ${deployed2026.total}`);
  console.log(`2026 floating: ${floating2026.total}`);
  console.log(`2025 closed incidents: ${closed2025.total}`);
  console.log(`2026 active incidents: ${active2026.total}`);
  console.log(`2026 closed incidents: ${closed2026.total}`);
  console.log(`Employee document rows: ${documentRows.total}`);
  console.log("--------------------------------");
  console.log("Demo pattern employee: Ramon M. Marquez");
  console.log("Repeated pattern: 5 active absence-related incidents");
  console.log("2026 compliance demo cases:");
  console.log("- 10 incomplete compliance");
  console.log("- 2 no data compliance");
  console.log("- 3 expiring soon");
  console.log("- 1 expired");
}

async function main() {
  try {
    console.log("Starting Welljob 1000 employee demo seed...");

    await clearMockData();

    const filePaths = ensureDemoFiles();

    const employees = buildEmployees();
    const insertedEmployees = await insertEmployees(employees);

    const documentRows = buildDocumentRows(insertedEmployees, filePaths);
    await insertDocuments(documentRows);

    const incidentRows = buildIncidents(insertedEmployees);
    await insertIncidents(incidentRows);

    await printSummary();

    console.log("\nRun finished. You may now refresh the frontend.");
  } catch (error) {
    console.error("\nSEED MOCK DATA ERROR:");
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (typeof db.end === "function") {
      db.end();
    }
  }
}

main();