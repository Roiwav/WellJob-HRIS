const fs = require("fs");
const path = require("path");

const db = require("../config/db");

/*
 * ==================================================
 * PROTECTED INCIDENT EVIDENCE
 * ==================================================
 *
 * Incident evidence currently shares the existing:
 *
 * backend/documents/employees
 *
 * storage directory with employee documents.
 *
 * This controller intentionally does NOT accept a
 * filesystem path or filename from the client.
 *
 * The client supplies only:
 *
 * - incidentId
 * - evidenceId
 *
 * The stored file_path is retrieved from the
 * incident_evidence database row.
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

function normalizePositiveInteger(
  value
) {
  const rawValue =
    String(value ?? "").trim();

  if (
    !/^\d+$/.test(rawValue)
  ) {
    return null;
  }

  const numericValue =
    Number(rawValue);

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
 * Existing incident evidence may contain paths
 * produced by older application versions, including:
 *
 * /documents/employees/file.pdf
 * documents/employees/file.pdf
 * backend/documents/employees/file.pdf
 * C:/.../backend/documents/employees/file.pdf
 *
 * We preserve those database values and extract only
 * the portion underneath documents/employees.
 *
 * No database migration or physical-file rename is
 * required.
 */
function getEvidenceRelativePath(
  storedPath
) {
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
      !path.isAbsolute(
        relativePath
      )
    )
  );
}

function getEvidenceContentType(
  filePath
) {
  const extension =
    path
      .extname(
        filePath
      )
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
    path.extname(
      filePath
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
      /*
       * Prevent header injection.
       */
      .replace(
        /[\r\n"]/g,
        ""
      )
      /*
       * Prevent path-like display names.
       */
      .replace(
        /[\\/]/g,
        "_"
      )
      /*
       * Keep Content-Disposition compatible with
       * Node HTTP header encoding.
       */
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

async function resolveEvidenceFile(
  storedPath
) {
  const relativePath =
    getEvidenceRelativePath(
      storedPath
    );

  if (!relativePath) {
    return null;
  }

  /*
   * First containment check:
   * lexical path resolution.
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
     * Resolve real filesystem paths so symlink
     * traversal cannot escape the approved root.
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
      error?.code ===
        "ENOENT" ||
      error?.code ===
        "ENOTDIR"
    ) {
      return null;
    }

    throw error;
  }

  /*
   * Second containment check:
   * actual filesystem / symlink-resolved paths.
   */
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

  if (
    !fileStats.isFile()
  ) {
    return null;
  }

  return realFilePath;
}

/*
 * GET
 * /api/incidents/:incidentId/evidence/:evidenceId/file
 *
 * Route-level middleware must enforce:
 *
 * SUPER_ADMIN
 * HR_MANAGER
 * HR_STAFF
 *
 * IT_SUPPORT is intentionally excluded.
 */
exports.getIncidentEvidenceFile =
  async (
    req,
    res
  ) => {
    try {
      const incidentId =
        normalizePositiveInteger(
          req.params
            ?.incidentId
        );

      const evidenceId =
        normalizePositiveInteger(
          req.params
            ?.evidenceId
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

      /*
       * Query by BOTH IDs.
       *
       * This prevents an evidence ID from one incident
       * being accessed through another incident URL.
       *
       * The incidents join also confirms that the
       * parent incident still exists.
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
            FROM incident_evidence ie
            INNER JOIN incidents i
              ON i.id = ie.incident_id
            WHERE
              ie.id = ?
              AND ie.incident_id = ?
            LIMIT 1
            `,
            [
              evidenceId,
              incidentId,
            ]
          );

      /*
       * Do not reveal whether the evidence exists
       * under a different incident.
       */
      if (
        rows.length === 0
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

      const resolvedFilePath =
        await resolveEvidenceFile(
          evidence.file_path
        );

      if (
        !resolvedFilePath
      ) {
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
       *
       * - nosniff prevents MIME interpretation.
       * - no-store prevents shared/local caching.
       * - inline preserves the current evidence
       *   preview/open behavior.
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
       * sendFile streams the binary rather than
       * loading the entire evidence file into memory.
       *
       * We already performed DB lookup, containment,
       * real-path verification, file-type validation,
       * and regular-file validation above.
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

          if (
            !res.headersSent
          ) {
            res
              .status(500)
              .json({
                error:
                  "Unable to retrieve incident evidence file.",
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