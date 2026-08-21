const fs = require("fs");
const path = require("path");

const db = require("../config/db");

const STORAGE_MARKER =
  "documents/employees/";

const STORAGE_ROOT = path.resolve(
  __dirname,
  "..",
  "documents",
  "employees"
);

function normalizeSlashes(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/");
}

function stripQueryAndFragment(value) {
  return String(value || "")
    .split(/[?#]/, 1)[0];
}

function normalizeComparisonKey(
  relativePath
) {
  const normalized =
    normalizeSlashes(relativePath)
      .replace(/^\/+/, "")
      .replace(/\/+/g, "/");

  /*
   * Windows filesystems are normally
   * case-insensitive, while Linux filesystems
   * may be case-sensitive.
   */
  return process.platform === "win32"
    ? normalized.toLowerCase()
    : normalized;
}

/*
 * Convert supported historical/current stored
 * references into one safe storage-root-relative
 * identity.
 *
 * Supported examples:
 *
 * documents/employees/file.pdf
 * /documents/employees/file.pdf
 * backend/documents/employees/file.pdf
 * C:/.../backend/documents/employees/file.pdf
 * http://host/documents/employees/file.pdf
 *
 * Anything that cannot be proven to belong under
 * the approved storage root is rejected.
 */
function normalizeStoredFileReference(
  value
) {
  const cleaned =
    stripQueryAndFragment(
      normalizeSlashes(value)
    );

  if (!cleaned) {
    return null;
  }

  const lower =
    cleaned.toLowerCase();

  const markerIndex =
    lower.lastIndexOf(
      STORAGE_MARKER
    );

  if (markerIndex < 0) {
    return null;
  }

  const relativePath =
    cleaned
      .slice(
        markerIndex +
          STORAGE_MARKER.length
      )
      .replace(/^\/+/, "");

  if (!relativePath) {
    return null;
  }

  const resolvedPath =
    path.resolve(
      STORAGE_ROOT,
      relativePath
    );

  const relativeFromRoot =
    path.relative(
      STORAGE_ROOT,
      resolvedPath
    );

  /*
   * Reject:
   * - the root itself
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

  const normalizedRelativePath =
    normalizeSlashes(
      relativeFromRoot
    );

  return {
    key:
      normalizeComparisonKey(
        normalizedRelativePath
      ),

    relativePath:
      normalizedRelativePath,

    absolutePath:
      resolvedPath,
  };
}

/*
 * Build a normalized reference-count map across
 * every currently proven physical-file reference
 * source.
 *
 * Do not count employee_documents.file because
 * the current audit confirmed that it is unused
 * and empty.
 */
async function loadReferenceCounts() {
  const [
    [employeeDocumentRows],
    [incidentEvidenceRows],
  ] = await Promise.all([
    db.promise().query(
      `
      SELECT file_path
      FROM employee_documents
      WHERE file_path IS NOT NULL
        AND TRIM(file_path) <> ''
      `
    ),

    db.promise().query(
      `
      SELECT file_path
      FROM incident_evidence
      WHERE file_path IS NOT NULL
        AND TRIM(file_path) <> ''
      `
    ),
  ]);

  const counts =
    new Map();

  for (
    const row of [
      ...employeeDocumentRows,
      ...incidentEvidenceRows,
    ]
  ) {
    const normalized =
      normalizeStoredFileReference(
        row.file_path
      );

    /*
     * Unknown/unsafe legacy values are not
     * converted into deletion candidates.
     */
    if (!normalized) {
      continue;
    }

    counts.set(
      normalized.key,
      (
        counts.get(
          normalized.key
        ) || 0
      ) + 1
    );
  }

  return counts;
}

/*
 * Final filesystem safety check before unlink.
 *
 * lstat() rejects symbolic links so cleanup cannot
 * follow a link into another location.
 *
 * realpath() is then used as a second containment
 * check for the actual filesystem entry.
 */
async function inspectSafeStoredFile(
  absolutePath
) {
  let stats;

  try {
    stats =
      await fs.promises.lstat(
        absolutePath
      );
  } catch (error) {
    if (
      error?.code ===
      "ENOENT"
    ) {
      return {
        exists: false,
      };
    }

    throw error;
  }

  if (stats.isSymbolicLink()) {
    throw new Error(
      "Refusing to delete a symbolic link from employee document storage."
    );
  }

  if (!stats.isFile()) {
    throw new Error(
      "Refusing to delete a non-file storage entry."
    );
  }

  const realPath =
    await fs.promises.realpath(
      absolutePath
    );

  const relativeFromRoot =
    path.relative(
      STORAGE_ROOT,
      realPath
    );

  if (
    !relativeFromRoot ||
    relativeFromRoot.startsWith(
      ".."
    ) ||
    path.isAbsolute(
      relativeFromRoot
    )
  ) {
    throw new Error(
      "Resolved file is outside the approved employee document storage root."
    );
  }

  return {
    exists: true,
  };
}

/*
 * REFERENCE-AWARE POST-COMMIT CLEANUP
 *
 * Intended use:
 *
 * 1. Controller captures old DB file paths before
 *    replacing/deleting their rows.
 *
 * 2. DB transaction commits.
 *
 * 3. Controller passes those old paths here.
 *
 * 4. This service recounts ALL currently surviving
 *    references across employee documents and
 *    incident evidence.
 *
 * 5. Physical deletion occurs only when the total
 *    reference count is zero.
 *
 * This function intentionally does NOT scan for or
 * automatically delete historical orphan files.
 */
async function cleanupUnreferencedFileCandidates(
  candidates,
  {
    source = "unknown",
  } = {}
) {
  const rawCandidates =
    Array.isArray(candidates)
      ? candidates
      : [];

  const normalizedCandidates =
    new Map();

  /*
   * Normalize and deduplicate candidates first.
   */
  for (
    const candidate of
      rawCandidates
  ) {
    const normalized =
      normalizeStoredFileReference(
        candidate
      );

    if (!normalized) {
      if (
        String(
          candidate || ""
        ).trim()
      ) {
        console.error(
          "FILE LIFECYCLE CLEANUP SKIPPED UNSAFE PATH:",
          {
            source,

            storedReference:
              String(candidate),
          }
        );
      }

      continue;
    }

    if (
      !normalizedCandidates.has(
        normalized.key
      )
    ) {
      normalizedCandidates.set(
        normalized.key,
        normalized
      );
    }
  }

  if (
    normalizedCandidates.size ===
    0
  ) {
    return {
      deleted: [],
      retained: [],
      missing: [],
      skipped: [],
    };
  }

  let referenceCounts;

  try {
    referenceCounts =
      await loadReferenceCounts();
  } catch (error) {
    /*
     * Fail closed:
     *
     * If reference counting fails, preserve every
     * candidate instead of risking deletion of a
     * still-referenced HR document/evidence file.
     */
    console.error(
      "FILE LIFECYCLE REFERENCE COUNT ERROR:",
      {
        source,

        message:
          error?.message ||
          error,
      }
    );

    return {
      deleted: [],

      retained:
        Array.from(
          normalizedCandidates.values(),
          (item) =>
            item.relativePath
        ),

      missing: [],
      skipped: [],
    };
  }

  const result = {
    deleted: [],
    retained: [],
    missing: [],
    skipped: [],
  };

  for (
    const normalized of
      normalizedCandidates.values()
  ) {
    const totalReferences =
      referenceCounts.get(
        normalized.key
      ) || 0;

    /*
     * Any surviving logical reference means the
     * physical file must remain untouched.
     */
    if (
      totalReferences > 0
    ) {
      result.retained.push(
        normalized.relativePath
      );

      continue;
    }

    try {
      const pathState =
        await inspectSafeStoredFile(
          normalized.absolutePath
        );

      /*
       * Already missing is an idempotent no-op.
       * We do not recreate, rewrite, or modify DB
       * references from this cleanup service.
       */
      if (!pathState.exists) {
        result.missing.push(
          normalized.relativePath
        );

        continue;
      }

      await fs.promises.unlink(
        normalized.absolutePath
      );

      result.deleted.push(
        normalized.relativePath
      );
    } catch (error) {
      if (
        error?.code ===
        "ENOENT"
      ) {
        result.missing.push(
          normalized.relativePath
        );

        continue;
      }

      /*
       * Post-commit cleanup failure must never
       * corrupt or reverse the already committed
       * database operation.
       *
       * Preserve the physical file and report the
       * failure internally for later reconciliation.
       */
      result.skipped.push(
        normalized.relativePath
      );

      console.error(
        "FILE LIFECYCLE CLEANUP ERROR:",
        {
          source,

          relativePath:
            normalized.relativePath,

          message:
            error?.message ||
            error,
        }
      );
    }
  }

  return result;
}

module.exports = {
  STORAGE_ROOT,
  normalizeStoredFileReference,
  cleanupUnreferencedFileCandidates,
};