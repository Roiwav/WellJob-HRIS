const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const EMPLOYEE_COUNT = 1700;

const CLEAR_EXISTING_DATA = true;
const CLEAR_AUDIT_LOGS = true;

const START_DATE = "2020-01-01";
const END_DATE = new Date().toISOString().slice(0, 10);

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
  "Nikko",
  "Ryan",
  "Jomar",
  "Paolo",
  "Mikaela",
  "Jasmine",
  "Rachelle",
  "Erika",
  "Bianca",
  "Louie",
  "Lester",
  "Allan",
  "Karen",
  "Elaine",
  "Francis",
  "Joanne",
  "Hazel",
  "April",
  "Renz",
  "Marco",
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
  "J.",
  "M.",
  "R.",
  "S.",
  "T.",
  "V.",
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
  "Soriano",
  "Valdez",
  "Pascual",
  "Manalo",
  "Cabrera",
  "Rosales",
  "Tolentino",
  "Santiago",
  "Aguilar",
  "Francisco",
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

const VIOLATIONS = [
  {
    violation: "Tardiness",
    severity: "Minor",
    action: "Verbal counseling",
    recommendation: "Verbal Counseling",
  },
  {
    violation: "Absenteeism without proper notice",
    severity: "Major",
    action: "Written warning and attendance review",
    recommendation: "Seminar & Webinar",
  },
  {
    violation: "Negligence of duty",
    severity: "Major",
    action: "Performance review",
    recommendation: "Employee Training",
  },
  {
    violation: "Improper uniform or grooming violation",
    severity: "Minor",
    action: "Verbal counseling",
    recommendation: "Verbal Counseling",
  },
  {
    violation: "Failure to follow company policy",
    severity: "Major",
    action: "Policy refresher and written warning",
    recommendation: "Seminar & Webinar",
  },
  {
    violation: "Failure to follow work instruction",
    severity: "Major",
    action: "Skills coaching and performance review",
    recommendation: "Employee Training",
  },
  {
    violation: "Poor task quality output",
    severity: "Major",
    action: "Quality improvement coaching",
    recommendation: "Employee Training",
  },
  {
    violation: "Repeated deployment mismatch concern",
    severity: "Major",
    action: "Role fit review",
    recommendation: "Reassignment of Position",
  },
  {
    violation: "Insubordination",
    severity: "Critical",
    action: "Administrative review",
    recommendation: "Performance Improvement Plan",
  },
  {
    violation: "Workplace misconduct",
    severity: "Critical",
    action: "Disciplinary review",
    recommendation: "Performance Improvement Plan",
  },
];

const INCIDENT_STATUSES = [
  { status: "Open", weight: 28 },
  { status: "Investigating", weight: 34 },
  { status: "For Review", weight: 16 },
  { status: "Closed", weight: 22 },
];

