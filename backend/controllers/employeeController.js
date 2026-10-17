const db = require("../config/db");

const {
  removeObject,
} = require("../services/storageService");

const {
  logAudit,
  AUDIT_CATEGORY,
} = require("../utils/auditLogger");

const {
  cleanupUnreferencedFileCandidates,
} = require("../utils/fileReferenceService");

const MANILA_CURRENT_DATE_SQL =
  "DATE(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'))";

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

function isValidCalendarDate(
  year,
  month,
  day
) {
  const probe =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  return (
    probe.getUTCFullYear() ===
      year &&
    probe.getUTCMonth() ===
      month - 1 &&
    probe.getUTCDate() ===
      day
  );
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

function normalizeBusinessDateValue(
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  let normalized = "";

  if (
    value instanceof Date
  ) {
    if (
      Number.isNaN(
        value.getTime()
      )
    ) {
      return null;
    }

    /*
     * mysql2 currently materializes MySQL DATE values
     * using the Node process local calendar. Preserve
     * those calendar components instead of converting
     * the DATE through UTC with toISOString().
     */
    const year =
      value.getFullYear();

    const month =
      String(
        value.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const day =
      String(
        value.getDate()
      ).padStart(
        2,
        "0"
      );

    normalized =
      `${year}-${month}-${day}`;
  } else {
    const trimmed =
      String(
        value
      ).trim();

    if (!trimmed) {
      return null;
    }

    const match =
      trimmed.match(
        /^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/
      );

    if (!match) {
      return null;
    }

    normalized =
      `${match[1]}-${match[2]}-${match[3]}`;
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      normalized
    );

  if (!match) {
    return null;
  }

  const year =
    Number(
      match[1]
    );

  const month =
    Number(
      match[2]
    );

  const day =
    Number(
      match[3]
    );

  if (
    !isValidCalendarDate(
      year,
      month,
      day
    )
  ) {
    return null;
  }

  return normalized;
}

function toNullableDate(value) {
  return normalizeBusinessDateValue(
    value
  );
}

function normalizeEmployeeBirthday(
  value
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return {
      value: null,
      error: "",
    };
  }

  const normalized =
    normalizeBusinessDateValue(
      value
    );

  if (!normalized) {
    return {
      value: null,
      error:
        "Birthday must be a valid date.",
    };
  }

  if (
    normalized >
    getPhilippinesToday()
  ) {
    return {
      value: null,
      error:
        "Birthday cannot be in the future.",
    };
  }

  return {
    value:
      normalized,
    error: "",
  };
}

function normalizeEmployeeBusinessDate(
  value,
  label
) {
  if (
    value === undefined ||
    value === null ||
    String(value).trim() === ""
  ) {
    return {
      value: null,
      error: "",
    };
  }

  const normalized =
    normalizeBusinessDateValue(
      value
    );

  if (!normalized) {
    return {
      value: null,
      error:
        `${label} must be a valid date.`,
    };
  }

  if (
    normalized >
    getPhilippinesToday()
  ) {
    return {
      value: null,
      error:
        `${label} cannot be in the future.`,
    };
  }

  return {
    value:
      normalized,
    error: "",
  };
}

const EMPLOYEE_STATUS =
  Object.freeze({
    DEPLOYED:
      "Deployed",

    FOR_DEPLOYMENT:
      "For Deployment",

    FLOATING_STANDBY:
      "Floating / Standby",

    /*
     * Legacy compatibility only.
     *
     * New workflow code separates employment state
     * from workforce state. Inactive remains readable
     * for historical/separated records while the
     * application is progressively migrated.
     */
    INACTIVE:
      "Inactive",
  });

const EMPLOYMENT_STATUS =
  Object.freeze({
    ACTIVE:
      "Active",

    RESIGNED:
      "Resigned",

    TERMINATED:
      "Terminated",
  });

const CREATE_EMPLOYEE_WORKFORCE_STATUSES =
  new Set([
    EMPLOYEE_STATUS.DEPLOYED,
    EMPLOYEE_STATUS.FLOATING_STANDBY,
  ]);

/*
 * LEGACY DEPLOYMENT SEPARATION COMPATIBILITY
 *
 * Production deployment_assignments rows currently store
 * "Cancelled" as the internal lifecycle value when an active
 * assignment ends because of an employee separation.
 *
 * That database value is intentionally preserved until the
 * dedicated lifecycle migration is performed. HR-facing code
 * must present the actual outcome (Resigned, AWOL, Terminated,
 * Other Separation, or a neutral Ended fallback) instead of
 * exposing the legacy lifecycle wording.
 */
const LEGACY_SEPARATION_DEPLOYMENT_STATUS =
  "Cancelled";

function getDeploymentDisplayStatus(
  deploymentStatus,
  endReason,
  endRemarks = ""
) {
  const normalizedStatus =
    String(
      deploymentStatus || ""
    )
      .trim()
      .toLowerCase();

  if (
    normalizedStatus !==
      "cancelled" &&
    normalizedStatus !==
      "canceled"
  ) {
    return (
      toNullable(
        deploymentStatus
      ) ||
      "Pending"
    );
  }

  const remarks =
    String(
      endRemarks || ""
    ).trim();

  if (
    remarks.startsWith(
      "[Other Separation]"
    )
  ) {
    return "Other Separation";
  }

  const reason =
    toNullable(
      endReason
    );

  if (
    reason === "Resigned" ||
    reason === "AWOL" ||
    reason === "Terminated"
  ) {
    return reason;
  }

  return "Ended";
}

const EMPLOYEE_STATUS_ALIASES =
  Object.freeze({
    deployed:
      EMPLOYEE_STATUS.DEPLOYED,

    "active deployed":
      EMPLOYEE_STATUS.DEPLOYED,

    "for deployment":
      EMPLOYEE_STATUS.FOR_DEPLOYMENT,

    "for-deployment":
      EMPLOYEE_STATUS.FOR_DEPLOYMENT,

    floating:
      EMPLOYEE_STATUS.FLOATING_STANDBY,

    pooling:
      EMPLOYEE_STATUS.FLOATING_STANDBY,

    standby:
      EMPLOYEE_STATUS.FLOATING_STANDBY,

    "floating / standby":
      EMPLOYEE_STATUS.FLOATING_STANDBY,

    "floating/standby":
      EMPLOYEE_STATUS.FLOATING_STANDBY,

    inactive:
      EMPLOYEE_STATUS.INACTIVE,
  });

function normalizeEmployeeStatus(
  value
) {
  const normalized =
    toNullable(value);

  if (!normalized) {
    return null;
  }

  return (
    EMPLOYEE_STATUS_ALIASES[
      normalized.toLowerCase()
    ] || null
  );
}

function resolveCreateEmployeeStatus(
  value
) {
  const normalized =
    normalizeEmployeeStatus(
      value
    );

  if (
    !normalized ||
    !CREATE_EMPLOYEE_WORKFORCE_STATUSES.has(
      normalized
    )
  ) {
    return null;
  }

  return normalized;
}

function normalizeComparableText(
  value
) {
  return String(
    value ?? ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    )
    .toLowerCase();
}

function isSameText(
  left,
  right
) {
  return (
    normalizeComparableText(
      left
    ) ===
    normalizeComparableText(
      right
    )
  );
}

const EMPLOYEE_DOCUMENT_NUMBER_MAX_LENGTH =
  64;

const EMPLOYEE_DOCUMENT_NUMBER_RULES =
  Object.freeze({
    "sss (id or e1 form)": {
      label:
        "SSS Number",
    },

    "pag-ibig (id or mdrf form)": {
      label:
        "Pag-IBIG MID Number",
    },

    "philhealth (id or mdf form)": {
      label:
        "PhilHealth Number",
    },
  });

function normalizeEmployeeDocumentNumber(
  value
) {
  const normalized =
    String(
      value ?? ""
    )
      .trim()
      .replace(
        /\s+/g,
        " "
      );

  return normalized ||
    null;
}

function getEmployeeDocumentNumberRule(
  documentName
) {
  const key =
    normalizeComparableText(
      documentName
    );

  return (
    EMPLOYEE_DOCUMENT_NUMBER_RULES[
      key
    ] || null
  );
}

function validateEmployeeDocumentNumbers(
  documents,
  existingDocuments = null
) {
  const safeDocuments =
    Array.isArray(
      documents
    )
      ? documents
      : [];

  const hasExistingDocumentContext =
    Array.isArray(
      existingDocuments
    );

  const safeExistingDocuments =
    hasExistingDocumentContext
      ? existingDocuments
      : [];

  for (
    const document of
    safeDocuments
  ) {
    const rule =
      getEmployeeDocumentNumberRule(
        document?.name
      );

    if (!rule) {
      continue;
    }

    const documentNumber =
      normalizeEmployeeDocumentNumber(
        document?.documentNumber
      );

    if (documentNumber) {
      if (
        documentNumber.length >
        EMPLOYEE_DOCUMENT_NUMBER_MAX_LENGTH
      ) {
        return `${rule.label} must not exceed ${EMPLOYEE_DOCUMENT_NUMBER_MAX_LENGTH} characters.`;
      }

      if (
        !/^[0-9 -]+$/.test(
          documentNumber
        ) ||
        !/\d/.test(
          documentNumber
        )
      ) {
        return `${rule.label} may only contain numbers, spaces, and hyphens.`;
      }

      continue;
    }

    /*
     * CREATE:
     * A newly submitted government compliance
     * document must include its readable reference
     * number.
     */
    if (
      !hasExistingDocumentContext
    ) {
      return `${rule.label} is required for ${document.name}.`;
    }

    const existingDocument =
      safeExistingDocuments.find(
        (existing) =>
          normalizeComparableText(
            existing?.name
          ) ===
          normalizeComparableText(
            document?.name
          )
      );

    const existingDocumentNumber =
      normalizeEmployeeDocumentNumber(
        existingDocument?.document_number ??
          existingDocument?.documentNumber
      );

    /*
     * UPDATE LEGACY COMPATIBILITY:
     *
     * Historical production rows pre-date the
     * structured document_number column. Allow an
     * unrelated employee edit to preserve such a
     * legacy government document without forcing HR
     * Staff to invent or immediately re-encode a
     * number.
     *
     * A number becomes required when:
     * - the government document is newly added,
     * - its scan/photo is being replaced, or
     * - an already recorded structured number is
     *   being cleared.
     */
    if (
      !existingDocument ||
      document?.hasNewFile ||
      existingDocumentNumber
    ) {
      return `${rule.label} is required for ${document.name}.`;
    }
  }

  return "";
}

/*
 * DEPLOYMENT MASTER-DATA VALIDATION
 *
 * New deployment assignments must reference an
 * ACTIVE client company and an ACTIVE position that
 * belongs to that company.
 *
 * Existing active assignments are allowed to retain
 * historical/deactivated company-position snapshots
 * when unrelated employee fields are edited.
 *
 * FOR UPDATE keeps the selected master rows stable
 * until the employee/deployment transaction commits.
 */
async function resolveActiveDeploymentMasterPair(
  connection,
  companyValue,
  positionValue
) {
  const requestedCompany =
    toNullable(
      companyValue
    );

  const requestedPosition =
    toNullable(
      positionValue
    );

  if (
    !requestedCompany ||
    !requestedPosition
  ) {
    return null;
  }

  const [
    rows,
  ] =
    await connection.query(
      `
      SELECT
        c.id AS company_id,
        c.company_name,
        p.id AS position_id,
        p.position_name
      FROM client_companies AS c
      INNER JOIN company_positions AS p
        ON p.company_id = c.id
      WHERE c.is_active = 1
        AND p.is_active = 1
        AND LOWER(
          TRIM(
            c.company_name
          )
        ) =
        LOWER(
          TRIM(?)
        )
        AND LOWER(
          TRIM(
            p.position_name
          )
        ) =
        LOWER(
          TRIM(?)
        )
      LIMIT 1
      FOR UPDATE
      `,
      [
        requestedCompany,
        requestedPosition,
      ]
    );

  if (
    rows.length === 0
  ) {
    return null;
  }

  return {
    companyId:
      Number(
        rows[0].company_id
      ),

    companyName:
      toNullable(
        rows[0].company_name
      ),

    positionId:
      Number(
        rows[0].position_id
      ),

    positionName:
      toNullable(
        rows[0].position_name
      ),
  };
}

/*
 * TRUSTED AUDIT ACTOR
 *
 * Actor identity comes only from req.user,
 * which is populated by verified JWT middleware.
 *
 * Client-supplied identity or role fields are
 * never authoritative for audit attribution.
 */
function getActor(req) {
  const authenticatedUser =
    req.user || {};

  const userId =
    authenticatedUser.userId ??
    authenticatedUser.id;

  const username =
    toNullable(
      authenticatedUser.username
    ) || "Unknown User";

  return {
    userId:
      toNullable(userId),

    username,

    fullName:
      username,

    role:
      toNullable(
        authenticatedUser.role
      ),
  };
}

/*
 * HR COORDINATOR COMPANY SCOPE
 *
 * authMiddleware supplies the canonical current role
 * and assigned company from the database on every
 * protected request.
 *
 * These helpers are defensive only. Controllers never
 * trust company values supplied through req.body,
 * req.query, or route parameters for coordinator scope.
 */
function isHrCoordinatorRequest(
  req
) {
  return (
    String(
      req.user?.role || ""
    )
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_") ===
    "HR_COORDINATOR"
  );
}

function getHrCoordinatorAssignedCompany(
  req
) {
  return toNullable(
    req.user?.assignedCompany ??
      req.user?.assigned_company
  );
}

function buildHrCoordinatorEmployeeScopeSql(
  employeeAlias = "e",
  deploymentAlias = "da_scope",
  attemptAlias = "dpa_scope"
) {
  return `
    ${employeeAlias}.archived = 0
    AND ${employeeAlias}.employment_status = 'Active'
    AND LOWER(
      TRIM(
        COALESCE(
          ${employeeAlias}.company,
          ''
        )
      )
    ) = LOWER(TRIM(?))
    AND (
      (
        ${employeeAlias}.workforce_status = 'Deployed'
        AND EXISTS (
          SELECT 1
          FROM deployment_assignments AS ${deploymentAlias}
          WHERE ${deploymentAlias}.employee_id = ${employeeAlias}.id
            AND ${deploymentAlias}.status = 'Active'
            AND LOWER(
              TRIM(
                ${deploymentAlias}.company
              )
            ) = LOWER(
              TRIM(
                ${employeeAlias}.company
              )
            )
        )
      )
      OR
      (
        ${employeeAlias}.workforce_status = 'For Deployment'
        AND EXISTS (
          SELECT 1
          FROM deployment_attempts AS ${attemptAlias}
          WHERE ${attemptAlias}.employee_id = ${employeeAlias}.id
            AND ${attemptAlias}.status = 'For Deployment'
            AND LOWER(
              TRIM(
                ${attemptAlias}.company
              )
            ) = LOWER(
              TRIM(
                ${employeeAlias}.company
              )
            )
        )
      )
    )
  `;
}

/*
 * UPLOADED-FILE COMPENSATION
 *
 * Multer saves files before the controller runs.
 *
 * If employee validation fails before a transaction
 * begins, or if a create/update DB transaction
 * fails and rolls back successfully, remove only
 * files uploaded by that failed request.
 *
 * Pre-existing employee files are intentionally
 * never deleted by this helper.
 */
async function cleanupUploadedFiles(
  files
) {
  const uploadedFiles =
    Array.isArray(files)
      ? files
      : [];

  for (
    const file of
    uploadedFiles
  ) {
    const objectPath =
      toNullable(
        file?.storagePath ||
        file?.path
      );

    if (!objectPath) {
      continue;
    }

    try {
      await removeObject(
        objectPath
      );
    } catch (error) {
      console.error(
        "EMPLOYEE CLOUD FILE CLEANUP ERROR:",
        {
          objectPath,

          message:
            error?.message ||
            error,
        }
      );
    }
  }
}

/*
 * POST-COMMIT HISTORICAL FILE CLEANUP
 *
 * Historical/pre-existing files must only be
 * considered for physical deletion after the
 * database mutation has committed.
 *
 * Any cleanup failure is intentionally isolated
 * from the already committed employee operation.
 * The reference-aware service itself fails closed,
 * but this wrapper prevents an unexpected cleanup
 * exception from turning a successful DB mutation
 * into an HTTP 500 response.
 */
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
      "EMPLOYEE HISTORICAL FILE CLEANUP ERROR:",
      {
        source,

        message:
          error?.message ||
          error,
      }
    );
  }
}

