import {
  API_BASE,
} from "../../config/api";

import authenticatedFetch from "../authenticatedFetch";


/*
 * ==================================================
 * WELLJOB INCIDENT PHONE CAMERA CLIENT
 * ==================================================
 *
 * Shared by:
 *
 * - Add Incident desktop modal
 * - Resolution / Investigation Proof desktop modal
 * - capture-only mobile phone page
 *
 * Desktop responsibilities:
 *
 * - create short-lived capture session
 * - build QR/mobile URL
 * - poll for completed phone photo
 * - refresh a fresh WELLJOB direct-upload descriptor
 *   immediately before final save
 * - cancel unused staged captures
 * - mark captures consumed after successful save
 *
 * Phone responsibilities:
 *
 * - validate the short-lived capture link
 * - request one signed private upload URL
 * - PUT one JPEG/PNG directly to Supabase
 * - tell WELLJOB to verify the uploaded object
 *
 * IMPORTANT:
 *
 * The phone-side functions deliberately use ordinary
 * fetch(), not authenticatedFetch().
 *
 * The phone does not receive or send the WELLJOB
 * Bearer JWT.
 */

const PHONE_CAPTURE_SESSIONS_URL =
  `${API_BASE}/incident-evidence/phone-capture-sessions`;

const PHONE_CAPTURE_PUBLIC_URL =
  `${API_BASE}/incident-evidence/phone-capture`;

export const INCIDENT_PHONE_CAPTURE_ROUTE =
  "/incident-photo-capture";

export const INCIDENT_PHONE_CAPTURE_PURPOSES =
  Object.freeze({
    CREATE:
      "incident_create",

    WORKFLOW:
      "incident_workflow",
  });

export const INCIDENT_PHONE_CAPTURE_STATUSES =
  Object.freeze({
    WAITING:
      "WAITING",

    READY_FOR_UPLOAD:
      "READY_FOR_UPLOAD",

    PHOTO_ADDED:
      "PHOTO_ADDED",

    DONE:
      "DONE",

    CANCELLED:
      "CANCELLED",

    EXPIRED:
      "EXPIRED",
  });


/*
 * ==================================================
 * BASIC HELPERS
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


function normalizeSessionId(
  value
) {
  const normalized =
    String(
      value || ""
    ).trim();

  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(
        normalized
      )
      ? normalized
      : null
  );
}


function normalizeCaptureToken(
  value
) {
  const normalized =
    String(
      value || ""
    ).trim();

  return (
    /^[A-Za-z0-9_-]{40,128}$/
      .test(
        normalized
      )
      ? normalized
      : null
  );
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
    normalized ===
      "SUBMIT_RESOLUTION" ||
    normalized ===
      "SUBMIT_INVESTIGATION"
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


function getResponseMessage(
  data,
  fallbackMessage
) {
  return (
    String(
      data?.error ||
      data?.message ||
      ""
    ).trim() ||
    fallbackMessage
  );
}


async function readJsonResponse(
  response
) {
  return response
    .json()
    .catch(
      () => null
    );
}


function encodePathSegment(
  value
) {
  return encodeURIComponent(
    String(
      value || ""
    )
  );
}


/*
 * ==================================================
 * QR / MOBILE URL
 * ==================================================
 *
 * The raw capture token is placed in the FRONTEND URL
 * fragment rather than in its query string:
 *
 *   /incident-photo-capture#capture=<token>
 *
 * URL fragments are not sent to the frontend hosting
 * server as part of the HTTP request and are not part
 * of Referer request paths.
 *
 * The mobile React page reads the fragment locally,
 * then sends the token only inside JSON request bodies
 * to the dedicated public capture API.
 *
 * The raw token is never placed in the backend API
 * path or query string.
 */