const DEMO_EMPLOYEES = [
  {
    index: 1,
    name: "Carlo R. Gonzales",
    company: "SM Supermalls",
    status: "Deployed",
    employmentType: "Permanent",
    complianceType: "Complete Compliance",
    caseType: "GOOD_STANDING",
  },
  {
    index: 2,
    name: "Rica E. Morales",
    company: "Jollibee Foods Corporation",
    status: "Deployed",
    employmentType: "Contractual",
    complianceType: "Complete Compliance",
    caseType: "MINOR_CONCERN",
  },
  {
    index: 3,
    name: "Dennis S. Ramos",
    company: "Puregold Price Club",
    status: "Deployed",
    employmentType: "Contractual",
    complianceType: "Complete Compliance",
    caseType: "REPEAT_ATTENDANCE",
  },
  {
    index: 4,
    name: "Angelica F. Navarro",
    company: "Concentrix Philippines",
    status: "Deployed",
    employmentType: "Contractual",
    complianceType: "Complete Compliance",
    caseType: "CRITICAL_HIGH_RISK",
  },
  {
    index: 5,
    name: "Jayson M. Torres",
    company: "Toyota Philippines",
    status: "Deployed",
    employmentType: "Contractual",
    complianceType: "Complete Compliance",
    caseType: "ACTIVE_DUPLICATE",
  },
  {
    index: 6,
    name: "Michelle A. Santos",
    company: "BDO Unibank",
    status: "Deployed",
    employmentType: "Permanent",
    complianceType: "Complete Compliance",
    caseType: "CLOSED_THEN_NEW",
  },
  {
    index: 7,
    name: "Princess M. Reyes",
    company: "Globe Telecom",
    status: "Deployed",
    employmentType: "Contractual",
    complianceType: "Expiring Soon",
    caseType: "EXPIRING_DOCUMENT",
  },
  {
    index: 8,
    name: "Christian C. Dela Cruz",
    company: null,
    status: "Floating / Standby",
    employmentType: "Contractual",
    complianceType: "Incomplete Compliance",
    caseType: "INCOMPLETE_COMPLIANCE",
  },
  {
    index: 9,
    name: "Marvin D. Bautista",
    company: "Accenture Philippines",
    status: "Deployed",
    employmentType: "Contractual",
    complianceType: "Complete Compliance",
    caseType: "ROLE_MISMATCH",
  },
  {
    index: 10,
    name: "Grace V. Rivera",
    company: "Unilab Inc.",
    status: "Deployed",
    employmentType: "Permanent",
    complianceType: "Complete Compliance",
    caseType: "TRAINING_NEEDED",
  },
];

const usedNames = new Set(DEMO_EMPLOYEES.map((employee) => employee.name));

function getDemoProfile(index) {
  return DEMO_EMPLOYEES.find((employee) => employee.index === index) || null;
}

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

function toDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function randomDateBetween(startDateString, endDateString) {
  const start = toDate(startDateString).getTime();
  const end = toDate(endDateString).getTime();
  const randomTime = randomInt(start, end);

  return formatDate(new Date(randomTime));
}

function addDays(dateString, days) {
  const date = toDate(dateString);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function addDaysCapped(dateString, days, maxDateString = END_DATE) {
  const added = toDate(addDays(dateString, days));
  const maxDate = toDate(maxDateString);

  if (added > maxDate) return maxDateString;

  return formatDate(added);
}

function randomTime() {
  return `${pad(randomInt(8, 17))}:${pad(randomInt(0, 59))}:${pad(
    randomInt(0, 59)
  )}`;
}

function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = randomInt(1, total);

  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }

  return items[0];
}

