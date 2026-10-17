import {
  API_BASE,
} from "../../config/api";

import authenticatedFetch from "../authenticatedFetch";


const INCIDENT_WORKFLOW_UPLOAD_AUTHORIZATION_URL =
  `${API_BASE}/incident-evidence/upload-authorizations/workflow`;

const INCIDENT_CREATE_UPLOAD_AUTHORIZATION_URL =
  `${API_BASE}/incident-evidence/upload-authorizations/create`;

export const MAX_INCIDENT_EVIDENCE_FILES =
  10;

const VALID_WORKFLOW_ACTIONS =
  new Set([
    "SUBMIT_RESOLUTION",
    "SUBMIT_INVESTIGATION",
  ]);


/*
 * ==================================================
 * BASIC NORMALIZATION
 * ==================================================
 */

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


function normalizeWorkflowAction(
  value
) {
  const normalized =
    String(
      value || ""
    )
      .trim()
      .toUpperCase();

  return (
    VALID_WORKFLOW_ACTIONS.has(
      normalized
    )
      ? normalized
      : null
  );
}


function isBrowserFile(
  value
) {
  return (
    typeof File !==
      "undefined" &&
    value instanceof
      File
  );
}


function getFileFromItem(
  item
) {
  if (
    isBrowserFile(
      item
    )
  ) {
    return item;
  }

  if (
    item &&
    typeof item ===
      "object" &&
    !Array.isArray(
      item
    ) &&
    isBrowserFile(
      item.file
    )
  ) {
    return item.file;
  }

  return null;
}


function isItemMarkedInvalid(
  item
) {
  return Boolean(
    item &&
    typeof item ===
      "object" &&
    !Array.isArray(
      item
    ) &&
    item.error
  );
}


function getValidBrowserFiles(
  source,
  {
    label =
      "Incident evidence",

    requireAtLeastOne =
      false,
  } = {}
) {
  const values =
    Array.isArray(
      source
    )
      ? source
      : [];

  const files =
    values
      .filter(
        (
          item
        ) =>
          !isItemMarkedInvalid(
            item
          )
      )
      .map(
        getFileFromItem
      )
      .filter(
        Boolean
      );

  if (
    requireAtLeastOne &&
    files.length ===
      0
  ) {
    throw new Error(
      `At least one valid ${label.toLowerCase()} file is required.`
    );
  }

  if (
    files.length >
    MAX_INCIDENT_EVIDENCE_FILES
  ) {
    throw new Error(
      `A maximum of ${MAX_INCIDENT_EVIDENCE_FILES} ${label.toLowerCase()} files may be uploaded at once.`
    );
  }

  return files;
}


/*
 * ==================================================
 * DIRECT-UPLOAD DESCRIPTOR HELPERS
 * ==================================================
 */

function normalizeDirectUploadItem(
  item
) {
  if (
    typeof item ===
      "string"
  ) {
    const descriptor =
      item.trim();

    return (
      descriptor
        ? {
            descriptor,
          }
        : null
    );
  }

  if (
    item &&
    typeof item ===
      "object" &&
    !Array.isArray(
      item
    )
  ) {
    const descriptor =
      String(
        item.descriptor ||
        item.directUpload
          ?.descriptor ||
        ""
      ).trim();

    return (
      descriptor
        ? {
            descriptor,
          }
        : null
    );
  }

  return null;
}


/*
 * Combine direct-upload descriptors from any source:
 *
 * - desktop/laptop-selected files
 * - phone-camera capture sessions
 *
 * The backend independently enforces the same limit
 * and validates every signed descriptor again.
 */
export function mergeIncidentDirectUploads(
  ...groups
) {
  const merged =
    groups
      .flatMap(
        (
          group
        ) =>
          Array.isArray(
            group
          )
            ? group
            : (
                group
                  ? [group]
                  : []
              )
      )
      .map(
        normalizeDirectUploadItem
      )
      .filter(
        Boolean
      );

  if (
    merged.length >
    MAX_INCIDENT_EVIDENCE_FILES
  ) {
    throw new Error(
      `A maximum of ${MAX_INCIDENT_EVIDENCE_FILES} Incident evidence files or photos may be submitted at once.`
    );
  }

  return merged;
}


