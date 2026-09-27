const {
  supabase,
  SUPABASE_STORAGE_BUCKET,
} = require("../config/supabase");

/*
 * ==================================================
 * WELLJOB PRIVATE STORAGE SERVICE
 * ==================================================
 *
 * All protected binary files are stored inside the
 * private Supabase bucket.
 *
 * Controllers remain responsible for:
 * - authentication
 * - authorization
 * - business rules
 * - safe filenames / generated object names
 *
 * This service handles only private object storage.
 */

function normalizeObjectPath(value) {
  const objectPath = String(
    value || ""
  )
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  if (!objectPath) {
    throw new Error(
      "Storage object path is required."
    );
  }

  const segments =
    objectPath.split("/");

  if (
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === ".."
    )
  ) {
    throw new Error(
      "Invalid storage object path."
    );
  }

  return objectPath;
}

function createStorageError(
  error,
  fallbackMessage,
  fallbackCode
) {
  const storageError =
    new Error(
      error?.message ||
        fallbackMessage
    );

  storageError.status =
    error?.status ||
    error?.statusCode ||
    null;

  storageError.code =
    error?.name ||
    error?.code ||
    fallbackCode;

  return storageError;
}

async function uploadBuffer(
  objectPath,
  buffer,
  {
    contentType,
    upsert = false,
  } = {}
) {
  const normalizedPath =
    normalizeObjectPath(
      objectPath
    );

  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length === 0
  ) {
    throw new Error(
      "A non-empty Buffer is required for storage upload."
    );
  }

  const {
    data,
    error,
  } = await supabase.storage
    .from(
      SUPABASE_STORAGE_BUCKET
    )
    .upload(
      normalizedPath,
      buffer,
      {
        contentType:
          contentType ||
          "application/octet-stream",

        upsert:
          Boolean(upsert),

        cacheControl:
          "0",
      }
    );

  if (error) {
    throw createStorageError(
      error,
      "Supabase storage upload failed.",
      "STORAGE_UPLOAD_ERROR"
    );
  }

  return {
    path:
      data?.path ||
      normalizedPath,
  };
}

/*
 * ==================================================
 * SIGNED DIRECT UPLOAD
 * ==================================================
 *
 * Used when the browser must upload a file directly
 * to Supabase Storage rather than sending the binary
 * through the application server.
 *
 * Security:
 *
 * - The Supabase secret key remains backend-only.
 * - The caller receives only a temporary signed
 *   upload URL/token for one server-selected path.
 * - Object paths are normalized here before signing.
 * - Upsert defaults to false so existing protected
 *   files are not silently overwritten.
 */
async function createSignedUploadUrl(
  objectPath,
  {
    upsert = false,
  } = {}
) {
  const normalizedPath =
    normalizeObjectPath(
      objectPath
    );

  const {
    data,
    error,
  } = await supabase.storage
    .from(
      SUPABASE_STORAGE_BUCKET
    )
    .createSignedUploadUrl(
      normalizedPath,
      {
        upsert:
          Boolean(upsert),
      }
    );

  if (error) {
    throw createStorageError(
      error,
      "Unable to create a signed storage upload URL.",
      "STORAGE_SIGNED_UPLOAD_ERROR"
    );
  }

  const signedUrl =
    String(
      data?.signedUrl || ""
    ).trim();

  const token =
    String(
      data?.token || ""
    ).trim();

  if (
    !signedUrl ||
    !token
  ) {
    throw new Error(
      "Supabase did not return a valid signed upload authorization."
    );
  }

  return {
    path:
      data?.path ||
      normalizedPath,

    signedUrl,
    token,
  };
}

async function createSignedDownloadUrl(
  objectPath,
  {
    expiresIn = 60,
  } = {}
) {
  const normalizedPath =
    normalizeObjectPath(
      objectPath
    );

  const normalizedExpiresIn =
    Number(
      expiresIn
    );

  if (
    !Number.isSafeInteger(
      normalizedExpiresIn
    ) ||
    normalizedExpiresIn < 1 ||
    normalizedExpiresIn > 3600
  ) {
    throw new Error(
      "Signed download expiry must be between 1 and 3600 seconds."
    );
  }

  const {
    data,
    error,
  } = await supabase.storage
    .from(
      SUPABASE_STORAGE_BUCKET
    )
    .createSignedUrl(
      normalizedPath,
      normalizedExpiresIn
    );

  if (error) {
    throw createStorageError(
      error,
      "Unable to create a signed storage download URL.",
      "STORAGE_SIGNED_DOWNLOAD_ERROR"
    );
  }

  const signedUrl =
    String(
      data?.signedUrl ||
      ""
    ).trim();

  if (!signedUrl) {
    throw new Error(
      "Supabase did not return a valid signed download URL."
    );
  }

  return {
    path:
      data?.path ||
      normalizedPath,

    signedUrl,

    expiresIn:
      normalizedExpiresIn,
  };
}

async function downloadBuffer(
  objectPath
) {
  const normalizedPath =
    normalizeObjectPath(
      objectPath
    );

  const {
    data,
    error,
  } = await supabase.storage
    .from(
      SUPABASE_STORAGE_BUCKET
    )
    .download(
      normalizedPath
    );

  if (error) {
    throw createStorageError(
      error,
      "Supabase storage download failed.",
      "STORAGE_DOWNLOAD_ERROR"
    );
  }

  const arrayBuffer =
    await data.arrayBuffer();

  return Buffer.from(
    arrayBuffer
  );
}

async function removeObject(
  objectPath
) {
  const normalizedPath =
    normalizeObjectPath(
      objectPath
    );

  const {
    data,
    error,
  } = await supabase.storage
    .from(
      SUPABASE_STORAGE_BUCKET
    )
    .remove([
      normalizedPath,
    ]);

  if (error) {
    throw createStorageError(
      error,
      "Supabase storage delete failed.",
      "STORAGE_DELETE_ERROR"
    );
  }

  return data;
}

function isStorageNotFoundError(
  error
) {
  const status =
    Number(
      error?.status ||
        error?.statusCode ||
        0
    );

  const message =
    String(
      error?.message || ""
    ).toLowerCase();

  return (
    status === 404 ||
    message.includes(
      "object not found"
    ) ||
    message.includes(
      "not found"
    )
  );
}

module.exports = {
  normalizeObjectPath,
  uploadBuffer,
  createSignedUploadUrl,
  createSignedDownloadUrl,
  downloadBuffer,
  removeObject,
  isStorageNotFoundError,
};