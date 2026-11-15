import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.resolve(testDirectory, "../src/pages/Deployments.jsx"),
  "utf8"
);

test("deployment activity requests include authorized filters and pagination", () => {
  assert.match(source, /params\.set\(\s*"company",\s*movementCompany/);
  assert.match(source, /page:\s*String\(\s*movementPage/);
  assert.match(source, /pageSize:\s*String\(\s*MOVEMENT_PAGE_SIZE/);
  assert.match(source, /movementAbortControllerRef\.current\?\.abort\(\)/);
});

test("deployment activity export requests the complete filtered result", () => {
  assert.match(source, /export:\s*"all"/);
  assert.match(source, /handleExportMovementPDF/);
  assert.match(source, /reportData[\s\S]{0,80}\?\.pagination[\s\S]{0,40}\?\.total/);
});

test("deployment activity refresh lifecycle is visible-tab scoped and cleaned up", () => {
  assert.match(source, /MOVEMENT_POLL_INTERVAL_MS\s*=\s*60000/);
  assert.match(source, /document\.visibilityState\s*!==\s*"visible"/);
  assert.match(source, /window\.clearInterval\(\s*intervalId/);
  assert.match(source, /removeEventListener\(\s*"visibilitychange"/);
});

test("deployment activity UI exposes company scope, completion categories, and pagination", () => {
  assert.match(source, /Company scope is locked to your authorized assignment/);
  assert.match(source, /Transferred \/ Reassigned/);
  assert.match(source, /Deployment Ended \/ Pulled Out/);
  assert.match(source, /Other Completion/);
  assert.match(source, /Showing \{events\.length\} of/);
  assert.match(source, /event\.performedBy \|\|\s*"Not recorded"/);
});

test("activity table and PDF share reliable actor name and friendly role mapping", () => {
  assert.match(source, /event\.performedBy \|\|\s*"Not recorded"/);
  assert.match(source, /formatRoleLabel\(\s*event\.performedByRole\s*\)/);
  assert.match(source, /performedByRole[\s\S]{0,240}\.join\(\s*" · "/);
  assert.match(source, /\[\s*"hr",\s*"it",\s*\]\.includes/);
});

test("activity records split date and time while using a more compact table layout", () => {
  assert.match(source, /getMovementEventDateTimeParts/);
  assert.match(source, /\{dateLabel\}/);
  assert.match(source, /\{timeLabel\}/);
  assert.match(source, /text-\[11px\][^\n]*text-slate-500/);
  assert.match(source, /min-w-\[1180px\]/);
  assert.match(source, /<col className="w-\[160px\]" \/>/);
  assert.match(source, /<col className="w-\[120px\]" \/>/);
  assert.match(source, /<col className="w-\[155px\]" \/>/);
});
