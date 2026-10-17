const db = require("../config/db");

const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

/*
 * ================================================================
 * WELLJOB HRIS
 * Deployment Attempt Workflow Controller
 * ================================================================
 *
 * New workflow:
 *
 * HR Staff
 *   Floating / Standby (Pooling)
 *     -> already has designated company + position
 *     -> For Deployment
 *     -> Withdrawn
 *
 * HR Coordinator
 *   For Deployment
 *     -> Deployed
 *     -> No Show
 *
 * IMPORTANT:
 * - employees.company + employees.position = current/designated placement
 * - deployment_attempts = scheduling / arrival-confirmation snapshot
 * - deployment_assignments = ACTUAL deployment history only
 * - an Active deployment_assignment is created ONLY after
 *   HR Coordinator confirms that the employee actually arrived
 * - No Show and Withdrawn never create deployment_assignments rows
 *
 * Legacy compatibility:
 * - employees.status remains temporarily synchronized with the
 *   current workforce state used by older screens/controllers
 * - deployment_assignments.status keeps its existing legacy
 *   Active / Completed / Cancelled contract
 * ================================================================
 */

const ATTEMPT_STATUS = Object.freeze({
  FOR_DEPLOYMENT: "For Deployment",
  DEPLOYED: "Deployed",
  NO_SHOW: "No Show",
  WITHDRAWN: "Withdrawn",
});

const WORKFORCE_STATUS = Object.freeze({
  FLOATING: "Floating / Standby",
  FOR_DEPLOYMENT: "For Deployment",
  DEPLOYED: "Deployed",
});

const EMPLOYMENT_STATUS = Object.freeze({
  ACTIVE: "Active",
});

const SOURCE_EVENT = Object.freeze({
  SCHEDULED: "DEPLOYMENT_ATTEMPT_CREATED",
  ARRIVAL_CONFIRMED: "DEPLOYMENT_ARRIVAL_CONFIRMED",
  NO_SHOW: "DEPLOYMENT_NO_SHOW",
  WITHDRAWN: "DEPLOYMENT_ATTEMPT_WITHDRAWN",
});

const MOVEMENT_TYPE = Object.freeze({
  SCHEDULED:
    "Scheduled for Deployment",
  DEPLOYED:
    "Successfully Deployed",
  NO_SHOW:
    "No Show",
  WITHDRAWN:
    "Withdrawn",
  RESIGNED:
    "Resigned",
  TERMINATED:
    "Terminated",
  AWOL:
    "AWOL",
  OTHER_SEPARATION:
    "Other Separation",
});

const MOVEMENT_REPORT_ROLES =
  new Set([
    "SUPER_ADMIN",
    "HR_MANAGER",
    "HR_STAFF",
    "HR_COORDINATOR",
  ]);

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeComparable(value) {
  return normalizeText(value)
    .toLowerCase();
}

function normalizeRole(value) {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function parsePositiveInteger(value) {
  const normalized =
    typeof value === "number"
      ? value
      : Number(
          String(value ?? "").trim()
        );

  if (
    !Number.isSafeInteger(normalized) ||
    normalized <= 0
  ) {
    return null;
  }

  return normalized;
}

function isTruthyDatabaseFlag(value) {
  return (
    value === true ||
    Number(value) === 1
  );
}

function isStrictDateString(value) {
  const normalized =
    normalizeText(value);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      normalized
    )
  ) {
    return false;
  }

  const [
    year,
    month,
    day,
  ] = normalized
    .split("-")
    .map(Number);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() === day
  );
}

function isStrictTimeString(value) {
  const normalized =
    normalizeText(value);

  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(
    normalized
  );
}

function normalizeScheduledTime(value) {
  const normalized =
    normalizeText(value);

  if (
    !isStrictTimeString(
      normalized
    )
  ) {
    return null;
  }

  return normalized.length === 5
    ? `${normalized}:00`
    : normalized;
}

function getPhilippinesCurrentDateTime() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Manila",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
        hour:
          "2-digit",
        minute:
          "2-digit",
        second:
          "2-digit",
        hourCycle:
          "h23",
      }
    ).formatToParts(
      new Date()
    );

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            [
              "year",
              "month",
              "day",
              "hour",
              "minute",
              "second",
            ].includes(
              part.type
            )
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );

  if (
    !values.year ||
    !values.month ||
    !values.day ||
    !values.hour ||
    !values.minute ||
    !values.second
  ) {
    throw new Error(
      "Unable to determine the current Philippine date and time."
    );
  }

  return {
    date:
      `${values.year}-` +
      `${values.month}-` +
      `${values.day}`,

    time:
      `${values.hour}:` +
      `${values.minute}:` +
      `${values.second}`,
  };
}

function getPhilippinesToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          "Asia/Manila",
        year:
          "numeric",
        month:
          "2-digit",
        day:
          "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  const values =
    Object.fromEntries(
      parts
        .filter(
          (part) =>
            [
              "year",
              "month",
              "day",
            ].includes(
              part.type
            )
        )
        .map(
          (part) => [
            part.type,
            part.value,
          ]
        )
    );

  if (
    !values.year ||
    !values.month ||
    !values.day
  ) {
    throw new Error(
      "Unable to determine the current Philippine date."
    );
  }

  return (
    `${values.year}-` +
    `${values.month}-` +
    `${values.day}`
  );
}

function getActor(req) {
  const user =
    req?.user || {};

  const id =
    parsePositiveInteger(
      user.id ??
      user.userId
    );

  return {
    id,

    userId:
      normalizeText(
        user.user_id ??
        user.businessUserId ??
        user.userId ??
        user.id
      ) || null,

    username:
      normalizeText(
        user.username
      ) || null,

    fullName:
      normalizeText(
        user.full_name ??
        user.fullName ??
        user.name
      ) || null,

    role:
      normalizeRole(
        user.role
      ),

    assignedCompany:
      normalizeText(
        user.assigned_company ??
        user.assignedCompany
      ),
  };
}

function sendRoleDenied(
  res,
  message =
    "You are not authorized to perform this deployment action."
) {
  return res
    .status(403)
    .json({
      success: false,
      error: message,
    });
}

function sendNotFound(
  res,
  message
) {
  return res
    .status(404)
    .json({
      success: false,
      error: message,
    });
}

function sendConflict(
  res,
  message
) {
  return res
    .status(409)
    .json({
      success: false,
      error: message,
    });
}

function sendBadRequest(
  res,
  message
) {
  return res
    .status(400)
    .json({
      success: false,
      error: message,
    });
}

async function safeRollback(
  connection
) {
  if (!connection) {
    return;
  }

  try {
    await connection.rollback();
  } catch (rollbackError) {
    console.error(
      "Deployment attempt rollback failed:",
      rollbackError
    );
  }
}

async function releaseConnection(
  connection
) {
  if (!connection) {
    return;
  }

  try {
    connection.release();
  } catch (releaseError) {
    console.error(
      "Deployment attempt connection release failed:",
      releaseError
    );
  }
}

async function writeOperationalAudit({
  actor,
  action,
  description,
}) {
  try {
    await logAudit({
      userId:
        actor.userId,

      username:
        actor.username,

      fullName:
        actor.fullName,

      role:
        actor.role,

      category:
        AUDIT_CATEGORY.OPERATIONAL,

      action,
      description,
    });
  } catch (auditError) {
    /*
     * Existing employee/deployment operational flows audit after
     * the business transaction commits. Preserve that behavior:
     * the completed workforce transition must not be reported as
     * failed merely because the secondary audit write encountered
     * an infrastructure error.
     */
    console.error(
      "Deployment attempt audit logging failed:",
      auditError
    );
  }
}

async function validateActiveCompanyAndPosition(
  connection,
  company,
  position
) {
  const [companyRows] =
    await connection.query(
      `
      SELECT
        id,
        company_name
      FROM client_companies
      WHERE is_active = 1
        AND LOWER(
          TRIM(company_name)
        ) = LOWER(
          TRIM(?)
        )
      LIMIT 2
      `,
      [
        company,
      ]
    );

  if (
    companyRows.length !== 1
  ) {
    return {
      ok: false,
      status: 400,
      message:
        "Select an active client company.",
    };
  }

  const canonicalCompany =
    normalizeText(
      companyRows[0].company_name
    );

  if (!position) {
    return {
      ok: true,
      company:
        canonicalCompany,
      position: null,
    };
  }

  const [positionRows] =
    await connection.query(
      `
      SELECT
        position_name
      FROM company_positions
      WHERE company_id = ?
        AND is_active = 1
        AND LOWER(
          TRIM(position_name)
        ) = LOWER(
          TRIM(?)
        )
      LIMIT 2
      `,
      [
        companyRows[0].id,
        position,
      ]
    );

  if (
    positionRows.length !== 1
  ) {
    return {
      ok: false,
      status: 400,
      message:
        "Select an active position for the chosen client company.",
    };
  }

  return {
    ok: true,
    company:
      canonicalCompany,
    position:
      normalizeText(
        positionRows[0].position_name
      ),
  };
}

