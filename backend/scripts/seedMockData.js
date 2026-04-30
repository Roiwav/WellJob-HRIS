const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const EMPLOYEE_COUNT = 1000;

// WARNING:
// false = append mock data
// true = delete all existing employee, document, and incident data first
// Recommended: true muna para mabura yung old data na maraming violations
const CLEAR_EXISTING_DATA = true;

const START_YEAR = 2020;
const END_YEAR = 2026;

// Only 1 to 10 total employees will have violations/incidents
const MIN_INCIDENT_EMPLOYEES = 1;
const MAX_INCIDENT_EMPLOYEES = 10;

const REQUIRED_DOCUMENTS = [
  "Resume",
  "NSO/PSA",
  "SSS (ID or E1 form)",
  "Pag-IBIG (ID or MDRF Form)",
  "PhilHealth (ID or MDF Form)",
  "Diploma",
  "Cedula",
  "Barangay Clearance",
  "NBI/Police Clearance",
];

const EXPIRABLE_DOCUMENTS = ["Barangay Clearance", "NBI/Police Clearance"];

const FIRST_NAMES = [
  "Juan",
  "Maria",
  "Jose",
  "Ana",
  "Mark",
  "Angelica",
  "John",
  "Christian",
  "Jessa",
  "Rica",
  "Carlo",
  "Jerome",
  "Marvin",
  "Princess",
  "Grace",
  "Joshua",
  "Arnel",
  "Jayson",
  "Rodel",
  "Christine",
  "Michelle",
  "Ramon",
  "Glenda",
  "Kimberly",
  "Dennis",
  "Ronald",
  "Catherine",
  "Alvin",
  "Marlon",
  "Shiela",
];

const MIDDLE_INITIALS = [
  "A.",
  "B.",
  "C.",
  "D.",
  "E.",
  "F.",
  "G.",
  "M.",
  "R.",
  "S.",
];

const LAST_NAMES = [
  "Dela Cruz",
  "Santos",
  "Reyes",
  "Garcia",
  "Mendoza",
  "Ramos",
  "Torres",
  "Flores",
  "Gonzales",
  "Bautista",
  "Villanueva",
  "Castillo",
  "Aquino",
  "Cruz",
  "Morales",
  "Navarro",
  "Domingo",
  "Rivera",
  "Mercado",
  "Salazar",
];

const COMPANIES = [
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
  "Toyota Philippines",
  "Honda Philippines",
  "Accenture Philippines",
  "Concentrix Philippines",
];

const VIOLATIONS = [
  {
    violation: "Tardiness",
    severity: "Minor",
    action: "Verbal or written warning",
    recommendation: "Monitor Employee",
  },
  {
    violation: "Absenteeism without proper notice",
    severity: "Major",
    action: "Written warning or suspension review",
    recommendation: "Final Warning",
  },
  {
    violation: "Negligence of duty",
    severity: "Major",
    action: "Suspension review",
    recommendation: "Suspension Review",
  },
  {
    violation: "Improper uniform or grooming violation",
    severity: "Minor",
    action: "Warning",
    recommendation: "Monitor Employee",
  },
  {
    violation: "Insubordination",
    severity: "Critical",
    action: "Administrative review",
    recommendation: "Suspension Review",
  },
  {
    violation: "Workplace misconduct",
    severity: "Critical",
    action: "Disciplinary review",
    recommendation: "Termination Review",
  },
  {
    violation: "Failure to follow company policy",
    severity: "Major",
    action: "Final warning",
    recommendation: "Final Warning",
  },
];

const INCIDENT_STATUSES = ["Open", "Investigating", "For Review", "Closed"];

