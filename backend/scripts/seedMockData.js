const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const EMPLOYEE_COUNT = 1700;

const CLEAR_EXISTING_DATA = true;
const CLEAR_AUDIT_LOGS = true;

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
    name: "Rica E. Morales",
    company: "Jollibee Foods Corporation",
    status: "Deployed",
  },
  {
    index: 3,
    name: "Dennis S. Ramos",
    company: "Puregold Price Club",
    status: "Deployed",
  },
  {
    index: 4,
    name: "Angelica F. Navarro",
    company: "Concentrix Philippines",
    status: "Deployed",
  },
  {
    index: 5,
    name: "Jayson M. Torres",
    company: "Toyota Philippines",
    status: "Deployed",
  },
  {
    index: 6,
    name: "Michelle A. Santos",
    company: "BDO Unibank",
    status: "Deployed",
  },
  {
    index: 7,
    name: "Princess M. Reyes",
    company: "Globe Telecom",
    status: "Deployed",
  },
  {
    index: 8,
    name: "Christian C. Dela Cruz",
    company: null,
    status: "Floating / Standby",
  },
  {
    index: 9,
    name: "Marvin D. Bautista",
    company: "Accenture Philippines",
    status: "Deployed",
  },
  {
    index: 10,
    name: "Grace V. Rivera",
    company: "Unilab Inc.",
    status: "Deployed",
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
  "Bryan",
  "Irish",
  "Liza",
  "Rose",
  "Anthony",
  "Gerald",
  "Patrick",
  "Kathleen",
  "Janine",
  "Mary Joy",
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

function chance(percent) {
  return Math.random() * 100 < percent;
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

function getCleanEmployeeStatus(index, profile) {
  if (profile?.status) return profile.status;

  const roll = index % 100;

  if (roll < 82) return "Deployed";
  if (roll < 94) return "Floating / Standby";
  return "Available";
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

  console.log("Backend records cleared.");
}

async function insertEmployee(connection, employeeColumns, index) {
  const profile = getDemoProfile(index);

  const createdAt = randomDateBetween("2024-01-01", getTodayDate());
  const status = getCleanEmployeeStatus(index, profile);
  const name = profile?.name || makeFullName();

  const company =
    status === "Deployed" ? profile?.company || randomItem(COMPANIES) : null;

  const contractStart =
    status === "Deployed"
      ? randomDateBetween(createdAt, getTodayDate())
      : null;

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

async function seedMockData() {
  const connection = db.promise();
  const mockFilePath = createMockPdfFile();

  try {
    console.log("Starting clean Welljob 1700 employee seed...");
    console.log(`Target employees: ${EMPLOYEE_COUNT}`);
    console.log("Mode: Complete compliance, valid documents, ZERO incidents.");

    if (CLEAR_EXISTING_DATA) {
      await clearExistingData(connection);
    }

    const employeeColumns = await getTableColumns(connection, "employees");
    const documentColumns = await getTableColumns(connection, "employee_documents");

    let createdEmployees = 0;
    let createdDocuments = 0;

    const statusStats = {
      Deployed: 0,
      "Floating / Standby": 0,
      Available: 0,
    };

    for (let i = 1; i <= EMPLOYEE_COUNT; i += 1) {
      const employee = await insertEmployee(connection, employeeColumns, i);

      statusStats[employee.status] = (statusStats[employee.status] || 0) + 1;

      await insertDocuments(connection, documentColumns, employee, mockFilePath);

      createdEmployees += 1;
      createdDocuments += REQUIRED_DOCUMENTS.length;

      if (i % 100 === 0) {
        console.log(`Seeded ${i}/${EMPLOYEE_COUNT} employees...`);
      }
    }

    console.log("Clean seed completed!");
    console.log(`Employees created: ${createdEmployees}`);
    console.log(`Documents created: ${createdDocuments}`);
    console.log("Incidents created: 0");
    console.log("Incident evidence created: 0");
    console.log("Audit logs cleared:", CLEAR_AUDIT_LOGS ? "Yes" : "No");
    console.log("Status Summary:", statusStats);

    console.log("\nManual incident test employees:");
    DEMO_EMPLOYEES.forEach((employee) => {
      console.log(`- ${employee.name}`);
    });

    console.log("\nManual test flow:");
    console.log("1. Add incident for Dennis S. Ramos.");
    console.log("2. Select a policy violation such as Unexcused Tardiness.");
    console.log("3. Open Employee Record modal.");
    console.log("4. Confirm sanction appears as 1st offense.");
    console.log("5. Add same violation again.");
    console.log("6. Confirm sanction appears as 2nd offense.");

    process.exit(0);
  } catch (error) {
    console.error("SEED MOCK DATA ERROR:", error);

    try {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch (restoreError) {
      console.error("Failed to restore FK checks:", restoreError.message);
    }

    process.exit(1);
  }
}

seedMockData();