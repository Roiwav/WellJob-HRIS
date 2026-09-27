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
    const storageError =
      new Error(
        error.message ||
          "Supabase storage upload failed."
      );

    storageError.status =
      error.status ||
      error.statusCode ||
      null;

    storageError.code =
      error.name ||
      error.code ||
      "STORAGE_UPLOAD_ERROR";

    throw storageError;
  }

  return {
    path:
      data?.path ||
      normalizedPath,
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
    const storageError =
      new Error(
        error.message ||
          "Supabase storage download failed."
      );

    storageError.status =
      error.status ||
      error.statusCode ||
      null;

    storageError.code =
      error.name ||
      error.code ||
      "STORAGE_DOWNLOAD_ERROR";

    throw storageError;
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
    const storageError =
      new Error(
        error.message ||
          "Supabase storage delete failed."
      );

    storageError.status =
      error.status ||
      error.statusCode ||
      null;

    storageError.code =
      error.name ||
      error.code ||
      "STORAGE_DELETE_ERROR";

    throw storageError;
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
  downloadBuffer,
  removeObject,
  isStorageNotFoundError,
};