export function buildIncidentPhoneCaptureUrl(
  captureToken,
  {
    origin,
  } = {}
) {
  const normalizedToken =
    normalizeCaptureToken(
      captureToken
    );

  if (!normalizedToken) {
    throw new Error(
      "Invalid phone capture token."
    );
  }

  const resolvedOrigin =
    String(
      origin ||
      (
        typeof window !==
          "undefined"
          ? window.location
              .origin
          : ""
      )
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );

  if (!resolvedOrigin) {
    throw new Error(
      "Unable to determine the WELLJOB frontend address for phone capture."
    );
  }

  return (
    `${resolvedOrigin}` +
    `${INCIDENT_PHONE_CAPTURE_ROUTE}` +
    `#capture=${encodeURIComponent(
      normalizedToken
    )}`
  );
}


export function getIncidentPhoneCaptureTokenFromHash(
  hashValue
) {
  const rawHash =
    String(
      hashValue ??
      (
        typeof window !==
          "undefined"
          ? window.location.hash
          : ""
      )
    )
      .replace(
        /^#/,
        ""
      )
      .trim();

  if (!rawHash) {
    return null;
  }

  const params =
    new URLSearchParams(
      rawHash
    );

  return normalizeCaptureToken(
    params.get(
      "capture"
    )
  );
}


/*
 * ==================================================
 * AUTHENTICATED DESKTOP API
 * ==================================================
 */

export async function createIncidentPhoneCaptureSession({
  capturePurpose,
  employeeId,
  incidentId,
  workflowAction,
  signal,
}) {
  const normalizedPurpose =
    String(
      capturePurpose || ""
    )
      .trim()
      .toLowerCase();

  const body = {
    capturePurpose:
      normalizedPurpose,
  };

  if (
    normalizedPurpose ===
      INCIDENT_PHONE_CAPTURE_PURPOSES
        .CREATE
  ) {
    const normalizedEmployeeId =
      normalizePositiveInteger(
        employeeId
      );

    if (!normalizedEmployeeId) {
      throw new Error(
        "Select a valid employee before adding a photo from your phone."
      );
    }

    body.employeeId =
      normalizedEmployeeId;
  } else if (
    normalizedPurpose ===
      INCIDENT_PHONE_CAPTURE_PURPOSES
        .WORKFLOW
  ) {
    const normalizedIncidentId =
      normalizePositiveInteger(
        incidentId
      );

    const normalizedWorkflowAction =
      normalizeWorkflowAction(
        workflowAction
      );

    if (!normalizedIncidentId) {
      throw new Error(
        "Invalid Incident ID for phone proof capture."
      );
    }

    if (!normalizedWorkflowAction) {
      throw new Error(
        "Invalid Incident proof submission action."
      );
    }

    body.incidentId =
      normalizedIncidentId;

    body.workflowAction =
      normalizedWorkflowAction;
  } else {
    throw new Error(
      "Invalid Incident phone capture purpose."
    );
  }

  const response =
    await authenticatedFetch(
      PHONE_CAPTURE_SESSIONS_URL,
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
          JSON.stringify(
            body
          ),

        signal,
      }
    );

  const data =
    await readJsonResponse(
      response
    );

  if (!response.ok) {
    throw new Error(
      getResponseMessage(
        data,
        `Unable to start phone capture. Status ${response.status}`
      )
    );
  }

  const sessionId =
    normalizeSessionId(
      data?.sessionId
    );

  const captureToken =
    normalizeCaptureToken(
      data?.captureToken
    );

  if (
    !sessionId ||
    !captureToken
  ) {
    throw new Error(
      "The server returned an incomplete phone capture session."
    );
  }

  return {
    ...data,

    sessionId,
    captureToken,

    captureUrl:
      buildIncidentPhoneCaptureUrl(
        captureToken
      ),
  };
}


