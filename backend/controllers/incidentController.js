const db = require("../config/db");

const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

const {
  cleanupUnreferencedFileCandidates,
} = require("../utils/fileReferenceService");

const {
  evaluateIndependentIncidentReview,
} = require("../utils/incidentReviewPolicy");

const {
  evaluateProofSubmission,
  evaluateStartInvestigation,
  getCreateIncidentActorSelect,
  getIncidentCreator,
  getReportingPath,
} = require("../utils/incidentInvestigationPolicy");

const {
  ViolationPolicyError,
  getViolationRulesConfiguration,
  resolveViolationRule,
  getHighestSeverity,
  computeIncidentClassification,
} = require("../utils/violationPolicyService");

const WORKFLOW_ACTION = {
  START: "START_INVESTIGATION",
  SUBMIT_RESOLUTION:
    "SUBMIT_RESOLUTION",
  SUBMIT_INVESTIGATION:
    "SUBMIT_INVESTIGATION",
  RETURN: "RETURN_INCIDENT",
  CLOSE: "CLOSE_INCIDENT",
};

const INVESTIGATOR_ROLES =
  new Set([
    "HR_MANAGER",
    "HR_COORDINATOR",
  ]);

const EVIDENCE_PURPOSE = Object.freeze({
  INITIAL_NTE: "INITIAL_NTE",
  RESOLUTION_PROOF: "RESOLUTION_PROOF",
});

const REVIEWER_ROLES =
  new Set([
    "HR_MANAGER",
    "SUPER_ADMIN",
  ]);

function normalizeIncidentEvidencePath(
  value
) {
  const normalized =
    String(value || "")
      .trim()
      .replace(/\\/g, "/");

  if (!normalized) {
    return "";
  }

  if (
    /^https?:\/\//i.test(
      normalized
    )
  ) {
    return normalized;
  }

  const marker =
    "/documents/";

  const markerIndex =
    normalized
      .toLowerCase()
      .indexOf(marker);

  if (markerIndex >= 0) {
    return normalized.slice(
      markerIndex
    );
  }

  const lower =
    normalized.toLowerCase();

  if (
    lower.startsWith(
      "documents/"
    )
  ) {
    return `/${normalized}`;
  }

  if (
    lower.startsWith(
      "backend/documents/"
    )
  ) {
    return `/${normalized.slice(
      "backend/".length
    )}`;
  }

  return normalized.startsWith("/")
    ? normalized
    : `/${normalized}`;
}

function toNullable(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const trimmed =
    String(value).trim();

  return trimmed === ""
    ? null
    : trimmed;
}

function normalizeDate(value) {
  if (!value) {
    return null;
  }

  const dateString =
    String(value).trim();

  if (!dateString) {
    return null;
  }

  const date =
    new Date(dateString);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return dateString.slice(
    0,
    10
  );
}

function normalizeEpochMilliseconds(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return 0;
  }

  const numericValue =
    Number(
      value
    );

  if (
    Number.isFinite(
      numericValue
    ) &&
    numericValue > 0
  ) {
    return numericValue <
      100000000000
      ? numericValue *
          1000
      : numericValue;
  }

  return 0;
}

function timestampToIsoString(
  value
) {
  const timestamp =
    normalizeEpochMilliseconds(
      value
    );

  if (!timestamp) {
    return null;
  }

  return new Date(
    timestamp
  ).toISOString();
}

function getDatabaseEventDateTime(
  timestampValue,
  rawValue = null
) {
  /*
   * Prefer a numeric epoch calculated by MySQL itself.
   *
   * This bypasses mysql2/Node Date timezone conversion,
   * which can shift a database workflow timestamp by
   * eight hours when the DB/session and Node process use
   * different timezone assumptions.
   */
  return (
    timestampToIsoString(
      timestampValue
    ) ||
    rawValue ||
    null
  );
}

