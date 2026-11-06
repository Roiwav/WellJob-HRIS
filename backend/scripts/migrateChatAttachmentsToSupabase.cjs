const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true,
});

if (!process.argv.includes("--confirm-upload")) {
  throw new Error(
    "Refusing to upload historical chat attachments without --confirm-upload."
  );
}

const EXPECTED_DATABASE =
  String(
    process.env.CHAT_ATTACHMENT_MIGRATION_DB || ""
  ).trim();

if (
  !EXPECTED_DATABASE ||
  String(process.env.DB_NAME || "").trim() !== EXPECTED_DATABASE
) {
  throw new Error(
    "CHAT_ATTACHMENT_MIGRATION_DB must explicitly match DB_NAME."
  );
}

const db = require("../config/db");

const {
  uploadBuffer,
  downloadBuffer,
  isStorageNotFoundError,
} = require("../services/storageService");

const sql = db.promise();

const CURRENT_PRIVATE_FOLDER =
  path.resolve(
    __dirname,
    "..",
    "private_chat_uploads"
  );

const USER_HOME =
  os.homedir();

const CANDIDATE_PRIVATE_FOLDERS = [
  CURRENT_PRIVATE_FOLDER,

  process.env.CHAT_LEGACY_UPLOAD_SOURCE
    ? path.resolve(process.env.CHAT_LEGACY_UPLOAD_SOURCE)
    : null,

  path.join(
    USER_HOME,
    "OneDrive",
    "Desktop",
    "WellJob-HRIS",
    "backend",
    "private_chat_uploads"
  ),

  path.join(
    USER_HOME,
    "Desktop",
    "WellJob-HRIS",
    "backend",
    "private_chat_uploads"
  ),
].filter(Boolean);

const CHAT_ATTACHMENT_PREFIX =
  "chat/attachments";

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objectPathFor(storageName) {
  if (!UUID_V4_PATTERN.test(String(storageName || ""))) {
    throw new Error(
      `Invalid chat attachment storage_name: ${storageName}`
    );
  }

  return `${CHAT_ATTACHMENT_PREFIX}/${storageName}`;
}

