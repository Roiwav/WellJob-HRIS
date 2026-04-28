const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const EMPLOYEE_COUNT = 1000;

// WARNING:
// false = append mock data
// true = delete all existing employee, document, incident data first
const CLEAR_EXISTING_DATA = false;

const START_YEAR = 2020;
const END_YEAR = 2026;

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
  for (const docName of REQUIRED_DOCUMENTS) {
    // 85% chance may uploaded compliance document
    const hasFile = chance(85);

    let expirationDate = null;

    if (EXPIRABLE_DOCUMENTS.includes(docName)) {
      // Random expired, expiring soon, or future document
      if (chance(15)) {
        expirationDate = addDays(new Date().toISOString().slice(0, 10), -randomInt(1, 180));
      } else if (chance(25)) {
        expirationDate = addDays(new Date().toISOString().slice(0, 10), randomInt(1, 30));
      } else {
        expirationDate = addDays(new Date().toISOString().slice(0, 10), randomInt(31, 365));
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
}

async function insertIncidents(connection, employee) {
  // 55% employees no incidents, 45% may incident
  if (chance(55)) return;

  const incidentCount = randomInt(1, 5);

  for (let i = 0; i < incidentCount; i++) {
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
  }
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

    let createdEmployees = 0;
    let createdDocuments = 0;

    for (let i = 1; i <= EMPLOYEE_COUNT; i++) {
      const employee = await insertEmployee(connection, i);
      await insertDocuments(connection, employee, mockFilePath);
      await insertIncidents(connection, employee);

      createdEmployees += 1;
      createdDocuments += REQUIRED_DOCUMENTS.length;

      if (i % 100 === 0) {
        console.log(`Seeded ${i}/${EMPLOYEE_COUNT} employees...`);
      }
    }

    console.log("Mock data seed completed!");
    console.log(`Employees created: ${createdEmployees}`);
    console.log(`Documents created: ${createdDocuments}`);
    console.log("Incidents created: random per employee");
    console.log("Years covered:", `${START_YEAR} - ${END_YEAR}`);

    process.exit(0);
  } catch (error) {
    console.error("SEED MOCK DATA ERROR:", error);
    process.exit(1);
  }
}

seedMockData();