function normalizeStatus(value) {
  const status =
    String(value || "")
      .trim();

  const normalized =
    status.toLowerCase();

  if (!status) {
    return "Open";
  }

  if (
    normalized ===
      "for_review" ||
    normalized ===
      "for review"
  ) {
    return "For Review";
  }

  if (
    normalized ===
      "resolved" ||
    normalized ===
      "closed"
  ) {
    return "Closed";
  }

  if (
    normalized ===
    "investigating"
  ) {
    return "Investigating";
  }

  if (
    normalized ===
    "open"
  ) {
    return "Open";
  }

  return status;
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeRole(value) {
  const role =
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  if (
    [
      "SUPERADMIN",
      "SUPER_ADMIN",
    ].includes(role)
  ) {
    return "SUPER_ADMIN";
  }

  if (
    [
      "HRMANAGER",
      "HR_MANAGER",
    ].includes(role)
  ) {
    return "HR_MANAGER";
  }

  if (
    [
      "HRSTAFF",
      "HR_STAFF",
    ].includes(role)
  ) {
    return "HR_STAFF";
  }

  if (
    [
      "HRCOORDINATOR",
      "HR_COORDINATOR",
    ].includes(role)
  ) {
    return "HR_COORDINATOR";
  }

  if (
    [
      "ITSUPPORT",
      "IT_SUPPORT",
    ].includes(role)
  ) {
    return "IT_SUPPORT";
  }

  return role || "USER";
}

function normalizeAssignedCompany(
  value
) {
  const normalized =
    String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");

  return normalized || null;
}

function isHrCoordinatorRequest(
  req
) {
  return (
    normalizeRole(
      req?.user?.role
    ) ===
    "HR_COORDINATOR"
  );
}

function isHrStaffRequest(
  req
) {
  return (
    normalizeRole(
      req?.user?.role
    ) ===
    "HR_STAFF"
  );
}

function getHrCoordinatorAssignedCompany(
  req
) {
  return normalizeAssignedCompany(
    req?.user?.assignedCompany ??
      req?.user?.assigned_company
  );
}

function companyNamesMatch(
  left,
  right
) {
  const normalizedLeft =
    normalizeAssignedCompany(
      left
    );

  const normalizedRight =
    normalizeAssignedCompany(
      right
    );

  if (
    !normalizedLeft ||
    !normalizedRight
  ) {
    return false;
  }

  return (
    normalizedLeft.toLowerCase() ===
    normalizedRight.toLowerCase()
  );
}

function buildIncidentCompanyScopeCondition(
  incidentAlias = "i"
) {
  return `
    LOWER(
      TRIM(
        COALESCE(
          ${incidentAlias}.company,
          ''
        )
      )
    ) =
    LOWER(
      TRIM(?)
    )
  `;
}

/*
 * The coordinator's incident list may retain past-company
 * incident headers, but detailed history is available only
 * while the employee has one current Active deployment at
 * the coordinator's assigned company.
 *
 * This is used only in the HR Coordinator branch; other roles
 * retain their established historical access.
 */
function buildCurrentCoordinatorEmployeeScopeCondition(
  employeeAlias = "e"
) {
  return `
    ${employeeAlias}.id IS NOT NULL
    AND COALESCE(${employeeAlias}.archived, 0) = 0
    AND LOWER(TRIM(COALESCE(${employeeAlias}.status, ''))) = 'deployed'
    AND EXISTS (
      SELECT 1
      FROM deployment_assignments AS da_current
      WHERE da_current.employee_id = ${employeeAlias}.id
        AND da_current.status = 'Active'
        AND LOWER(TRIM(COALESCE(da_current.company, ''))) = LOWER(TRIM(?))
        AND NOT EXISTS (
          SELECT 1
          FROM deployment_assignments AS da_conflict
          WHERE da_conflict.employee_id = ${employeeAlias}.id
            AND da_conflict.status = 'Active'
            AND da_conflict.id <> da_current.id
        )
    )
  `;
}

function isInvestigatorRole(
  role
) {
  return INVESTIGATOR_ROLES.has(
    normalizeRole(role)
  );
}

function isReviewerRole(role) {
  return REVIEWER_ROLES.has(
    normalizeRole(role)
  );
}

function normalizeWorkflowAction(
  value
) {
  const action =
    String(value || "")
      .trim()
      .toUpperCase();

  return Object.values(
    WORKFLOW_ACTION
  ).includes(action)
    ? action
    : null;
}

function getWorkflowTargetStatus(
  actionType
) {
  switch (actionType) {
    case WORKFLOW_ACTION.START:
    case WORKFLOW_ACTION.RETURN:
      return "Investigating";

    case WORKFLOW_ACTION
      .SUBMIT_RESOLUTION:

    case WORKFLOW_ACTION
      .SUBMIT_INVESTIGATION:
      return "For Review";

    case WORKFLOW_ACTION.CLOSE:
      return "Closed";

    default:
      return null;
  }
}

function isDeployedEmployee(
  employee
) {
  return (
    normalizeText(
      employee?.status
    ) === "deployed"
  );
}

function buildEvidenceFromReq(
  req
) {
  if (
    !Array.isArray(
      req.files
    )
  ) {
    return [];
  }

  return req.files.map(
    (file) => ({
      fileName:
        file.originalname,

      filePath:
        normalizeIncidentEvidencePath(
          file.path
        ),
    })
  );
}

function claimIncidentEvidenceFiles(
  req
) {
  if (
    typeof req
      ?.claimIncidentEvidenceFiles ===
    "function"
  ) {
    req
      .claimIncidentEvidenceFiles();
  }
}

async function cleanupHistoricalFileCandidates(
  candidates,
  source
) {
  try {
    await cleanupUnreferencedFileCandidates(
      candidates,
      {
        source,
      }
    );
  } catch (error) {
    console.error(
      "INCIDENT HISTORICAL FILE CLEANUP ERROR:",
      {
        source,

        message:
          error?.message ||
          error,
      }
    );
  }
}

function normalizeEmployeeLookupId(
  value
) {
  const raw =
    String(value || "")
      .trim();

  if (!raw) {
    return "";
  }

  if (
    /^EMP[-\s]?\d+$/i.test(
      raw
    )
  ) {
    return (
      raw
        .replace(
          /^EMP[-\s]?/i,
          ""
        )
        .replace(
          /^0+/,
          ""
        ) ||
      raw
    );
  }

  return (
    raw.replace(
      /^0+/,
      ""
    ) ||
    raw
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

  return rows.length > 0;
}

async function getActiveDeploymentForEmployee(
  employeeId,
  {
    connection = null,
    lockForUpdate = false,
  } = {}
) {
  const normalizedEmployeeId =
    String(
      employeeId || ""
    ).trim();

  if (!normalizedEmployeeId) {
    return {
      assignment: null,
      hasConflict: false,
    };
  }

  const queryTarget =
    connection ||
    db.promise();

  const lockClause =
    lockForUpdate
      ? "FOR UPDATE"
      : "";

  const [rows] =
    await queryTarget.query(
      `
      SELECT
        id,
        employee_id,
        company,
        position,
        start_date,
        end_date,
        end_reason,
        end_remarks,
        status,
        ended_at,
        created_at,
        updated_at
      FROM deployment_assignments
      WHERE employee_id = ?
        AND status = 'Active'
      ORDER BY
        start_date DESC,
        id DESC
      LIMIT 2
      ${lockClause}
      `,
      [
        normalizedEmployeeId,
      ]
    );

  return {
    assignment:
      rows[0] || null,

    hasConflict:
      rows.length > 1,
  };
}

exports.getIncidentFormMeta =
  async (
    req,
    res
  ) => {
    try {
      const isHrCoordinator =
        isHrCoordinatorRequest(
          req
        );

      const coordinatorCompany =
        isHrCoordinator
          ? getHrCoordinatorAssignedCompany(
              req
            )
          : null;

      if (
        isHrCoordinator &&
        !coordinatorCompany
      ) {
        return res
          .status(403)
          .json({
            error:
              "HR Coordinator company assignment is required.",
          });
      }

      const employeeSearch =
        String(
          req.query
            ?.employeeSearch ||
          req.query?.search ||
          ""
        )
          .trim()
          .slice(
            0,
            100
          );

      if (!employeeSearch) {
        return res.json({
          employees: [],
        });
      }

      const normalizedEmployeeId =
        normalizeEmployeeLookupId(
          employeeSearch
        );

      const textSearch =
        `%${employeeSearch.toLowerCase()}%`;

      const idSearch =
        `%${normalizedEmployeeId}%`;

      const coordinatorScopeSql =
        isHrCoordinator
          ? `
              AND LOWER(
                TRIM(
                  COALESCE(
                    da.company,
                    ''
                  )
                )
              ) = LOWER(TRIM(?))
            `
          : "";

      const queryParams = [
        textSearch,
        idSearch,
        textSearch,
        ...(isHrCoordinator
          ? [
              coordinatorCompany,
            ]
          : []),
      ];

      const [rows] =
        await db
          .promise()
          .query(
            `
            SELECT
              e.id,
              e.name,
              e.status,
              da.id AS deployment_id,
              da.company,
              da.position,
              da.start_date
            FROM employees e
            INNER JOIN deployment_assignments da
              ON da.employee_id = e.id
              AND da.status = 'Active'
            WHERE
              e.archived = 0
              AND LOWER(
                TRIM(
                  e.status
                )
              ) = 'deployed'
              AND (
                LOWER(
                  e.name
                ) LIKE ?
                OR CAST(
                  e.id AS CHAR
                ) LIKE ?
                OR LOWER(
                  COALESCE(
                    da.company,
                    ''
                  )
                ) LIKE ?
              )
              ${coordinatorScopeSql}
              AND NOT EXISTS (
                SELECT 1
                FROM deployment_assignments conflicting
                WHERE
                  conflicting.employee_id = e.id
                  AND conflicting.status = 'Active'
                  AND conflicting.id <> da.id
              )
            ORDER BY
              e.name ASC,
              e.id ASC
            LIMIT 8
            `,
            queryParams
          );

      return res.json({
        employees:
          rows.map(
            (row) => ({
              id:
                row.id,

              employeeId:
                row.id,

              name:
                row.name,

              status:
                row.status,

              company:
                row.company ||
                "",

              activeDeployment: {
                id:
                  row.deployment_id,

                deploymentId:
                  row.deployment_id,

                employeeId:
                  row.id,

                employee:
                  row.name,

                employeeName:
                  row.name,

                company:
                  row.company ||
                  "",

                position:
                  row.position ||
                  "",

                status:
                  "Active",

                deploymentStatus:
                  "Active",

                startDate:
                  row.start_date ||
                  null,
              },
            })
          ),
      });
    } catch (error) {
      console.error(
        "GET INCIDENT FORM META ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to load incident form employee options.",
        });
    }
  };

/*
 * ==================================================
 * SERVER-AUTHORITATIVE INCIDENT CLASSIFICATION
 * ==================================================
 */

async function getRequiredViolationPolicy(
  connection
) {
  const configuration =
    await getViolationRulesConfiguration(
      {
        connection,
      }
    );

  if (!configuration) {
    throw new ViolationPolicyError(
      "The current violation policy is not configured. Incident classification is temporarily unavailable.",
      {
        statusCode: 503,

        code:
          "VIOLATION_POLICY_NOT_CONFIGURED",
      }
    );
  }

  return configuration;
}

async function lockEmployeeForClassification(
  connection,
  employeeId
) {
  const [rows] =
    await connection.query(
      `
      SELECT *
      FROM employees
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [
        employeeId,
      ]
    );

  if (!rows.length) {
    throw new ViolationPolicyError(
      "Selected employee not found.",
      {
        statusCode: 404,

        code:
          "EMPLOYEE_NOT_FOUND",
      }
    );
  }

  return rows[0];
}

async function getIncidentHistoryCounts({
  connection,
  employeeId,
  violation,
  excludeIncidentId = null,
}) {
  const normalizedEmployeeId =
    String(
      employeeId || ""
    ).trim();

  const normalizedViolation =
    normalizeText(
      violation
    );

  const params = [
    normalizedViolation,
    normalizedEmployeeId,
  ];

  let excludeClause = "";

  if (
    excludeIncidentId !==
      null &&
    excludeIncidentId !==
      undefined &&
    String(
      excludeIncidentId
    ).trim() !== ""
  ) {
    excludeClause =
      "AND id <> ?";

    params.push(
      excludeIncidentId
    );
  }

  const [rows] =
    await connection.query(
      `
      SELECT
        COUNT(*) AS totalEmployeeCases,

        SUM(
          CASE
            WHEN LOWER(
              TRIM(
                violation_type
              )
            ) = ?
            THEN 1
            ELSE 0
          END
        ) AS sameViolationCases

      FROM incidents

      WHERE CAST(
        employee_id AS CHAR
      ) = ?

      ${excludeClause}
      `,
      params
    );

  const row =
    rows[0] ||
    {};

  const totalEmployeeCases =
    Number(
      row.totalEmployeeCases ||
        0
    );

  const sameViolationCases =
    Number(
      row.sameViolationCases ||
        0
    );

  return {
    totalEmployeeCases,

    sameViolationCases,

    offenseCount:
      sameViolationCases +
      1,
  };
}

async function buildAuthoritativeIncidentClassification({
  connection,
  employeeId,
  violation,
  violationSection = "",
  violationCategory = "",
  description = "",
  excludeIncidentId = null,
}) {
  const configuration =
    await getRequiredViolationPolicy(
      connection
    );

  const rule =
    resolveViolationRule({
      rules:
        configuration.rules,

      violation,

      section:
        violationSection,

      category:
        violationCategory,
    });

  const history =
    await getIncidentHistoryCounts({
      connection,

      employeeId,

      violation:
        rule.violation,

      excludeIncidentId,
    });

  return computeIncidentClassification(
    {
      rule,

      offenseCount:
        history.offenseCount,

      totalEmployeeCases:
        history.totalEmployeeCases,

      description,
    }
  );
}

function hasSubmittedValue(
  value
) {
  return (
    value !== undefined &&
    value !== null &&
    String(value).trim() !==
      ""
  );
}

function assertSubmittedSeverityMatches(
  submittedSeverity,
  expectedSeverity
) {
  if (
    !hasSubmittedValue(
      submittedSeverity
    )
  ) {
    return;
  }

  const normalizedSubmittedSeverity =
    getHighestSeverity(
      submittedSeverity
    );

  if (
    !normalizedSubmittedSeverity ||
    normalizedSubmittedSeverity !==
      expectedSeverity
  ) {
    throw new ViolationPolicyError(
      "The submitted incident severity does not match the server-authoritative classification. Refresh the incident form and try again.",
      {
        statusCode: 409,

        code:
          "INCIDENT_SEVERITY_MISMATCH",
      }
    );
  }
}

function assertSubmittedSanctionMatches(
  submittedSanction,
  expectedSanction
) {
  if (
    !hasSubmittedValue(
      submittedSanction
    )
  ) {
    return;
  }

  if (
    normalizeText(
      submittedSanction
    ) !==
    normalizeText(
      expectedSanction
    )
  ) {
    throw new ViolationPolicyError(
      "The submitted incident sanction does not match the current server policy. Refresh the incident form and try again.",
      {
        statusCode: 409,

        code:
          "INCIDENT_SANCTION_MISMATCH",
      }
    );
  }
}

function respondToViolationPolicyError(
  res,
  error
) {
  const statusCode =
    Number(
      error?.statusCode
    ) || 400;

  const publicMessage =
    statusCode >= 500 &&
    error?.code !==
      "VIOLATION_POLICY_NOT_CONFIGURED"
      ? "The violation policy configuration is unavailable or invalid. Please contact an authorized administrator."
      : error.message;

  return res
    .status(statusCode)
    .json({
      error:
        publicMessage,

      code:
        error?.code ||
        "VIOLATION_POLICY_ERROR",
    });
}

function serializeEvidenceItem(
  item
) {
  const filePath =
    normalizeIncidentEvidencePath(
      item.file_path
    );

  const isExternalUrl =
    /^https?:\/\//i.test(
      filePath
    );

  return {
    id:
      item.id,

    fileName:
      item.file_name,

    filePath,

    evidencePurpose:
      item.evidence_purpose ||
      EVIDENCE_PURPOSE.RESOLUTION_PROOF,

    evidence_purpose:
      item.evidence_purpose ||
      EVIDENCE_PURPOSE.RESOLUTION_PROOF,

    url:
      isExternalUrl
        ? filePath
        : null,
  };
}

function serializeTimelineItem(
  item
) {
  const createdAtTimestamp =
    normalizeEpochMilliseconds(
      item.created_at_timestamp ??
        item.createdAtTimestamp
    );

  const createdAt =
    getDatabaseEventDateTime(
      createdAtTimestamp,
      item.created_at
    );

  return {
    id:
      item.id,

    incidentId:
      item.incident_id,

    incident_id:
      item.incident_id,

    actionType:
      item.action_type,

    action_type:
      item.action_type,

    title:
      item.title,

    description:
      item.description ||
      "",

    createdById:
      item.created_by_id ||
      null,

    created_by_id:
      item.created_by_id ||
      null,

    createdByUsername:
      item
        .created_by_username ||
      null,

    created_by_username:
      item
        .created_by_username ||
      null,

    createdByName:
      item.created_by_name ||
      "System",

    created_by_name:
      item.created_by_name ||
      "System",

    createdByRole:
      item.created_by_role ||
      null,

    created_by_role:
      item.created_by_role ||
      null,

    createdAt,

    created_at:
      createdAt,

    createdAtTimestamp,

    created_at_timestamp:
      createdAtTimestamp,
  };
}

async function getTimelineByIncidentId(
  incidentId
) {
  const [rows] =
    await db
      .promise()
      .query(
        `
        SELECT
          incident_timeline.*,
          UNIX_TIMESTAMP(
            incident_timeline.created_at
          ) * 1000 AS created_at_timestamp
        FROM incident_timeline
        WHERE incident_id = ?
        ORDER BY
          created_at ASC,
          id ASC
        `,
        [
          incidentId,
        ]
      );

  return rows.map(
    serializeTimelineItem
  );
}

async function getTimelineByIncidentIds(
  incidentIds = []
) {
  if (!incidentIds.length) {
    return new Map();
  }

  const [rows] =
    await db
      .promise()
      .query(
        `
        SELECT
          incident_timeline.*,
          UNIX_TIMESTAMP(
            incident_timeline.created_at
          ) * 1000 AS created_at_timestamp
        FROM incident_timeline
        WHERE incident_id IN (?)
        ORDER BY
          created_at ASC,
          id ASC
        `,
        [
          incidentIds,
        ]
      );

  return rows.reduce(
    (
      map,
      row
    ) => {
      const key =
        String(
          row.incident_id
        );

      if (
        !map.has(key)
      ) {
        map.set(
          key,
          []
        );
      }

      map
        .get(key)
        .push(
          serializeTimelineItem(
            row
          )
        );

      return map;
    },
    new Map()
  );
}

async function addTimelineEvent({
  incidentId,
  actionType,
  title,
  description,
  actor,
  connection = null,
}) {
  const queryTarget =
    connection ||
    db.promise();

  await queryTarget.query(
    `
    INSERT INTO incident_timeline
    (
      incident_id,
      action_type,
      title,
      description,
      created_by_id,
      created_by_username,
      created_by_name,
      created_by_role
    )
    VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?
    )
    `,
    [
      incidentId,
      actionType,
      title,
      description ||
        null,
      actor?.userId ||
        null,
      actor?.username ||
        null,
      actor?.fullName ||
        "System",
      actor?.role ||
        null,
    ]
  );
}

function getTimelineTitle(
  actionType,
  existingIncident
) {
  const reviewDecision =
    String(
      existingIncident
        ?.review_decision ||
        ""
    ).toLowerCase();

  const wasReturned =
    reviewDecision ===
      "returned" ||
    reviewDecision ===
      "rejected";

  switch (actionType) {
    case "CREATE_INCIDENT":
      return "Reported";

    case WORKFLOW_ACTION.START:
      return "Investigation Started";

    case WORKFLOW_ACTION
      .SUBMIT_RESOLUTION:

    case WORKFLOW_ACTION
      .SUBMIT_INVESTIGATION:
      return wasReturned
        ? "Proof Resubmitted"
        : "Proof Submitted";

    case WORKFLOW_ACTION.RETURN:
      return "Returned by Reviewer";

    case WORKFLOW_ACTION.CLOSE:
      return "Approved and Closed";

    default:
      return "Incident Updated";
  }
}

function getTimelineDescription(
  actionType,
  actor,
  details = {}
) {
  const actorName =
    actor?.fullName ||
    "System";

  switch (actionType) {
    case "CREATE_INCIDENT":
      return `Reported by ${actorName}.`;

    case WORKFLOW_ACTION.START:
      return `${actorName} started the investigation.`;

    case WORKFLOW_ACTION
      .SUBMIT_RESOLUTION:

    case WORKFLOW_ACTION
      .SUBMIT_INVESTIGATION:
      return `${actorName} submitted proof for authorized reviewer assessment.`;

    case WORKFLOW_ACTION.RETURN:
      return details
        ?.comments
        ? `${actorName} returned the case for correction: ${details.comments}`
        : `${actorName} returned the case for correction.`;

    case WORKFLOW_ACTION.CLOSE:
      return `${actorName} approved and closed the case.`;

    default:
      return `${actorName} updated the incident record.`;
  }
}

function serializeIncident(
  incident,
  evidence = [],
  timelineEvents = []
) {
  const employeeName =
    incident.employee_name ||
    incident
      .employeeNameFromEmployee ||
    "Unknown Employee";

  const hasResolutionSubmission =
    Boolean(
      incident
        .resolution_submitted_at
    );

  /*
   * ==================================================
   * POLICY SANCTION / ACTION TAKEN SEPARATION
   * ==================================================
   *
   * policy_sanction:
   * - server-authoritative prescribed sanction
   * - captured when the incident is created
   * - historical / immutable
   *
   * action_taken:
   * - actual action recorded by the investigator
   * - populated only during proof submission
   *
   * Legacy records created before policy_sanction
   * existed stored the prescribed sanction inside
   * action_taken.
   *
   * The fallback below is used only when no proof
   * has ever been submitted.
   *
   * Once proof exists, action_taken is investigation
   * data and must never be presented as policy
   * sanction.
   */
  const legacyPolicySanction =
    !incident
      .policy_sanction &&
    !hasResolutionSubmission
      ? (
          incident
            .action_taken ||
          ""
        )
      : "";

  const policySanction =
    incident
      .policy_sanction ||
    legacyPolicySanction ||
    "";

  const actionTaken =
    hasResolutionSubmission
      ? (
          incident
            .action_taken ||
          ""
        )
      : "";

  /*
   * Normalize all workflow timestamps before building
   * nested workflow objects.
   *
   * These values are referenced by investigation,
   * resolution, and review below, so they must be
   * initialized first.
   */
  const incidentCreatedAt =
    getDatabaseEventDateTime(
      incident.created_at_timestamp,
      incident.created_at
    );

  const incidentUpdatedAt =
    getDatabaseEventDateTime(
      incident.updated_at_timestamp,
      incident.updated_at
    );

  const lastActionAt =
    getDatabaseEventDateTime(
      incident.last_action_at_timestamp,
      incident.last_action_at
    );

  const investigationStartedAt =
    getDatabaseEventDateTime(
      incident.investigation_started_at_timestamp,
      incident.investigation_started_at
    );

  const resolutionSubmittedAt =
    getDatabaseEventDateTime(
      incident.resolution_submitted_at_timestamp,
      incident.resolution_submitted_at
    );

  const reviewedAt =
    getDatabaseEventDateTime(
      incident.reviewed_at_timestamp,
      incident.reviewed_at
    );

  const investigation =
    incident
      .investigation_started_at
      ? {
          startedAt:
            investigationStartedAt,

          startedById:
            incident
              .investigation_started_by_id,

          startedByUsername:
            incident
              .investigation_started_by_username,

          startedByName:
            incident
              .investigation_started_by_name,
        }
      : null;

  const initialNteFiles = evidence.filter(
    (item) =>
      item.evidence_purpose ===
      EVIDENCE_PURPOSE.INITIAL_NTE
  );
  const resolutionProofFiles = evidence.filter(
    (item) =>
      !item.evidence_purpose ||
      item.evidence_purpose ===
        EVIDENCE_PURPOSE.RESOLUTION_PROOF
  );

  const resolution =
    hasResolutionSubmission
      ? {
          submittedAt:
            resolutionSubmittedAt,

          submittedById:
            incident
              .resolution_submitted_by_id,

          submittedByUsername:
            incident
              .resolution_submitted_by_username,

          submittedByName:
            incident
              .resolution_submitted_by_name,

          actionTaken,

          remarks:
            incident
              .resolution_notes ||
            "",

          proofFiles:
            resolutionProofFiles.map(
              serializeEvidenceItem
            ),
        }
      : null;

  const review =
    incident.reviewed_at ||
    incident.review_decision
      ? {
          reviewedAt,

          reviewedById:
            incident
              .reviewed_by_id,

          reviewedByUsername:
            incident
              .reviewed_by_username,

          reviewedByName:
            incident
              .reviewed_by_name,

          decision:
            incident
              .review_decision,

          comments:
            incident
              .review_comments,
        }
      : null;

  const reportCreator =
    getIncidentCreator(incident);

  const reportingPath =
    getReportingPath(incident);

  return {
    id:
      incident.id,

    employeeId:
      incident.employee_id,

    employee_id:
      incident.employee_id,

    employee:
      employeeName,

    employeeName,

    company:
      incident.company ||
      incident
        .employeeCompany ||
      "",

    employeeStatus:
      incident
        .employeeStatus ||
      "",

    violation:
      incident
        .violation_type ||
      "",

    violationType:
      incident
        .violation_type ||
      "",

    violation_type:
      incident
        .violation_type ||
      "",

    severity:
      incident.severity ||
      "Minor",

    status:
      incident.status ||
      "Open",

    date:
      incident
        .incident_date,

    incidentDate:
      incident
        .incident_date,

    incident_date:
      incident
        .incident_date,

    reportedAt:
      incidentCreatedAt ||
      incident
        .incident_date,

    location:
      incident.location ||
      "",

    description:
      incident.description ||
      "",

    reportedBy:
      incident.reported_by ||
      "",

    reportedByName:
      incident.reported_by ||
      "",

    reported_by:
      incident.reported_by ||
      "",

    reportCreator,

    reportCreatorId:
      reportCreator.id,

    report_creator_id:
      reportCreator.id,

    reportCreatorUsername:
      reportCreator.username,

    report_creator_username:
      reportCreator.username,

    reportCreatorName:
      reportCreator.name,

    report_creator_name:
      reportCreator.name,

    reportCreatorRole:
      reportCreator.role || null,

    report_creator_role:
      reportCreator.role || null,

    reportingPath,

    reporting_path:
      reportingPath,

    /*
     * Actual investigator action.
     */
    actionTaken,

    action_taken:
      actionTaken,

    /*
     * Immutable historical prescribed sanction.
     */
    policySanction,

    policy_sanction:
      policySanction,

    sanction:
      policySanction,

    recommendation:
      incident
        .recommendation ||
      "",

    resolutionNotes:
      incident
        .resolution_notes ||
      "",

    resolution_notes:
      incident
        .resolution_notes ||
      "",

    investigation,
    resolution,
    review,

    initialNte:
      initialNteFiles.length
        ? serializeEvidenceItem(initialNteFiles[0])
        : null,

    initial_nte:
      initialNteFiles.length
        ? serializeEvidenceItem(initialNteFiles[0])
        : null,

    investigationStartedAt:
      investigationStartedAt ||
      null,

    investigation_started_at:
      investigationStartedAt ||
      null,

    investigationStartedAtTimestamp:
      normalizeEpochMilliseconds(
        incident.investigation_started_at_timestamp
      ),

    investigation_started_at_timestamp:
      normalizeEpochMilliseconds(
        incident.investigation_started_at_timestamp
      ),

    investigationStartedById:
      incident
        .investigation_started_by_id ||
      null,

    investigation_started_by_id:
      incident
        .investigation_started_by_id ||
      null,

    investigationStartedByUsername:
      incident
        .investigation_started_by_username ||
      null,

    investigation_started_by_username:
      incident
        .investigation_started_by_username ||
      null,

    investigationStartedByName:
      incident
        .investigation_started_by_name ||
      null,

    investigation_started_by_name:
      incident
        .investigation_started_by_name ||
      null,

    resolutionSubmittedAt:
      resolutionSubmittedAt ||
      null,

    resolution_submitted_at:
      resolutionSubmittedAt ||
      null,

    resolutionSubmittedAtTimestamp:
      normalizeEpochMilliseconds(
        incident.resolution_submitted_at_timestamp
      ),

    resolution_submitted_at_timestamp:
      normalizeEpochMilliseconds(
        incident.resolution_submitted_at_timestamp
      ),

    resolutionSubmittedById:
      incident
        .resolution_submitted_by_id ||
      null,

    resolution_submitted_by_id:
      incident
        .resolution_submitted_by_id ||
      null,

    resolutionSubmittedByUsername:
      incident
        .resolution_submitted_by_username ||
      null,

    resolution_submitted_by_username:
      incident
        .resolution_submitted_by_username ||
      null,

    resolutionSubmittedByName:
      incident
        .resolution_submitted_by_name ||
      null,

    resolution_submitted_by_name:
      incident
        .resolution_submitted_by_name ||
      null,

    reviewedAt:
      reviewedAt ||
      null,

    reviewed_at:
      reviewedAt ||
      null,

    reviewedAtTimestamp:
      normalizeEpochMilliseconds(
        incident.reviewed_at_timestamp
      ),

    reviewed_at_timestamp:
      normalizeEpochMilliseconds(
        incident.reviewed_at_timestamp
      ),

    reviewedById:
      incident
        .reviewed_by_id ||
      null,

    reviewed_by_id:
      incident
        .reviewed_by_id ||
      null,

    reviewedByUsername:
      incident
        .reviewed_by_username ||
      null,

    reviewed_by_username:
      incident
        .reviewed_by_username ||
      null,

    reviewedByName:
      incident
        .reviewed_by_name ||
      null,

    reviewed_by_name:
      incident
        .reviewed_by_name ||
      null,

    reviewDecision:
      incident
        .review_decision ||
      null,

    review_decision:
      incident
        .review_decision ||
      null,

    reviewComments:
      incident
        .review_comments ||
      null,

    review_comments:
      incident
        .review_comments ||
      null,

    createdAt:
      incidentCreatedAt,

    created_at:
      incidentCreatedAt,

    createdAtTimestamp:
      normalizeEpochMilliseconds(
        incident.created_at_timestamp
      ),

    created_at_timestamp:
      normalizeEpochMilliseconds(
        incident.created_at_timestamp
      ),

    updatedAt:
      incidentUpdatedAt,

    updated_at:
      incidentUpdatedAt,

    updatedAtTimestamp:
      normalizeEpochMilliseconds(
        incident.updated_at_timestamp
      ),

    updated_at_timestamp:
      normalizeEpochMilliseconds(
        incident.updated_at_timestamp
      ),

    lastActionById:
      incident
        .last_action_by_id ||
      null,

    last_action_by_id:
      incident
        .last_action_by_id ||
      null,

    lastActionByUsername:
      incident
        .last_action_by_username ||
      null,

    last_action_by_username:
      incident
        .last_action_by_username ||
      null,

    lastActionByName:
      incident
        .last_action_by_name ||
      null,

    last_action_by_name:
      incident
        .last_action_by_name ||
      null,

    lastActionType:
      incident
        .last_action_type ||
      null,

    last_action_type:
      incident
        .last_action_type ||
      null,

    lastActionAt:
      lastActionAt ||
      null,

    last_action_at:
      lastActionAt ||
      null,

    lastActionAtTimestamp:
      normalizeEpochMilliseconds(
        incident.last_action_at_timestamp
      ),

    last_action_at_timestamp:
      normalizeEpochMilliseconds(
        incident.last_action_at_timestamp
      ),

    evidence:
      evidence.map(
        serializeEvidenceItem
      ),

    timelineEvents,

    timeline_events:
      timelineEvents,

    timeline:
      timelineEvents,
  };
}


function serializeHrStaffEmployeeIncidentHistoryItem(
  incident
) {
  const employeeName =
    incident.employee_name ||
    incident.employeeNameFromEmployee ||
    "Unknown Employee";

  const hasResolutionSubmission =
    Boolean(
      incident.resolution_submitted_at
    );

  const legacyPolicySanction =
    !incident.policy_sanction &&
    !hasResolutionSubmission
      ? (
          incident.action_taken ||
          ""
        )
      : "";

  const policySanction =
    incident.policy_sanction ||
    legacyPolicySanction ||
    "";

  return {
    id:
      incident.id,

    employeeId:
      incident.employee_id,

    employee_id:
      incident.employee_id,

    employee:
      employeeName,

    employeeName,

    company:
      incident.company ||
      incident.employeeCompany ||
      "",

    violation:
      incident.violation_type ||
      "",

    violationType:
      incident.violation_type ||
      "",

    violation_type:
      incident.violation_type ||
      "",

    severity:
      incident.severity ||
      "Minor",

    status:
      incident.status ||
      "Open",

    date:
      incident.incident_date,

    incidentDate:
      incident.incident_date,

    incident_date:
      incident.incident_date,

    reportedAt:
      incident.created_at ||
      incident.incident_date,

    createdAt:
      incident.created_at,

    created_at:
      incident.created_at,

    description:
      incident.description ||
      "",

    /*
     * EmployeeModal displays the prescribed sanction
     * as read-only textual history.
     *
     * Do not expose investigator/reviewer identities,
     * workflow state objects, timeline data, NTE metadata,
     * Resolution Proof metadata, file IDs, paths, or URLs.
     */
    sanction:
      policySanction,

    policySanction:
      policySanction,

    policy_sanction:
      policySanction,

    initialNte:
      null,

    initial_nte:
      null,

    evidence:
      [],

    resolution:
      null,

    investigation:
      null,

    review:
      null,

    timelineEvents:
      [],

    timeline_events:
      [],

    timeline:
      [],

    protectedEvidenceAccess:
      false,

    protected_evidence_access:
      false,
  };
}

function serializeIncidentSummary(
  incident
) {
  const serialized =
    serializeIncident(
      incident,
      [],
      []
    );

  const {
    evidence,
    timelineEvents,
    timeline_events,
    timeline,
    ...summary
  } =
    serialized;

  return summary;
}

/*
 * OPTION A — HISTORICAL LIST ONLY.
 *
 * Only the originating company's coordinator can receive
 * this small list entry after the employee transfers away.
 * Never serialize/spread the original incident object here:
 * it contains confidential descriptions, sanctions, notes,
 * investigator identity, review data and other details.
 */
function serializeHistoricalIncidentListItem(incident) {
  const employeeName =
    incident.employee_name ||
    `Employee #${incident.employee_id}`;

  return {
    id: incident.id,
    employeeId: incident.employee_id,
    employee_id: incident.employee_id,
    employee: employeeName,
    employeeName,
    company: incident.company || "",
    violation: incident.violation_type || "",
    violationType: incident.violation_type || "",
    violation_type: incident.violation_type || "",
    severity: incident.severity || "Minor",
    status: incident.status || "Open",
    date: incident.incident_date,
    incidentDate: incident.incident_date,
    incident_date: incident.incident_date,
    reportedAt: incident.created_at || incident.incident_date,
    isHistorical: true,
    canViewDetails: false,
  };
}

async function getIncidentWithEvidence(
  id,
  {
    coordinatorCompany = null,
  } = {}
) {
  /*
   * HR Coordinator must satisfy BOTH conditions:
   *
   * 1. The incident belongs to their assigned company.
   * 2. The employee is CURRENTLY deployed exclusively
   *    to their assigned company.
   *
   * Other authorized roles retain their existing
   * incident-history access.
   */
  const companyScopeSql = coordinatorCompany
    ? `
      AND
      ${buildIncidentCompanyScopeCondition("i")}

      AND e.id IS NOT NULL

      AND COALESCE(e.archived, 0) = 0

      AND LOWER(
        TRIM(
          COALESCE(e.status, '')
        )
      ) = 'deployed'

      AND EXISTS (
        SELECT 1
        FROM deployment_assignments AS da_current
        WHERE
          da_current.employee_id = e.id

          AND da_current.status = 'Active'

          AND LOWER(
            TRIM(
              COALESCE(da_current.company, '')
            )
          ) = LOWER(TRIM(?))

          AND NOT EXISTS (
            SELECT 1
            FROM deployment_assignments AS da_conflict
            WHERE
              da_conflict.employee_id = e.id

              AND da_conflict.status = 'Active'

              AND da_conflict.id <> da_current.id
          )
      )
    `
    : "";

  /*
   * Parameter order matches the SQL:
   *
   * 1. Incident ID
   * 2. Incident company
   * 3. Current deployment company
   */
  const queryParams = [
    id,
    ...(coordinatorCompany
      ? [
          coordinatorCompany,
          coordinatorCompany,
        ]
      : []),
  ];

  const [rows] = await db
    .promise()
    .query(
      `
      SELECT
        i.*,

        UNIX_TIMESTAMP(
          i.created_at
        ) * 1000 AS created_at_timestamp,

        UNIX_TIMESTAMP(
          i.updated_at
        ) * 1000 AS updated_at_timestamp,

        UNIX_TIMESTAMP(
          i.last_action_at
        ) * 1000 AS last_action_at_timestamp,

        UNIX_TIMESTAMP(
          i.investigation_started_at
        ) * 1000 AS investigation_started_at_timestamp,

        UNIX_TIMESTAMP(
          i.resolution_submitted_at
        ) * 1000 AS resolution_submitted_at_timestamp,

        UNIX_TIMESTAMP(
          i.reviewed_at
        ) * 1000 AS reviewed_at_timestamp,

        ${getCreateIncidentActorSelect("i")},
        e.name AS employeeNameFromEmployee,
        e.company AS employeeCompany,
        e.status AS employeeStatus
      FROM incidents AS i
      LEFT JOIN employees AS e
        ON e.id = i.employee_id
      WHERE i.id = ?
        ${companyScopeSql}
      LIMIT 1
      `,
      queryParams
    );

  if (!rows.length) {
    return null;
  }

  const [
    [evidence],
    timelineEvents,
  ] = await Promise.all([
    db
      .promise()
      .query(
        `
        SELECT *
        FROM incident_evidence
        WHERE incident_id = ?
        ORDER BY
          created_at DESC,
          id DESC
        `,
        [id]
      ),

    getTimelineByIncidentId(id),
  ]);

  return serializeIncident(
    rows[0],
    evidence,
    timelineEvents
  );
}

async function resolveActorFullName({
  userId,
  username,
  fullName,
}) {
  const cleanUserId =
    toNullable(userId);

  const cleanUsername =
    toNullable(username);

  const cleanFullName =
    toNullable(fullName);

  if (
    cleanFullName &&
    cleanFullName !==
      cleanUsername &&
    cleanFullName !==
      "Unknown User"
  ) {
    return cleanFullName;
  }

  if (
    !(await tableExists(
      "users"
    ))
  ) {
    return (
      cleanFullName ||
      cleanUsername ||
      "Unknown User"
    );
  }

  const [users] =
    await db
      .promise()
      .query(`
        SELECT *
        FROM users
      `);

  const matchedUser =
    users.find(
      (user) => {
        const possibleIds =
          [
            user.id,
            user.user_id,
            user.userId,
            user.employee_id,
            user.employeeId,
          ].map(
            (item) =>
              String(
                item || ""
              ).trim()
          );

        const possibleUsernames =
          [
            user.username,
            user.email,
            user.name,
            user.full_name,
            user.fullName,
            user.fullname,
            user.display_name,
          ].map(
            (item) =>
              String(
                item || ""
              )
                .trim()
                .toLowerCase()
          );

        return (
          (
            !!cleanUserId &&
            possibleIds.includes(
              String(
                cleanUserId
              )
            )
          ) ||
          (
            !!cleanUsername &&
            possibleUsernames.includes(
              String(
                cleanUsername
              ).toLowerCase()
            )
          )
        );
      }
    );

  if (!matchedUser) {
    return (
      cleanFullName ||
      cleanUsername ||
      "Unknown User"
    );
  }

  return (
    toNullable(
      matchedUser.full_name
    ) ||
    toNullable(
      matchedUser.fullName
    ) ||
    toNullable(
      matchedUser.fullname
    ) ||
    toNullable(
      matchedUser.name
    ) ||
    toNullable(
      matchedUser.display_name
    ) ||
    cleanFullName ||
    cleanUsername ||
    "Unknown User"
  );
}

async function getActor(req) {
  const authenticatedUser =
    req.user ||
    {};

  const userId =
    authenticatedUser.userId ??
    authenticatedUser.id ??
    null;

  const username =
    toNullable(
      authenticatedUser.username
    );

  const role =
    normalizeRole(
      authenticatedUser.role
    );

  const fullName =
    await resolveActorFullName({
      userId,
      username,
      fullName: null,
    });

  return {
    userId:
      toNullable(
        userId
      ),

    username,

    fullName:
      fullName ||
      username ||
      "Unknown User",

    role,
  };
}

function toPositiveInteger(
  value,
  fallback
) {
  const parsed =
    Number.parseInt(
      String(
        value ?? ""
      ),
      10
    );

  return Number.isInteger(
    parsed
  ) && parsed > 0
    ? parsed
    : fallback;
}

function normalizeIncidentSummaryCaseTab(
  value
) {
  const normalized =
    String(
      value || "ALL"
    )
      .trim()
      .toUpperCase()
      .replace(
        /[\s-]+/g,
        "_"
      );

  return [
    "ALL",
    "ACTIVE",
    "FOR_REVIEW",
    "CLOSED",
  ].includes(
    normalized
  )
    ? normalized
    : "ALL";
}

function normalizeIncidentSummarySearch(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9\s]/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .slice(
      0,
      150
    );
}