/*
 * ==================================================
 * WELLJOB AUTHORIZATION REQUESTS
 * ==================================================
 */

async function requestCreateAuthorization(
  {
    employeeId,
    files,
  }
) {
  const response =
    await authenticatedFetch(
      INCIDENT_CREATE_UPLOAD_AUTHORIZATION_URL,
      {
        method:
          "POST",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            employeeId,

            files:
              files.map(
                (
                  file
                ) => ({
                  name:
                    file.name,

                  type:
                    file.type,

                  size:
                    file.size,
                })
              ),
          }),
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => null
      );

  if (
    !response.ok
  ) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Unable to authorize Incident evidence upload. Status ${response.status}`
    );
  }

  const uploads =
    Array.isArray(
      data?.uploads
    )
      ? data.uploads
      : [];

  if (
    uploads.length !==
    files.length
  ) {
    throw new Error(
      "The server returned an incomplete Incident evidence upload authorization."
    );
  }

  return uploads;
}


async function requestWorkflowAuthorization(
  {
    incidentId,
    workflowAction,
    files,
  }
) {
  const response =
    await authenticatedFetch(
      INCIDENT_WORKFLOW_UPLOAD_AUTHORIZATION_URL,
      {
        method:
          "POST",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            incidentId,

            workflowAction,

            files:
              files.map(
                (
                  file
                ) => ({
                  name:
                    file.name,

                  type:
                    file.type,

                  size:
                    file.size,
                })
              ),
          }),
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => null
      );

  if (
    !response.ok
  ) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Unable to authorize evidence upload. Status ${response.status}`
    );
  }

  const uploads =
    Array.isArray(
      data?.uploads
    )
      ? data.uploads
      : [];

  if (
    uploads.length !==
    files.length
  ) {
    throw new Error(
      "The server returned an incomplete evidence upload authorization."
    );
  }

  return uploads;
}


/*
 * ==================================================
 * DIRECT SUPABASE PUT
 * ==================================================
 *
 * IMPORTANT:
 *
 * Never use authenticatedFetch here.
 *
 * The WELLJOB Bearer JWT belongs only to the WELLJOB
 * API and must never be sent to Supabase.
 */
async function uploadEvidenceToSignedUrl(
  signedUrl,
  file
) {
  const response =
    await fetch(
      signedUrl,
      {
        method:
          "PUT",

        headers: {
          "Content-Type":
            file.type,

          "x-upsert":
            "false",
        },

        body:
          file,
      }
    );

  if (
    !response.ok
  ) {
    const responseText =
      await response
        .text()
        .catch(
          () => ""
        );

    throw new Error(
      responseText
        ? `Evidence upload failed (${response.status}): ${responseText}`
        : `Evidence upload failed with status ${response.status}.`
    );
  }
}


/*
 * ==================================================
 * AUTHORIZATION → STORAGE UPLOAD → DESCRIPTORS
 * ==================================================
 */

async function uploadAuthorizedFiles(
  {
    authorizations,
    files,
  }
) {
  const directUploads =
    [];

  for (
    let authorizationIndex =
      0;
    authorizationIndex <
      authorizations.length;
    authorizationIndex +=
      1
  ) {
    const authorization =
      authorizations[
        authorizationIndex
      ];

    const clientIndex =
      Number(
        authorization
          ?.clientIndex
      );

    if (
      !Number.isInteger(
        clientIndex
      ) ||
      clientIndex < 0 ||
      clientIndex >=
        files.length
    ) {
      throw new Error(
        "The evidence upload authorization contains an invalid file index."
      );
    }

    const signedUrl =
      String(
        authorization
          ?.signedUrl ||
        ""
      ).trim();

    const descriptor =
      String(
        authorization
          ?.descriptor ||
        ""
      ).trim();

    if (
      !signedUrl ||
      !descriptor
    ) {
      throw new Error(
        "The server returned an incomplete protected evidence upload authorization."
      );
    }

    const file =
      files[
        clientIndex
      ];

    await uploadEvidenceToSignedUrl(
      signedUrl,
      file
    );

    directUploads.push({
      descriptor,
    });
  }

  return directUploads;
}


