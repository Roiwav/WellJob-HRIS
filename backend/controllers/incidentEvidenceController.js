const path = require("path");

const db = require("../config/db");

const {
  normalizeObjectPath,
  createSignedDownloadUrl,
} = require("../services/storageService");

/*
 * ==================================================
 * PROTECTED INCIDENT EVIDENCE
 * ==================================================
 *
 * Evidence remains private.
 *
 * Browser provides:
 *
 * - incidentId
 * - evidenceId
 *
 * Storage object path is loaded only from MySQL
 * after authorization succeeds.
 */

const INCIDENT_EVIDENCE_MARKER =
  "documents/employees/";

const SUPPORTED_EVIDENCE_TYPES =
  Object.freeze({
    ".pdf":
      "application/pdf",

    ".png":
      "image/png",

    ".jpg":
      "image/jpeg",

    ".jpeg":
      "image/jpeg",
  });

function normalizeRole(
  value
) {
  const role =
    String(
      value || ""
    )
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
    ].includes(
      role
    )
  ) {
    return "SUPER_ADMIN";
  }

  if (
    [
      "HRMANAGER",
      "HR_MANAGER",
    ].includes(
      role
    )
  ) {
    return "HR_MANAGER";
  }

  if (
    [
      "HRSTAFF",
      "HR_STAFF",
    ].includes(
      role
    )
  ) {
    return "HR_STAFF";
  }

  if (
    [
      "HRCOORDINATOR",
      "HR_COORDINATOR",
    ].includes(
      role
    )
  ) {
    return "HR_COORDINATOR";
  }

  if (
    [
      "ITSUPPORT",
      "IT_SUPPORT",
    ].includes(
      role
    )
  ) {
    return "IT_SUPPORT";
  }

  return (
    role ||
    "USER"
  );
}