function normalizeIncidentFilterMonth(
  value
) {
  const parsed =
    Number.parseInt(
      String(
        value ?? ""
      ).trim(),
      10
    );

  return (
    Number.isInteger(
      parsed
    ) &&
    parsed >= 1 &&
    parsed <= 12
  )
    ? parsed
    : null;
}

function normalizeIncidentFilterYear(
  value
) {
  const parsed =
    Number.parseInt(
      String(
        value ?? ""
      ).trim(),
      10
    );

  return (
    Number.isInteger(
      parsed
    ) &&
    parsed >= 1900 &&
    parsed <= 9999
  )
    ? parsed
    : null;
}

function formatIncidentFilterDate(
  year,
  month = 1,
  day = 1
) {
  return [
    String(year).padStart(
      4,
      "0"
    ),
    String(month).padStart(
      2,
      "0"
    ),
    String(day).padStart(
      2,
      "0"
    ),
  ].join("-");
}

function getNextIncidentFilterMonth(
  year,
  month
) {
  if (month === 12) {
    return {
      year:
        year + 1,
      month:
        1,
    };
  }

  return {
    year,
    month:
      month + 1,
  };
}

function buildIncidentSummaryFilters(
  query = {},
  {
    coordinatorCompany = null,
  } = {}
) {
  const conditions =
    [];

  const params =
    [];

  if (coordinatorCompany) {
    conditions.push(
      buildIncidentCompanyScopeCondition(
        "i"
      )
    );

    params.push(
      coordinatorCompany
    );
  }

  const caseTab =
    normalizeIncidentSummaryCaseTab(
      query.caseTab ||
      query.case_tab
    );

  const severity =
    String(
      query.severity ||
      query.severityFilter ||
      query.severity_filter ||
      "ALL"
    ).trim();

  const normalizedSeverity =
    severity.toUpperCase();

  if (
    caseTab ===
    "ACTIVE"
  ) {
    conditions.push(
      `LOWER(TRIM(COALESCE(i.status, ''))) IN ('open', 'investigating')`
    );
  } else if (
    caseTab ===
    "FOR_REVIEW"
  ) {
    conditions.push(
      `(LOWER(TRIM(COALESCE(i.status, ''))) IN ('for review', 'for_review'))`
    );
  } else if (
    caseTab ===
    "CLOSED"
  ) {
    conditions.push(
      `(LOWER(TRIM(COALESCE(i.status, ''))) IN ('closed', 'resolved'))`
    );
  }

  if (
    normalizedSeverity &&
    normalizedSeverity !==
      "ALL"
  ) {
    conditions.push(
      "LOWER(TRIM(COALESCE(i.severity, ''))) = ?"
    );

    params.push(
      severity.toLowerCase()
    );
  }

  /*
   * ==================================================
   * VIOLATION TYPE FILTER
   * ==================================================
   *
   * The Incident page and PDF report both use this
   * shared filter builder, so one exact violation
   * selection produces the same authoritative dataset
   * for:
   *
   * - paginated Incident records
   * - pagination totals
   * - Incident PDF export
   * - PDF frequency / summary calculations
   *
   * The selected value comes from the same configured
   * violation policy used by Add Incident Report.
   *
   * Matching is exact after trimming and is
   * case-insensitive. "ALL" means no violation filter.
   */
  const requestedViolation =
    String(
      query.violationType ||
      query.violation_type ||
      query.violation ||
      query.violationFilter ||
      query.violation_filter ||
      "ALL"
    ).trim();

  const normalizedViolation =
    requestedViolation
      .toLowerCase();

  if (
    normalizedViolation &&
    normalizedViolation !==
      "all"
  ) {
    conditions.push(
      "LOWER(TRIM(COALESCE(i.violation_type, ''))) = ?"
    );

    params.push(
      normalizedViolation
    );
  }

  /*
   * ==================================================
   * INCIDENT DATE MONTH / YEAR FILTER
   * ==================================================
   *
   * Reporting period is based on the actual
   * incidents.incident_date field — never created_at.
   *
   * Supported combinations:
   *
   * - Month + Year:
   *   exact calendar month in the selected year
   *
   * - Year only:
   *   all incidents in that calendar year
   *
   * - Month only:
   *   that calendar month across available years
   *
   * Range predicates are used whenever Year is present
   * so MySQL can use an incident_date index efficiently.
   */
  const requestedMonth =
    normalizeIncidentFilterMonth(
      query.month ||
      query.incidentMonth ||
      query.incident_month
    );

  const requestedYear =
    normalizeIncidentFilterYear(
      query.year ||
      query.incidentYear ||
      query.incident_year
    );

  if (
    requestedYear &&
    requestedMonth
  ) {
    const nextMonth =
      getNextIncidentFilterMonth(
        requestedYear,
        requestedMonth
      );

    conditions.push(
      "i.incident_date >= ? AND i.incident_date < ?"
    );

    params.push(
      formatIncidentFilterDate(
        requestedYear,
        requestedMonth,
        1
      ),
      formatIncidentFilterDate(
        nextMonth.year,
        nextMonth.month,
        1
      )
    );
  } else if (
    requestedYear
  ) {
    conditions.push(
      "i.incident_date >= ? AND i.incident_date < ?"
    );

    params.push(
      formatIncidentFilterDate(
        requestedYear,
        1,
        1
      ),
      formatIncidentFilterDate(
        requestedYear + 1,
        1,
        1
      )
    );
  } else if (
    requestedMonth
  ) {
    conditions.push(
      "MONTH(i.incident_date) = ?"
    );

    params.push(
      requestedMonth
    );
  }

  const requestedStatus =
    String(
      query.status ||
      query.caseStatus ||
      query.case_status ||
      "ALL"
    ).trim();

  const normalizedStatus =
    requestedStatus
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ");

  if (
    caseTab === "ALL" &&
    normalizedStatus &&
    normalizedStatus !== "all"
  ) {
    const statusValues =
      normalizedStatus ===
      "for review"
        ? [
            "for review",
            "for_review",
            "resolved",
          ]
        : normalizedStatus ===
          "closed"
          ? [
              "closed",
              "resolved",
            ]
          : [
              normalizedStatus,
            ];

    conditions.push(
      `LOWER(TRIM(COALESCE(i.status, ''))) IN (${statusValues
        .map(() => "?")
        .join(", ")})`
    );

    params.push(
      ...statusValues
    );
  }

  const normalizedSearch =
    normalizeIncidentSummarySearch(
      query.search
    );

  const searchTerms =
    normalizedSearch
      ? normalizedSearch.split(
          /\s+/
        )
      : [];

  for (const term of searchTerms) {
    const likeTerm = `%${term}%`;

    /*
     * Coordinator historical entries expose only the
     * fields below. Never permit searching hidden sanction,
     * description, location, review or investigation fields:
     * a search result itself could reveal their contents.
     */
    const searchableColumns = coordinatorCompany
      ? [
          "LOWER(CAST(i.id AS CHAR))",
          "LOWER(CONCAT('inc', LPAD(CAST(i.id AS CHAR), 4, '0')))",
          "LOWER(CAST(i.employee_id AS CHAR))",
          "LOWER(COALESCE(i.employee_name, ''))",
          "LOWER(COALESCE(i.violation_type, ''))",
          "LOWER(COALESCE(i.company, ''))",
          "LOWER(COALESCE(i.severity, ''))",
          "LOWER(COALESCE(i.status, ''))",
        ]
      : [
          "LOWER(CAST(i.id AS CHAR))",
          "LOWER(CONCAT('inc', LPAD(CAST(i.id AS CHAR), 4, '0')))",
          "LOWER(CAST(i.employee_id AS CHAR))",
          "LOWER(COALESCE(i.employee_name, ''))",
          "LOWER(COALESCE(e.name, ''))",
          "LOWER(COALESCE(i.violation_type, ''))",
          "LOWER(COALESCE(i.company, ''))",
          "LOWER(COALESCE(e.company, ''))",
          "LOWER(COALESCE(i.location, ''))",
          "LOWER(COALESCE(i.severity, ''))",
          "LOWER(COALESCE(i.status, ''))",
          "LOWER(COALESCE(i.policy_sanction, ''))",
          "LOWER(COALESCE(i.action_taken, ''))",
          "LOWER(COALESCE(i.recommendation, ''))",
          "LOWER(COALESCE(i.description, ''))",
          "LOWER(COALESCE(i.reported_by, ''))",
        ];

    conditions.push(`(
      ${searchableColumns.map((column) => `${column} LIKE ?`).join(" OR\n      ")}
    )`);

    params.push(...searchableColumns.map(() => likeTerm));
  }

  return {
    whereClause:
      conditions.length
        ? `WHERE ${conditions.join(
            " AND "
          )}`
        : "",

    params,
  };
}