async function getLockedEmployee(
  connection,
  employeeId
) {
  const [rows] =
    await connection.query(
      `
      SELECT
        id,
        name,
        company,
        position,
        status,
        employment_status,
        workforce_status,
        archived,
        \`contractStart\`,
        \`contractEnd\`,
        \`contractEndReason\`,
        \`contractEndRemarks\`,
        \`contractEndedAt\`
      FROM employees
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [
        employeeId,
      ]
    );

  return rows[0] || null;
}

async function getLockedAttempt(
  connection,
  attemptId
) {
  const [rows] =
    await connection.query(
      `
      SELECT
        id,
        employee_id,
        company,
        position,
        scheduled_date,
        scheduled_time,
        actual_arrival_date,
        status,
        outcome_reason,
        remarks,
        resolved_at,
        created_by_user_id,
        resolved_by_user_id,
        deployment_assignment_id,
        created_at,
        updated_at
      FROM deployment_attempts
      WHERE id = ?
      LIMIT 1
      FOR UPDATE
      `,
      [
        attemptId,
      ]
    );

  return rows[0] || null;
}

async function lockEmployeeThenAttempt(
  connection,
  attemptId
) {
  /*
   * Resolve employee_id first without a row lock, then acquire locks
   * in employee -> attempt order. Schedule creation also locks the
   * employee first, so this consistent order reduces deadlock risk.
   */
  const [referenceRows] =
    await connection.query(
      `
      SELECT
        employee_id
      FROM deployment_attempts
      WHERE id = ?
      LIMIT 1
      `,
      [
        attemptId,
      ]
    );

  if (
    referenceRows.length !== 1
  ) {
    return {
      employee: null,
      attempt: null,
    };
  }

  const employeeId =
    Number(
      referenceRows[0].employee_id
    );

  const employee =
    await getLockedEmployee(
      connection,
      employeeId
    );

  if (!employee) {
    return {
      employee: null,
      attempt: null,
    };
  }

  const attempt =
    await getLockedAttempt(
      connection,
      attemptId
    );

  if (
    !attempt ||
    Number(
      attempt.employee_id
    ) !== employeeId
  ) {
    return {
      employee: null,
      attempt: null,
    };
  }

  return {
    employee,
    attempt,
  };
}

async function hasActiveDeployment(
  connection,
  employeeId
) {
  const [rows] =
    await connection.query(
      `
      SELECT
        id
      FROM deployment_assignments
      WHERE employee_id = ?
        AND status = 'Active'
      ORDER BY id ASC
      LIMIT 2
      FOR UPDATE
      `,
      [
        employeeId,
      ]
    );

  return rows;
}

async function insertWorkforceHistory(
  connection,
  {
    employeeId,
    fromStatus,
    toStatus,
    reason,
    remarks,
    sourceEvent,
    changedByUserId,
    effectiveAtSql =
      "UTC_TIMESTAMP()",
  }
) {
  const safeReason =
    normalizeText(
      reason
    ) || null;

  const safeRemarks =
    normalizeText(
      remarks
    ) || null;

  const sql = `
    INSERT INTO employee_status_history (
      employee_id,
      from_status,
      to_status,
      effective_at,
      reason,
      remarks,
      source_event,
      changed_by_user_id
    )
    VALUES (
      ?,
      ?,
      ?,
      ${effectiveAtSql},
      ?,
      ?,
      ?,
      ?
    )
  `;

  await connection.query(
    sql,
    [
      employeeId,
      normalizeText(
        fromStatus
      ) || null,
      toStatus,
      safeReason,
      safeRemarks,
      sourceEvent,
      changedByUserId,
    ]
  );
}

function validateEmployeeForAttempt(
  employee
) {
  if (!employee) {
    return {
      ok: false,
      status: 404,
      message:
        "Employee not found.",
    };
  }

  if (
    isTruthyDatabaseFlag(
      employee.archived
    )
  ) {
    return {
      ok: false,
      status: 409,
      message:
        "Archived employees cannot be scheduled for deployment.",
    };
  }

  if (
    employee.employment_status !==
    EMPLOYMENT_STATUS.ACTIVE
  ) {
    return {
      ok: false,
      status: 409,
      message:
        "Only actively employed workers can be scheduled for deployment.",
    };
  }

  if (
    employee.workforce_status !==
    WORKFORCE_STATUS.FLOATING
  ) {
    return {
      ok: false,
      status: 409,
      message:
        "Only Floating / Standby employees can be scheduled for deployment.",
    };
  }

  return {
    ok: true,
  };
}

function validateAttemptResolutionState({
  employee,
  attempt,
}) {
  if (!employee) {
    return {
      ok: false,
      status: 404,
      message:
        "Employee record is unavailable.",
    };
  }

  if (!attempt) {
    return {
      ok: false,
      status: 404,
      message:
        "Deployment attempt not found.",
    };
  }

  if (
    isTruthyDatabaseFlag(
      employee.archived
    )
  ) {
    return {
      ok: false,
      status: 409,
      message:
        "Archived employees cannot complete deployment arrival actions.",
    };
  }

  if (
    employee.employment_status !==
    EMPLOYMENT_STATUS.ACTIVE
  ) {
    return {
      ok: false,
      status: 409,
      message:
        "The employee is no longer actively employed.",
    };
  }

  if (
    attempt.status !==
    ATTEMPT_STATUS.FOR_DEPLOYMENT
  ) {
    return {
      ok: false,
      status: 409,
      message:
        "This deployment attempt is no longer awaiting arrival.",
    };
  }

  if (
    employee.workforce_status !==
    WORKFORCE_STATUS.FOR_DEPLOYMENT
  ) {
    return {
      ok: false,
      status: 409,
      message:
        "The employee workforce status changed before this deployment attempt could be resolved.",
    };
  }

  return {
    ok: true,
  };
}

function coordinatorCanActOnAttempt(
  actor,
  attempt
) {
  if (
    actor.role !==
    "HR_COORDINATOR"
  ) {
    return false;
  }

  if (
    !actor.assignedCompany
  ) {
    return false;
  }

  return (
    normalizeComparable(
      actor.assignedCompany
    ) ===
    normalizeComparable(
      attempt.company
    )
  );
}

function getRequestAttemptId(
  req
) {
  return parsePositiveInteger(
    req?.params?.attemptId
  );
}

function getRequestEmployeeId(
  req
) {
  return parsePositiveInteger(
    req?.params?.employeeId ??
    req?.body?.employeeId
  );
}

function normalizeMovementReportMonth(
  value
) {
  const normalized =
    normalizeText(
      value
    );

  if (
    !normalized ||
    normalized.toUpperCase() ===
      "ALL"
  ) {
    return {
      ok: true,
      value: null,
    };
  }

  const parsed =
    Number.parseInt(
      normalized,
      10
    );

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed < 0 ||
    parsed > 11
  ) {
    return {
      ok: false,
      value: null,
    };
  }

  return {
    ok: true,
    value: parsed,
  };
}

function normalizeMovementReportYear(
  value
) {
  const normalized =
    normalizeText(
      value
    );

  if (!normalized) {
    return {
      ok: true,
      value:
        Number(
          getPhilippinesToday()
            .slice(
              0,
              4
            )
        ),
    };
  }

  const parsed =
    Number.parseInt(
      normalized,
      10
    );

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed < 1900 ||
    parsed > 9999
  ) {
    return {
      ok: false,
      value: null,
    };
  }

  return {
    ok: true,
    value: parsed,
  };
}

function formatSqlDate(
  year,
  month,
  day = 1
) {
  return [
    String(
      year
    ).padStart(
      4,
      "0"
    ),
    String(
      month
    ).padStart(
      2,
      "0"
    ),
    String(
      day
    ).padStart(
      2,
      "0"
    ),
  ].join("-");
}

function buildMovementReportPeriod(
  year,
  month
) {
  if (
    month ===
    null
  ) {
    return {
      start:
        formatSqlDate(
          year,
          1,
          1
        ),

      endExclusive:
        formatSqlDate(
          year + 1,
          1,
          1
        ),

      label:
        `All Months ${year}`,
    };
  }

  const monthNumber =
    month + 1;

  const nextYear =
    monthNumber === 12
      ? year + 1
      : year;

  const nextMonth =
    monthNumber === 12
      ? 1
      : monthNumber + 1;

  const monthLabel =
    new Intl.DateTimeFormat(
      "en-US",
      {
        month:
          "long",
        timeZone:
          "UTC",
      }
    ).format(
      new Date(
        Date.UTC(
          year,
          month,
          1
        )
      )
    );

  return {
    start:
      formatSqlDate(
        year,
        monthNumber,
        1
      ),

    endExclusive:
      formatSqlDate(
        nextYear,
        nextMonth,
        1
      ),

    label:
      `${monthLabel} ${year}`,
  };
}

function isDateInsideMovementPeriod(
  value,
  period
) {
  const normalized =
    normalizeText(
      value
    ).slice(
      0,
      10
    );

  if (
    !isStrictDateString(
      normalized
    )
  ) {
    return false;
  }

  return (
    normalized >=
      period.start &&
    normalized <
      period.endExclusive
  );
}

function normalizeMovementSeparationType(
  status,
  endReason,
  endRemarks
) {
  const normalizedReason =
    normalizeComparable(
      endReason
    );

  if (
    normalizedReason ===
    "resigned"
  ) {
    return MOVEMENT_TYPE.RESIGNED;
  }

  if (
    normalizedReason ===
    "terminated"
  ) {
    return MOVEMENT_TYPE.TERMINATED;
  }

  if (
    normalizedReason ===
    "awol"
  ) {
    return MOVEMENT_TYPE.AWOL;
  }

  const normalizedStatus =
    normalizeComparable(
      status
    );

  const remarks =
    normalizeText(
      endRemarks
    );

  if (
    remarks.startsWith(
      "[Other Separation]"
    ) ||
    [
      "cancelled",
      "canceled",
      "separated",
      "ended",
    ].includes(
      normalizedStatus
    )
  ) {
    return MOVEMENT_TYPE.OTHER_SEPARATION;
  }

  /*
   * Completed-contract / pulled-out / reassignment
   * records are intentionally not classified as
   * movement-report categories because the current
   * Welljob reporting design does not use a
   * user-facing "Completed" category.
   */
  return null;
}

function createMovementSummaryBucket() {
  return {
    totalEvents:
      0,

    scheduled:
      0,

    successfullyDeployed:
      0,

    noShow:
      0,

    withdrawn:
      0,

    resigned:
      0,

    terminated:
      0,

    awol:
      0,

    otherSeparation:
      0,
  };
}

function addMovementToBucket(
  bucket,
  movement
) {
  if (
    !bucket ||
    !movement
  ) {
    return;
  }

  bucket.totalEvents +=
    1;

  if (
    movement ===
    MOVEMENT_TYPE.SCHEDULED
  ) {
    bucket.scheduled +=
      1;

    return;
  }

  if (
    movement ===
    MOVEMENT_TYPE.DEPLOYED
  ) {
    bucket.successfullyDeployed +=
      1;

    return;
  }

  if (
    movement ===
    MOVEMENT_TYPE.NO_SHOW
  ) {
    bucket.noShow +=
      1;

    return;
  }

  if (
    movement ===
    MOVEMENT_TYPE.WITHDRAWN
  ) {
    bucket.withdrawn +=
      1;

    return;
  }

  if (
    movement ===
    MOVEMENT_TYPE.RESIGNED
  ) {
    bucket.resigned +=
      1;

    return;
  }

  if (
    movement ===
    MOVEMENT_TYPE.TERMINATED
  ) {
    bucket.terminated +=
      1;

    return;
  }

  if (
    movement ===
    MOVEMENT_TYPE.AWOL
  ) {
    bucket.awol +=
      1;

    return;
  }

  bucket.otherSeparation +=
    1;
}

function buildMovementSummary(
  events
) {
  const overall =
    createMovementSummaryBucket();

  const companyMap =
    new Map();

  for (const event of events) {
    const company =
      normalizeText(
        event?.company
      ) ||
      "Unassigned";

    if (
      !companyMap.has(
        company
      )
    ) {
      companyMap.set(
        company,
        {
          company,
          ...createMovementSummaryBucket(),
        }
      );
    }

    addMovementToBucket(
      overall,
      event.movement
    );

    addMovementToBucket(
      companyMap.get(
        company
      ),
      event.movement
    );
  }

  const companies =
    Array.from(
      companyMap.values()
    ).sort(
      (
        firstCompany,
        secondCompany
      ) => {
        if (
          secondCompany.totalEvents !==
          firstCompany.totalEvents
        ) {
          return (
            secondCompany.totalEvents -
            firstCompany.totalEvents
          );
        }

        return firstCompany.company.localeCompare(
          secondCompany.company
        );
      }
    );

  const companyTotals =
    companies.reduce(
      (
        total,
        company
      ) => {
        for (
          const key of Object.keys(
            total
          )
        ) {
          total[key] +=
            Number(
              company[key] ||
              0
            );
        }

        return total;
      },
      createMovementSummaryBucket()
    );

  return {
    overall,
    companies,
    companyTotals,

    totalsMatch:
      Object.keys(
        overall
      ).every(
        (key) =>
          Number(
            overall[key]
          ) ===
          Number(
            companyTotals[key]
          )
      ),
  };
}

function getMovementActorName(
  user
) {
  return (
    normalizeText(
      user?.full_name ??
      user?.fullName ??
      user?.fullname ??
      user?.display_name ??
      user?.displayName ??
      user?.name ??
      user?.username ??
      user?.email
    ) ||
    null
  );
}

async function resolveMovementActors(
  connection,
  events
) {
  const userIds =
    Array.from(
      new Set(
        events
          .map(
            (event) =>
              parsePositiveInteger(
                event
                  ?.performedByUserId
              )
          )
          .filter(
            Boolean
          )
      )
    );

  if (
    userIds.length ===
    0
  ) {
    return events.map(
      (event) => ({
        ...event,
        performedBy:
          null,
        performedByRole:
          null,
      })
    );
  }

  const placeholders =
    userIds
      .map(
        () => "?"
      )
      .join(", ");

  const [userRows] =
    await connection.query(
      `
      SELECT *
      FROM users
      WHERE id IN (
        ${placeholders}
      )
      `,
      userIds
    );

  const usersById =
    new Map(
      userRows.map(
        (user) => [
          Number(
            user.id
          ),
          user,
        ]
      )
    );

  return events.map(
    (event) => {
      const user =
        usersById.get(
          Number(
            event
              ?.performedByUserId
          )
        );

      return {
        ...event,

        performedBy:
          getMovementActorName(
            user
          ),

        performedByRole:
          user
            ? normalizeRole(
                user.role
              )
            : null,
      };
    }
  );
}

function buildCoordinatorCompanyScope(
  actor,
  alias
) {
  if (
    actor.role !==
    "HR_COORDINATOR"
  ) {
    return {
      sql:
        "",
      params:
        [],
    };
  }

  return {
    sql: `
      AND LOWER(
        TRIM(
          ${alias}.company
        )
      ) = LOWER(
        TRIM(?)
      )
    `,

    params: [
      actor.assignedCompany,
    ],
  };
}

/*
 * ================================================================
 * LIST DEPLOYMENT ATTEMPTS
 * ================================================================
 *
 * Visibility:
 * - SUPER_ADMIN: all attempts
 * - HR_MANAGER: all attempts
 * - HR_STAFF: all attempts
 * - HR_COORDINATOR: assigned company only
 *
 * This endpoint is operational history / pending-work visibility.
 * It does not grant mutation authority by itself.
 * ================================================================
 */
exports.getDeploymentAttempts =
  async (
    req,
    res
  ) => {
    const actor =
      getActor(req);

    if (
      ![
        "SUPER_ADMIN",
        "HR_MANAGER",
        "HR_STAFF",
        "HR_COORDINATOR",
      ].includes(
        actor.role
      )
    ) {
      return sendRoleDenied(res);
    }

    if (
      actor.role ===
        "HR_COORDINATOR" &&
      !actor.assignedCompany
    ) {
      return sendRoleDenied(
        res,
        "No assigned company is configured for this HR Coordinator."
      );
    }

    const requestedStatus =
      normalizeText(
        req?.query?.status
      );

    if (
      requestedStatus &&
      !Object.values(
        ATTEMPT_STATUS
      ).includes(
        requestedStatus
      )
    ) {
      return sendBadRequest(
        res,
        "Invalid deployment attempt status filter."
      );
    }

    const employeeIdRaw =
      normalizeText(
        req?.query?.employeeId
      );

    const employeeId =
      employeeIdRaw
        ? parsePositiveInteger(
            employeeIdRaw
          )
        : null;

    if (
      employeeIdRaw &&
      !employeeId
    ) {
      return sendBadRequest(
        res,
        "Invalid employee ID filter."
      );
    }

    const requestedPageSize =
      parsePositiveInteger(
        req?.query?.limit
      );

    const pageSize =
      Math.min(
        requestedPageSize ||
          DEFAULT_PAGE_SIZE,
        MAX_PAGE_SIZE
      );

    try {
      const where = [
        "1 = 1",
      ];

      const params = [];

      if (
        actor.role ===
        "HR_COORDINATOR"
      ) {
        where.push(`
          LOWER(
            TRIM(da.company)
          ) = LOWER(
            TRIM(?)
          )
        `);

        params.push(
          actor.assignedCompany
        );
      }

      if (
        requestedStatus
      ) {
        where.push(
          "da.status = ?"
        );

        params.push(
          requestedStatus
        );
      }

      if (employeeId) {
        where.push(
          "da.employee_id = ?"
        );

        params.push(
          employeeId
        );
      }

      const [rows] =
        await db
          .promise()
          .query(
            `
            SELECT
              da.id AS attemptId,
              da.employee_id AS employeeId,
              e.name AS employeeName,
              da.company,
              da.position,
              da.scheduled_date AS scheduledDate,
              DATE_FORMAT(
                da.scheduled_time,
                '%H:%i'
              ) AS scheduledTime,
              da.actual_arrival_date AS actualArrivalDate,
              da.status,
              da.outcome_reason AS outcomeReason,
              da.remarks,
              da.resolved_at AS resolvedAt,
              da.created_by_user_id AS createdByUserId,
              da.resolved_by_user_id AS resolvedByUserId,
              da.deployment_assignment_id AS deploymentAssignmentId,
              da.created_at AS createdAt,
              da.updated_at AS updatedAt,
              e.employment_status AS employeeEmploymentStatus,
              e.workforce_status AS employeeWorkforceStatus,
              e.archived AS employeeArchived
            FROM deployment_attempts AS da
            INNER JOIN employees AS e
              ON e.id = da.employee_id
            WHERE
              ${where.join(
                "\nAND "
              )}
            ORDER BY
              CASE
                WHEN da.status =
                  'For Deployment'
                  THEN 0
                ELSE 1
              END ASC,
              da.scheduled_date ASC,
              COALESCE(
                da.scheduled_time,
                '23:59:59'
              ) ASC,
              da.id DESC
            LIMIT ${pageSize}
            `,
            params
          );

      return res.json({
        success: true,
        data: rows,
        count:
          rows.length,
      });
    } catch (error) {
      console.error(
        "Get deployment attempts error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "Failed to load deployment attempts.",
        });
    }
  };

/*
 * ================================================================
 * DEPLOYMENT MOVEMENT / ACTIVITY REPORT
 * ================================================================
 *
 * Visibility:
 * - SUPER_ADMIN: all companies
 * - HR_MANAGER: all companies
 * - HR_STAFF: all companies
 * - HR_COORDINATOR: assigned company only
 *
 * Filters:
 * - month: 0..11, optional; blank / ALL = all months
 * - year: four-digit year; defaults to current Philippine year
 *
 * There is intentionally NO company filter.
 *
 * Movement categories:
 * - Scheduled for Deployment
 * - Successfully Deployed
 * - No Show
 * - Withdrawn
 * - Resigned
 * - Terminated
 * - AWOL
 * - Other Separation
 *
 * Date source:
 * - Scheduled -> scheduled_date
 * - Successfully Deployed -> actual_arrival_date
 * - No Show -> scheduled_date
 * - Withdrawn -> resolved_at
 * - Separation -> deployment end_date / ended_at
 *
 * Completed-contract style records are intentionally omitted from
 * this report because the current Welljob process does not expose a
 * user-facing Completed movement category.
 * ================================================================
 */
exports.getDeploymentMovementReport =
  async (
    req,
    res
  ) => {
    const actor =
      getActor(
        req
      );

    if (
      !MOVEMENT_REPORT_ROLES.has(
        actor.role
      )
    ) {
      return sendRoleDenied(
        res,
        "You are not authorized to access deployment movement reporting."
      );
    }

    if (
      actor.role ===
        "HR_COORDINATOR" &&
      !actor.assignedCompany
    ) {
      return sendRoleDenied(
        res,
        "No assigned company is configured for this HR Coordinator."
      );
    }

    const monthResult =
      normalizeMovementReportMonth(
        req?.query?.month
      );

    if (
      !monthResult.ok
    ) {
      return sendBadRequest(
        res,
        "Movement report month must be between 0 and 11."
      );
    }

    const yearResult =
      normalizeMovementReportYear(
        req?.query?.year
      );

    if (
      !yearResult.ok
    ) {
      return sendBadRequest(
        res,
        "Invalid movement report year."
      );
    }

    const month =
      monthResult.value;

    const year =
      yearResult.value;

    const period =
      buildMovementReportPeriod(
        year,
        month
      );

    const attemptScope =
      buildCoordinatorCompanyScope(
        actor,
        "da"
      );

    const assignmentScope =
      buildCoordinatorCompanyScope(
        actor,
        "assignments"
      );

    let connection;

    try {
      connection =
        await db
          .promise()
          .getConnection();

      /*
       * One deployment attempt may legitimately create two movement
       * rows in the same or different periods:
       *
       * 1. the scheduling event
       * 2. its eventual outcome
       *
       * Example:
       * Scheduled in September, successfully deployed in October.
       */
      /*
       * deployment_attempts.resolved_at is written by this
       * controller with UTC_TIMESTAMP(). The database session
       * itself runs in UTC, so derive its reporting date only
       * after an explicit UTC -> Manila conversion.
       *
       * scheduled_date and actual_arrival_date are DATE columns
       * and must remain unchanged calendar-date values.
       */
      const [attemptRows] =
        await connection.query(
          `
          SELECT
            da.id AS attemptId,
            da.employee_id AS employeeId,
            e.name AS employeeName,
            da.company,
            da.position,

            DATE_FORMAT(
              da.scheduled_date,
              '%Y-%m-%d'
            ) AS scheduledDate,

            DATE_FORMAT(
              da.scheduled_time,
              '%H:%i'
            ) AS scheduledTime,

            DATE_FORMAT(
              da.actual_arrival_date,
              '%Y-%m-%d'
            ) AS actualArrivalDate,

            DATE_FORMAT(
              DATE(
                CONVERT_TZ(
                  da.resolved_at,
                  '+00:00',
                  '+08:00'
                )
              ),
              '%Y-%m-%d'
            ) AS resolvedDate,

            da.status,
            da.outcome_reason AS outcomeReason,
            da.remarks,
            da.created_by_user_id AS createdByUserId,
            da.resolved_by_user_id AS resolvedByUserId,
            da.deployment_assignment_id AS deploymentAssignmentId

          FROM
            deployment_attempts AS da

          INNER JOIN
            employees AS e
              ON e.id =
                da.employee_id

          WHERE
            (
              (
                da.scheduled_date >= ?
                AND da.scheduled_date < ?
              )

              OR (
                da.actual_arrival_date >= ?
                AND da.actual_arrival_date < ?
              )

              OR (
                DATE(
                  CONVERT_TZ(
                    da.resolved_at,
                    '+00:00',
                    '+08:00'
                  )
                ) >= ?
                AND DATE(
                  CONVERT_TZ(
                    da.resolved_at,
                    '+00:00',
                    '+08:00'
                  )
                ) < ?
              )
            )

            ${attemptScope.sql}

          ORDER BY
            da.scheduled_date ASC,
            COALESCE(
              da.scheduled_time,
              '23:59:59'
            ) ASC,
            da.id ASC
          `,
          [
            period.start,
            period.endExclusive,
            period.start,
            period.endExclusive,
            period.start,
            period.endExclusive,
            ...attemptScope.params,
          ]
        );

      const [separationRows] =
        await connection.query(
          `
          SELECT
            assignments.id AS deploymentAssignmentId,
            assignments.employee_id AS employeeId,
            e.name AS employeeName,
            assignments.company,
            assignments.position,
            assignments.status AS assignmentStatus,
            assignments.end_reason AS endReason,
            assignments.end_remarks AS endRemarks,

            DATE_FORMAT(
              COALESCE(
                assignments.end_date,
                DATE(
                  assignments.ended_at
                )
              ),
              '%Y-%m-%d'
            ) AS separationDate,

            (
              SELECT
                history.changed_by_user_id

              FROM
                employee_status_history AS history

              WHERE
                history.employee_id =
                  assignments.employee_id

                AND history.changed_by_user_id
                  IS NOT NULL

                AND DATE(
                  history.effective_at
                ) =
                COALESCE(
                  assignments.end_date,
                  DATE(
                    assignments.ended_at
                  )
                )

                AND history.source_event IN (
                  'DEPLOYMENT_STATUS_UPDATED',
                  'DEPLOYMENT_ENDED',
                  'EMPLOYEE_SEPARATED',
                  'EMPLOYMENT_STATUS_UPDATED'
                )

              ORDER BY
                history.effective_at DESC,
                history.id DESC

              LIMIT 1
            ) AS performedByUserId

          FROM
            deployment_assignments AS assignments

          INNER JOIN
            employees AS e
              ON e.id =
                assignments.employee_id

          WHERE
            COALESCE(
              assignments.end_date,
              DATE(
                assignments.ended_at
              )
            ) >= ?

            AND COALESCE(
              assignments.end_date,
              DATE(
                assignments.ended_at
              )
            ) < ?

            AND (
              LOWER(
                TRIM(
                  COALESCE(
                    assignments.end_reason,
                    ''
                  )
                )
              ) IN (
                'resigned',
                'terminated',
                'awol'
              )

              OR LOWER(
                TRIM(
                  COALESCE(
                    assignments.status,
                    ''
                  )
                )
              ) IN (
                'cancelled',
                'canceled',
                'separated',
                'ended'
              )

              OR COALESCE(
                assignments.end_remarks,
                ''
              ) LIKE
                '[Other Separation]%'
            )

            ${assignmentScope.sql}

          ORDER BY
            separationDate ASC,
            assignments.id ASC
          `,
          [
            period.start,
            period.endExclusive,
            ...assignmentScope.params,
          ]
        );

      const events = [];

      for (
        const row of attemptRows
      ) {
        if (
          isDateInsideMovementPeriod(
            row.scheduledDate,
            period
          )
        ) {
          events.push({
            id:
              `attempt-${row.attemptId}-scheduled`,

            source:
              "deployment_attempt",

            sourceId:
              Number(
                row.attemptId
              ),

            attemptId:
              Number(
                row.attemptId
              ),

            deploymentAssignmentId:
              row.deploymentAssignmentId
                ? Number(
                    row.deploymentAssignmentId
                  )
                : null,

            eventDate:
              row.scheduledDate,

            scheduledTime:
              row.scheduledTime ||
              null,

            employeeId:
              Number(
                row.employeeId
              ),

            employeeName:
              row.employeeName ||
              "Unknown Employee",

            company:
              row.company ||
              "Unassigned",

            position:
              row.position ||
              null,

            movement:
              MOVEMENT_TYPE.SCHEDULED,

            fromStatus:
              WORKFORCE_STATUS.FLOATING,

            toStatus:
              WORKFORCE_STATUS.FOR_DEPLOYMENT,

            reason:
              "Scheduled for deployment",

            remarks:
              row.remarks ||
              null,

            performedByUserId:
              row.createdByUserId
                ? Number(
                    row.createdByUserId
                  )
                : null,
          });
        }

        if (
          row.status ===
            ATTEMPT_STATUS.DEPLOYED &&
          isDateInsideMovementPeriod(
            row.actualArrivalDate,
            period
          )
        ) {
          events.push({
            id:
              `attempt-${row.attemptId}-deployed`,

            source:
              "deployment_attempt",

            sourceId:
              Number(
                row.attemptId
              ),

            attemptId:
              Number(
                row.attemptId
              ),

            deploymentAssignmentId:
              row.deploymentAssignmentId
                ? Number(
                    row.deploymentAssignmentId
                  )
                : null,

            eventDate:
              row.actualArrivalDate,

            employeeId:
              Number(
                row.employeeId
              ),

            employeeName:
              row.employeeName ||
              "Unknown Employee",

            company:
              row.company ||
              "Unassigned",

            position:
              row.position ||
              null,

            movement:
              MOVEMENT_TYPE.DEPLOYED,

            fromStatus:
              WORKFORCE_STATUS.FOR_DEPLOYMENT,

            toStatus:
              WORKFORCE_STATUS.DEPLOYED,

            reason:
              row.outcomeReason ||
              "Arrival confirmed",

            remarks:
              row.remarks ||
              null,

            performedByUserId:
              row.resolvedByUserId
                ? Number(
                    row.resolvedByUserId
                  )
                : null,
          });
        }

        if (
          row.status ===
            ATTEMPT_STATUS.NO_SHOW &&
          isDateInsideMovementPeriod(
            row.scheduledDate,
            period
          )
        ) {
          events.push({
            id:
              `attempt-${row.attemptId}-no-show`,

            source:
              "deployment_attempt",

            sourceId:
              Number(
                row.attemptId
              ),

            attemptId:
              Number(
                row.attemptId
              ),

            deploymentAssignmentId:
              null,

            eventDate:
              row.scheduledDate,

            scheduledTime:
              row.scheduledTime ||
              null,

            employeeId:
              Number(
                row.employeeId
              ),

            employeeName:
              row.employeeName ||
              "Unknown Employee",

            company:
              row.company ||
              "Unassigned",

            position:
              row.position ||
              null,

            movement:
              MOVEMENT_TYPE.NO_SHOW,

            fromStatus:
              WORKFORCE_STATUS.FOR_DEPLOYMENT,

            toStatus:
              WORKFORCE_STATUS.FLOATING,

            reason:
              row.outcomeReason ||
              "Employee did not report to site",

            remarks:
              row.remarks ||
              null,

            performedByUserId:
              row.resolvedByUserId
                ? Number(
                    row.resolvedByUserId
                  )
                : null,
          });
        }

        if (
          row.status ===
            ATTEMPT_STATUS.WITHDRAWN &&
          isDateInsideMovementPeriod(
            row.resolvedDate,
            period
          )
        ) {
          events.push({
            id:
              `attempt-${row.attemptId}-withdrawn`,

            source:
              "deployment_attempt",

            sourceId:
              Number(
                row.attemptId
              ),

            attemptId:
              Number(
                row.attemptId
              ),

            deploymentAssignmentId:
              null,

            eventDate:
              row.resolvedDate,

            employeeId:
              Number(
                row.employeeId
              ),

            employeeName:
              row.employeeName ||
              "Unknown Employee",

            company:
              row.company ||
              "Unassigned",

            position:
              row.position ||
              null,

            movement:
              MOVEMENT_TYPE.WITHDRAWN,

            fromStatus:
              WORKFORCE_STATUS.FOR_DEPLOYMENT,

            toStatus:
              WORKFORCE_STATUS.FLOATING,

            reason:
              row.outcomeReason ||
              "Deployment schedule withdrawn",

            remarks:
              row.remarks ||
              null,

            performedByUserId:
              row.resolvedByUserId
                ? Number(
                    row.resolvedByUserId
                  )
                : null,
          });
        }
      }

      for (
        const row of separationRows
      ) {
        const movement =
          normalizeMovementSeparationType(
            row.assignmentStatus,
            row.endReason,
            row.endRemarks
          );

        if (
          !movement ||
          !isDateInsideMovementPeriod(
            row.separationDate,
            period
          )
        ) {
          continue;
        }

        events.push({
          id:
            `assignment-${row.deploymentAssignmentId}-separation`,

          source:
            "deployment_assignment",

          sourceId:
            Number(
              row.deploymentAssignmentId
            ),

          attemptId:
            null,

          deploymentAssignmentId:
            Number(
              row.deploymentAssignmentId
            ),

          eventDate:
            row.separationDate,

          employeeId:
            Number(
              row.employeeId
            ),

          employeeName:
            row.employeeName ||
            "Unknown Employee",

          company:
            row.company ||
            "Unassigned",

          position:
            row.position ||
            null,

          movement,

          fromStatus:
            WORKFORCE_STATUS.DEPLOYED,

          toStatus:
            movement,

          reason:
            row.endReason ||
            (
              movement ===
                MOVEMENT_TYPE.OTHER_SEPARATION
                ? "Other separation"
                : movement
            ),

          remarks:
            row.endRemarks ||
            null,

          performedByUserId:
            row.performedByUserId
              ? Number(
                  row.performedByUserId
                )
              : null,
        });
      }

      events.sort(
        (
          firstEvent,
          secondEvent
        ) => {
          const dateCompare =
            String(
              secondEvent.eventDate
            ).localeCompare(
              String(
                firstEvent.eventDate
              )
            );

          if (
            dateCompare !==
            0
          ) {
            return dateCompare;
          }

          return String(
            secondEvent.id
          ).localeCompare(
            String(
              firstEvent.id
            )
          );
        }
      );

      const enrichedEvents =
        await resolveMovementActors(
          connection,
          events
        );

      const summary =
        buildMovementSummary(
          enrichedEvents
        );

      const attemptYearScope =
        buildCoordinatorCompanyScope(
          actor,
          "attempt_years"
        );

      const assignmentYearScope =
        buildCoordinatorCompanyScope(
          actor,
          "assignment_years"
        );

      const [yearRows] =
        await connection.query(
          `
          SELECT DISTINCT
            source.year

          FROM (
            SELECT
              YEAR(
                attempt_years.scheduled_date
              ) AS year
            FROM
              deployment_attempts AS attempt_years
            WHERE
              attempt_years.scheduled_date
                IS NOT NULL
              ${attemptYearScope.sql}

            UNION

            SELECT
              YEAR(
                attempt_years.actual_arrival_date
              ) AS year
            FROM
              deployment_attempts AS attempt_years
            WHERE
              attempt_years.actual_arrival_date
                IS NOT NULL
              ${attemptYearScope.sql}

            UNION

            SELECT
              YEAR(
                CONVERT_TZ(
                  attempt_years.resolved_at,
                  '+00:00',
                  '+08:00'
                )
              ) AS year
            FROM
              deployment_attempts AS attempt_years
            WHERE
              attempt_years.resolved_at
                IS NOT NULL
              ${attemptYearScope.sql}

            UNION

            SELECT
              YEAR(
                COALESCE(
                  assignment_years.end_date,
                  DATE(
                    assignment_years.ended_at
                  )
                )
              ) AS year
            FROM
              deployment_assignments AS assignment_years
            WHERE
              COALESCE(
                assignment_years.end_date,
                DATE(
                  assignment_years.ended_at
                )
              ) IS NOT NULL

              AND (
                LOWER(
                  TRIM(
                    COALESCE(
                      assignment_years.end_reason,
                      ''
                    )
                  )
                ) IN (
                  'resigned',
                  'terminated',
                  'awol'
                )

                OR LOWER(
                  TRIM(
                    COALESCE(
                      assignment_years.status,
                      ''
                    )
                  )
                ) IN (
                  'cancelled',
                  'canceled',
                  'separated',
                  'ended'
                )

                OR COALESCE(
                  assignment_years.end_remarks,
                  ''
                ) LIKE
                  '[Other Separation]%'
              )

              ${assignmentYearScope.sql}
          ) AS source

          WHERE
            source.year
              IS NOT NULL

          ORDER BY
            source.year DESC
          `,
          [
            ...attemptYearScope.params,
            ...attemptYearScope.params,
            ...attemptYearScope.params,
            ...assignmentYearScope.params,
          ]
        );

      const availableYears =
        yearRows
          .map(
            (row) =>
              Number(
                row.year
              )
          )
          .filter(
            Number.isInteger
          );

      return res.json({
        success:
          true,

        filters: {
          month,
          year,
          periodLabel:
            period.label,
          periodStart:
            period.start,
          periodEndExclusive:
            period.endExclusive,
        },

        scope: {
          company:
            actor.role ===
              "HR_COORDINATOR"
              ? actor.assignedCompany
              : null,

          role:
            actor.role,
        },

        summary:
          summary.overall,

        companies:
          summary.companies,

        overallTotal:
          summary.companyTotals,

        events:
          enrichedEvents,

        count:
          enrichedEvents.length,

        filterMeta: {
          years:
            availableYears,
        },

        meta: {
          generatedAt:
            new Date()
              .toISOString(),

          totalsMatch:
            summary.totalsMatch,

          companyRows:
            summary.companies.length,

          eventRows:
            enrichedEvents.length,

          completedCategoryIncluded:
            false,
        },
      });
    } catch (error) {
      console.error(
        "Get deployment movement report error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          error:
            "Failed to load deployment movement report.",
        });
    } finally {
      await releaseConnection(
        connection
      );
    }
  };

/*
 * ================================================================
 * HR STAFF: SCHEDULE EMPLOYEE FOR DEPLOYMENT
 * ================================================================
 *
 * Preconditions:
 * - HR Staff only
 * - employee is Active employment
 * - employee is Floating / Standby
 * - employee is not archived
 * - no Active deployment exists
 * - no other live For Deployment attempt exists
 * - employee already has designated company + position
 * - designated company / position are active master-data values
 * - expected arrival date + time are required
 *
 * Scheduling does NOT accept a different target placement.
 * HR Staff must update the employee's Pooling designation first.
 *
 * Result:
 * - deployment_attempts snapshots designated company + position
 * - deployment_attempts stores expected arrival date + time
 * - deployment_attempts row = For Deployment
 * - employees.workforce_status = For Deployment
 * - legacy employees.status mirrors For Deployment during rollout
 * - NO deployment_assignments row yet
 * ================================================================
 */
exports.createDeploymentAttempt =
  async (
    req,
    res
  ) => {
    const actor =
      getActor(req);

    if (
      actor.role !==
      "HR_STAFF"
    ) {
      return sendRoleDenied(
        res,
        "Only HR Staff can schedule an employee for deployment."
      );
    }

    if (!actor.id) {
      return sendRoleDenied(
        res,
        "Your account identity could not be verified."
      );
    }

    const employeeId =
      getRequestEmployeeId(req);

    if (!employeeId) {
      return sendBadRequest(
        res,
        "A valid employee ID is required."
      );
    }

    /*
     * company / position may still be sent by an older frontend,
     * but they are never authoritative for scheduling.
     *
     * The employee's locked Pooling designation is the source of
     * truth. If an older client submits placement values, they must
     * match that designation exactly.
     */
    const requestedCompany =
      normalizeText(
        req?.body?.company
      );

    const requestedPosition =
      normalizeText(
        req?.body?.position
      );

    const scheduledDate =
      normalizeText(
        req?.body?.scheduledDate ??
        req?.body?.scheduled_date
      );

    const scheduledTime =
      normalizeScheduledTime(
        req?.body?.scheduledTime ??
        req?.body?.scheduled_time
      );

    const remarks =
      normalizeText(
        req?.body?.remarks
      );

    if (
      requestedCompany.length > 255
    ) {
      return sendBadRequest(
        res,
        "Client company value is too long."
      );
    }

    if (
      requestedPosition.length > 150
    ) {
      return sendBadRequest(
        res,
        "Position value is too long."
      );
    }

    if (
      !isStrictDateString(
        scheduledDate
      )
    ) {
      return sendBadRequest(
        res,
        "A valid scheduled deployment date is required."
      );
    }

    const philippinesNow =
      getPhilippinesCurrentDateTime();

    if (
      scheduledDate <
      philippinesNow.date
    ) {
      return sendBadRequest(
        res,
        "Scheduled deployment date cannot be in the past."
      );
    }

    if (!scheduledTime) {
      return sendBadRequest(
        res,
        "A valid expected arrival time is required."
      );
    }

    if (
      scheduledDate ===
        philippinesNow.date &&
      scheduledTime.slice(
        0,
        5
      ) <
        philippinesNow.time.slice(
          0,
          5
        )
    ) {
      return sendBadRequest(
        res,
        "Expected arrival time cannot be earlier than the current Philippine time."
      );
    }

    if (
      remarks.length > 2000
    ) {
      return sendBadRequest(
        res,
        "Remarks are too long."
      );
    }

    let connection;

    try {
      connection =
        await db
          .promise()
          .getConnection();

      await connection.beginTransaction();

      const employee =
        await getLockedEmployee(
          connection,
          employeeId
        );

      const employeeCheck =
        validateEmployeeForAttempt(
          employee
        );

      if (!employeeCheck.ok) {
        await safeRollback(
          connection
        );

        return res
          .status(
            employeeCheck.status
          )
          .json({
            success: false,
            error:
              employeeCheck.message,
          });
      }

      const designatedCompany =
        normalizeText(
          employee.company
        );

      const designatedPosition =
        normalizeText(
          employee.position
        );

      if (
        !designatedCompany ||
        !designatedPosition
      ) {
        await safeRollback(
          connection
        );

        return sendConflict(
          res,
          "Set the employee's designated company and position before scheduling deployment."
        );
      }

      /*
       * Older clients may still submit company/position with the
       * scheduling request. Treat those values as consistency checks
       * only; never let them override the locked employee designation.
       */
      if (
        requestedCompany &&
        normalizeComparable(
          requestedCompany
        ) !==
          normalizeComparable(
            designatedCompany
          )
      ) {
        await safeRollback(
          connection
        );

        return sendConflict(
          res,
          "The submitted company does not match the employee's current Pooling designation. Update the employee designation first."
        );
      }

      if (
        requestedPosition &&
        normalizeComparable(
          requestedPosition
        ) !==
          normalizeComparable(
            designatedPosition
          )
      ) {
        await safeRollback(
          connection
        );

        return sendConflict(
          res,
          "The submitted position does not match the employee's current Pooling designation. Update the employee designation first."
        );
      }

      const activeAssignments =
        await hasActiveDeployment(
          connection,
          employeeId
        );

      if (
        activeAssignments.length > 0
      ) {
        await safeRollback(
          connection
        );

        return sendConflict(
          res,
          "This employee already has an active deployment."
        );
      }

      const [pendingAttempts] =
        await connection.query(
          `
          SELECT
            id
          FROM deployment_attempts
          WHERE employee_id = ?
            AND status = 'For Deployment'
          ORDER BY id ASC
          LIMIT 2
          FOR UPDATE
          `,
          [
            employeeId,
          ]
        );

      if (
        pendingAttempts.length > 0
      ) {
        await safeRollback(
          connection
        );

        return sendConflict(
          res,
          "This employee already has a pending deployment schedule."
        );
      }

      const masterData =
        await validateActiveCompanyAndPosition(
          connection,
          designatedCompany,
          designatedPosition
        );

      if (!masterData.ok) {
        await safeRollback(
          connection
        );

        return res
          .status(
            masterData.status
          )
          .json({
            success: false,
            error:
              masterData.message,
          });
      }

      const [insertResult] =
        await connection.query(
          `
          INSERT INTO deployment_attempts (
            employee_id,
            company,
            position,
            scheduled_date,
            scheduled_time,
            status,
            remarks,
            created_by_user_id
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            'For Deployment',
            ?,
            ?
          )
          `,
          [
            employeeId,
            masterData.company,
            masterData.position,
            scheduledDate,
            scheduledTime,
            remarks || null,
            actor.id,
          ]
        );

      const attemptId =
        Number(
          insertResult.insertId
        );

      const [employeeUpdate] =
        await connection.query(
          `
          UPDATE employees
          SET
            workforce_status =
              'For Deployment',

            status =
              'For Deployment'
          WHERE id = ?
            AND employment_status =
              'Active'
            AND workforce_status =
              'Floating / Standby'
            AND archived = 0
          `,
          [
            employeeId,
          ]
        );

      if (
        employeeUpdate.affectedRows !==
        1
      ) {
        throw new Error(
          "Employee workforce state changed before deployment scheduling could complete."
        );
      }

      await insertWorkforceHistory(
        connection,
        {
          employeeId,

          fromStatus:
            WORKFORCE_STATUS.FLOATING,

          toStatus:
            WORKFORCE_STATUS.FOR_DEPLOYMENT,

          reason:
            "Scheduled for deployment",

          remarks:
            remarks || null,

          sourceEvent:
            SOURCE_EVENT.SCHEDULED,

          changedByUserId:
            actor.id,
        }
      );

      await connection.commit();

      const employeeName =
        normalizeText(
          employee.name
        ) ||
        `Employee #${employeeId}`;

      await writeOperationalAudit({
        actor,

        action:
          "SCHEDULE_DEPLOYMENT",

        description:
          `${employeeName} (Employee #${employeeId}) was scheduled for deployment to ` +
          `${masterData.company}${masterData.position ? ` as ${masterData.position}` : ""} ` +
          `on ${scheduledDate} at ${scheduledTime.slice(0, 5)}. Workforce status changed from ` +
          `Floating / Standby to For Deployment.`,
      });

      return res
        .status(201)
        .json({
          success: true,

          message:
            "Employee scheduled for deployment.",

          data: {
            attemptId,
            employeeId,
            employeeName,
            company:
              masterData.company,
            position:
              masterData.position,
            scheduledDate,
            scheduledTime:
              scheduledTime.slice(
                0,
                5
              ),
            status:
              ATTEMPT_STATUS.FOR_DEPLOYMENT,
            workforceStatus:
              WORKFORCE_STATUS.FOR_DEPLOYMENT,
          },
        });
    } catch (error) {
      await safeRollback(
        connection
      );

      if (
        error?.code ===
        "ER_DUP_ENTRY"
      ) {
        return sendConflict(
          res,
          "This employee already has a pending deployment schedule."
        );
      }

      console.error(
        "Create deployment attempt error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "Failed to schedule employee for deployment.",
        });
    } finally {
      await releaseConnection(
        connection
      );
    }
  };