/*
 * EARLY EMPLOYEE VALIDATION REJECTION
 *
 * Employee document uploads are processed before
 * the controller executes.
 *
 * If normal employee-field validation fails before
 * a DB transaction begins, compensate by deleting
 * only the files uploaded by the current request
 * before returning HTTP 400.
 */
async function rejectEmployeeRequest(
  req,
  res,
  message
) {
  await cleanupUploadedFiles(
    req.files
  );

  return res
    .status(400)
    .json({
      error:
        message,
    });
}

async function getEmployeeNameById(id) {
  const [rows] = await db
    .promise()
    .query(
      `
      SELECT name
      FROM employees
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

  if (rows.length === 0) {
    return null;
  }

  return (
    rows[0]?.name ||
    "Unknown Employee"
  );
}

const extractDocumentsFromReq = (
  req
) => {
  const documents = [];

  for (
    let i = 0;
    i < 20;
    i++
  ) {
    let docName = null;
    let expDate = null;
    let documentNumber = null;

    if (
      req.body.documents &&
      req.body.documents[i]
    ) {
      docName =
        req.body.documents[
          i
        ].name;

      expDate =
        req.body.documents[
          i
        ].expirationDate;

      documentNumber =
        req.body.documents[
          i
        ].documentNumber ??
        req.body.documents[
          i
        ].document_number;
    } else if (
      req.body[
        `documents[${i}][name]`
      ] !== undefined
    ) {
      docName =
        req.body[
          `documents[${i}][name]`
        ];

      expDate =
        req.body[
          `documents[${i}][expirationDate]`
        ];

      documentNumber =
        req.body[
          `documents[${i}][documentNumber]`
        ] ??
        req.body[
          `documents[${i}][document_number]`
        ];
    }

    const file =
      req.files?.find(
        (item) =>
          item.fieldname ===
          `documents[${i}]`
      );

    const filePath =
      file
        ? `documents/employees/${file.filename}`
        : null;

    if (
      docName ||
      file
    ) {
      documents.push({
        name:
          toNullable(
            docName
          ) ||
          (
            file
              ? file.originalname
              : "Unknown"
          ),

        expirationDate:
          toNullableDate(
            expDate
          ),

        documentNumber:
          normalizeEmployeeDocumentNumber(
            documentNumber
          ),

        filePath,

        hasNewFile:
          Boolean(file),
      });
    }
  }

  return documents;
};

/*
 * ==================================================
 * CREATE EMPLOYEE
 * PHASE 8A — TRANSACTION SAFE
 * ==================================================
 *
 * Atomic DB unit:
 *
 * employees INSERT
 * +
 * employee_documents INSERT(s)
 *
 * On validation failure:
 * remove newly uploaded request files
 * +
 * return HTTP 400
 *
 * On DB failure:
 * ROLLBACK
 * +
 * remove only newly uploaded request files
 */
exports.createEmployee = async (
  req,
  res
) => {
  let connection = null;

  let transactionStarted =
    false;

  let transactionCommitted =
    false;

  try {
    const {
      name,
      birthday,
      company,
      position,
      status,
      contractStart,
    } = req.body;

    const dateHiredInput =
      req.body?.dateHired ??
      req.body?.date_hired;

    const actor =
      getActor(req);

    const finalName =
      toNullable(name);

    const {
      value:
        finalBirthday,
      error:
        birthdayError,
    } =
      normalizeEmployeeBirthday(
        birthday
      );

    if (birthdayError) {
      return await rejectEmployeeRequest(
        req,
        res,
        birthdayError
      );
    }

    const {
      value:
        finalDateHired,
      error:
        dateHiredError,
    } =
      normalizeEmployeeBusinessDate(
        dateHiredInput,
        "Date Hired"
      );

    if (dateHiredError) {
      return await rejectEmployeeRequest(
        req,
        res,
        dateHiredError
      );
    }

    if (!finalDateHired) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Date Hired is required."
      );
    }

    const submittedStatus =
      toNullable(status);

    /*
     * New records default to Pooling.
     *
     * "Deployed" is allowed only for onboarding an
     * employee who was already actually deployed before
     * being encoded in the HRIS.
     *
     * "For Deployment" can never be created here. It is
     * entered only through the deployment-attempt workflow.
     */
    const finalStatus =
      submittedStatus
        ? resolveCreateEmployeeStatus(
            submittedStatus
          )
        : EMPLOYEE_STATUS.FLOATING_STANDBY;

    if (!finalStatus) {
      return await rejectEmployeeRequest(
        req,
        res,
        "New employees must be either Floating / Standby (Pooling) or already Deployed."
      );
    }

    let finalCompany =
      toNullable(
        company
      );

    let finalPosition =
      toNullable(
        position
      );

    const {
      value:
        submittedDeploymentStart,
      error:
        deploymentStartError,
    } =
      normalizeEmployeeBusinessDate(
        contractStart,
        "Deployment start date"
      );

    if (
      finalStatus ===
        EMPLOYEE_STATUS.DEPLOYED &&
      deploymentStartError
    ) {
      return await rejectEmployeeRequest(
        req,
        res,
        deploymentStartError
      );
    }

    const finalContractStart =
      finalStatus ===
      EMPLOYEE_STATUS.DEPLOYED
        ? submittedDeploymentStart
        : null;

    if (!finalName) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Employee name is required."
      );
    }

    /*
     * Pooling in WellJob already has a designated
     * company and position. These fields describe
     * intended/current placement, not deployment history.
     */
    if (!finalCompany) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Designated company is required."
      );
    }

    if (!finalPosition) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Designated position is required."
      );
    }

    if (
      finalStatus ===
        EMPLOYEE_STATUS.DEPLOYED &&
      !finalContractStart
    ) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Deployment start date is required for an already deployed employee."
      );
    }

    if (
      finalContractStart &&
      finalContractStart <
        finalDateHired
    ) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Deployment start date cannot be earlier than Date Hired."
      );
    }

    const documents =
      extractDocumentsFromReq(
        req
      );

    const documentNumberError =
      validateEmployeeDocumentNumbers(
        documents
      );

    if (documentNumberError) {
      return await rejectEmployeeRequest(
        req,
        res,
        documentNumberError
      );
    }

    connection =
      await db
        .promise()
        .getConnection();

    await connection
      .beginTransaction();

    transactionStarted =
      true;

    const rejectAfterRollback =
      async (
        statusCode,
        message
      ) => {
        await connection.rollback();

        transactionStarted =
          false;

        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(statusCode)
          .json({
            error:
              message,
          });
      };

    /*
     * Designation choices must come from the active
     * company-position master list for both Pooling and
     * already-Deployed onboarding.
     */
    const masterPair =
      await resolveActiveDeploymentMasterPair(
        connection,
        finalCompany,
        finalPosition
      );

    if (!masterPair) {
      return await rejectAfterRollback(
        400,
        "Company and position must be an active configured deployment combination."
      );
    }

    finalCompany =
      masterPair.companyName;

    finalPosition =
      masterPair.positionName;

    const [result] =
      await connection.query(
        `
        INSERT INTO employees
        (
          name,
          birthday,
          date_hired,
          company,
          position,
          status,
          employment_status,
          workforce_status,
          contractStart
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          finalName,
          finalBirthday,
          finalDateHired,
          finalCompany,
          finalPosition,
          finalStatus,
          EMPLOYMENT_STATUS.ACTIVE,
          finalStatus,
          finalContractStart,
        ]
      );

    const employeeId =
      result.insertId;

    /*
     * Employment history uses the real WellJob hire date.
     * created_at still records when the HRIS row was encoded.
     */
    await connection.query(
      `
      INSERT INTO employee_employment_history
      (
        employee_id,
        from_status,
        to_status,
        effective_at,
        reason,
        remarks,
        source_event,
        changed_by_user_id
      )
      VALUES (?, NULL, ?, ?, ?, NULL, ?, ?)
      `,
      [
        employeeId,
        EMPLOYMENT_STATUS.ACTIVE,
        `${finalDateHired} 00:00:00`,
        "Initial employee onboarding",
        "EMPLOYMENT_ONBOARDED",
        actor.userId,
      ]
    );

    /*
     * Workforce history distinguishes:
     *
     * - Pooling onboarding: no actual assignment exists.
     * - Existing deployed onboarding: actual historical
     *   start date is preserved without fabricating a
     *   For Deployment attempt or Coordinator confirmation.
     */
    await connection.query(
      `
      INSERT INTO employee_status_history
      (
        employee_id,
        from_status,
        to_status,
        effective_at,
        reason,
        source_event,
        changed_by_user_id
      )
      VALUES (?, NULL, ?, ?, ?, ?, ?)
      `,
      [
        employeeId,
        finalStatus,
        `${
          finalStatus ===
          EMPLOYEE_STATUS.DEPLOYED
            ? finalContractStart
            : finalDateHired
        } 00:00:00`,
        finalStatus ===
        EMPLOYEE_STATUS.DEPLOYED
          ? "Existing deployment onboarded"
          : "Employee entered Pooling",
        finalStatus ===
        EMPLOYEE_STATUS.DEPLOYED
          ? "INITIAL_DEPLOYMENT_ONBOARDING"
          : "EMPLOYEE_POOLING_ONBOARDED",
        actor.userId,
      ]
    );

    /*
     * Existing already-deployed employees receive one
     * authoritative Active assignment immediately.
     *
     * Pooling employees intentionally receive no
     * deployment_attempt and no deployment_assignment.
     */
    if (
      finalStatus ===
      EMPLOYEE_STATUS.DEPLOYED
    ) {
      await connection.query(
        `
        INSERT INTO deployment_assignments
        (
          employee_id,
          company,
          position,
          start_date,
          status,
          created_by_user_id
        )
        VALUES (?, ?, ?, ?, 'Active', ?)
        `,
        [
          employeeId,
          finalCompany,
          finalPosition,
          finalContractStart,
          actor.userId,
        ]
      );
    }

    for (
      const doc of documents
    ) {
      await connection.query(
        `
        INSERT INTO employee_documents
        (
          employee_id,
          name,
          document_number,
          expiration_date,
          file_path
        )
        VALUES (?, ?, ?, ?, ?)
        `,
        [
          employeeId,
          doc.name,
          doc.documentNumber,
          doc.expirationDate,
          doc.filePath,
        ]
      );
    }

    await connection.commit();

    transactionCommitted =
      true;

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

      action:
        finalStatus ===
        EMPLOYEE_STATUS.DEPLOYED
          ? "ONBOARD_EXISTING_DEPLOYED_EMPLOYEE"
          : "ADD_POOLING_EMPLOYEE",

      description:
        finalStatus ===
        EMPLOYEE_STATUS.DEPLOYED
          ? `${actor.fullName} onboarded existing deployed employee record for ${finalName}.`
          : `${actor.fullName} added employee ${finalName} to Floating / Standby (Pooling).`,
    });

    return res
      .status(201)
      .json({
        success: true,

        message:
          finalStatus ===
          EMPLOYEE_STATUS.DEPLOYED
            ? "Existing deployed employee added successfully."
            : "Employee added to Pooling successfully.",

        id:
          employeeId,

        employmentStatus:
          EMPLOYMENT_STATUS.ACTIVE,

        workforceStatus:
          finalStatus,
      });
  } catch (err) {
    let rollbackSucceeded =
      !transactionStarted;

    if (
      connection &&
      transactionStarted &&
      !transactionCommitted
    ) {
      try {
        await connection.rollback();

        rollbackSucceeded =
          true;
      } catch (
        rollbackError
      ) {
        rollbackSucceeded =
          false;

        console.error(
          "CREATE EMPLOYEE ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    if (
      !transactionCommitted &&
      rollbackSucceeded
    ) {
      await cleanupUploadedFiles(
        req.files
      );
    }

    console.error(
      "CREATE EMPLOYEE ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Create employee error",
      });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

function normalizeEmployeeLookupName(
  value
) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 255);
}

