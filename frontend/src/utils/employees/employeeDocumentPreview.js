import { API_BASE } from "../../config/api";
import authenticatedFetch from "../authenticatedFetch";

const SUPPORTED_PREVIEW_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);

function getPreviewErrorMessage(status) {
  if (status === 401) {
    return "Your session is no longer authorized to preview this document.";
  }

  if (status === 403) {
    return "You do not have permission to preview this document.";
  }

  if (status === 404) {
    return "This document file is no longer available.";
  }

  if (status === 415) {
    return "This document type cannot be previewed.";
  }

  if (status === 503) {
    return "Document preview is temporarily unavailable during maintenance.";
  }

  return "Unable to load this document preview.";
}

export async function fetchEmployeeDocumentPreview(
  documentId,
  { signal } = {}
) {
  const numericDocumentId = Number(documentId);

  if (
    !Number.isSafeInteger(numericDocumentId) ||
    numericDocumentId <= 0
  ) {
    throw new Error("This saved document does not have a valid preview ID.");
  }

  let response;

  try {
    response = await authenticatedFetch(
      `${API_BASE}/employee-documents/${numericDocumentId}/file`,
      { signal }
    );
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new Error("Unable to connect to the document preview service.");
  }

  if (!response.ok) {
    throw new Error(getPreviewErrorMessage(response.status));
  }

  const blob = await response.blob();
  const mimeType = String(blob.type || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();

  if (!SUPPORTED_PREVIEW_TYPES.has(mimeType)) {
    throw new Error("This document type cannot be previewed.");
  }

  return {
    url: URL.createObjectURL(blob),
    mimeType,
    type: mimeType.startsWith("image/") ? "image" : "pdf",
  };
}