export async function getIncidentPhoneCaptureSession(
  sessionId,
  {
    signal,
  } = {}
) {
  const normalizedSessionId =
    normalizeSessionId(
      sessionId
    );

  if (!normalizedSessionId) {
    throw new Error(
      "Invalid phone capture session ID."
    );
  }

  const response =
    await authenticatedFetch(
      `${PHONE_CAPTURE_SESSIONS_URL}/${encodePathSegment(
        normalizedSessionId
      )}`,
      {
        method:
          "GET",

        headers: {
          Accept:
            "application/json",
        },

        signal,
      }
    );

  const data =
    await readJsonResponse(
      response
    );

  if (!response.ok) {
    throw new Error(
      getResponseMessage(
        data,
        `Unable to check phone capture status. Status ${response.status}`
      )
    );
  }

  return data;
}


export async function cancelIncidentPhoneCaptureSession(
  sessionId,
  {
    signal,
  } = {}
) {
  const normalizedSessionId =
    normalizeSessionId(
      sessionId
    );

  if (!normalizedSessionId) {
    return {
      success:
        true,

      status:
        "CANCELLED",
    };
  }

  const response =
    await authenticatedFetch(
      `${PHONE_CAPTURE_SESSIONS_URL}/${encodePathSegment(
        normalizedSessionId
      )}`,
      {
        method:
          "DELETE",

        headers: {
          Accept:
            "application/json",
        },

        signal,
      }
    );

  const data =
    await readJsonResponse(
      response
    );

  if (!response.ok) {
    throw new Error(
      getResponseMessage(
        data,
        `Unable to cancel phone capture. Status ${response.status}`
      )
    );
  }

  return data;
}


export async function consumeIncidentPhoneCaptureSession(
  sessionId,
  {
    signal,
  } = {}
) {
  const normalizedSessionId =
    normalizeSessionId(
      sessionId
    );

  if (!normalizedSessionId) {
    throw new Error(
      "Invalid phone capture session ID."
    );
  }

  const response =
    await authenticatedFetch(
      `${PHONE_CAPTURE_SESSIONS_URL}/${encodePathSegment(
        normalizedSessionId
      )}/consume`,
      {
        method:
          "POST",

        headers: {
          Accept:
            "application/json",
        },

        signal,
      }
    );

  const data =
    await readJsonResponse(
      response
    );

  if (!response.ok) {
    throw new Error(
      getResponseMessage(
        data,
        `Unable to finish phone capture. Status ${response.status}`
      )
    );
  }

  return data;
}


/*
 * Refresh every completed phone capture immediately
 * before final Incident/workflow save.
 *
 * Why:
 *
 * The WELLJOB direct-upload descriptor is intentionally
 * short-lived. A user may keep the desktop modal open
 * for several minutes after a phone photo appears.
 *
 * Calling this function immediately before Save obtains
 * fresh actor-bound descriptors.
 */
export async function refreshIncidentPhoneCaptureDirectUploads(
  sessionIds,
  {
    signal,
  } = {}
) {
  const normalizedSessionIds =
    Array.from(
      new Set(
        (
          Array.isArray(
            sessionIds
          )
            ? sessionIds
            : []
        )
          .map(
            normalizeSessionId
          )
          .filter(
            Boolean
          )
      )
    );

  if (
    normalizedSessionIds.length ===
      0
  ) {
    return {
      sessions:
        [],

      directUploads:
        [],
    };
  }

  const sessions =
    await Promise.all(
      normalizedSessionIds.map(
        (
          sessionId
        ) =>
          getIncidentPhoneCaptureSession(
            sessionId,
            {
              signal,
            }
          )
      )
    );

  const directUploads =
    sessions.map(
      (
        session,
        index
      ) => {
        const status =
          String(
            session?.status ||
            ""
          ).trim();

        if (
          status !==
            INCIDENT_PHONE_CAPTURE_STATUSES
              .PHOTO_ADDED &&
          status !==
            INCIDENT_PHONE_CAPTURE_STATUSES
              .DONE
        ) {
          throw new Error(
            `Phone photo ${index + 1} has not finished uploading yet.`
          );
        }

        const descriptor =
          String(
            session?.photo
              ?.directUpload
              ?.descriptor ||
            ""
          ).trim();

        if (!descriptor) {
          throw new Error(
            `Phone photo ${index + 1} is missing its secure upload authorization.`
          );
        }

        return {
          descriptor,
        };
      }
    );

  return {
    sessions,
    directUploads,
  };
}


