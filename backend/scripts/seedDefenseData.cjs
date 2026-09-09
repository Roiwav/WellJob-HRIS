require("dotenv").config();

const fs = require("fs");
const path = require("path");
const db = require("../config/db");

const CONFIRM_VALUE = "YES";
const REFERENCE_DATE = "2026-09-08";

const CURRENT_DEPLOYED = 1510;
const CURRENT_FLOATING = 114;
const HISTORICAL_INACTIVE = 30;
const CURRENT_WORKFORCE = CURRENT_DEPLOYED + CURRENT_FLOATING;
const TOTAL_EMPLOYEE_RECORDS =
  CURRENT_WORKFORCE + HISTORICAL_INACTIVE;

const REDEPLOYED_EMPLOYEES = 200;

const COMPANIES = [
  "SM Supermalls",
  "Robinsons Retail Holdings",
  "Ayala Land Inc.",
  "Jollibee Foods Corporation",
  "San Miguel Corporation",
  "PLDT Inc.",
  "Globe Telecom",
  "BDO Unibank",
  "Toyota Philippines",
  "Accenture Philippines",
  "Puregold Price Club",
  "Wilcon Depot",
];

const ACTIVE_COMPANY_COUNTS = [
  ["SM Supermalls", 220],
  ["Robinsons Retail Holdings", 180],
  ["Ayala Land Inc.", 160],
  ["Jollibee Foods Corporation", 150],
  ["San Miguel Corporation", 140],
  ["PLDT Inc.", 120],
  ["Globe Telecom", 110],
  ["BDO Unibank", 105],
  ["Toyota Philippines", 100],
  ["Accenture Philippines", 95],
  ["Puregold Price Club", 75],
  ["Wilcon Depot", 55],
];

const COMPANY_LOCATIONS = {
  "SM Supermalls": "Calamba City, Laguna",
  "Robinsons Retail Holdings": "Calamba City, Laguna",
  "Ayala Land Inc.": "Makati City",
  "Jollibee Foods Corporation": "Pasig City",
  "San Miguel Corporation": "Mandaluyong City",
  "PLDT Inc.": "Makati City",
  "Globe Telecom": "Taguig City",
  "BDO Unibank": "Makati City",
  "Toyota Philippines": "Santa Rosa, Laguna",
  "Accenture Philippines": "Taguig City",
  "Puregold Price Club": "Quezon City",
  "Wilcon Depot": "Quezon City",
};

const POSITIONS = [
  "Merchandiser",
  "Sales Associate",
  "Warehouse Helper",
  "Production Operator",
  "Service Crew",
  "Utility Worker",
  "Cashier",
  "Promodiser",
  "Delivery Helper",
  "Checker",
  "Encoder",
  "Team Leader",
];

const FIRST_NAMES = [
  "Aaron",
  "Adrian",
  "Aileen",
  "Aira",
  "Alexis",
  "Allan",
  "Angela",
  "Angelo",
  "April",
  "Arvin",
  "Bea",
  "Carlo",
  "Catherine",
  "Christian",
  "Clarissa",
  "Daniel",
  "Dianne",
  "Edgar",
  "Elaine",
  "Erika",
  "Francis",
  "Gerald",
  "Grace",
  "Hazel",
  "Ivan",
  "Janelle",
  "Jerome",
  "Joanna",
  "Joshua",
  "Joyce",
  "Karen",
  "Kenneth",
  "Kristine",
  "Lance",
  "Lara",
  "Mark",
  "Michael",
  "Nicole",
  "Paolo",
  "Trisha",
];

const LAST_NAMES = [
  "Aguilar",
  "Alvarez",
  "Aquino",
  "Bautista",
  "Castillo",
  "Castro",
  "Cruz",
  "David",
  "Delos Reyes",
  "Diaz",
  "Domingo",
  "Dizon",
  "Evangelista",
  "Flores",
  "Garcia",
  "Gomez",
  "Gonzales",
  "Gutierrez",
  "Hernandez",
  "Jimenez",
  "Lazaro",
  "Lopez",
  "Manalo",
  "Mendoza",
  "Mercado",
  "Navarro",
  "Pascual",
  "Perez",
  "Ramos",
  "Reyes",
  "Rivera",
  "Rodriguez",
  "Santiago",
  "Santos",
  "Soriano",
  "Torres",
  "Valdez",
  "Velasco",
  "Villanueva",
  "Yap",
  "Abad",
  "Bernardo",
  "Cabrera",
  "De Guzman",
  "Fajardo",
  "Lim",
  "Marquez",
  "Ocampo",
  "Padilla",
  "Salazar",
];

const MINOR_VIOLATIONS = [
  "Attendance and Punctuality Violation",
  "Uniform / Grooming Non-Compliance",
  "Failure to Follow Routine Procedure",
];

const MAJOR_VIOLATIONS = [
  "Negligence of Duty",
  "Insubordination",
  "Repeated Policy Violation",
];

const CRITICAL_VIOLATIONS = [
  "Serious Misconduct",
  "Theft / Dishonesty",
  "Workplace Safety Endangerment",
];

const REQUIRED_TABLES = [
  "employees",
  "employee_documents",
  "deployment_assignments",
  "employee_status_history",
  "incidents",
  "incident_timeline",
  "incident_evidence",
  "kpi_decision_history",
  "smart_alert_states",
  "smart_suggestion_states",
  "audit_logs",
  "users",
  "system_settings",
];

