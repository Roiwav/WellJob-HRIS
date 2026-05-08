const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const EMPLOYEE_COUNT = 1000;
const GOOD_RECORD_COUNT = 500;
const BAD_RECORD_COUNT = 500;

const CLEAR_EXISTING_DATA = true;
const CLEAR_AUDIT_LOGS = true;

const START_DATE = "2024-01-01";
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

const POLICY_RULES = {
  UNEXCUSED_TARDINESS: {
    violation: "Unexcused Tardiness",
    severity: "Minor",
    penalties: [
      { offenseNo: 1, label: "1st offense", action: "Verbal Warning" },
      { offenseNo: 2, label: "2nd offense", action: "Written Warning" },
      { offenseNo: 3, label: "3rd offense", action: "1 day suspension" },
      {
        offenseNo: 4,
        label: "4th offense",
        action:
          "3 days suspension or equivalent number of suspensions from habitual tardiness",
      },
      {
        offenseNo: 5,
        label: "5th offense",
        action:
          "5 days suspension or equivalent number of suspensions from habitual tardiness and subject to commitment letter",
      },
    ],
  },

  AWOL_SINGLE: {
    violation: "Absence Without Official Leave (Single Absence)",
    severity: "Minor",
    penalties: [
      {
        offenseNo: 1,
        label: "1st offense",
        action: "Written and Verbal Warning",
      },
      { offenseNo: 2, label: "2nd offense", action: "1 day suspension" },
      { offenseNo: 3, label: "3rd offense", action: "3 days suspension" },
      {
        offenseNo: 4,
        label: "4th offense",
        action: "5 days suspension and subject to commitment letter",
      },
      {
        offenseNo: 5,
        label: "5th offense",
        action: "7 days suspension or management review based on repeated AWOL record",
      },
    ],
  },

  UNIFORM: {
    violation: "Reporting for Work Not in Prescribed Uniform",
    severity: "Minor",
    penalties: [
      {
        offenseNo: 1,
        label: "1st offense",
        action: "Written and Verbal Warning",
      },
      { offenseNo: 2, label: "2nd offense", action: "3 days suspension" },
      { offenseNo: 3, label: "3rd offense", action: "5 days suspension" },
      {
        offenseNo: 4,
        label: "4th offense",
        action: "7 days suspension and subject to commitment letter",
      },
      {
        offenseNo: 5,
        label: "5th offense",
        action: "HR management review due to repeated uniform violation",
      },
    ],
  },

  JOB_INSTRUCTIONS: {
    violation: "Willful Failure to Carry Out Job Instructions",
    severity: "Major",
    penalties: [
      { offenseNo: 1, label: "1st offense", action: "7 days suspension" },
      { offenseNo: 2, label: "2nd offense", action: "15 days suspension" },
      {
        offenseNo: 3,
        label: "3rd offense",
        action: "30 days suspension and subject to commitment letter",
      },
      { offenseNo: 4, label: "4th offense", action: "Dismissal" },
      { offenseNo: 5, label: "5th offense", action: "Dismissal" },
    ],
  },

  SAFETY: {
    violation: "Violation of Safety Rules and Regulations",
    severity: "Major",
    penalties: [
      { offenseNo: 1, label: "1st offense", action: "15 days suspension" },
      {
        offenseNo: 2,
        label: "2nd offense",
        action: "30 days suspension and subject to commitment letter",
      },
      { offenseNo: 3, label: "3rd offense", action: "Dismissal" },
      { offenseNo: 4, label: "4th offense", action: "Dismissal" },
      { offenseNo: 5, label: "5th offense", action: "Dismissal" },
    ],
  },
};

const BAD_RULE_KEYS = [
  "UNEXCUSED_TARDINESS",
  "AWOL_SINGLE",
  "UNIFORM",
  "JOB_INSTRUCTIONS",
  "SAFETY",
];

