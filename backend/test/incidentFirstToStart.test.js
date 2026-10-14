"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("controller retains row locking and conditional claim safeguards", () => {
  const source = fs.readFileSync(
    path.resolve(
      __dirname,
      "../controllers/incidentController.js"
    ),
    "utf8"
  );

  assert.match(source, /FOR UPDATE/);
  assert.match(
    source,
    /status,\s*''\)\)\)\s*=\s*'open'/i
  );
  assert.match(
    source,
    /investigation_started_at IS NULL/i
  );
  assert.match(
    source,
    /Another authorized investigator has already started this investigation\./
  );
});

test("real MySQL concurrency coverage is registered separately and guarded", () => {
  const integrationPath = path.resolve(
    __dirname,
    "incidentFirstToStart.mysql.test.js"
  );
  const source = fs.readFileSync(
    integrationPath,
    "utf8"
  );

  assert.match(source, /TEST_DB_NAME/);
  assert.match(source, /isolated/i);
  assert.match(source, /Promise\.all/);
  assert.match(source, /FOR UPDATE/);
});

test("incident creation records the canonical creator in the same transaction", () => {
  const source = fs.readFileSync(
    path.resolve(
      __dirname,
      "../controllers/incidentController.js"
    ),
    "utf8"
  );

  const createInsert = source.indexOf(
    "INSERT INTO incidents"
  );
  const timelineCall = source.indexOf(
    "await addTimelineEvent({",
    createInsert
  );
  const creatorTimeline = source.indexOf(
    '"CREATE_INCIDENT"',
    timelineCall
  );
  const afterCreator = source.slice(
    creatorTimeline
  );
  const commitMatch =
    /await\s+connection\s*\.commit\(\)/.exec(
      afterCreator
    );

  assert.ok(createInsert >= 0);
  assert.ok(timelineCall > createInsert);
  assert.ok(creatorTimeline > timelineCall);
  assert.ok(commitMatch);
});

test("proof submission rechecks owner after row lock and clears prior review fields", () => {
  const source = fs.readFileSync(
    path.resolve(
      __dirname,
      "../controllers/incidentController.js"
    ),
    "utf8"
  );

  const rowLock = source.indexOf("FOR UPDATE");
  const ownerCheck = source.indexOf(
    "evaluateProofSubmission({",
    rowLock
  );
  const reviewReset = source.indexOf(
    '"review_decision = NULL"',
    ownerCheck
  );

  assert.ok(rowLock >= 0);
  assert.ok(ownerCheck > rowLock);
  assert.ok(reviewReset > ownerCheck);
  assert.match(source, /Proof Resubmitted/);
});