const db = require("../config/db");

const {
  getTrustedSuggestionIdentity,
  getSuggestionStates,
  applySuggestionStates,
} = require("../utils/smartSuggestionState");

const PRIORITY = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

const CATEGORY = {
  WORKFORCE: "Workforce",
  INCIDENT: "Incident Prevention",
  COMPLIANCE: "Compliance",
  DEPLOYMENT: "Deployment",
};

const ALLOWED_ROLES = [
  "HR_MANAGER",
  "SUPER_ADMIN",
];

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeLabel(
  value,
  fallback = "-"
) {
  const text =
    String(value || "").trim();

  return text || fallback;
}

function normalizeCompany(value) {
  const company =
    normalizeLabel(
      value,
      "Unassigned"
    );

  return (
    company === "null" ||
    company === "undefined"
  )
    ? "Unassigned"
    : company;
}

function normalizeStatus(status) {
  const value =
    normalizeText(status);

  if (
    value === "resolved"
  ) {
    return "For Review";
  }

  if (
    value === "for_review"
  ) {
    return "For Review";
  }

  if (
    value === "for review"
  ) {
    return "For Review";
  }

  if (
    value === "closed"
  ) {
    return "Closed";
  }

  if (
    value === "investigating"
  ) {
    return "Investigating";
  }

  if (
    value === "open"
  ) {
    return "Open";
  }

  return status || "Open";
}

function normalizeSeverity(
  severity
) {
  const value =
    normalizeText(
      severity
    );

  if (
    value === "critical"
  ) {
    return "Critical";
  }

  if (
    value === "major"
  ) {
    return "Major";
  }

  if (
    value === "minor"
  ) {
    return "Minor";
  }

  return severity || "Minor";
}

/*
 * SECURITY:
 * The caller's role comes exclusively from
 * the verified JWT identity placed on req.user
 * by verifyToken.
 *
 * Query/body role values are intentionally ignored.
 */
function getRole(req) {
  return String(
    req?.user?.role ||
      "USER"
  )
    .trim()
    .toUpperCase()
    .replace(
      /[\s-]+/g,
      "_"
    );
}

function cleanKey(value) {
  return String(value || "")
    .replace(
      /[^a-zA-Z0-9:_-]/g,
      "_"
    )
    .slice(0, 180);
}

function toTimestamp(value) {
  const time =
    new Date(
      value
    ).getTime();

  return Number.isNaN(time)
    ? 0
    : time;
}

function getPriorityRank(
  priority
) {
  switch (priority) {
    case PRIORITY.HIGH:
      return 3;

    case PRIORITY.MEDIUM:
      return 2;

    case PRIORITY.LOW:
    default:
      return 1;
  }
}

function isArchivedEmployee(
  employee
) {
  return (
    employee?.archived ===
      true ||
    Number(
      employee?.archived
    ) === 1
  );
}

function isActiveIncident(
  incident
) {
  const status =
    normalizeStatus(
      incident.status
    );

  return [
    "Open",
    "Investigating",
    "For Review",
  ].includes(
    status
  );
}

function isAbsenceRelated(
  violation
) {
  const text =
    normalizeText(
      violation
    );

  return [
    "absent",
    "absence",
    "absenteeism",
    "no call",
    "no show",
    "tardiness",
    "late",
    "undertime",
  ].some(
    (keyword) =>
      text.includes(
        keyword
      )
  );
}

function isComplianceDocumentExpiring(
  expirationDate
) {
  if (
    !expirationDate
  ) {
    return false;
  }

  const expiry =
    new Date(
      expirationDate
    );

  if (
    Number.isNaN(
      expiry.getTime()
    )
  ) {
    return false;
  }

  const today =
    new Date();

  const diffDays =
    Math.ceil(
      (
        expiry.getTime() -
        today.getTime()
      ) /
        86400000
    );

  return (
    diffDays >= 0 &&
    diffDays <= 30
  );
}

function isComplianceDocumentExpired(
  expirationDate
) {
  if (
    !expirationDate
  ) {
    return false;
  }

  const expiry =
    new Date(
      expirationDate
    );

  if (
    Number.isNaN(
      expiry.getTime()
    )
  ) {
    return false;
  }

  const today =
    new Date();

  return (
    expiry.getTime() <
    today.getTime()
  );
}

async function tableExists(
  tableName
) {
  const [rows] =
    await db
      .promise()
      .query(
        "SHOW TABLES LIKE ?",
        [
          tableName,
        ]
      );

  return (
    rows.length > 0
  );
}