/*
 * ==================================================
 * EMPLOYEE FORM META
 * ==================================================
 *
 * Returns a display-only next ID preview and,
 * when a name is supplied, the matching employee
 * needed for duplicate-name verification.
 */
exports.getEmployeeFormMeta = async (
  req,
  res
) => {
  try {
    const name =
      normalizeEmployeeLookupName(
        req.query?.name
      );

    const excludeIdValue =
      String(
        req.query?.excludeId ??
          ""
      ).trim();

    let excludeId = null;

    if (excludeIdValue) {
      const parsedExcludeId =
        Number.parseInt(
          excludeIdValue,
          10
        );

      if (
        !Number.isInteger(
          parsedExcludeId
        ) ||
        parsedExcludeId <= 0
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid excluded employee ID.",
          });
      }

      excludeId =
        parsedExcludeId;
    }

    const nextIdQuery =
      db.promise().query(`
        SELECT
          COALESCE(
            (
              SELECT
                AUTO_INCREMENT
              FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'employees'
              LIMIT 1
            ),
            (
              SELECT
                COALESCE(
                  MAX(id),
                  0
                ) + 1
              FROM employees
            ),
            1
          ) AS next_employee_id
      `);

    let duplicateQuery =
      Promise.resolve([
        [],
        [],
      ]);

    if (name) {
      const duplicateSql = `
        SELECT
          id,
          name,
          date_hired,
          company,
          position,
          status,
          employment_status,
          workforce_status,
          archived
        FROM employees
        WHERE LOWER(TRIM(name)) =
          LOWER(?)
        ${
          excludeId
            ? "AND id <> ?"
            : ""
        }
        ORDER BY
          archived ASC,
          created_at DESC,
          id DESC
        LIMIT 1
      `;

      const duplicateParams =
        excludeId
          ? [
              name,
              excludeId,
            ]
          : [
              name,
            ];

      duplicateQuery =
        db.promise().query(
          duplicateSql,
          duplicateParams
        );
    }

    const [
      nextIdResult,
      duplicateResult,
    ] = await Promise.all([
      nextIdQuery,
      duplicateQuery,
    ]);

    const [nextIdRows] =
      nextIdResult;

    const [duplicateRows] =
      duplicateResult;

    const nextEmployeeId =
      Number(
        nextIdRows[
          0
        ]?.next_employee_id ||
          1
      );

    return res.json({
      employeeIdPreview:
        `EMP${String(
          nextEmployeeId
        ).padStart(
          3,
          "0"
        )}`,

      duplicateEmployee:
        duplicateRows[
          0
        ] || null,
    });
  } catch (err) {
    console.error(
      "FETCH EMPLOYEE FORM META ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Fetch employee form metadata error",
      });
  }
};

const REQUIRED_EMPLOYEE_DOCUMENT_NAMES =
  Object.freeze([
    "resume",
    "nso/psa",
    "sss (id or e1 form)",
    "pag-ibig (id or mdrf form)",
    "philhealth (id or mdf form)",
    "diploma",
    "cedula",
    "barangay clearance",
    "nbi/police clearance",
  ]);

const EXPIRABLE_EMPLOYEE_DOCUMENT_NAMES =
  Object.freeze([
    "barangay clearance",
    "nbi/police clearance",
  ]);

const EMPLOYEE_COMPLIANCE_STATUSES =
  new Set([
    "Complete",
    "Expiring Soon",
    "Expired",
    "Incomplete",
    "No Data",
  ]);

const EMPLOYEE_SUMMARY_SORTS =
  new Set([
    "latest",
    "name-asc",
    "name-desc",
    "expired-first",
    "expiring-first",
  ]);

const EMPLOYEE_SUMMARY_SCOPES =
  new Set([
    "active",
    "archived",
    "all",
  ]);

const DEFAULT_EMPLOYEE_PAGE_SIZE =
  50;

const MAX_EMPLOYEE_PAGE_SIZE =
  100;

function toPositiveInteger(
  value,
  fallback
) {
  const parsed =
    Number.parseInt(
      String(value ?? ""),
      10
    );

  return (
    Number.isInteger(parsed) &&
    parsed > 0
  )
    ? parsed
    : fallback;
}

function normalizeEmployeeSummarySearch(
  value
) {
  return String(value || "")
    .trim()
    .slice(0, 100);
}

function resolveEmployeeComplianceStatus(
  summary
) {
  const documentCount =
    Number(
      summary?.document_count ||
        0
    );

  if (documentCount === 0) {
    return "No Data";
  }

  if (
    Number(
      summary?.expired_count ||
        0
    ) > 0
  ) {
    return "Expired";
  }

  if (
    Number(
      summary?.expiring_soon_count ||
        0
    ) > 0
  ) {
    return "Expiring Soon";
  }

  if (
    Number(
      summary?.complete_required_count ||
        0
    ) <
    REQUIRED_EMPLOYEE_DOCUMENT_NAMES.length
  ) {
    return "Incomplete";
  }

  return "Complete";
}

function getEmployeeSummarySortSql(
  sortBy,
  complianceStatusSql = ""
) {
  if (sortBy === "name-asc") {
    return "e.name ASC, e.id ASC";
  }

  if (sortBy === "name-desc") {
    return "e.name DESC, e.id DESC";
  }

  if (
    sortBy === "expired-first" ||
    sortBy === "expiring-first"
  ) {
    return `
      CASE ${complianceStatusSql}
        WHEN 'Expired' THEN 1
        WHEN 'Expiring Soon' THEN 2
        WHEN 'Incomplete' THEN 3
        WHEN 'Complete' THEN 4
        WHEN 'No Data' THEN 5
        ELSE 6
      END ASC,
      e.name ASC,
      e.id ASC
    `;
  }

  return "e.created_at DESC, e.id DESC";
}

function buildEmployeeSummaryFilters({
  scope,
  search,
  status,
  company,
  compliance,
  complianceStatusSql = "",
  coordinatorCompany = null,
}) {
  const where = [];
  const params = [];

  /*
   * Coordinator scope includes only:
   * - currently Deployed employees at the assigned company
   * - employees currently For Deployment to the assigned company
   *
   * Ordinary Floating / Standby (Pooling) employees remain hidden
   * even though they already have a designated company + position.
   */
  if (coordinatorCompany) {
    where.push(
      buildHrCoordinatorEmployeeScopeSql(
        "e",
        "da_scope",
        "dpa_scope"
      )
    );

    params.push(
      coordinatorCompany
    );
  }

  if (scope === "active") {
    where.push(
      "e.archived = 0",
      "e.employment_status = 'Active'"
    );
  } else if (
    scope === "archived"
  ) {
    where.push(
      `(
        e.archived = 1
        OR e.employment_status IN ('Resigned', 'Terminated')
        OR e.status = 'Inactive'
      )`
    );
  }

  if (search) {
    const searchPattern =
      `%${search.toLowerCase()}%`;

    where.push(`
      (
        CAST(e.id AS CHAR) LIKE ?
        OR LOWER(e.name) LIKE ?
        OR LOWER(COALESCE(e.company, '')) LIKE ?
        OR LOWER(COALESCE(e.position, '')) LIKE ?
        OR EXISTS (
          SELECT 1
          FROM deployment_assignments AS da_search
          WHERE da_search.employee_id = e.id
            AND LOWER(COALESCE(da_search.position, '')) LIKE ?
        )
      )
    `);

    params.push(
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern,
      searchPattern
    );
  }

  if (
    company &&
    company !== "All" &&
    !coordinatorCompany
  ) {
    where.push(
      "LOWER(TRIM(COALESCE(e.company, ''))) = LOWER(TRIM(?))"
    );

    params.push(
      company
    );
  }

  if (
    status &&
    status !== "All"
  ) {
    if (
      status ===
      EMPLOYEE_STATUS.INACTIVE
    ) {
      where.push(
        "e.status = 'Inactive'"
      );
    } else {
      where.push(
        "e.workforce_status = ?"
      );

      params.push(
        status
      );
    }
  }

  if (
    compliance &&
    compliance !== "All"
  ) {
    where.push(
      `${complianceStatusSql} = ?`
    );

    params.push(
      compliance
    );
  }

  return {
    whereSql:
      where.length > 0
        ? `WHERE ${where.join(
            "\nAND "
          )}`
        : "",

    params,
  };
}

