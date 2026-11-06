"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getDeploymentMetadata,
} = require("../utils/deploymentMetadata");

test(
  "deployment metadata exposes Vercel commit identity without credentials",
  () => {
    const metadata =
      getDeploymentMetadata({
        VERCEL_GIT_COMMIT_SHA:
          "00b96ee6cd54a30614ad92c8487dfd7b7ee96bac",
        VERCEL_GIT_COMMIT_REF:
          "VercelBackendMigration",
        VERCEL_ENV:
          "production",
        VERCEL_URL:
          "welljob-hris-backend-example.vercel.app",
        VERCEL_PROJECT_PRODUCTION_URL:
          "api.example.test",
        SUPABASE_SECRET_KEY:
          "must-not-appear",
        DB_PASSWORD:
          "must-not-appear",
      });

    assert.deepEqual(
      metadata,
      {
        service:
          "welljob-hris-backend",
        packageVersion:
          "1.0.0",
        gitCommitSha:
          "00b96ee6cd54a30614ad92c8487dfd7b7ee96bac",
        gitCommitRef:
          "VercelBackendMigration",
        deploymentEnvironment:
          "production",
        deploymentUrl:
          "https://welljob-hris-backend-example.vercel.app",
        productionUrl:
          "https://api.example.test",
      }
    );
    assert.doesNotMatch(
      JSON.stringify(
        metadata
      ),
      /must-not-appear/
    );
  }
);
