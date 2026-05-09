const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const EMPLOYEE_COUNT = 1000;
const FLOATING_COUNT = 200;
const DEPLOYED_COUNT = EMPLOYEE_COUNT - FLOATING_COUNT;

const CLEAR_EXISTING_DATA = true;
const CLEAR_AUDIT_LOGS = true;
const CLEAR_SMART_STATES = true;

const START_DATE = "2024-01-01";
const END_DATE = new Date().toISOString().slice(0, 10);

const YEAR_2024 = "2024";
const YEAR_2025 = "2025";
const YEAR_2026 = "2026";

const DEPLOYMENT_HISTORY = {
  2024: 650,
  2025: 720,
  2026: 800,
};

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

const DEMO_EMPLOYEES = [
  {
    index: 1,
    name: "Carlo R. Gonzales",
    company: "SM Supermalls",
    status: "Deployed",
  },
  {
    index: 2,
    name: "Princess M. Reyes",
    company: "Globe Telecom",
    status: "Deployed",
  },
  {
    index: 3,
    name: "Christian C. Dela Cruz",
    company: null,
    status: "Floating / Standby",
  },
  {
    index: 203,
    name: "Rica E. Morales",
    company: "Jollibee Foods Corporation",
    status: "Deployed",
  },
  {
    index: 204,
    name: "Marvin D. Bautista",
    company: "Accenture Philippines",
    status: "Deployed",
  },
];

const EXPIRING_DOCUMENT_CASES = [
  {
    employeeIndex: 1,
    documentName: "NBI/Police Clearance",
    daysBeforeExpiry: 15,
  },
  {
    employeeIndex: 2,
    documentName: "Barangay Clearance",
    daysBeforeExpiry: 25,
  },
];

const HISTORICAL_2024_INCIDENT_CASES = [
  ["Unexcused Tardiness", "Minor", "Verbal Warning"],
  ["Reporting for Work Not in Prescribed Uniform", "Minor", "Written Warning"],
  ["Absence Without Official Leave (Single Absence)", "Minor", "Written Warning"],
  ["Unexcused Tardiness", "Minor", "Verbal Warning"],
  ["Violation of Safety Rules and Regulations", "Major", "Safety Re-orientation"],
  ["Reporting for Work Not in Prescribed Uniform", "Minor", "Written Warning"],
  ["Absence Without Official Leave (Single Absence)", "Minor", "Verbal Counseling"],
  ["Willful Failure to Carry Out Job Instructions", "Major", "Supervisor Coaching"],
  ["Unexcused Tardiness", "Minor", "Verbal Warning"],
  ["Reporting for Work Not in Prescribed Uniform", "Minor", "Written Warning"],
  ["Absence Without Official Leave (Single Absence)", "Minor", "Written Warning"],
  ["Violation of Safety Rules and Regulations", "Major", "Safety Coaching"],
];

const HISTORICAL_2025_INCIDENT_CASES = [
  ["Unexcused Tardiness", "Minor", "Verbal Warning"],
  ["Reporting for Work Not in Prescribed Uniform", "Minor", "Written Warning"],
  ["Absence Without Official Leave (Single Absence)", "Minor", "Written Warning"],
  ["Violation of Safety Rules and Regulations", "Major", "Safety Re-orientation"],
  ["Unexcused Tardiness", "Minor", "Verbal Warning"],
  ["Reporting for Work Not in Prescribed Uniform", "Minor", "Written Warning"],
  ["Willful Failure to Carry Out Job Instructions", "Major", "Supervisor Coaching"],
  ["Absence Without Official Leave (Single Absence)", "Minor", "Verbal Counseling"],
];

