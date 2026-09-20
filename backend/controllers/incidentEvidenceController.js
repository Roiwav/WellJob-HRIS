
const fs = require("fs");
const path = require("path");

const db = require("../config/db");

/*
 * ==================================================
 * PROTECTED INCIDENT EVIDENCE
 * ==================================================
 *
 * Incident evidence shares the existing:
 *
 * backend/documents/employees
 *
 * storage directory with employee documents.
 *
 * The client supplies only:
 *
 * - incidentId
 * - evidenceId
 *
 * File paths are retrieved from the database, not
 * accepted from the client.
 *
 * HR COORDINATOR — OPTION A:
 *
 * A coordinator may open evidence only when BOTH:
 *
 * 1. The incident belongs to their assigned company.
 * 2. The employee is currently deployed exclusively
 *    to that same company.
 *
 * Historical incidents may remain visible in the
 * coordinator's incident list, but their full details
 * and evidence become inaccessible after transfer.
 *
 * Other authorized HR roles retain their existing
 * historical evidence access.
 */

const INCIDENT_EVIDENCE_ROOT =
  path.resolve(
    __dirname,
    "..",
    "documents",
    "employees"
  );

const SUPPORTED_EVIDENCE_TYPES =
  Object.freeze({
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
  });

function normalizeRole(value) {
  const role =
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

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

function normalizeAssignedCompany(value) {
  const normalized =
    String(value ?? "")
      .trim()
      .replace(/\s+/g, " ");

  return normalized || null;
}

function isHrCoordinatorRequest(req) {
  return (
    normalizeRole(req?.user?.role) ===
    "HR_COORDINATOR"
  );
}

function getHrCoordinatorAssignedCompany(req) {
  return normalizeAssignedCompany(
    req?.user?.assignedCompany ??
      req?.user?.assigned_company
  );
}

function normalizePositiveInteger(value) {
  const rawValue =
    String(value ?? "").trim();

  if (!/^\d+$/.test(rawValue)) {
    return null;
  }

  const numericValue =
    Number(rawValue);

  if (
    !Number.isSafeInteger(numericValue) ||
    numericValue <= 0
  ) {
    return null;
  }

  return numericValue;
}

/*
 * Existing evidence paths may have been produced
 * by older application versions:
 *
 * /documents/employees/file.pdf
 * documents/employees/file.pdf
 * backend/documents/employees/file.pdf
 * C:/.../backend/documents/employees/file.pdf
 *
 * Preserve stored database paths. Extract only
 * the portion underneath documents/employees.
 */

function getEvidenceRelativePath(storedPath) {
  const normalized =
    String(storedPath || "")
      .trim()
      .replace(/\\/g, "/");

  if (!normalized) {
    return null;
  }

  const marker =
    "documents/employees/";

  const markerIndex =
    normalized
      .toLowerCase()
      .indexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  const relativePath =
    normalized
      .slice(
        markerIndex +
          marker.length
      )
      .split(/[?#]/, 1)[0]
      .replace(/^\/+/, "")
      .trim();

  if (!relativePath) {
    return null;
  }

  return relativePath;
}

function isPathContained(
  rootPath,
  targetPath
) {
  const relativePath =
    path.relative(
      rootPath,
      targetPath
    );

  return (
    relativePath === "" ||
    (
      !relativePath.startsWith(
        `..${path.sep}`
      ) &&
      relativePath !== ".." &&
      !path.isAbsolute(relativePath)
    )
  );
}

function getEvidenceContentType(filePath) {
  const extension =
    path
      .extname(filePath)
      .toLowerCase();

  return (
    SUPPORTED_EVIDENCE_TYPES[
      extension
    ] || null
  );
}

function sanitizeDownloadFileName(
  value,
  filePath
) {
  const extension =
    path.extname(filePath);

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
      .replace(/[\r\n"]/g, "")
      .replace(/[\\/]/g, "_")
      .replace(/[^\x20-\x7E]/g, "_")
      .trim();

  return (
    sanitizedName ||
    fallbackName
  );
}

async function resolveEvidenceFile(storedPath) {
  const relativePath =
    getEvidenceRelativePath(
      storedPath
    );

  if (!relativePath) {
    return null;
  }

  /*
   * First containment check:
   * lexical filesystem path.
   */

  const candidatePath =
    path.resolve(
      INCIDENT_EVIDENCE_ROOT,
      relativePath
    );

  if (
    !isPathContained(
      INCIDENT_EVIDENCE_ROOT,
      candidatePath
    )
  ) {
    return null;
  }

  let realRootPath;
  let realFilePath;

  try {
    /*
     * Second containment check:
     * resolve symlinks and actual filesystem paths.
     */

    [
      realRootPath,
      realFilePath,
    ] = await Promise.all([
      fs.promises.realpath(
        INCIDENT_EVIDENCE_ROOT
      ),

      fs.promises.realpath(
        candidatePath
      ),
    ]);
  } catch (error) {
    if (
      error?.code === "ENOENT" ||
      error?.code === "ENOTDIR"
    ) {
      return null;
    }

    throw error;
  }

  if (
    !isPathContained(
      realRootPath,
      realFilePath
    )
  ) {
    return null;
  }

  const fileStats =
    await fs.promises.stat(
      realFilePath
    );

  if (!fileStats.isFile()) {
    return null;
  }

  return realFilePath;
}

/*
 * ==================================================
 * OPTION A — COORDINATOR EVIDENCE ACCESS
 * ==================================================
 *
 * Use the same employee/deployment conditions as
 * the protected incident-details endpoint.
 *
 * IMPORTANT:
 *
 * - Incident company must match coordinator company.
 * - Employee must exist and must not be archived.
 * - Employee status must be Deployed.
 * - Employee must have exactly one active deployment.
 * - That active deployment must be at the
 *   coordinator's assigned company.
 *
 * The current employee company is derived from the
 * active deployment, not a browser-supplied value.
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
 *
 * Route-level middleware must allow only:
 *
 * SUPER_ADMIN
 * HR_MANAGER
 * HR_STAFF
 * HR_COORDINATOR
 *
 * IT_SUPPORT must remain excluded.
 *
 * This controller provides additional
 * HR Coordinator company/deployment authorization.
 */

exports.getIncidentEvidenceFile =
  async (req, res) => {
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
        isHrCoordinatorRequest(req);

      const coordinatorCompany =
        isHrCoordinator
          ? getHrCoordinatorAssignedCompany(req)
          : null;

      /*
       * Fail closed if the coordinator has
       * no assigned company.
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

      const companyScopeSql =
        isHrCoordinator
          ? buildCoordinatorEvidenceScopeSql()
          : "";

      /*
       * Parameter order:
       *
       * 1. Evidence ID
       * 2. Incident ID
       * 3. Incident company (coordinator only)
       * 4. Current deployment company
       *    (coordinator only)
       */

      const queryParams = [
        evidenceId,
        incidentId,

        ...(isHrCoordinator
          ? [
              coordinatorCompany,
              coordinatorCompany,
            ]
          : []),
      ];

      /*
       * Join evidence to its exact parent incident.
       *
       * The employee join is needed for
       * coordinator deployment authorization.
       *
       * Other authorized HR roles do not receive
       * coordinator-specific scope restrictions.
       */

      const [rows] =
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
       * The same 404 is used for:
       *
       * - Missing evidence
       * - Evidence belonging to another incident
       * - Incident belonging to another company
       * - Historical incident whose employee
       *   is no longer deployed at the
       *   coordinator's company
       */

      if (rows.length === 0) {
        return res
          .status(404)
          .json({
            error:
              "Incident evidence file not found.",
          });
      }

      const evidence =
        rows[0];

      /*
       * Filesystem access happens only after
       * database authorization succeeds.
       */

      const resolvedFilePath =
        await resolveEvidenceFile(
          evidence.file_path
        );

      if (!resolvedFilePath) {
        return res
          .status(404)
          .json({
            error:
              "Incident evidence file not found.",
          });
      }

      const contentType =
        getEvidenceContentType(
          resolvedFilePath
        );

      if (!contentType) {
        return res
          .status(415)
          .json({
            error:
              "Unsupported incident evidence file type.",
          });
      }

      const safeFileName =
        sanitizeDownloadFileName(
          evidence.file_name,
          resolvedFilePath
        );

      /*
       * Sensitive binary response policy.
       */

      res.setHeader(
        "Content-Type",
        contentType
      );

      res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
      );

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

      res.setHeader(
        "Content-Disposition",
        `inline; filename="${safeFileName}"`
      );

      /*
       * Stream the authorized evidence file.
       */

      return res.sendFile(
        resolvedFilePath,
        (error) => {
          if (!error) {
            return;
          }

          console.error(
            "INCIDENT EVIDENCE FILE SEND ERROR:",
            {
              code:
                error?.code ||
                null,

              status:
                error?.status ||
                null,

              message:
                error?.message ||
                "Unknown file streaming error",
            }
          );

          if (!res.headersSent) {
            const statusCode =
              error?.code ===
                "ENOENT" ||
              error?.status ===
                404 ||
              error?.statusCode ===
                404
                ? 404
                : 500;

            res
              .status(statusCode)
              .json({
                error:
                  statusCode === 404
                    ? "Incident evidence file not found."
                    : "Unable to retrieve incident evidence file.",
              });
          }
        }
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

      if (res.headersSent) {
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