function pad(value) {
  return String(value).padStart(2, "0");
}

function toDate(value) {
  return new Date(`${value}T00:00:00Z`);
}

function formatDate(date) {
  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join("-");
}

function formatDateTime(date) {
  return `${formatDate(date)} ${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}:${pad(
    date.getUTCSeconds()
  )}`;
}

function addDays(value, days) {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : toDate(value);

  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function addMonths(value, months) {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : toDate(value);

  date.setUTCMonth(date.getUTCMonth() + months);
  return date;
}

function makeDate(year, month, day) {
  return formatDate(
    new Date(Date.UTC(year, month - 1, day))
  );
}

function dateWithinMonth(year, month, seed) {
  const day = 3 + ((seed * 7) % 24);
  return makeDate(year, month, day);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function createEmployeeName(seedIndex) {
  const first =
    FIRST_NAMES[(seedIndex - 1) % FIRST_NAMES.length];

  const last =
    LAST_NAMES[
      Math.floor(
        (seedIndex - 1) / FIRST_NAMES.length
      ) % LAST_NAMES.length
    ];

  const middleInitial = String.fromCharCode(
    65 + ((seedIndex * 11) % 26)
  );

  return `${first} ${middleInitial}. ${last}`;
}

function currentStatusForSeedIndex(seedIndex) {
  if (seedIndex <= CURRENT_DEPLOYED) {
    return "Deployed";
  }

  if (seedIndex <= CURRENT_WORKFORCE) {
    return "Floating / Standby";
  }

  return "Inactive";
}

function companyForActiveOrdinal(ordinal) {
  let cursor = 0;

  for (const [company, count] of ACTIVE_COMPANY_COUNTS) {
    cursor += count;

    if (ordinal <= cursor) {
      return company;
    }
  }

  return ACTIVE_COMPANY_COUNTS.at(-1)[0];
}

function positionFor(seedIndex) {
  return POSITIONS[(seedIndex - 1) % POSITIONS.length];
}

function activeStartDateFor(seedIndex) {
  if (seedIndex >= 201 && seedIndex <= 246) {
    const month = seedIndex <= 223 ? 1 : 2;
    return dateWithinMonth(2025, month, seedIndex);
  }

  if (seedIndex <= REDEPLOYED_EMPLOYEES) {
    const month = 1 + ((seedIndex - 1) % 8);
    return dateWithinMonth(2026, month, seedIndex);
  }

  if (seedIndex <= 650) {
    const month = 1 + ((seedIndex - 201) % 12);
    return dateWithinMonth(2025, month, seedIndex);
  }

  const month = 1 + ((seedIndex - 651) % 8);
  return dateWithinMonth(2026, month, seedIndex);
}

function lastAssignmentDatesForFloating(seedIndex) {
  const local = seedIndex - CURRENT_DEPLOYED;
  const startMonth = 1 + ((local - 1) % 10);
  const start = dateWithinMonth(2025, startMonth, seedIndex);
  const duration = 180 + ((local * 13) % 180);
  let end = formatDate(addDays(start, duration));

  if (end > "2026-08-31") {
    end = dateWithinMonth(
      2026,
      1 + ((local - 1) % 8),
      seedIndex
    );
  }

  return {
    start,
    end,
  };
}

function inactiveAssignmentDates(seedIndex) {
  const local = seedIndex - CURRENT_WORKFORCE;
  const start = dateWithinMonth(
    2025,
    1 + ((local - 1) % 8),
    seedIndex
  );

  const endYear = local <= 12 ? 2025 : 2026;
  const endMonth =
    local <= 12
      ? 9 + ((local - 1) % 4)
      : 1 + ((local - 13) % 8);

  const end = dateWithinMonth(
    endYear,
    endMonth,
    seedIndex + 3
  );

  return {
    start,
    end,
  };
}

function completedReasonFor(seedIndex) {
  const reasons = [
    "End of Assignment / Pulled Out by Client",
    "Transferred / Reassigned",
    "Completed Contract",
  ];

  return reasons[(seedIndex - 1) % reasons.length];
}

function inactiveReasonFor(seedIndex) {
  const reasons = [
    "Resigned",
    "AWOL",
    "Terminated",
  ];

  return reasons[
    (seedIndex - CURRENT_WORKFORCE - 1) %
      reasons.length
  ];
}

function parseDocumentOptions() {
  const constantsPath = path.resolve(
    __dirname,
    "../../frontend/src/components/employees/employeeConstants.js"
  );

  if (!fs.existsSync(constantsPath)) {
    throw new Error(
      `Cannot find employeeConstants.js at ${constantsPath}`
    );
  }

  const source = fs.readFileSync(constantsPath, "utf8");
  const declarationIndex = source.indexOf(
    "DOCUMENT_OPTIONS"
  );

  if (declarationIndex < 0) {
    throw new Error(
      "DOCUMENT_OPTIONS was not found in employeeConstants.js."
    );
  }

  const arrayStart = source.indexOf("[", declarationIndex);

  if (arrayStart < 0) {
    throw new Error(
      "DOCUMENT_OPTIONS array start was not found."
    );
  }

  let depth = 0;
  let arrayEnd = -1;

  for (let i = arrayStart; i < source.length; i += 1) {
    if (source[i] === "[") {
      depth += 1;
    }

    if (source[i] === "]") {
      depth -= 1;

      if (depth === 0) {
        arrayEnd = i;
        break;
      }
    }
  }

  if (arrayEnd < 0) {
    throw new Error(
      "DOCUMENT_OPTIONS array end was not found."
    );
  }

  const block = source.slice(arrayStart + 1, arrayEnd);
  const objectMatches = block.match(/\{[\s\S]*?\}/g) || [];
  const options = [];

  for (const objectText of objectMatches) {
    const nameMatch = objectText.match(
      /name\s*:\s*["'`]([^"'`]+)["'`]/
    );

    if (!nameMatch) {
      continue;
    }

    const expirableMatch = objectText.match(
      /expirable\s*:\s*(true|false)/
    );

    options.push({
      name: nameMatch[1].trim(),
      expirable:
        expirableMatch?.[1] === "true",
    });
  }

  if (options.length === 0) {
    throw new Error(
      "No document options could be parsed from employeeConstants.js."
    );
  }

  return options;
}

function buildSimplePdf(text) {
  const safeText = String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

  const stream = `BT
/F1 14 Tf
50 760 Td
(${safeText}) Tj
0 -24 Td
(Synthetic defense dataset placeholder document.) Tj
ET`;

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(
      stream,
      "utf8"
    )} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((objectText, index) => {
    offsets[index + 1] = Buffer.byteLength(
      pdf,
      "utf8"
    );

    pdf += `${index + 1} 0 obj\n${objectText}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");

  pdf += `xref
0 ${objects.length + 1}
0000000000 65535 f 
`;

  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(
      10,
      "0"
    )} 00000 n 
`;
  }

  pdf += `trailer
<< /Size ${objects.length + 1} /Root 1 0 R >>
startxref
${xrefOffset}
%%EOF
`;

  return Buffer.from(pdf, "utf8");
}

function createPlaceholderDocuments(documentOptions) {
  const directory = path.resolve(
    __dirname,
    "../documents/seed-defense"
  );

  fs.mkdirSync(directory, {
    recursive: true,
  });

  const paths = new Map();

  for (const option of documentOptions) {
    const fileName = `${slugify(option.name) || "document"}.pdf`;
    const absolutePath = path.join(directory, fileName);

    fs.writeFileSync(
      absolutePath,
      buildSimplePdf(option.name)
    );

    paths.set(
      option.name,
      `documents/seed-defense/${fileName}`
    );
  }

  return paths;
}

async function ensureTables(connection) {
  const [rows] = await connection.query("SHOW TABLES");
  const existing = new Set(
    rows.map((row) => Object.values(row)[0])
  );

  const missing = REQUIRED_TABLES.filter(
    (table) => !existing.has(table)
  );

  if (missing.length > 0) {
    throw new Error(
      `Missing required table(s): ${missing.join(", ")}`
    );
  }
}

async function getRoleUsers(connection) {
  const [rows] = await connection.query(
    `
    SELECT
      id,
      user_id,
      username,
      full_name,
      role,
      status
    FROM users
    WHERE status = 'Active'
    ORDER BY id ASC
    `
  );

  const byRole = new Map();

  for (const row of rows) {
    if (!byRole.has(row.role)) {
      byRole.set(row.role, row);
    }
  }

  return {
    hrStaff: byRole.get("HR_STAFF") || null,
    hrManager: byRole.get("HR_MANAGER") || null,
    superAdmin: byRole.get("SUPER_ADMIN") || null,
  };
}

async function resetOperationalData(connection) {
  const tables = [
    "incident_evidence",
    "incident_timeline",
    "incidents",
    "kpi_decision_history",
    "smart_alert_states",
    "smart_suggestion_states",
    "employee_documents",
    "deployment_assignments",
    "employee_status_history",
    "employees",
  ];

  for (const table of tables) {
    await connection.query(`DELETE FROM \`${table}\``);
  }

  await connection.query(
    `
    DELETE FROM audit_logs
    WHERE category = 'OPERATIONAL'
    `
  );
}

async function insertRows(
  connection,
  table,
  columns,
  rows,
  chunkSize = 400
) {
  if (!rows.length) {
    return [];
  }

  const insertedIds = [];

  for (
    let offset = 0;
    offset < rows.length;
    offset += chunkSize
  ) {
    const chunk = rows.slice(offset, offset + chunkSize);

    const placeholders = chunk
      .map(
        () =>
          `(${columns.map(() => "?").join(", ")})`
      )
      .join(", ");

    const sql = `
      INSERT INTO \`${table}\`
      (${columns.map((column) => `\`${column}\``).join(", ")})
      VALUES ${placeholders}
    `;

    const values = chunk.flat();
    const [result] = await connection.query(sql, values);

    for (let i = 0; i < chunk.length; i += 1) {
      insertedIds.push(result.insertId + i);
    }
  }

  return insertedIds;
}

function documentCountForEmployee(
  seedIndex,
  totalDocuments
) {
  if (seedIndex <= CURRENT_DEPLOYED) {
    if (seedIndex <= 1200) {
      return totalDocuments;
    }

    if (seedIndex <= 1400) {
      return Math.max(totalDocuments - 2, 1);
    }

    if (seedIndex <= 1480) {
      return Math.max(
        Math.ceil(totalDocuments * 0.55),
        1
      );
    }

    return Math.min(2, totalDocuments);
  }

  if (seedIndex <= CURRENT_WORKFORCE) {
    const local = seedIndex - CURRENT_DEPLOYED;

    if (local <= 40) {
      return totalDocuments;
    }

    if (local <= 80) {
      return Math.max(totalDocuments - 2, 1);
    }

    if (local <= 104) {
      return Math.max(
        Math.ceil(totalDocuments * 0.55),
        1
      );
    }

    return Math.min(2, totalDocuments);
  }

  return 0;
}

function expirationDateFor(
  seedIndex,
  documentIndex,
  document,
  status
) {
  if (!document.expirable) {
    return null;
  }

  const isBarangayClearance =
    document.name === "Barangay Clearance";

  const isNbiOrPoliceClearance =
    document.name === "NBI/Police Clearance";

  if (
    isNbiOrPoliceClearance &&
    seedIndex % 37 === 0
  ) {
    return formatDate(
      addDays(
        REFERENCE_DATE,
        14
      )
    );
  }

  if (
    isBarangayClearance &&
    seedIndex % 53 === 0
  ) {
    return formatDate(
      addDays(
        REFERENCE_DATE,
        24
      )
    );
  }

  if (
    isBarangayClearance &&
    seedIndex % 41 === 0
  ) {
    return formatDate(
      addDays(
        REFERENCE_DATE,
        -10
      )
    );
  }

  if (
    isNbiOrPoliceClearance &&
    seedIndex % 47 === 0
  ) {
    return formatDate(
      addDays(
        REFERENCE_DATE,
        -20
      )
    );
  }

  const year =
    (seedIndex + documentIndex) % 2 === 0
      ? 2027
      : 2028;

  const month =
    3 + ((seedIndex + documentIndex) % 9);

  return makeDate(
    year,
    month,
    15 + ((seedIndex + documentIndex) % 10)
  );
}

function incidentSeveritySequence(
  profile,
  incidentNumber
) {
  if (profile === "single") {
    if (incidentNumber === 0) {
      return "Minor";
    }
  }

  if (profile === "double") {
    return incidentNumber === 0 ? "Minor" : "Major";
  }

  if (profile === "repeat") {
    return ["Minor", "Major", "Major"][
      incidentNumber % 3
    ];
  }

  return [
    "Minor",
    "Major",
    "Critical",
    "Major",
    "Minor",
    "Critical",
    "Major",
  ][incidentNumber % 7];
}

function incidentViolationFor(severity, seed) {
  const source =
    severity === "Critical"
      ? CRITICAL_VIOLATIONS
      : severity === "Major"
        ? MAJOR_VIOLATIONS
        : MINOR_VIOLATIONS;

  return source[seed % source.length];
}

function policySanctionFor(severity) {
  if (severity === "Critical") {
    return "Termination Review";
  }

  if (severity === "Major") {
    return "Suspension Review";
  }

  return "Written Warning";
}

function recommendationFor(severity) {
  if (severity === "Critical") {
    return "Priority management review";
  }

  if (severity === "Major") {
    return "Disciplinary review and close monitoring";
  }

  return "Monitor and reinforce policy compliance";
}

function incidentMonthList() {
  const months = [];

  for (let month = 3; month <= 12; month += 1) {
    months.push([2025, month]);
  }

  for (let month = 1; month <= 8; month += 1) {
    months.push([2026, month]);
  }

  return months;
}

function incidentStatusFor(date, globalIndex) {
  if (date <= "2026-05-31") {
    return "Closed";
  }

  const choices = [
    "Open",
    "Investigating",
    "For Review",
    "Closed",
  ];

  return choices[globalIndex % choices.length];
}

function actorFields(user) {
  return {
    id:
      user?.user_id ||
      (user?.id ? String(user.id) : null),
    username: user?.username || null,
    name: user?.full_name || null,
    role: user?.role || null,
  };
}

function buildManifest({
  documentOptions,
  documentsInserted,
  assignmentsInserted,
  historyInserted,
  incidentsInserted,
  timelineInserted,
  employeeIdsBySeed,
}) {
  const showcaseSeedIndexes = [
    201,
    202,
    203,
    204,
    205,
    206,
    1511,
    1512,
    1,
    2,
  ];

  return {
    generatedAt: new Date().toISOString(),
    referenceDate: REFERENCE_DATE,
    currentWorkforce: CURRENT_WORKFORCE,
    currentDeployed: CURRENT_DEPLOYED,
    currentFloating: CURRENT_FLOATING,
    historicalInactiveArchived: HISTORICAL_INACTIVE,
    totalEmployeeRecords: TOTAL_EMPLOYEE_RECORDS,
    redeployedCurrentEmployees: REDEPLOYED_EMPLOYEES,
    deploymentAssignments: assignmentsInserted,
    statusHistoryRows: historyInserted,
    employeeDocumentRows: documentsInserted,
    incidentRows: incidentsInserted,
    incidentTimelineRows: timelineInserted,
    complianceRequirementNames: documentOptions.map(
      (option) => option.name
    ),
    showcase: showcaseSeedIndexes.map((seedIndex) => ({
      seedIndex,
      employeeId: employeeIdsBySeed.get(seedIndex),
      expectedUse:
        seedIndex >= 201 && seedIndex <= 204
          ? "High-risk KPI / DSS scenario"
          : seedIndex >= 205 && seedIndex <= 212
            ? "Repeat-offender scenario"
            : seedIndex >= 1511
              ? "Floating / standby scenario"
              : "Redeployment history scenario",
    })),
  };
}

async function main() {
  if (
    process.env.DEFENSE_SEED_CONFIRM !==
    CONFIRM_VALUE
  ) {
    console.error(
      'Seed cancelled. Set DEFENSE_SEED_CONFIRM="YES" before running.'
    );
    process.exit(1);
  }

  const documentOptions = parseDocumentOptions();

  console.log(
    `Detected ${documentOptions.length} current compliance requirement(s).`
  );

  const placeholderPaths =
    createPlaceholderDocuments(documentOptions);

  const connection =
    await db.promise().getConnection();

  let transactionStarted = false;

  try {
    await ensureTables(connection);

    const roleUsers = await getRoleUsers(connection);

    if (!roleUsers.hrStaff || !roleUsers.hrManager) {
      throw new Error(
        "Active HR_STAFF and HR_MANAGER accounts are required before defense seeding."
      );
    }

    const hrStaffActor = actorFields(roleUsers.hrStaff);
    const hrManagerActor = actorFields(roleUsers.hrManager);

    await connection.beginTransaction();
    transactionStarted = true;

    await resetOperationalData(connection);

    const employeeRows = [];

    for (
      let seedIndex = 1;
      seedIndex <= TOTAL_EMPLOYEE_RECORDS;
      seedIndex += 1
    ) {
      const status = currentStatusForSeedIndex(seedIndex);
      const name = createEmployeeName(seedIndex);
      let company = null;
      let contractStart = null;
      let contractEnd = null;
      let endReason = null;
      let endRemarks = null;
      let endedAt = null;
      let archived = 0;

      if (status === "Deployed") {
        company = companyForActiveOrdinal(seedIndex);
        contractStart = activeStartDateFor(seedIndex);
      } else if (status === "Floating / Standby") {
        const dates = lastAssignmentDatesForFloating(seedIndex);
        company =
          COMPANIES[
            (seedIndex - CURRENT_DEPLOYED - 1) %
              COMPANIES.length
          ];
        contractStart = dates.start;
        contractEnd = dates.end;
        endReason = completedReasonFor(seedIndex);
        endRemarks =
          endReason ===
          "End of Assignment / Pulled Out by Client"
            ? "Client assignment ended; employee retained for redeployment."
            : "Previous assignment completed; employee available for reassignment.";
        endedAt = `${contractEnd} 17:00:00`;
      } else {
        const dates = inactiveAssignmentDates(seedIndex);
        company =
          COMPANIES[
            (seedIndex - CURRENT_WORKFORCE - 1) %
              COMPANIES.length
          ];
        contractStart = dates.start;
        contractEnd = dates.end;
        endReason = inactiveReasonFor(seedIndex);
        endRemarks =
          "Historical inactive employee record retained for reporting.";
        endedAt = `${contractEnd} 17:00:00`;
        archived = 1;
      }

      let employeeOriginDate =
        contractStart || "2025-01-01";

      if (
        status === "Deployed" &&
        seedIndex <= REDEPLOYED_EMPLOYEES
      ) {
        const previousEnd = formatDate(
          addDays(contractStart, -21)
        );

        employeeOriginDate = formatDate(
          addDays(
            previousEnd,
            -240 - (seedIndex % 90)
          )
        );
      }

      const createdAt = formatDateTime(
        addDays(employeeOriginDate, -14)
      );

      employeeRows.push([
        name,
        company,
        status,
        contractStart,
        contractEnd,
        createdAt,
        archived,
        endReason,
        endRemarks,
        endedAt,
        createdAt,
      ]);
    }

    const employeeIds = await insertRows(
      connection,
      "employees",
      [
        "name",
        "company",
        "status",
        "contractStart",
        "contractEnd",
        "created_at",
        "archived",
        "contractEndReason",
        "contractEndRemarks",
        "contractEndedAt",
        "updated_at",
      ],
      employeeRows,
      300
    );

    const employeeIdsBySeed = new Map();

    employeeIds.forEach((employeeId, index) => {
      employeeIdsBySeed.set(index + 1, employeeId);
    });

    const assignmentRows = [];
    const historyRows = [];

    for (
      let seedIndex = 1;
      seedIndex <= TOTAL_EMPLOYEE_RECORDS;
      seedIndex += 1
    ) {
      const employeeId = employeeIdsBySeed.get(seedIndex);
      const status = currentStatusForSeedIndex(seedIndex);

      if (status === "Deployed") {
        const currentCompany =
          companyForActiveOrdinal(seedIndex);
        const currentStart =
          activeStartDateFor(seedIndex);

        if (seedIndex <= REDEPLOYED_EMPLOYEES) {
          const previousCompany =
            COMPANIES[
              (COMPANIES.indexOf(currentCompany) + 3) %
                COMPANIES.length
            ];

          const previousEnd = formatDate(
            addDays(currentStart, -21)
          );

          const previousStart = formatDate(
            addDays(previousEnd, -240 - (seedIndex % 90))
          );

          const previousReason =
            completedReasonFor(seedIndex);

          assignmentRows.push([
            employeeId,
            previousCompany,
            positionFor(seedIndex + 2),
            previousStart,
            previousEnd,
            previousReason,
            "Historical assignment completed before redeployment.",
            "Completed",
            `${previousEnd} 17:00:00`,
            roleUsers.hrStaff.id,
            `${previousStart} 08:00:00`,
            `${previousEnd} 17:00:00`,
          ]);

          historyRows.push([
            employeeId,
            null,
            "Deployed",
            `${previousStart} 08:00:00`,
            "Initial historical deployment",
            `Assigned to ${previousCompany}.`,
            "EMPLOYEE_CREATED",
            roleUsers.hrStaff.id,
          ]);

          historyRows.push([
            employeeId,
            "Deployed",
            "Floating / Standby",
            `${previousEnd} 17:00:00`,
            previousReason,
            "Employee temporarily returned to the floating pool.",
            "DEPLOYMENT_ENDED",
            roleUsers.hrStaff.id,
          ]);

          historyRows.push([
            employeeId,
            "Floating / Standby",
            "Deployed",
            `${currentStart} 08:00:00`,
            "Redeployed",
            `Redeployed to ${currentCompany}.`,
            "EMPLOYEE_REDEPLOYED",
            roleUsers.hrStaff.id,
          ]);
        } else {
          historyRows.push([
            employeeId,
            null,
            "Deployed",
            `${currentStart} 08:00:00`,
            "Initial deployment",
            `Assigned to ${currentCompany}.`,
            "EMPLOYEE_CREATED",
            roleUsers.hrStaff.id,
          ]);
        }

        assignmentRows.push([
          employeeId,
          currentCompany,
          positionFor(seedIndex),
          currentStart,
          null,
          null,
          null,
          "Active",
          null,
          roleUsers.hrStaff.id,
          `${currentStart} 08:00:00`,
          `${currentStart} 08:00:00`,
        ]);
      }

      if (status === "Floating / Standby") {
        const dates =
          lastAssignmentDatesForFloating(seedIndex);

        const company =
          COMPANIES[
            (seedIndex - CURRENT_DEPLOYED - 1) %
              COMPANIES.length
          ];

        const reason =
          completedReasonFor(seedIndex);

        assignmentRows.push([
          employeeId,
          company,
          positionFor(seedIndex),
          dates.start,
          dates.end,
          reason,
          "Assignment ended; employee retained for redeployment.",
          "Completed",
          `${dates.end} 17:00:00`,
          roleUsers.hrStaff.id,
          `${dates.start} 08:00:00`,
          `${dates.end} 17:00:00`,
        ]);

        historyRows.push([
          employeeId,
          null,
          "Deployed",
          `${dates.start} 08:00:00`,
          "Initial deployment",
          `Assigned to ${company}.`,
          "EMPLOYEE_CREATED",
          roleUsers.hrStaff.id,
        ]);

        historyRows.push([
          employeeId,
          "Deployed",
          "Floating / Standby",
          `${dates.end} 17:00:00`,
          reason,
          "Available for reassignment after previous deployment ended.",
          "DEPLOYMENT_ENDED",
          roleUsers.hrStaff.id,
        ]);
      }

      if (status === "Inactive") {
        const dates =
          inactiveAssignmentDates(seedIndex);

        const company =
          COMPANIES[
            (seedIndex - CURRENT_WORKFORCE - 1) %
              COMPANIES.length
          ];

        const reason =
          inactiveReasonFor(seedIndex);

        assignmentRows.push([
          employeeId,
          company,
          positionFor(seedIndex),
          dates.start,
          dates.end,
          reason,
          "Historical separation record retained.",
          "Cancelled",
          `${dates.end} 17:00:00`,
          roleUsers.hrStaff.id,
          `${dates.start} 08:00:00`,
          `${dates.end} 17:00:00`,
        ]);

        historyRows.push([
          employeeId,
          null,
          "Deployed",
          `${dates.start} 08:00:00`,
          "Initial deployment",
          `Assigned to ${company}.`,
          "EMPLOYEE_CREATED",
          roleUsers.hrStaff.id,
        ]);

        historyRows.push([
          employeeId,
          "Deployed",
          "Inactive",
          `${dates.end} 17:00:00`,
          reason,
          "Historical inactive record retained and archived.",
          "DEPLOYMENT_ENDED",
          roleUsers.hrManager.id,
        ]);
      }
    }

    await insertRows(
      connection,
      "deployment_assignments",
      [
        "employee_id",
        "company",
        "position",
        "start_date",
        "end_date",
        "end_reason",
        "end_remarks",
        "status",
        "ended_at",
        "created_by_user_id",
        "created_at",
        "updated_at",
      ],
      assignmentRows,
      300
    );

    await insertRows(
      connection,
      "employee_status_history",
      [
        "employee_id",
        "from_status",
        "to_status",
        "effective_at",
        "reason",
        "remarks",
        "source_event",
        "changed_by_user_id",
      ],
      historyRows,
      350
    );

    const documentRows = [];

    for (
      let seedIndex = 1;
      seedIndex <= TOTAL_EMPLOYEE_RECORDS;
      seedIndex += 1
    ) {
      const status = currentStatusForSeedIndex(seedIndex);
      const documentCount = documentCountForEmployee(
        seedIndex,
        documentOptions.length
      );

      const employeeId = employeeIdsBySeed.get(seedIndex);

      for (
        let documentIndex = 0;
        documentIndex < documentCount;
        documentIndex += 1
      ) {
        const document = documentOptions[documentIndex];
        const filePath = placeholderPaths.get(document.name);

        documentRows.push([
          employeeId,
          document.name,
          expirationDateFor(
            seedIndex,
            documentIndex,
            document,
            status
          ),
          filePath,
          `${formatDate(
            addDays(
              status === "Deployed"
                ? activeStartDateFor(seedIndex)
                : status === "Floating / Standby"
                  ? lastAssignmentDatesForFloating(seedIndex)
                      .start
                  : inactiveAssignmentDates(seedIndex).start,
              7 + (documentIndex % 5)
            )
          )} 09:00:00`,
          path.basename(filePath),
        ]);
      }
    }

    await insertRows(
      connection,
      "employee_documents",
      [
        "employee_id",
        "name",
        "expiration_date",
        "file_path",
        "created_at",
        "file",
      ],
      documentRows,
      450
    );

    const incidentRows = [];
    const incidentMeta = [];
    const months = incidentMonthList();

    const profiles = [];

    for (let seedIndex = 201; seedIndex <= 204; seedIndex += 1) {
      profiles.push({
        seedIndex,
        profile: "high",
        count: 7,
      });
    }

    for (let seedIndex = 205; seedIndex <= 212; seedIndex += 1) {
      profiles.push({
        seedIndex,
        profile: "repeat",
        count: 3,
      });
    }

    for (let seedIndex = 213; seedIndex <= 222; seedIndex += 1) {
      profiles.push({
        seedIndex,
        profile: "double",
        count: 2,
      });
    }

    for (let seedIndex = 223; seedIndex <= 246; seedIndex += 1) {
      profiles.push({
        seedIndex,
        profile: "single",
        count: 1,
      });
    }

    let globalIncidentIndex = 0;

    for (const profile of profiles) {
      const employeeId =
        employeeIdsBySeed.get(profile.seedIndex);

      const employeeName =
        createEmployeeName(profile.seedIndex);

      const company =
        companyForActiveOrdinal(profile.seedIndex);

      const location =
        COMPANY_LOCATIONS[company] || company;

      for (
        let incidentNumber = 0;
        incidentNumber < profile.count;
        incidentNumber += 1
      ) {
        const [year, month] =
          months[globalIncidentIndex % months.length];

        const incidentDate =
          dateWithinMonth(
            year,
            month,
            globalIncidentIndex + profile.seedIndex
          );

        const severity =
          incidentSeveritySequence(
            profile.profile,
            incidentNumber
          );

        const violation =
          incidentViolationFor(
            severity,
            globalIncidentIndex
          );

        const status =
          incidentStatusFor(
            incidentDate,
            globalIncidentIndex
          );

        const createdAt =
          `${incidentDate} 09:${pad(
            (globalIncidentIndex * 7) % 60
          )}:00`;

        const investigationAt =
          status === "Open"
            ? null
            : formatDateTime(
                addDays(incidentDate, 1)
              );

        const resolutionAt =
          ["For Review", "Closed"].includes(status)
            ? formatDateTime(
                addDays(incidentDate, 3)
              )
            : null;

        const reviewedAt =
          status === "Closed"
            ? formatDateTime(
                addDays(incidentDate, 5)
              )
            : null;

        const actionTaken =
          status === "Closed"
            ? severity === "Minor"
              ? "Written warning issued"
              : severity === "Major"
                ? "Corrective action reviewed and documented"
                : "Management review completed"
            : status === "Investigating"
              ? "Notice to Explain issued"
              : status === "For Review"
                ? "Resolution submitted for management review"
                : null;

        const resolutionNotes =
          status === "Closed"
            ? "Case reviewed and documented based on available records and HR procedure."
            : status === "For Review"
              ? "Awaiting final management review."
              : null;

        incidentRows.push([
          employeeId,
          employeeName,
          company,
          violation,
          severity,
          status,
          incidentDate,
          location,
          `Synthetic defense scenario: ${violation.toLowerCase()} reported at the assigned client site.`,
          "Client Supervisor",
          actionTaken,
          policySanctionFor(severity),
          recommendationFor(severity),
          resolutionNotes,
          createdAt,
          reviewedAt || resolutionAt || investigationAt || createdAt,
          null,
          null,
          hrStaffActor.id,
          hrStaffActor.username,
          hrStaffActor.name,
          status === "Closed"
            ? "CASE_REVIEWED"
            : status === "For Review"
              ? "RESOLUTION_SUBMITTED"
              : status === "Investigating"
                ? "INVESTIGATION_STARTED"
                : "INCIDENT_CREATED",
          reviewedAt || resolutionAt || investigationAt || createdAt,
          status === "Open"
            ? null
            : hrManagerActor.id,
          status === "Open"
            ? null
            : hrManagerActor.username,
          status === "Open"
            ? null
            : hrManagerActor.name,
          investigationAt,
          ["For Review", "Closed"].includes(status)
            ? hrManagerActor.id
            : null,
          ["For Review", "Closed"].includes(status)
            ? hrManagerActor.username
            : null,
          ["For Review", "Closed"].includes(status)
            ? hrManagerActor.name
            : null,
          resolutionAt,
          status === "Closed"
            ? hrManagerActor.id
            : null,
          status === "Closed"
            ? hrManagerActor.username
            : null,
          status === "Closed"
            ? hrManagerActor.name
            : null,
          reviewedAt,
          status === "Closed"
            ? "Accepted"
            : null,
          status === "Closed"
            ? "Final case disposition recorded after HR review."
            : null,
        ]);

        incidentMeta.push({
          status,
          incidentDate,
          employeeName,
          violation,
          globalIncidentIndex,
        });

        globalIncidentIndex += 1;
      }
    }

    const incidentIds = await insertRows(
      connection,
      "incidents",
      [
        "employee_id",
        "employee_name",
        "company",
        "violation_type",
        "severity",
        "status",
        "incident_date",
        "location",
        "description",
        "reported_by",
        "action_taken",
        "policy_sanction",
        "recommendation",
        "resolution_notes",
        "created_at",
        "updated_at",
        "locked_by",
        "locked_at",
        "last_action_by_id",
        "last_action_by_username",
        "last_action_by_name",
        "last_action_type",
        "last_action_at",
        "investigation_started_by_id",
        "investigation_started_by_username",
        "investigation_started_by_name",
        "investigation_started_at",
        "resolution_submitted_by_id",
        "resolution_submitted_by_username",
        "resolution_submitted_by_name",
        "resolution_submitted_at",
        "reviewed_by_id",
        "reviewed_by_username",
        "reviewed_by_name",
        "reviewed_at",
        "review_decision",
        "review_comments",
      ],
      incidentRows,
      120
    );

    const timelineRows = [];

    incidentIds.forEach((incidentId, index) => {
      const meta = incidentMeta[index];

      timelineRows.push([
        incidentId,
        "INCIDENT_CREATED",
        "Incident Reported",
        `${meta.violation} was recorded for ${meta.employeeName}.`,
        hrStaffActor.id,
        hrStaffActor.username,
        hrStaffActor.name,
        hrStaffActor.role,
        `${meta.incidentDate} 09:00:00`,
      ]);

      if (meta.status !== "Open") {
        timelineRows.push([
          incidentId,
          "INVESTIGATION_STARTED",
          "Investigation Started",
          "HR started the case investigation and issued the required notice.",
          hrManagerActor.id,
          hrManagerActor.username,
          hrManagerActor.name,
          hrManagerActor.role,
          formatDateTime(
            addDays(meta.incidentDate, 1)
          ),
        ]);
      }

      if (
        ["For Review", "Closed"].includes(meta.status)
      ) {
        timelineRows.push([
          incidentId,
          "RESOLUTION_SUBMITTED",
          "Resolution Submitted",
          "Case findings and recommended action were submitted for review.",
          hrManagerActor.id,
          hrManagerActor.username,
          hrManagerActor.name,
          hrManagerActor.role,
          formatDateTime(
            addDays(meta.incidentDate, 3)
          ),
        ]);
      }

      if (meta.status === "Closed") {
        timelineRows.push([
          incidentId,
          "CASE_REVIEWED",
          "Case Closed",
          "Management review was completed and the case was closed.",
          hrManagerActor.id,
          hrManagerActor.username,
          hrManagerActor.name,
          hrManagerActor.role,
          formatDateTime(
            addDays(meta.incidentDate, 5)
          ),
        ]);
      }
    });

    await insertRows(
      connection,
      "incident_timeline",
      [
        "incident_id",
        "action_type",
        "title",
        "description",
        "created_by_id",
        "created_by_username",
        "created_by_name",
        "created_by_role",
        "created_at",
      ],
      timelineRows,
      300
    );

    await connection.commit();
    transactionStarted = false;

    const manifest = buildManifest({
      documentOptions,
      documentsInserted: documentRows.length,
      assignmentsInserted: assignmentRows.length,
      historyInserted: historyRows.length,
      incidentsInserted: incidentRows.length,
      timelineInserted: timelineRows.length,
      employeeIdsBySeed,
    });

    const manifestPath = path.resolve(
      __dirname,
      "defense-seed-manifest.json"
    );

    fs.writeFileSync(
      manifestPath,
      JSON.stringify(manifest, null, 2),
      "utf8"
    );

    console.log("\nDefense seed completed.");
    console.table({
      "Current workforce": CURRENT_WORKFORCE,
      "Current deployed": CURRENT_DEPLOYED,
      "Current floating": CURRENT_FLOATING,
      "Historical inactive": HISTORICAL_INACTIVE,
      "Total employee records": TOTAL_EMPLOYEE_RECORDS,
      "Deployment assignments": assignmentRows.length,
      "Status history rows": historyRows.length,
      "Compliance document rows": documentRows.length,
      "Incidents": incidentRows.length,
      "Incident timeline rows": timelineRows.length,
    });

    console.log(
      `\nManifest: ${manifestPath}`
    );

    console.log(
      "\nShowcase employee IDs:"
    );

    console.table(manifest.showcase);
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch (rollbackError) {
        console.error(
          "Rollback failed:",
          rollbackError.message
        );
      }
    }

    console.error(
      "\nDefense seed failed:",
      error.message
    );

    process.exitCode = 1;
  } finally {
    connection.release();

    try {
      await db.promise().end();
    } catch {
      // Connection pool may already be closed.
    }
  }
}

main();