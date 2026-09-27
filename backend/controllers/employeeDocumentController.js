const path = require("path");

const db = require("../config/db");

const {
  normalizeObjectPath,
  createSignedDownloadUrl,
} = require("../services/storageService");

/*
 * ==================================================
 * APPROVED PRIVATE STORAGE NAMESPACES
 * ==================================================
 *
 * Existing database references are preserved.
 *
 * Current employee documents:
 * documents/employees/<file>
 *
 * Historical defense seed documents:
 * documents/seed-defense/<file>
 */
const DOCUMENT_STORAGE_MARKERS = [
  "documents/employees/",
  "documents/seed-defense/",
];

const EMPLOYEE_DOCUMENT_CONTENT_TYPES =
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

/*
 * ==================================================
 * AUTHORIZATION HELPERS
 * ==================================================
 */

function normalizeRole(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .toUpperCase()
    .replace(
      /[\s-]+/g,
      "_"
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
      req.user?.role
    ) ===
    "HR_COORDINATOR"
  );
}

function getHrCoordinatorAssignedCompany(
  req
) {
  return normalizeAssignedCompany(
    req.user?.assignedCompany ??
    req.user?.assigned_company
  );
}

function normalizeDocumentId(
  value
) {
  const rawValue =
    String(
      value || ""
    ).trim();

  if (
    !/^\d+$/.test(
      rawValue
    )
  ) {
    return null;
  }

  const documentId =
    Number(
      rawValue
    );

  if (
    !Number.isSafeInteger(
      documentId
    ) ||
    documentId <= 0
  ) {
    return null;
  }

  return documentId;
}

function normalizeSlashes(
  value
) {
  return String(
    value || ""
  )
    .trim()
    .replace(
      /\\/g,
      "/"
    );
}

function stripQueryAndFragment(
  value
) {
  return String(
    value || ""
  )
    .split(
      /[?#]/,
      1
    )[0];
}

/*
 * Convert current/historical DB path shapes into
 * one canonical private Supabase object path.
 *
 * Supported examples:
 *
 * documents/employees/file.pdf
 * /documents/employees/file.pdf
 * backend/documents/employees/file.pdf
 * C:/.../backend/documents/employees/file.pdf
 * https://host/documents/employees/file.pdf
 *
 * documents/seed-defense/file.pdf
 * /documents/seed-defense/file.pdf
 */
function resolveStoredDocumentObjectPath(
  storedFilePath
) {
  const cleanedPath =
    stripQueryAndFragment(
      normalizeSlashes(
        storedFilePath
      )
    );

  if (!cleanedPath) {
    return null;
  }

  const lowerPath =
    cleanedPath.toLowerCase();

  for (
    const marker of
    DOCUMENT_STORAGE_MARKERS
  ) {
    const markerIndex =
      lowerPath.lastIndexOf(
        marker
      );

    if (
      markerIndex < 0
    ) {
      continue;
    }

    const relativePath =
      cleanedPath
        .slice(
          markerIndex +
          marker.length
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
          `${marker}${relativePath}`
        );

      if (
        !objectPath.startsWith(
          marker
        )
      ) {
        return null;
      }

      return objectPath;
    } catch {
      return null;
    }
  }

  return null;
}

function getDocumentContentType(
  objectPath
) {
  const extension =
    path
      .extname(
        objectPath || ""
      )
      .toLowerCase();

  return (
    EMPLOYEE_DOCUMENT_CONTENT_TYPES[
      extension
    ] ||
    null
  );
}

function getSafeResponseFileName(
  objectPath
) {
  return path
    .basename(
      objectPath ||
      "document"
    )
    .replace(
      /["\r\n]/g,
      "_"
    );
}

/*
 * ==================================================
 * GET EMPLOYEE DOCUMENT FILE
 * ==================================================
 *
 * Authorization remains database-first.
 *
 * The browser supplies only the document ID.
 *
 * The object path comes exclusively from the
 * authorized employee_documents database row.
 */
async function getEmployeeDocumentFile(
  req,
  res
) {
  try {
    const documentId =
      normalizeDocumentId(
        req.params?.documentId
      );

    if (!documentId) {
      return res
        .status(400)
        .json({
          error:
            "Invalid employee document ID.",
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

    let documentSql;
    let documentParams;

    if (
      isHrCoordinator
    ) {
      /*
       * Coordinator scope is based on the current
       * active deployment assignment.
       */
      documentSql = `
        SELECT
          ed.id,
          ed.employee_id,
          ed.file_path
        FROM employee_documents AS ed

        INNER JOIN employees AS e
          ON e.id = ed.employee_id

        WHERE ed.id = ?

          AND e.archived = 0

          AND e.status <> 'Inactive'

          AND EXISTS (
            SELECT 1
            FROM deployment_assignments AS da_scope
            WHERE
              da_scope.employee_id =
                e.id

              AND da_scope.status =
                'Active'

              AND da_scope.company = ?
          )

        LIMIT 1
      `;

      documentParams = [
        documentId,
        coordinatorCompany,
      ];
    } else {
      documentSql = `
        SELECT
          ed.id,
          ed.employee_id,
          ed.file_path
        FROM employee_documents AS ed

        INNER JOIN employees AS e
          ON e.id = ed.employee_id

        WHERE ed.id = ?

        LIMIT 1
      `;

      documentParams = [
        documentId,
      ];
    }

    const [
      documentRows,
    ] =
      await db
        .promise()
        .query(
          documentSql,
          documentParams
        );

    /*
     * Same 404 covers:
     *
     * - missing document
     * - coordinator outside company scope
     */
    if (
      documentRows.length ===
      0
    ) {
      return res
        .status(404)
        .json({
          error:
            "Employee document not found.",
        });
    }

    const documentRecord =
      documentRows[0];

    const objectPath =
      resolveStoredDocumentObjectPath(
        documentRecord.file_path
      );

    if (!objectPath) {
      return res
        .status(404)
        .json({
          error:
            "Employee document not found.",
        });
    }

    const contentType =
      getDocumentContentType(
        objectPath
      );

    if (!contentType) {
      return res
        .status(415)
        .json({
          error:
            "Unsupported employee document type.",
        });
    }

    /*
     * Vercel Functions have a normal response-body
     * limit below WELLJOB's 5 MB protected-file
     * allowance.
     *
     * Keep authorization here, but let Supabase
     * deliver the actual binary directly.
     *
     * The signed URL expires after 60 seconds.
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
     * The redirect itself must not be cached.
     *
     * fetch() follows this redirect automatically,
     * so existing frontend Blob-preview behavior is
     * preserved without exposing the service key.
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
      "GET EMPLOYEE DOCUMENT ERROR:",
      {
        documentId:
          req.params?.documentId ||
          null,

        message:
          error?.message ||
          error,
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
          "Unable to load employee document.",
      });
  }
}

module.exports = {
  getEmployeeDocumentFile,
};