exports.getIncidentReport =
  async (
    req,
    res
  ) => {
    try {
      const role =
        normalizeRole(
          req?.user?.role
        );

      const isHrCoordinator =
        role ===
        "HR_COORDINATOR";

      const coordinatorCompany =
        isHrCoordinator
          ? getHrCoordinatorAssignedCompany(
              req
            )
          : null;

      if (
        isHrCoordinator &&
        !coordinatorCompany
      ) {
        return res
          .status(403)
          .json({
            error:
              "HR Coordinator company assignment is required.",
          });
      }

      const {
        whereClause,
        params,
      } =
        buildIncidentSummaryFilters(
          req.query || {},
          {
            coordinatorCompany,
          }
        );

      const [incidents] =
        await db
          .promise()
          .query(
            `
            SELECT
              i.id,
              i.employee_id,
              i.employee_name,
              i.company,
              i.violation_type,
              i.severity,
              i.status,
              i.incident_date,
              i.location,
              i.description,
              i.reported_by,
              i.action_taken,
              i.policy_sanction,
              i.recommendation,
              i.resolution_notes,
              i.investigation_started_by_id,
              i.investigation_started_by_username,
              i.investigation_started_by_name,
              i.investigation_started_at,
              i.resolution_submitted_by_id,
              i.resolution_submitted_by_username,
              i.resolution_submitted_by_name,
              i.resolution_submitted_at,
              i.reviewed_by_id,
              i.reviewed_by_username,
              i.reviewed_by_name,
              i.reviewed_at,
              i.review_decision,
              i.review_comments,
              i.created_at,
              i.updated_at,
              i.last_action_by_id,
              i.last_action_by_username,
              i.last_action_by_name,
              i.last_action_type,
              i.last_action_at,
              ${getCreateIncidentActorSelect("i")},
              e.name AS employeeNameFromEmployee,
              e.company AS employeeCompany,
              e.status AS employeeStatus,
              ${
                isHrCoordinator
                  ? `CASE WHEN
                      ${buildCurrentCoordinatorEmployeeScopeCondition("e")}
                     THEN 1 ELSE 0 END`
                  : "1"
              } AS coordinatorCanViewDetails
            FROM incidents i
            LEFT JOIN employees e
              ON e.id = i.employee_id
            ${whereClause}
            ORDER BY
              i.created_at DESC,
              i.id DESC
            `,
            [
              ...(isHrCoordinator
                ? [coordinatorCompany]
                : []),
              ...params,
            ]
          );

      const reportIncidents =
        incidents.map(
          (incident) => {
            if (
              isHrCoordinator &&
              Number(
                incident
                  .coordinatorCanViewDetails
              ) !== 1
            ) {
              return serializeHistoricalIncidentListItem(
                incident
              );
            }

            return serializeIncidentSummary(
              incident
            );
          }
        );

      return res.json({
        incidents:
          reportIncidents,

        total:
          reportIncidents.length,

        scope: {
          role,

          company:
            coordinatorCompany ||
            null,
        },

        filters: {
          month:
            normalizeIncidentFilterMonth(
              req.query?.month ||
              req.query?.incidentMonth ||
              req.query?.incident_month
            ),

          year:
            normalizeIncidentFilterYear(
              req.query?.year ||
              req.query?.incidentYear ||
              req.query?.incident_year
            ),
        },
      });
    } catch (error) {
      console.error(
        "GET INCIDENT REPORT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to generate incident report data.",
        });
    }
  };

