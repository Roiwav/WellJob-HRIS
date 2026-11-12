const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveDecisionReviewerNames } = require("../utils/decisionReviewerDisplay");

test("legacy usernames and saved full names resolve real profiles, including inactive reviewers, without changing audit values", async () => {
  const rows = [{ decided_by: "hm01", decided_by_role: "HR_MANAGER", notes: "Historical notes" }, { decided_by: "Maria Santos" }, { decided_by: "legacy-only" }, { decided_by: "partial" }];
  const before = structuredClone(rows);
  let queries = 0;
  const db = { promise: () => ({ query: async (sql, params) => {
    queries++;
    assert.match(sql, /FROM users WHERE username IN/);
    assert.doesNotMatch(sql, /status =/);
    assert.ok(params.includes("hm01"));
    return [[{ username: "hm01", full_name: "Maria Santos", status: "Inactive" }, { username: "partial", full_name: "Maria" }]];
  } }) };
  const result = await resolveDecisionReviewerNames(rows, db);
  assert.equal(queries, 1);
  assert.deepEqual(rows, before);
  assert.equal(result[0].reviewer_full_name, "Maria Santos");
  assert.equal(result[1].reviewer_full_name, "Maria Santos");
  assert.equal(result[2].reviewer_full_name, null);
  assert.equal(result[3].reviewer_full_name, "Maria");
  assert.equal(result[0].decided_by, "hm01");
  assert.equal(result[0].decided_by_role, "HR_MANAGER");
  assert.equal(result[0].notes, "Historical notes");
});