const DEMO_EMPLOYEES = [
  {
    index: 1,
    name: "Carlo R. Gonzales",
    company: "SM Supermalls",
    status: "Deployed",
    recordGroup: "GOOD",
    offenseTarget: 0,
    demoNote: "Good record / no incident",
  },
  {
    index: 2,
    name: "Princess M. Reyes",
    company: "Globe Telecom",
    status: "Deployed",
    recordGroup: "GOOD",
    offenseTarget: 0,
    demoNote: "Good deployed employee",
  },
  {
    index: 3,
    name: "Christian C. Dela Cruz",
    company: null,
    status: "Floating / Standby",
    recordGroup: "GOOD",
    offenseTarget: 0,
    demoNote: "Good floating employee",
  },
  {
    index: 501,
    name: "Dennis S. Ramos",
    company: "Puregold Price Club",
    status: "Deployed",
    recordGroup: "BAD",
    offenseTarget: 5,
    ruleKey: "UNEXCUSED_TARDINESS",
    demoNote: "5th offense tardiness",
  },
  {
    index: 502,
    name: "Marvin D. Bautista",
    company: "Accenture Philippines",
    status: "Deployed",
    recordGroup: "BAD",
    offenseTarget: 3,
    ruleKey: "JOB_INSTRUCTIONS",
    demoNote: "3rd offense major violation",
  },
  {
    index: 503,
    name: "Rica E. Morales",
    company: "Jollibee Foods Corporation",
    status: "Deployed",
    recordGroup: "BAD",
    offenseTarget: 2,
    ruleKey: "AWOL_SINGLE",
    demoNote: "2nd offense AWOL",
  },
  {
    index: 504,
    name: "Jayson M. Torres",
    company: "Toyota Philippines",
    status: "Deployed",
    recordGroup: "BAD",
    offenseTarget: 2,
    ruleKey: "AWOL_SINGLE",
    sameDay: true,
    demoNote: "Same-day duplicate test",
  },
  {
    index: 505,
    name: "Michelle A. Santos",
    company: "BDO Unibank",
    status: "Deployed",
    recordGroup: "BAD",
    offenseTarget: 2,
    ruleKey: "UNIFORM",
    sameDay: true,
    closedThenNew: true,
    demoNote: "Closed then new same-day case",
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

function addDaysCapped(dateString, days, maxDateString = END_DATE) {
  const added = toDate(addDays(dateString, days));
  const maxDate = toDate(maxDateString);

  if (added > maxDate) return maxDateString;

  return formatDate(added);
}

function randomDateBetween(startDateString, endDateString) {
  const start = toDate(startDateString).getTime();
  const end = toDate(endDateString).getTime();

  if (start > end) return endDateString;

  const randomTimeValue = randomInt(start, end);
  return formatDate(new Date(randomTimeValue));
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

function getRecordGroup(index, profile) {
  if (profile?.recordGroup) return profile.recordGroup;
  return index <= GOOD_RECORD_COUNT ? "GOOD" : "BAD";
}

function getOffenseTarget(index, profile) {
  if (profile?.offenseTarget !== undefined) return profile.offenseTarget;

  const badIndex = index - GOOD_RECORD_COUNT;

  if (badIndex <= 170) return 2;
  if (badIndex <= 340) return 3;

  return 5;
}

function getEmployeeStatus(index, profile) {
  if (profile?.status) return profile.status;

  if (index % 12 === 0) return "Floating / Standby";
  if (index % 20 === 0) return "Available";

  return "Deployed";
}

function getEmployeeCompany(status, profile) {
  if (status !== "Deployed") return null;
  return profile?.company || randomItem(COMPANIES);
}

function getRuleForEmployee(index, profile) {
  if (profile?.ruleKey && POLICY_RULES[profile.ruleKey]) {
    return POLICY_RULES[profile.ruleKey];
  }

  const ruleKey = BAD_RULE_KEYS[index % BAD_RULE_KEYS.length];
  return POLICY_RULES[ruleKey];
}

function getPenaltyByOffense(rule, offenseNo) {
  const exact = rule.penalties.find(
    (penalty) => Number(penalty.offenseNo) === Number(offenseNo)
  );

  if (exact) return exact;

  const last = rule.penalties[rule.penalties.length - 1];

  return {
    ...last,
    offenseNo,
    label: `${offenseNo}th offense`,
  };
}

function getRecommendationForPenalty(rule, penalty) {
  const action = String(penalty?.action || "").toLowerCase();

  if (action.includes("dismissal")) return "Termination Review";
  if (action.includes("suspension")) return "Suspension Review";
  if (action.includes("written")) return "Written Warning";
  if (action.includes("verbal")) return "Verbal Counseling";

  if (rule.severity === "Critical") return "Termination Review";
  if (rule.severity === "Major") return "Suspension Review";

  return "Verbal Counseling";
}

function getIncidentStatusForOffense({ offenseNo, offenseTarget, profile }) {
  if (profile?.closedThenNew) {
    return offenseNo === 1 ? "Closed" : "Open";
  }

  if (profile?.sameDay) {
    return offenseNo === 1 ? "Open" : "Investigating";
  }

  if (offenseNo < offenseTarget) return "Closed";
  if (offenseTarget >= 5) return "For Review";
  if (offenseTarget >= 3) return "Investigating";

  return "Open";
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
  console.log("Clearing backend records...");

  await connection.query("SET FOREIGN_KEY_CHECKS = 0");

  await safeQuery(connection, "DELETE FROM incident_evidence");
  await safeQuery(connection, "DELETE FROM incidents");
  await safeQuery(connection, "DELETE FROM employee_documents");
  await safeQuery(connection, "DELETE FROM deployments");
  await safeQuery(connection, "DELETE FROM contracts");
  await safeQuery(connection, "DELETE FROM employees");

  if (CLEAR_AUDIT_LOGS) {
    await safeQuery(connection, "DELETE FROM audit_logs");
  }

  await safeQuery(connection, "ALTER TABLE incident_evidence AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE incidents AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE employee_documents AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE deployments AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE contracts AUTO_INCREMENT = 1");
  await safeQuery(connection, "ALTER TABLE employees AUTO_INCREMENT = 1");

  if (CLEAR_AUDIT_LOGS) {
    await safeQuery(connection, "ALTER TABLE audit_logs AUTO_INCREMENT = 1");
  }

  await connection.query("SET FOREIGN_KEY_CHECKS = 1");

  console.log("Backend records cleared.");
}

async function insertEmployee(connection, employeeColumns, index) {
  const profile = getDemoProfile(index);
  const recordGroup = getRecordGroup(index, profile);

  const createdAt = randomDateBetween(START_DATE, END_DATE);
  const status = getEmployeeStatus(index, profile);
  const name = profile?.name || makeFullName();
  const company = getEmployeeCompany(status, profile);

  const contractStart =
    status === "Deployed" ? randomDateBetween(createdAt, END_DATE) : null;

  const result = await insertRow(connection, "employees", employeeColumns, [
    { names: ["name", "full_name", "fullName"], value: name },
    { names: ["company"], value: company },
    { names: ["status"], value: status },
    { names: ["contractStart", "contract_start"], value: contractStart },
    { names: ["contractEnd", "contract_end"], value: null },
    { names: ["archived"], value: 0 },
    { names: ["created_at", "createdAt"], value: `${createdAt} ${randomTime()}` },
  ]);

  return {
    id: result.insertId,
    name,
    company,
    status,
    createdAt,
    index,
    profile,
    recordGroup,
  };
}

async function insertDocuments(connection, documentColumns, employee, mockFilePath) {
  const today = getTodayDate();

  for (const docName of REQUIRED_DOCUMENTS) {
    let expirationDate = null;

    if (EXPIRABLE_DOCUMENTS.includes(docName)) {
      expirationDate = addDays(today, randomInt(120, 730));
    }

    await insertRow(connection, "employee_documents", documentColumns, [
      { names: ["employee_id", "employeeId"], value: employee.id },
      { names: ["name", "document_name", "documentName"], value: docName },
      { names: ["expiration_date", "expirationDate"], value: expirationDate },
      { names: ["file_path", "filePath"], value: mockFilePath },
    ]);
  }
}

async function insertIncidentRecord(
  connection,
  incidentColumns,
  employee,
  rule,
  options = {}
) {
  const offenseNo = Number(options.offenseNo || 1);
  const offenseTarget = Number(options.offenseTarget || offenseNo);
  const penalty = getPenaltyByOffense(rule, offenseNo);
  const recommendation = getRecommendationForPenalty(rule, penalty);

  const baseDate = options.baseDate || randomDateBetween("2026-04-01", END_DATE);

  const incidentDate = options.sameDay
    ? baseDate
    : addDaysCapped(baseDate, offenseNo - 1);

  const status = getIncidentStatusForOffense({
    offenseNo,
    offenseTarget,
    profile: employee.profile,
  });

  const location =
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
      value: `Demo incident: ${penalty.label} for ${rule.violation}. Saved sanction: ${penalty.action}.`,
    },
    { names: ["reported_by", "reportedBy"], value: "System Seeder" },
    { names: ["action_taken", "actionTaken", "sanction"], value: penalty.action },
    { names: ["recommendation"], value: recommendation },
    {
      names: ["resolution_notes", "resolutionNotes"],
      value:
        status === "Closed"
          ? `Closed demo case. ${penalty.label}: ${penalty.action}.`
          : `Policy basis: ${penalty.label}: ${penalty.action}.`,
    },
    { names: ["created_at", "createdAt"], value: `${incidentDate} ${randomTime()}` },
    { names: ["updated_at", "updatedAt"], value: `${incidentDate} ${randomTime()}` },
  ]);

  return 1;
}