const COMPLIANCE_TYPES = [
  "Complete Compliance",
  "Incomplete Compliance",
  "Expired Document",
  "Expiring Soon",
];

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function chance(percent) {
  return Math.random() * 100 < percent;
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function randomDateBetweenYears(startYear, endYear) {
  const year = randomInt(startYear, endYear);
  const month = randomInt(1, 12);
  const day = randomInt(1, 28);

  return `${year}-${pad(month)}-${pad(day)}`;
}

function addDays(dateString, days) {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeFullName() {
  return `${randomItem(FIRST_NAMES)} ${randomItem(MIDDLE_INITIALS)} ${randomItem(
    LAST_NAMES
  )}`;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getComplianceType() {
  const roll = randomInt(1, 100);

  // Majority complete/good compliance
  if (roll <= 60) return "Complete Compliance";

  // Some employees have incomplete documents
  if (roll <= 78) return "Incomplete Compliance";

  // Some employees have expired documents
  if (roll <= 90) return "Expired Document";

  // Some employees have incoming expiration
  return "Expiring Soon";
}

function createIncidentEmployeeIndexes() {
  const totalIncidentEmployees = randomInt(
    MIN_INCIDENT_EMPLOYEES,
    Math.min(MAX_INCIDENT_EMPLOYEES, EMPLOYEE_COUNT)
  );

  const indexes = new Set();

  while (indexes.size < totalIncidentEmployees) {
    indexes.add(randomInt(1, EMPLOYEE_COUNT));
  }

  return indexes;
}

function createMockPdfFile() {
  const mockDir = path.join(__dirname, "..", "documents", "mock");
  const mockPdf = path.join(mockDir, "mock-document.pdf");

  if (!fs.existsSync(mockDir)) {
    fs.mkdirSync(mockDir, { recursive: true });
  }

  if (!fs.existsSync(mockPdf)) {
    const minimalPdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 144] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 55 >>
stream
BT
/F1 12 Tf
30 100 Td
(Mock compliance document) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000060 00000 n 
0000000117 00000 n 
0000000209 00000 n 
trailer
<< /Root 1 0 R /Size 5 >>
startxref
315
%%EOF`;

    fs.writeFileSync(mockPdf, minimalPdf);
  }

  return "documents/mock/mock-document.pdf";
}

async function clearExistingData(connection) {
  await connection.query("SET FOREIGN_KEY_CHECKS = 0");

  await connection.query("DELETE FROM incident_evidence");
  await connection.query("DELETE FROM incidents");
  await connection.query("DELETE FROM employee_documents");
  await connection.query("DELETE FROM employees");

  await connection.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function insertEmployee(connection, index) {
  const createdAt = randomDateBetweenYears(START_YEAR, END_YEAR);

  const status = chance(72) ? "Deployed" : "Floating / Standby";
  const employmentType = chance(65) ? "Contractual" : "Permanent";
  const company = status === "Deployed" ? randomItem(COMPANIES) : null;

  const contractStart =
    status === "Deployed" ? addDays(createdAt, randomInt(0, 30)) : null;

  const contractEnd =
    employmentType === "Contractual" && contractStart
      ? addDays(contractStart, randomInt(90, 540))
      : null;

  const name = makeFullName();

  const [result] = await connection.query(
    `
    INSERT INTO employees
    (
      name,
      company,
      status,
      employmentType,
      contractStart,
      contractEnd,
      archived,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      name,
      company,
      status,
      employmentType,
      contractStart,
      contractEnd,
      0,
      `${createdAt} 08:${pad(randomInt(0, 59))}:00`,
    ]
  );

  return {
    id: result.insertId,
    name,
    company,
    status,
    employmentType,
    contractStart,
    contractEnd,
    createdAt,
    index,
  };
}

async function insertDocuments(connection, employee, mockFilePath) {
  const complianceType = getComplianceType();
  const today = getTodayDate();

  const missingDocs = new Set();
  const affectedExpirableDoc = randomItem(EXPIRABLE_DOCUMENTS);

  if (complianceType === "Incomplete Compliance") {
    const missingCount = randomInt(1, 3);

    while (missingDocs.size < missingCount) {
      missingDocs.add(randomItem(REQUIRED_DOCUMENTS));
    }
  }

  for (const docName of REQUIRED_DOCUMENTS) {
    const hasFile = !missingDocs.has(docName);

    let expirationDate = null;

    if (EXPIRABLE_DOCUMENTS.includes(docName)) {
      if (
        complianceType === "Expired Document" &&
        docName === affectedExpirableDoc
      ) {
        // Expired document
        expirationDate = addDays(today, -randomInt(1, 180));
      } else if (
        complianceType === "Expiring Soon" &&
        docName === affectedExpirableDoc
      ) {
        // Incoming expiration within 1 to 30 days
        expirationDate = addDays(today, randomInt(1, 30));
      } else {
        // Valid document
        expirationDate = addDays(today, randomInt(31, 365));
      }
    }

    await connection.query(
      `
      INSERT INTO employee_documents
      (employee_id, name, expiration_date, file_path)
      VALUES (?, ?, ?, ?)
      `,
      [employee.id, docName, expirationDate, hasFile ? mockFilePath : null]
    );
  }

  return complianceType;
}

async function insertIncidents(connection, employee, shouldHaveIncident) {
  // Most employees are good/no violation
  if (!shouldHaveIncident) return 0;

  // Only 1 incident per selected employee para 1 to 10 total lang
  const rule = randomItem(VIOLATIONS);

  const incidentDate = randomDateBetweenYears(
    Math.max(START_YEAR, Number(employee.createdAt.slice(0, 4))),
    END_YEAR
  );

  const status = randomItem(INCIDENT_STATUSES);

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
      resolution_notes,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      employee.id,
      employee.name,
      employee.company || "Unassigned",
      rule.violation,
      rule.severity,
      status,
      incidentDate,
      employee.company || "Office / Client Site",
      `Mock incident record for ${rule.violation.toLowerCase()}. Generated for testing KPI and dashboard analytics.`,
      "System Seeder",
      rule.action,
      rule.recommendation,
      status === "Closed" ? "Mock case closed for testing." : null,
      `${incidentDate} ${pad(randomInt(8, 17))}:${pad(randomInt(0, 59))}:00`,
      `${incidentDate} ${pad(randomInt(8, 17))}:${pad(randomInt(0, 59))}:00`,
    ]
  );

  return 1;
}