exports.getIncidents =
  async (
    req,
    res
  ) => {
    try {
      const isHrCoordinator =
        isHrCoordinatorRequest(
          req
        );

      const coordinatorCompany =
        isHrCoordinator
          ? getHrCoordinatorAssignedCompany(
              req
            )
          : null;

      if (
        isHrCoordinator &&
        !coordinatorCompany
      ) {
        return res
          .status(403)
          .json({
            error:
              "HR Coordinator company assignment is required.",
          });
      }

      const view =
        String(
          req.query?.view ||
          ""
        )
          .trim()
          .toLowerCase();

      /*
       * ==================================================
       * PAGINATED INCIDENT SUMMARY
       * ==================================================
       *
       * The main Incident page uses this lightweight
       * endpoint.
       *
       * Search/filtering occurs on the server so
       * pagination never hides matching records that
       * exist outside the currently loaded page.
       *
       * Full Case Details and employee incident history
       * remain handled by their existing endpoints.
       */
      if (
        view ===
        "summary"
      ) {
        const requestedPage =
          toPositiveInteger(
            req.query?.page,
            1
          );

        const requestedPageSize =
          Math.min(
            toPositiveInteger(
              req.query?.pageSize ||
              req.query?.page_size,
              25
            ),
            100
          );

        const {
          whereClause,
          params,
        } =
          buildIncidentSummaryFilters(
            req.query || {},
            {
              coordinatorCompany,
            }
          );

        const [
          [countRows],
          [caseCountRows],
          [incidentYearRows],
        ] =
          await Promise.all([
            db
              .promise()
              .query(
                `
                SELECT
                  COUNT(*) AS total
                FROM incidents i
                LEFT JOIN employees e
                  ON e.id = i.employee_id
                ${whereClause}
                `,
                params
              ),

            /*
             * Tab counts intentionally describe the
             * complete incident collection, matching
             * the original page behavior before server
             * pagination was introduced.
             */
            db
              .promise()
              .query(
                `
                SELECT
                  COUNT(*) AS all_count,

                  SUM(
                    CASE
                      WHEN LOWER(
                        TRIM(
                          COALESCE(
                            i.status,
                            ''
                          )
                        )
                      ) IN (
                        'open',
                        'investigating'
                      )
                      THEN 1
                      ELSE 0
                    END
                  ) AS active_count,

                  SUM(
                    CASE
                      WHEN LOWER(
                        TRIM(
                          COALESCE(
                            i.status,
                            ''
                          )
                        )
                      ) IN (
                        'for review',
                        'for_review'
                      )
                      THEN 1
                      ELSE 0
                    END
                  ) AS for_review_count,

                  SUM(
                    CASE
                      WHEN LOWER(
                        TRIM(
                          COALESCE(
                            i.status,
                            ''
                          )
                        )
                      ) IN (
                        'closed',
                        'resolved'
                      )
                      THEN 1
                      ELSE 0
                    END
                  ) AS closed_count

                FROM incidents i
                ${
                  coordinatorCompany
                    ? `WHERE ${buildIncidentCompanyScopeCondition(
                        "i"
                      )}`
                    : ""
                }
                `,
                coordinatorCompany
                  ? [
                      coordinatorCompany,
                    ]
                  : []
              ),

            /*
             * Available Incident Years are scoped to
             * the authenticated user's visible incident
             * collection and are based on incident_date.
             *
             * They intentionally do not depend on the
             * current search / severity / violation /
             * month filters so the Year picker remains
             * stable while users refine a report.
             */
            db
              .promise()
              .query(
                `
                SELECT DISTINCT
                  YEAR(i.incident_date) AS incident_year
                FROM incidents i
                WHERE
                  i.incident_date IS NOT NULL
                  ${
                    coordinatorCompany
                      ? `AND ${buildIncidentCompanyScopeCondition(
                          "i"
                        )}`
                      : ""
                  }
                ORDER BY
                  incident_year DESC
                `,
                coordinatorCompany
                  ? [
                      coordinatorCompany,
                    ]
                  : []
              ),
          ]);

        const total =
          Number(
            countRows?.[0]
              ?.total ||
            0
          );

        const totalPages =
          total > 0
            ? Math.ceil(
                total /
                requestedPageSize
              )
            : 1;

        /*
         * Clamp an outdated page after filters/search
         * reduce the result set.
         */
        const page =
          Math.min(
            requestedPage,
            totalPages
          );

        const offset =
          (page - 1) *
          requestedPageSize;

        const [incidents] =
          await db
            .promise()
            .query(
              `
              SELECT
                i.id,
                i.employee_id,
                i.employee_name,
                i.company,
                i.violation_type,
                i.severity,
                i.status,
                i.incident_date,
                i.location,
                i.description,
                i.reported_by,
                i.action_taken,
                i.policy_sanction,
                i.recommendation,
                i.resolution_notes,
                i.investigation_started_by_id,
                i.investigation_started_by_username,
                i.investigation_started_by_name,
                i.investigation_started_at,
                i.resolution_submitted_by_id,
                i.resolution_submitted_by_username,
                i.resolution_submitted_by_name,
                i.resolution_submitted_at,
                i.reviewed_by_id,
                i.reviewed_by_username,
                i.reviewed_by_name,
                i.reviewed_at,
                i.review_decision,
                i.review_comments,
                i.created_at,
                i.updated_at,
                i.last_action_by_id,
                i.last_action_by_username,
                i.last_action_by_name,
                i.last_action_type,
                i.last_action_at,
                ${getCreateIncidentActorSelect("i")},
                e.name AS employeeNameFromEmployee,
                e.company AS employeeCompany,
                e.status AS employeeStatus,
                ${
                  isHrCoordinator
                    ? `CASE WHEN
                        ${buildCurrentCoordinatorEmployeeScopeCondition("e")}
                       THEN 1 ELSE 0 END`
                    : "1"
                } AS coordinatorCanViewDetails
              FROM incidents i
              LEFT JOIN employees e
                ON e.id = i.employee_id
              ${whereClause}
              ORDER BY
                i.created_at DESC,
                i.id DESC
              LIMIT ?
              OFFSET ?
              `,
              [
                ...(isHrCoordinator ? [coordinatorCompany] : []),
                ...params,
                requestedPageSize,
                offset,
              ]
            );

        const caseCounts =
          caseCountRows?.[0] ||
          {};

        return res.json({
          incidents: incidents.map((incident) => {
            if (
              isHrCoordinator &&
              Number(incident.coordinatorCanViewDetails) !== 1
            ) {
              return serializeHistoricalIncidentListItem(incident);
            }

            return serializeIncidentSummary(incident);
          }),

          pagination: {
            page,

            pageSize:
              requestedPageSize,

            total,

            totalPages,

            hasPreviousPage:
              page > 1,

            hasNextPage:
              page < totalPages,
          },

          caseCounts: {
            ALL:
              Number(
                caseCounts.all_count ||
                0
              ),

            ACTIVE:
              Number(
                caseCounts.active_count ||
                0
              ),

            FOR_REVIEW:
              Number(
                caseCounts.for_review_count ||
                0
              ),

            CLOSED:
              Number(
                caseCounts.closed_count ||
                0
              ),
          },

          filterMeta: {
            years:
              incidentYearRows
                .map(
                  (row) =>
                    Number(
                      row.incident_year
                    )
                )
                .filter(
                  Number.isInteger
                ),
          },
        });
      }

      /*
       * ==================================================
       * F-10 — LEGACY FULL-HISTORY ENDPOINT RETIRED
       * ==================================================
       *
       * The unbounded GET /api/incidents response used to
       * load every incident together with every evidence
       * row and timeline event in one request.
       *
       * Active frontend consumers now use purpose-specific
       * endpoints instead:
       *
       * - GET /api/incidents?view=summary
       *   Paginated incident report data.
       *
       * - GET /api/incidents/:id
       *   Full details for one incident.
       *
       * - GET /api/incidents/employee/:employeeId
       *   Full history for one employee.
       *
       * Rejecting the legacy fallback prevents accidental
       * system-wide full-history loads and also prevents an
       * unsupported view value from silently triggering the
       * expensive legacy query.
       */
      return res
        .status(400)
        .json({
          error:
            "Full incident collection requests are no longer supported.",

          code:
            "INCIDENT_FULL_HISTORY_RETIRED",

          message:
            "Use view=summary for paginated incident reports, the incident detail endpoint for one case, or the employee incident history endpoint for one employee.",
        });
    } catch (error) {
      console.error(
        "GET INCIDENTS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to fetch incidents",
        });
    }
  };