export async function consumeIncidentPhoneCaptureSessions(
  sessionIds
) {
  const normalizedSessionIds =
    Array.from(
      new Set(
        (
          Array.isArray(
            sessionIds
          )
            ? sessionIds
            : []
        )
          .map(
            normalizeSessionId
          )
          .filter(
            Boolean
          )
      )
    );

  const results = [];

  /*
   * Consume sequentially.
   *
   * This is a small list (maximum evidence count is 10)
   * and keeps errors easier to associate with a specific
   * session if production diagnostics are needed.
   */
  for (
    const sessionId of
    normalizedSessionIds
  ) {
    results.push(
      await consumeIncidentPhoneCaptureSession(
        sessionId
      )
    );
  }

  return results;
}


export async function cancelIncidentPhoneCaptureSessions(
  sessionIds
) {
  const normalizedSessionIds =
    Array.from(
      new Set(
        (
          Array.isArray(
            sessionIds
          )
            ? sessionIds
            : []
        )
          .map(
            normalizeSessionId
          )
          .filter(
            Boolean
          )
      )
    );

  const results =
    await Promise.allSettled(
      normalizedSessionIds.map(
        (
          sessionId
        ) =>
          cancelIncidentPhoneCaptureSession(
            sessionId
          )
      )
    );

  /*
   * Cleanup should be best-effort when a modal closes.
   * Return results so callers may log/report them, but
   * do not turn one failed cleanup into an unhandled
   * rejection that blocks the UI from closing.
   */
  return results;
}


/*
 * ==================================================
 * PUBLIC CAPTURE-ONLY PHONE API
 * ==================================================
 *
 * These functions never call authenticatedFetch().
 *
 * Public capture-token requests use static POST
 * endpoints and place captureToken only in the JSON
 * body. The raw token is never embedded in the
 * backend URL path or query string.
 */

export async function getIncidentPhoneCapturePublicStatus(
  captureToken,
  {
    signal,
  } = {}
) {
  const normalizedToken =
    normalizeCaptureToken(
      captureToken
    );

  if (!normalizedToken) {
    throw new Error(
      "This phone capture link is invalid."
    );
  }

  const response =
    await fetch(
      `${PHONE_CAPTURE_PUBLIC_URL}/status`,
      {
        method:
          "POST",

        /*
         * Public phone capture is token-based only.
         * Never attach browser cookies or other ambient
         * credentials to this request.
         */
        credentials:
          "omit",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            captureToken:
              normalizedToken,
          }),

        signal,
      }
    );

  const data =
    await readJsonResponse(
      response
    );

  if (!response.ok) {
    const error =
      new Error(
        getResponseMessage(
          data,
          `Unable to open phone capture. Status ${response.status}`
        )
      );

    error.code =
      data?.code ||
      null;

    error.status =
      response.status;

    throw error;
  }

  return data;
}