function normalizeEmployee(
  employee
) {
  return {
    ...employee,

    id:
      employee.id ||
      employee.employee_id ||
      employee.employeeId,

    name:
      employee.name ||
      employee.full_name ||
      employee.fullName ||
      "Unknown Employee",

    company:
      normalizeCompany(
        employee.company ||
        employee.clientCompany
      ),

    status:
      employee.status ||
      "Unknown",

    archived:
      isArchivedEmployee(
        employee
      ),
  };
}

function normalizeIncident(
  incident
) {
  const employeeName =
    incident.employee_name ||
    incident.employeeNameFromEmployee ||
    incident.employee ||
    incident.employeeName ||
    "Unknown Employee";

  const violation =
    incident.violation_type ||
    incident.violation ||
    incident.violationType ||
    "No violation specified";

  const date =
    incident.updated_at ||
    incident.created_at ||
    incident.incident_date ||
    incident.date ||
    new Date().toISOString();

  return {
    ...incident,

    id:
      incident.id,

    employeeId:
      incident.employee_id ||
      incident.employeeId,

    employeeName,

    company:
      normalizeCompany(
        incident.company ||
        incident.employeeCompany
      ),

    violation,

    severity:
      normalizeSeverity(
        incident.severity
      ),

    status:
      normalizeStatus(
        incident.status
      ),

    date,

    timestamp:
      toTimestamp(
        date
      ),
  };
}

async function fetchEmployees() {
  const [rows] =
    await db
      .promise()
      .query(
        "SELECT * FROM employees"
      );

  return rows
    .map(
      normalizeEmployee
    )
    .filter(
      (employee) =>
        !employee.archived
    );
}

async function fetchIncidents() {
  const [rows] =
    await db
      .promise()
      .query(`
        SELECT
          i.*,
          e.name AS employeeNameFromEmployee,
          e.company AS employeeCompany
        FROM incidents i
        LEFT JOIN employees e
          ON e.id = i.employee_id
      `);

  return rows
    .map(
      normalizeIncident
    )
    .filter(
      isActiveIncident
    );
}

async function fetchEmployeeDocuments() {
  const exists =
    await tableExists(
      "employee_documents"
    );

  if (
    !exists
  ) {
    return [];
  }

  const [rows] =
    await db
      .promise()
      .query(`
        SELECT
          d.*,
          e.name AS employeeName,
          e.company AS employeeCompany
        FROM employee_documents d
        LEFT JOIN employees e
          ON e.id = d.employee_id
      `);

  return rows.map(
    (document) => ({
      ...document,

      employeeId:
        document.employee_id,

      employeeName:
        document.employeeName ||
        "Unknown Employee",

      company:
        normalizeCompany(
          document.employeeCompany
        ),

      name:
        document.name ||
        document.document_name ||
        "Document",

      filePath:
        document.file_path ||
        document.file ||
        null,

      expirationDate:
        document.expiration_date ||
        document.expirationDate ||
        document.expires_at ||
        null,
    })
  );
}

function groupBy(
  items,
  getKey
) {
  return items.reduce(
    (
      map,
      item
    ) => {
      const key =
        getKey(
          item
        );

      if (
        !map.has(
          key
        )
      ) {
        map.set(
          key,
          []
        );
      }

      map
        .get(key)
        .push(item);

      return map;
    },
    new Map()
  );
}

function latestTimestamp(
  items
) {
  return Math.max(
    ...items.map(
      (item) =>
        Number(
          item.timestamp ||
            0
        )
    ),
    0
  );
}

function createSuggestion({
  category,
  priority,
  title,
  company,
  issue,
  recommendation,
  reason,
  metrics = [],
  sourceType,
  timestamp,
}) {
  const finalCompany =
    normalizeCompany(
      company
    );

  const finalTimestamp =
    Number(
      timestamp ||
        Date.now()
    );

  return {
    suggestionKey:
      cleanKey(
        `${sourceType}:${finalCompany}:${title}:${metrics
          .map(
            (metric) =>
              `${metric.label}-${metric.value}`
          )
          .join(":")}`
      ),

    category,

    priority,

    priorityRank:
      getPriorityRank(
        priority
      ),

    title,

    company:
      finalCompany,

    issue,

    recommendation,

    reason,

    metrics,

    sourceType,

    timestamp:
      finalTimestamp,

    generatedAt:
      new Date(
        finalTimestamp
      ).toISOString(),
  };
}

