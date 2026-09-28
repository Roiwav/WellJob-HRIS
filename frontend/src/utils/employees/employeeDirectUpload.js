import {
  toProperName,
} from "../../components/employees/employeeConstants";

import {
  API_BASE,
} from "../../config/api";

import authenticatedFetch from "../authenticatedFetch";

import {
  EMPLOYEE_API_URL,
  getSelectedDocuments,
} from "./employeeFormHelpers";


const EMPLOYEE_UPLOAD_AUTHORIZATION_URL =
  `${API_BASE}/employee-documents/upload-authorizations`;


/*
 * ==================================================
 * FILE HELPERS
 * ==================================================
 */

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


function normalizeEmployeeId(
  value
) {
  return String(
    value ?? ""
  ).trim();
}


/*
 * ==================================================
 * BACKEND ERROR COMPATIBILITY
 * ==================================================
 *
 * employeeFormHelpers.getEmployeeApiError() already
 * understands Axios-style error.response objects.
 *
 * Native fetch is used here, so reproduce the small
 * response shape required by that existing helper.
 */
function createBackendError(
  response,
  data,
  fallbackMessage
) {
  const message =
    data?.error ||
    data?.message ||
    fallbackMessage ||
    `Request failed with status ${response?.status || "unknown"}.`;

  const error =
    new Error(
      message
    );

  error.response = {
    status:
      response?.status,

    data:
      data || {},
  };

  return error;
}


/*
 * ==================================================
 * AUTHENTICATED WELLJOB JSON REQUEST
 * ==================================================
 */

async function requestWelljobJson(
  url,
  {
    method =
      "GET",

    body,
    signal,
  } = {}
) {
  const response =
    await authenticatedFetch(
      url,
      {
        method,

        headers: {
          Accept:
            "application/json",

          ...(body !==
          undefined
            ? {
                "Content-Type":
                  "application/json",
              }
            : {}),
        },

        ...(body !==
        undefined
          ? {
              body:
                JSON.stringify(
                  body
                ),
            }
          : {}),

        ...(signal
          ? {
              signal,
            }
          : {}),
      }
    );

  const data =
    await response
      .json()
      .catch(
        () => null
      );

  if (!response.ok) {
    throw createBackendError(
      response,
      data,
      "Unable to process the employee request."
    );
  }

  return data;
}


/*
 * ==================================================
 * SUPABASE DIRECT BINARY UPLOAD
 * ==================================================
 *
 * IMPORTANT:
 *
 * Do NOT use authenticatedFetch here.
 *
 * authenticatedFetch adds the WELLJOB Bearer JWT.
 * That JWT belongs only to the WELLJOB backend and
 * must never be forwarded to Supabase.
 */
async function uploadFileToSignedUrl(
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

  if (!response.ok) {
    const responseText =
      await response
        .text()
        .catch(
          () => ""
        );

    throw new Error(
      responseText
        ? `Protected file upload failed (${response.status}): ${responseText}`
        : `Protected file upload failed with status ${response.status}.`
    );
  }
}


/*
 * ==================================================
 * PREPARE EMPLOYEE DOCUMENTS
 * ==================================================
 *
 * The backend employee controller loops over
 * documents[0] ... documents[19].
 *
 * We preserve the same compact indexing used by the
 * previous FormData implementation.
 */
function prepareEmployeeDocuments(
  formData
) {
  const selectedDocuments =
    getSelectedDocuments(
      formData?.documents
    );

  const documents =
    selectedDocuments.map(
      (
        document
      ) => ({
        name:
          String(
            document?.name ||
            ""
          ).trim(),

        expirationDate:
          document?.expirationDate ||
          "",
      })
    );

  const localUploads = [];

  selectedDocuments.forEach(
    (
      document,
      documentIndex
    ) => {
      if (
        !isBrowserFile(
          document?.file
        )
      ) {
        return;
      }

      localUploads.push({
        documentIndex,

        file:
          document.file,
      });
    }
  );

  return {
    documents,
    localUploads,
  };
}


/*
 * ==================================================
 * REQUEST SIGNED AUTHORIZATION
 * ==================================================
 */