function makeFullName() {
  for (let attempt = 0; attempt < 30; attempt++) {
    const name = `${randomItem(FIRST_NAMES)} ${randomItem(
      MIDDLE_INITIALS
    )} ${randomItem(LAST_NAMES)}`;

    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }

  const fallback = `${randomItem(FIRST_NAMES)} ${randomItem(
    MIDDLE_INITIALS
  )} ${randomItem(LAST_NAMES)} ${randomInt(100, 999)}`;

  usedNames.add(fallback);
  return fallback;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function getEmploymentStatus(profile) {
  if (profile?.status) return profile.status;

  const roll = randomInt(1, 100);

  if (roll <= 76) return "Deployed";
  if (roll <= 91) return "Floating / Standby";
  return "Available";
}

function getEmploymentTypeForStatsOnly(profile) {
  if (profile?.employmentType) return profile.employmentType;

  return chance(68) ? "Contractual" : "Permanent";
}

function getComplianceType(profile) {
  if (profile?.complianceType) return profile.complianceType;

  const roll = randomInt(1, 100);

  if (roll <= 64) return "Complete Compliance";
  if (roll <= 79) return "Incomplete Compliance";
  if (roll <= 90) return "Expired Document";
  return "Expiring Soon";
}

function getIncidentCountForEmployee() {
  const roll = randomInt(1, 1000);

  if (roll <= 850) return 0;
  if (roll <= 930) return 1;
  if (roll <= 965) return 2;
  if (roll <= 990) return randomInt(3, 4);
  if (roll <= 998) return randomInt(5, 6);
  return randomInt(7, 8);
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

async function safeQuery(connection, sql) {
  try {
    await connection.query(sql);
  } catch (error) {
    console.warn(`Skipped query: ${sql}`);
    console.warn(error.message);
  }
}

async function getTableColumns(connection, tableName) {
  const [columns] = await connection.query(`SHOW COLUMNS FROM \`${tableName}\``);
  return new Set(columns.map((column) => column.Field));
}

function addField(fields, values, columns, possibleNames, value) {
  const selectedColumn = possibleNames.find((column) => columns.has(column));

  if (!selectedColumn) return;

  fields.push(selectedColumn);
  values.push(value);
}

async function insertRow(connection, tableName, columns, specs) {
  const fields = [];
  const values = [];

  specs.forEach((spec) => {
    addField(fields, values, columns, spec.names, spec.value);
  });

  if (fields.length === 0) {
    throw new Error(`No matching columns found for table ${tableName}.`);
  }

  const escapedFields = fields.map((field) => `\`${field}\``).join(", ");
  const placeholders = fields.map(() => "?").join(", ");

  const [result] = await connection.query(
    `INSERT INTO \`${tableName}\` (${escapedFields}) VALUES (${placeholders})`,
    values
  );

  return result;
}

async function clearExistingData(connection) {
  await connection.query("SET FOREIGN_KEY_CHECKS = 0");

  await safeQuery(connection, "DELETE FROM incident_evidence");
  await safeQuery(connection, "DELETE FROM incidents");
  await safeQuery(connection, "DELETE FROM employee_documents");
  await safeQuery(connection, "DELETE FROM employees");

  if (CLEAR_AUDIT_LOGS) {
    await safeQuery(connection, "DELETE FROM audit_logs");
  }

  await safeQuery(connection, "ALTER TABLE incident_evidence AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE incidents AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE employee_documents AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE employees AUTO_INCREMENT = 1");

  if (CLEAR_AUDIT_LOGS) {
    await safeQuery(connection, "ALTER TABLE audit_logs AUTO_INCREMENT = 1");
  }

  await connection.query("SET FOREIGN_KEY_CHECKS = 1");
}

async function insertEmployee(connection, employeeColumns, index) {
  const profile = getDemoProfile(index);
  const createdAt =
    profile?.caseType === "GOOD_STANDING"
      ? randomDateBetween("2026-01-01", END_DATE)
      : randomDateBetween(START_DATE, END_DATE);

  const status = getEmploymentStatus(profile);
  const employmentType = getEmploymentTypeForStatsOnly(profile);
  const company =
    status === "Deployed" ? profile?.company || randomItem(COMPANIES) : null;

  const contractStart =
    status === "Deployed" ? addDaysCapped(createdAt, randomInt(0, 45)) : null;

  const contractEnd = null;
  const name = profile?.name || makeFullName();

  const result = await insertRow(connection, "employees", employeeColumns, [
    { names: ["name", "full_name", "fullName"], value: name },
    { names: ["company"], value: company },
    { names: ["status"], value: status },
    { names: ["contractStart", "contract_start"], value: contractStart },
    { names: ["contractEnd", "contract_end"], value: contractEnd },
    { names: ["archived"], value: 0 },
    { names: ["created_at", "createdAt"], value: `${createdAt} ${randomTime()}` },
  ]);

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
    profile,
  };
}

async function insertDocuments(connection, documentColumns, employee, mockFilePath) {
  const complianceType = getComplianceType(employee.profile);
  const today = getTodayDate();

  const missingDocs = new Set();
  const affectedExpirableDocs = new Set();

  if (complianceType === "Incomplete Compliance") {
    const missingCount = employee.profile ? 3 : randomInt(1, 4);

    while (missingDocs.size < missingCount) {
      missingDocs.add(randomItem(REQUIRED_DOCUMENTS));
    }
  }

  if (complianceType === "Expired Document" || complianceType === "Expiring Soon") {
    if (employee.profile?.caseType === "EXPIRING_DOCUMENT") {
      affectedExpirableDocs.add("Barangay Clearance");
      affectedExpirableDocs.add("NBI/Police Clearance");
    } else {
      const affectedCount = chance(25) ? 2 : 1;

      while (affectedExpirableDocs.size < affectedCount) {
        affectedExpirableDocs.add(randomItem(EXPIRABLE_DOCUMENTS));
      }
    }
  }

  for (const docName of REQUIRED_DOCUMENTS) {
    const hasFile = !missingDocs.has(docName);

    let expirationDate = null;

    if (EXPIRABLE_DOCUMENTS.includes(docName)) {
      if (complianceType === "Expired Document" && affectedExpirableDocs.has(docName)) {
        expirationDate = addDays(today, -randomInt(1, 365));
      } else if (
        complianceType === "Expiring Soon" &&
        affectedExpirableDocs.has(docName)
      ) {
        expirationDate = addDays(today, randomInt(1, 30));
      } else {
        expirationDate = addDays(today, randomInt(31, 730));
      }
    }

    await insertRow(connection, "employee_documents", documentColumns, [
      { names: ["employee_id", "employeeId"], value: employee.id },
      { names: ["name", "document_name", "documentName"], value: docName },
      { names: ["expiration_date", "expirationDate"], value: expirationDate },
      { names: ["file_path", "filePath"], value: hasFile ? mockFilePath : null },
    ]);
  }

  return complianceType;
}

async function insertIncidentRecord(
  connection,
  incidentColumns,
  employee,
  rule,
  options = {}
) {
  const minIncidentDate =
    employee.createdAt > START_DATE ? employee.createdAt : START_DATE;

  const incidentDate =
    options.incidentDate || randomDateBetween(minIncidentDate, END_DATE);

  const status = options.status || weightedRandom(INCIDENT_STATUSES).status || "Open";

  const location =
    options.location ||
    employee.company ||
    randomItem(["Main Office", "Client Site", "Deployment Area", "HR Office"]);

  await insertRow(connection, "incidents", incidentColumns, [
    { names: ["employee_id", "employeeId"], value: employee.id },
    { names: ["employee_name", "employeeName", "employee"], value: employee.name },
    { names: ["company"], value: employee.company || "Unassigned" },
    { names: ["violation_type", "violationType", "violation"], value: rule.violation },
    { names: ["severity"], value: rule.severity },
    { names: ["status"], value: status },
    { names: ["incident_date", "incidentDate", "date"], value: incidentDate },
    { names: ["location"], value: location },
    {
      names: ["description"],
      value:
        options.description ||
        `Mock incident record for ${rule.violation.toLowerCase()}. Generated for KPI, dashboard, duplicate-check, and disciplinary workflow testing.`,
    },
    {
      names: ["reported_by", "reportedBy"],
      value: options.reportedBy || randomItem(["HR Manager", "HR Staff", "System Seeder"]),
    },
    { names: ["action_taken", "actionTaken", "sanction"], value: rule.action },
    { names: ["recommendation"], value: rule.recommendation },
    {
      names: ["resolution_notes", "resolutionNotes"],
      value:
        status === "Closed"
          ? "Mock case closed for testing."
          : options.resolutionNotes || null,
    },
    { names: ["created_at", "createdAt"], value: `${incidentDate} ${randomTime()}` },
    { names: ["updated_at", "updatedAt"], value: `${incidentDate} ${randomTime()}` },
  ]);

  return 1;
}

function findViolation(violationName) {
  return VIOLATIONS.find((item) => item.violation === violationName);
}

async function insertSpecialIncidents(connection, incidentColumns, employee) {
  const profile = employee.profile;

  if (!profile) return null;

  const baseDate = randomDateBetween("2026-04-01", END_DATE);

  if (
    profile.caseType === "GOOD_STANDING" ||
    profile.caseType === "EXPIRING_DOCUMENT" ||
    profile.caseType === "INCOMPLETE_COMPLIANCE"
  ) {
    return 0;
  }

  if (profile.caseType === "MINOR_CONCERN") {
    return insertIncidentRecord(connection, incidentColumns, employee, findViolation("Tardiness"), {
      status: "Open",
      incidentDate: baseDate,
      description:
        "DEMO CASE: One minor attendance concern. Shows Minor Concern, Monitor risk, and Verbal Counseling or Seminar recommendation.",
    });
  }

  if (profile.caseType === "REPEAT_ATTENDANCE") {
    let count = 0;
    const rule = findViolation("Absenteeism without proper notice");

    for (let i = 0; i < 3; i++) {
      count += await insertIncidentRecord(connection, incidentColumns, employee, rule, {
        status: i === 2 ? "Investigating" : "Closed",
        incidentDate: addDays(baseDate, i),
        description:
          "DEMO CASE: Repeated attendance concern. Shows Needs Improvement or Repeat monitoring.",
      });
    }

    return count;
  }

  if (profile.caseType === "CRITICAL_HIGH_RISK") {
    let count = 0;
    const rule = findViolation("Workplace misconduct");

    for (let i = 0; i < 2; i++) {
      count += await insertIncidentRecord(connection, incidentColumns, employee, rule, {
        status: i === 0 ? "Open" : "For Review",
        incidentDate: addDays(baseDate, i),
        description:
          "DEMO CASE: Critical incident. Shows Critical Concern, High Risk, and Performance Improvement Plan.",
      });
    }

    return count;
  }

  if (profile.caseType === "ACTIVE_DUPLICATE") {
    let count = 0;
    const rule = findViolation("Tardiness");

    count += await insertIncidentRecord(connection, incidentColumns, employee, rule, {
      status: "Open",
      incidentDate: baseDate,
      description:
        "DEMO CASE: Active duplicate test case 1. Same employee, same violation, same date.",
    });

    count += await insertIncidentRecord(connection, incidentColumns, employee, rule, {
      status: "Investigating",
      incidentDate: baseDate,
      description:
        "DEMO CASE: Active duplicate test case 2. Should appear in duplicate verification warning.",
    });

    return count;
  }

  if (profile.caseType === "CLOSED_THEN_NEW") {
    let count = 0;
    const rule = findViolation("Failure to follow company policy");

    count += await insertIncidentRecord(connection, incidentColumns, employee, rule, {
      status: "Closed",
      incidentDate: baseDate,
      description:
        "DEMO CASE: Closed same-day case. This proves closed cases do not block new reporting.",
    });

    count += await insertIncidentRecord(connection, incidentColumns, employee, rule, {
      status: "Open",
      incidentDate: baseDate,
      description:
        "DEMO CASE: New active same-day case after a closed case. Should still allow HR verification.",
    });

    return count;
  }

  if (profile.caseType === "ROLE_MISMATCH") {
    let count = 0;
    const rule = findViolation("Repeated deployment mismatch concern");

    for (let i = 0; i < 3; i++) {
      count += await insertIncidentRecord(connection, incidentColumns, employee, rule, {
        status: i === 2 ? "Investigating" : "Closed",
        incidentDate: addDays(baseDate, i),
        description:
          "DEMO CASE: Repeated role mismatch concern. Shows Reassignment of Position recommendation.",
      });
    }

    return count;
  }

  if (profile.caseType === "TRAINING_NEEDED") {
    let count = 0;
    const rule = findViolation("Poor task quality output");

    for (let i = 0; i < 2; i++) {
      count += await insertIncidentRecord(connection, incidentColumns, employee, rule, {
        status: i === 1 ? "Investigating" : "Closed",
        incidentDate: addDays(baseDate, i),
        description:
          "DEMO CASE: Quality or competency concern. Shows Employee Training recommendation.",
      });
    }

    return count;
  }

  return 0;
}

async function insertRandomIncidents(connection, incidentColumns, employee) {
  const incidentCount = getIncidentCountForEmployee();

  if (incidentCount === 0) return 0;

  let created = 0;
  const useSameViolationPattern = incidentCount >= 2 && chance(60);
  const fixedRule = randomItem(VIOLATIONS);

  for (let i = 0; i < incidentCount; i++) {
    const rule = useSameViolationPattern ? fixedRule : randomItem(VIOLATIONS);
    created += await insertIncidentRecord(connection, incidentColumns, employee, rule);
  }

  return created;
}

async function insertIncidents(connection, incidentColumns, employee) {
  const specialCount = await insertSpecialIncidents(connection, incidentColumns, employee);

  if (specialCount !== null) return specialCount;

  return insertRandomIncidents(connection, incidentColumns, employee);
}

async function seedMockData() {
  const connection = db.promise();
  const mockFilePath = createMockPdfFile();

  try {
    console.log("Starting Welljob REDEF demo mock data seed...");
    console.log(`Employee count target: ${EMPLOYEE_COUNT}`);
    console.log(`Date range: ${START_DATE} to ${END_DATE}`);
    console.log("Company list: official frontend COMPANY_OPTIONS only.");
    console.log("Contract end date rule: NULL / blank for all employees.");

    if (CLEAR_EXISTING_DATA) {
      console.log("Clearing existing employee, document, incident data...");
      await clearExistingData(connection);
    }

    const employeeColumns = await getTableColumns(connection, "employees");
    const documentColumns = await getTableColumns(connection, "employee_documents");
    const incidentColumns = await getTableColumns(connection, "incidents");

    let createdEmployees = 0;
    let createdDocuments = 0;
    let createdIncidents = 0;

    const employeeStatusStats = {
      Deployed: 0,
      "Floating / Standby": 0,
      Available: 0,
    };

    const employmentTypeStats = {
      Contractual: 0,
      Permanent: 0,
    };

    const complianceStats = {
      "Complete Compliance": 0,
      "Incomplete Compliance": 0,
      "Expired Document": 0,
      "Expiring Soon": 0,
    };

    for (let i = 1; i <= EMPLOYEE_COUNT; i++) {
      const employee = await insertEmployee(connection, employeeColumns, i);

      employeeStatusStats[employee.status] += 1;
      employmentTypeStats[employee.employmentType] += 1;

      const complianceType = await insertDocuments(
        connection,
        documentColumns,
        employee,
        mockFilePath
      );

      complianceStats[complianceType] += 1;

      const incidentCreated = await insertIncidents(
        connection,
        incidentColumns,
        employee
      );

      createdEmployees += 1;
      createdDocuments += REQUIRED_DOCUMENTS.length;
      createdIncidents += incidentCreated;

      if (i % 100 === 0) {
        console.log(`Seeded ${i}/${EMPLOYEE_COUNT} employees...`);
      }
    }

    console.log("Mock data seed completed!");
    console.log(`Employees created: ${createdEmployees}`);
    console.log(`Documents created: ${createdDocuments}`);
    console.log(`Incidents created: ${createdIncidents}`);
    console.log("Contract end values: all NULL / blank");
    console.log("Audit logs cleared:", CLEAR_AUDIT_LOGS ? "Yes" : "No");

    console.log("Employee Status Summary:");
    console.log(employeeStatusStats);

    console.log("Employment Type Summary:");
    console.log(employmentTypeStats);

    console.log("Compliance Summary:");
    console.log(complianceStats);

    console.log("Search these demo employees during REDEF:");
    DEMO_EMPLOYEES.forEach((employee) => {
      console.log(`- ${employee.name} | ${employee.caseType}`);
    });

    process.exit(0);
  } catch (error) {
    console.error("SEED MOCK DATA ERROR:", error);
    process.exit(1);
  }
}

seedMockData();