function createEmployeeComplianceSql(
  employeeIds = []
) {
  const requiredNames =
    REQUIRED_EMPLOYEE_DOCUMENT_NAMES
      .map(() => "?")
      .join(", ");

  const expirableNames =
    EXPIRABLE_EMPLOYEE_DOCUMENT_NAMES
      .map(() => "?")
      .join(", ");

  const normalizedEmployeeIds =
    Array.isArray(
      employeeIds
    )
      ? employeeIds
          .map((id) =>
            Number.parseInt(
              String(id),
              10
            )
          )
          .filter(
            Number.isInteger
          )
      : [];

  const employeeFilterSql =
    normalizedEmployeeIds.length > 0
      ? `
        WHERE d.employee_id IN (
          ${normalizedEmployeeIds
            .map(() => "?")
            .join(", ")}
        )
      `
      : "";

  const aggregateSql = `
    SELECT
      d.employee_id,
      COUNT(*) AS document_count,
      COUNT(
        DISTINCT CASE
          WHEN
            LOWER(TRIM(d.name)) IN (${requiredNames})
            AND TRIM(COALESCE(d.file_path, '')) <> ''
            AND (
              LOWER(TRIM(d.name)) NOT IN (${expirableNames})
              OR d.expiration_date IS NOT NULL
            )
          THEN LOWER(TRIM(d.name))
          ELSE NULL
        END
      ) AS complete_required_count,
      MAX(
        CASE
          WHEN
            LOWER(TRIM(d.name)) IN (${expirableNames})
            AND TRIM(COALESCE(d.file_path, '')) <> ''
            AND d.expiration_date < ${MANILA_CURRENT_DATE_SQL}
          THEN 1
          ELSE 0
        END
      ) AS expired_count,
      MAX(
        CASE
          WHEN
            LOWER(TRIM(d.name)) IN (${expirableNames})

            AND TRIM(COALESCE(d.file_path, '')) <> ''
            AND d.expiration_date BETWEEN
              ${MANILA_CURRENT_DATE_SQL}
              AND DATE_ADD(
                ${MANILA_CURRENT_DATE_SQL},
                INTERVAL 30 DAY
              )
          THEN 1
          ELSE 0
        END
      ) AS expiring_soon_count
    FROM employee_documents AS d
    ${employeeFilterSql}
    GROUP BY d.employee_id
  `;

  const params = [
    ...REQUIRED_EMPLOYEE_DOCUMENT_NAMES,
    ...EXPIRABLE_EMPLOYEE_DOCUMENT_NAMES,
    ...EXPIRABLE_EMPLOYEE_DOCUMENT_NAMES,
    ...EXPIRABLE_EMPLOYEE_DOCUMENT_NAMES,
    ...normalizedEmployeeIds,
  ];

  return {
    aggregateSql,
    params,
  };
}

/*
 * ==================================================
 * GET EMPLOYEES
 * ==================================================
 *
 * Default mode preserves the existing full response.
 * view=summary provides a paginated lightweight list.
 */
exports.getEmployees = async (
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

    /*
     * Defense in depth.
     *
     * authMiddleware already fails closed when an
     * HR Coordinator has no assigned company. Keep
     * the same rule here so this controller can never
     * accidentally fall back to an unrestricted query.
     */
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

    if (view === "summary") {
      const page =
        toPositiveInteger(
          req.query?.page,
          1
        );

      const requestedPageSize =
        toPositiveInteger(
          req.query?.pageSize,
          DEFAULT_EMPLOYEE_PAGE_SIZE
        );

      const pageSize =
        Math.min(
          requestedPageSize,
          MAX_EMPLOYEE_PAGE_SIZE
        );

      const offset =
        (page - 1) *
        pageSize;

      const search =
        normalizeEmployeeSummarySearch(
          req.query?.search
        );

      const scopeInput =
        String(
          req.query?.scope ||
            "active"
        )
          .trim()
          .toLowerCase();

      /*
       * HR Coordinator may never use archived/all
       * employee scopes, even through a manual API
       * request. Their employee view is always the
       * current active company assignment scope.
       */
      const scope =
        isHrCoordinator
          ? "active"
          : (
              EMPLOYEE_SUMMARY_SCOPES.has(
                scopeInput
              )
                ? scopeInput
                : "active"
            );

      const sortInput =
        String(
          req.query?.sort ||
            "latest"
        ).trim();

      const sortBy =
        EMPLOYEE_SUMMARY_SORTS.has(
          sortInput
        )
          ? sortInput
          : "latest";

      const statusInput =
        String(
          req.query?.status ||
            "All"
        ).trim();

      const status =
        statusInput === "All"
          ? "All"
          : normalizeEmployeeStatus(
              statusInput
            );

      if (!status) {
        return res
          .status(400)
          .json({
            error:
              "Invalid employee status filter.",
          });
      }

      const requestedCompany =
        String(
          req.query?.company ||
            "All"
        ).trim();

      /*
       * HR Coordinator company scope is always derived
       * from the authenticated account. A query-string
       * company value must never override that scope.
       */
      const company =
        isHrCoordinator
          ? "All"
          : (
              requestedCompany &&
              requestedCompany !== "All"
                ? requestedCompany
                : "All"
            );

      const compliance =
        String(
          req.query?.compliance ||
            "All"
        ).trim();

      if (
        compliance !== "All" &&
        !EMPLOYEE_COMPLIANCE_STATUSES.has(
          compliance
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid compliance filter.",
          });
      }

      const complianceSensitiveSort =
        sortBy === "expired-first" ||
        sortBy === "expiring-first";

      const needsGlobalCompliance =
        compliance !== "All" ||
        complianceSensitiveSort;

      const activeTotalParams =
        [];

      const activeTotalCoordinatorSql =
        isHrCoordinator
          ? `
            AND
              ${buildHrCoordinatorEmployeeScopeSql(
                "e",
                "da_active_total",
                "dpa_active_total"
              )}
          `
          : "";

      if (isHrCoordinator) {
        activeTotalParams.push(
          coordinatorCompany
        );
      }

      const activeTotalSql = `
        SELECT
          COUNT(*) AS total
        FROM employees AS e
        WHERE e.archived = 0
          AND e.employment_status = 'Active'
          ${activeTotalCoordinatorSql}
      `;

      const companyOptionWhere = [];
      const companyOptionParams = [];

      if (
        isHrCoordinator
      ) {
        companyOptionWhere.push(
          buildHrCoordinatorEmployeeScopeSql(
            "e",
            "da_company_options",
            "dpa_company_options"
          )
        );

        companyOptionParams.push(
          coordinatorCompany
        );
      }

      if (
        scope === "active"
      ) {
        companyOptionWhere.push(
          "e.archived = 0",
          "e.employment_status = 'Active'"
        );
      } else if (
        scope === "archived"
      ) {
        companyOptionWhere.push(
          `(
            e.archived = 1
            OR e.employment_status IN ('Resigned', 'Terminated')
            OR e.status = 'Inactive'
          )`
        );
      }

      companyOptionWhere.push(
        "NULLIF(TRIM(COALESCE(e.company, '')), '') IS NOT NULL"
      );

      const companyOptionsSql = `
        SELECT DISTINCT
          TRIM(e.company) AS company
        FROM employees AS e
        ${
          companyOptionWhere.length > 0
            ? `WHERE ${companyOptionWhere.join(
                "\nAND "
              )}`
            : ""
        }
        ORDER BY
          company ASC
      `;

      if (!needsGlobalCompliance) {
        const {
          whereSql,
          params:
            filterParams,
        } =
          buildEmployeeSummaryFilters({
            scope,
            search,
            status,
            company,
            compliance:
              "All",
            coordinatorCompany,
          });

        const orderBySql =
          getEmployeeSummarySortSql(
            sortBy
          );

        const dataSql = `
          SELECT
            e.id,
            e.name,
            e.birthday,
            e.date_hired,
            e.company,
            e.position,
            e.status,
            e.employment_status,
            e.workforce_status,
            e.contractStart,
            e.contractEnd,
            e.contractEndReason,
            e.contractEndedAt,
            e.created_at,
            e.updated_at,
            e.archived
          FROM employees AS e
          ${whereSql}
          ORDER BY
            ${orderBySql}
          LIMIT ${pageSize}
          OFFSET ${offset}
        `;

        const countSql = `
          SELECT
            COUNT(*) AS total
          FROM employees AS e
          ${whereSql}
        `;

        const [
          dataResult,
          countResult,
          activeTotalResult,
          companyOptionsResult,
        ] = await Promise.all([
          db.promise().query(
            dataSql,
            filterParams
          ),

          db.promise().query(
            countSql,
            filterParams
          ),

          db.promise().query(
            activeTotalSql,
            activeTotalParams
          ),

          db.promise().query(
            companyOptionsSql,
            companyOptionParams
          ),
        ]);

        const [employees] =
          dataResult;

        const [[countRow]] =
          countResult;

        const [[activeTotalRow]] =
          activeTotalResult;

        const [companyOptionRows] =
          companyOptionsResult;

        const companyOptions =
          companyOptionRows
            .map(
              (row) =>
                String(
                  row?.company ||
                    ""
                ).trim()
            )
            .filter(
              Boolean
            );

        const employeeIds =
          employees.map(
            (employee) =>
              employee.id
          );

        let complianceRows = [];

        if (
          employeeIds.length > 0
        ) {
          const {
            aggregateSql,
            params,
          } =
            createEmployeeComplianceSql(
              employeeIds
            );

          const [
            complianceResult,
          ] =
            await db.promise().query(
              aggregateSql,
              params
            );

          complianceRows =
            complianceResult;
        }

        const complianceByEmployeeId =
          new Map(
            complianceRows.map(
              (row) => [
                Number(
                  row.employee_id
                ),
                row,
              ]
            )
          );

        const result =
          employees.map(
            (employee) => ({
              ...employee,

              complianceStatus:
                resolveEmployeeComplianceStatus(
                  complianceByEmployeeId.get(
                    Number(
                      employee.id
                    )
                  )
                ),
            })
          );

        const total =
          Number(
            countRow?.total ||
              0
          );

        const activeTotal =
          Number(
            activeTotalRow?.total ||
              0
          );

        return res.json({
          employees:
            result,

          pagination: {
            page,
            pageSize,
            total,
            totalPages:
              total > 0
                ? Math.ceil(
                    total /
                      pageSize
                  )
                : 0,
            activeTotal,
          },

          filters: {
            scope,
            search,
            status,
            company,
            compliance,
            sort:
              sortBy,
          },

          filterMeta: {
            companies:
              companyOptions,
          },
        });
      }

      /*
       * Compliance-specific filtering/sorting must
       * evaluate the full matching set before LIMIT.
       * This path runs only when the user explicitly
       * requests a compliance filter or sort.
       */
      const {
        aggregateSql,
        params:
          complianceParams,
      } =
        createEmployeeComplianceSql();

      const complianceStatusSql = `
        CASE
          WHEN COALESCE(c.document_count, 0) = 0
            THEN 'No Data'
          WHEN COALESCE(c.expired_count, 0) > 0
            THEN 'Expired'
          WHEN COALESCE(c.expiring_soon_count, 0) > 0
            THEN 'Expiring Soon'
          WHEN COALESCE(c.complete_required_count, 0) <
            ${REQUIRED_EMPLOYEE_DOCUMENT_NAMES.length}
            THEN 'Incomplete'
          ELSE 'Complete'
        END
      `;

      const {
        whereSql,
        params:
          filterParams,
      } =
        buildEmployeeSummaryFilters({
          scope,
          search,
          status,
          company,
          compliance,
          complianceStatusSql,
          coordinatorCompany,
        });

      const orderBySql =
        getEmployeeSummarySortSql(
          sortBy,
          complianceStatusSql
        );

      const dataSql = `
        SELECT
          e.id,
          e.name,
          e.birthday,
          e.date_hired,
          e.company,
          e.position,
          e.status,
          e.employment_status,
          e.workforce_status,
          e.contractStart,
          e.contractEnd,
          e.contractEndReason,
          e.contractEndedAt,
          e.created_at,
          e.updated_at,
          e.archived,
          ${complianceStatusSql}
            AS complianceStatus
        FROM employees AS e
        LEFT JOIN (
          ${aggregateSql}
        ) AS c
          ON c.employee_id = e.id
        ${whereSql}
        ORDER BY
          ${orderBySql}
        LIMIT ${pageSize}
        OFFSET ${offset}
      `;

      const countSql = `
        SELECT
          COUNT(*) AS total
        FROM employees AS e
        LEFT JOIN (
          ${aggregateSql}
        ) AS c
          ON c.employee_id = e.id
        ${whereSql}
      `;

      const [
        dataResult,
        countResult,
        activeTotalResult,
        companyOptionsResult,
      ] = await Promise.all([
        db.promise().query(
          dataSql,
          [
            ...complianceParams,
            ...filterParams,
          ]
        ),

        db.promise().query(
          countSql,
          [
            ...complianceParams,
            ...filterParams,
          ]
        ),

        db.promise().query(
          activeTotalSql,
          activeTotalParams
        ),

        db.promise().query(
          companyOptionsSql,
          companyOptionParams
        ),
      ]);

      const [employees] =
        dataResult;

      const [[countRow]] =
        countResult;

      const [[activeTotalRow]] =
        activeTotalResult;

      const [companyOptionRows] =
        companyOptionsResult;

      const companyOptions =
        companyOptionRows
          .map(
            (row) =>
              String(
                row?.company ||
                  ""
              ).trim()
          )
          .filter(
            Boolean
          );

      const total =
        Number(
          countRow?.total ||
            0
        );

      const activeTotal =
        Number(
          activeTotalRow?.total ||
            0
        );

      return res.json({
        employees,

        pagination: {
          page,
          pageSize,
          total,
          totalPages:
            total > 0
              ? Math.ceil(
                  total /
                    pageSize
                )
              : 0,
          activeTotal,
        },

        filters: {
          scope,
          search,
          status,
          company,
          compliance,
          sort:
            sortBy,
        },

        filterMeta: {
          companies:
            companyOptions,
        },
      });
    }

    /*
     * Existing full-response mode remains available
     * for current internal HR workflows.
     *
     * HR Coordinator receives only:
     * - currently Deployed employees at the assigned company
     * - employees currently For Deployment to that company
     *
     * Ordinary Pooling employees remain hidden. Documents
     * are scoped by the same rule before they leave MySQL.
     */
    const employeeSql =
      isHrCoordinator
        ? `
          SELECT e.*
          FROM employees AS e
          WHERE
            ${buildHrCoordinatorEmployeeScopeSql(
              "e",
              "da_full_scope",
              "dpa_full_scope"
            )}
          ORDER BY e.created_at DESC
        `
        : `
          SELECT *
          FROM employees
          ORDER BY created_at DESC
        `;

    const employeeParams =
      isHrCoordinator
        ? [
            coordinatorCompany,
          ]
        : [];

    const documentSql =
      isHrCoordinator
        ? `
          SELECT
            d.id,
            d.employee_id,
            d.name,
            d.document_number,
            d.expiration_date,
            d.file_path
          FROM employee_documents AS d
          INNER JOIN employees AS e
            ON e.id = d.employee_id
          WHERE
            ${buildHrCoordinatorEmployeeScopeSql(
              "e",
              "da_document_scope",
              "dpa_document_scope"
            )}
          ORDER BY d.id ASC
        `
        : `
          SELECT
            id,
            employee_id,
            name,
            document_number,
            expiration_date,
            file_path
          FROM employee_documents
          ORDER BY id ASC
        `;

    const documentParams =
      isHrCoordinator
        ? [
            coordinatorCompany,
          ]
        : [];

    const [
      employeeResult,
      documentResult,
    ] = await Promise.all([
      db.promise().query(
        employeeSql,
        employeeParams
      ),

      db.promise().query(
        documentSql,
        documentParams
      ),
    ]);

    const [employees] =
      employeeResult;

    const [documents] =
      documentResult;

    const documentsByEmployeeId =
      documents.reduce(
        (
          map,
          doc
        ) => {
          const employeeId =
            Number(
              doc.employee_id
            );

          const employeeDocuments =
            map.get(
              employeeId
            ) || [];

          employeeDocuments.push({
            id:
              doc.id,

            name:
              doc.name,

            documentNumber:
              doc.document_number,

            expirationDate:
              doc.expiration_date,

            filePath:
              doc.file_path,
          });

          map.set(
            employeeId,
            employeeDocuments
          );

          return map;
        },
        new Map()
      );

    const result =
      employees.map(
        (
          employee
        ) => ({
          ...employee,

          documents:
            documentsByEmployeeId.get(
              Number(
                employee.id
              )
            ) || [],
        })
      );

    return res.json(
      result
    );
  } catch (err) {
    console.error(
      "FETCH EMPLOYEES ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Fetch employees error",
      });
  }
};