async function seedMockData() {
  const connection = db.promise();
  const mockFilePath = createMockPdfFile();

  try {
    console.log("Starting mock data seed...");

    if (CLEAR_EXISTING_DATA) {
      console.log("Clearing existing employee, document, and incident data...");
      await clearExistingData(connection);
    }

    const incidentEmployeeIndexes = createIncidentEmployeeIndexes();

    let createdEmployees = 0;
    let createdDocuments = 0;
    let createdIncidents = 0;

    const complianceStats = {
      "Complete Compliance": 0,
      "Incomplete Compliance": 0,
      "Expired Document": 0,
      "Expiring Soon": 0,
    };

    for (let i = 1; i <= EMPLOYEE_COUNT; i++) {
      const employee = await insertEmployee(connection, i);

      const complianceType = await insertDocuments(
        connection,
        employee,
        mockFilePath
      );

      complianceStats[complianceType] += 1;

      const incidentCreated = await insertIncidents(
        connection,
        employee,
        incidentEmployeeIndexes.has(i)
      );

      createdIncidents += incidentCreated;
      createdEmployees += 1;
      createdDocuments += REQUIRED_DOCUMENTS.length;

      if (i % 100 === 0) {
        console.log(`Seeded ${i}/${EMPLOYEE_COUNT} employees...`);
      }
    }

    console.log("Mock data seed completed!");
    console.log(`Employees created: ${createdEmployees}`);
    console.log(`Documents created: ${createdDocuments}`);
    console.log(`Incidents created: ${createdIncidents}`);
    console.log(`Employees with violations: ${incidentEmployeeIndexes.size}`);
    console.log("Years covered:", `${START_YEAR} - ${END_YEAR}`);

    console.log("Compliance Summary:");
    console.log(
      `Complete Compliance: ${complianceStats["Complete Compliance"]}`
    );
    console.log(
      `Incomplete Compliance: ${complianceStats["Incomplete Compliance"]}`
    );
    console.log(`Expired Document: ${complianceStats["Expired Document"]}`);
    console.log(`Expiring Soon: ${complianceStats["Expiring Soon"]}`);

    console.log("Most employees have good/no incident records.");

    process.exit(0);
  } catch (error) {
    console.error("SEED MOCK DATA ERROR:", error);
    process.exit(1);
  }
}

seedMockData();