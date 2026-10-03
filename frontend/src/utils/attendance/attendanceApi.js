import {
  API_BASE,
} from "../../config/api";

import authenticatedFetch from "../authenticatedFetch";


const ATTENDANCE_API_URL =
  `${API_BASE}/attendance`;

const ATTENDANCE_UPLOAD_AUTHORIZATION_URL =
  `${ATTENDANCE_API_URL}/upload-authorizations`;

const ATTENDANCE_IMAGE_TYPES =
  new Set([
    "image/png",
    "image/jpeg",
  ]);

export const MAX_ATTENDANCE_EVIDENCE_SIZE =
  10 * 1024 * 1024;


function apiErrorMessage(
  payload,
  fallback
) {
  return String(
    payload?.error ||
      payload?.message ||
      fallback
  ).trim();
}


async function readJsonSafely(
  response
) {
  const text =
    await response
      .text()
      .catch(
        () => ""
      );

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(
      text
    );
  } catch {
    return {
      message:
        text,
    };
  }
}


async function requestWelljobJson(
  url,
  {
    method = "GET",
    body,
    signal,
  } = {}
) {
  let response;

  try {
    response =
      await authenticatedFetch(
        url,
        {
          method,

          signal,

          headers: {
            Accept:
              "application/json",

            ...(body !== undefined
              ? {
                  "Content-Type":
                    "application/json",
                }
              : {}),
          },

          ...(body !== undefined
            ? {
                body:
                  JSON.stringify(
                    body
                  ),
              }
            : {}),
        }
      );
  } catch (error) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw error;
    }

    throw new Error(
      "Unable to connect to the Attendance service."
    );
  }

  const payload =
    await readJsonSafely(
      response
    );

  if (!response.ok) {
    const error =
      new Error(
        apiErrorMessage(
          payload,
          `Attendance request failed (${response.status}).`
        )
      );

    error.status =
      response.status;

    error.code =
      payload?.code ||
      "";

    throw error;
  }

  return payload;
}


function validateEvidenceFile(
  file
) {
  if (
    typeof File ===
      "undefined" ||
    !(file instanceof File)
  ) {
    throw new Error(
      "Please attach the client Attendance image before saving."
    );
  }

  const mimeType =
    String(
      file.type ||
      ""
    ).toLowerCase();

  if (
    !ATTENDANCE_IMAGE_TYPES.has(
      mimeType
    )
  ) {
    throw new Error(
      "Client Attendance evidence must be a PNG or JPEG image."
    );
  }

  if (
    !Number.isFinite(
      file.size
    ) ||
    file.size <= 0
  ) {
    throw new Error(
      "The selected client Attendance image is empty."
    );
  }

  if (
    file.size >
    MAX_ATTENDANCE_EVIDENCE_SIZE
  ) {
    throw new Error(
      "The client Attendance image must be 10 MB or smaller."
    );
  }

  return file;
}


async function authorizeAttendanceEvidence({
  attendanceDate,
  file,
}) {
  const payload =
    await requestWelljobJson(
      ATTENDANCE_UPLOAD_AUTHORIZATION_URL,
      {
        method:
          "POST",

        body: {
          attendanceDate,

          files: [
            {
              name:
                file.name,

              type:
                file.type,

              size:
                file.size,
            },
          ],
        },
      }
    );

  const uploads =
    Array.isArray(
      payload?.uploads
    )
      ? payload.uploads
      : [];

  if (
    uploads.length !==
    1
  ) {
    throw new Error(
      "The server did not return a valid Attendance evidence upload authorization."
    );
  }

  const authorization =
    uploads[0];

  const signedUrl =
    String(
      authorization?.signedUrl ||
      ""
    ).trim();

  const descriptor =
    String(
      authorization?.descriptor ||
      ""
    ).trim();

  if (
    !signedUrl ||
    !descriptor
  ) {
    throw new Error(
      "The Attendance evidence upload authorization is incomplete."
    );
  }

  return {
    signedUrl,
    descriptor,
  };
}


/*
 * Supabase receives only its temporary signed URL.
 * WELLJOB authentication must never be forwarded
 * to the Supabase Storage request.
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

  if (!response.ok) {
    const message =
      await response
        .text()
        .catch(
          () => ""
        );

    throw new Error(
      message
        ? `Protected Attendance evidence upload failed: ${message}`
        : `Protected Attendance evidence upload failed (${response.status}).`
    );
  }
}


export async function getAttendanceByDate(
  attendanceDate,
  {
    signal,
  } = {}
) {
  const params =
    new URLSearchParams({
      date:
        attendanceDate,
    });

  return requestWelljobJson(
    `${ATTENDANCE_API_URL}?${params.toString()}`,
    {
      signal,
    }
  );
}


export async function saveAttendanceRecord({
  attendanceDate,
  source,
  entries,
  evidenceFile = null,
}) {
  const normalizedSource =
    String(
      source ||
      ""
    )
      .trim()
      .toLowerCase();

  let directUploads =
    [];

  if (
    normalizedSource ===
    "client"
  ) {
    const file =
      validateEvidenceFile(
        evidenceFile
      );

    const authorization =
      await authorizeAttendanceEvidence({
        attendanceDate,
        file,
      });

    await uploadEvidenceToSignedUrl(
      authorization.signedUrl,
      file
    );

    directUploads = [
      {
        descriptor:
          authorization.descriptor,
      },
    ];
  }

  return requestWelljobJson(
    ATTENDANCE_API_URL,
    {
      method:
        "POST",

      body: {
        attendanceDate,

        source:
          normalizedSource,

        entries,

        directUploads,
      },
    }
  );
}


export async function getAttendanceHistory({
  limit = 100,
  signal,
} = {}) {
  const params =
    new URLSearchParams({
      limit:
        String(limit),
    });

  return requestWelljobJson(
    `${ATTENDANCE_API_URL}/history?${params.toString()}`,
    {
      signal,
    }
  );
}


export async function getAttendanceHistoryDetail(
  id,
  {
    signal,
  } = {}
) {
  return requestWelljobJson(
    `${ATTENDANCE_API_URL}/history/${encodeURIComponent(id)}`,
    {
      signal,
    }
  );
}


export async function getAttendancePerformance({
  from,
  to,
  signal,
}) {
  const params =
    new URLSearchParams({
      from,
      to,
    });

  return requestWelljobJson(
    `${ATTENDANCE_API_URL}/performance?${params.toString()}`,
    {
      signal,
    }
  );
}


export async function getAttendanceEvidence(
  id
) {
  return requestWelljobJson(
    `${ATTENDANCE_API_URL}/history/${encodeURIComponent(id)}/evidence`
  );
}


export async function getEmployeeAttendanceHistory(
  employeeId,
  {
    limit = 365,
    signal,
  } = {}
) {
  const params =
    new URLSearchParams({
      limit:
        String(limit),
    });

  return requestWelljobJson(
    `${ATTENDANCE_API_URL}/employee/${encodeURIComponent(
      employeeId
    )}/history?${params.toString()}`,
    {
      signal,
    }
  );
}