exports.getIncidentsByEmployee =
  async (
    req,
    res
  ) => {
    try {
      const {
        employeeId,
      } =
        req.params;

      const {
        name,
      } =
        req.query;

      const isHrCoordinator =
        isHrCoordinatorRequest(
          req
        );

      const isHrStaff =
        isHrStaffRequest(
          req
        );

      const coordinatorCompany =
        isHrCoordinator
          ? getHrCoordinatorAssignedCompany(
              req
            )
          : null;

      if (
        isHrCoordinator &&
        !coordinatorCompany
      ) {
        return res
          .status(403)
          .json({
            error:
              "HR Coordinator company assignment is required.",
          });
      }

      const lookupEmployeeId =
        normalizeEmployeeLookupId(
          employeeId
        );

      const employeeName =
        String(name || "")
          .trim()
          .toLowerCase();

      if (
        !lookupEmployeeId &&
        !employeeName
      ) {
        return res
          .status(400)
          .json({
            error:
              "Employee ID or employee name is required",
          });
      }

      const conditions =
        [];

      const params =
        [];

      if (
        lookupEmployeeId
      ) {
        conditions.push(
          "CAST(i.employee_id AS CHAR) = ?"
        );

        params.push(
          lookupEmployeeId
        );
      }

      if (employeeName) {
        conditions.push(
          "LOWER(TRIM(i.employee_name)) = ?"
        );

        params.push(
          employeeName
        );
      }

      const coordinatorScopeSql =
        coordinatorCompany
          ? `
            AND
            ${buildIncidentCompanyScopeCondition(
              "i"
            )}
            AND ${buildCurrentCoordinatorEmployeeScopeCondition("e")}
          `
          : "";

      const queryParams = [
        ...params,
        ...(coordinatorCompany
          ? [
              coordinatorCompany,
              coordinatorCompany,
            ]
          : []),
      ];

      const [incidents] =
        await db
          .promise()
          .query(
            `
            SELECT
              i.*,

              UNIX_TIMESTAMP(
                i.created_at
              ) * 1000 AS created_at_timestamp,

              UNIX_TIMESTAMP(
                i.updated_at
              ) * 1000 AS updated_at_timestamp,

              UNIX_TIMESTAMP(
                i.last_action_at
              ) * 1000 AS last_action_at_timestamp,

              UNIX_TIMESTAMP(
                i.investigation_started_at
              ) * 1000 AS investigation_started_at_timestamp,

              UNIX_TIMESTAMP(
                i.resolution_submitted_at
              ) * 1000 AS resolution_submitted_at_timestamp,

              UNIX_TIMESTAMP(
                i.reviewed_at
              ) * 1000 AS reviewed_at_timestamp,

              e.name AS employeeNameFromEmployee,
              e.company AS employeeCompany,
              e.status AS employeeStatus
            FROM incidents i
            LEFT JOIN employees e
              ON e.id = i.employee_id
            WHERE (
              ${conditions.join(
                " OR "
              )}
            )
            ${coordinatorScopeSql}
            ORDER BY
              i.incident_date ASC,
              i.created_at ASC,
              i.id ASC
            `,
            queryParams
          );

      if (
        !incidents.length
      ) {
        return res.json(
          []
        );
      }

      const incidentIds =
        incidents.map(
          (incident) =>
            incident.id
        );

      /*
       * ==================================================
       * HR STAFF EMPLOYEE-HISTORY BOUNDARY
       * ==================================================
       *
       * EmployeeModal only requires read-only textual
       * Incident fields such as violation, severity,
       * status, date, description, and prescribed sanction.
       *
       * For HR Staff:
       * - do not query incident_evidence
       * - do not query incident_timeline
       * - do not serialize investigator/reviewer workflow
       *   identities or protected attachment metadata
       *
       * This keeps Employee history available without
       * restoring Incident operational authority.
       */
      if (isHrStaff) {
        return res.json(
          incidents.map(
            serializeHrStaffEmployeeIncidentHistoryItem
          )
        );
      }

      const [
        [evidence],
        timelineMap,
      ] =
        await Promise.all([
          db
            .promise()
            .query(
              `
              SELECT *
              FROM incident_evidence
              WHERE incident_id IN (?)
              ORDER BY
                created_at DESC,
                id DESC
              `,
              [
                incidentIds,
              ]
            ),

          getTimelineByIncidentIds(
            incidentIds
          ),
        ]);

      const evidenceMap =
        evidence.reduce(
          (
            map,
            item
          ) => {
            const key =
              String(
                item.incident_id
              );

            if (
              !map.has(key)
            ) {
              map.set(
                key,
                []
              );
            }

            map
              .get(key)
              .push(
                item
              );

            return map;
          },
          new Map()
        );

      return res.json(
        incidents.map(
          (incident) => {
            const key =
              String(
                incident.id
              );

            return serializeIncident(
              incident,
              evidenceMap.get(
                key
              ) || [],
              timelineMap.get(
                key
              ) || []
            );
          }
        )
      );
    } catch (error) {
      console.error(
        "GET INCIDENTS BY EMPLOYEE ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to fetch employee incidents",
        });
    }
  };

exports.getIncidentById =
  async (
    req,
    res
  ) => {
    try {
      const isHrCoordinator =
        isHrCoordinatorRequest(
          req
        );

      const coordinatorCompany =
        isHrCoordinator
          ? getHrCoordinatorAssignedCompany(
              req
            )
          : null;

      if (
        isHrCoordinator &&
        !coordinatorCompany
      ) {
        return res
          .status(403)
          .json({
            error:
              "HR Coordinator company assignment is required.",
          });
      }

      const incident =
        await getIncidentWithEvidence(
          req.params.id,
          {
            coordinatorCompany,
          }
        );

      if (!incident) {
        return res
          .status(404)
          .json({
            error:
              "Incident not found",
          });
      }

      return res.json(
        incident
      );
    } catch (error) {
      console.error(
        "GET INCIDENT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to fetch incident",
        });
    }
  };

