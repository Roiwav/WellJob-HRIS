const db = require("../config/db");

const {
  normalizeObjectPath,
  removeObject,
} = require("../services/storageService");

/*
 * Only normal employee/evidence uploads participate
 * in destructive lifecycle cleanup.
 *
 * Shared seed-defense objects are intentionally
 * excluded.
 */
const STORAGE_MARKER =
  "documents/employees/";

const STORAGE_ROOT =
  "documents/employees";

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
 * Convert supported legacy/current references into
 * the exact private Supabase object identity.
 *
 * Supported examples:
 *
 * documents/employees/file.pdf
 * /documents/employees/file.pdf
 * backend/documents/employees/file.pdf
 * C:/.../backend/documents/employees/file.pdf
 * https://host/documents/employees/file.pdf
 */
function normalizeStoredFileReference(
  value
) {
  const cleaned =
    stripQueryAndFragment(
      normalizeSlashes(
        value
      )
    );

  if (!cleaned) {
    return null;
  }

  const markerIndex =
    cleaned
      .toLowerCase()
      .lastIndexOf(
        STORAGE_MARKER
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
        STORAGE_MARKER.length
      )
      .replace(
        /^\/+/,
        ""
      )
      .trim();

  if (!relativePath) {
    return null;
  }

  let objectPath;

  try {
    objectPath =
      normalizeObjectPath(
        `${STORAGE_MARKER}${relativePath}`
      );
  } catch {
    return null;
  }

  if (
    !objectPath.startsWith(
      STORAGE_MARKER
    )
  ) {
    return null;
  }

  const normalizedRelativePath =
    objectPath.slice(
      STORAGE_MARKER.length
    );

  if (
    !normalizedRelativePath
  ) {
    return null;
  }

  /*
   * Supabase object paths are case-sensitive.
   *
   * Use the exact canonical cloud object path as the
   * reference-count identity.
   */
  return {
    key:
      objectPath,

    relativePath:
      normalizedRelativePath,

    objectPath,
  };
}

/*
 * Build reference counts across every known logical
 * source that may point at documents/employees.
 */
async function loadReferenceCounts() {
  const [
    [
      employeeDocumentRows,
    ],
    [
      incidentEvidenceRows,
    ],
  ] =
    await Promise.all([
      db
        .promise()
        .query(
          `
          SELECT file_path
          FROM employee_documents
          WHERE file_path IS NOT NULL
            AND TRIM(file_path) <> ''
          `
        ),

      db
        .promise()
        .query(
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
     * Unknown/unsafe values do not become
     * destructive cleanup identities.
     */
    if (!normalized) {
      continue;
    }

    counts.set(
      normalized.key,
      (
        counts.get(
          normalized.key
        ) ||
        0
      ) +
      1
    );
  }

  return counts;
}

/*
 * ==================================================
 * REFERENCE-AWARE POST-COMMIT CLOUD CLEANUP
 * ==================================================
 *
 * Intended sequence:
 *
 * 1. Controller captures old paths.
 * 2. DB transaction commits.
 * 3. Service recounts every surviving DB reference.
 * 4. Cloud object is removed only when count = 0.
 *
 * If DB reference counting fails, cleanup fails
 * closed and preserves all candidate objects.
 */
async function cleanupUnreferencedFileCandidates(
  candidates,
  {
    source =
      "unknown",
  } = {}
) {
  const rawCandidates =
    Array.isArray(
      candidates
    )
      ? candidates
      : [];

  const normalizedCandidates =
    new Map();

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
          candidate ||
          ""
        ).trim()
      ) {
        console.error(
          "FILE LIFECYCLE CLEANUP SKIPPED UNSAFE PATH:",
          {
            source,

            storedReference:
              String(
                candidate
              ),
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
     * Fail closed.
     *
     * If reference counting cannot be proven, do not
     * delete anything from private storage.
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
          (
            item
          ) =>
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
      ) ||
      0;

    /*
     * Any surviving DB reference protects the
     * physical cloud object.
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
      const deletionResult =
        await removeObject(
          normalized.objectPath
        );

      /*
       * Supabase remove normally returns deleted
       * object metadata.
       *
       * An empty result is treated as an already
       * missing/idempotent object.
       */
      if (
        Array.isArray(
          deletionResult
        ) &&
        deletionResult.length ===
          0
      ) {
        result.missing.push(
          normalized.relativePath
        );
      } else {
        result.deleted.push(
          normalized.relativePath
        );
      }
    } catch (error) {
      /*
       * Post-commit cleanup failure cannot reverse
       * an already committed database operation.
       *
       * Preserve/report rather than affecting the
       * successful employee/incident mutation.
       */
      result.skipped.push(
        normalized.relativePath
      );

      console.error(
        "FILE LIFECYCLE CLOUD CLEANUP ERROR:",
        {
          source,

          objectPath:
            normalized.objectPath,

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