const CURRENT_2026_INCIDENT_CASES = [
  {
    employeeIndex: 203,
    violation: "Unexcused Tardiness",
    severity: "Minor",
    status: "Open",
    actionTaken: "Verbal Counseling",
    recommendation: "Monitor attendance record",
    reporter: "HR Staff Demo",
  },
  {
    employeeIndex: 204,
    violation: "Willful Failure to Carry Out Job Instructions",
    severity: "Major",
    status: "Investigating",
    actionTaken: "For HR investigation",
    recommendation: "Review employee explanation and supervisor report",
    reporter: "HR Staff Demo",
  },
];

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
  "Del Rosario",
  "De Leon",
  "Luna",
  "Marquez",
  "Padilla",
  "Velasco",
  "Ocampo",
  "Sarmiento",
  "Lim",
  "Tan",
];

const usedNames = new Set(DEMO_EMPLOYEES.map((employee) => employee.name));

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function randomTime() {
  return `${pad(randomInt(8, 17))}:${pad(randomInt(0, 59))}:${pad(
    randomInt(0, 59)
  )}`;
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function toDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = toDate(dateString);
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

function randomDateBetween(startDateString, endDateString) {
  const start = toDate(startDateString).getTime();
  const end = toDate(endDateString).getTime();

  if (start > end) return endDateString;

  const randomTimeValue = randomInt(start, end);
  return formatDate(new Date(randomTimeValue));
}

function randomDateForYear(year) {
  const start = `${year}-01-01`;
  const end = year === YEAR_2026 ? END_DATE : `${year}-12-31`;
  return randomDateBetween(start, end);
}

function makeFullName() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
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
  )} ${randomItem(LAST_NAMES)} ${randomInt(1000, 9999)}`;

  usedNames.add(fallback);
  return fallback;
}

function getDemoProfile(index) {
  return DEMO_EMPLOYEES.find((employee) => employee.index === index) || null;
}

function getEmployeeStatus(index, profile) {
  if (profile?.status) return profile.status;

  if (index === 3 || (index >= 4 && index <= 202)) {
    return "Floating / Standby";
  }

  return "Deployed";
}

function getEmployeeCompany(index, status, profile) {
  if (status !== "Deployed") return null;

  return profile?.company || COMPANIES[index % COMPANIES.length];
}

function getEmployeeCreatedAt(index) {
  if (index <= 720) return randomDateForYear(YEAR_2024);
  if (index <= 920) return randomDateForYear(YEAR_2025);
  return randomDateForYear(YEAR_2026);
}

function getCurrentContractStart(status) {
  if (status !== "Deployed") return null;
  return randomDateForYear(YEAR_2026);
}

function getHistoricalDeploymentStart(year) {
  return randomDateForYear(String(year));
}

function getHistoricalDeploymentEnd(startDate) {
  const endCandidate = addDays(startDate, randomInt(90, 240));
  const yearEnd = `${startDate.slice(0, 4)}-12-31`;

  return toDate(endCandidate) > toDate(yearEnd) ? yearEnd : endCandidate;
}

function getExpiringDocumentCase(employee, docName) {
  return EXPIRING_DOCUMENT_CASES.find(
    (item) =>
      Number(item.employeeIndex) === Number(employee.index) &&
      item.documentName === docName
  );
}

function getDocumentExpirationDate(employee, docName) {
  if (!EXPIRABLE_DOCUMENTS.includes(docName)) return null;

  const today = getTodayDate();
  const expiringCase = getExpiringDocumentCase(employee, docName);

  if (expiringCase) {
    return addDays(today, expiringCase.daysBeforeExpiry);
  }

  return addDays(today, randomInt(365, 730));
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

async function tableExists(connection, tableName) {
  const [rows] = await connection.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
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

async function tryInsertRow(connection, tableName, columns, specs) {
  try {
    await insertRow(connection, tableName, columns, specs);
    return true;
  } catch (error) {
    console.warn(`Skipped insert into ${tableName}: ${error.message}`);
    return false;
  }
}

async function clearExistingData(connection) {
  console.log("Clearing backend records...");

  await connection.query("SET FOREIGN_KEY_CHECKS = 0");

  await safeQuery(connection, "DELETE FROM incident_evidence");
  await safeQuery(connection, "DELETE FROM incidents");
  await safeQuery(connection, "DELETE FROM employee_documents");
  await safeQuery(connection, "DELETE FROM deployments");
  await safeQuery(connection, "DELETE FROM contracts");
  await safeQuery(connection, "DELETE FROM employees");

  if (CLEAR_SMART_STATES) {
    await safeQuery(connection, "DELETE FROM smart_alert_states");
    await safeQuery(connection, "DELETE FROM smart_suggestion_states");
  }

  if (CLEAR_AUDIT_LOGS) {
    await safeQuery(connection, "DELETE FROM audit_logs");
  }

  await safeQuery(connection, "ALTER TABLE incident_evidence AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE incidents AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE employee_documents AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE deployments AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE contracts AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE employees AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE smart_alert_states AUTO_INCREMENT = 1");
  await safeQuery(
    connection,
    "ALTER TABLE smart_suggestion_states AUTO_INCREMENT = 1"
  );

  if (CLEAR_AUDIT_LOGS) {
    await safeQuery(connection, "ALTER TABLE audit_logs AUTO_INCREMENT = 1");
  }

  await connection.query("SET FOREIGN_KEY_CHECKS = 1");

  console.log("Backend records cleared.");
}

async function insertEmployee(connection, employeeColumns, index) {
  const profile = getDemoProfile(index);
  const createdAt = getEmployeeCreatedAt(index);
  const status = getEmployeeStatus(index, profile);
  const name = profile?.name || makeFullName();
  const company = getEmployeeCompany(index, status, profile);
  const contractStart = getCurrentContractStart(status);

  const result = await insertRow(connection, "employees", employeeColumns, [
    { names: ["name", "full_name", "fullName"], value: name },
    { names: ["company"], value: company },
    { names: ["status"], value: status },
    { names: ["contractStart", "contract_start"], value: contractStart },
    { names: ["contractEnd", "contract_end"], value: null },
    { names: ["archived"], value: 0 },
    { names: ["created_at", "createdAt"], value: `${createdAt} ${randomTime()}` },
    { names: ["updated_at", "updatedAt"], value: `${createdAt} ${randomTime()}` },
  ]);

  return {
    id: result.insertId,
    name,
    company,
    status,
    createdAt,
    contractStart,
    index,
  };
}

async function insertDocuments(connection, documentColumns, employee, mockFilePath) {
  let expiringDocuments = 0;

  for (const docName of REQUIRED_DOCUMENTS) {
    const expirationDate = getDocumentExpirationDate(employee, docName);
    const isExpiringSoon = Boolean(getExpiringDocumentCase(employee, docName));

    if (isExpiringSoon) expiringDocuments += 1;

    await insertRow(connection, "employee_documents", documentColumns, [
      { names: ["employee_id", "employeeId"], value: employee.id },
      { names: ["name", "document_name", "documentName"], value: docName },
      { names: ["expiration_date", "expirationDate"], value: expirationDate },
      { names: ["file_path", "filePath"], value: mockFilePath },
      { names: ["status"], value: "Submitted" },
      { names: ["created_at", "createdAt"], value: `${employee.createdAt} ${randomTime()}` },
      { names: ["updated_at", "updatedAt"], value: `${employee.createdAt} ${randomTime()}` },
    ]);
  }

  return expiringDocuments;
}

async function insertDeploymentRow(
  connection,
  deploymentColumns,
  employee,
  { deploymentDate, endDate = null, status = "Active", position = "Service Personnel" }
) {
  if (!deploymentColumns) return 0;

  const inserted = await tryInsertRow(connection, "deployments", deploymentColumns, [
    { names: ["employee_id", "employeeId"], value: employee.id },
    { names: ["employee_name", "employeeName", "employee"], value: employee.name },
    { names: ["company", "client_company", "clientCompany"], value: employee.company },
    { names: ["location", "deployment_location", "deploymentLocation"], value: employee.company },
    { names: ["deployment_date", "deploymentDate", "start_date", "startDate"], value: deploymentDate },
    { names: ["end_date", "endDate", "deployment_end", "deploymentEnd"], value: endDate },
    { names: ["status", "deployment_status", "deploymentStatus"], value: status },
    { names: ["position", "job_position", "jobPosition"], value: position },
    { names: ["created_at", "createdAt"], value: `${deploymentDate} ${randomTime()}` },
    { names: ["updated_at", "updatedAt"], value: `${endDate || deploymentDate} ${randomTime()}` },
  ]);

  return inserted ? 1 : 0;
}

async function insertContractRow(
  connection,
  contractColumns,
  employee,
  { contractStart, contractEnd = null, status = "Active", position = "Service Personnel" }
) {
  if (!contractColumns) return 0;

  const inserted = await tryInsertRow(connection, "contracts", contractColumns, [
    { names: ["employee_id", "employeeId"], value: employee.id },
    { names: ["employee_name", "employeeName", "employee"], value: employee.name },
    { names: ["company", "client_company", "clientCompany"], value: employee.company },
    { names: ["contract_start", "contractStart", "start_date", "startDate"], value: contractStart },
    { names: ["contract_end", "contractEnd", "end_date", "endDate"], value: contractEnd },
    { names: ["status", "contract_status", "contractStatus"], value: status },
    { names: ["position", "job_position", "jobPosition"], value: position },
    { names: ["created_at", "createdAt"], value: `${contractStart} ${randomTime()}` },
    { names: ["updated_at", "updatedAt"], value: `${contractEnd || contractStart} ${randomTime()}` },
  ]);

  return inserted ? 1 : 0;
}

async function insertDeploymentAndContract(
  connection,
  employee,
  contractColumns,
  deploymentColumns,
  config
) {
  const contractsCreated = await insertContractRow(connection, contractColumns, employee, {
    contractStart: config.deploymentDate,
    contractEnd: config.endDate,
    status: config.status,
  });

  const deploymentsCreated = await insertDeploymentRow(connection, deploymentColumns, employee, {
    deploymentDate: config.deploymentDate,
    endDate: config.endDate,
    status: config.status,
  });

  return {
    contractsCreated,
    deploymentsCreated,
  };
}

async function insertIncidentRecord(connection, incidentColumns, employee, config) {
  const incidentDate = config.incidentDate;
  const status = config.status || "Closed";
  const severity = config.severity || "Minor";
  const violation = config.violation || "Unexcused Tardiness";
  const actionTaken = config.actionTaken || "Verbal Warning";
  const recommendation = config.recommendation || "Monitor employee record";
  const reporter = config.reporter || "HR Manager Demo";

  await insertRow(connection, "incidents", incidentColumns, [
    { names: ["employee_id", "employeeId"], value: employee.id },
    { names: ["employee_name", "employeeName", "employee"], value: employee.name },
    { names: ["company"], value: employee.company || "Unassigned" },
    { names: ["violation_type", "violationType", "violation"], value: violation },
    { names: ["severity"], value: severity },
    { names: ["status"], value: status },
    { names: ["incident_date", "incidentDate", "date"], value: incidentDate },
    { names: ["location"], value: employee.company || "Client Site" },
    {
      names: ["description"],
      value: `Demo analytics incident: ${violation}. This record supports 2024-2026 trend comparison.`,
    },
    { names: ["reported_by", "reportedBy"], value: reporter },
    { names: ["action_taken", "actionTaken", "sanction"], value: actionTaken },
    { names: ["recommendation"], value: recommendation },
    {
      names: ["resolution_notes", "resolutionNotes"],
      value:
        status === "Closed"
          ? `Closed historical demo case. Action taken: ${actionTaken}.`
          : `Current demo case for smart alert and KPI monitoring. Suggested action: ${recommendation}.`,
    },
    { names: ["created_at", "createdAt"], value: `${incidentDate} ${randomTime()}` },
    { names: ["updated_at", "updatedAt"], value: `${incidentDate} ${randomTime()}` },
  ]);

  return 1;
}

async function seedMockData() {
  const connection = db.promise();
  const mockFilePath = createMockPdfFile();

  try {
    console.log("Starting Welljob clean historical demo seed...");
    console.log("Expected output:");
    console.log("Employees: 1000");
    console.log("Current deployed employees: 800");
    console.log("Current floating employees: 200");
    console.log("Deployment records: 2024 = 650, 2025 = 720, 2026 = 800");
    console.log("Incident records: 2024 = 12, 2025 = 8, 2026 = 2");
    console.log("Expiring compliance documents: 2");

    if (CLEAR_EXISTING_DATA) {
      await clearExistingData(connection);
    }

    const employeeColumns = await getTableColumns(connection, "employees");
    const documentColumns = await getTableColumns(connection, "employee_documents");
    const incidentColumns = await getTableColumns(connection, "incidents");

    const hasContractsTable = await tableExists(connection, "contracts");
    const hasDeploymentsTable = await tableExists(connection, "deployments");

    const contractColumns = hasContractsTable
      ? await getTableColumns(connection, "contracts")
      : null;

    const deploymentColumns = hasDeploymentsTable
      ? await getTableColumns(connection, "deployments")
      : null;

    const employees = [];
    const employeesByIndex = new Map();

    let createdEmployees = 0;
    let createdDocuments = 0;
    let createdExpiringDocuments = 0;

    for (let i = 1; i <= EMPLOYEE_COUNT; i += 1) {
      const employee = await insertEmployee(connection, employeeColumns, i);

      employees.push(employee);
      employeesByIndex.set(i, employee);

      const expiringDocsForEmployee = await insertDocuments(
        connection,
        documentColumns,
        employee,
        mockFilePath
      );

      createdEmployees += 1;
      createdDocuments += REQUIRED_DOCUMENTS.length;
      createdExpiringDocuments += expiringDocsForEmployee;

      if (i % 100 === 0) {
        console.log(`Seeded ${i}/${EMPLOYEE_COUNT} employees...`);
      }
    }

    const deployedEmployees = employees.filter(
      (employee) => employee.status === "Deployed"
    );

    let createdContracts = 0;
    let createdDeployments = 0;

    const historical2024Employees = deployedEmployees.slice(
      0,
      DEPLOYMENT_HISTORY[2024]
    );

    const historical2025Employees = deployedEmployees.slice(
      0,
      DEPLOYMENT_HISTORY[2025]
    );

    const current2026Employees = deployedEmployees.slice(
      0,
      DEPLOYMENT_HISTORY[2026]
    );

    for (const employee of historical2024Employees) {
      const deploymentDate = getHistoricalDeploymentStart(2024);
      const endDate = getHistoricalDeploymentEnd(deploymentDate);

      const result = await insertDeploymentAndContract(
        connection,
        employee,
        contractColumns,
        deploymentColumns,
        {
          deploymentDate,
          endDate,
          status: "Completed",
        }
      );

      createdContracts += result.contractsCreated;
      createdDeployments += result.deploymentsCreated;
    }

    for (const employee of historical2025Employees) {
      const deploymentDate = getHistoricalDeploymentStart(2025);
      const endDate = getHistoricalDeploymentEnd(deploymentDate);

      const result = await insertDeploymentAndContract(
        connection,
        employee,
        contractColumns,
        deploymentColumns,
        {
          deploymentDate,
          endDate,
          status: "Completed",
        }
      );

      createdContracts += result.contractsCreated;
      createdDeployments += result.deploymentsCreated;
    }

    for (const employee of current2026Employees) {
      const deploymentDate = employee.contractStart || randomDateForYear(YEAR_2026);

      const result = await insertDeploymentAndContract(
        connection,
        employee,
        contractColumns,
        deploymentColumns,
        {
          deploymentDate,
          endDate: null,
          status: "Active",
        }
      );

      createdContracts += result.contractsCreated;
      createdDeployments += result.deploymentsCreated;
    }

    for (let i = 0; i < HISTORICAL_2024_INCIDENT_CASES.length; i += 1) {
      const [violation, severity, actionTaken] = HISTORICAL_2024_INCIDENT_CASES[i];
      const employee = employeesByIndex.get(301 + i);

      if (!employee) continue;

      await insertIncidentRecord(connection, incidentColumns, employee, {
        incidentDate: randomDateForYear(YEAR_2024),
        status: "Closed",
        severity,
        violation,
        actionTaken,
        recommendation: "Historical closed case",
        reporter: "HR Manager Demo",
      });
    }

    for (let i = 0; i < HISTORICAL_2025_INCIDENT_CASES.length; i += 1) {
      const [violation, severity, actionTaken] = HISTORICAL_2025_INCIDENT_CASES[i];
      const employee = employeesByIndex.get(401 + i);

      if (!employee) continue;

      await insertIncidentRecord(connection, incidentColumns, employee, {
        incidentDate: randomDateForYear(YEAR_2025),
        status: "Closed",
        severity,
        violation,
        actionTaken,
        recommendation: "Historical closed case",
        reporter: "HR Manager Demo",
      });
    }

    for (const currentCase of CURRENT_2026_INCIDENT_CASES) {
      const employee = employeesByIndex.get(currentCase.employeeIndex);

      if (!employee) continue;

      await insertIncidentRecord(connection, incidentColumns, employee, {
        incidentDate: randomDateForYear(YEAR_2026),
        status: currentCase.status,
        severity: currentCase.severity,
        violation: currentCase.violation,
        actionTaken: currentCase.actionTaken,
        recommendation: currentCase.recommendation,
        reporter: currentCase.reporter,
      });
    }

    const createdIncidents =
      HISTORICAL_2024_INCIDENT_CASES.length +
      HISTORICAL_2025_INCIDENT_CASES.length +
      CURRENT_2026_INCIDENT_CASES.length;

    const stats = {
      Employees: createdEmployees,
      Deployed: deployedEmployees.length,
      "Floating / Standby": employees.filter(
        (employee) => employee.status === "Floating / Standby"
      ).length,
      Documents: createdDocuments,
      "Expiring Documents": createdExpiringDocuments,
      "Valid Documents": createdDocuments - createdExpiringDocuments,
      Contracts: createdContracts,
      Deployments: createdDeployments,
      "2024 Deployment Records": DEPLOYMENT_HISTORY[2024],
      "2025 Deployment Records": DEPLOYMENT_HISTORY[2025],
      "2026 Active Deployment Records": DEPLOYMENT_HISTORY[2026],
      "2024 Closed Incidents": HISTORICAL_2024_INCIDENT_CASES.length,
      "2025 Closed Incidents": HISTORICAL_2025_INCIDENT_CASES.length,
      "2026 Active Incidents": CURRENT_2026_INCIDENT_CASES.length,
      "Total Incidents": createdIncidents,
    };

    console.log("Seed completed!");
    console.log("Stats:", stats);
    console.log("Audit logs cleared:", CLEAR_AUDIT_LOGS ? "Yes" : "No");
    console.log("Smart alert/suggestion states cleared:", CLEAR_SMART_STATES ? "Yes" : "No");

    console.log("\nDemo employees to search:");
    console.log("- Carlo R. Gonzales      -> Deployed / NBI Clearance expiring soon");
    console.log("- Princess M. Reyes      -> Deployed / Barangay Clearance expiring soon");
    console.log("- Christian C. Dela Cruz -> Floating / Standby");
    console.log("- Rica E. Morales        -> Current year minor incident demo");
    console.log("- Marvin D. Bautista     -> Current year major incident demo");

    process.exit(0);
  } catch (error) {
    console.error("SEED MOCK DATA ERROR:", error);

    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch (restoreError) {
      console.error("Failed to restore foreign key checks:", restoreError.message);
    }

    process.exit(1);
  }
}

seedMockData();