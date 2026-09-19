const fs = require("fs");
const path = require("path");

const db = require("../config/db");

/*
 * Approved employee-document storage namespaces.
 *
 * - documents/employees:
 *   Current employee upload workflow.
 *
 * - documents/seed-defense:
 *   Historical/synthetic defense dataset references
 *   already stored in employee_documents.file_path.
 *
 * Each stored reference is converted back into a path
 * underneath one of these explicitly approved roots.
 */
const DOCUMENT_STORAGE_ROOTS = [
  {
    marker: "documents/employees/",
    directory: path.resolve(
      __dirname,
      "..",
      "documents",
      "employees"
    ),
  },
  {
    marker: "documents/seed-defense/",
    directory: path.resolve(
      __dirname,
      "..",
      "documents",
      "seed-defense"
    ),
  },
];

const EMPLOYEE_DOCUMENT_CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

/*
 * ==================================================
 * AUTHORIZATION HELPERS
 * ==================================================
 */

function normalizeRole(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeAssignedCompany(value) {
  const normalized = String(
    value ?? ""
  )
    .trim()
    .replace(/\s+/g, " ");

  return normalized || null;
}

function isHrCoordinatorRequest(req) {
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

function normalizeDocumentId(value) {
  const rawValue = String(
    value || ""
  ).trim();

  if (!/^\d+$/.test(rawValue)) {
    return null;
  }

  const documentId = Number(
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

function normalizeSlashes(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/");
}

function stripQueryAndFragment(value) {
  return String(value || "")
    .split(/[?#]/, 1)[0];
}

/*
 * Convert supported current/historical references
 * into a safe absolute path beneath an approved
 * document root.
 *
 * Supported shapes include:
 *
 * documents/employees/file.pdf
 * /documents/employees/file.pdf
 * backend/documents/employees/file.pdf
 * C:/.../backend/documents/employees/file.pdf
 *
 * documents/seed-defense/file.pdf
 * /documents/seed-defense/file.pdf
 * backend/documents/seed-defense/file.pdf
 * C:/.../backend/documents/seed-defense/file.pdf
 *
 * URL-shaped historical references containing one
 * of the approved markers are also normalized to the
 * local approved storage root.
 */
function resolveStoredDocumentPath(
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
    const storageRoot of
      DOCUMENT_STORAGE_ROOTS
  ) {
    const markerIndex =
      lowerPath.lastIndexOf(
        storageRoot.marker
      );

    if (markerIndex < 0) {
      continue;
    }

    const relativePath =
      cleanedPath
        .slice(
          markerIndex +
            storageRoot.marker.length
        )
        .replace(/^\/+/, "");

    if (!relativePath) {
      return null;
    }

    const absolutePath =
      path.resolve(
        storageRoot.directory,
        relativePath
      );

    const relativeFromRoot =
      path.relative(
        storageRoot.directory,
        absolutePath
      );

    /*
     * Reject:
     * - the storage root itself
     * - ../ traversal
     * - absolute escape paths
     */
    if (
      !relativeFromRoot ||
      relativeFromRoot.startsWith(
        ".."
      ) ||
      path.isAbsolute(
        relativeFromRoot
      )
    ) {
      return null;
    }

    return {
      absolutePath,

      storageRoot:
        storageRoot.directory,
    };
  }

  return null;
}

async function resolveRealDocumentPath(
  pathCandidate
) {
  if (
    !pathCandidate?.absolutePath ||
    !pathCandidate?.storageRoot
  ) {
    return null;
  }

  try {
    const [
      realDocumentDirectory,
      realFilePath,
    ] = await Promise.all([
      fs.promises.realpath(
        pathCandidate.storageRoot
      ),

      fs.promises.realpath(
        pathCandidate.absolutePath
      ),
    ]);

    const relativePath =
      path.relative(
        realDocumentDirectory,
        realFilePath
      );

    /*
     * Perform containment verification again
     * using real filesystem paths.
     *
     * This prevents a symlink inside an approved
     * document directory from resolving outside
     * that directory.
     */
    if (
      !relativePath ||
      relativePath.startsWith(
        ".."
      ) ||
      path.isAbsolute(
        relativePath
      )
    ) {
      return null;
    }

    return realFilePath;
  } catch (error) {
    if (
      error?.code === "ENOENT" ||
      error?.code === "ENOTDIR"
    ) {
      return null;
    }

    throw error;
  }
}

function getDocumentContentType(
  filePath
) {
  const extension =
    path
      .extname(
        filePath || ""
      )
      .toLowerCase();

  return (
    EMPLOYEE_DOCUMENT_CONTENT_TYPES[
      extension
    ] || null
  );
}

function getSafeResponseFileName(
  filePath
) {
  return path
    .basename(
      filePath ||
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
 * PROTECTED DB-BACKED BINARY ACCESS
 * ==================================================
 *
 * Expected route security:
 *
 * verifyToken
 * ->
 * authorizeRoles(
 *   "SUPER_ADMIN",
 *   "HR_MANAGER",
 *   "HR_STAFF",
 *   "HR_COORDINATOR"
 * )
 * ->
 * getEmployeeDocumentFile
 *
 * Security rules:
 *
 * 1. The client provides only the database document ID.
 *
 * 2. file_path comes exclusively from
 *    employee_documents.
 *
 * 3. The DB row must still belong to an existing
 *    employee.
 *
 * 4. HR Coordinator may access a document only when
 *    the employee currently has an ACTIVE deployment
 *    assignment matching req.user.assignedCompany.
 *
 * 5. HR Coordinator cannot access archived/inactive
 *    employee documents.
 *
 * 6. Cross-company document IDs return the same 404
 *    response as nonexistent document IDs to prevent
 *    record enumeration.
 *
 * 7. Company scope comes only from authenticated
 *    server-side req.user information. Query/body
 *    company values are never trusted.
 *
 * 8. The resolved filesystem path must remain inside
 *    an explicitly approved backend document root.
 *
 * 9. Historical seed-defense references continue to
 *    work without rewriting stored DB paths.
 *
 * 10. Existing files and DB paths are never modified
 *     by this endpoint.
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

    /*
     * Defense in depth.
     *
     * authMiddleware should already reject an
     * HR Coordinator account without a company.
     *
     * Never allow this controller to fall back to
     * unrestricted document access if that upstream
     * protection is accidentally changed later.
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

    let documentSql;
    let documentParams;

    if (isHrCoordinator) {
      /*
       * IMPORTANT:
       *
       * The authoritative coordinator scope is based
       * on CURRENT active deployment assignment.
       *
       * We intentionally do not rely only on
       * employees.company because deployment history
       * may contain previous company assignments.
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
      /*
       * Preserve existing access behavior for:
       *
       * - SUPER_ADMIN
       * - HR_MANAGER
       * - HR_STAFF
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

        LIMIT 1
      `;

      documentParams = [
        documentId,
      ];
    }

    const [documentRows] =
      await db
        .promise()
        .query(
          documentSql,
          documentParams
        );

    /*
     * SECURITY:
     *
     * For HR Coordinator this response intentionally
     * covers both:
     *
     * - nonexistent document
     * - existing document outside assigned company
     *
     * Do not reveal which one occurred.
     */
    if (
      documentRows.length === 0
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

    const pathCandidate =
      resolveStoredDocumentPath(
        documentRecord.file_path
      );

    if (!pathCandidate) {
      return res
        .status(404)
        .json({
          error:
            "Employee document not found.",
        });
    }

    const realFilePath =
      await resolveRealDocumentPath(
        pathCandidate
      );

    if (!realFilePath) {
      return res
        .status(404)
        .json({
          error:
            "Employee document file not found.",
        });
    }

    let fileStats;

    try {
      fileStats =
        await fs.promises.stat(
          realFilePath
        );
    } catch (error) {
      if (
        error?.code ===
          "ENOENT" ||
        error?.code ===
          "ENOTDIR"
      ) {
        return res
          .status(404)
          .json({
            error:
              "Employee document file not found.",
          });
      }

      throw error;
    }

    if (!fileStats.isFile()) {
      return res
        .status(404)
        .json({
          error:
            "Employee document file not found.",
        });
    }

    const contentType =
      getDocumentContentType(
        realFilePath
      );

    /*
     * Do not serve unexpected executable or
     * unsupported extensions through this endpoint.
     */
    if (!contentType) {
      return res
        .status(415)
        .json({
          error:
            "Unsupported employee document type.",
        });
    }

    const responseFileName =
      getSafeResponseFileName(
        realFilePath
      );

    /*
     * Sensitive employee documents should not be
     * stored by shared browser/proxy caches.
     */
    res.setHeader(
      "Content-Type",
      contentType
    );

    res.setHeader(
      "Content-Disposition",
      `inline; filename="${responseFileName}"`
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

    /*
     * sendFile streams the binary rather than
     * loading the entire document into Node memory.
     *
     * Explicit callback handling prevents physical
     * filesystem details from being exposed to the
     * client if a race-condition file error occurs.
     */
    return res.sendFile(
      realFilePath,
      {
        dotfiles:
          "deny",

        cacheControl:
          false,
      },
      (error) => {
        if (!error) {
          return;
        }

        console.error(
          "EMPLOYEE DOCUMENT SEND ERROR:",
          {
            documentId,

            code:
              error?.code ||
              null,

            message:
              error?.message ||
              "Unknown document send error",
          }
        );

        if (
          res.headersSent
        ) {
          res.destroy(
            error
          );

          return;
        }

        const statusCode =
          error?.code ===
            "ENOENT" ||
          error?.statusCode ===
            404
            ? 404
            : 500;

        res
          .status(
            statusCode
          )
          .json({
            error:
              statusCode ===
              404
                ? "Employee document file not found."
                : "Unable to load employee document.",
          });
      }
    );
  } catch (error) {
    console.error(
      "GET EMPLOYEE DOCUMENT ERROR:",
      {
        documentId:
          req.params
            ?.documentId ||
          null,

        message:
          error?.message ||
          error,
      }
    );

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