async function authorizeEmployeeUploads({
  purpose,
  employeeId,
  localUploads,
}) {
  if (
    localUploads.length ===
    0
  ) {
    return [];
  }

  const requestBody = {
    purpose,

    files:
      localUploads.map(
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
  };

  if (
    purpose ===
    "update"
  ) {
    requestBody.employeeId =
      Number(
        employeeId
      );
  }

  const authorization =
    await requestWelljobJson(
      EMPLOYEE_UPLOAD_AUTHORIZATION_URL,
      {
        method:
          "POST",

        body:
          requestBody,
      }
    );

  const uploads =
    Array.isArray(
      authorization?.uploads
    )
      ? authorization.uploads
      : [];

  if (
    uploads.length !==
    localUploads.length
  ) {
    throw new Error(
      "The server returned an incomplete employee upload authorization."
    );
  }

  return uploads;
}


/*
 * ==================================================
 * UPLOAD AUTHORIZED FILES TO SUPABASE
 * ==================================================
 */

async function uploadEmployeeFiles({
  localUploads,
  authorizations,
}) {
  const directUploads = [];

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
        localUploads.length
    ) {
      throw new Error(
        "The employee upload authorization contains an invalid file index."
      );
    }

    const localUpload =
      localUploads[
        clientIndex
      ];

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
        "The server returned an incomplete protected upload authorization."
      );
    }

    await uploadFileToSignedUrl(
      signedUrl,
      localUpload.file
    );

    directUploads.push({
      descriptor,

      documentIndex:
        localUpload
          .documentIndex,
    });
  }

  return directUploads;
}


/*
 * ==================================================
 * EMPLOYEE JSON PAYLOAD
 * ==================================================
 */

function buildEmployeeJsonPayload(
  formData,
  documents,
  directUploads
) {
  const isDeployed =
    formData?.status ===
    "Deployed";

  return {
    name:
      toProperName(
        formData?.name
      ),

    company:
      isDeployed
        ? String(
            formData?.company ||
            ""
          ).trim()
        : "",

    position:
      isDeployed
        ? String(
            formData?.position ||
            ""
          ).trim()
        : "",

    status:
      formData?.status ||
      "Floating / Standby",

    contractStart:
      isDeployed
        ? formData?.contractStart ||
          ""
        : "",

    documents,

    directUploads,
  };
}


/*
 * ==================================================
 * PUBLIC EMPLOYEE SAVE
 * ==================================================
 *
 * CREATE:
 *
 * authorization
 * -> browser PUT Supabase
 * -> JSON POST /employees
 *
 * UPDATE:
 *
 * authorization bound to employee ID
 * -> browser PUT Supabase
 * -> JSON PUT /employees/:id
 */
export async function saveEmployeeWithDirectUploads({
  formData,
  employeeId = "",
}) {
  const normalizedEmployeeId =
    normalizeEmployeeId(
      employeeId
    );

  const isUpdate =
    Boolean(
      normalizedEmployeeId
    );

  if (
    isUpdate &&
    !/^\d+$/.test(
      normalizedEmployeeId
    )
  ) {
    throw new Error(
      "Invalid employee ID."
    );
  }

  const purpose =
    isUpdate
      ? "update"
      : "create";

  const {
    documents,
    localUploads,
  } =
    prepareEmployeeDocuments(
      formData
    );

  /*
   * Phase 1:
   * ask WELLJOB backend for secure upload
   * authorization.
   */
  const authorizations =
    await authorizeEmployeeUploads({
      purpose,

      employeeId:
        normalizedEmployeeId,

      localUploads,
    });

  /*
   * Phase 2:
   * browser sends actual binaries directly to
   * Supabase private Storage.
   */
  const directUploads =
    await uploadEmployeeFiles({
      localUploads,
      authorizations,
    });

  /*
   * Phase 3:
   * backend receives only small JSON metadata +
   * cryptographically signed descriptors.
   */
  const payload =
    buildEmployeeJsonPayload(
      formData,
      documents,
      directUploads
    );

  const url =
    isUpdate
      ? `${EMPLOYEE_API_URL}/${encodeURIComponent(
          normalizedEmployeeId
        )}`
      : EMPLOYEE_API_URL;

  return requestWelljobJson(
    url,
    {
      method:
        isUpdate
          ? "PUT"
          : "POST",

      body:
        payload,
    }
  );
}