/*
 * ================================================================
 * HR COORDINATOR: CONFIRM ARRIVAL
 * ================================================================
 *
 * Only the Coordinator assigned to the attempt company may confirm.
 *
 * Result:
 * - attempt -> Deployed
 * - actual_arrival_date captured
 * - one real Active deployment_assignments row created
 * - employee -> Deployed
 * - legacy employee company/contractStart synchronized
 * ================================================================
 */
exports.confirmDeploymentArrival =
  async (
    req,
    res
  ) => {
    const actor =
      getActor(req);

    if (
      actor.role !==
      "HR_COORDINATOR"
    ) {
      return sendRoleDenied(
        res,
        "Only the assigned HR Coordinator can confirm employee arrival."
      );
    }

    if (
      !actor.id ||
      !actor.assignedCompany
    ) {
      return sendRoleDenied(
        res,
        "Your HR Coordinator company assignment could not be verified."
      );
    }

    const attemptId =
      getRequestAttemptId(req);

    if (!attemptId) {
      return sendBadRequest(
        res,
        "A valid deployment attempt ID is required."
      );
    }

    const actualArrivalDate =
      normalizeText(
        req?.body?.actualArrivalDate ??
        req?.body?.actual_arrival_date ??
        getPhilippinesToday()
      );

    const remarks =
      normalizeText(
        req?.body?.remarks
      );

    if (
      !isStrictDateString(
        actualArrivalDate
      )
    ) {
      return sendBadRequest(
        res,
        "A valid actual arrival date is required."
      );
    }

    if (
      actualArrivalDate >
      getPhilippinesToday()
    ) {
      return sendBadRequest(
        res,
        "Actual arrival date cannot be in the future."
      );
    }

    if (
      remarks.length > 2000
    ) {
      return sendBadRequest(
        res,
        "Remarks are too long."
      );
    }

    let connection;

    try {
      connection =
        await db
          .promise()
          .getConnection();

      await connection.beginTransaction();

      const {
        employee,
        attempt,
      } =
        await lockEmployeeThenAttempt(
          connection,
          attemptId
        );

      if (!attempt) {
        await safeRollback(
          connection
        );

        return sendNotFound(
          res,
          "Deployment attempt not found."
        );
      }

      if (
        !coordinatorCanActOnAttempt(
          actor,
          attempt
        )
      ) {
        await safeRollback(
          connection
        );

        return sendRoleDenied(
          res,
          "This deployment attempt belongs to a different client company."
        );
      }

      const stateCheck =
        validateAttemptResolutionState({
          employee,
          attempt,
        });

      if (!stateCheck.ok) {
        await safeRollback(
          connection
        );

        return res
          .status(
            stateCheck.status
          )
          .json({
            success: false,
            error:
              stateCheck.message,
          });
      }

      const activeAssignments =
        await hasActiveDeployment(
          connection,
          employee.id
        );

      if (
        activeAssignments.length > 0
      ) {
        await safeRollback(
          connection
        );

        return sendConflict(
          res,
          "This employee already has an active deployment."
        );
      }

      const [assignmentResult] =
        await connection.query(
          `
          INSERT INTO deployment_assignments (
            employee_id,
            company,
            position,
            start_date,
            status,
            created_by_user_id
          )
          VALUES (
            ?,
            ?,
            ?,
            ?,
            'Active',
            ?
          )
          `,
          [
            employee.id,
            attempt.company,
            attempt.position || null,
            actualArrivalDate,
            actor.id,
          ]
        );

      const deploymentAssignmentId =
        Number(
          assignmentResult.insertId
        );

      const [attemptUpdate] =
        await connection.query(
          `
          UPDATE deployment_attempts
          SET
            actual_arrival_date = ?,
            status = 'Deployed',
            outcome_reason =
              'Arrival confirmed',
            remarks = ?,
            resolved_at =
              UTC_TIMESTAMP(),
            resolved_by_user_id = ?,
            deployment_assignment_id = ?
          WHERE id = ?
            AND status =
              'For Deployment'
          `,
          [
            actualArrivalDate,
            remarks || attempt.remarks || null,
            actor.id,
            deploymentAssignmentId,
            attemptId,
          ]
        );

      if (
        attemptUpdate.affectedRows !==
        1
      ) {
        throw new Error(
          "Deployment attempt changed before arrival confirmation could complete."
        );
      }

      const [employeeUpdate] =
        await connection.query(
          `
          UPDATE employees
          SET
            company = ?,

            position = ?,

            workforce_status =
              'Deployed',

            status =
              'Deployed',

            \`contractStart\` = ?,

            \`contractEnd\` = NULL,

            \`contractEndReason\` = NULL,

            \`contractEndRemarks\` = NULL,

            \`contractEndedAt\` = NULL

          WHERE id = ?
            AND employment_status =
              'Active'
            AND workforce_status =
              'For Deployment'
            AND archived = 0
          `,
          [
            attempt.company,
            attempt.position || null,
            actualArrivalDate,
            employee.id,
          ]
        );

      if (
        employeeUpdate.affectedRows !==
        1
      ) {
        throw new Error(
          "Employee workforce state changed before arrival confirmation could complete."
        );
      }

      await connection.query(
        `
        INSERT INTO employee_status_history (
          employee_id,
          from_status,
          to_status,
          effective_at,
          reason,
          remarks,
          source_event,
          changed_by_user_id
        )
        VALUES (
          ?,
          'For Deployment',
          'Deployed',
          CONCAT(
            ?,
            ' 00:00:00'
          ),
          'Deployment arrival confirmed',
          ?,
          ?,
          ?
        )
        `,
        [
          employee.id,
          actualArrivalDate,
          remarks || null,
          SOURCE_EVENT.ARRIVAL_CONFIRMED,
          actor.id,
        ]
      );

      await connection.commit();

      const employeeName =
        normalizeText(
          employee.name
        ) ||
        `Employee #${employee.id}`;

      await writeOperationalAudit({
        actor,

        action:
          "CONFIRM_DEPLOYMENT_ARRIVAL",

        description:
          `${employeeName} (Employee #${employee.id}) arrived at ${attempt.company} ` +
          `on ${actualArrivalDate}. Deployment assignment #${deploymentAssignmentId} was activated ` +
          `and workforce status changed from For Deployment to Deployed.`,
      });

      return res.json({
        success: true,

        message:
          "Employee arrival confirmed and deployment activated.",

        data: {
          attemptId,
          deploymentAssignmentId,
          employeeId:
            employee.id,
          employeeName,
          company:
            attempt.company,
          position:
            attempt.position || null,
          scheduledDate:
            normalizeText(
              attempt.scheduled_date
            ) || null,
          scheduledTime:
            normalizeText(
              attempt.scheduled_time
            )
              .slice(
                0,
                5
              ) || null,
          actualArrivalDate,
          attemptStatus:
            ATTEMPT_STATUS.DEPLOYED,
          workforceStatus:
            WORKFORCE_STATUS.DEPLOYED,
        },
      });
    } catch (error) {
      await safeRollback(
        connection
      );

      if (
        error?.code ===
        "ER_DUP_ENTRY"
      ) {
        return sendConflict(
          res,
          "This employee already has an active deployment."
        );
      }

      console.error(
        "Confirm deployment arrival error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "Failed to confirm employee arrival.",
        });
    } finally {
      await releaseConnection(
        connection
      );
    }
  };

