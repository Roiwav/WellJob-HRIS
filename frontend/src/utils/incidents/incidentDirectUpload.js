import {
  API_BASE,
} from "../../config/api";

import authenticatedFetch from "../authenticatedFetch";


const INCIDENT_WORKFLOW_UPLOAD_AUTHORIZATION_URL =
  `${API_BASE}/incident-evidence/upload-authorizations/workflow`;

const MAX_INCIDENT_EVIDENCE_FILES =
  10;

const VALID_WORKFLOW_ACTIONS =
  new Set([
    "SUBMIT_RESOLUTION",
    "SUBMIT_INVESTIGATION",
  ]);


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


function getValidProofFiles(
  proofFiles
) {
  const source =
    Array.isArray(
      proofFiles
    )
      ? proofFiles
      : [];

  const validFiles =
    source.filter(
      (
        item
      ) =>
        isBrowserFile(
          item?.file
        ) &&
        !item?.error
    );

  if (
    validFiles.length ===
    0
  ) {
    throw new Error(
      "At least one valid proof file is required."
    );
  }

  if (
    validFiles.length >
    MAX_INCIDENT_EVIDENCE_FILES
  ) {
    throw new Error(
      `A maximum of ${MAX_INCIDENT_EVIDENCE_FILES} proof files may be uploaded at once.`
    );
  }

  return validFiles;
}


async function requestAuthorization(
  {
    incidentId,
    workflowAction,
    proofFiles,
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
              proofFiles.map(
                (
                  item
                ) => ({
                  name:
                    item.file.name,

                  type:
                    item.file.type,

                  size:
                    item.file.size,
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
    proofFiles.length
  ) {
    throw new Error(
      "The server returned an incomplete evidence upload authorization."
    );
  }

  return uploads;
}


/*
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
 * PUBLIC WORKFLOW DIRECT UPLOAD
 * ==================================================
 *
 * 1. WELLJOB authorizes metadata/context.
 * 2. Browser PUTs each binary directly to Supabase.
 * 3. Return only WELLJOB-signed descriptors.
 * 4. Caller includes descriptors in the final JSON
 *    workflow request.
 */
export async function prepareIncidentWorkflowDirectUploads({
  incidentId,
  workflowAction,
  proofFiles,
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
    getValidProofFiles(
      proofFiles
    );

  const authorizations =
    await requestAuthorization({
      incidentId:
        normalizedIncidentId,

      workflowAction:
        normalizedWorkflowAction,

      proofFiles:
        validFiles,
    });

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
        validFiles.length
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

    const proofItem =
      validFiles[
        clientIndex
      ];

    await uploadEvidenceToSignedUrl(
      signedUrl,
      proofItem.file
    );

    directUploads.push({
      descriptor,
    });
  }

  return directUploads;
}