function buildAbsenteeismSuggestions(
  incidents
) {
  const absenceIncidents =
    incidents.filter(
      (incident) =>
        isAbsenceRelated(
          incident.violation
        )
    );

  const byCompany =
    groupBy(
      absenceIncidents,
      (incident) =>
        incident.company
    );

  const suggestions = [];

  for (
    const [
      company,
      companyIncidents,
    ] of byCompany.entries()
  ) {
    if (
      company ===
      "Unassigned"
    ) {
      continue;
    }

    if (
      companyIncidents.length <
      3
    ) {
      continue;
    }

    const criticalCount =
      companyIncidents.filter(
        (incident) =>
          incident.severity ===
          "Critical"
      ).length;

    const priority =
      companyIncidents.length >=
        8 ||
      criticalCount > 0
        ? PRIORITY.HIGH
        : PRIORITY.MEDIUM;

    suggestions.push(
      createSuggestion({
        category:
          CATEGORY.WORKFORCE,

        priority,

        title:
          "Absenteeism Pattern Detected",

        company,

        issue:
          `${companyIncidents.length} active absence or attendance-related record(s) detected.`,

        recommendation:
          "Review attendance pattern and consider reserve or floating manpower if deployment continuity is affected.",

        reason:
          "Repeated attendance-related records were detected from the same client company.",

        metrics: [
          {
            label:
              "Attendance Cases",

            value:
              companyIncidents.length,
          },
          {
            label:
              "Critical",

            value:
              criticalCount,
          },
        ],

        sourceType:
          "ABSENTEEISM_PATTERN",

        timestamp:
          latestTimestamp(
            companyIncidents
          ),
      })
    );
  }

  return suggestions;
}

function buildRepeatedViolationSuggestions(
  incidents
) {
  const byCompanyViolation =
    groupBy(
      incidents,
      (incident) => {
        const violation =
          normalizeText(
            incident.violation
          ).slice(
            0,
            80
          );

        return `${incident.company}__${violation}`;
      }
    );

  const suggestions = [];

  for (
    const [
      key,
      violationIncidents,
    ] of byCompanyViolation.entries()
  ) {
    if (
      violationIncidents.length <
      5
    ) {
      continue;
    }

    const [company] =
      key.split(
        "__"
      );

    if (
      company ===
      "Unassigned"
    ) {
      continue;
    }

    const sample =
      violationIncidents[0];

    const criticalCount =
      violationIncidents.filter(
        (incident) =>
          incident.severity ===
          "Critical"
      ).length;

    suggestions.push(
      createSuggestion({
        category:
          CATEGORY.INCIDENT,

        priority:
          criticalCount > 0 ||
          violationIncidents.length >=
            10
            ? PRIORITY.HIGH
            : PRIORITY.MEDIUM,

        title:
          "Repeated Violation Pattern",

        company,

        issue:
          `${violationIncidents.length} similar violation record(s) detected: ${sample.violation}`,

        recommendation:
          "Review the recurring violation pattern and consider policy re-orientation or closer monitoring.",

        reason:
          "Similar active violation records were detected within the same client company.",

        metrics: [
          {
            label:
              "Similar Cases",

            value:
              violationIncidents.length,
          },
          {
            label:
              "Critical",

            value:
              criticalCount,
          },
        ],

        sourceType:
          "REPEATED_VIOLATION",

        timestamp:
          latestTimestamp(
            violationIncidents
          ),
      })
    );
  }

  return suggestions;
}

function buildCompanyIncidentLoadSuggestions(
  incidents
) {
  const byCompany =
    groupBy(
      incidents,
      (incident) =>
        incident.company
    );

  const suggestions = [];

  for (
    const [
      company,
      companyIncidents,
    ] of byCompany.entries()
  ) {
    if (
      company ===
      "Unassigned"
    ) {
      continue;
    }

    if (
      companyIncidents.length <
      10
    ) {
      continue;
    }

    const criticalCount =
      companyIncidents.filter(
        (incident) =>
          incident.severity ===
          "Critical"
      ).length;

    const majorCount =
      companyIncidents.filter(
        (incident) =>
          incident.severity ===
          "Major"
      ).length;

    suggestions.push(
      createSuggestion({
        category:
          CATEGORY.INCIDENT,

        priority:
          criticalCount >= 2 ||
          companyIncidents.length >=
            15
            ? PRIORITY.HIGH
            : PRIORITY.MEDIUM,

        title:
          "High Incident Concentration",

        company,

        issue:
          `${companyIncidents.length} active incident record(s) detected for this company.`,

        recommendation:
          "Review company-level work conditions and coordinate with the site supervisor for preventive monitoring.",

        reason:
          "A high concentration of active incident records was detected in one client company.",

        metrics: [
          {
            label:
              "Active Cases",

            value:
              companyIncidents.length,
          },
          {
            label:
              "Major",

            value:
              majorCount,
          },
          {
            label:
              "Critical",

            value:
              criticalCount,
          },
        ],

        sourceType:
          "COMPANY_INCIDENT_LOAD",

        timestamp:
          latestTimestamp(
            companyIncidents
          ),
      })
    );
  }

  return suggestions;
}