/*
 * ==================================================
 * GET EMPLOYEE BY ID
 * ==================================================
 *
 * Fetches one employee and only that employee's
 * documents for on-demand detail/edit workflows.
 */
exports.getEmployeeById = async (
  req,
  res
) => {
  try {
    const { id } =
      req.params;

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

    const coordinatorScopeSql =
      isHrCoordinator
        ? `
          AND
            ${buildHrCoordinatorEmployeeScopeSql(
              "e",
              "da_employee_scope",
              "dpa_employee_scope"
            )}
        `
        : "";

    const queryParams =
      isHrCoordinator
        ? [
            id,
            coordinatorCompany,
          ]
        : [
            id,
          ];

    const [rows] =
      await db
        .promise()
        .query(
          `
          SELECT
            e.*,
            d.id AS document_id,
            d.name AS document_name,
            d.document_number AS document_number,
            d.expiration_date AS document_expiration_date,
            d.file_path AS document_file_path
          FROM employees AS e
          LEFT JOIN employee_documents AS d
            ON d.employee_id = e.id
          WHERE e.id = ?
            ${coordinatorScopeSql}
          ORDER BY d.id ASC
          `,
          queryParams
        );

    /*
     * Return 404 for both:
     * - nonexistent employee
     * - employee outside coordinator scope
     *
     * This avoids confirming the existence of records
     * belonging to another client/company.
     */
    if (rows.length === 0) {
      return res
        .status(404)
        .json({
          error:
            "Employee not found.",
        });
    }

    const firstRow =
      rows[0];

    const employee = {
      ...firstRow,
    };

    delete employee.document_id;
    delete employee.document_name;
    delete employee.document_number;
    delete employee.document_expiration_date;
    delete employee.document_file_path;

    employee.documents =
      rows
        .filter(
          (row) =>
            row.document_id !==
              null &&
            row.document_id !==
              undefined
        )
        .map(
          (row) => ({
            id:
              row.document_id,

            name:
              row.document_name,

            documentNumber:
              row.document_number,

            expirationDate:
              row.document_expiration_date,

            filePath:
              row.document_file_path,
          })
        );

    return res.json(
      employee
    );
  } catch (err) {
    console.error(
      "FETCH EMPLOYEE BY ID ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Fetch employee error",
      });
  }
};

/*
 * ==================================================
 * UPDATE EMPLOYEE
 * PHASE 8B — TRANSACTION SAFE
 * ==================================================
 *
 * Atomic DB unit:
 *
 * employees UPDATE
 * +
 * employee_documents UPDATE/INSERT/DELETE
 *
 * On validation failure:
 * remove newly uploaded request files
 * +
 * return HTTP 400
 *
 * On DB failure:
 * ROLLBACK
 * +
 * remove only newly uploaded request files
 *
 * Old/pre-existing files replaced or removed by a
 * successfully committed update become cleanup
 * candidates. Physical deletion is performed only
 * after commit and only when no DB reference remains.
 */