async function insertIncidentSeries(connection, incidentColumns, employee) {
  if (employee.recordGroup !== "BAD") return 0;

  const offenseTarget = getOffenseTarget(employee.index, employee.profile);

  if (offenseTarget <= 0) return 0;

  const rule = getRuleForEmployee(employee.index, employee.profile);
  const baseDate = randomDateBetween("2026-04-01", END_DATE);

  let created = 0;

  for (let offenseNo = 1; offenseNo <= offenseTarget; offenseNo += 1) {
    created += await insertIncidentRecord(
      connection,
      incidentColumns,
      employee,
      rule,
      {
        offenseNo,
        offenseTarget,
        baseDate,
        sameDay: Boolean(employee.profile?.sameDay),
      }
    );
  }

  return created;
}

async function seedMockData() {
  const connection = db.promise();
  const mockFilePath = createMockPdfFile();

  try {
    console.log("Starting Welljob 1000 employee demo seed...");
    console.log(`Target employees: ${EMPLOYEE_COUNT}`);
    console.log(`Good records: ${GOOD_RECORD_COUNT}`);
    console.log(`Bad records: ${BAD_RECORD_COUNT}`);
    console.log("Compliance: all complete and valid.");
    console.log("Companies: official company list only.");

    if (CLEAR_EXISTING_DATA) {
      await clearExistingData(connection);
    }

    const employeeColumns = await getTableColumns(connection, "employees");
    const documentColumns = await getTableColumns(connection, "employee_documents");
    const incidentColumns = await getTableColumns(connection, "incidents");

    let createdEmployees = 0;
    let createdDocuments = 0;
    let createdIncidents = 0;

    const stats = {
      GOOD: 0,
      BAD: 0,
      "2nd offense employees": 0,
      "3rd offense employees": 0,
      "5th offense employees": 0,
      Deployed: 0,
      "Floating / Standby": 0,
      Available: 0,
    };

    for (let i = 1; i <= EMPLOYEE_COUNT; i += 1) {
      const employee = await insertEmployee(connection, employeeColumns, i);

      stats[employee.recordGroup] += 1;
      stats[employee.status] = (stats[employee.status] || 0) + 1;

      await insertDocuments(connection, documentColumns, employee, mockFilePath);

      const incidentCount = await insertIncidentSeries(
        connection,
        incidentColumns,
        employee
      );

      if (employee.recordGroup === "BAD") {
        const offenseTarget = getOffenseTarget(employee.index, employee.profile);

        if (offenseTarget === 2) stats["2nd offense employees"] += 1;
        if (offenseTarget === 3) stats["3rd offense employees"] += 1;
        if (offenseTarget === 5) stats["5th offense employees"] += 1;
      }

      createdEmployees += 1;
      createdDocuments += REQUIRED_DOCUMENTS.length;
      createdIncidents += incidentCount;

      if (i % 100 === 0) {
        console.log(`Seeded ${i}/${EMPLOYEE_COUNT} employees...`);
      }
    }

    console.log("Seed completed!");
    console.log(`Employees created: ${createdEmployees}`);
    console.log(`Documents created: ${createdDocuments}`);
    console.log(`Incidents created: ${createdIncidents}`);
    console.log("Audit logs cleared:", CLEAR_AUDIT_LOGS ? "Yes" : "No");
    console.log("Stats:", stats);

    console.log("\nDemo employees to search:");
    console.log("- Carlo R. Gonzales      -> Good record / no incident");
    console.log("- Princess M. Reyes      -> Good deployed employee");
    console.log("- Christian C. Dela Cruz -> Good floating employee");
    console.log("- Rica E. Morales        -> 2nd offense AWOL");
    console.log("- Marvin D. Bautista     -> 3rd offense job instruction");
    console.log("- Dennis S. Ramos        -> 5th offense tardiness");
    console.log("- Jayson M. Torres       -> Same-day duplicate test");
    console.log("- Michelle A. Santos     -> Closed then new same-day case");

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