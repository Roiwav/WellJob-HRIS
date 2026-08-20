const fs = require("fs");
const path = require("path");

const db = require("../config/db");

const EMPLOYEE_DOCUMENT_DIRECTORY =
  path.resolve(
    __dirname,
    "..",
    "documents",
    "employees"
  );

const EMPLOYEE_DOCUMENT_CONTENT_TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

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
    Number(rawValue);

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

function resolveStoredDocumentPath(
  storedFilePath
) {
  const normalizedPath =
    String(
      storedFilePath || ""
    )
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

  if (!normalizedPath) {
    return null;
  }

  /*
   * Only employee-document paths already stored
   * by the existing employee upload workflow are
   * accepted.
   */
  if (
    !normalizedPath.startsWith(
      "documents/employees/"
    )
  ) {
    return null;
  }

  const absolutePath =
    path.resolve(
      __dirname,
      "..",
      normalizedPath
    );

  const relativePath =
    path.relative(
      EMPLOYEE_DOCUMENT_DIRECTORY,
      absolutePath
    );

  /*
   * Reject:
   * - the directory root itself
   * - ../ traversal
   * - any absolute path produced by path.relative
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

  return absolutePath;
}

async function resolveRealDocumentPath(
  absolutePath
) {
  try {
    const [
      realDocumentDirectory,
      realFilePath,
    ] = await Promise.all([
      fs.promises.realpath(
        EMPLOYEE_DOCUMENT_DIRECTORY
      ),

      fs.promises.realpath(
        absolutePath
      ),
    ]);

    const relativePath =
      path.relative(
        realDocumentDirectory,
        realFilePath
      );

    /*
     * Perform containment verification again
     * using real paths.
     *
     * This also protects against a filesystem
     * symlink inside the employee document
     * directory resolving outside that directory.
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
      error?.code ===
        "ENOENT" ||
      error?.code ===
        "ENOTDIR"
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
      filePath || "document"
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
 *   "HR_STAFF"
 * )
 * ->
 * getEmployeeDocumentFile
 *
 * Security rules:
 *
 * 1. The client provides only the database document ID.
 * 2. file_path comes exclusively from employee_documents.
 * 3. The DB row must still belong to an existing employee.
 * 4. The path must remain inside:
 *    backend/documents/employees
 * 5. Existing files and database paths are never renamed
 *    or deleted by this endpoint.
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

    const [
      documentRows,
    ] =
      await db
        .promise()
        .query(
          `
          SELECT
            ed.id,
            ed.employee_id,
            ed.file_path
          FROM employee_documents ed
          INNER JOIN employees e
            ON e.id = ed.employee_id
          WHERE ed.id = ?
          LIMIT 1
          `,
          [
            documentId,
          ]
        );

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

    const candidatePath =
      resolveStoredDocumentPath(
        documentRecord.file_path
      );

    if (!candidatePath) {
      return res
        .status(404)
        .json({
          error:
            "Employee document not found.",
        });
    }

    const realFilePath =
      await resolveRealDocumentPath(
        candidatePath
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

    if (
      !fileStats.isFile()
    ) {
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
     *
     * Full magic-byte upload validation will be
     * handled separately during upload hardening.
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
        dotfiles: "deny",
        cacheControl: false,
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
              statusCode === 404
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
          req.params?.documentId ||
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