exports.updateEmployee = async (
  req,
  res
) => {
  const {
    id,
  } = req.params;

  let connection = null;

  let transactionStarted =
    false;

  let transactionCommitted =
    false;

  let finalEmployeeName =
    "Unknown Employee";

  const historicalFileCandidates =
    [];

  try {
    const {
      name,
      birthday,
      company,
      position,
      status,
      contractStart,
    } = req.body;

    const dateHiredWasSubmitted =
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "dateHired"
      ) ||
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "date_hired"
      );

    const dateHiredInput =
      req.body?.dateHired ??
      req.body?.date_hired;

    const actor =
      getActor(req);

    const finalName =
      toNullable(name);

    const birthdayWasSubmitted =
      Object.prototype.hasOwnProperty.call(
        req.body || {},
        "birthday"
      );

    const submittedBirthday =
      normalizeEmployeeBirthday(
        birthday
      );

    if (
      birthdayWasSubmitted &&
      submittedBirthday.error
    ) {
      return await rejectEmployeeRequest(
        req,
        res,
        submittedBirthday.error
      );
    }

    const submittedDateHired =
      normalizeEmployeeBusinessDate(
        dateHiredInput,
        "Date Hired"
      );

    if (
      dateHiredWasSubmitted &&
      (
        submittedDateHired.error ||
        !submittedDateHired.value
      )
    ) {
      return await rejectEmployeeRequest(
        req,
        res,
        submittedDateHired.error ||
          "Date Hired is required."
      );
    }

    const submittedStatus =
      toNullable(status);

    const requestedStatus =
      submittedStatus
        ? normalizeEmployeeStatus(
            submittedStatus
          )
        : null;

    if (
      submittedStatus &&
      !requestedStatus
    ) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Invalid employee workforce status."
      );
    }

    if (!finalName) {
      return await rejectEmployeeRequest(
        req,
        res,
        "Employee name is required."
      );
    }

    const submittedCompany =
      toNullable(company);

    const submittedPosition =
      toNullable(position);

    const submittedContractStartResult =
      normalizeEmployeeBusinessDate(
        contractStart,
        "Deployment start date"
      );

    if (
      toNullable(contractStart) &&
      submittedContractStartResult.error
    ) {
      return await rejectEmployeeRequest(
        req,
        res,
        submittedContractStartResult.error
      );
    }

    const submittedContractStart =
      submittedContractStartResult.value;

    const frontendDocs =
      extractDocumentsFromReq(
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

    const rejectAfterRollback =
      async (
        statusCode,
        message
      ) => {
        await connection.rollback();

        transactionStarted =
          false;

        await cleanupUploadedFiles(
          req.files
        );

        return res
          .status(statusCode)
          .json({
            error:
              message,
          });
      };

    const [
      employeeRows,
    ] =
      await connection.query(
        `
        SELECT
          id,
          name,
          birthday,
          date_hired,
          company,
          position,
          status,
          employment_status,
          workforce_status,
          contractStart,
          contractEnd,
          contractEndReason,
          contractEndRemarks,
          contractEndedAt,
          archived
        FROM employees
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      employeeRows.length ===
      0
    ) {
      return await rejectAfterRollback(
        404,
        "Employee not found."
      );
    }

    const currentEmployee =
      employeeRows[0];

    finalEmployeeName =
      finalName ||
      currentEmployee.name ||
      "Unknown Employee";

    if (
      Number(
        currentEmployee.archived ||
        0
      ) === 1
    ) {
      return await rejectAfterRollback(
        409,
        "Archived employees cannot be updated through the active employee workflow."
      );
    }

    const currentEmploymentStatus =
      toNullable(
        currentEmployee.employment_status
      );

    if (
      currentEmploymentStatus !==
      EMPLOYMENT_STATUS.ACTIVE
    ) {
      return await rejectAfterRollback(
        409,
        "Only employees with Active employment status can be edited through the active employee workflow."
      );
    }

    const currentWorkforceStatus =
      normalizeEmployeeStatus(
        currentEmployee.workforce_status ||
        currentEmployee.status
      );

    if (
      !currentWorkforceStatus ||
      currentWorkforceStatus ===
        EMPLOYEE_STATUS.INACTIVE
    ) {
      return await rejectAfterRollback(
        409,
        "The employee has an unsupported current workforce status."
      );
    }

    /*
     * Generic Employee Edit may never perform a workflow
     * transition. Scheduling, arrival confirmation, No Show,
     * withdrawal, and ending an assignment have dedicated
     * transactional endpoints.
     */
    if (
      requestedStatus &&
      requestedStatus !==
        currentWorkforceStatus
    ) {
      return await rejectAfterRollback(
        409,
        "Employee workforce status cannot be changed through Edit Employee. Use the deployment workflow."
      );
    }

    const currentBirthday =
      normalizeEmployeeBirthday(
        currentEmployee.birthday
      ).value;

    const finalBirthday =
      birthdayWasSubmitted
        ? submittedBirthday.value
        : currentBirthday;

    const currentDateHired =
      toNullableDate(
        currentEmployee.date_hired
      );

    const finalDateHired =
      dateHiredWasSubmitted
        ? submittedDateHired.value
        : currentDateHired;

    const [
      existingDocs,
    ] =
      await connection.query(
        `
        SELECT
          id,
          name,
          document_number,
          file_path
        FROM employee_documents
        WHERE employee_id = ?
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    const documentNumberError =
      validateEmployeeDocumentNumbers(
        frontendDocs,
        existingDocs
      );

    if (documentNumberError) {
      return await rejectAfterRollback(
        400,
        documentNumberError
      );
    }

    const [
      activeAssignments,
    ] =
      await connection.query(
        `
        SELECT
          id,
          company,
          position,
          start_date
        FROM deployment_assignments
        WHERE employee_id = ?
          AND status = 'Active'
        ORDER BY
          start_date DESC,
          id DESC
        LIMIT 2
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    const [
      pendingAttempts,
    ] =
      await connection.query(
        `
        SELECT
          id,
          company,
          position,
          scheduled_date
        FROM deployment_attempts
        WHERE employee_id = ?
          AND status = 'For Deployment'
        ORDER BY
          scheduled_date DESC,
          id DESC
        LIMIT 2
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      activeAssignments.length >
        1 ||
      pendingAttempts.length >
        1
    ) {
      return await rejectAfterRollback(
        409,
        "Conflicting deployment workflow records were found for this employee."
      );
    }

    if (
      currentWorkforceStatus ===
        EMPLOYEE_STATUS.DEPLOYED &&
      (
        activeAssignments.length !==
          1 ||
        pendingAttempts.length !==
          0
      )
    ) {
      return await rejectAfterRollback(
        409,
        "The deployed employee does not have a valid single active deployment state."
      );
    }

    if (
      currentWorkforceStatus ===
        EMPLOYEE_STATUS.FOR_DEPLOYMENT &&
      (
        activeAssignments.length !==
          0 ||
        pendingAttempts.length !==
          1
      )
    ) {
      return await rejectAfterRollback(
        409,
        "The For Deployment employee does not have a valid single pending deployment schedule."
      );
    }

    if (
      currentWorkforceStatus ===
        EMPLOYEE_STATUS.FLOATING_STANDBY &&
      (
        activeAssignments.length !==
          0 ||
        pendingAttempts.length !==
          0
      )
    ) {
      return await rejectAfterRollback(
        409,
        "A Pooling employee cannot have an active assignment or pending deployment schedule."
      );
    }

    const currentCompany =
      toNullable(
        currentEmployee.company
      );

    const currentPosition =
      toNullable(
        currentEmployee.position
      );

    let finalCompany =
      submittedCompany ||
      currentCompany;

    let finalPosition =
      submittedPosition ||
      currentPosition;

    const currentContractStart =
      toNullableDate(
        currentEmployee.contractStart
      );

    let finalContractStart =
      currentContractStart;

    if (
      currentWorkforceStatus ===
      EMPLOYEE_STATUS.FLOATING_STANDBY
    ) {
      if (
        !finalCompany ||
        !finalPosition
      ) {
        return await rejectAfterRollback(
          400,
          "Pooling employees must have a designated company and position."
        );
      }

      const designationChanged =
        !isSameText(
          finalCompany,
          currentCompany
        ) ||
        !isSameText(
          finalPosition,
          currentPosition
        );

      if (designationChanged) {
        const masterPair =
          await resolveActiveDeploymentMasterPair(
            connection,
            finalCompany,
            finalPosition
          );

        if (!masterPair) {
          return await rejectAfterRollback(
            400,
            "Company and position must be an active configured deployment combination."
          );
        }

        finalCompany =
          masterPair.companyName;

        finalPosition =
          masterPair.positionName;
      }

      /*
       * contractStart is historical deployment timing,
       * not a Pooling field. Generic Pooling edits never
       * create or alter an assignment.
       */
      finalContractStart =
        currentContractStart;
    } else if (
      currentWorkforceStatus ===
      EMPLOYEE_STATUS.FOR_DEPLOYMENT
    ) {
      const pendingAttempt =
        pendingAttempts[0];

      if (
        !isSameText(
          currentCompany,
          pendingAttempt.company
        ) ||
        !isSameText(
          currentPosition,
          pendingAttempt.position
        )
      ) {
        return await rejectAfterRollback(
          409,
          "Employee designation no longer matches the pending deployment schedule. Withdraw the schedule before correcting the designation."
        );
      }

      if (
        (
          submittedCompany &&
          !isSameText(
            submittedCompany,
            currentCompany
          )
        ) ||
        (
          submittedPosition &&
          !isSameText(
            submittedPosition,
            currentPosition
          )
        )
      ) {
        return await rejectAfterRollback(
          409,
          "Withdraw the pending deployment schedule before changing the designated company or position."
        );
      }

      if (
        submittedContractStart &&
        !isSameText(
          submittedContractStart,
          currentContractStart
        )
      ) {
        return await rejectAfterRollback(
          409,
          "Deployment timing for a For Deployment employee is managed by the deployment schedule."
        );
      }

      finalCompany =
        currentCompany;

      finalPosition =
        currentPosition;

      finalContractStart =
        currentContractStart;

      if (
        finalDateHired &&
        pendingAttempt.scheduled_date
      ) {
        const scheduledDate =
          toNullableDate(
            pendingAttempt.scheduled_date
          );

        if (
          scheduledDate &&
          finalDateHired >
            scheduledDate
        ) {
          return await rejectAfterRollback(
            400,
            "Date Hired cannot be later than the scheduled deployment date."
          );
        }
      }
    } else if (
      currentWorkforceStatus ===
      EMPLOYEE_STATUS.DEPLOYED
    ) {
      const activeAssignment =
        activeAssignments[0];

      const assignmentCompany =
        toNullable(
          activeAssignment.company
        );

      const assignmentPosition =
        toNullable(
          activeAssignment.position
        );

      /*
       * Company/position changes while deployed are not
       * profile corrections; they represent a transfer /
       * reassignment and must preserve deployment history.
       */
      if (
        (
          submittedCompany &&
          !isSameText(
            submittedCompany,
            assignmentCompany
          )
        ) ||
        (
          submittedPosition &&
          !isSameText(
            submittedPosition,
            assignmentPosition
          )
        )
      ) {
        return await rejectAfterRollback(
          409,
          "End the current assignment before changing a deployed employee's company or position."
        );
      }

      finalCompany =
        assignmentCompany;

      finalPosition =
        assignmentPosition;

      if (
        submittedContractStart
      ) {
        finalContractStart =
          submittedContractStart;
      } else {
        finalContractStart =
          toNullableDate(
            activeAssignment.start_date
          ) ||
          currentContractStart;
      }

      if (!finalContractStart) {
        return await rejectAfterRollback(
          409,
          "The deployed employee does not have a valid deployment start date."
        );
      }

      if (
        finalDateHired &&
        finalContractStart <
          finalDateHired
      ) {
        return await rejectAfterRollback(
          400,
          "Deployment start date cannot be earlier than Date Hired."
        );
      }

      await connection.query(
        `
        UPDATE deployment_assignments
        SET
          start_date = ?
        WHERE id = ?
          AND status = 'Active'
        `,
        [
          finalContractStart,
          activeAssignment.id,
        ]
      );
    }

    await connection.query(
      `
      UPDATE employees
      SET
        name = ?,
        birthday = ?,
        date_hired = ?,
        company = ?,
        position = ?,
        status = ?,
        employment_status = ?,
        workforce_status = ?,
        contractStart = ?
      WHERE id = ?
      `,
      [
        finalName,
        finalBirthday,
        finalDateHired,
        finalCompany,
        finalPosition,
        currentWorkforceStatus,
        EMPLOYMENT_STATUS.ACTIVE,
        currentWorkforceStatus,
        finalContractStart,
        id,
      ]
    );

    for (
      const doc of frontendDocs
    ) {
      const existing =
        existingDocs.find(
          (
            item
          ) =>
            item.name ===
            doc.name
        );

      if (existing) {
        const finalPath =
          doc.hasNewFile
            ? doc.filePath
            : existing.file_path;

        if (
          doc.hasNewFile &&
          existing.file_path &&
          existing.file_path !==
            finalPath
        ) {
          historicalFileCandidates.push(
            existing.file_path
          );
        }

        await connection.query(
          `
          UPDATE employee_documents
          SET
            document_number = ?,
            expiration_date = ?,
            file_path = ?
          WHERE id = ?
          `,
          [
            doc.documentNumber,
            doc.expirationDate,
            finalPath,
            existing.id,
          ]
        );
      } else {
        await connection.query(
          `
          INSERT INTO employee_documents
          (
            employee_id,
            name,
            document_number,
            expiration_date,
            file_path
          )
          VALUES (?, ?, ?, ?, ?)
          `,
          [
            id,
            doc.name,
            doc.documentNumber,
            doc.expirationDate,
            doc.filePath,
          ]
        );
      }
    }

    for (
      const existing of
        existingDocs
    ) {
      const stillChecked =
        frontendDocs.find(
          (
            doc
          ) =>
            doc.name ===
            existing.name
        );

      if (!stillChecked) {
        if (existing.file_path) {
          historicalFileCandidates.push(
            existing.file_path
          );
        }

        await connection.query(
          `
          DELETE FROM employee_documents
          WHERE id = ?
          `,
          [
            existing.id,
          ]
        );
      }
    }

    await connection.commit();

    transactionCommitted =
      true;

    connection.release();

    connection = null;

    await cleanupHistoricalFileCandidates(
      historicalFileCandidates,
      "employee_update"
    );

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

      action:
        "UPDATE_EMPLOYEE",

      description:
        `${actor.fullName} updated employee record for ${finalEmployeeName}.`,
    });

    return res.json({
      success: true,

      message:
        "Employee updated successfully.",

      employeeId:
        id,

      employmentStatus:
        EMPLOYMENT_STATUS.ACTIVE,

      workforceStatus:
        currentWorkforceStatus,

      company:
        finalCompany,

      position:
        finalPosition,

      assignmentId:
        currentWorkforceStatus ===
          EMPLOYEE_STATUS.DEPLOYED
          ? activeAssignments[0]?.id ||
            null
          : null,

      deploymentAttemptId:
        currentWorkforceStatus ===
          EMPLOYEE_STATUS.FOR_DEPLOYMENT
          ? pendingAttempts[0]?.id ||
            null
          : null,
    });
  } catch (err) {
    let rollbackSucceeded =
      !transactionStarted;

    if (
      connection &&
      transactionStarted &&
      !transactionCommitted
    ) {
      try {
        await connection.rollback();

        rollbackSucceeded =
          true;
      } catch (
        rollbackError
      ) {
        rollbackSucceeded =
          false;

        console.error(
          "UPDATE EMPLOYEE ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    if (
      !transactionCommitted &&
      rollbackSucceeded
    ) {
      await cleanupUploadedFiles(
        req.files
      );
    }

    console.error(
      "UPDATE EMPLOYEE ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Update employee error",
      });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

const CONTRACT_END_REASON_RULES =
  {
    "Completed Contract": {
      legacyEmployeeStatus:
        EMPLOYEE_STATUS.FLOATING_STANDBY,

      employmentStatus:
        EMPLOYMENT_STATUS.ACTIVE,

      workforceStatus:
        EMPLOYEE_STATUS.FLOATING_STANDBY,

      deploymentStatus:
        "Completed",

      isSeparation:
        false,
    },

    "End of Assignment / Pulled Out by Client":
      {
        legacyEmployeeStatus:
          EMPLOYEE_STATUS.FLOATING_STANDBY,

        employmentStatus:
          EMPLOYMENT_STATUS.ACTIVE,

        workforceStatus:
          EMPLOYEE_STATUS.FLOATING_STANDBY,

        deploymentStatus:
          "Completed",

        isSeparation:
          false,
      },

    "Transferred / Reassigned":
      {
        legacyEmployeeStatus:
          EMPLOYEE_STATUS.FLOATING_STANDBY,

        employmentStatus:
          EMPLOYMENT_STATUS.ACTIVE,

        workforceStatus:
          EMPLOYEE_STATUS.FLOATING_STANDBY,

        deploymentStatus:
          "Completed",

        isSeparation:
          false,
      },

    Resigned: {
      legacyEmployeeStatus:
        EMPLOYEE_STATUS.INACTIVE,

      employmentStatus:
        EMPLOYMENT_STATUS.RESIGNED,

      workforceStatus:
        null,

      deploymentStatus:
        LEGACY_SEPARATION_DEPLOYMENT_STATUS,

      isSeparation:
        true,
    },

    /*
     * AWOL remains the separation reason/outcome.
     * Canonical employment status uses Terminated
     * because Active | Resigned | Terminated is the
     * locked employment-status domain.
     */
    AWOL: {
      legacyEmployeeStatus:
        EMPLOYEE_STATUS.INACTIVE,

      employmentStatus:
        EMPLOYMENT_STATUS.TERMINATED,

      workforceStatus:
        null,

      deploymentStatus:
        LEGACY_SEPARATION_DEPLOYMENT_STATUS,

      isSeparation:
        true,
    },

    Terminated: {
      legacyEmployeeStatus:
        EMPLOYEE_STATUS.INACTIVE,

      employmentStatus:
        EMPLOYMENT_STATUS.TERMINATED,

      workforceStatus:
        null,

      deploymentStatus:
        LEGACY_SEPARATION_DEPLOYMENT_STATUS,

      isSeparation:
        true,
    },
  };

/*
 * ==================================================
 * END DEPLOYMENT CONTRACT
 * ==================================================
 */
exports.updateContractEnd = async (
  req,
  res
) => {
  const { id } =
    req.params;

  let connection = null;

  let transactionStarted =
    false;

  let transactionCommitted =
    false;

  try {
    const {
      contractEnd,
      endReason,
      endRemarks,
    } = req.body || {};

    const actor =
      getActor(req);

    const {
      value:
        finalContractEnd,
      error:
        contractEndError,
    } =
      normalizeEmployeeBusinessDate(
        contractEnd,
        "Deployment end date"
      );

    const finalReason =
      toNullable(
        endReason
      );

    const finalRemarks =
      toNullable(
        endRemarks
      );

    if (
      contractEndError ||
      !finalContractEnd
    ) {
      return res.status(400).json({
        error:
          contractEndError ||
          "Contract end date is required.",
      });
    }

    if (!finalReason) {
      return res.status(400).json({
        error:
          "Contract end reason is required.",
      });
    }

    const reasonRule =
      CONTRACT_END_REASON_RULES[
        finalReason
      ];

    if (!reasonRule) {
      return res.status(400).json({
        error:
          "Invalid contract end reason.",
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

    const [
      employeeRows,
    ] =
      await connection.query(
        `
        SELECT
          id,
          name,
          status,
          employment_status,
          workforce_status,
          archived,
          contractStart
        FROM employees
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      employeeRows.length === 0
    ) {
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(404).json({
        error:
          "Employee not found.",
      });
    }

    const employee =
      employeeRows[0];

    if (
      Number(
        employee.archived ||
        0
      ) === 1
    ) {
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(409).json({
        error:
          "Archived employees cannot have an active deployment ended.",
      });
    }

    if (
      toNullable(
        employee.employment_status
      ) !==
        EMPLOYMENT_STATUS.ACTIVE ||
      normalizeEmployeeStatus(
        employee.workforce_status ||
        employee.status
      ) !==
        EMPLOYEE_STATUS.DEPLOYED
    ) {
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(409).json({
        error:
          "Only a currently deployed employee with Active employment can have an assignment ended.",
      });
    }

    const [
      pendingAttempts,
    ] =
      await connection.query(
        `
        SELECT id
        FROM deployment_attempts
        WHERE employee_id = ?
          AND status = 'For Deployment'
        LIMIT 1
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      pendingAttempts.length > 0
    ) {
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(409).json({
        error:
          "A deployed employee cannot also have a pending deployment schedule.",
      });
    }

    const [
      activeAssignments,
    ] =
      await connection.query(
        `
        SELECT
          id,
          company,
          position,
          start_date
        FROM deployment_assignments
        WHERE employee_id = ?
          AND status = 'Active'
        ORDER BY
          start_date DESC,
          id DESC
        LIMIT 2
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      activeAssignments.length ===
      0
    ) {
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(409).json({
        error:
          "No active deployment assignment was found for this employee.",
      });
    }

    if (
      activeAssignments.length >
      1
    ) {
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(409).json({
        error:
          "Multiple active deployment assignments were found for this employee. Resolve the assignment records before ending the deployment.",
      });
    }

    const activeAssignment =
      activeAssignments[0];

    const assignmentStartDate =
      toNullableDate(
        activeAssignment.start_date
      );

    if (
      assignmentStartDate &&
      finalContractEnd <
        assignmentStartDate
    ) {
      await connection.rollback();

      transactionStarted =
        false;

      return res.status(400).json({
        error:
          "Deployment end date cannot be earlier than the deployment start date.",
      });
    }

    await connection.query(
      `
      UPDATE deployment_assignments
      SET
        end_date = ?,
        end_reason = ?,
        end_remarks = ?,
        status = ?,
        ended_at = UTC_TIMESTAMP()
      WHERE id = ?
        AND status = 'Active'
      `,
      [
        finalContractEnd,
        finalReason,
        finalRemarks,
        reasonRule.deploymentStatus,
        activeAssignment.id,
      ]
    );

    /*
     * company + position are intentionally retained.
     *
     * When the employee returns to Pooling they remain
     * the designated placement until HR Staff changes the
     * designation. For a separation they remain historical
     * current-state compatibility data but workforce_status
     * becomes NULL because the person is no longer active
     * in the workforce.
     */
    await connection.query(
      `
      UPDATE employees
      SET
        contractEnd = ?,
        contractEndReason = ?,
        contractEndRemarks = ?,
        contractEndedAt = UTC_TIMESTAMP(),
        status = ?,
        employment_status = ?,
        workforce_status = ?
      WHERE id = ?
      `,
      [
        finalContractEnd,
        finalReason,
        finalRemarks,
        reasonRule.legacyEmployeeStatus,
        reasonRule.employmentStatus,
        reasonRule.workforceStatus,
        id,
      ]
    );

    /*
     * Preserve legacy workforce/status history semantics.
     * Separation identity is additionally recorded in the
     * dedicated employment history below.
     */
    await connection.query(
      `
      INSERT INTO employee_status_history
      (
        employee_id,
        from_status,
        to_status,
        effective_at,
        reason,
        remarks,
        source_event,
        changed_by_user_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        EMPLOYEE_STATUS.DEPLOYED,
        reasonRule.legacyEmployeeStatus,
        `${finalContractEnd} 00:00:00`,
        finalReason,
        finalRemarks,
        "DEPLOYMENT_ENDED",
        actor.userId,
      ]
    );

    if (
      reasonRule.isSeparation
    ) {
      await connection.query(
        `
        INSERT INTO employee_employment_history
        (
          employee_id,
          from_status,
          to_status,
          effective_at,
          reason,
          remarks,
          source_event,
          changed_by_user_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          id,
          EMPLOYMENT_STATUS.ACTIVE,
          reasonRule.employmentStatus,
          `${finalContractEnd} 00:00:00`,
          finalReason,
          finalRemarks,
          "EMPLOYMENT_SEPARATED",
          actor.userId,
        ]
      );
    }

    await connection.commit();

    transactionCommitted =
      true;

    connection.release();

    connection = null;

    const employeeName =
      employee?.name ||
      "Unknown Employee";

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

      action:
        "END_DEPLOYMENT_CONTRACT",

      description:
        `${actor.fullName} ended deployment contract for ${employeeName}. Reason: ${finalReason}.`,
    });

    return res.json({
      success: true,

      message:
        "Deployment contract ended successfully.",

      employeeId:
        id,

      employeeName,

      assignmentId:
        activeAssignment.id,

      company:
        activeAssignment.company,

      position:
        activeAssignment.position,

      contractEnd:
        finalContractEnd,

      endReason:
        finalReason,

      endRemarks:
        finalRemarks,

      deploymentStatus:
        reasonRule.deploymentStatus,

      deploymentDisplayStatus:
        getDeploymentDisplayStatus(
          reasonRule.deploymentStatus,
          finalReason,
          finalRemarks
        ),

      employeeStatus:
        reasonRule.legacyEmployeeStatus,

      employmentStatus:
        reasonRule.employmentStatus,

      workforceStatus:
        reasonRule.workforceStatus,
    });
  } catch (err) {
    if (
      connection &&
      transactionStarted &&
      !transactionCommitted
    ) {
      try {
        await connection.rollback();
      } catch (
        rollbackError
      ) {
        console.error(
          "UPDATE CONTRACT END ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    console.error(
      "UPDATE CONTRACT END ERROR:",
      err
    );

    return res.status(500).json({
      error:
        "Failed to update contract end date.",
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/*
 * ==================================================
 * ARCHIVE EMPLOYEE
 * ==================================================
 */
exports.archiveEmployee = async (
  req,
  res
) => {
  const {
    id,
  } = req.params;

  const actor =
    getActor(req);

  let connection = null;

  let transactionStarted =
    false;

  let transactionCommitted =
    false;

  try {
    connection =
      await db
        .promise()
        .getConnection();

    await connection
      .beginTransaction();

    transactionStarted =
      true;

    /*
     * Lock the employee first.
     *
     * Employee mutations and deployment lifecycle
     * operations use the same canonical employee row,
     * preventing an archive decision from being based
     * on stale state.
     */
    const [
      employeeRows,
    ] =
      await connection.query(
        `
        SELECT
          id,
          name,
          status,
          archived
        FROM employees
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      employeeRows.length === 0
    ) {
      await connection
        .rollback();

      transactionStarted =
        false;

      return res
        .status(404)
        .json({
          error:
            "Employee not found.",
        });
    }

    const employee =
      employeeRows[0];

    const employeeName =
      employee.name ||
      "Unknown Employee";

    if (
      Number(
        employee.archived ||
        0
      ) === 1
    ) {
      await connection
        .rollback();

      transactionStarted =
        false;

      return res
        .status(409)
        .json({
          error:
            "Employee is already archived.",
        });
    }

    /*
     * An employee with an Active deployment cannot
     * be archived.
     *
     * HR must first use the End Assignment / Contract
     * workflow so deployment history receives a real
     * end date, reason, status, and audit trail.
     */
    const [
      activeAssignments,
    ] =
      await connection.query(
        `
        SELECT
          id
        FROM deployment_assignments
        WHERE employee_id = ?
          AND status = 'Active'
        ORDER BY
          start_date DESC,
          id DESC
        LIMIT 2
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      activeAssignments.length > 0
    ) {
      await connection
        .rollback();

      transactionStarted =
        false;

      return res
        .status(409)
        .json({
          error:
            "End the employee's active deployment before archiving the employee record.",
        });
    }

    /*
     * A pending For Deployment schedule is also a live
     * workflow state. It must be withdrawn before the
     * employee can be archived.
     */
    const [
      pendingAttempts,
    ] =
      await connection.query(
        `
        SELECT
          id
        FROM deployment_attempts
        WHERE employee_id = ?
          AND status = 'For Deployment'
        LIMIT 1
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      pendingAttempts.length > 0
    ) {
      await connection
        .rollback();

      transactionStarted =
        false;

      return res
        .status(409)
        .json({
          error:
            "Withdraw the employee's pending deployment schedule before archiving the employee record.",
        });
    }

    const [
      archiveResult,
    ] =
      await connection.query(
        `
        UPDATE employees
        SET archived = 1
        WHERE id = ?
          AND archived = 0
        `,
        [
          id,
        ]
      );

    if (
      Number(
        archiveResult.affectedRows ||
        0
      ) !== 1
    ) {
      throw new Error(
        "Employee archive state changed before the operation could be completed."
      );
    }

    await connection
      .commit();

    transactionCommitted =
      true;

    connection.release();

    connection = null;

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

      action:
        "ARCHIVE_EMPLOYEE",

      description:
        `${actor.fullName} archived employee record for ${employeeName}.`,
    });

    return res.json({
      success: true,

      message:
        "Employee archived successfully.",
    });
  } catch (err) {
    if (
      connection &&
      transactionStarted &&
      !transactionCommitted
    ) {
      try {
        await connection
          .rollback();
      } catch (
        rollbackError
      ) {
        console.error(
          "ARCHIVE EMPLOYEE ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    console.error(
      "ARCHIVE EMPLOYEE ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Archive employee error",
      });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/*
 * ==================================================
 * RESTORE EMPLOYEE
 * ==================================================
 */
exports.restoreEmployee = async (
  req,
  res
) => {
  const {
    id,
  } = req.params;

  const actor =
    getActor(req);

  let connection = null;

  let transactionStarted =
    false;

  let transactionCommitted =
    false;

  try {
    connection =
      await db
        .promise()
        .getConnection();

    await connection
      .beginTransaction();

    transactionStarted =
      true;

    const [
      employeeRows,
    ] =
      await connection.query(
        `
        SELECT
          id,
          name,
          archived
        FROM employees
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      employeeRows.length === 0
    ) {
      await connection
        .rollback();

      transactionStarted =
        false;

      return res
        .status(404)
        .json({
          error:
            "Employee not found.",
        });
    }

    const employee =
      employeeRows[0];

    const employeeName =
      employee.name ||
      "Unknown Employee";

    if (
      Number(
        employee.archived ||
        0
      ) !== 1
    ) {
      await connection
        .rollback();

      transactionStarted =
        false;

      return res
        .status(409)
        .json({
          error:
            "Employee is not archived.",
        });
    }

    const [
      restoreResult,
    ] =
      await connection.query(
        `
        UPDATE employees
        SET archived = 0
        WHERE id = ?
          AND archived = 1
        `,
        [
          id,
        ]
      );

    if (
      Number(
        restoreResult.affectedRows ||
        0
      ) !== 1
    ) {
      throw new Error(
        "Employee restore state changed before the operation could be completed."
      );
    }

    await connection
      .commit();

    transactionCommitted =
      true;

    connection.release();

    connection = null;

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

      action:
        "RESTORE_EMPLOYEE",

      description:
        `${actor.fullName} restored employee record for ${employeeName}.`,
    });

    return res.json({
      success: true,

      message:
        "Employee restored successfully.",
    });
  } catch (err) {
    if (
      connection &&
      transactionStarted &&
      !transactionCommitted
    ) {
      try {
        await connection
          .rollback();
      } catch (
        rollbackError
      ) {
        console.error(
          "RESTORE EMPLOYEE ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    console.error(
      "RESTORE EMPLOYEE ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Restore employee error",
      });
  } finally {
    if (connection) {
      connection.release();
    }
  }
};

/*
 * ==================================================
 * DELETE EMPLOYEE
 * PHASE 8C — TRANSACTION SAFE
 * ==================================================
 *
 * Confirmed database relationship:
 *
 * employees
 * ├── employee_documents
 * │   No FK.
 * │   Explicitly removed here.
 * │
 * └── incidents
 *     FK incidents.employee_id -> employees.id
 *     ON DELETE CASCADE
 *
 *     incidents
 *     ├── incident_evidence
 *     │   ON DELETE CASCADE
 *     │
 *     └── incident_timeline
 *         ON DELETE CASCADE
 *
 * kpi_decision_history has no FK to employees and
 * is intentionally preserved as historical data.
 *
 * Before destructive DB changes, historical
 * employee-document and incident-evidence paths are
 * captured as cleanup candidates.
 *
 * Physical deletion is considered only after a
 * successful DB commit and only when the centralized
 * reference-aware service proves that no DB reference
 * remains anywhere in the active file-reference
 * sources.
 */
exports.deleteEmployee = async (
  req,
  res
) => {
  const {
    id,
  } = req.params;

  const actor =
    getActor(req);

  let connection = null;

  let transactionStarted =
    false;

  let transactionCommitted =
    false;

  const historicalFileCandidates =
    [];

  try {
    connection =
      await db
        .promise()
        .getConnection();

    await connection
      .beginTransaction();

    transactionStarted =
      true;

    /*
     * Resolve and lock the authoritative employee row.
     *
     * Permanent deletion is only available from the
     * archive workflow. A normal active employee can
     * never be deleted directly through the API.
     */
    const [
      employeeRows,
    ] =
      await connection.query(
        `
        SELECT
          id,
          name,
          archived
        FROM employees
        WHERE id = ?
        LIMIT 1
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      employeeRows.length === 0
    ) {
      await connection
        .rollback();

      transactionStarted =
        false;

      return res
        .status(404)
        .json({
          error:
            "Employee not found.",
        });
    }

    const employee =
      employeeRows[0];

    const employeeName =
      employee.name ||
      "Unknown Employee";

    if (
      Number(
        employee.archived ||
        0
      ) !== 1
    ) {
      await connection
        .rollback();

      transactionStarted =
        false;

      return res
        .status(409)
        .json({
          error:
            "Only archived employee records can be permanently deleted.",
        });
    }

    /*
     * Defense against historical/inconsistent data.
     *
     * A legacy archived employee may still contain an
     * Active deployment assignment from older behavior.
     *
     * Never erase that deployment history implicitly.
     * The employee must first be restored and the
     * deployment ended through the normal workflow.
     */
    const [
      activeAssignments,
    ] =
      await connection.query(
        `
        SELECT
          id
        FROM deployment_assignments
        WHERE employee_id = ?
          AND status = 'Active'
        ORDER BY
          start_date DESC,
          id DESC
        LIMIT 1
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      activeAssignments.length > 0
    ) {
      await connection
        .rollback();

      transactionStarted =
        false;

      return res
        .status(409)
        .json({
          error:
            "This archived employee still has an active deployment. Restore the employee and end the deployment before permanent deletion.",
        });
    }

    /*
     * Permanent delete must never implicitly resolve a
     * live deployment schedule.
     */
    const [
      pendingAttempts,
    ] =
      await connection.query(
        `
        SELECT id
        FROM deployment_attempts
        WHERE employee_id = ?
          AND status = 'For Deployment'
        LIMIT 1
        FOR UPDATE
        `,
        [
          id,
        ]
      );

    if (
      pendingAttempts.length > 0
    ) {
      await connection
        .rollback();

      transactionStarted =
        false;

      return res
        .status(409)
        .json({
          error:
            "This archived employee still has a pending deployment schedule. Resolve it before permanent deletion.",
        });
    }

    /*
     * Capture every physical-file reference that
     * will be removed by this transaction before
     * deleting rows or triggering cascades.
     *
     * These are only candidates. Nothing is
     * physically deleted inside the transaction.
     */
    const [
      employeeDocumentRows,
    ] =
      await connection.query(
        `
        SELECT file_path
        FROM employee_documents
        WHERE employee_id = ?
          AND file_path IS NOT NULL
          AND TRIM(file_path) <> ''
        `,
        [
          id,
        ]
      );

    for (
      const row of
        employeeDocumentRows
    ) {
      historicalFileCandidates.push(
        row.file_path
      );
    }

    const [
      incidentEvidenceRows,
    ] =
      await connection.query(
        `
        SELECT ie.file_path
        FROM incident_evidence AS ie
        INNER JOIN incidents AS i
          ON i.id = ie.incident_id
        WHERE i.employee_id = ?
          AND ie.file_path IS NOT NULL
          AND TRIM(ie.file_path) <> ''
        `,
        [
          id,
        ]
      );

    for (
      const row of
        incidentEvidenceRows
    ) {
      historicalFileCandidates.push(
        row.file_path
      );
    }

    await connection.query(
      `
      DELETE FROM employee_documents
      WHERE employee_id = ?
      `,
      [
        id,
      ]
    );

    /*
     * deployment_attempts references both employees and,
     * for completed arrivals, deployment_assignments.
     * Remove attempts before assignment history so all
     * RESTRICT relationships are handled intentionally.
     */
    await connection.query(
      `
      DELETE FROM deployment_attempts
      WHERE employee_id = ?
      `,
      [
        id,
      ]
    );

    await connection.query(
      `
      DELETE FROM deployment_assignments
      WHERE employee_id = ?
      `,
      [
        id,
      ]
    );

    await connection.query(
      `
      DELETE FROM employee_status_history
      WHERE employee_id = ?
      `,
      [
        id,
      ]
    );

    await connection.query(
      `
      DELETE FROM employee_employment_history
      WHERE employee_id = ?
      `,
      [
        id,
      ]
    );

    const [
      employeeDeleteResult,
    ] =
      await connection.query(
        `
        DELETE FROM employees
        WHERE id = ?
          AND archived = 1
        `,
        [
          id,
        ]
      );

    if (
      Number(
        employeeDeleteResult.affectedRows ||
        0
      ) !== 1
    ) {
      throw new Error(
        "Employee deletion state changed before the operation could be completed."
      );
    }

    /*
     * At this point all related transactional DB
     * mutations have succeeded.
     */
    await connection.commit();

    transactionCommitted =
      true;

    /*
     * Release the transaction connection before
     * post-commit cleanup performs independent
     * reference-count queries.
     */
    connection.release();

    connection = null;

    await cleanupHistoricalFileCandidates(
      historicalFileCandidates,
      "employee_delete"
    );

    /*
     * Audit after successful commit only.
     */
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

      action:
        "DELETE_EMPLOYEE",

      description:
        `${actor.fullName} permanently deleted employee record for ${employeeName}.`,
    });

    return res.json({
      success: true,

      message:
        "Employee permanently deleted.",
    });
  } catch (err) {
    /*
     * If employee_documents deletion succeeds
     * but employee/cascade deletion fails, restore
     * the entire database state.
     *
     * Because the cascaded child deletes are part
     * of the same InnoDB transaction, rollback also
     * restores incidents/evidence/timeline.
     */
    if (
      connection &&
      transactionStarted &&
      !transactionCommitted
    ) {
      try {
        await connection.rollback();
      } catch (
        rollbackError
      ) {
        console.error(
          "DELETE EMPLOYEE ROLLBACK ERROR:",
          rollbackError
        );
      }
    }

    console.error(
      "DELETE EMPLOYEE ERROR:",
      err
    );

    return res
      .status(500)
      .json({
        error:
          "Delete employee error",
      });
  } finally {
    /*
     * Always return the dedicated connection
     * to the pool.
     */
    if (connection) {
      connection.release();
    }
  }
};