function sha256(buffer) {
  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

function validPdf(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length > 0 &&
    buffer.subarray(0, 5).toString("ascii") === "%PDF-" &&
    buffer
      .subarray(
        Math.max(
          0,
          buffer.length - 2048
        )
      )
      .toString("latin1")
      .includes("%%EOF")
  );
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findLocalAttachment(storageName) {
  for (const folder of CANDIDATE_PRIVATE_FOLDERS) {
    const filePath =
      path.join(
        folder,
        storageName
      );

    if (await fileExists(filePath)) {
      return {
        folder,
        filePath,
      };
    }
  }

  return null;
}

async function tryDownload(objectPath) {
  try {
    return await downloadBuffer(objectPath);
  } catch (error) {
    if (isStorageNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

async function main() {
  const [[identity]] = await sql.query(
    "SELECT DATABASE() AS database_name"
  );

  if (String(identity?.database_name || "") !== EXPECTED_DATABASE) {
    throw new Error(
      `Database target verification failed: expected ${EXPECTED_DATABASE}.`
    );
  }

  console.log(
    "WELLJOB Messenger historical attachment migration v2"
  );

  console.log(
    "Source database writes: DISABLED"
  );

  console.log(
    "Target: private Supabase Storage"
  );

  console.log("");
  console.log("Local attachment search folders:");

  for (const folder of CANDIDATE_PRIVATE_FOLDERS) {
    console.log(
      `  ${await fileExists(folder) ? "FOUND  " : "MISSING"} ${folder}`
    );
  }

  const [rows] =
    await sql.query(
      `
      SELECT
        id,
        storage_name,
        original_name,
        byte_size
      FROM chat_attachments
      ORDER BY id ASC
      `
    );

  console.log("");
  console.log(
    `Database attachment rows: ${rows.length}`
  );

  /*
   * Preflight every row before writing anything to
   * Supabase. This prevents a partial migration if
   * one or more historical files are unrecoverable.
   */
  const plans = [];
  const missing = [];

  for (const row of rows) {
    const storageName =
      String(
        row.storage_name || ""
      );

    const objectPath =
      objectPathFor(storageName);

    const local =
      await findLocalAttachment(
        storageName
      );

    const remoteBefore =
      await tryDownload(
        objectPath
      );

    let localBuffer =
      null;

    if (local) {
      localBuffer =
        await fs.readFile(
          local.filePath
        );

      if (
        localBuffer.length !==
          Number(row.byte_size) ||
        !validPdf(localBuffer)
      ) {
        throw new Error(
          `Local attachment ${row.id} failed byte-size/PDF validation: ${local.filePath}`
        );
      }

      if (
        remoteBefore &&
        sha256(remoteBefore) !==
          sha256(localBuffer)
      ) {
        throw new Error(
          `Supabase object mismatch for attachment ${row.id}.`
        );
      }
    }

    if (
      !localBuffer &&
      remoteBefore &&
      remoteBefore.length ===
        Number(row.byte_size) &&
      validPdf(remoteBefore)
    ) {
      plans.push({
        row,
        storageName,
        objectPath,
        local: null,
        localBuffer: null,
        remoteBefore,
      });

      continue;
    }

    if (!localBuffer) {
      missing.push({
        id: row.id,
        storageName,
        originalName:
          row.original_name,
        byteSize:
          Number(row.byte_size),
      });

      continue;
    }

    plans.push({
      row,
      storageName,
      objectPath,
      local,
      localBuffer,
      remoteBefore,
    });
  }

  if (missing.length > 0) {
    console.log("");
    console.log(
      "UNRECOVERED HISTORICAL ATTACHMENTS:"
    );

    for (const item of missing) {
      console.log(
        `  MISSING id=${item.id} storage_name=${item.storageName} bytes=${item.byteSize} name=${item.originalName}`
      );
    }

    throw new Error(
      `${missing.length} historical attachment(s) are missing from all known local folders and do not exist as valid Supabase objects. No Supabase uploads were performed.`
    );
  }

  console.log("");
  console.log(
    "Preflight: PASS"
  );

  let uploadedCount = 0;
  let verifiedExistingCount = 0;

  for (const plan of plans) {
    const {
      row,
      storageName,
      objectPath,
      local,
      localBuffer,
      remoteBefore,
    } = plan;

    if (remoteBefore) {
      verifiedExistingCount += 1;

      console.log(
        `VERIFY  ${row.id} ${storageName}${local ? ` source=${local.folder}` : " (remote only)"}`
      );

      continue;
    }

    await uploadBuffer(
      objectPath,
      localBuffer,
      {
        contentType:
          "application/pdf",

        upsert:
          false,
      }
    );

    const remoteAfter =
      await downloadBuffer(
        objectPath
      );

    if (
      remoteAfter.length !==
        localBuffer.length ||
      sha256(remoteAfter) !==
        sha256(localBuffer)
    ) {
      throw new Error(
        `Post-upload hash verification failed for attachment ${row.id}.`
      );
    }

    uploadedCount += 1;

    console.log(
      `UPLOAD  ${row.id} ${storageName} source=${local.folder}`
    );
  }

  console.log("");
  console.log(
    "============================================================"
  );

  console.log(
    "WELLJOB MESSENGER ATTACHMENT MIGRATION: PASS"
  );

  console.log(
    "============================================================"
  );

  console.log(
    `Rows checked: ${rows.length}`
  );

  console.log(
    `Uploaded now: ${uploadedCount}`
  );

  console.log(
    `Already verified: ${verifiedExistingCount}`
  );

  console.log(
    "Source database modified: NO"
  );

  console.log(
    "Source local files deleted: NO"
  );
}

main()
  .catch(
    (error) => {
      console.error(
        "\nWELLJOB MESSENGER ATTACHMENT MIGRATION FAILED:",
        error?.message || error
      );

      process.exitCode = 1;
    }
  )
  .finally(
    async () => {
      try {
        await sql.end();
      } catch {
        // Ignore cleanup-only errors.
      }
    }
  );