/*
 * ================================================================
 * HR COORDINATOR: MARK NO SHOW
 * ================================================================
 *
 * Result:
 * - attempt -> No Show
 * - employee -> Floating / Standby
 * - employee designated company + position are retained
 * - NO deployment assignment is created
 * ================================================================
 */
exports.markDeploymentNoShow =
  async (
    req,
    res
  ) => {
    const actor =
      getActor(req);

    if (
      actor.role !==
      "HR_COORDINATOR"
    ) {
      return sendRoleDenied(
        res,
        "Only the assigned HR Coordinator can mark a deployment as No Show."
      );
    }

    if (
      !actor.id ||
      !actor.assignedCompany
    ) {
      return sendRoleDenied(
        res,
        "Your HR Coordinator company assignment could not be verified."
      );
    }

    const attemptId =
      getRequestAttemptId(req);

    if (!attemptId) {
      return sendBadRequest(
        res,
        "A valid deployment attempt ID is required."
      );
    }

    const remarks =
      normalizeText(
        req?.body?.remarks
      );

    if (
      remarks.length > 2000
    ) {
      return sendBadRequest(
        res,
        "Remarks are too long."
      );
    }

    let connection;

    try {
      connection =
        await db
          .promise()
          .getConnection();

      await connection.beginTransaction();

      const {
        employee,
        attempt,
      } =
        await lockEmployeeThenAttempt(
          connection,
          attemptId
        );

      if (!attempt) {
        await safeRollback(
          connection
        );

        return sendNotFound(
          res,
          "Deployment attempt not found."
        );
      }

      if (
        !coordinatorCanActOnAttempt(
          actor,
          attempt
        )
      ) {
        await safeRollback(
          connection
        );

        return sendRoleDenied(
          res,
          "This deployment attempt belongs to a different client company."
        );
      }

      const stateCheck =
        validateAttemptResolutionState({
          employee,
          attempt,
        });

      if (!stateCheck.ok) {
        await safeRollback(
          connection
        );

        return res
          .status(
            stateCheck.status
          )
          .json({
            success: false,
            error:
              stateCheck.message,
          });
      }

      const activeAssignments =
        await hasActiveDeployment(
          connection,
          employee.id
        );

      if (
        activeAssignments.length > 0
      ) {
        await safeRollback(
          connection
        );

        return sendConflict(
          res,
          "An active deployment already exists for this employee."
        );
      }

      const [attemptUpdate] =
        await connection.query(
          `
          UPDATE deployment_attempts
          SET
            status = 'No Show',
            outcome_reason =
              'Employee did not report to site',
            remarks = ?,
            resolved_at =
              UTC_TIMESTAMP(),
            resolved_by_user_id = ?
          WHERE id = ?
            AND status =
              'For Deployment'
          `,
          [
            remarks || null,
            actor.id,
            attemptId,
          ]
        );

      if (
        attemptUpdate.affectedRows !==
        1
      ) {
        throw new Error(
          "Deployment attempt changed before No Show could be recorded."
        );
      }

      const [employeeUpdate] =
        await connection.query(
          `
          UPDATE employees
          SET
            workforce_status =
              'Floating / Standby',

            status =
              'Floating / Standby'
          WHERE id = ?
            AND employment_status =
              'Active'
            AND workforce_status =
              'For Deployment'
            AND archived = 0
          `,
          [
            employee.id,
          ]
        );

      if (
        employeeUpdate.affectedRows !==
        1
      ) {
        throw new Error(
          "Employee workforce state changed before No Show could be recorded."
        );
      }

      await insertWorkforceHistory(
        connection,
        {
          employeeId:
            employee.id,

          fromStatus:
            WORKFORCE_STATUS.FOR_DEPLOYMENT,

          toStatus:
            WORKFORCE_STATUS.FLOATING,

          reason:
            "No Show",

          remarks:
            remarks || null,

          sourceEvent:
            SOURCE_EVENT.NO_SHOW,

          changedByUserId:
            actor.id,
        }
      );

      await connection.commit();

      const employeeName =
        normalizeText(
          employee.name
        ) ||
        `Employee #${employee.id}`;

      await writeOperationalAudit({
        actor,

        action:
          "MARK_DEPLOYMENT_NO_SHOW",

        description:
          `${employeeName} (Employee #${employee.id}) was marked No Show for the ` +
          `${attempt.company} deployment attempt. Workforce status returned from ` +
          `For Deployment to Floating / Standby.`,
      });

      return res.json({
        success: true,

        message:
          "Employee marked No Show and returned to Floating / Standby.",

        data: {
          attemptId,
          employeeId:
            employee.id,
          employeeName,
          company:
            attempt.company,
          position:
            attempt.position || null,
          scheduledDate:
            normalizeText(
              attempt.scheduled_date
            ) || null,
          scheduledTime:
            normalizeText(
              attempt.scheduled_time
            )
              .slice(
                0,
                5
              ) || null,
          attemptStatus:
            ATTEMPT_STATUS.NO_SHOW,
          workforceStatus:
            WORKFORCE_STATUS.FLOATING,
        },
      });
    } catch (error) {
      await safeRollback(
        connection
      );

      console.error(
        "Mark deployment No Show error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "Failed to mark deployment as No Show.",
        });
    } finally {
      await releaseConnection(
        connection
      );
    }
  };