function buildComplianceSuggestions(
  documents
) {
  if (
    !documents.length
  ) {
    return [];
  }

  const flaggedDocuments =
    documents.filter(
      (document) => {
        const missingFile =
          !document.filePath;

        const expired =
          isComplianceDocumentExpired(
            document.expirationDate
          );

        const expiring =
          isComplianceDocumentExpiring(
            document.expirationDate
          );

        return (
          missingFile ||
          expired ||
          expiring
        );
      }
    );

  const byCompany =
    groupBy(
      flaggedDocuments,
      (document) =>
        document.company
    );

  const suggestions = [];

  for (
    const [
      company,
      docs,
    ] of byCompany.entries()
  ) {
    if (
      company ===
      "Unassigned"
    ) {
      continue;
    }

    if (
      docs.length <
      5
    ) {
      continue;
    }

    const missing =
      docs.filter(
        (document) =>
          !document.filePath
      ).length;

    const expired =
      docs.filter(
        (document) =>
          isComplianceDocumentExpired(
            document.expirationDate
          )
      ).length;

    const expiring =
      docs.filter(
        (document) =>
          isComplianceDocumentExpiring(
            document.expirationDate
          )
      ).length;

    suggestions.push(
      createSuggestion({
        category:
          CATEGORY.COMPLIANCE,

        priority:
          expired > 0 ||
          docs.length >= 10
            ? PRIORITY.MEDIUM
            : PRIORITY.LOW,

        title:
          "Compliance Follow-up Needed",

        company,

        issue:
          `${docs.length} compliance document concern(s) detected.`,

        recommendation:
          "Follow up missing, expired, or soon-to-expire documents to maintain employee work eligibility.",

        reason:
          "Compliance records were flagged based on document availability and expiration dates.",

        metrics: [
          {
            label:
              "Document Issues",

            value:
              docs.length,
          },
          {
            label:
              "Missing",

            value:
              missing,
          },
          {
            label:
              "Expired",

            value:
              expired,
          },
          {
            label:
              "Expiring",

            value:
              expiring,
          },
        ],

        sourceType:
          "COMPLIANCE_REVIEW",

        timestamp:
          Date.now(),
      })
    );
  }

  return suggestions;
}

function buildDeploymentPoolSuggestions(
  employees,
  incidents
) {
  const floatingEmployees =
    employees.filter(
      (employee) => {
        const status =
          normalizeText(
            employee.status
          );

        return (
          status.includes(
            "floating"
          ) ||
          status.includes(
            "standby"
          ) ||
          status.includes(
            "available"
          ) ||
          status.includes(
            "unassigned"
          )
        );
      }
    );

  if (
    floatingEmployees.length <
    10
  ) {
    return [];
  }

  const absenceCount =
    incidents.filter(
      (incident) =>
        isAbsenceRelated(
          incident.violation
        )
    ).length;

  if (
    absenceCount <
    5
  ) {
    return [];
  }

  return [
    createSuggestion({
      category:
        CATEGORY.DEPLOYMENT,

      priority:
        PRIORITY.MEDIUM,

      title:
        "Reserve Workforce Allocation Suggested",

      company:
        "Workforce Pool",

      issue:
        `${floatingEmployees.length} floating or available employee(s) and ${absenceCount} attendance-related incident(s) detected.`,

      recommendation:
        "Review the available workforce pool and consider reliever assignment before requesting new hiring.",

      reason:
        "Available workers were detected while attendance-related cases may affect deployment continuity.",

      metrics: [
        {
          label:
            "Available Pool",

          value:
            floatingEmployees.length,
        },
        {
          label:
            "Attendance Cases",

          value:
            absenceCount,
        },
      ],

      sourceType:
        "DEPLOYMENT_POOL",

      timestamp:
        Date.now(),
    }),
  ];
}

