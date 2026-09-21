const test = require("node:test");
const assert = require("node:assert/strict");

/*
 * Prevent unit tests from touching the real database.
 *
 * violationPolicyService imports config/db at module load because
 * some of its other functions read configuration from MySQL.
 * These tests exercise only pure policy functions, so the DB module
 * is replaced with a guard that fails immediately if a query is
 * attempted.
 */
const dbModulePath =
  require.resolve("../config/db");

require.cache[dbModulePath] = {
  id: dbModulePath,
  filename: dbModulePath,
  loaded: true,
  exports: {
    promise() {
      return {
        query() {
          throw new Error(
            "Unit test attempted to access the live database."
          );
        },
      };
    },
  },
};

const {
  getHighestSeverity,
  getPenaltyText,
  computeAutoSeverity,
  countViolationRules,
} = require(
  "../utils/violationPolicyService"
);

test(
  "getHighestSeverity selects the highest valid severity",
  () => {
    assert.equal(
      getHighestSeverity([
        "Minor",
        "Critical",
        "Major",
      ]),
      "Critical"
    );

    assert.equal(
      getHighestSeverity([
        "Unknown",
        "Major",
      ]),
      "Major"
    );

    assert.equal(
      getHighestSeverity([]),
      ""
    );
  }
);

test(
  "getPenaltyText normalizes string and object penalties",
  () => {
    assert.equal(
      getPenaltyText(
        "  Written Warning  "
      ),
      "Written Warning"
    );

    assert.equal(
      getPenaltyText({
        action:
          "  7 Days Suspension  ",
      }),
      "7 Days Suspension"
    );

    assert.equal(
      getPenaltyText(null),
      ""
    );
  }
);

test(
  "computeAutoSeverity escalates repeated offenses",
  () => {
    assert.equal(
      computeAutoSeverity({
        baseSeverity: "Minor",
        offenseCount: 1,
        totalEmployeeCases: 0,
      }),
      "Minor"
    );

    assert.equal(
      computeAutoSeverity({
        baseSeverity: "Minor",
        offenseCount: 3,
        totalEmployeeCases: 0,
      }),
      "Major"
    );

    assert.equal(
      computeAutoSeverity({
        baseSeverity: "Minor",
        offenseCount: 4,
        totalEmployeeCases: 0,
      }),
      "Critical"
    );
  }
);

test(
  "computeAutoSeverity escalates critical sanctions and descriptions",
  () => {
    assert.equal(
      computeAutoSeverity({
        baseSeverity: "Minor",
        sanction:
          "Dismissal / RTA",
      }),
      "Critical"
    );

    assert.equal(
      computeAutoSeverity({
        baseSeverity: "Minor",
        description:
          "Employee reported an unsafe workplace accident.",
      }),
      "Critical"
    );
  }
);

test(
  "countViolationRules counts only rows inside valid rule groups",
  () => {
    assert.equal(
      countViolationRules([
        {
          rows: [
            { id: 1 },
            { id: 2 },
          ],
        },
        {
          rows: [
            { id: 3 },
          ],
        },
        {
          rows: null,
        },
      ]),
      3
    );

    assert.equal(
      countViolationRules(null),
      0
    );
  }
);