"use strict";

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");
const {
  createClient,
} = require("@supabase/supabase-js");

const EXPECTED_DATABASE =
  "welljob_phase3_test";
const TEST_BUCKET =
  "welljob-phase3-test";
const localEnvPath =
  path.resolve(
    __dirname,
    "..",
    ".env.phase3.local"
  );

dotenv.config({
  path: path.resolve(
    __dirname,
    "..",
    ".env"
  ),
  override: false,
  quiet: true,
});

if (
  process.env.DB_NAME !==
    EXPECTED_DATABASE ||
  process.env.DB_EXPECTED_NAME !==
    EXPECTED_DATABASE
) {
  throw new Error(
    `Supabase Phase 3 preparation requires ${EXPECTED_DATABASE}.`
  );
}

const shouldCreate =
  process.argv.includes(
    "--create"
  );

function setLocalBucket() {
  if (!fs.existsSync(localEnvPath)) {
    throw new Error(
      "backend/.env.phase3.local is missing."
    );
  }

  const source =
    fs.readFileSync(
      localEnvPath,
      "utf8"
    );
  const entry =
    `SUPABASE_STORAGE_BUCKET=${TEST_BUCKET}`;
  const next =
    /^SUPABASE_STORAGE_BUCKET=.*$/m.test(
      source
    )
      ? source.replace(
          /^SUPABASE_STORAGE_BUCKET=.*$/m,
          entry
        )
      : `${source.replace(/\s*$/, "")}\n${entry}\n`;

  fs.writeFileSync(
    localEnvPath,
    next,
    "utf8"
  );
}

async function main() {
  const url = String(
    process.env.SUPABASE_URL ||
      ""
  ).trim();
  const secretKey = String(
    process.env.SUPABASE_SECRET_KEY ||
      ""
  ).trim();

  if (!url || !secretKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY are required."
    );
  }

  const supabase =
    createClient(
      url,
      secretKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );
  const {
    data: buckets,
    error: listError,
  } =
    await supabase.storage
      .listBuckets();

  if (listError) {
    throw new Error(
      `Supabase bucket access failed: ${listError.message}`
    );
  }

  let bucket =
    (buckets || []).find(
      (item) =>
        item.name ===
        TEST_BUCKET
    );

  if (
    !bucket &&
    shouldCreate
  ) {
    const {
      data,
      error,
    } =
      await supabase.storage
        .createBucket(
          TEST_BUCKET,
          {
            public: false,
            fileSizeLimit:
              5 *
              1024 *
              1024,
            allowedMimeTypes: [
              "application/pdf",
              "image/jpeg",
              "image/png",
            ],
          }
        );

    if (error) {
      throw new Error(
        `Supabase test bucket creation failed: ${error.message}`
      );
    }

    bucket = {
      ...(data || {}),
      name:
        TEST_BUCKET,
      public:
        false,
    };
  }

  if (!bucket) {
    console.log(
      JSON.stringify({
        bucket:
          TEST_BUCKET,
        exists:
          false,
        created:
          false,
        localEnvUpdated:
          false,
      })
    );
    return;
  }

  if (
    bucket.public === true
  ) {
    throw new Error(
      "The Phase 3 Supabase bucket exists but is public. A private bucket is required."
    );
  }

  setLocalBucket();

  console.log(
    JSON.stringify({
      bucket:
        TEST_BUCKET,
      exists:
        true,
      private:
        true,
      created:
        shouldCreate,
      localEnvUpdated:
        true,
    })
  );
}

main().catch(
  (error) => {
    console.error(
      `PHASE 3 SUPABASE PREPARATION FAILED: ${error.message}`
    );
    process.exitCode = 1;
  }
);