function normalizeAssignedCompany(
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

  return (
    normalized ||
    null
  );
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

function getHrCoordinatorAssignedCompany(
  req
) {
  return normalizeAssignedCompany(
    req?.user?.assignedCompany ??
    req?.user?.assigned_company
  );
}

function normalizePositiveInteger(
  value
) {
  const rawValue =
    String(
      value ?? ""
    ).trim();

  if (
    !/^\d+$/.test(
      rawValue
    )
  ) {
    return null;
  }

  const numericValue =
    Number(
      rawValue
    );

  if (
    !Number.isSafeInteger(
      numericValue
    ) ||
    numericValue <= 0
  ) {
    return null;
  }

  return numericValue;
}

/*
 * Convert current/historical evidence references
 * into the canonical Supabase object path.
 */
function resolveEvidenceObjectPath(
  storedPath
) {
  const normalized =
    String(
      storedPath || ""
    )
      .trim()
      .replace(
        /\\/g,
        "/"
      );

  if (!normalized) {
    return null;
  }

  const cleaned =
    normalized
      .split(
        /[?#]/,
        1
      )[0];

  const markerIndex =
    cleaned
      .toLowerCase()
      .lastIndexOf(
        INCIDENT_EVIDENCE_MARKER
      );

  if (
    markerIndex < 0
  ) {
    return null;
  }

  const relativePath =
    cleaned
      .slice(
        markerIndex +
        INCIDENT_EVIDENCE_MARKER.length
      )
      .replace(
        /^\/+/,
        ""
      )
      .trim();

  if (!relativePath) {
    return null;
  }

  try {
    const objectPath =
      normalizeObjectPath(
        `${INCIDENT_EVIDENCE_MARKER}${relativePath}`
      );

    if (
      !objectPath.startsWith(
        INCIDENT_EVIDENCE_MARKER
      )
    ) {
      return null;
    }

    return objectPath;
  } catch {
    return null;
  }
}

function getEvidenceContentType(
  objectPath
) {
  const extension =
    path
      .extname(
        objectPath ||
        ""
      )
      .toLowerCase();

  return (
    SUPPORTED_EVIDENCE_TYPES[
      extension
    ] ||
    null
  );
}

function sanitizeDownloadFileName(
  value,
  objectPath
) {
  const extension =
    path.extname(
      objectPath ||
      ""
    );

  const fallbackName =
    `incident-evidence${extension}`;

  const sourceName =
    path.basename(
      String(
        value ||
        fallbackName
      )
    );

  const sanitizedName =
    sourceName
      .replace(
        /[\r\n"]/g,
        ""
      )
      .replace(
        /[\\/]/g,
        "_"
      )
      .replace(
        /[^\x20-\x7E]/g,
        "_"
      )
      .trim();

  return (
    sanitizedName ||
    fallbackName
  );
}

/*
 * ==================================================
 * HR COORDINATOR EVIDENCE SCOPE
 * ==================================================
 */
function buildCoordinatorEvidenceScopeSql() {
  return `
    AND LOWER(
      TRIM(
        COALESCE(i.company, '')
      )
    ) = LOWER(TRIM(?))

    AND e.id IS NOT NULL

    AND COALESCE(e.archived, 0) = 0

    AND LOWER(
      TRIM(
        COALESCE(e.status, '')
      )
    ) = 'deployed'

    AND EXISTS (
      SELECT 1

      FROM deployment_assignments
        AS da_current

      WHERE
        da_current.employee_id = e.id

        AND da_current.status = 'Active'

        AND LOWER(
          TRIM(
            COALESCE(
              da_current.company,
              ''
            )
          )
        ) = LOWER(TRIM(?))

        AND NOT EXISTS (
          SELECT 1

          FROM deployment_assignments
            AS da_conflict

          WHERE
            da_conflict.employee_id = e.id

            AND da_conflict.status = 'Active'

            AND da_conflict.id <>
              da_current.id
        )
    )
  `;
}

/*
 * GET
 * /api/incidents/:incidentId/evidence/:evidenceId/file
 */
exports.getIncidentEvidenceFile =
  async (
    req,
    res
  ) => {
    try {
      const incidentId =
        normalizePositiveInteger(
          req.params?.incidentId
        );

      const evidenceId =
        normalizePositiveInteger(
          req.params?.evidenceId
        );

      if (
        !incidentId ||
        !evidenceId
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid incident evidence request.",
          });
      }

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

      const companyScopeSql =
        isHrCoordinator
          ? buildCoordinatorEvidenceScopeSql()
          : "";

      const queryParams = [
        evidenceId,
        incidentId,

        ...(
          isHrCoordinator
            ? [
                coordinatorCompany,
                coordinatorCompany,
              ]
            : []
        ),
      ];

      /*
       * Database authorization happens before
       * any Supabase object access.
       */
      const [
        rows,
      ] =
        await db
          .promise()
          .query(
            `
            SELECT
              ie.id,
              ie.incident_id,
              ie.file_name,
              ie.file_path

            FROM incident_evidence AS ie

            INNER JOIN incidents AS i
              ON i.id = ie.incident_id

            LEFT JOIN employees AS e
              ON e.id = i.employee_id

            WHERE
              ie.id = ?

              AND ie.incident_id = ?

              ${companyScopeSql}

            LIMIT 1
            `,
            queryParams
          );

      /*
       * Same 404 protects against enumeration.
       */
      if (
        rows.length ===
        0
      ) {
        return res
          .status(404)
          .json({
            error:
              "Incident evidence file not found.",
          });
      }

      const evidence =
        rows[0];

      const objectPath =
        resolveEvidenceObjectPath(
          evidence.file_path
        );

      if (!objectPath) {
        return res
          .status(404)
          .json({
            error:
              "Incident evidence file not found.",
          });
      }

      const contentType =
        getEvidenceContentType(
          objectPath
        );

      if (!contentType) {
        return res
          .status(415)
          .json({
            error:
              "Unsupported incident evidence file type.",
          });
      }

      /*
       * Authorization is completed above before a
       * signed Storage URL is issued.
       *
       * Supabase serves the actual binary directly
       * so Vercel never proxies a potentially 5 MB
       * evidence response.
       */
      const {
        signedUrl,
      } =
        await createSignedDownloadUrl(
          objectPath,
          {
            expiresIn:
              60,
          }
        );

      /*
       * Do not cache the authorization redirect.
       */
      res.setHeader(
        "Cache-Control",
        "private, no-store, max-age=0"
      );

      res.setHeader(
        "Pragma",
        "no-cache"
      );

      res.setHeader(
        "Expires",
        "0"
      );

      return res.redirect(
        302,
        signedUrl
      );
    } catch (error) {
      console.error(
        "GET INCIDENT EVIDENCE FILE ERROR:",
        {
          code:
            error?.code ||
            null,

          message:
            error?.message ||
            "Unknown incident evidence error",
        }
      );

      if (
        res.headersSent
      ) {
        return undefined;
      }

      return res
        .status(500)
        .json({
          error:
            "Unable to retrieve incident evidence file.",
        });
    }
  };