function buildSmartSuggestions({
  employees,
  incidents,
  documents,
}) {
  const suggestions = [
    ...buildAbsenteeismSuggestions(
      incidents
    ),

    ...buildRepeatedViolationSuggestions(
      incidents
    ),

    ...buildCompanyIncidentLoadSuggestions(
      incidents
    ),

    ...buildComplianceSuggestions(
      documents
    ),

    ...buildDeploymentPoolSuggestions(
      employees,
      incidents
    ),
  ];

  const unique =
    new Map();

  suggestions.forEach(
    (suggestion) => {
      const dedupeKey =
        `${suggestion.sourceType}:${suggestion.company}:${suggestion.title}`;

      const existing =
        unique.get(
          dedupeKey
        );

      if (
        !existing ||
        suggestion.priorityRank >
          existing.priorityRank
      ) {
        unique.set(
          dedupeKey,
          suggestion
        );
      }
    }
  );

  return Array.from(
    unique.values()
  ).sort(
    (a, b) => {
      if (
        b.priorityRank !==
        a.priorityRank
      ) {
        return (
          b.priorityRank -
          a.priorityRank
        );
      }

      return (
        b.timestamp -
        a.timestamp
      );
    }
  );
}

function buildSummary(
  suggestions
) {
  return {
    total:
      suggestions.length,

    active:
      suggestions.length,

    high:
      suggestions.filter(
        (suggestion) =>
          suggestion.priority ===
          PRIORITY.HIGH
      ).length,

    medium:
      suggestions.filter(
        (suggestion) =>
          suggestion.priority ===
          PRIORITY.MEDIUM
      ).length,

    low:
      suggestions.filter(
        (suggestion) =>
          suggestion.priority ===
          PRIORITY.LOW
      ).length,

    workforce:
      suggestions.filter(
        (suggestion) =>
          suggestion.category ===
          CATEGORY.WORKFORCE
      ).length,

    incident:
      suggestions.filter(
        (suggestion) =>
          suggestion.category ===
          CATEGORY.INCIDENT
      ).length,

    compliance:
      suggestions.filter(
        (suggestion) =>
          suggestion.category ===
          CATEGORY.COMPLIANCE
      ).length,

    deployment:
      suggestions.filter(
        (suggestion) =>
          suggestion.category ===
          CATEGORY.DEPLOYMENT
      ).length,
  };
}

exports.getSmartSuggestions =
  async (
    req,
    res
  ) => {
    try {
      const role =
        getRole(req);

      if (
        !ALLOWED_ROLES.includes(
          role
        )
      ) {
        return res
          .status(403)
          .json({
            success: false,

            error:
              "You do not have permission to access smart suggestions.",
          });
      }

      /*
       * SECURITY:
       * Persisted suggestion ownership comes only
       * from the verified JWT identity in req.user.
       *
       * Query/body userKey and role values are
       * intentionally ignored.
       */
      const {
        userKey,
        role: trustedRole,
      } =
        getTrustedSuggestionIdentity(
          req
        );

      if (!userKey) {
        return res
          .status(401)
          .json({
            success: false,

            error:
              "Authenticated user identity is required.",
          });
      }

      /*
       * Existing DSS source reads remain unchanged.
       *
       * Suggestion state is an independent per-user
       * read and can safely run in the same parallel
       * group without changing rule generation.
       */
      const [
        employees,
        incidents,
        documents,
        stateMap,
      ] =
        await Promise.all([
          fetchEmployees(),
          fetchIncidents(),
          fetchEmployeeDocuments(),

          getSuggestionStates({
            userKey,
            role:
              trustedRole,
          }),
        ]);

      /*
       * DO NOT CHANGE:
       * Existing deterministic rule-based DSS logic.
       */
      const generatedSuggestions =
        buildSmartSuggestions({
          employees,
          incidents,
          documents,
        });

      /*
       * Merge only user-specific persisted state.
       *
       * This does not change:
       * - suggestion generation
       * - priority
       * - metrics
       * - recommendation
       * - thresholds
       */
      const suggestions =
        applySuggestionStates(
          generatedSuggestions,
          stateMap
        );

      return res.json({
        suggestions,

        latestSuggestions:
          suggestions.slice(
            0,
            5
          ),

        /*
         * Preserve the existing DSS summary
         * calculation exactly.
         */
        summary:
          buildSummary(
            suggestions
          ),
      });
    } catch (error) {
      console.error(
        "GET SMART SUGGESTIONS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          error:
            "Failed to fetch smart suggestions.",
        });
    }
  };