/*
 * ==================================================
 * INCIDENT CREATE DIRECT UPLOADS
 * ==================================================
 *
 * Supports up to 10 desktop/laptop-selected files.
 *
 * Accepted input forms:
 *
 * files: [
 *   File,
 *   File,
 * ]
 *
 * OR:
 *
 * files: [
 *   { file: File, error: null },
 *   { file: File, error: null },
 * ]
 *
 * The legacy singular "file" argument is retained
 * temporarily so existing callers do not break while
 * AddIncidentModal is being migrated to multi-file
 * evidence state.
 */
export async function prepareIncidentCreateDirectUploads({
  employeeId,
  files = [],
  file = null,
}) {
  const normalizedEmployeeId =
    normalizePositiveInteger(
      employeeId
    );

  if (!normalizedEmployeeId) {
    throw new Error(
      "Invalid employee ID for Incident evidence upload."
    );
  }

  const sourceFiles = [
    ...(
      Array.isArray(
        files
      )
        ? files
        : []
    ),

    ...(
      isBrowserFile(
        file
      )
        ? [file]
        : []
    ),
  ];

  const validFiles =
    getValidBrowserFiles(
      sourceFiles,
      {
        label:
          "Incident evidence",

        /*
         * Zero local files is valid when all evidence
         * came from phone-camera sessions.
         */
        requireAtLeastOne:
          false,
      }
    );

  if (
    validFiles.length ===
    0
  ) {
    return [];
  }

  const authorizations =
    await requestCreateAuthorization({
      employeeId:
        normalizedEmployeeId,

      files:
        validFiles,
    });

  return uploadAuthorizedFiles({
    authorizations,
    files:
      validFiles,
  });
}


/*
 * Backward-compatible alias for the previous singular
 * helper name.
 *
 * Existing AddIncidentModal code can continue calling:
 *
 * prepareIncidentCreateDirectUpload({
 *   employeeId,
 *   file,
 * })
 *
 * until that component is revised to multi-file state.
 */
export async function prepareIncidentCreateDirectUpload(
  options
) {
  return prepareIncidentCreateDirectUploads(
    options
  );
}


/*
 * ==================================================
 * PUBLIC WORKFLOW DIRECT UPLOAD
 * ==================================================
 *
 * 1. WELLJOB authorizes metadata/context.
 * 2. Browser PUTs each binary directly to Supabase.
 * 3. Return only WELLJOB-signed descriptors.
 * 4. Caller combines these with any phone-capture
 *    descriptors.
 * 5. Caller includes the final combined descriptors
 *    in the workflow JSON request.
 *
 * Zero local files is valid when proof is supplied
 * entirely through phone-camera capture sessions.
 */
export async function prepareIncidentWorkflowDirectUploads({
  incidentId,
  workflowAction,
  proofFiles = [],
}) {
  const normalizedIncidentId =
    normalizePositiveInteger(
      incidentId
    );

  if (
    !normalizedIncidentId
  ) {
    throw new Error(
      "Invalid incident ID for evidence upload."
    );
  }

  const normalizedWorkflowAction =
    normalizeWorkflowAction(
      workflowAction
    );

  if (
    !normalizedWorkflowAction
  ) {
    throw new Error(
      "Invalid incident proof submission action."
    );
  }

  const validFiles =
    getValidBrowserFiles(
      proofFiles,
      {
        label:
          "Proof",

        /*
         * Phone-only proof is allowed. The Resolution
         * modal will enforce that the final combined
         * evidence list is not empty when proof is
         * required.
         */
        requireAtLeastOne:
          false,
      }
    );

  if (
    validFiles.length ===
    0
  ) {
    return [];
  }

  const authorizations =
    await requestWorkflowAuthorization({
      incidentId:
        normalizedIncidentId,

      workflowAction:
        normalizedWorkflowAction,

      files:
        validFiles,
    });

  return uploadAuthorizedFiles({
    authorizations,
    files:
      validFiles,
  });
}