/*
 * ================================================================
 * HR STAFF: WITHDRAW DEPLOYMENT ATTEMPT
 * ================================================================
 *
 * "Withdrawn" is deliberately used instead of "Cancelled".
 * "Cancelled" remains a legacy internal deployment_assignments
 * status and must not be reused for this new workflow.
 *
 * Result:
 * - attempt -> Withdrawn
 * - employee -> Floating / Standby
 * - employee designated company + position are retained
 * - NO deployment assignment is created
 * ================================================================
 */
exports.withdrawDeploymentAttempt =
  async (
    req,
    res
  ) => {
    const actor =
      getActor(req);

    if (
      actor.role !==
      "HR_STAFF"
    ) {
      return sendRoleDenied(
        res,
        "Only HR Staff can withdraw a pending deployment schedule."
      );
    }

    if (!actor.id) {
      return sendRoleDenied(
        res,
        "Your account identity could not be verified."
      );
    }

    const attemptId =
      getRequestAttemptId(req);

    if (!attemptId) {
      return sendBadRequest(
        res,
        "A valid deployment attempt ID is required."
      );
    }

    const reason =
      normalizeText(
        req?.body?.reason
      );

    const remarks =
      normalizeText(
        req?.body?.remarks
      );

    if (!reason) {
      return sendBadRequest(
        res,
        "A withdrawal reason is required."
      );
    }

    if (
      reason.length > 100
    ) {
      return sendBadRequest(
        res,
        "Withdrawal reason is too long."
      );
    }

    if (
      remarks.length > 2000
    ) {
      return sendBadRequest(
        res,
        "Remarks are too long."
      );
    }

    let connection;

    try {
      connection =
        await db
          .promise()
          .getConnection();

      await connection.beginTransaction();

      const {
        employee,
        attempt,
      } =
        await lockEmployeeThenAttempt(
          connection,
          attemptId
        );

      if (!attempt) {
        await safeRollback(
          connection
        );

        return sendNotFound(
          res,
          "Deployment attempt not found."
        );
      }

      const stateCheck =
        validateAttemptResolutionState({
          employee,
          attempt,
        });

      if (!stateCheck.ok) {
        await safeRollback(
          connection
        );

        return res
          .status(
            stateCheck.status
          )
          .json({
            success: false,
            error:
              stateCheck.message,
          });
      }

      const activeAssignments =
        await hasActiveDeployment(
          connection,
          employee.id
        );

      if (
        activeAssignments.length > 0
      ) {
        await safeRollback(
          connection
        );

        return sendConflict(
          res,
          "An active deployment already exists for this employee."
        );
      }

      const [attemptUpdate] =
        await connection.query(
          `
          UPDATE deployment_attempts
          SET
            status = 'Withdrawn',
            outcome_reason = ?,
            remarks = ?,
            resolved_at =
              UTC_TIMESTAMP(),
            resolved_by_user_id = ?
          WHERE id = ?
            AND status =
              'For Deployment'
          `,
          [
            reason,
            remarks || null,
            actor.id,
            attemptId,
          ]
        );

      if (
        attemptUpdate.affectedRows !==
        1
      ) {
        throw new Error(
          "Deployment attempt changed before withdrawal could complete."
        );
      }

      const [employeeUpdate] =
        await connection.query(
          `
          UPDATE employees
          SET
            workforce_status =
              'Floating / Standby',

            status =
              'Floating / Standby'
          WHERE id = ?
            AND employment_status =
              'Active'
            AND workforce_status =
              'For Deployment'
            AND archived = 0
          `,
          [
            employee.id,
          ]
        );

      if (
        employeeUpdate.affectedRows !==
        1
      ) {
        throw new Error(
          "Employee workforce state changed before withdrawal could complete."
        );
      }

      await insertWorkforceHistory(
        connection,
        {
          employeeId:
            employee.id,

          fromStatus:
            WORKFORCE_STATUS.FOR_DEPLOYMENT,

          toStatus:
            WORKFORCE_STATUS.FLOATING,

          reason,
          remarks:
            remarks || null,

          sourceEvent:
            SOURCE_EVENT.WITHDRAWN,

          changedByUserId:
            actor.id,
        }
      );

      await connection.commit();

      const employeeName =
        normalizeText(
          employee.name
        ) ||
        `Employee #${employee.id}`;

      await writeOperationalAudit({
        actor,

        action:
          "WITHDRAW_DEPLOYMENT_ATTEMPT",

        description:
          `${employeeName} (Employee #${employee.id}) was withdrawn from the ` +
          `${attempt.company} deployment schedule. Workforce status returned from ` +
          `For Deployment to Floating / Standby. Reason: ${reason}.`,
      });

      return res.json({
        success: true,

        message:
          "Deployment schedule withdrawn.",

        data: {
          attemptId,
          employeeId:
            employee.id,
          employeeName,
          company:
            attempt.company,
          position:
            attempt.position || null,
          scheduledDate:
            normalizeText(
              attempt.scheduled_date
            ) || null,
          scheduledTime:
            normalizeText(
              attempt.scheduled_time
            )
              .slice(
                0,
                5
              ) || null,
          attemptStatus:
            ATTEMPT_STATUS.WITHDRAWN,
          workforceStatus:
            WORKFORCE_STATUS.FLOATING,
        },
      });
    } catch (error) {
      await safeRollback(
        connection
      );

      console.error(
        "Withdraw deployment attempt error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,
          error:
            "Failed to withdraw deployment schedule.",
        });
    } finally {
      await releaseConnection(
        connection
      );
    }
  };

/*
 * Test-only exports keep policy tests isolated from the live route surface.
 */
if (
  process.env.NODE_ENV ===
  "test"
) {
  exports.__test = {
    ATTEMPT_STATUS,
    WORKFORCE_STATUS,
    EMPLOYMENT_STATUS,
    SOURCE_EVENT,
    normalizeText,
    normalizeComparable,
    normalizeRole,
    parsePositiveInteger,
    isStrictDateString,
    isStrictTimeString,
    normalizeScheduledTime,
    getPhilippinesToday,
    getPhilippinesCurrentDateTime,
    getActor,
    coordinatorCanActOnAttempt,
    MOVEMENT_TYPE,
    normalizeMovementReportMonth,
    normalizeMovementReportYear,
    buildMovementReportPeriod,
    isDateInsideMovementPeriod,
    normalizeMovementSeparationType,
    createMovementSummaryBucket,
    addMovementToBucket,
    buildMovementSummary,
  };
}