async function requestIncidentPhoneCaptureUploadAuthorization(
  {
    captureToken,
    file,
    signal,
  }
) {
  const normalizedToken =
    normalizeCaptureToken(
      captureToken
    );

  if (!normalizedToken) {
    throw new Error(
      "This phone capture link is invalid."
    );
  }

  if (
    !isBrowserFile(
      file
    )
  ) {
    throw new Error(
      "Choose or take a valid photo first."
    );
  }

  const response =
    await fetch(
      `${PHONE_CAPTURE_PUBLIC_URL}/upload-authorization`,
      {
        method:
          "POST",

        /*
         * Public phone capture is token-based only.
         * Never attach browser cookies or other ambient
         * credentials to this request.
         */
        credentials:
          "omit",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            captureToken:
              normalizedToken,

            file: {
              name:
                file.name ||
                "incident-photo.jpg",

              type:
                file.type,

              size:
                file.size,
            },
          }),

        signal,
      }
    );

  const data =
    await readJsonResponse(
      response
    );

  if (!response.ok) {
    const error =
      new Error(
        getResponseMessage(
          data,
          `Unable to prepare phone photo upload. Status ${response.status}`
        )
      );

    error.code =
      data?.code ||
      null;

    error.status =
      response.status;

    throw error;
  }

  const signedUrl =
    String(
      data?.signedUrl ||
      ""
    ).trim();

  if (!signedUrl) {
    throw new Error(
      "The server returned an incomplete phone photo upload authorization."
    );
  }

  return {
    ...data,
    signedUrl,
  };
}


/*
 * IMPORTANT:
 *
 * This request goes directly to Supabase.
 *
 * Never use authenticatedFetch() and never attach the
 * WELLJOB Bearer JWT.
 */
async function uploadIncidentPhonePhotoToSignedUrl(
  signedUrl,
  file,
  {
    signal,
  } = {}
) {
  const response =
    await fetch(
      signedUrl,
      {
        method:
          "PUT",

        /*
         * The signed Supabase URL is already the upload
         * authorization. Do not send browser credentials.
         */
        credentials:
          "omit",

        headers: {
          "Content-Type":
            file.type,

          "x-upsert":
            "false",
        },

        body:
          file,

        signal,
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
        ? `Photo upload failed (${response.status}): ${responseText}`
        : `Photo upload failed with status ${response.status}.`
    );
  }
}


async function completeIncidentPhoneCaptureUpload(
  captureToken,
  {
    signal,
  } = {}
) {
  const normalizedToken =
    normalizeCaptureToken(
      captureToken
    );

  if (!normalizedToken) {
    throw new Error(
      "This phone capture link is invalid."
    );
  }

  const response =
    await fetch(
      `${PHONE_CAPTURE_PUBLIC_URL}/complete`,
      {
        method:
          "POST",

        /*
         * Public phone capture is token-based only.
         * Never attach browser cookies or other ambient
         * credentials to this request.
         */
        credentials:
          "omit",

        headers: {
          Accept:
            "application/json",

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            captureToken:
              normalizedToken,
          }),

        signal,
      }
    );

  const data =
    await readJsonResponse(
      response
    );

  if (!response.ok) {
    const error =
      new Error(
        getResponseMessage(
          data,
          `Unable to finish phone photo upload. Status ${response.status}`
        )
      );

    error.code =
      data?.code ||
      null;

    error.status =
      response.status;

    throw error;
  }

  return data;
}


/*
 * Complete capture-only phone flow:
 *
 * 1. request signed upload URL
 * 2. PUT binary directly to private Supabase Storage
 * 3. ask WELLJOB backend to verify stored bytes
 *
 * Returns only when the desktop is allowed to treat the
 * photo as PHOTO_ADDED.
 */
export async function uploadIncidentPhoneCapturePhoto({
  captureToken,
  file,
  signal,
}) {
  if (
    !isBrowserFile(
      file
    )
  ) {
    throw new Error(
      "Take or choose a valid photo first."
    );
  }

  const mimeType =
    String(
      file.type ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    mimeType !==
      "image/jpeg" &&
    mimeType !==
      "image/png"
  ) {
    throw new Error(
      "Phone capture supports JPG, JPEG, or PNG photos only."
    );
  }

  const authorization =
    await requestIncidentPhoneCaptureUploadAuthorization({
      captureToken,
      file,
      signal,
    });

  await uploadIncidentPhonePhotoToSignedUrl(
    authorization.signedUrl,
    file,
    {
      signal,
    }
  );

  return completeIncidentPhoneCaptureUpload(
    captureToken,
    {
      signal,
    }
  );
}