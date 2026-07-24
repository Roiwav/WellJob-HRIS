export const EVIDENCE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

export const EVIDENCE_MAX_SIZE = 5 * 1024 * 1024;

export function formatFileSize(bytes = 0) {
  if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(Number(bytes)) / Math.log(1024)),
    units.length - 1
  );
  return `${(Number(bytes) / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export function createEvidenceItem(file) {
  const typeAllowed = EVIDENCE_ALLOWED_TYPES.includes(file.type);
  const sizeAllowed = file.size > 0 && file.size <= EVIDENCE_MAX_SIZE;
  const error = !typeAllowed
    ? "Only JPG, PNG, WEBP, and PDF files are allowed."
    : !sizeAllowed
    ? "File must be larger than 0 bytes and no more than 5 MB."
    : "";

  return {
    id: `${file.name}-${file.size}-${file.lastModified}`,
    file,
    name: file.name,
    type: file.type,
    size: file.size,
    status: error ? "Failed" : "Ready",
    error,
    localUrl: !error ? URL.createObjectURL(file) : "",
    isLocal: true,
  };
}

export function revokeEvidenceUrl(item) {
  if (item?.isLocal && item?.localUrl) URL.revokeObjectURL(item.localUrl);
}

export function normalizeEvidenceFiles(source = {}) {
  const candidates = [
    source.proofFiles,
    source.proof_files,
    source.evidenceFiles,
    source.evidence_files,
    source.evidence,
    source.attachments,
  ];
  const files = candidates.find(Array.isArray) || [];

  return files.map((file, index) => ({
    ...file,
    id: file.id || file.fileId || file.file_id || `evidence-${index}`,
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
    size: Number(file.size || file.fileSize || file.file_size || 0),
    uploadedAt: file.uploadedAt || file.uploaded_at || file.createdAt || file.created_at,
    url:
      file.url ||
      file.fileUrl ||
      file.file_url ||
      file.downloadUrl ||
      file.download_url ||
      "",
    status: "Uploaded",
    isLocal: false,
  }));
}