exports.createIncident =
  async (
    req,
    res
  ) => {
    let connection =
      null;

    let transactionStarted =
      false;

    let transactionCommitted =
      false;

    try {
      const {
        employeeId,
        employee_id,
        violation,
        violationType,
        violationSection,
        violationCategory,
        severity,

        /*
         * New canonical prescribed-sanction fields.
         *
         * sanction/actionTaken remain accepted below
         * only as compatibility aliases while the
         * frontend migration is completed.
         */
        policySanction,
        policy_sanction,
        sanction,
        actionTaken,

        date,
        incidentDate,
        location,
        description,
        recommendation,
        resolutionNotes,
      } =
        req.body ||
        {};

      const actor =
        await getActor(
          req
        );

      const finalEmployeeId =
        employeeId ||
        employee_id;

      if (
        !finalEmployeeId
      ) {
        return res
          .status(400)
          .json({
            error:
              "Employee is required.",
          });
      }

      /*
       * Throwing a controlled error after the
       * transaction begins lets the common catch block
       * roll back every locked/partially completed
       * operation before returning the validation
       * response.
       */
      const rejectIncidentCreation =
        (
          statusCode,
          message
        ) => {
          const error =
            new Error(
              message
            );

          error.name =
            "IncidentCreationRejection";

          error.statusCode =
            statusCode;

          error.isIncidentCreationRejection =
            true;

          throw error;
        };

      const submittedViolation =
        violationType ||
        violation;

      if (
        !submittedViolation
      ) {
        return res
          .status(400)
          .json({
            error:
              "Violation type is required.",
          });
      }

      /*
       * Compatibility order:
       *
       * 1. policySanction
       * 2. policy_sanction
       * 3. sanction
       * 4. actionTaken (legacy frontend create payload)
       *
       * This value is never trusted. It remains only
       * a consistency check against the authoritative
       * server calculation.
       */
      const submittedPolicySanction =
        policySanction ||
        policy_sanction ||
        sanction ||
        actionTaken;

      const finalDate =
        normalizeDate(
          incidentDate ||
          date
        );

      if (!finalDate) {
        return res
          .status(400)
          .json({
            error:
              "Incident date is required.",
          });
      }

      /*
       * DATA INTEGRITY:
       *
       * Reporter identity comes only from the verified
       * authenticated principal.
       *
       * Any reportedBy/user metadata supplied through
       * the request body is intentionally ignored.
       */
      const finalReportedBy =
        actor.fullName ||
        actor.username ||
        "Unknown User";

      const evidenceFiles =
        buildEvidenceFromReq(
          req
        );

      if (evidenceFiles.length > 10) {
        return res.status(400).json({
          error: "A maximum of 10 Incident Evidence files may be attached.",
        });
      }

      connection =
        await db
          .promise()
          .getConnection();

      await connection
        .beginTransaction();

      transactionStarted =
        true;

      /*
       * ==================================================
       * B-05 — TRANSACTIONAL DEPLOYMENT INTEGRITY
       * ==================================================
       *
       * Employee/deployment validation must happen
       * inside the same transaction that creates the
       * incident.
       *
       * The employee row is locked first. The active
       * assignment is then locked before incident
       * classification and insertion.
       *
       * Therefore deployment termination cannot change
       * this employee/site between authoritative
       * validation and incident insertion.
       */
      const employeeRecord =
        await lockEmployeeForClassification(
          connection,
          finalEmployeeId
        );

      if (
        Number(
          employeeRecord
            ?.archived ||
          0
        ) === 1
      ) {
        rejectIncidentCreation(
          409,
          "Incident cannot be created for an archived employee."
        );
      }

      if (
        !isDeployedEmployee(
          employeeRecord
        )
      ) {
        rejectIncidentCreation(
          400,
          "Incident cannot be created for floating or standby employees. Please select a deployed employee."
        );
      }

      const {
        assignment:
          activeDeployment,
        hasConflict:
          hasDeploymentConflict,
      } =
        await getActiveDeploymentForEmployee(
          finalEmployeeId,
          {
            connection,

            lockForUpdate:
              true,
          }
        );

      if (
        hasDeploymentConflict
      ) {
        rejectIncidentCreation(
          409,
          "Multiple active deployment assignments were found for the selected employee."
        );
      }

      if (
        !activeDeployment
      ) {
        rejectIncidentCreation(
          409,
          "The selected employee no longer has an active deployment assignment. Refresh the form and try again."
        );
      }

      /*
       * HR Coordinator may create an incident only
       * for an employee whose current active
       * deployment belongs to the coordinator's
       * assigned company.
       *
       * Company values supplied by the browser are
       * never authoritative.
       */
      if (
        actor.role ===
        "HR_COORDINATOR"
      ) {
        const coordinatorCompany =
          getHrCoordinatorAssignedCompany(
            req
          );

        if (!coordinatorCompany) {
          rejectIncidentCreation(
            403,
            "HR Coordinator company assignment is required."
          );
        }

        if (
          !companyNamesMatch(
            activeDeployment.company,
            coordinatorCompany
          )
        ) {
          /*
           * Use the same public response as an unknown
           * employee so cross-company employee IDs
           * cannot be enumerated.
           */
          rejectIncidentCreation(
            404,
            "Selected employee not found."
          );
        }
      }

      const finalEmployeeName =
        employeeRecord.name ||
        null;

      /*
       * Authoritative company/client source.
       *
       * Never trust company supplied by the browser.
       * The locked Active deployment assignment is the
       * source of truth.
       */
      const finalCompany =
        activeDeployment.company ||
        null;

      /*
       * Employee row is already locked above, so
       * classification/history is calculated under the
       * same employee serialization boundary.
       */
      const classification =
        await buildAuthoritativeIncidentClassification(
          {
            connection,

            employeeId:
              finalEmployeeId,

            violation:
              submittedViolation,

            violationSection:
              violationSection ||
              "",

            violationCategory:
              violationCategory ||
              "",

            description:
              description ||
              "",
          }
        );

      /*
       * Client values are consistency checks only.
       *
       * The server remains authoritative for:
       * - severity
       * - prescribed policy sanction
       */
      assertSubmittedSeverityMatches(
        severity,
        classification.severity
      );

      assertSubmittedSanctionMatches(
        submittedPolicySanction,
        classification.sanction
      );

      /*
       * IMPORTANT DATA MODEL:
       *
       * action_taken:
       *   Actual investigation action.
       *   Starts NULL at incident creation.
       *
       * policy_sanction:
       *   Prescribed sanction calculated from the
       *   server-wide violation policy.
       *   Stored once at creation and never changed
       *   by workflow transitions.
       */
      const [result] =
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
            policy_sanction,
            recommendation,
            resolution_notes,
            last_action_by_id,
            last_action_by_username,
            last_action_by_name,
            last_action_type,
            last_action_at
          )
          VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?,
            ?, NULL, ?, ?, ?, ?, ?, ?, ?, NOW()
          )
          `,
          [
            finalEmployeeId,
            finalEmployeeName,
            finalCompany,

            classification
              .violation,

            classification
              .severity,

            "Open",
            finalDate,

            location ||
              null,

            description ||
              null,

            finalReportedBy,

            classification
              .sanction ||
              null,

            recommendation ||
              null,

            resolutionNotes ||
              null,

            actor.userId,
            actor.username,
            actor.fullName,

            "CREATE_INCIDENT",
          ]
        );

      const incidentId =
        result.insertId;

      for (
        const file of
        evidenceFiles
      ) {
        await connection.query(
          `
          INSERT INTO incident_evidence
          (
            incident_id,
            file_name,
            file_path,
            evidence_purpose
          )
          VALUES (?, ?, ?, ?)
          `,
          [
            incidentId,
            file.fileName,
            file.filePath,
            EVIDENCE_PURPOSE.INITIAL_NTE,
          ]
        );
      }

      await addTimelineEvent({
        incidentId,

        actionType:
          "CREATE_INCIDENT",

        title:
          "Reported",

        description:
          `Reported by ${finalReportedBy}.`,

        actor,
        connection,
      });

      /*
       * Audit write is part of the same transaction.
       * If audit persistence fails, incident creation
       * also rolls back.
       */
      await logAudit(
        {
          userId:
            actor.userId,

          username:
            actor.username,

          fullName:
            actor.fullName,

          role:
            actor.role,

          category:
            AUDIT_CATEGORY
              .OPERATIONAL,

          action:
            "ADD_INCIDENT",

          description:
            `${actor.fullName} created incident record for ${finalEmployeeName}.`,
        },
        {
          connection,

          throwOnError:
            true,
        }
      );

      await connection
        .commit();

      transactionCommitted =
        true;

      claimIncidentEvidenceFiles(
        req
      );

      const createdIncident =
        await getIncidentWithEvidence(
          incidentId
        );

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "Incident created successfully",

          id:
            incidentId,

          incidentId,

          incident:
            createdIncident,
        });
    } catch (error) {
      let rollbackFailed =
        false;

      if (
        connection &&
        transactionStarted &&
        !transactionCommitted
      ) {
        try {
          await connection
            .rollback();

          transactionStarted =
            false;
        } catch (
          rollbackError
        ) {
          rollbackFailed =
            true;

          console.error(
            "CREATE INCIDENT ROLLBACK ERROR:",
            rollbackError
          );
        }
      }

      /*
       * If rollback itself fails, uploaded files cannot
       * safely be treated as unclaimed because the DB
       * outcome is uncertain.
       */
      if (
        rollbackFailed
      ) {
        claimIncidentEvidenceFiles(
          req
        );
      }

      if (
        error
          ?.isIncidentCreationRejection &&
        !rollbackFailed
      ) {
        return res
          .status(
            error.statusCode ||
            409
          )
          .json({
            error:
              error.message,
          });
      }

      if (
        error
          ?.isViolationPolicyError &&
        !rollbackFailed
      ) {
        return respondToViolationPolicyError(
          res,
          error
        );
      }

      console.error(
        "CREATE INCIDENT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to create incident",
        });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  };

function normalizeIdentity(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildActorAliases(
  actor
) {
  return new Set(
    [
      actor?.userId,
      actor?.username,
      actor?.fullName,
    ]
      .map(
        normalizeIdentity
      )
      .filter(
        Boolean
      )
  );
}

function hasActorMatch(
  actor,
  values = []
) {
  const aliases =
    buildActorAliases(
      actor
    );

  return values.some(
    (value) =>
      aliases.has(
        normalizeIdentity(
          value
        )
      )
  );
}

function getAssignedInvestigatorValues(
  incident
) {
  return [
    incident
      .investigation_started_by_id,

    incident
      .investigation_started_by_username,

    incident
      .investigation_started_by_name,

    incident.last_action_type ===
    WORKFLOW_ACTION.START
      ? incident
          .last_action_by_id
      : null,

    incident.last_action_type ===
    WORKFLOW_ACTION.START
      ? incident
          .last_action_by_username
      : null,

    incident.last_action_type ===
    WORKFLOW_ACTION.START
      ? incident
          .last_action_by_name
      : null,
  ].filter(Boolean);
}

exports.updateIncidentStatus =
  async (
    req,
    res
  ) => {
    let connection =
      null;

    let transactionStarted =
      false;

    let transactionCommitted =
      false;

    try {
          const {
        id,
      } =
        req.params;

      const {
        workflowAction,
        resolutionNotes,
        actionTaken,
        recommendation,
      } =
        req.body ||
        {};

      const actor =
        await getActor(
          req
        );

      const actionType =
        normalizeWorkflowAction(
          workflowAction
        );

      if (!actionType) {
        return res
          .status(400)
          .json({
            error:
              "Unsupported incident workflow action.",
          });
      }

      const normalizedStatus =
        getWorkflowTargetStatus(
          actionType
        );

      const evidenceFiles =
        buildEvidenceFromReq(
          req
        );

      const rejectLockedWorkflow =
        (
          statusCode,
          message
        ) => {
          const error =
            new Error(
              message
            );

          error.name =
            "IncidentWorkflowRejection";

          error.statusCode =
            statusCode;

          error.isWorkflowRejection =
            true;

          throw error;
        };

      connection =
        await db
          .promise()
          .getConnection();

      await connection
        .beginTransaction();

      transactionStarted =
        true;

      const [
        existingRows,
      ] =
        await connection.query(
          `
          SELECT
            i.*,
            ${getCreateIncidentActorSelect("i")}
          FROM incidents AS i
          WHERE i.id = ?
          LIMIT 1
          FOR UPDATE
          `,
          [
            id,
          ]
        );

      if (
        !existingRows.length
      ) {
        rejectLockedWorkflow(
          404,
          "Incident not found."
        );
      }

      const existingIncident =
        existingRows[0];

      const existingStatus =
        normalizeStatus(
          existingIncident
            .status
        );

      const cleanResolutionNotes =
        toNullable(
          resolutionNotes
        );

      const cleanActionTaken =
        toNullable(
          actionTaken
        );

      const cleanRecommendation =
        toNullable(
          recommendation
        );

      if (
        existingStatus ===
        "Closed"
      ) {
        rejectLockedWorkflow(
          409,
          "This case is already closed and can no longer be modified."
        );
      }

      if (
        actionType ===
        WORKFLOW_ACTION.START
      ) {
        const startPolicy =
          evaluateStartInvestigation({
            actor: {
              ...actor,
              assignedCompany:
                getHrCoordinatorAssignedCompany(
                  req
                ),
            },
            incident:
              existingIncident,
          });

        if (!startPolicy.allowed) {
          rejectLockedWorkflow(
            startPolicy.statusCode,
            startPolicy.message
          );
        }
      }

      const isProofSubmission =
        actionType ===
          WORKFLOW_ACTION
            .SUBMIT_RESOLUTION ||
        actionType ===
          WORKFLOW_ACTION
            .SUBMIT_INVESTIGATION;

      if (
        isProofSubmission &&
        evidenceFiles.length > 10
      ) {
        rejectLockedWorkflow(
          400,
          "A maximum of 10 proof files may be attached."
        );
      }

      if (
        isProofSubmission
      ) {
        const proofPolicy =
          evaluateProofSubmission({
            actor: {
              ...actor,
              assignedCompany:
                getHrCoordinatorAssignedCompany(
                  req
                ),
            },
            incident:
              existingIncident,
          });

        if (!proofPolicy.allowed) {
          rejectLockedWorkflow(
            proofPolicy.statusCode,
            proofPolicy.message
          );
        }

        if (
          !cleanActionTaken
        ) {
          rejectLockedWorkflow(
            400,
            "Action taken is required before submitting the case for review."
          );
        }

        if (
          !cleanResolutionNotes
        ) {
          rejectLockedWorkflow(
            400,
            "Resolution remarks are required before submitting the case for review."
          );
        }

        if (
          !evidenceFiles.length
        ) {
          rejectLockedWorkflow(
            400,
            "At least one valid proof file is required before submitting the case for review."
          );
        }
      }

      if (
        actionType ===
          WORKFLOW_ACTION.CLOSE ||
        actionType ===
          WORKFLOW_ACTION.RETURN
      ) {
        if (
          !isReviewerRole(
            actor.role
          )
        ) {
          rejectLockedWorkflow(
            403,
            "Only an HR Manager or Super Admin can review submitted incident cases."
          );
        }

        if (
          existingStatus !==
          "For Review"
        ) {
          rejectLockedWorkflow(
            409,
            "Only a case marked For Review can be approved or returned."
          );
        }

        const reviewPolicy =
          evaluateIndependentIncidentReview({
            reviewerUserId:
              actor.userId,

            investigationStartedById:
              existingIncident
                .investigation_started_by_id,

            resolutionSubmittedById:
              existingIncident
                .resolution_submitted_by_id,
          });

        if (!reviewPolicy.allowed) {
          rejectLockedWorkflow(
            reviewPolicy.statusCode,
            reviewPolicy.message
          );
        }

        if (
          actionType ===
            WORKFLOW_ACTION.RETURN &&
          !cleanResolutionNotes
        ) {
          rejectLockedWorkflow(
            400,
            "A return comment is required before sending the case back."
          );
        }
      }

      /*
       * ==================================================
       * WORKFLOW DATA INTEGRITY
       * ==================================================
       *
       * policy_sanction is intentionally absent from
       * every workflow UPDATE.
       *
       * It is immutable historical policy data.
       *
       * action_taken is written only when proof is
       * submitted/resubmitted by the assigned
       * investigator.
       *
       * Reviewer CLOSE / RETURN actions must never
       * overwrite the investigator's action_taken.
       */
      const updateFields =
        [
          "status = ?",

          "resolution_notes = COALESCE(?, resolution_notes)",

          "recommendation = COALESCE(?, recommendation)",

          "last_action_by_id = ?",

          "last_action_by_username = ?",

          "last_action_by_name = ?",

          "last_action_type = ?",

          "last_action_at = NOW()",

          "updated_at = NOW()",
        ];

      const params =
        [
          normalizedStatus,

          cleanResolutionNotes,

          cleanRecommendation,

          actor.userId,

          actor.username,

          actor.fullName,

          actionType,
        ];

      if (
        actionType ===
        WORKFLOW_ACTION.START
      ) {
        updateFields.push(
          "investigation_started_by_id = ?",
          "investigation_started_by_username = ?",
          "investigation_started_by_name = ?",
          "investigation_started_at = NOW()",
          "reviewed_by_id = NULL",
          "reviewed_by_username = NULL",
          "reviewed_by_name = NULL",
          "reviewed_at = NULL",
          "review_decision = NULL",
          "review_comments = NULL"
        );

        params.push(
          actor.userId,
          actor.username,
          actor.fullName
        );
      }

      if (
        isProofSubmission
      ) {
        updateFields.push(
          /*
           * Actual action taken is captured only here.
           */
          "action_taken = ?",

          "resolution_submitted_by_id = ?",

          "resolution_submitted_by_username = ?",

          "resolution_submitted_by_name = ?",

          "resolution_submitted_at = NOW()",

          "reviewed_by_id = NULL",

          "reviewed_by_username = NULL",

          "reviewed_by_name = NULL",

          "reviewed_at = NULL",

          "review_decision = NULL",

          "review_comments = NULL"
        );

        params.push(
          cleanActionTaken,

          actor.userId,

          actor.username,

          actor.fullName
        );
      }

      if (
        actionType ===
        WORKFLOW_ACTION.CLOSE
      ) {
        updateFields.push(
          "reviewed_by_id = ?",
          "reviewed_by_username = ?",
          "reviewed_by_name = ?",
          "reviewed_at = NOW()",
          "review_decision = ?",
          "review_comments = ?"
        );

        params.push(
          actor.userId,
          actor.username,
          actor.fullName,
          "Approved",

          cleanResolutionNotes ||
            "Proof reviewed and approved."
        );
      }

      if (
        actionType ===
        WORKFLOW_ACTION.RETURN
      ) {
        updateFields.push(
          "reviewed_by_id = ?",
          "reviewed_by_username = ?",
          "reviewed_by_name = ?",
          "reviewed_at = NOW()",
          "review_decision = ?",
          "review_comments = ?"
        );

        params.push(
          actor.userId,
          actor.username,
          actor.fullName,
          "Returned",
          cleanResolutionNotes
        );
      }

      params.push(
        id
      );

      const [updateResult] =
        await connection.query(
        `
        UPDATE incidents
        SET ${updateFields.join(
          ", "
        )}
        WHERE id = ?
          ${
            actionType ===
            WORKFLOW_ACTION.START
              ? "AND LOWER(TRIM(COALESCE(status, ''))) = 'open' AND investigation_started_at IS NULL"
              : ""
          }
        `,
        params
      );

      if (
        actionType ===
          WORKFLOW_ACTION.START &&
        Number(
          updateResult?.affectedRows ||
          0
        ) !== 1
      ) {
        rejectLockedWorkflow(
          409,
          "Another authorized investigator has already started this investigation."
        );
      }

      if (
        isProofSubmission
      ) {
        for (
          const file of
          evidenceFiles
        ) {
          await connection.query(
            `
            INSERT INTO incident_evidence
            (
              incident_id,
              file_name,
              file_path,
              evidence_purpose
            )
            VALUES (?, ?, ?, ?)
            `,
            [
              id,
              file.fileName,
              file.filePath,
              EVIDENCE_PURPOSE.RESOLUTION_PROOF,
            ]
          );
        }
      }

      await addTimelineEvent({
        incidentId:
          id,

        actionType,

        title:
          getTimelineTitle(
            actionType,
            existingIncident
          ),

        description:
          getTimelineDescription(
            actionType,
            actor,
            {
              comments:
                cleanResolutionNotes,
            }
          ),

        actor,
        connection,
      });

      await logAudit(
        {
          userId:
            actor.userId,

          username:
            actor.username,

          fullName:
            actor.fullName,

          role:
            actor.role,

          category:
            AUDIT_CATEGORY
              .OPERATIONAL,

          action:
            actionType,

          description:
            `${actor.fullName} updated incident #${id} to ${normalizedStatus}.`,
        },
        {
          connection,

          throwOnError:
            true,
        }
      );

      await connection
        .commit();

      transactionCommitted =
        true;

      claimIncidentEvidenceFiles(
        req
      );

      const updatedIncident =
        await getIncidentWithEvidence(
          id
        );

      return res.json({
        success:
          true,

        message:
          "Incident status updated successfully",

        incident:
          updatedIncident,
      });
    } catch (error) {
      let rollbackFailed =
        false;

      if (
        connection &&
        transactionStarted &&
        !transactionCommitted
      ) {
        try {
          await connection
            .rollback();

          transactionStarted =
            false;
        } catch (
          rollbackError
        ) {
          rollbackFailed =
            true;

          console.error(
            "UPDATE INCIDENT STATUS ROLLBACK ERROR:",
            rollbackError
          );
        }
      }

      if (
        rollbackFailed
      ) {
        claimIncidentEvidenceFiles(
          req
        );
      }

      if (
        error
          ?.isWorkflowRejection &&
        !rollbackFailed
      ) {
        return res
          .status(
            error.statusCode
          )
          .json({
            error:
              error.message,
          });
      }

      console.error(
        "UPDATE INCIDENT STATUS ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to update incident status",
        });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  };

