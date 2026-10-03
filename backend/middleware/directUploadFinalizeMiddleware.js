const {
  removeObject,
} = require("../services/storageService");

const {
  DIRECT_UPLOAD_TYPES,
  DIRECT_UPLOAD_PURPOSES,

  DirectUploadError,

  normalizeWorkflowAction,

  verifyDirectUploadDescriptor,
  verifyStoredDirectUpload,
  createPseudoFile,
} = require("../services/directUploadSecurityService");


const MAX_EMPLOYEE_DOCUMENTS =
  20;

const MAX_INCIDENT_EVIDENCE_FILES =
  10;

const MAX_ATTENDANCE_EVIDENCE_FILES =
  1;


/*
 * ==================================================
 * HELPERS
 * ==================================================
 */

function normalizePositiveInteger(
  value
) {
  const raw =
    String(
      value ?? ""
    ).trim();

  if (
    !/^\d+$/.test(
      raw
    )
  ) {
    return null;
  }

  const numericValue =
    Number(
      raw
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


function getDirectUploads(
  req
) {
  const value =
    req.body?.directUploads;

  /*
   * Property absent:
   *
   * This is the existing multipart flow.
   * Leave req.files untouched.
   */
  if (
    value ===
    undefined ||
    value ===
    null
  ) {
    return null;
  }

  if (
    !Array.isArray(
      value
    )
  ) {
    throw new DirectUploadError(
      "directUploads must be an array.",
      {
        code:
          "INVALID_DIRECT_UPLOAD_ARRAY",
      }
    );
  }

  return value;
}


function getDescriptorFromItem(
  item
) {
  if (
    typeof item ===
    "string"
  ) {
    return item.trim();
  }

  if (
    item &&
    typeof item ===
      "object" &&
    !Array.isArray(
      item
    )
  ) {
    return String(
      item.descriptor ||
      ""
    ).trim();
  }

  return "";
}


async function cleanupObjectPaths(
  objectPaths
) {
  const uniquePaths =
    Array.from(
      new Set(
        objectPaths
          .map(
            (
              item
            ) =>
              String(
                item ||
                ""
              ).trim()
          )
          .filter(
            Boolean
          )
      )
    );

  for (
    const objectPath of
    uniquePaths
  ) {
    try {
      await removeObject(
        objectPath
      );
    } catch (error) {
      console.error(
        "DIRECT UPLOAD FINALIZE CLEANUP ERROR:",
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


async function cleanupExistingFiles(
  files
) {
  const existingFiles =
    Array.isArray(
      files
    )
      ? files
      : [];

  await cleanupObjectPaths(
    existingFiles.map(
      (
        file
      ) =>
        file?.storagePath ||
        file?.path
    )
  );
}


function sendFinalizeError(
  res,
  error
) {
  if (
    error instanceof
    DirectUploadError
  ) {
    return res
      .status(
        Number(
          error.statusCode
        ) ||
        400
      )
      .json({
        error:
          error.message,

        code:
          error.code ||
          "DIRECT_UPLOAD_ERROR",
      });
  }

  console.error(
    "DIRECT UPLOAD FINALIZE ERROR:",
    error
  );

  return res
    .status(500)
    .json({
      error:
        "Unable to verify the uploaded file.",
    });
}


/*
 * ==================================================
 * INCIDENT REQUEST CLEANUP BOUNDARY
 * ==================================================
 *
 * This mirrors the proven incident upload behavior.
 *
 * If the incident transaction commits:
 *
 * req.claimIncidentEvidenceFiles()
 *
 * prevents cleanup.
 *
 * If validation/controller execution fails:
 *
 * finish/close removes the newly uploaded objects.
 */
function registerDirectIncidentCleanupBoundary(
  req,
  res,
  files
) {
  let ownershipClaimed =
    false;

  let cleanupStarted =
    false;

  req.claimIncidentEvidenceFiles =
    () => {
      ownershipClaimed =
        true;
    };

  const cleanupIfUnclaimed =
    () => {
      if (
        ownershipClaimed ||
        cleanupStarted
      ) {
        return;
      }

      cleanupStarted =
        true;

      cleanupExistingFiles(
        files
      ).catch(
        (
          error
        ) => {
          console.error(
            "DIRECT INCIDENT CLEANUP ERROR:",
            error
          );
        }
      );
    };

  res.once(
    "finish",
    cleanupIfUnclaimed
  );

  res.once(
    "close",
    cleanupIfUnclaimed
  );
}


/*
 * ==================================================
 * ATTENDANCE REQUEST CLEANUP BOUNDARY
 * ==================================================
 */

function registerDirectAttendanceCleanupBoundary(
  req,
  res,
  files
) {
  let ownershipClaimed =
    false;

  let cleanupStarted =
    false;

  req.claimAttendanceEvidenceFile =
    () => {
      ownershipClaimed =
        true;
    };

  const cleanupIfUnclaimed =
    () => {
      if (
        ownershipClaimed ||
        cleanupStarted
      ) {
        return;
      }

      cleanupStarted =
        true;

      cleanupExistingFiles(
        files
      ).catch(
        (
          error
        ) => {
          console.error(
            "DIRECT ATTENDANCE CLEANUP ERROR:",
            error
          );
        }
      );
    };

  res.once(
    "finish",
    cleanupIfUnclaimed
  );

  res.once(
    "close",
    cleanupIfUnclaimed
  );
}


/*
 * ==================================================
 * GENERIC FINALIZER
 * ==================================================
 */

async function finalizeDirectUploads(
  req,
  res,
  next,
  {
    maxFiles,

    expectedUploadType,

    expectedPurpose,

    expectedContext,

    resolveFieldname,

    incidentCleanup =
      false,

    attendanceCleanup =
      false,

    allowDuplicateFieldNames =
      false,
  }
) {
  let directUploads;

  try {
    directUploads =
      getDirectUploads(
        req
      );
  } catch (error) {
    /*
     * If Multer already persisted files before an invalid
     * directUploads value was detected, compensate them now.
     */
    await cleanupExistingFiles(
      req.files
    );

    req.files =
      [];

    return sendFinalizeError(
      res,
      error
    );
  }

  /*
   * Legacy multipart request.
   */
  if (
    directUploads ===
    null
  ) {
    return next();
  }

  /*
   * Never mix the old multipart binary flow with the
   * new descriptor flow in one request.
   */
  if (
    Array.isArray(
      req.files
    ) &&
    req.files.length >
      0
  ) {
    await cleanupExistingFiles(
      req.files
    );

    req.files =
      [];

    return res
      .status(400)
      .json({
        error:
          "Multipart files and direct-upload descriptors cannot be submitted together.",

        code:
          "MIXED_UPLOAD_MODES",
      });
  }

  /*
   * Empty directUploads is valid when the operation
   * does not include a new file.
   */
  if (
    directUploads.length ===
    0
  ) {
    return next();
  }

  if (
    directUploads.length >
    maxFiles
  ) {
    return res
      .status(400)
      .json({
        error:
          `A maximum of ${maxFiles} direct uploads may be finalized at once.`,

        code:
          "TOO_MANY_DIRECT_UPLOADS",
      });
  }

  const pseudoFiles =
    [];

  const authorizedObjectPaths =
    [];

  const usedObjectPaths =
    new Set();

  const usedFieldNames =
    new Set();

  try {
    for (
      let index = 0;
      index <
      directUploads.length;
      index += 1
    ) {
      const item =
        directUploads[
          index
        ];

      const descriptor =
        getDescriptorFromItem(
          item
        );

      if (!descriptor) {
        throw new DirectUploadError(
          `Direct upload descriptor ${index + 1} is missing.`,
          {
            code:
              "DIRECT_UPLOAD_DESCRIPTOR_REQUIRED",
          }
        );
      }

      /*
       * Signature/context verification happens
       * before WELLJOB trusts any object path.
       */
      const verifiedDescriptor =
        verifyDirectUploadDescriptor(
          descriptor,
          {
            actor:
              req.user,

            expectedUploadType,

            expectedPurpose,

            expectedContext,
          }
        );

      authorizedObjectPaths.push(
        verifiedDescriptor
          .objectPath
      );

      if (
        usedObjectPaths.has(
          verifiedDescriptor
            .objectPath
        )
      ) {
        throw new DirectUploadError(
          "The same uploaded object cannot be finalized more than once in one request.",
          {
            code:
              "DUPLICATE_DIRECT_UPLOAD_OBJECT",
          }
        );
      }

      usedObjectPaths.add(
        verifiedDescriptor
          .objectPath
      );

      /*
       * Actual private Storage bytes are verified:
       *
       * - object exists
       * - exact authorized size
       * - <= 5 MB
       * - magic bytes match MIME
       */
      const verifiedUpload =
        await verifyStoredDirectUpload(
          verifiedDescriptor
        );

      const fieldname =
        resolveFieldname(
          item,
          index
        );

      if (
        !allowDuplicateFieldNames &&
        usedFieldNames.has(
          fieldname
        )
      ) {
        throw new DirectUploadError(
          "Multiple direct uploads target the same document field.",
          {
            code:
              "DUPLICATE_DIRECT_UPLOAD_FIELD",
          }
        );
      }

      usedFieldNames.add(
        fieldname
      );

      pseudoFiles.push(
        createPseudoFile(
          verifiedUpload,
          {
            fieldname,
          }
        )
      );
    }

    /*
     * Existing employee/incident controllers now see
     * exactly the Multer-like file shape they already
     * understand.
     */
    req.files =
      pseudoFiles;

    if (
      incidentCleanup
    ) {
      registerDirectIncidentCleanupBoundary(
        req,
        res,
        pseudoFiles
      );
    }

    if (
      attendanceCleanup
    ) {
      registerDirectAttendanceCleanupBoundary(
        req,
        res,
        pseudoFiles
      );
    }

    return next();
  } catch (error) {
    /*
     * Only signed/verified object paths are eligible
     * for cleanup.
     *
     * Never trust a path from an invalid/tampered
     * descriptor.
     */
    await cleanupObjectPaths(
      authorizedObjectPaths
    );

    req.files =
      [];

    return sendFinalizeError(
      res,
      error
    );
  }
}


/*
 * ==================================================
 * EMPLOYEE CREATE
 * ==================================================
 */

function finalizeEmployeeCreateDirectUploads(
  req,
  res,
  next
) {
  return finalizeDirectUploads(
    req,
    res,
    next,
    {
      maxFiles:
        MAX_EMPLOYEE_DOCUMENTS,

      expectedUploadType:
        DIRECT_UPLOAD_TYPES
          .EMPLOYEE_DOCUMENT,

      expectedPurpose:
        DIRECT_UPLOAD_PURPOSES
          .EMPLOYEE_CREATE,

      expectedContext:
        {},

      resolveFieldname(
        item
      ) {
        const documentIndex =
          Number(
            item?.documentIndex ??
            item?.document_index
          );

        if (
          !Number.isInteger(
            documentIndex
          ) ||
          documentIndex < 0 ||
          documentIndex >=
            MAX_EMPLOYEE_DOCUMENTS
        ) {
          throw new DirectUploadError(
            "Each employee direct upload requires a valid documentIndex from 0 to 19.",
            {
              code:
                "INVALID_DOCUMENT_INDEX",
            }
          );
        }

        return `documents[${documentIndex}]`;
      },
    }
  );
}


/*
 * ==================================================
 * EMPLOYEE UPDATE
 * ==================================================
 */

function finalizeEmployeeUpdateDirectUploads(
  req,
  res,
  next
) {
  const employeeId =
    normalizePositiveInteger(
      req.params?.id
    );

  if (!employeeId) {
    return res
      .status(400)
      .json({
        error:
          "Invalid employee ID.",

        code:
          "INVALID_EMPLOYEE_ID",
      });
  }

  return finalizeDirectUploads(
    req,
    res,
    next,
    {
      maxFiles:
        MAX_EMPLOYEE_DOCUMENTS,

      expectedUploadType:
        DIRECT_UPLOAD_TYPES
          .EMPLOYEE_DOCUMENT,

      expectedPurpose:
        DIRECT_UPLOAD_PURPOSES
          .EMPLOYEE_UPDATE,

      expectedContext: {
        employeeId,
      },

      resolveFieldname(
        item
      ) {
        const documentIndex =
          Number(
            item?.documentIndex ??
            item?.document_index
          );

        if (
          !Number.isInteger(
            documentIndex
          ) ||
          documentIndex < 0 ||
          documentIndex >=
            MAX_EMPLOYEE_DOCUMENTS
        ) {
          throw new DirectUploadError(
            "Each employee direct upload requires a valid documentIndex from 0 to 19.",
            {
              code:
                "INVALID_DOCUMENT_INDEX",
            }
          );
        }

        return `documents[${documentIndex}]`;
      },
    }
  );
}


/*
 * ==================================================
 * INCIDENT CREATE
 * ==================================================
 */

function finalizeIncidentCreateDirectUploads(
  req,
  res,
  next
) {
  const employeeId =
    normalizePositiveInteger(
      req.body?.employeeId ??
      req.body?.employee_id
    );

  if (!employeeId) {
    return res
      .status(400)
      .json({
        error:
          "A valid employee ID is required.",

        code:
          "INVALID_EMPLOYEE_ID",
      });
  }

  return finalizeDirectUploads(
    req,
    res,
    next,
    {
      maxFiles:
        MAX_INCIDENT_EVIDENCE_FILES,

      expectedUploadType:
        DIRECT_UPLOAD_TYPES
          .INCIDENT_EVIDENCE,

      expectedPurpose:
        DIRECT_UPLOAD_PURPOSES
          .INCIDENT_CREATE,

      expectedContext: {
        employeeId,
      },

      resolveFieldname() {
        return "evidenceFiles";
      },

      incidentCleanup:
        true,

      allowDuplicateFieldNames:
        true,
    }
  );
}


/*
 * ==================================================
 * INCIDENT WORKFLOW
 * ==================================================
 */

function finalizeIncidentWorkflowDirectUploads(
  req,
  res,
  next
) {
  const incidentId =
    normalizePositiveInteger(
      req.params?.id
    );

  if (!incidentId) {
    return res
      .status(400)
      .json({
        error:
          "Invalid incident ID.",

        code:
          "INVALID_INCIDENT_ID",
      });
  }

  const workflowAction =
    normalizeWorkflowAction(
      req.body?.workflowAction
    );

  if (!workflowAction) {
    /*
     * Existing workflow controller/policy handles
     * non-proof actions when no directUploads exist.
     *
     * If directUploads are present, they may only be
     * used for proof submission.
     */
    const directUploads =
      req.body?.directUploads;

    if (
      directUploads !==
        undefined &&
      directUploads !==
        null &&
      !Array.isArray(
        directUploads
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "directUploads must be an array.",

          code:
            "INVALID_DIRECT_UPLOAD_ARRAY",
        });
    }

    if (
      Array.isArray(
        directUploads
      ) &&
      directUploads.length >
        0
    ) {
      return res
        .status(400)
        .json({
          error:
            "Direct evidence uploads may only be used when submitting investigation proof for review.",

          code:
            "INVALID_EVIDENCE_WORKFLOW_ACTION",
        });
    }

    return next();
  }

  return finalizeDirectUploads(
    req,
    res,
    next,
    {
      maxFiles:
        MAX_INCIDENT_EVIDENCE_FILES,

      expectedUploadType:
        DIRECT_UPLOAD_TYPES
          .INCIDENT_EVIDENCE,

      expectedPurpose:
        DIRECT_UPLOAD_PURPOSES
          .INCIDENT_WORKFLOW,

      expectedContext: {
        incidentId,
        workflowAction,
      },

      resolveFieldname() {
        return "evidenceFiles";
      },

      incidentCleanup:
        true,

      allowDuplicateFieldNames:
        true,
    }
  );
}


function normalizeAttendanceDate(
  value
) {
  const raw =
    String(
      value || ""
    ).trim();

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/
      .exec(
        raw
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

  const probe =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    probe.getUTCFullYear() !==
      year ||
    probe.getUTCMonth() !==
      month - 1 ||
    probe.getUTCDate() !==
      day
  ) {
    return null;
  }

  return raw;
}


/*
 * ==================================================
 * ATTENDANCE CLIENT EVIDENCE
 * ==================================================
 */

function finalizeAttendanceEvidenceDirectUpload(
  req,
  res,
  next
) {
  const attendanceDate =
    normalizeAttendanceDate(
      req.body?.attendanceDate ??
      req.body?.attendance_date ??
      req.body?.date
    );

  if (!attendanceDate) {
    return res
      .status(400)
      .json({
        error:
          "A valid attendance date in YYYY-MM-DD format is required.",

        code:
          "INVALID_ATTENDANCE_DATE",
      });
  }

  const company =
    String(
      req.user
        ?.assignedCompany ??
      req.user
        ?.assigned_company ??
      ""
    ).trim();

  if (!company) {
    return res
      .status(403)
      .json({
        error:
          "Your HR Coordinator account does not have an assigned company.",

        code:
          "ATTENDANCE_COMPANY_REQUIRED",
      });
  }

  return finalizeDirectUploads(
    req,
    res,
    next,
    {
      maxFiles:
        MAX_ATTENDANCE_EVIDENCE_FILES,

      expectedUploadType:
        DIRECT_UPLOAD_TYPES
          .ATTENDANCE_EVIDENCE,

      expectedPurpose:
        DIRECT_UPLOAD_PURPOSES
          .ATTENDANCE_SAVE,

      expectedContext: {
        attendanceDate,
        company,
      },

      resolveFieldname() {
        return "attendanceEvidence";
      },

      attendanceCleanup:
        true,
    }
  );
}


module.exports = {
  finalizeEmployeeCreateDirectUploads,
  finalizeEmployeeUpdateDirectUploads,

  finalizeIncidentCreateDirectUploads,
  finalizeIncidentWorkflowDirectUploads,

  finalizeAttendanceEvidenceDirectUpload,
};
