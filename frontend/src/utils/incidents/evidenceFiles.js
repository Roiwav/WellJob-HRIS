import { API_BASE } from "../../config/api";
import authenticatedFetch from "../authenticatedFetch";

export const EVIDENCE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const EVIDENCE_MAX_SIZE =
  5 * 1024 * 1024;

/*
 * Persisted incident evidence served by the
 * protected backend endpoint currently supports:
 *
 * - JPEG
 * - PNG
 * - PDF
 *
 * WEBP remains in EVIDENCE_ALLOWED_TYPES above
 * to preserve the existing local frontend behavior
 * during this migration. Backend upload-type
 * reconciliation can be handled separately.
 */
const PROTECTED_EVIDENCE_TYPES =
  new Set([
    "image/jpeg",
    "image/png",
    "application/pdf",
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
    Number(rawValue);

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

function getProtectedEvidenceErrorMessage(
  status
) {
  switch (status) {
    case 400:
      return "The incident evidence reference is invalid.";

    case 401:
      return "Your session has expired. Please sign in again.";

    case 403:
      return "You do not have permission to access this incident evidence.";

    case 404:
      return "The incident evidence file could not be found.";

    case 415:
      return "This incident evidence file type is not supported.";

    case 503:
      return "The system is currently under maintenance.";

    default:
      return "Unable to load the incident evidence file.";
  }
}

export function formatFileSize(
  bytes = 0
) {
  const numericBytes =
    Number(bytes);

  if (
    !Number.isFinite(
      numericBytes
    ) ||
    numericBytes <= 0
  ) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
  ];

  const index =
    Math.min(
      Math.floor(
        Math.log(
          numericBytes
        ) /
          Math.log(1024)
      ),
      units.length - 1
    );

  return `${
    (
      numericBytes /
      1024 ** index
    ).toFixed(
      index ? 1 : 0
    )
  } ${units[index]}`;
}

export function createEvidenceItem(
  file
) {
  const typeAllowed =
    EVIDENCE_ALLOWED_TYPES.includes(
      file.type
    );

  const sizeAllowed =
    file.size > 0 &&
    file.size <=
      EVIDENCE_MAX_SIZE;

  const error =
    !typeAllowed
      ? "Only JPG, PNG, WEBP, and PDF files are allowed."
      : !sizeAllowed
        ? "File must be larger than 0 bytes and no more than 5 MB."
        : "";

  return {
    id:
      `${file.name}-${file.size}-${file.lastModified}`,

    file,

    name:
      file.name,

    type:
      file.type,

    size:
      file.size,

    status:
      error
        ? "Failed"
        : "Ready",

    error,

    localUrl:
      !error
        ? URL.createObjectURL(
            file
          )
        : "",

    isLocal:
      true,
  };
}

export function revokeEvidenceUrl(
  item
) {
  if (
    item?.isLocal &&
    item?.localUrl
  ) {
    URL.revokeObjectURL(
      item.localUrl
    );
  }
}

/*
 * Fetches one persisted incident evidence file
 * through the protected backend endpoint:
 *
 * GET
 * /api/incidents/:incidentId/evidence/:evidenceId/file
 *
 * authenticatedFetch automatically attaches the
 * current JWT and preserves the application's
 * global maintenance-mode handling.
 *
 * The returned Blob URL belongs to the caller.
 * The component that receives it MUST revoke the
 * URL when it is no longer needed.
 */
export async function fetchIncidentEvidencePreview({
  incidentId,
  evidenceId,
  signal,
} = {}) {
  const normalizedIncidentId =
    normalizePositiveInteger(
      incidentId
    );

  const normalizedEvidenceId =
    normalizePositiveInteger(
      evidenceId
    );

  if (
    !normalizedIncidentId ||
    !normalizedEvidenceId
  ) {
    throw new Error(
      "The incident evidence reference is invalid."
    );
  }

  let response;

  try {
    response =
      await authenticatedFetch(
        `${API_BASE}/incidents/${normalizedIncidentId}/evidence/${normalizedEvidenceId}/file`,
        {
          method: "GET",
          signal,
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
      "Unable to connect to the server to load the incident evidence."
    );
  }

  if (!response.ok) {
    throw new Error(
      getProtectedEvidenceErrorMessage(
        response.status
      )
    );
  }

  const responseContentType =
    String(
      response.headers.get(
        "content-type"
      ) || ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

  const blob =
    await response.blob();

  const blobContentType =
    String(
      blob.type || ""
    )
      .split(";")[0]
      .trim()
      .toLowerCase();

  const contentType =
    blobContentType ||
    responseContentType;

  if (
    !PROTECTED_EVIDENCE_TYPES.has(
      contentType
    )
  ) {
    throw new Error(
      "This incident evidence file type is not supported."
    );
  }

  if (
    signal?.aborted
  ) {
    throw new DOMException(
      "The incident evidence request was aborted.",
      "AbortError"
    );
  }

  const objectUrl =
    URL.createObjectURL(
      blob
    );

  /*
   * A request may complete at nearly the same
   * moment the caller aborts it.
   *
   * Never return an obsolete Blob URL in that case.
   */
  if (
    signal?.aborted
  ) {
    URL.revokeObjectURL(
      objectUrl
    );

    throw new DOMException(
      "The incident evidence request was aborted.",
      "AbortError"
    );
  }

  return {
    url:
      objectUrl,

    contentType,

    isImage:
      contentType.startsWith(
        "image/"
      ),

    isPdf:
      contentType ===
      "application/pdf",

    isObjectUrl:
      true,
  };
}

export function normalizeEvidenceFiles(
  source = {}
) {
  const candidates = [
    source.proofFiles,
    source.proof_files,
    source.evidenceFiles,
    source.evidence_files,
    source.evidence,
    source.attachments,
  ];

  const files =
    candidates.find(
      Array.isArray
    ) || [];

  const sourceIncidentId =
    source.incidentId ??
    source.incident_id ??
    source.id ??
    null;

  return files.map(
    (
      file,
      index
    ) => {
      const evidenceId =
        file.evidenceId ??
        file.evidence_id ??
        file.id ??
        file.fileId ??
        file.file_id ??
        null;

      const incidentId =
        file.incidentId ??
        file.incident_id ??
        sourceIncidentId ??
        null;

      return {
        ...file,

        id:
          evidenceId ||
          `evidence-${index}`,

        evidenceId,

        evidence_id:
          evidenceId,

        incidentId,

        incident_id:
          incidentId,

        name:
          file.name ||
          file.fileName ||
          file.file_name ||
          file.originalName ||
          file.original_name ||
          `Evidence ${index + 1}`,

        type:
          file.type ||
          file.mimeType ||
          file.mime_type ||
          file.contentType ||
          file.content_type ||
          "Uploaded file",

        size:
          Number(
            file.size ||
            file.fileSize ||
            file.file_size ||
            0
          ),

        uploadedAt:
          file.uploadedAt ||
          file.uploaded_at ||
          file.createdAt ||
          file.created_at,

        /*
         * TEMPORARY MIGRATION COMPATIBILITY:
         *
         * Preserve the legacy URL field for now
         * because ModalUI.jsx has not yet been
         * migrated.
         *
         * The next frontend step will stop using
         * this URL for persisted evidence.
         *
         * Do not remove /documents from the backend
         * until that consumer migration is complete.
         */
        url:
          file.url ||
          file.fileUrl ||
          file.file_url ||
          file.downloadUrl ||
          file.download_url ||
          "",

        status:
          "Uploaded",

        isLocal:
          false,
      };
    }
  );
}