exports.deleteIncident =
  async (
    req,
    res
  ) => {
    const {
      id,
    } =
      req.params;

    let connection =
      null;

    let transactionStarted =
      false;

    let transactionCommitted =
      false;

    const historicalFileCandidates =
      [];

    try {
      /*
       * Actor is always derived from req.user.
       * Request-body identity is never trusted.
       */
      const actor =
        await getActor(
          req
        );

      connection =
        await db
          .promise()
          .getConnection();

      await connection
        .beginTransaction();

      transactionStarted =
        true;

      /*
       * Lock the exact record being permanently
       * deleted and retain enough authoritative data
       * for its audit description.
       */
      const [
        incidentRows,
      ] =
        await connection.query(
          `
          SELECT
            id,
            employee_id,
            employee_name,
            company,
            violation_type,
            incident_date
          FROM incidents
          WHERE id = ?
          LIMIT 1
          FOR UPDATE
          `,
          [
            id,
          ]
        );

      if (
        !incidentRows.length
      ) {
        await connection
          .rollback();

        transactionStarted =
          false;

        return res
          .status(404)
          .json({
            error:
              "Incident not found.",
          });
      }

      const incidentRecord =
        incidentRows[0];

      /*
       * Evidence paths are collected before the
       * relational delete.
       *
       * Actual filesystem cleanup intentionally occurs
       * only after the DB transaction commits.
       */
      const [
        evidenceRows,
      ] =
        await connection.query(
          `
          SELECT file_path
          FROM incident_evidence
          WHERE incident_id = ?
            AND file_path IS NOT NULL
            AND TRIM(file_path) <> ''
          `,
          [
            id,
          ]
        );

      for (
        const row of
        evidenceRows
      ) {
        historicalFileCandidates.push(
          row.file_path
        );
      }

      await connection.query(
        `
        DELETE FROM incidents
        WHERE id = ?
        `,
        [
          id,
        ]
      );

      const employeeLabel =
        incidentRecord
          .employee_name ||
        `Employee #${
          incidentRecord
            .employee_id ||
          "Unknown"
        }`;

      /*
       * ==================================================
       * F-04 — TRANSACTIONAL PERMANENT DELETE AUDIT
       * ==================================================
       *
       * Audit and destructive deletion succeed or fail
       * together.
       *
       * throwOnError is required so an audit failure
       * aborts and rolls back the delete.
       */
      await logAudit(
        {
          userId:
            actor.userId,

          username:
            actor.username,

          fullName:
            actor.fullName,

          role:
            actor.role,

          category:
            AUDIT_CATEGORY
              .OPERATIONAL,

          action:
            "DELETE_INCIDENT",

          description:
            `${actor.fullName} permanently deleted incident #${id} for ${employeeLabel}${
              incidentRecord
                .violation_type
                ? ` (${incidentRecord.violation_type})`
                : ""
            }.`,
        },
        {
          connection,

          throwOnError:
            true,
        }
      );

      await connection
        .commit();

      transactionCommitted =
        true;

      /*
       * Release DB resources before potentially slow
       * filesystem cleanup.
       */
      connection.release();

      connection =
        null;

      /*
       * Physical cleanup is intentionally outside the
       * transaction. Database/audit integrity has
       * already been established at this point.
       */
      await cleanupHistoricalFileCandidates(
        historicalFileCandidates,
        "incident_delete"
      );

      return res.json({
        success:
          true,

        message:
          "Incident deleted successfully",
      });
    } catch (error) {
      if (
        connection &&
        transactionStarted &&
        !transactionCommitted
      ) {
        try {
          await connection
            .rollback();

          transactionStarted =
            false;
        } catch (
          rollbackError
        ) {
          console.error(
            "DELETE INCIDENT ROLLBACK ERROR:",
            rollbackError
          );
        }
      }

      console.error(
        "DELETE INCIDENT ERROR:",
        error
      );

      return res
        .status(500)
        .json({
          error:
            "Failed to delete incident",
        });
    } finally {
      if (connection) {
        connection.release();
      }
    }
  };